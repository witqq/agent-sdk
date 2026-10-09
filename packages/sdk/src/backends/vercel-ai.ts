import type {
  IAgent,
  IAgentService,
  FullAgentConfig,
  AgentResult,
  AgentEvent,
  Message,
  RunOptions,
  ProviderAcknowledgment,
  StructuredOutputConfig,
  ToolDefinition,
  VercelAIBackendOptions,
  ModelInfo,
  ValidationResult,
  JSONValue,
  LocalToolRefusal,
  PermissionRequest as UnifiedPermissionRequest,
  PermissionDecision,
} from "../types.js";
import { getTextContent, ErrorCode, classifyAgentError, isRecoverableErrorCode } from "../types.js";
import { BaseAgent } from "../base-agent.js";
import { AgentSDKError, ProviderAcknowledgmentError, DisposedError, DependencyError, AbortError, ToolExecutionError } from "../errors.js";
import { zodToJsonSchema } from "../utils/schema.js";
import type { IPermissionStore } from "../permission-store.js";
import { z } from "zod";

export type { VercelAIBackendOptions } from "../types.js";

// ─── Local Type Definitions (matching Vercel AI SDK v7 shapes) ──
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

/** @internal Vercel AI SDK v7 generateText result */
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
    providerMetadata?: SDKProviderMetadata;
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

interface SDKTokenUsage { inputTokens?: number; outputTokens?: number; raw?: Record<string, unknown> }

/** @internal Vercel AI SDK v7 stream part union */
type SDKStreamPart =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown; invalid?: boolean; error?: unknown; providerExecuted?: boolean }
  | { type: "tool-result"; toolCallId: string; toolName: string; output: unknown }
  | { type: "tool-error"; toolCallId: string; toolName: string; error: unknown; input?: unknown; providerExecuted?: boolean }
  | { type: "reasoning-start" }
  | { type: "reasoning-end" }
  | { type: "reasoning-delta"; text: string }
  | {
      type: "finish-step";
      usage: SDKTokenUsage;
      finishReason: string;
      providerMetadata?: SDKProviderMetadata;
    }
  | { type: "finish"; finishReason: string; totalUsage: { inputTokens?: number; outputTokens?: number } }
  | { type: "error"; error: unknown }
  | { type: string };

/** @internal Vercel AI SDK LanguageModel — opaque type from SDK */
type SDKLanguageModel = Record<string, unknown>;

/** @internal SDK module shape */
interface SDKModule {
  InvalidPromptError?: { isInstance: (error: unknown) => boolean };
  StreamProviderError?: { isInstance: (error: unknown) => boolean };
  NoSuchToolError?: { isInstance: (error: unknown) => boolean };
  InvalidToolInputError?: { isInstance: (error: unknown) => boolean };
  generateText: (options: Record<string, unknown>) => Promise<SDKGenerateTextResult>;
  streamText: (options: Record<string, unknown>) => SDKStreamTextResult;
  generateObject: (options: Record<string, unknown>) => Promise<SDKGenerateObjectResult>;
  tool: (options: Record<string, unknown>) => SDKToolDefinition;
  jsonSchema: (schema: unknown, options?: { validate: (value: unknown) => Promise<{ success: true; value: unknown } | { success: false; error: Error }> }) => unknown;
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

/**
 * Aggregate normalized billing fields over the same set of AI SDK steps as
 * `totalUsage`. The AI SDK's top-level `providerMetadata` belongs only to the
 * final step, so using it beside `totalUsage` under-reports multi-step runs.
 *
 * Raw metadata remains the final available step blob for backwards
 * compatibility; only the normalized additive fields are summed. When no step
 * exposes metadata (older compatible SDKs/mocks), `fallback` is used once.
 */
function aggregateProviderMetadata(
  steps: Array<{ providerMetadata?: SDKProviderMetadata }>,
  fallback?: SDKProviderMetadata,
): ExtractedMetadata {
  const stepMetadata = steps
    .map((step) => step.providerMetadata)
    .filter((metadata): metadata is SDKProviderMetadata => metadata !== undefined);
  const metadataEntries = stepMetadata.length > 0
    ? stepMetadata
    : (fallback === undefined ? [] : [fallback]);

  let cost = 0;
  let cachedTokens = 0;
  let hasCost = false;
  let allCostsKnown = metadataEntries.length > 0 && (steps.length <= 1 || stepMetadata.length === steps.length);
  let hasCachedTokens = false;

  for (const metadata of metadataEntries) {
    const extracted = extractProviderMetadata(metadata);
    if (extracted.cost !== undefined) {
      cost += extracted.cost;
      hasCost = true;
    } else {
      allCostsKnown = false;
    }
    if (extracted.cachedTokens !== undefined) {
      cachedTokens += extracted.cachedTokens;
      hasCachedTokens = true;
    }
  }

  const providerMetadata = metadataEntries.at(-1);
  return {
    ...(hasCost && allCostsKnown ? { cost } : {}),
    ...(hasCachedTokens ? { cachedTokens } : {}),
    ...(providerMetadata !== undefined
      ? { providerMetadata: providerMetadata as Record<string, JSONValue> }
      : {}),
  };
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
function createUsageMetadataExtractor(providerName: string, calls?: StreamedCallNames): {
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
      calls?.reset();
      let usage: Record<string, unknown> | undefined;
      return {
        processChunk(parsedChunk: unknown): void {
          calls?.observe(parsedChunk);
          if (isRecord(parsedChunk) && isRecord(parsedChunk.usage)) {
            usage = parsedChunk.usage;
          }
        },
        buildMetadata: () => (usage ? wrap(usage) : undefined),
      };
    },
  };
}

/** Observe parsed provider fields without decoding or rewriting the transport.
 * Only an initially empty name followed by one exact name can be normalized. */
class StreamedCallNames {
  private readonly slots = new Map<string, { id: string; initialName: unknown; name?: string; conflicted: boolean }>();
  reset(): void { this.slots.clear(); }
  observe(chunk: unknown): void {
    if (!isRecord(chunk) || !Array.isArray(chunk.choices)) return;
    for (const choice of chunk.choices) {
      if (!isRecord(choice) || !Number.isInteger(choice.index) || !isRecord(choice.delta) || !Array.isArray(choice.delta.tool_calls)) continue;
      for (const call of choice.delta.tool_calls) {
        if (!isRecord(call) || !Number.isInteger(call.index)) continue;
        const key = `${choice.index}:${call.index}`;
        let slot = this.slots.get(key);
        const name = isRecord(call.function) ? call.function.name : undefined;
        if (!slot) {
          if (typeof call.id !== "string" || !call.id || this.slots.size >= 256) continue;
          slot = { id: call.id, initialName: name, conflicted: false };
          this.slots.set(key, slot);
        } else if (call.id !== undefined && call.id !== slot.id) slot.conflicted = true;
        if (typeof name === "string" && name.length > 0) {
          if (name.length > 1024 || (slot.name !== undefined && slot.name !== name)) slot.conflicted = true;
          else slot.name = name;
        }
      }
    }
  }
  delayedName(id: string): string | undefined {
    const matches = [...this.slots.values()].filter(slot => slot.id === id);
    const slot = matches.length === 1 ? matches[0] : undefined;
    return slot?.initialName === "" && !slot.conflicted ? slot.name : undefined;
  }
}

function validatedSchema(sdk: SDKModule, schema: z.ZodType): unknown {
  return sdk.jsonSchema(zodToJsonSchema(schema), {
    validate: async value => {
      const parsed = await schema.safeParseAsync(value);
      return parsed.success ? { success: true, value: parsed.data } : { success: false, error: parsed.error };
    },
  });
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
    toolMap[ourTool.name] = sdk.tool({
      description: ourTool.description,
      inputSchema: validatedSchema(sdk, ourTool.parameters),
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
      inputSchema: validatedSchema(sdk, z.object({ question: z.string().describe("The question to ask the user") })),
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
        streamErrorCause(e).message,
        { cause: e },
      );
    }
  };
}

// ─── Message Conversion ─────────────────────────────────────────

/** Observe each execution separately without mutating a cached provider model. */
function observeDispatch(model: SDKLanguageModel, provider: string, invocationCounter: { next: number }, acknowledgment?: RunOptions["onProviderAcknowledgment"]) {
  let entered = false;
  return {
    get entered() { return entered; },
    model: new Proxy(model, {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        if ((property === "doGenerate" || property === "doStream") && typeof value === "function") {
          return (...args: unknown[]) => {
            entered = true;
            const index = invocationCounter.next++;
            if (!acknowledgment) return Reflect.apply(value, target, args);
            let observed: ProviderAcknowledgment | undefined;
            const observe = async (metadata: unknown, raw = false) => {
              if (!isRecord(metadata) || (raw && ("error" in metadata || !Array.isArray(metadata.choices)))) return;
              if (typeof metadata.id !== "string" || !metadata.id.trim()) return;
              const time = raw ? (typeof metadata.created === "number" ? new Date(metadata.created * 1000) : undefined) : metadata.timestamp;
              const next: ProviderAcknowledgment = { provider, modelCallIndex: index, responseId: metadata.id,
                ...(typeof metadata.model === "string" && raw ? { modelId: metadata.model } : {}),
                ...(!raw && typeof metadata.modelId === "string" ? { modelId: metadata.modelId } : {}),
                ...(time instanceof Date && Number.isFinite(time.getTime()) ? { timestamp: time.toISOString() } : {}),
              };
              if (observed) {
                if (observed.responseId !== next.responseId ||
                    (observed.modelId !== undefined && next.modelId !== undefined && observed.modelId !== next.modelId) ||
                    (observed.timestamp !== undefined && next.timestamp !== undefined && observed.timestamp !== next.timestamp)) {
                  throw new ProviderAcknowledgmentError("identity_conflict", { ...observed });
                }
                observed.modelId ??= next.modelId;
                observed.timestamp ??= next.timestamp;
                return;
              }
              observed = { ...next };
              try { await acknowledgment({ ...next }); }
              catch (cause) { throw new ProviderAcknowledgmentError("persistence_failed", { ...next }, cause); }
            };
            return (async () => {
              if (property === "doStream" && isRecord(args[0])) args[0] = { ...args[0], includeRawChunks: true };
              const result = await Reflect.apply(value, target, args);
              if (!isRecord(result)) throw new AgentSDKError("Invalid native provider response", { retryable: false });
              if (property === "doGenerate") { await observe(result.response); return result; }
              const stream = result.stream as ReadableStream<unknown>;
              return { ...result, stream: stream.pipeThrough(new TransformStream({
                async transform(part: unknown, controller) {
                  if (isRecord(part) && part.type === "raw") { await observe(part.rawValue, true); return; }
                  if (isRecord(part) && part.type === "response-metadata") await observe(part);
                  controller.enqueue(part);
                },
              })) };
            })();
          };
        }
        return value;
      },
    }),
  };
}

function projectPromptError(error: unknown, sdk: SDKModule, dispatched: boolean): unknown {
  if (!dispatched && sdk.InvalidPromptError?.isInstance(error)) {
    return new AgentSDKError(error instanceof Error ? error.message : "Invalid prompt", {
      code: ErrorCode.INVALID_INPUT,
      retryable: false,
      providerRequestSent: false,
      cause: error,
    });
  }
  return error;
}

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
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          return { role: "assistant", content: [
            ...(content ? [{ type: "text", text: content }] : []),
            ...msg.toolCalls.map(tc => ({ type: "tool-call", toolCallId: tc.id, toolName: tc.name, input: tc.args })),
          ] };
        }
        return { role: "assistant", content };
      }
      case "system":
        return { role: "system", content: msg.content };
      case "tool": {
        return { role: "tool", content: msg.toolResults.map(tr => ({
          type: "tool-result",
          toolCallId: tr.toolCallId,
          toolName: tr.name,
          output: {
            type: tr.isError
              ? (typeof tr.result === "string" ? "error-text" : "error-json")
              : (typeof tr.result === "string" ? "text" : "json"),
            value: tr.result,
          },
        })) };
      }
      default:
        return { role: "user", content: "" };
    }
  });
}

// ─── Event Mapping (fullStream → AgentEvent) ────────────────────

/** Preserve native Error identity in-process; plain provider payloads expose
 * only bounded public diagnostic fields, never arbitrary response metadata. */
function streamErrorCause(error: unknown, sdk?: SDKModule): AgentSDKError {
  if (AgentSDKError.is(error)) return error;
  const source = isRecord(error) ? error : {};
  const message = (error instanceof Error ? error.message
    : typeof source.message === "string" ? source.message
    : typeof error === "string" ? error : "Unknown provider error").slice(0, 2048);
  const providerPayload = sdk?.StreamProviderError?.isInstance(error) && isRecord(source.data) ? source.data : source;
  const details: Record<string, unknown> = { message };
  if (typeof providerPayload.code === "string") details.code = providerPayload.code.slice(0, 128);
  else if (typeof providerPayload.code === "number" && Number.isFinite(providerPayload.code)) details.code = providerPayload.code;
  if (typeof providerPayload.type === "string") details.type = providerPayload.type.slice(0, 128);
  if (typeof providerPayload.param === "string") details.param = providerPayload.param.slice(0, 256);
  else if (providerPayload.param === null) details.param = null;
  const status = source.statusCode ?? source.code;
  const httpStatus = typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined;
  return new AgentSDKError(message, {
    code: classifyAgentError(message), retryable: false,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    cause: error instanceof Error && !sdk?.StreamProviderError?.isInstance(error) ? error : details,
  });
}

function measuredTokens(usage: SDKTokenUsage | undefined, metadata?: SDKProviderMetadata) {
  const metadataUsage = Object.values(metadata ?? {}).map(value => value.usage).find(isRecord);
  const raw = usage?.raw ?? (metadataUsage && ("prompt_tokens" in metadataUsage || "completion_tokens" in metadataUsage) ? metadataUsage : undefined);
  const finiteCount = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  return {
    prompt: finiteCount(raw ? raw.prompt_tokens : usage?.inputTokens),
    completion: finiteCount(raw ? raw.completion_tokens : usage?.outputTokens),
  };
}

function mapStreamPart(part: SDKStreamPart, sdk?: SDKModule): AgentEvent | null {
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
        ...(p.input !== undefined ? { args: p.input as JSONValue } : {}),
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
        cause: AgentSDKError.is(p.error) ? p.error : new ToolExecutionError(p.toolName, streamErrorCause(p.error).message, { cause: p.error }),
        toolCallId: p.toolCallId,
        toolName: p.toolName,
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

    // executeStream emits cumulative snapshots after each completed step. Mapping
    // the raw per-step usage here as well would double-report the same step.
    case "finish-step":
      return null;

    case "error": {
      const p = part as Extract<SDKStreamPart, { type: "error" }>;
      const cause = streamErrorCause(p.error, sdk);
      const errorMsg = cause.message;
      const code = classifyAgentError(errorMsg);
      return {
        type: "error",
        error: errorMsg,
        recoverable: isRecoverableErrorCode(code),
        code,
        cause,
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
  // BaseAgent creates a fresh internal signal for each public operation and keeps
  // it across explicit retries. Never bind this state to caller-owned RunOptions.
  private readonly invocationCounters = new WeakMap<AbortSignal, { next: number }>();

  constructor(
    config: FullAgentConfig,
    backendOptions: VercelAIBackendOptions,
  ) {
    super(config);
    this.backendOptions = backendOptions;
  }

  private invocationCounter(signal: AbortSignal): { next: number } {
    let counter = this.invocationCounters.get(signal);
    if (!counter) {
      counter = { next: 0 };
      this.invocationCounters.set(signal, counter);
    }
    return counter;
  }

  private async getModel(options: RunOptions, calls?: StreamedCallNames): Promise<SDKLanguageModel> {
    const requestedModel = options.model;
    const defaultModel = this.config.model;

    // If same as default/cached, reuse
    if (!calls && requestedModel === defaultModel && this.model) return this.model;

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
      metadataExtractor: createUsageMetadataExtractor(providerName, calls),
    });

    const model = provider.chatModel(requestedModel);
    // Cache only when using default model
    if (!calls && requestedModel === defaultModel) {
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
    const dispatch = observeDispatch(await this.getModel(options), this.backendOptions.provider ?? "openrouter", this.invocationCounter(signal), options.onProviderAcknowledgment);
    const tools = await this.getSDKTools(signal, options);
    const maxTurns = this.config.maxTurns ?? DEFAULT_MAX_TURNS;

    const sdkMessages = messagesToSDK(messages);
    const hasTools = Object.keys(tools).length > 0;

    const result: SDKGenerateTextResult = await sdk.generateText({
      model: dispatch.model,
      // BaseAgent owns public retry policy; native transport must not add attempts.
      maxRetries: 0,
      system: this.config.systemPrompt,
      messages: sdkMessages,
      tools: hasTools ? tools : undefined,
      stopWhen: sdk.stepCountIs(maxTurns),
      abortSignal: signal,
      ...(this.config.modelParams?.temperature !== undefined && {
        temperature: this.config.modelParams.temperature,
      }),
      ...(this.config.modelParams?.maxTokens !== undefined && {
        maxOutputTokens: this.config.modelParams.maxTokens,
      }),
      ...(this.config.modelParams?.topP !== undefined && {
        topP: this.config.modelParams.topP,
      }),
      ...(this.config.providerOptions && {
        providerOptions: this.config.providerOptions,
      }),
    }).catch(error => { throw projectPromptError(error, sdk, dispatch.entered); });

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
      ...aggregateProviderMetadata(result.steps, result.providerMetadata),
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
    const dispatch = observeDispatch(await this.getModel(options), this.backendOptions.provider ?? "openrouter", this.invocationCounter(signal), options.onProviderAcknowledgment);

    const sdkMessages = messagesToSDK(messages);
    const jsonSchema = zodToJsonSchema(schema.schema);

    const result: SDKGenerateObjectResult = await sdk.generateObject({
      model: dispatch.model,
      maxRetries: 0,
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
        maxOutputTokens: this.config.modelParams.maxTokens,
      }),
      ...(this.config.providerOptions && {
        providerOptions: this.config.providerOptions,
      }),
    }).catch(error => { throw projectPromptError(error, sdk, dispatch.entered); });

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
    const callNames = new StreamedCallNames();
    const dispatch = observeDispatch(await this.getModel(options, callNames), this.backendOptions.provider ?? "openrouter", this.invocationCounter(signal), options.onProviderAcknowledgment);
    const tools = await this.getSDKTools(signal, options);
    const maxTurns = this.config.maxTurns ?? DEFAULT_MAX_TURNS;

    const sdkMessages = messagesToSDK(messages);
    const hasTools = Object.keys(tools).length > 0;

    const result: SDKStreamTextResult = sdk.streamText({
      model: dispatch.model,
      maxRetries: 0,
      streamRetries: 0,
      system: this.config.systemPrompt,
      messages: sdkMessages,
      tools: hasTools ? tools : undefined,
      experimental_repairToolCall: async ({ toolCall, error }: { toolCall: { toolCallId: string; toolName: string; input: string; providerExecuted?: boolean }; error: unknown }) => {
        if (toolCall.providerExecuted === true || toolCall.toolName !== "" || !sdk.NoSuchToolError?.isInstance(error)) return null;
        const name = callNames.delayedName(toolCall.toolCallId);
        return name && Object.hasOwn(tools, name) ? { ...toolCall, toolName: name } : null;
      },
      stopWhen: sdk.stepCountIs(maxTurns),
      abortSignal: signal,
      ...(this.config.modelParams?.temperature !== undefined && {
        temperature: this.config.modelParams.temperature,
      }),
      ...(this.config.modelParams?.maxTokens !== undefined && {
        maxOutputTokens: this.config.modelParams.maxTokens,
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
    const usageSteps: Array<{ providerMetadata?: SDKProviderMetadata }> = [];
    let cumulativePromptTokens = 0;
    let cumulativeCompletionTokens = 0;
    let nativePromptError: unknown;
    let primaryStreamError: AgentSDKError | undefined;
    let promptKnown = true;
    let completionKnown = true;
    let hasUsageSnapshot = false;
    const localRefusals = new Map<string, { proof: LocalToolRefusal; input: unknown }>();
    const observedCallIds = new Set<string>();

    try {
      for await (const part of result.fullStream) {
        if (signal.aborted) throw new AbortError();

        if (part.type === "error" && sdk.InvalidPromptError?.isInstance((part as Extract<SDKStreamPart, { type: "error" }>).error)) {
          nativePromptError = (part as Extract<SDKStreamPart, { type: "error" }>).error;
          continue;
        }

        if (part.type === "tool-call") {
          const call = part as Extract<SDKStreamPart, { type: "tool-call" }>;
          const duplicate = observedCallIds.has(call.toolCallId);
          observedCallIds.add(call.toolCallId);
          localRefusals.delete(call.toolCallId);
          const reason = sdk.NoSuchToolError?.isInstance(call.error) ? "no_such_tool"
            : sdk.InvalidToolInputError?.isInstance(call.error) ? "invalid_tool_input" : undefined;
          // Native parseToolCall emits these invalid parts before its executor;
          // its following non-provider tool-error establishes the local branch.
          if (!duplicate && call.invalid === true && call.providerExecuted !== true && reason && call.toolCallId && typeof call.toolName === "string") {
            localRefusals.set(call.toolCallId, {
              input: call.input,
              proof: { reason, toolCallId: call.toolCallId, toolName: call.toolName,
                ...(call.input !== undefined ? { args: call.input as JSONValue } : {}),
                toolExecutionStarted: false, providerExecuted: false },
            });
          }
        }
        const event = mapStreamPart(part as SDKStreamPart, sdk);
        if (part.type === "tool-error" && event?.type === "error") {
          const failure = part as Extract<SDKStreamPart, { type: "tool-error" }>;
          const observed = localRefusals.get(failure.toolCallId);
          localRefusals.delete(failure.toolCallId);
          if (observed && failure.providerExecuted !== true && failure.toolName === observed.proof.toolName
            && Object.hasOwn(failure, "input") && JSON.stringify(failure.input) === JSON.stringify(observed.input)) {
            event.localToolRefusal = observed.proof;
          }
        }
        if (part.type === "error" && event?.type === "error") {
          primaryStreamError ??= event.cause;
        }
        if (event) yield event;

        if ((part as SDKStreamPart).type === "text-delta") {
          finalText += (part as Extract<SDKStreamPart, { type: "text-delta" }>).text ?? "";
        }

        // When a step finishes with tool calls, the text accumulated so far is
        // intermediate reasoning (e.g. "Let me search..."). Reset so that only
        // the final step's text becomes the output.
        if ((part as SDKStreamPart).type === "finish-step") {
          localRefusals.clear();
          observedCallIds.clear();
          const p = part as Extract<SDKStreamPart, { type: "finish-step" }>;
          usageSteps.push({ providerMetadata: p.providerMetadata });
          const measured = measuredTokens(p.usage, p.providerMetadata);
          promptKnown &&= measured.prompt !== undefined;
          completionKnown &&= measured.completion !== undefined;
          cumulativePromptTokens += measured.prompt ?? 0;
          cumulativeCompletionTokens += measured.completion ?? 0;
          const metadata = aggregateProviderMetadata(usageSteps);
          if (measured.prompt !== undefined || measured.completion !== undefined || metadata.cost !== undefined || hasUsageSnapshot) {
            hasUsageSnapshot = true;
            yield {
              type: "usage_update",
              promptTokens: cumulativePromptTokens,
              completionTokens: cumulativeCompletionTokens,
              tokenUsageKnown: { promptTokens: promptKnown, completionTokens: completionKnown },
              ...metadata,
            };
          }
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

      if (nativePromptError !== undefined) {
        // Drain terminal promises so their no-output rejection cannot obscure
        // the original refusal or escape as an unhandled rejection.
        await Promise.allSettled([result.totalUsage, result.text, result.providerMetadata]);
        throw projectPromptError(nativePromptError, sdk, dispatch.entered);
      }

      if (primaryStreamError) {
        await Promise.allSettled([result.totalUsage, result.text, result.providerMetadata]);
        throw primaryStreamError;
      }

      // AI SDK v7 exposes usage and provider metadata on every finish-step, so
      // the last cumulative snapshot above is already the run total. Older
      // compatible SDKs/mocks may expose only terminal totals; emit one fallback
      // snapshot in that case, or when their terminal total differs.
      const totalUsage = await result.totalUsage;
      const totalPromptTokens = Number(totalUsage?.inputTokens ?? 0);
      const totalCompletionTokens = Number(totalUsage?.outputTokens ?? 0);
      const terminalProviderMetadata = await result.providerMetadata;
      const hasStepProviderMetadata = usageSteps.some(
        (step) => step.providerMetadata !== undefined,
      );
      if (
        (usageSteps.length === 0
        || totalPromptTokens !== cumulativePromptTokens
        || totalCompletionTokens !== cumulativeCompletionTokens
        || (!hasStepProviderMetadata && terminalProviderMetadata !== undefined))
        && promptKnown && completionKnown
      ) {
        const measured = measuredTokens(totalUsage, terminalProviderMetadata);
        if (measured.prompt !== undefined || measured.completion !== undefined) yield {
          type: "usage_update",
          promptTokens: measured.prompt ?? 0,
          completionTokens: measured.completion ?? 0,
          tokenUsageKnown: { promptTokens: measured.prompt !== undefined, completionTokens: measured.completion !== undefined },
          ...aggregateProviderMetadata(usageSteps, terminalProviderMetadata),
        };
      }

      const hasStreamed = finalText.length > 0;
      yield {
        type: "done",
        finalOutput: hasStreamed ? null : (finalText || null),
        ...(hasStreamed ? { streamed: true } : {}),
        ...(lastFinishReason ? { finishReason: lastFinishReason } : {}),
      };
    } catch (e) {
      if (signal.aborted) throw new AbortError();
      if (primaryStreamError) throw primaryStreamError;
      throw projectPromptError(e, sdk, dispatch.entered);
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
