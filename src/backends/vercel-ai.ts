import type {
  IAgent,
  IAgentService,
  AgentConfig,
  AgentResult,
  AgentEvent,
  Message,
  RunOptions,
  StructuredOutputConfig,
  ToolDefinition,
  VercelAIBackendOptions,
  ModelInfo,
  ValidationResult,
  JSONValue,
  PermissionRequest as UnifiedPermissionRequest,
  PermissionDecision,
} from "../types.js";
import { getTextContent } from "../types.js";
import { BaseAgent } from "../base-agent.js";
import { DisposedError, DependencyError, AbortError, ToolExecutionError } from "../errors.js";
import { zodToJsonSchema } from "../utils/schema.js";
import type { IPermissionStore } from "../permission-store.js";

export type { VercelAIBackendOptions } from "../types.js";

// ─── Local Type Definitions (matching Vercel AI SDK v6 shapes) ──
// Avoids requiring the SDK to be installed at compile time.

/** @internal Vercel AI SDK tool result */
interface SDKToolDefinition {
  description: string;
  inputSchema: unknown;
  execute?: (input: unknown, options: unknown) => Promise<unknown>;
  needsApproval?: boolean | ((input: unknown, options: unknown) => Promise<boolean>);
}

/** @internal Vercel AI SDK v6 generateText result */
interface SDKGenerateTextResult {
  text: string;
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>;
  toolResults: Array<{ toolCallId: string; toolName: string; output: unknown }>;
  steps: Array<{
    text: string;
    toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>;
    toolResults: Array<{ toolCallId: string; toolName: string; output: unknown }>;
    usage: { inputTokens?: number; outputTokens?: number };
    finishReason: string;
  }>;
  totalUsage: { inputTokens?: number; outputTokens?: number };
  finishReason: string;
  response: { messages: unknown[] };
}

/** @internal Vercel AI SDK generateObject result */
interface SDKGenerateObjectResult {
  object: unknown;
  usage: { inputTokens?: number; outputTokens?: number };
}

/** @internal Vercel AI SDK streamText result */
interface SDKStreamTextResult {
  fullStream: AsyncIterable<SDKStreamPart>;
  totalUsage: PromiseLike<{ inputTokens?: number; outputTokens?: number }>;
  text: PromiseLike<string>;
}

/** @internal Vercel AI SDK v6 stream part union */
type SDKStreamPart =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; output: unknown }
  | { type: "tool-error"; toolCallId: string; toolName: string; error: unknown }
  | { type: "reasoning-start" }
  | { type: "reasoning-end" }
  | { type: "reasoning-delta"; text: string }
  | { type: "finish-step"; usage: { inputTokens?: number; outputTokens?: number }; finishReason: string }
  | { type: "finish"; finishReason: string; totalUsage: { inputTokens?: number; outputTokens?: number } }
  | { type: "error"; error: unknown }
  | { type: string };

/** @internal Vercel AI SDK LanguageModel — opaque type from SDK */
type SDKLanguageModel = Record<string, unknown>;

/** @internal SDK module shape */
interface SDKModule {
  generateText: (options: Record<string, unknown>) => Promise<SDKGenerateTextResult>;
  streamText: (options: Record<string, unknown>) => SDKStreamTextResult;
  generateObject: (options: Record<string, unknown>) => Promise<SDKGenerateObjectResult>;
  tool: (options: Record<string, unknown>) => SDKToolDefinition;
  jsonSchema: (schema: unknown) => unknown;
  stepCountIs: (count: number) => unknown;
}

/** @internal OpenAI-compatible module shape */
interface SDKCompatModule {
  createOpenAICompatible: (options: Record<string, unknown>) => {
    chatModel: (modelId: string) => SDKLanguageModel;
    languageModel: (modelId: string) => SDKLanguageModel;
  };
}

// ─── Dynamic SDK Loader ─────────────────────────────────────────

let sdkModule: SDKModule | null = null;
let compatModule: SDKCompatModule | null = null;

async function loadSDK(): Promise<SDKModule> {
  if (sdkModule) return sdkModule;
  try {
    // @ts-ignore — peer dependency, not present at compile time
    sdkModule = (await import("ai")) as SDKModule;
    return sdkModule!;
  } catch {
    throw new DependencyError("ai");
  }
}

async function loadCompat(): Promise<SDKCompatModule> {
  if (compatModule) return compatModule;
  try {
    // @ts-ignore — peer dependency, not present at compile time
    compatModule = (await import("@ai-sdk/openai-compatible")) as SDKCompatModule;
    return compatModule!;
  } catch {
    throw new DependencyError("@ai-sdk/openai-compatible");
  }
}

/** @internal For testing: inject mock SDK module */
export function _injectSDK(mock: SDKModule | null): void {
  sdkModule = mock;
}

/** @internal For testing: inject mock compat module */
export function _injectCompat(mock: SDKCompatModule | null): void {
  compatModule = mock;
}

/** @internal For testing: reset injected SDK */
export function _resetSDK(): void {
  sdkModule = null;
  compatModule = null;
}

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_PROVIDER = "openrouter";
const DEFAULT_MAX_TURNS = 10;

// ─── Tool Mapping ───────────────────────────────────────────────

function mapToolsToSDK(
  sdk: SDKModule,
  tools: ToolDefinition[],
  config: AgentConfig,
  sessionApprovals: Set<string>,
  permissionStore: IPermissionStore | undefined,
  signal: AbortSignal,
): Record<string, SDKToolDefinition> {
  const toolMap: Record<string, SDKToolDefinition> = {};
  const supervisor = config.supervisor;

  for (const ourTool of tools) {
    const jsonSchema = zodToJsonSchema(ourTool.parameters);

    toolMap[ourTool.name] = sdk.tool({
      description: ourTool.description,
      inputSchema: sdk.jsonSchema(jsonSchema),
      execute: wrapToolExecute(ourTool, supervisor, sessionApprovals, permissionStore, signal),
      ...(ourTool.needsApproval && supervisor?.onPermission
        ? {
            needsApproval: async (_input: Record<string, unknown>) => {
              // If already approved via store, skip
              if (permissionStore && await permissionStore.isApproved(ourTool.name)) return false;
              // If already session-approved, skip
              if (sessionApprovals.has(ourTool.name)) return false;
              return true; // will be handled in execute wrapper
            },
          }
        : {}),
    });
  }

  // M1: Inject built-in ask_user tool when supervisor.onAskUser is provided
  if (supervisor?.onAskUser) {
    const onAskUser = supervisor.onAskUser;
    toolMap["ask_user"] = sdk.tool({
      description: "Ask the user a question and wait for their response",
      inputSchema: sdk.jsonSchema({
        type: "object",
        properties: {
          question: { type: "string", description: "The question to ask the user" },
        },
        required: ["question"],
      }),
      execute: async (args: { question: string }) => {
        const response = await onAskUser(
          { question: args.question, allowFreeform: true },
          signal,
        );
        return response.answer;
      },
    });
  }

  return toolMap;
}

function wrapToolExecute(
  ourTool: ToolDefinition,
  supervisor: AgentConfig["supervisor"],
  sessionApprovals: Set<string>,
  permissionStore: IPermissionStore | undefined,
  signal: AbortSignal,
): (args: unknown) => Promise<JSONValue> {
  return async (args: unknown): Promise<JSONValue> => {
    // Permission check for tools with needsApproval
    if (ourTool.needsApproval && supervisor?.onPermission) {
      // Check store first, then fall back to sessionApprovals set
      const storeApproved = permissionStore && await permissionStore.isApproved(ourTool.name);
      if (!storeApproved && !sessionApprovals.has(ourTool.name)) {
        const request: UnifiedPermissionRequest = {
          toolName: ourTool.name,
          toolArgs: (args ?? {}) as Record<string, unknown>,
        };

        const decision: PermissionDecision = await supervisor.onPermission(
          request,
          signal,
        );

        if (!decision.allowed) {
          throw new ToolExecutionError(
            ourTool.name,
            decision.reason ?? "Permission denied",
          );
        }

        // Persist approval to store if available
        if (permissionStore && decision.scope) {
          await permissionStore.approve(ourTool.name, decision.scope);
        }

        // Also keep sessionApprovals for backward compat
        if (decision.scope === "session" || decision.scope === "always" || decision.scope === "project") {
          sessionApprovals.add(ourTool.name);
        }

        // Use modified input if provided
        if (decision.modifiedInput) {
          args = decision.modifiedInput;
        }
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ourTool.execute(args as any);
      return result as JSONValue;
    } catch (e) {
      if (e instanceof ToolExecutionError) throw e;
      throw new ToolExecutionError(
        ourTool.name,
        e instanceof Error ? e.message : String(e),
      );
    }
  };
}

// ─── Message Conversion ─────────────────────────────────────────

function messagesToSDK(messages: Message[]): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    switch (msg.role) {
      case "user":
        return { role: "user", content: getTextContent(msg.content) };
      case "assistant": {
        let content = getTextContent(msg.content);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const thinking = (msg as any).thinking as string | undefined;
        if (thinking) {
          content = `[reasoning: ${thinking}]\n${content}`;
        }
        const mapped: Record<string, unknown> = { role: "assistant", content };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          mapped.toolCalls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            args: tc.args,
          }));
        }
        return mapped;
      }
      case "system":
        return { role: "system", content: msg.content };
      case "tool": {
        if (msg.toolResults && msg.toolResults.length > 0) {
          return {
            role: "tool",
            toolResults: msg.toolResults.map((tr) => ({
              toolCallId: tr.toolCallId,
              name: tr.name,
              result: tr.result,
              isError: tr.isError ?? false,
            })),
          };
        }
        return { role: "tool", content: msg.content ?? "" };
      }
      default:
        return { role: "user", content: "" };
    }
  });
}

// ─── Event Mapping (fullStream → AgentEvent) ────────────────────

function mapStreamPart(part: SDKStreamPart): AgentEvent | null {
  switch (part.type) {
    case "text-delta": {
      const p = part as Extract<SDKStreamPart, { type: "text-delta" }>;
      return { type: "text_delta", text: p.text ?? "" };
    }

    case "tool-call": {
      const p = part as Extract<SDKStreamPart, { type: "tool-call" }>;
      return {
        type: "tool_call_start",
        toolCallId: String(p.toolCallId ?? ""),
        toolName: p.toolName ?? "unknown",
        args: (p.input ?? {}) as JSONValue,
      };
    }

    case "tool-result": {
      const p = part as Extract<SDKStreamPart, { type: "tool-result" }>;
      return {
        type: "tool_call_end",
        toolCallId: String(p.toolCallId ?? ""),
        toolName: p.toolName ?? "unknown",
        result: (p.output ?? null) as JSONValue,
      };
    }

    case "tool-error": {
      const p = part as Extract<SDKStreamPart, { type: "tool-error" }>;
      return {
        type: "error",
        error: p.error instanceof Error
          ? p.error.message
          : String(p.error ?? "Tool execution failed"),
        recoverable: true,
      };
    }

    case "reasoning-start":
      return { type: "thinking_start" };

    case "reasoning-end":
      return { type: "thinking_end" };

    case "reasoning-delta": {
      const p = part as Extract<SDKStreamPart, { type: "reasoning-delta" }>;
      return { type: "thinking_delta", text: p.text ?? "" };
    }

    case "finish-step": {
      const p = part as Extract<SDKStreamPart, { type: "finish-step" }>;
      return {
        type: "usage_update",
        promptTokens: Number(p.usage?.inputTokens ?? 0),
        completionTokens: Number(p.usage?.outputTokens ?? 0),
      };
    }

    case "error": {
      const p = part as Extract<SDKStreamPart, { type: "error" }>;
      return {
        type: "error",
        error: p.error instanceof Error
          ? p.error.message
          : String(p.error ?? "Unknown error"),
        recoverable: false,
      };
    }

    default:
      return null;
  }
}

// ─── VercelAIAgent ──────────────────────────────────────────────

class VercelAIAgent extends BaseAgent {
  protected readonly backendName = "vercel-ai";
  private readonly backendOptions: VercelAIBackendOptions;
  private readonly sessionApprovals = new Set<string>();
  private model: SDKLanguageModel | null = null;

  constructor(
    config: AgentConfig,
    backendOptions: VercelAIBackendOptions,
  ) {
    super(config);
    this.backendOptions = backendOptions;
  }

  private async getModel(): Promise<SDKLanguageModel> {
    if (this.model) return this.model;

    const compat = await loadCompat();
    const provider = compat.createOpenAICompatible({
      name: this.backendOptions.provider ?? DEFAULT_PROVIDER,
      baseURL: this.backendOptions.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: this.backendOptions.apiKey,
    });

    const modelId = this.config.model ?? "anthropic/claude-sonnet-4-5";
    this.model = provider.chatModel(modelId);
    return this.model;
  }

  private async getSDKTools(signal: AbortSignal): Promise<Record<string, SDKToolDefinition>> {
    const sdk = await loadSDK();
    return mapToolsToSDK(sdk, this.config.tools ?? [], this.config, this.sessionApprovals, this.config.permissionStore, signal);
  }

  // ─── executeRun ─────────────────────────────────────────────────

  protected async executeRun(
    messages: Message[],
    _options: RunOptions | undefined,
    signal: AbortSignal,
  ): Promise<AgentResult> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const model = await this.getModel();
    const tools = await this.getSDKTools(signal);
    const maxTurns = this.config.maxTurns ?? DEFAULT_MAX_TURNS;

    const sdkMessages = messagesToSDK(messages);
    const hasTools = Object.keys(tools).length > 0;

    const result: SDKGenerateTextResult = await sdk.generateText({
      model,
      system: this.config.systemPrompt,
      messages: sdkMessages,
      tools: hasTools ? tools : undefined,
      stopWhen: sdk.stepCountIs(maxTurns),
      abortSignal: signal,
      ...(this.config.modelParams?.temperature !== undefined && {
        temperature: this.config.modelParams.temperature,
      }),
      ...(this.config.modelParams?.maxTokens !== undefined && {
        maxTokens: this.config.modelParams.maxTokens,
      }),
      ...(this.config.modelParams?.topP !== undefined && {
        topP: this.config.modelParams.topP,
      }),
      ...(this.config.providerOptions && {
        providerOptions: this.config.providerOptions,
      }),
    });

    // Collect all tool calls across all steps
    const toolCalls: AgentResult["toolCalls"] = [];
    for (const step of result.steps) {
      for (const tc of step.toolCalls) {
        const matchingResult = step.toolResults.find(
          (tr) => tr.toolCallId === tc.toolCallId,
        );
        toolCalls.push({
          toolName: tc.toolName,
          args: (tc.input ?? {}) as JSONValue,
          result: (matchingResult?.output ?? null) as JSONValue,
          approved: true,
        });
      }
    }

    const usage = {
      promptTokens: Number(result.totalUsage?.inputTokens ?? 0),
      completionTokens: Number(result.totalUsage?.outputTokens ?? 0),
    };

    // In multi-step flows, result.text includes intermediate reasoning from all steps.
    // Use only the last step's text as the final output.
    const lastStep = result.steps.length > 0 ? result.steps[result.steps.length - 1] : null;
    const outputText = lastStep?.text || null;

    return {
      output: outputText,
      structuredOutput: undefined as AgentResult["structuredOutput"],
      toolCalls,
      messages: [
        ...messages,
        ...(outputText
          ? [{ role: "assistant" as const, content: outputText }]
          : []),
      ],
      usage,
    };
  }

  // ─── executeRunStructured ───────────────────────────────────────

  protected async executeRunStructured<T>(
    messages: Message[],
    schema: StructuredOutputConfig<T>,
    _options: RunOptions | undefined,
    signal: AbortSignal,
  ): Promise<AgentResult<T>> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const model = await this.getModel();

    const sdkMessages = messagesToSDK(messages);
    const jsonSchema = zodToJsonSchema(schema.schema);

    const result: SDKGenerateObjectResult = await sdk.generateObject({
      model,
      system: this.config.systemPrompt,
      messages: sdkMessages,
      schema: sdk.jsonSchema(jsonSchema),
      schemaName: schema.name,
      schemaDescription: schema.description,
      abortSignal: signal,
      ...(this.config.modelParams?.temperature !== undefined && {
        temperature: this.config.modelParams.temperature,
      }),
      ...(this.config.modelParams?.maxTokens !== undefined && {
        maxTokens: this.config.modelParams.maxTokens,
      }),
      ...(this.config.providerOptions && {
        providerOptions: this.config.providerOptions,
      }),
    });

    // Validate and parse through our zod schema
    let structuredOutput: T | undefined;
    try {
      structuredOutput = schema.schema.parse(result.object);
    } catch {
      // If zod validation fails, leave undefined
    }

    const usage = {
      promptTokens: Number(result.usage?.inputTokens ?? 0),
      completionTokens: Number(result.usage?.outputTokens ?? 0),
    };

    return {
      output: JSON.stringify(result.object),
      structuredOutput: structuredOutput as AgentResult<T>["structuredOutput"],
      toolCalls: [],
      messages: [
        ...messages,
        ...(result.object != null
          ? [{ role: "assistant" as const, content: JSON.stringify(result.object) }]
          : []),
      ],
      usage,
    };
  }

  // ─── executeStream ──────────────────────────────────────────────

  protected async *executeStream(
    messages: Message[],
    _options: RunOptions | undefined,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const model = await this.getModel();
    const tools = await this.getSDKTools(signal);
    const maxTurns = this.config.maxTurns ?? DEFAULT_MAX_TURNS;

    const sdkMessages = messagesToSDK(messages);
    const hasTools = Object.keys(tools).length > 0;

    const result: SDKStreamTextResult = sdk.streamText({
      model,
      system: this.config.systemPrompt,
      messages: sdkMessages,
      tools: hasTools ? tools : undefined,
      stopWhen: sdk.stepCountIs(maxTurns),
      abortSignal: signal,
      ...(this.config.modelParams?.temperature !== undefined && {
        temperature: this.config.modelParams.temperature,
      }),
      ...(this.config.modelParams?.maxTokens !== undefined && {
        maxTokens: this.config.modelParams.maxTokens,
      }),
      ...(this.config.modelParams?.topP !== undefined && {
        topP: this.config.modelParams.topP,
      }),
      ...(this.config.providerOptions && {
        providerOptions: this.config.providerOptions,
      }),
    });

    let finalText = "";

    try {
      for await (const part of result.fullStream) {
        if (signal.aborted) throw new AbortError();

        const event = mapStreamPart(part as SDKStreamPart);
        if (event) yield event;

        if ((part as SDKStreamPart).type === "text-delta") {
          finalText += (part as Extract<SDKStreamPart, { type: "text-delta" }>).text ?? "";
        }

        // When a step finishes with tool calls, the text accumulated so far is
        // intermediate reasoning (e.g. "Let me search..."). Reset so that only
        // the final step's text becomes the output.
        if ((part as SDKStreamPart).type === "finish-step") {
          const p = part as Extract<SDKStreamPart, { type: "finish-step" }>;
          if (p.finishReason === "tool-calls") {
            finalText = "";
          }
        }
      }

      // Emit final usage from totalUsage
      const totalUsage = await result.totalUsage;
      yield {
        type: "usage_update",
        promptTokens: Number(totalUsage?.inputTokens ?? 0),
        completionTokens: Number(totalUsage?.outputTokens ?? 0),
      };

      yield {
        type: "done",
        finalOutput: finalText || null,
      };
    } catch (e) {
      if (signal.aborted) throw new AbortError();
      throw e;
    }
  }

  override dispose(): void {
    this.sessionApprovals.clear();
    this.model = null;
    super.dispose();
  }
}

// ─── VercelAIAgentService ───────────────────────────────────────

class VercelAIAgentService implements IAgentService {
  readonly name = "vercel-ai";
  private disposed = false;
  private readonly options: VercelAIBackendOptions;

  constructor(options: VercelAIBackendOptions) {
    this.options = options;
  }

  createAgent(config: AgentConfig): IAgent {
    if (this.disposed) throw new DisposedError("VercelAIAgentService");
    return new VercelAIAgent(config, this.options);
  }

  async listModels(): Promise<ModelInfo[]> {
    if (this.disposed) throw new DisposedError("VercelAIAgentService");

    const baseUrl = (this.options.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");

    try {
      const res = await globalThis.fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.options.apiKey}` },
      });

      if (!res.ok) {
        return [];
      }

      const body = (await res.json()) as { data?: Array<{ id: string }> };
      if (!body.data || body.data.length === 0) {
        return [];
      }

      return body.data.map((m) => ({ id: m.id }));
    } catch {
      return [];
    }
  }

  async validate(): Promise<ValidationResult> {
    if (this.disposed) throw new DisposedError("VercelAIAgentService");

    const errors: string[] = [];

    if (!this.options.apiKey) {
      errors.push("apiKey is required for Vercel AI backend.");
    }

    try {
      await loadSDK();
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }

    try {
      await loadCompat();
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }

    return { valid: errors.length === 0, errors };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
  }
}

// ─── Factory ────────────────────────────────────────────────────

/** Create Vercel AI SDK backend service. */
export function createVercelAIService(
  options: VercelAIBackendOptions,
): IAgentService {
  return new VercelAIAgentService(options);
}
