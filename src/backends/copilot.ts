import type {
  IAgent,
  IAgentService,
  AgentConfig,
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
import { getTextContent } from "../types.js";
import { BaseAgent } from "../base-agent.js";
import { DisposedError, SubprocessError, AbortError } from "../errors.js";
import { zodToJsonSchema } from "../utils/schema.js";

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
  parameters?: Record<string, unknown>;
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
}

/** @internal */
interface SDKClient {
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  getState(): string;
  createSession(config?: SDKSessionConfig): Promise<SDKSession>;
  listModels(): Promise<SDKModelInfo[]>;
  getAuthStatus(): Promise<{ isAuthenticated: boolean }>;
}

// ─── Dynamic SDK Loader ─────────────────────────────────────────

let sdkModule: {
  CopilotClient: new (options?: SDKClientOptions) => SDKClient;
} | null = null;

async function loadSDK(): Promise<
  NonNullable<typeof sdkModule>
> {
  if (sdkModule) return sdkModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment
    // @ts-ignore — peer dependency, not present at compile time
    sdkModule = (await import("@github/copilot-sdk")) as any;
    return sdkModule!;
  } catch {
    throw new SubprocessError(
      "@github/copilot-sdk is not installed. Install it: npm install @github/copilot-sdk",
    );
  }
}

/** @internal For testing: inject mock SDK module */
export function _injectSDK(
  mock: typeof sdkModule,
): void {
  sdkModule = mock;
}

/** @internal For testing: reset injected SDK */
export function _resetSDK(): void {
  sdkModule = null;
}

// ─── Tool Mapping ───────────────────────────────────────────────

function mapToolsToSDK(tools: ToolDefinition[]): SDKTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.parameters),
    handler: async (args: unknown): Promise<unknown> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await tool.execute(args as any);
      return typeof result === "string" ? result : JSON.stringify(result);
    },
  }));
}

// ─── Permission Mapping ─────────────────────────────────────────

function buildPermissionHandler(
  config: AgentConfig,
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
  config: AgentConfig,
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

  isActive(): boolean {
    return this.active;
  }

  startThinking(): void {
    this.active = true;
  }

  /** Returns true if thinking was active and is now ended. */
  endThinking(): boolean {
    if (!this.active) return false;
    this.active = false;
    return true;
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
      const args = (data.arguments as JSONValue) ?? {};
      tracker.trackStart(toolCallId, toolName, args);
      const toolStartEvent: AgentEvent = { type: "tool_call_start", toolCallId, toolName, args };
      if (thinkingTracker.endThinking()) {
        return [{ type: "thinking_end" }, toolStartEvent];
      }
      return toolStartEvent;
    }

    case "tool.execution_complete": {
      const toolCallId = String(data.toolCallId ?? "");
      const info = tracker.getInfo(toolCallId);
      const resultContent = (
        data.result as Record<string, unknown> | undefined
      )?.content;
      return {
        type: "tool_call_end",
        toolCallId,
        toolName: info?.toolName ?? "unknown",
        result: (resultContent as JSONValue) ?? null,
      };
    }

    case "assistant.usage":
      return {
        type: "usage_update",
        promptTokens: Number(data.inputTokens ?? 0),
        completionTokens: Number(data.outputTokens ?? 0),
      };

    case "session.error":
      return {
        type: "error",
        error: String(data.message ?? "Unknown error"),
        recoverable: false,
      };

    case "assistant.message": {
      const doneEvent: AgentEvent = {
        type: "done",
        finalOutput: String(data.content ?? ""),
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
  private readonly sdkTools: SDKTool[];
  private readonly sessionConfig: Omit<SDKSessionConfig, "streaming">;
  private readonly sendAndWaitTimeout: number | undefined;
  private readonly isPersistent: boolean;
  private persistentSession: SDKSession | null = null;
  private _sessionId: string | undefined;
  private activeSession: SDKSession | null = null;

  constructor(
    config: AgentConfig,
    getClient: () => Promise<SDKClient>,
    sendAndWaitTimeout?: number,
  ) {
    super(config);
    this.getClient = getClient;
    this.sendAndWaitTimeout = sendAndWaitTimeout;
    this.isPersistent = config.sessionMode === "persistent";
    this.sdkTools = mapToolsToSDK(config.tools);
    this.sessionConfig = {
      model: config.model,
      tools: this.sdkTools,
      systemMessage: {
        mode: config.systemMessageMode ?? "append",
        content: config.systemPrompt,
      },
      onPermissionRequest: buildPermissionHandler(config),
      onUserInputRequest: buildUserInputHandler(config),
      ...(config.availableTools ? { availableTools: config.availableTools } : {}),
    };
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
    }
  }

  private async getOrCreateSession(streaming: boolean): Promise<{ session: SDKSession; isNew: boolean }> {
    if (this.isPersistent && this.persistentSession) {
      return { session: this.persistentSession, isNew: false };
    }
    const client = await this.getClient();
    const session = await client.createSession({
      ...this.sessionConfig,
      streaming: this.isPersistent ? true : streaming,
    });
    if (this.isPersistent) {
      this.persistentSession = session;
      this._sessionId = session.sessionId;
    }
    return { session, isNew: true };
  }

  // ─── executeRun ─────────────────────────────────────────────────

  protected async executeRun(
    messages: Message[],
    _options: RunOptions | undefined,
    signal: AbortSignal,
  ): Promise<AgentResult> {
    this.checkAbort(signal);

    const { session, isNew: isNewSession } = await this.getOrCreateSession(false);
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
    options: RunOptions | undefined,
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
    _options: RunOptions | undefined,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    this.checkAbort(signal);

    const { session, isNew: isNewSession } = await this.getOrCreateSession(true);
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

function extractLastUserPrompt(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user") {
      return getTextContent(msg.content);
    }
  }
  return "";
}

/** Build prompt with conversation history for CLI backends that create fresh sessions */
function buildContextualPrompt(messages: Message[]): string {
  if (messages.length <= 1) {
    return extractLastUserPrompt(messages);
  }

  const history = messages.slice(0, -1).map((msg) => {
    const text = msg.content ? getTextContent(msg.content) : "";
    return msg.role === "user" ? `User: ${text}` : `Assistant: ${text}`;
  }).join("\n");

  const lastPrompt = extractLastUserPrompt(messages);

  return `Conversation history:\n${history}\n\nUser: ${lastPrompt}`;
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
          useLoggedInUser: this.options.useLoggedInUser ?? true,
          ...(this.options.cliArgs ? { cliArgs: this.options.cliArgs } : {}),
          ...(this.options.env ? { env: { ...process.env, ...this.options.env } } : {}),
        });
        await client.start();

        // Verify authentication early to fail fast instead of hanging
        const auth = await client.getAuthStatus();
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

  createAgent(config: AgentConfig): IAgent {
    if (this.disposed) throw new DisposedError("CopilotAgentService");
    return new CopilotAgent(config, () => this.ensureClient(), this.options.timeout);
  }

  async listModels(): Promise<ModelInfo[]> {
    const client = await this.ensureClient();
    const models = await client.listModels();
    return models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: "copilot",
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
