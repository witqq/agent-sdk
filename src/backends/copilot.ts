import type { z } from "zod";
import type {
  IAgent,
  IAgentService,
  FullAgentConfig,
  AgentResult,
  AgentEvent,
  Message,
  MessageContent,
  RunOptions,
  StructuredOutputConfig,
  ToolDefinition,
  CopilotBackendOptions,
  ModelInfo,
  ValidationResult,
  JSONValue,
  PermissionRequest as UnifiedPermissionRequest,
} from "../types.js";
import { getTextContent, classifyAgentError, isRecoverableErrorCode } from "../types.js";
import { BaseAgent } from "../base-agent.js";
import { DisposedError, SubprocessError, AbortError } from "../errors.js";
import { zodToJsonSchema } from "../utils/schema.js";
import { extractLastUserPrompt, buildContextualPrompt } from "./shared.js";

export type { CopilotBackendOptions } from "../types.js";

// ─── Local Type Definitions (matching @github/copilot-sdk shapes) ───
// Avoids requiring the SDK to be installed at compile time.

/** @internal */
interface SDKClientOptions {
  cliPath?: string;
  cwd?: string;
  useStdio?: boolean;
  autoStart?: boolean;
  autoRestart?: boolean;
  logLevel?: string;
  githubToken?: string;
  useLoggedInUser?: boolean;
  cliArgs?: string[];
  env?: Record<string, string | undefined>;
}

/** @internal */
interface SDKTool {
  name: string;
  description?: string;
  parameters?: z.ZodType | Record<string, unknown>;
  handler: (
    args: unknown,
    invocation: {
      sessionId: string;
      toolCallId: string;
      toolName: string;
      arguments: unknown;
    },
  ) => Promise<unknown> | unknown;
}

/** @internal */
interface SDKPermissionRequest {
  kind: string;
  toolCallId?: string;
  [key: string]: unknown;
}

/** @internal */
interface SDKPermissionResult {
  kind:
    | "approved"
    | "denied-by-rules"
    | "denied-no-approval-rule-and-could-not-request-from-user"
    | "denied-interactively-by-user";
}

/** @internal */
interface SDKUserInputRequest {
  question: string;
  choices?: string[];
  allowFreeform?: boolean;
}

/** @internal */
interface SDKUserInputResponse {
  answer: string;
  wasFreeform: boolean;
}

/** @internal */
interface SDKSessionConfig {
  model?: string;
  tools?: SDKTool[];
  systemMessage?: { mode: "append" | "replace"; content: string };
  onPermissionRequest?: (
    request: SDKPermissionRequest,
    ctx: { sessionId: string },
  ) => Promise<SDKPermissionResult> | SDKPermissionResult;
  onUserInputRequest?: (
    request: SDKUserInputRequest,
    ctx: { sessionId: string },
  ) => Promise<SDKUserInputResponse> | SDKUserInputResponse;
  streaming?: boolean;
  workingDirectory?: string;
  availableTools?: string[];
}

/** @internal */
interface SDKSessionEvent {
  id: string;
  timestamp: string;
  parentId: string | null;
  ephemeral?: boolean;
  type: string;
  data: Record<string, unknown>;
}

/** @internal */
interface SDKAssistantMessageData {
  messageId: string;
  content: string;
}

/** @internal */
interface SDKSession {
  readonly sessionId: string;
  on(handler: (event: SDKSessionEvent) => void): () => void;
  send(options: { prompt: string }): Promise<string>;
  sendAndWait(
    options: { prompt: string },
    timeout?: number,
  ): Promise<
    | { type: "assistant.message"; data: SDKAssistantMessageData }
    | undefined
  >;
  destroy(): Promise<void>;
  abort(): Promise<void>;
}

/** @internal */
interface SDKModelInfo {
  id: string;
  name: string;
  capabilities?: {
    limits?: {
      max_context_window_tokens?: number;
      max_prompt_tokens?: number;
    };
  };
}

/** @internal */
interface SDKClient {
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  getState(): string;
  createSession(config?: SDKSessionConfig): Promise<SDKSession>;
  resumeSession(sessionId: string, config?: SDKSessionConfig): Promise<SDKSession>;
  listModels(): Promise<SDKModelInfo[]>;
  getAuthStatus(): Promise<{ isAuthenticated: boolean }>;
}

// ─── Dynamic SDK Loader ─────────────────────────────────────────

type CopilotSDKModule = {
  CopilotClient: new (options?: SDKClientOptions) => SDKClient;
};

/** Module-level mock set by _injectSDK() for testing */
let _sdkMock: CopilotSDKModule | null = null;

/** Load the Copilot SDK. Checks module-level mock first, then dynamic import. */
async function loadSDK(): Promise<CopilotSDKModule> {
  if (_sdkMock) return _sdkMock;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment
    // @ts-ignore — peer dependency, not present at compile time
    return (await import("@github/copilot-sdk")) as any;
  } catch {
    throw new SubprocessError(
      "@github/copilot-sdk is not installed. Install it: npm install @github/copilot-sdk",
    );
  }
}

/** @internal For testing: inject mock SDK module */
export function _injectSDK(
  mock: CopilotSDKModule | null,
): void {
  _sdkMock = mock;
}

/** @internal For testing: reset injected SDK */
export function _resetSDK(): void {
  _sdkMock = null;
}

// ─── Tool Mapping ───────────────────────────────────────────────

function mapToolsToSDK(tools: ToolDefinition[]): SDKTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: convertParameters(tool.parameters),
    handler: async (args: unknown): Promise<unknown> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await tool.execute(args as any);
      return typeof result === "string" ? result : JSON.stringify(result);
    },
  }));
}

/** Convert Zod schema or JSON Schema to JSON Schema object.
 *  Zod schemas are converted via zodToJsonSchema; plain objects pass through. */
function convertParameters(params: unknown): z.ZodType | Record<string, unknown> | undefined {
  if (!params) return undefined;
  if (params && typeof params === "object" && "_def" in (params as Record<string, unknown>)) {
    return zodToJsonSchema(params as Parameters<typeof zodToJsonSchema>[0]);
  }
  return params as Record<string, unknown>;
}

// ─── Permission Mapping ─────────────────────────────────────────

function buildPermissionHandler(
  config: FullAgentConfig,
): SDKSessionConfig["onPermissionRequest"] {
  const onPermission = config.supervisor?.onPermission;

  // Headless safety: always provide a handler to prevent SDK from hanging.
  // Without a handler the SDK waits for interactive input indefinitely.
  if (!onPermission) {
    return async (): Promise<SDKPermissionResult> => ({ kind: "approved" });
  }

  const permissionStore = config.permissionStore;

  return async (
    request: SDKPermissionRequest,
  ): Promise<SDKPermissionResult> => {
    const toolName = String(request.kind);

    // Check store first — if already approved, skip callback
    if (permissionStore && await permissionStore.isApproved(toolName)) {
      return { kind: "approved" };
    }

    const unifiedRequest: UnifiedPermissionRequest = {
      toolName,
      toolArgs: { ...request } as Record<string, unknown>,
      toolCallId: request.toolCallId,
      rawSDKRequest: request,
    };

    const ac = new AbortController();
    const decision = await onPermission(unifiedRequest, ac.signal);

    if (decision.allowed) {
      // Persist approval to store
      if (permissionStore && decision.scope) {
        await permissionStore.approve(toolName, decision.scope);
      }
      return { kind: "approved" };
    }

    return { kind: "denied-interactively-by-user" };
  };
}

// ─── User Input Mapping ─────────────────────────────────────────

function buildUserInputHandler(
  config: FullAgentConfig,
): SDKSessionConfig["onUserInputRequest"] {
  const onAskUser = config.supervisor?.onAskUser;

  // Headless safety: always provide a handler to prevent SDK from hanging
  // or returning a question as the final output instead of completing the task.
  if (!onAskUser) {
    return async (): Promise<SDKUserInputResponse> => ({
      answer: "Complete the task autonomously without asking questions.",
      wasFreeform: true,
    });
  }

  return async (
    request: SDKUserInputRequest,
  ): Promise<SDKUserInputResponse> => {
    const ac = new AbortController();
    const response = await onAskUser(
      {
        question: request.question,
        choices: request.choices,
        allowFreeform: request.allowFreeform,
      },
      ac.signal,
    );
    return { answer: response.answer, wasFreeform: response.wasFreeform };
  };
}

// ─── Event Mapping ──────────────────────────────────────────────

/**
 * Tracks tool call IDs to tool names.
 *
 * The Copilot SDK's `tool.execution_complete` event only includes `toolCallId`
 * but not `toolName`. We capture the name from `tool.execution_start` events
 * (which include both) and look it up when mapping completion events to unified
 * `AgentEvent` objects and collecting `AgentResult.toolCalls`.
 */
class ToolCallTracker {
  private map = new Map<string, { toolName: string; args: JSONValue }>();

  trackStart(toolCallId: string, toolName: string, args: JSONValue): void {
    this.map.set(toolCallId, { toolName, args });
  }

  getInfo(
    toolCallId: string,
  ): { toolName: string; args: JSONValue } | undefined {
    return this.map.get(toolCallId);
  }

  clear(): void {
    this.map.clear();
  }
}

/**
 * Tracks whether we are inside a thinking (reasoning) block so we can emit
 * `thinking_end` when the block finishes.  The Copilot SDK has no explicit
 * "reasoning end" event, so we detect the transition by observing the first
 * non-reasoning event after a reasoning event.
 */
class ThinkingTracker {
  private active = false;
  private completed = false;

  isActive(): boolean {
    return this.active;
  }

  /** Returns true if thinking already completed (should ignore further reasoning events). */
  isCompleted(): boolean {
    return this.completed;
  }

  startThinking(): void {
    this.active = true;
  }

  /** Returns true if thinking was active and is now ended. */
  endThinking(): boolean {
    if (!this.active) return false;
    this.active = false;
    this.completed = true;
    return true;
  }

  /** Reset for next turn (e.g. after done event). */
  reset(): void {
    this.active = false;
    this.completed = false;
  }
}

function mapSessionEvent(
  event: SDKSessionEvent,
  tracker: ToolCallTracker,
  thinkingTracker: ThinkingTracker,
): AgentEvent | AgentEvent[] | null {
  const data = event.data;

  switch (event.type) {
    case "assistant.message_delta": {
      const textEvent: AgentEvent = {
        type: "text_delta",
        text: String(data.deltaContent ?? ""),
      };
      // Emit thinking_end before the first text_delta after reasoning
      if (thinkingTracker.endThinking()) {
        return [{ type: "thinking_end" }, textEvent];
      }
      return textEvent;
    }

    case "assistant.reasoning":
    case "assistant.reasoning_delta": {
      // Skip duplicate reasoning events — SDK replays full reasoning after response
      if (thinkingTracker.isCompleted()) return null;

      const events: AgentEvent[] = [];
      if (!thinkingTracker.isActive()) {
        thinkingTracker.startThinking();
        events.push({ type: "thinking_start" });
      }
      const reasoningText = String(data.deltaContent ?? data.content ?? "");
      if (reasoningText) {
        events.push({ type: "thinking_delta", text: reasoningText });
      }
      return events.length === 1 ? events[0] : events.length > 1 ? events : null;
    }

    case "tool.execution_start": {
      const toolCallId = String(data.toolCallId ?? "");
      const toolName = String(data.toolName ?? "unknown");
      let args: JSONValue = {};
      if (typeof data.arguments === "string") {
        try { args = JSON.parse(data.arguments); } catch { args = data.arguments as JSONValue; }
      } else if (data.arguments != null) {
        args = data.arguments as JSONValue;
      }
      tracker.trackStart(toolCallId, toolName, args);
      const toolStartEvent: AgentEvent = { type: "tool_call_start", toolCallId, toolName, args };
      const events: AgentEvent[] = [];
      if (thinkingTracker.endThinking()) {
        events.push({ type: "thinking_end" });
      }
      // Reset completed flag so next turn's thinking is captured
      thinkingTracker.reset();
      events.push(toolStartEvent);
      return events.length === 1 ? events[0] : events;
    }

    case "tool.execution_complete": {
      const toolCallId = String(data.toolCallId ?? "");
      const info = tracker.getInfo(toolCallId);
      const rawResult = data.result as Record<string, unknown> | JSONValue | undefined;
      // Copilot SDK wraps result in { content: ... } — unwrap if present
      const result = (rawResult && typeof rawResult === "object" && "content" in rawResult
        ? rawResult.content
        : rawResult) as JSONValue ?? null;
      return {
        type: "tool_call_end",
        toolCallId,
        toolName: info?.toolName ?? "unknown",
        result,
      };
    }

    case "assistant.usage":
      return {
        type: "usage_update",
        promptTokens: Number(data.inputTokens ?? 0),
        completionTokens: Number(data.outputTokens ?? 0),
      };

    case "session.error":
      console.error("[copilot] mapSessionEvent error:", JSON.stringify(data));
      {
        const errorMsg = String(data.message ?? "Unknown error");
        const code = classifyAgentError(errorMsg);
        return {
          type: "error",
          error: errorMsg,
          recoverable: isRecoverableErrorCode(code),
          code,
        };
      }

    case "assistant.message": {
      // Text was already streamed via text_delta events — suppress finalOutput to avoid duplication
      const doneEvent: AgentEvent = {
        type: "done",
        finalOutput: null,
        streamed: true,
      };
      if (thinkingTracker.endThinking()) {
        return [{ type: "thinking_end" }, doneEvent];
      }
      return doneEvent;
    }

    default:
      return null;
  }
}

// ─── CopilotAgent ───────────────────────────────────────────────

class CopilotAgent extends BaseAgent {
  protected readonly backendName = "copilot";
  private readonly getClient: () => Promise<SDKClient>;
  private sdkTools: SDKTool[];
  private readonly sessionConfig: Omit<SDKSessionConfig, "streaming"> & { tools?: SDKTool[] };
  private readonly sendAndWaitTimeout: number | undefined;
  private readonly isPersistent: boolean;
  private persistentSession: SDKSession | null = null;
  private _sessionId: string | undefined;
  private _persistentModel: string | undefined;
  private activeSession: SDKSession | null = null;
  private _resumeSessionId: string | undefined;
  private _toolsReady: Promise<void> | null = null;

  constructor(
    config: FullAgentConfig,
    getClient: () => Promise<SDKClient>,
    sendAndWaitTimeout?: number,
    resumeSessionId?: string,
  ) {
    super(config);
    this.getClient = getClient;
    this.sendAndWaitTimeout = sendAndWaitTimeout;
    this.isPersistent = config.sessionMode === "persistent";
    this.sdkTools = mapToolsToSDK(config.tools ?? []);
    this.sessionConfig = {
      model: config.model,
      tools: this.sdkTools,
      systemMessage: {
        mode: config.systemMessageMode ?? "append",
        content: config.systemPrompt,
      },
      onPermissionRequest: buildPermissionHandler(config),
      onUserInputRequest: buildUserInputHandler(config),
      ...(config.availableTools?.length ? { availableTools: config.availableTools } : {}),
    };
    // Start async Zod converter loading — remaps tools with proper JSON Schema before first session
    this._toolsReady = this._initToolsAsync(config);
    // Store resume session ID from stored identifier for session recovery after server restart
    this._resumeSessionId = resumeSessionId;
  }

  /** Pre-convert Zod schemas to JSON Schema.
   *  Updates sdkTools and sessionConfig.tools before first session creation. */
  private async _initToolsAsync(config: FullAgentConfig): Promise<void> {
    this.sdkTools = mapToolsToSDK(config.tools ?? []);
    this.sessionConfig.tools = this.sdkTools;
  }

  override get sessionId(): string | undefined {
    return this._sessionId;
  }

  override async interrupt(): Promise<void> {
    if (this.activeSession) {
      this.activeSession.abort().catch(() => {});
    }
    this.abort();
  }

  private emitSessionInfo(sessionId: string): AgentEvent {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    const transcriptPath = home
      ? `${home}/.copilot/session-state/${sessionId}/events.jsonl`
      : undefined;
    return { type: "session_info", sessionId, transcriptPath, backend: "copilot" };
  }

  private clearPersistentSession(): void {
    if (this.isPersistent) {
      this.persistentSession?.destroy().catch(() => {});
      this.persistentSession = null;
      this._sessionId = undefined;
      this._persistentModel = undefined;
    }
  }

  private async getOrCreateSession(streaming: boolean, options: RunOptions): Promise<{ session: SDKSession; isNew: boolean }> {
    if (this.isPersistent && this.persistentSession) {
      // Check if model has changed — if so, recreate the session
      if (options.model !== this._persistentModel) {
        this.persistentSession.destroy().catch(() => {});
        this.persistentSession = null;
        this._sessionId = undefined;
        // Fall through to create new session with new model
      } else {
        return { session: this.persistentSession, isNew: false };
      }
    }
    // Wait for async Zod converter initialization before first session creation
    if (this._toolsReady) {
      await this._toolsReady;
      this._toolsReady = null;
    }

    // Apply per-call overrides to session config
    const sessionConfig = { ...this.sessionConfig };
    sessionConfig.model = options.model;
    const resolvedTools = this.resolveTools(options);
    if (options?.tools) {
      sessionConfig.tools = mapToolsToSDK(resolvedTools);
    }

    const client = await this.getClient();
    // Try to resume a stored session (from DB) before creating a new one.
    // This enables session recovery after server restart for persistent sessions.
    if (this._resumeSessionId) {
      const storedId = this._resumeSessionId;
      this._resumeSessionId = undefined; // Only attempt once
      try {
        const session = await client.resumeSession(storedId, {
          ...sessionConfig,
          streaming: this.isPersistent ? true : streaming,
        });
        if (this.isPersistent) {
          this.persistentSession = session;
          this._sessionId = session.sessionId;
          this._persistentModel = options.model;
        }
        return { session, isNew: false };
      } catch {
        // Resume failed (session expired, deleted, etc.) — fall through to createSession
      }
    }
    const session = await client.createSession({
      ...sessionConfig,
      streaming: this.isPersistent ? true : streaming,
    });
    if (this.isPersistent) {
      this.persistentSession = session;
      this._sessionId = session.sessionId;
      this._persistentModel = options.model;
    }
    return { session, isNew: true };
  }

  // ─── executeRun ─────────────────────────────────────────────────

  protected async executeRun(
    messages: Message[],
    options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult> {
    this.checkAbort(signal);

    const { session, isNew: isNewSession } = await this.getOrCreateSession(false, options);
    this.activeSession = session;
    // In per-call mode, include conversation context in prompt.
    const prompt = this.isPersistent && !isNewSession
      ? extractLastUserPrompt(messages)
      : buildContextualPrompt(messages);
    const tracker = new ToolCallTracker();
    const toolCalls: AgentResult["toolCalls"] = [];
    let usage: AgentResult["usage"];

    const unsubscribe = session.on((event: SDKSessionEvent) => {
      if (event.type === "tool.execution_start") {
        tracker.trackStart(
          String(event.data.toolCallId ?? ""),
          String(event.data.toolName ?? "unknown"),
          (event.data.arguments as JSONValue) ?? {},
        );
      }
      if (event.type === "tool.execution_complete") {
        const info = tracker.getInfo(String(event.data.toolCallId ?? ""));
        const resultContent = (
          event.data.result as Record<string, unknown> | undefined
        )?.content;
        toolCalls.push({
          toolName: info?.toolName ?? "unknown",
          args: info?.args ?? {},
          result: (resultContent as JSONValue) ?? null,
          approved: Boolean(event.data.success ?? true),
        });
      }
      if (event.type === "assistant.usage") {
        usage = {
          promptTokens: Number(event.data.inputTokens ?? 0),
          completionTokens: Number(event.data.outputTokens ?? 0),
        };
      }
    });

    const onAbort = () => {
      // Intentionally swallow abort errors: session may already be destroyed
      // or disconnected, and we must not mask the real error/abort reason.
      session.abort().catch(() => {});
    };
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      const response = this.sendAndWaitTimeout !== undefined
        ? await session.sendAndWait({ prompt }, this.sendAndWaitTimeout)
        : await session.sendAndWait({ prompt });
      const output = response?.data?.content ?? null;

      return {
        output,
        structuredOutput: undefined as AgentResult["structuredOutput"],
        toolCalls,
        messages: [
          ...messages,
          ...(output !== null
            ? [{ role: "assistant" as const, content: output }]
            : []),
        ],
        usage,
      };
    } catch (error) {
      // Clear broken persistent session so next call creates a fresh one
      this.clearPersistentSession();
      throw error;
    } finally {
      this.activeSession = null;
      signal.removeEventListener("abort", onAbort);
      unsubscribe();
      tracker.clear();
      if (!this.isPersistent) {
        // Best-effort cleanup: don't mask the original error from sendAndWait
        session.destroy().catch(() => {});
      }
    }
  }

  // ─── executeRunStructured ───────────────────────────────────────

  protected async executeRunStructured<T>(
    messages: Message[],
    schema: StructuredOutputConfig<T>,
    options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult<T>> {
    const jsonSchema = zodToJsonSchema(schema.schema);
    const instruction =
      `\n\nYou MUST respond with ONLY valid JSON matching this schema:\n` +
      JSON.stringify(jsonSchema, null, 2);

    const augmented = [...messages];
    const lastIdx = augmented.length - 1;
    if (lastIdx >= 0 && augmented[lastIdx].role === "user") {
      const orig = augmented[lastIdx] as {
        role: "user";
        content: MessageContent;
      };
      augmented[lastIdx] = {
        role: "user",
        content: getTextContent(orig.content) + instruction,
      };
    }

    const result = await this.executeRun(augmented, options, signal);

    let structuredOutput: T | undefined;
    if (result.output) {
      try {
        const jsonMatch = result.output.match(
          /```(?:json)?\s*([\s\S]*?)```/,
        );
        const raw = jsonMatch ? jsonMatch[1]!.trim() : result.output.trim();
        structuredOutput = schema.schema.parse(JSON.parse(raw));
      } catch {
        // Parse failed — leave undefined
      }
    }

    return {
      ...result,
      structuredOutput: structuredOutput as AgentResult<T>["structuredOutput"],
    };
  }

  // ─── executeStream ──────────────────────────────────────────────

  protected async *executeStream(
    messages: Message[],
    options: RunOptions,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    this.checkAbort(signal);

    const { session, isNew: isNewSession } = await this.getOrCreateSession(true, options);
    this.activeSession = session;
    if (isNewSession) {
      yield this.emitSessionInfo(session.sessionId);
    }
    const prompt = this.isPersistent && !isNewSession
      ? extractLastUserPrompt(messages)
      : buildContextualPrompt(messages);
    const tracker = new ToolCallTracker();
    const thinkingTracker = new ThinkingTracker();

    type QueueItem =
      | { event: AgentEvent }
      | { done: true }
      | { error: Error };
    const queue: QueueItem[] = [];
    let notify: (() => void) | null = null;

    const push = (item: QueueItem) => {
      queue.push(item);
      if (notify) {
        notify();
        notify = null;
      }
    };
    const waitForItem = (): Promise<void> =>
      new Promise<void>((resolve) => {
        notify = resolve;
      });

    const unsubscribe = session.on((event: SDKSessionEvent) => {
      const mapped = mapSessionEvent(event, tracker, thinkingTracker);
      if (mapped) {
        if (Array.isArray(mapped)) {
          for (const e of mapped) push({ event: e });
        } else {
          push({ event: mapped });
        }
      }

      if (event.type === "session.idle") {
        // Close any open thinking block before completing the stream
        if (thinkingTracker.endThinking()) {
          push({ event: { type: "thinking_end" } });
        }
        push({ done: true });
      } else if (event.type === "session.error") {
        console.error("[copilot] session.error:", JSON.stringify(event.data));
        push({
          error: new Error(
            String(event.data.message ?? "Session error"),
          ),
        });
      }
    });

    const onAbort = () => {
      session.abort().catch(() => {});
      push({ error: new AbortError() });
    };
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      await session.send({ prompt });

      while (true) {
        while (queue.length === 0) await waitForItem();
        const item = queue.shift()!;
        if ("done" in item) break;
        if ("error" in item) {
          // Clear broken persistent session so next call creates a fresh one
          this.clearPersistentSession();
          throw item.error;
        }
        yield item.event;
      }
    } catch (error) {
      this.clearPersistentSession();
      throw error;
    } finally {
      this.activeSession = null;
      signal.removeEventListener("abort", onAbort);
      unsubscribe();
      tracker.clear();
      if (!this.isPersistent) {
        // Best-effort cleanup: don't mask errors from the event stream
        session.destroy().catch(() => {});
      }
    }
  }

  // ─── dispose ────────────────────────────────────────────────────

  override dispose(): void {
    if (this.persistentSession) {
      this.persistentSession.destroy().catch(() => {});
      this.persistentSession = null;
      this._sessionId = undefined;
    }
    super.dispose();
  }
}

// ─── Helpers ────────────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────

/** Race a promise against a timeout. Rejects with SubprocessError on timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SubprocessError(message)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ─── CopilotAgentService ────────────────────────────────────────

class CopilotAgentService implements IAgentService {
  readonly name = "copilot";
  private client: SDKClient | null = null;
  private clientPromise: Promise<SDKClient> | null = null;
  private disposed = false;
  private readonly options: CopilotBackendOptions;

  constructor(options: CopilotBackendOptions) {
    this.options = options;
  }

  private async ensureClient(): Promise<SDKClient> {
    if (this.disposed) throw new DisposedError("CopilotAgentService");
    if (this.client) return this.client;
    if (this.clientPromise) return this.clientPromise;

    this.clientPromise = (async () => {
      try {
        const sdk = await loadSDK();
        const client = new sdk.CopilotClient({
          cliPath: this.options.cliPath,
          cwd: this.options.workingDirectory,
          useStdio: true,
          autoStart: false,
          autoRestart: true,
          logLevel: "error",
          githubToken: this.options.githubToken,
          useLoggedInUser: this.options.useLoggedInUser ?? !this.options.githubToken,
          ...(this.options.cliArgs ? { cliArgs: this.options.cliArgs } : {}),
          ...(this.options.env ? { env: { ...process.env, ...this.options.env } } : {}),
        });

        const startupTimeout = this.options.startupTimeoutMs ?? 30_000;
        await withTimeout(client.start(), startupTimeout, "CLI startup timed out");

        // Verify authentication early to fail fast instead of hanging
        const auth = await withTimeout(
          client.getAuthStatus(),
          startupTimeout,
          "Auth status check timed out — token may be expired",
        );
        if (!auth.isAuthenticated) {
          await client.stop();
          throw new SubprocessError(
            "Not authenticated with GitHub Copilot. Run 'copilot auth login' or set GITHUB_TOKEN.",
          );
        }

        this.client = client;
        return client;
      } catch (e) {
        // M1 fix: clear cached promise so next call retries
        this.clientPromise = null;
        throw e;
      }
    })();

    return this.clientPromise;
  }

  createAgent(config: FullAgentConfig): IAgent {
    if (this.disposed) throw new DisposedError("CopilotAgentService");
    return new CopilotAgent(config, () => this.ensureClient(), this.options.timeout, this.options.resumeSessionId);
  }

  async listModels(): Promise<ModelInfo[]> {
    const client = await this.ensureClient();
    const models = await client.listModels();
    return models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: "copilot",
      ...(m.capabilities?.limits?.max_context_window_tokens != null && {
        contextWindow: m.capabilities.limits.max_context_window_tokens,
      }),
    }));
  }

  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    try {
      const client = await this.ensureClient();
      const auth = await client.getAuthStatus();
      if (!auth.isAuthenticated) {
        errors.push(
          "Not authenticated with GitHub Copilot. Run 'copilot auth login'.",
        );
      }
    } catch (e) {
      errors.push(
        `Failed to connect to Copilot CLI: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return { valid: errors.length === 0, errors };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    // M2 fix: await pending clientPromise before stopping
    if (this.clientPromise) {
      try {
        await this.clientPromise;
      } catch {
        // Client start may have failed — ignore
      }
    }
    if (this.client) {
      await this.client.stop();
      this.client = null;
    }
    this.clientPromise = null;
  }
}

// ─── Factory ────────────────────────────────────────────────────

/** Create Copilot CLI backend service. */
export function createCopilotService(
  options: CopilotBackendOptions,
): IAgentService {
  return new CopilotAgentService(options);
}
