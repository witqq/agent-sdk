import type {
  IAgent,
  IAgentService,
  FullAgentConfig,
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
import { getTextContent, ErrorCode, classifyAgentError, isRecoverableErrorCode } from "../types.js";
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

/** @internal Provider-specific response metadata blob exposed by the Vercel AI SDK.
 *  Shape is provider-defined and open; we treat it as a nested record. */
type SDKProviderMetadata = Record<string, Record<string, unknown>>;

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
  providerMetadata?: SDKProviderMetadata;
}

/** @internal Vercel AI SDK generateObject result */
interface SDKGenerateObjectResult {
  object: unknown;
  usage: { inputTokens?: number; outputTokens?: number };
  providerMetadata?: SDKProviderMetadata;
}

/** @internal Vercel AI SDK streamText result */
interface SDKStreamTextResult {
  fullStream: AsyncIterable<SDKStreamPart>;
  totalUsage: PromiseLike<{ inputTokens?: number; outputTokens?: number }>;
  text: PromiseLike<string>;
  providerMetadata: PromiseLike<SDKProviderMetadata | undefined>;
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

/** Module-level mocks set by _injectSDK()/_injectCompat() for testing */
let _sdkMock: SDKModule | null = null;
let _compatMock: SDKCompatModule | null = null;

/** Load the Vercel AI SDK. Checks module-level mock first, then dynamic import. */
async function loadSDK(): Promise<SDKModule> {
  if (_sdkMock) return _sdkMock;
  try {
    // @ts-ignore — peer dependency, not present at compile time
    return (await import("ai")) as SDKModule;
  } catch {
    throw new DependencyError("ai");
  }
}

/** Load the OpenAI-compatible module. Checks module-level mock first, then dynamic import. */
async function loadCompat(): Promise<SDKCompatModule> {
  if (_compatMock) return _compatMock;
  try {
    // @ts-ignore — peer dependency, not present at compile time
    return (await import("@ai-sdk/openai-compatible")) as SDKCompatModule;
  } catch {
    throw new DependencyError("@ai-sdk/openai-compatible");
  }
}

/** @internal For testing: inject mock SDK module */
export function _injectSDK(mock: SDKModule | null): void {
  _sdkMock = mock;
}

/** @internal For testing: inject mock compat module */
export function _injectCompat(mock: SDKCompatModule | null): void {
  _compatMock = mock;
}

/** @internal For testing: reset injected SDK */
export function _resetSDK(): void {
  _sdkMock = null;
  _compatMock = null;
}

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_PROVIDER = "openrouter";
const DEFAULT_MAX_TURNS = 10;

// ─── Provider Metadata Extraction ───────────────────────────────

/** Usage fields extracted from provider response metadata. */
interface ExtractedMetadata {
  cost?: number;
  cachedTokens?: number;
  providerMetadata?: Record<string, JSONValue>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read a finite number from an unknown value, else undefined. */
function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Provider-agnostic extraction of cost / cached tokens / raw metadata from the
 * Vercel AI SDK `providerMetadata` blob. Normalization is best-effort and
 * null-safe: it scans every provider entry for the well-known OpenRouter-style
 * `usage.cost` and `usage.prompt_tokens_details.cached_tokens` locations, so the
 * reference provider works without being hardcoded, and any other provider's
 * data is passed through untouched. Returns an empty object when nothing is
 * present, so absent fields stay undefined.
 */
function extractProviderMetadata(
  metadata: SDKProviderMetadata | undefined,
): ExtractedMetadata {
  if (!isRecord(metadata)) return {};

  let cost: number | undefined;
  let cachedTokens: number | undefined;

  for (const providerEntry of Object.values(metadata)) {
    if (!isRecord(providerEntry)) continue;
    const usage = providerEntry.usage;
    if (!isRecord(usage)) continue;

    if (cost === undefined) {
      cost = asFiniteNumber(usage.cost);
    }
    if (cachedTokens === undefined) {
      const details = usage.prompt_tokens_details;
      if (isRecord(details)) {
        cachedTokens = asFiniteNumber(details.cached_tokens);
      }
    }
  }

  const result: ExtractedMetadata = {
    providerMetadata: metadata as Record<string, JSONValue>,
  };
  if (cost !== undefined) result.cost = cost;
  if (cachedTokens !== undefined) result.cachedTokens = cachedTokens;
  return result;
}

// ─── Provider Metadata Capture (write side) ─────────────────────

/**
 * Augment the outgoing request body so cost-reporting OpenAI-compatible gateways
 * (OpenRouter and similar) include the `usage` block — with `cost`, `cost_details`
 * and `prompt_tokens_details` — in the response. Purely additive: every other body
 * field is preserved. Gateways that don't understand the flag ignore it.
 */
function transformRequestBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return { ...body, usage: { include: true } };
}

/**
 * Build a `metadataExtractor` for `createOpenAICompatible` that lifts the gateway's
 * raw top-level `usage` block into `providerMetadata` under the provider id — exactly
 * where {@link extractProviderMetadata} (the read side) looks. `@ai-sdk/openai-compatible`
 * does not copy non-standard `usage` fields (`cost`, `cost_details`,
 * `prompt_tokens_details`) by default, so without this they never reach the reader.
 *
 * Provider-agnostic and non-fabricating: it surfaces whatever `usage` the gateway
 * returns and nothing when there is none, so absent cost stays undefined. Covers both
 * the non-streaming response (whole parsed body) and the streaming response (the last
 * chunk that carries `usage` wins).
 */
function createUsageMetadataExtractor(providerName: string): {
  extractMetadata: (args: {
    parsedBody: unknown;
  }) => Promise<Record<string, unknown> | undefined>;
  createStreamExtractor: () => {
    processChunk(parsedChunk: unknown): void;
    buildMetadata(): Record<string, unknown> | undefined;
  };
} {
  const wrap = (usage: Record<string, unknown>) => ({
    [providerName]: { usage },
  });

  return {
    extractMetadata: async ({ parsedBody }) =>
      isRecord(parsedBody) && isRecord(parsedBody.usage)
        ? wrap(parsedBody.usage)
        : undefined,
    createStreamExtractor: () => {
      let usage: Record<string, unknown> | undefined;
      return {
        processChunk(parsedChunk: unknown): void {
          if (isRecord(parsedChunk) && isRecord(parsedChunk.usage)) {
            usage = parsedChunk.usage;
          }
        },
        buildMetadata: () => (usage ? wrap(usage) : undefined),
      };
    },
  };
}

// ─── Tool Mapping ───────────────────────────────────────────────

function mapToolsToSDK(
  sdk: SDKModule,
  tools: ToolDefinition[],
  config: FullAgentConfig,
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
  supervisor: FullAgentConfig["supervisor"],
  sessionApprovals: Set<string>,
  permissionStore: IPermissionStore | undefined,
  signal: AbortSignal,
): (args: unknown, options?: { toolCallId?: string }) => Promise<JSONValue> {
  return async (args: unknown, options?: { toolCallId?: string }): Promise<JSONValue> => {
    // Permission check for tools with needsApproval
    if (ourTool.needsApproval && supervisor?.onPermission) {
      // Check store first, then fall back to sessionApprovals set
      const storeApproved = permissionStore && await permissionStore.isApproved(ourTool.name);
      if (!storeApproved && !sessionApprovals.has(ourTool.name)) {
        const request: UnifiedPermissionRequest = {
          toolName: ourTool.name,
          toolArgs: (args ?? {}) as Record<string, unknown>,
          toolCallId: options?.toolCallId,
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

        // Cache session-scoped approvals in memory
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
        const thinking = msg.thinking;
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
        code: ErrorCode.TOOL_EXECUTION,
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
      const errorMsg = p.error instanceof Error
        ? p.error.message
        : String(p.error ?? "Unknown error");
      const code = classifyAgentError(errorMsg);
      return {
        type: "error",
        error: errorMsg,
        recoverable: isRecoverableErrorCode(code),
        code,
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
    config: FullAgentConfig,
    backendOptions: VercelAIBackendOptions,
  ) {
    super(config);
    this.backendOptions = backendOptions;
  }

  private async getModel(options: RunOptions): Promise<SDKLanguageModel> {
    const requestedModel = options.model;
    const defaultModel = this.config.model;

    // If same as default/cached, reuse
    if (requestedModel === defaultModel && this.model) return this.model;

    const compat = await loadCompat();
    const providerName = this.backendOptions.provider ?? DEFAULT_PROVIDER;
    const provider = compat.createOpenAICompatible({
      name: providerName,
      baseURL: this.backendOptions.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: this.backendOptions.apiKey,
      // Surface gateway-reported cost / cached tokens (OpenRouter et al.) into
      // providerMetadata where extractProviderMetadata reads them. The base
      // openai-compatible provider drops these non-standard usage fields otherwise.
      transformRequestBody,
      metadataExtractor: createUsageMetadataExtractor(providerName),
    });

    const model = provider.chatModel(requestedModel);
    // Cache only when using default model
    if (requestedModel === defaultModel) {
      this.model = model;
    }
    return model;
  }

  private async getSDKTools(signal: AbortSignal, options?: RunOptions): Promise<Record<string, SDKToolDefinition>> {
    const sdk = await loadSDK();
    const tools = this.resolveTools(options);
    return mapToolsToSDK(sdk, tools, this.config, this.sessionApprovals, this.config.permissionStore, signal);
  }

  // ─── executeRun ─────────────────────────────────────────────────

  protected async executeRun(
    messages: Message[],
    options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const model = await this.getModel(options);
    const tools = await this.getSDKTools(signal, options);
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
      ...extractProviderMetadata(result.providerMetadata),
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
    options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult<T>> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const model = await this.getModel(options);

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
      ...extractProviderMetadata(result.providerMetadata),
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
    options: RunOptions,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const model = await this.getModel(options);
    const tools = await this.getSDKTools(signal, options);
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
    let lastFinishReason: string | undefined;

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
          lastFinishReason = p.finishReason;
          if (p.finishReason === "tool-calls") {
            finalText = "";
          }
        }

        // The final `finish` part carries the overall finishReason
        if ((part as SDKStreamPart).type === "finish") {
          const p = part as Extract<SDKStreamPart, { type: "finish" }>;
          lastFinishReason = p.finishReason;
        }
      }

      // Emit final usage from totalUsage. Provider metadata (cost, cache, raw)
      // surfaces on the awaited stream result, not the per-step finish parts.
      const totalUsage = await result.totalUsage;
      const streamMetadata = extractProviderMetadata(await result.providerMetadata);
      yield {
        type: "usage_update",
        promptTokens: Number(totalUsage?.inputTokens ?? 0),
        completionTokens: Number(totalUsage?.outputTokens ?? 0),
        ...streamMetadata,
      };

      const hasStreamed = finalText.length > 0;
      yield {
        type: "done",
        finalOutput: hasStreamed ? null : (finalText || null),
        ...(hasStreamed ? { streamed: true } : {}),
        ...(lastFinishReason ? { finishReason: lastFinishReason } : {}),
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

  createAgent(config: FullAgentConfig): IAgent {
    if (this.disposed) throw new DisposedError("VercelAIAgentService");
    return new VercelAIAgent(config, this.options);
  }

  async listModels(): Promise<ModelInfo[]> {
    if (this.disposed) throw new DisposedError("VercelAIAgentService");

    const baseUrl = (this.options.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");

    try {
      const res = await globalThis.fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          // OpenRouter requires HTTP-Referer for API access
          "HTTP-Referer": "https://github.com/nicepkg/agent-sdk",
        },
      });

      if (!res.ok) {
        return [];
      }

      const body = await res.json() as Record<string, unknown>;

      // OpenAI-compatible format: { data: [{ id, name?, description?, context_length? }] }
      if (body.data && Array.isArray(body.data)) {
        return (body.data as Array<Record<string, unknown>>)
          .filter((m) => typeof m.id === "string")
          .map((m) => ({
            id: m.id as string,
            ...(typeof m.name === "string" && { name: m.name }),
            ...(typeof m.description === "string" && { description: m.description }),
            ...(typeof m.context_length === "number" && { contextWindow: m.context_length }),
          }));
      }

      // Some providers return a flat array of model objects
      if (Array.isArray(body)) {
        return (body as Array<Record<string, unknown>>)
          .filter((m) => typeof m.id === "string")
          .map((m) => ({
            id: m.id as string,
            ...(typeof m.name === "string" && { name: m.name }),
            ...(typeof m.description === "string" && { description: m.description }),
            ...(typeof m.context_length === "number" && { contextWindow: m.context_length }),
          }));
      }

      return [];
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
