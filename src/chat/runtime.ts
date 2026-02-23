/**
 * @witqq/agent-sdk/chat/runtime
 *
 * Unified chat runtime orchestrator. Creates a fully-wired runtime instance
 * from a configuration object, managing backend adapters, sessions, context
 * trimming, streaming, and middleware in a single facade.
 *
 * Usage:
 * ```typescript
 * import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
 * const runtime = createChatRuntime({ backends: { ... }, sessionStore, ... });
 * const session = await runtime.createSession({ config: { model: "gpt-4", backend: "copilot" } });
 * for await (const event of runtime.send(session.id, "Hello")) { ... }
 * ```
 */

import type {
  ChatEvent,
  ChatId,
  ChatIdLike,
  ChatMessage,
  ChatMiddleware,
  ChatMiddlewareContext,
  ChatSession,
  ChatSessionConfig,
  RuntimeStatus,
  SendMessageOptions,
} from "./core.js";
import { createChatId, toChatId, chatEventToAgentEvent } from "./core.js";
import type { IBackendAdapter } from "./backends/types.js";
import type { IChatSessionStore, CreateSessionOptions, SessionListOptions } from "./sessions.js";
import type { ContextWindowConfig, ContextStats } from "./context.js";
import { ContextWindowManager } from "./context.js";
import {
  StateMachine,
  RUNTIME_TRANSITIONS,
  ChatReentrancyGuard,
  ChatAbortController,
} from "./state.js";
import { ChatError, ChatErrorCode } from "./errors.js";
import { MessageAccumulator } from "./accumulator.js";
import { withStreamWatchdog } from "./watchdog.js";
import type { ToolDefinition, ToolContext } from "../types.js";
import type { ModelInfo } from "../types.js";

// ─── Runtime Configuration ─────────────────────────────────────

/** Factory function that creates a backend adapter on demand */
export type BackendAdapterFactory = () => IBackendAdapter | Promise<IBackendAdapter>;

/** Configuration for creating a chat runtime via createChatRuntime() */
export interface ChatRuntimeOptions {
  /** Map of backend name → adapter factory (lazy creation on first use) */
  backends: Record<string, BackendAdapterFactory>;
  /** Default backend name (must be a key in `backends`) */
  defaultBackend: string;
  /** Session store for persistence */
  sessionStore: IChatSessionStore;
  /** Context window configuration (optional) */
  context?: ContextWindowConfig;
  /** Middleware pipeline (optional, applied in order) */
  middleware?: ChatMiddleware[];
  /** Default model override (optional) */
  defaultModel?: string;
  /** Retry configuration for pre-stream connection errors */
  retryConfig?: RetryConfig;
  /**
   * Stream inactivity timeout in milliseconds (optional).
   * When set, aborts the stream if no events arrive within this window.
   * Timer resets after each received event.
   */
  streamTimeoutMs?: number;
  /**
   * Called when context trimming removes messages.
   * Use for archiving, logging, or analytics.
   */
  onContextTrimmed?: (sessionId: ChatIdLike, removedMessages: ChatMessage[]) => void;
}

/** Retry configuration for pre-stream failures */
export interface RetryConfig {
  /** Maximum number of attempts (default: 1 = no retry) */
  maxAttempts: number;
  /** Delay between retries in milliseconds */
  delayMs: number;
}

// ─── IChatRuntime Interface ────────────────────────────────────

/** The unified chat runtime facade */
export interface IChatRuntime<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  // ── Lifecycle ──
  /** Current runtime status */
  readonly status: RuntimeStatus;
  /** Dispose the runtime and all owned resources */
  dispose(): Promise<void>;

  // ── Sessions ──
  createSession(options: CreateSessionOptions<TMetadata>): Promise<ChatSession<TMetadata>>;
  getSession(id: ChatIdLike): Promise<ChatSession<TMetadata> | null>;
  listSessions(options?: SessionListOptions): Promise<ChatSession<TMetadata>[]>;
  deleteSession(id: ChatIdLike): Promise<void>;
  archiveSession(id: ChatIdLike): Promise<void>;
  switchSession(id: ChatIdLike): Promise<ChatSession<TMetadata>>;
  /** Currently active session ID (null if none) */
  readonly activeSessionId: ChatId | null;

  // ── Messaging ──
  send(sessionId: ChatIdLike, message: string, options?: SendMessageOptions): AsyncIterable<ChatEvent>;
  abort(): void;

  // ── Backend / Model ──
  switchBackend(name: string): Promise<void>;
  switchModel(model: string): void;
  listModels(): Promise<ModelInfo[]>;
  /** Current backend name */
  readonly currentBackend: string;
  /** Current model (from config or default) */
  readonly currentModel: string | undefined;

  // ── Tools ──
  registerTool(tool: ToolDefinition): void;
  removeTool(name: string): void;
  readonly registeredTools: ReadonlyMap<string, ToolDefinition>;

  // ── Middleware ──
  use(middleware: ChatMiddleware): void;
  removeMiddleware(middleware: ChatMiddleware): void;

  // ── Context Stats ──
  /** Get context usage stats from the last send() for a session. Returns null if no trimming has occurred. */
  getContextStats(sessionId: ChatIdLike): ContextStats | null;

  // ── Session Subscription ──
  /** Subscribe to session mutations (create, delete, archive, message send complete). Returns unsubscribe function. */
  onSessionChange(callback: () => void): () => void;
}

// ─── ChatRuntime Implementation ────────────────────────────────

class ChatRuntime<TMetadata extends Record<string, unknown> = Record<string, unknown>> implements IChatRuntime<TMetadata> {
  private readonly _state: StateMachine<RuntimeStatus>;
  private readonly _guard: ChatReentrancyGuard;
  private readonly _backends: Record<string, BackendAdapterFactory>;
  private readonly _sessionStore: IChatSessionStore;
  private readonly _contextConfig?: ContextWindowConfig;
  private readonly _middleware: ChatMiddleware[];
  private readonly _tools = new Map<string, ToolDefinition>();
  private readonly _retryConfig?: RetryConfig;
  private readonly _contextStats = new Map<ChatId, ContextStats>();
  private readonly _onContextTrimmed?: (sessionId: ChatIdLike, removedMessages: ChatMessage[]) => void;
  private readonly _streamTimeoutMs?: number;
  private readonly _sessionListeners = new Set<() => void>();

  private _activeAdapter: IBackendAdapter | null = null;
  private _currentBackend: string;
  private _currentModel: string | undefined;
  private _activeSessionId: ChatId | null = null;
  private _abortController: ChatAbortController | null = null;

  constructor(options: ChatRuntimeOptions) {
    this._state = new StateMachine<RuntimeStatus>("idle", RUNTIME_TRANSITIONS);
    this._guard = new ChatReentrancyGuard();
    this._backends = options.backends;
    this._currentBackend = options.defaultBackend;
    this._currentModel = options.defaultModel;
    this._sessionStore = options.sessionStore;
    this._contextConfig = options.context;
    this._middleware = [...(options.middleware ?? [])];
    this._retryConfig = options.retryConfig;
    this._onContextTrimmed = options.onContextTrimmed;
    this._streamTimeoutMs = options.streamTimeoutMs;

    if (!options.backends[options.defaultBackend]) {
      throw new ChatError(
        `Default backend "${options.defaultBackend}" not found in backends map`,
        { code: ChatErrorCode.INVALID_INPUT },
      );
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────

  get status(): RuntimeStatus {
    return this._state.current;
  }

  async dispose(): Promise<void> {
    if (this._state.current === "disposed") return;

    // Abort any in-flight send
    this._abortController?.abort("Runtime disposed");
    this._abortController?.dispose();
    this._abortController = null;

    // Direct transition to disposed from any state (streaming→disposed now valid)
    this._state.transition("disposed");

    // Dispose active adapter
    if (this._activeAdapter) {
      await this._activeAdapter.dispose();
      this._activeAdapter = null;
    }
  }

  // ── Sessions ───────────────────────────────────────────────

  get activeSessionId(): ChatId | null {
    return this._activeSessionId;
  }

  async createSession(options: CreateSessionOptions<TMetadata>): Promise<ChatSession<TMetadata>> {
    this.assertNotDisposed();
    // Fill config defaults from runtime settings when omitted
    const config: ChatSessionConfig = {
      model: options.config?.model ?? this._currentModel ?? "",
      backend: options.config?.backend ?? this._currentBackend,
      ...options.config,
    };
    const session = await this._sessionStore.createSession({ ...options, config });
    this._activeSessionId = session.id;
    this._notifySessionChange();
    return session as ChatSession<TMetadata>;
  }

  async getSession(id: ChatIdLike): Promise<ChatSession<TMetadata> | null> {
    this.assertNotDisposed();
    const cid = toChatId(id);
    return this._sessionStore.getSession(cid) as Promise<ChatSession<TMetadata> | null>;
  }

  async listSessions(options?: SessionListOptions): Promise<ChatSession<TMetadata>[]> {
    this.assertNotDisposed();
    return this._sessionStore.listSessions(options) as Promise<ChatSession<TMetadata>[]>;
  }

  async deleteSession(id: ChatIdLike): Promise<void> {
    this.assertNotDisposed();
    const cid = toChatId(id);
    const session = await this._sessionStore.getSession(cid);
    if (!session) return;

    await this._sessionStore.deleteSession(cid);
    this._contextStats.delete(cid);
    if (this._activeSessionId === cid) {
      this._activeSessionId = null;
    }
    this._notifySessionChange();
  }

  async archiveSession(id: ChatIdLike): Promise<void> {
    this.assertNotDisposed();
    const cid = toChatId(id);
    await this._sessionStore.archiveSession(cid);
    this._notifySessionChange();
  }

  async switchSession(id: ChatIdLike): Promise<ChatSession<TMetadata>> {
    this.assertNotDisposed();
    const cid = toChatId(id);
    const session = await this._sessionStore.getSession(cid);
    if (!session) {
      throw new ChatError(
        `Session "${id}" not found`,
        { code: ChatErrorCode.SESSION_NOT_FOUND },
      );
    }
    this._activeSessionId = session.id;
    return session as ChatSession<TMetadata>;
  }

  // ── Messaging ──────────────────────────────────────────────

  async *send(
    sessionId: ChatIdLike,
    message: string,
    options?: SendMessageOptions,
  ): AsyncIterable<ChatEvent> {
    this.assertNotDisposed();

    if (!message || message.trim().length === 0) {
      throw new ChatError("Message cannot be empty", { code: ChatErrorCode.INVALID_INPUT });
    }

    this._guard.acquire();

    // Normalize to branded ChatId for internal use
    const cid = toChatId(sessionId);

    // Create abort controller linked to user's signal
    this._abortController = new ChatAbortController(options?.signal);

    try {
      // Auto-recover from error state (transient failures shouldn't permanently kill runtime)
      if (this._state.current === "error") {
        this._state.transition("idle");
      }
      this._state.transition("streaming");

      // 1. Load session
      const session = await this._sessionStore.getSession(cid);
      if (!session) {
        throw new ChatError(
          `Session "${cid}" not found`,
          { code: ChatErrorCode.SESSION_NOT_FOUND },
        );
      }

      const middlewareContext: ChatMiddlewareContext = {
        sessionId: cid,
        signal: this._abortController.signal,
      };

      // 2. Create user message
      let userMessage = this.createUserMessage(message);

      // 3. Apply onBeforeSend middleware pipeline (sequential transform)
      for (const mw of this._middleware) {
        if (mw.onBeforeSend) {
          userMessage = await mw.onBeforeSend(userMessage, middlewareContext);
        }
      }

      // 4. Persist transformed user message
      await this._sessionStore.appendMessage(cid, userMessage);

      // 5. Reload session with user message for context
      const updatedSession = (await this._sessionStore.getSession(cid))!;

      // 6. Auto-trim context if configured
      let messagesToSend = updatedSession.messages;
      if (this._contextConfig) {
        const ctxManager = new ContextWindowManager(this._contextConfig);
        const result = await ctxManager.fitMessagesAsync(messagesToSend);

        // Track stats for this session
        this._contextStats.set(cid, {
          totalTokens: result.totalTokens,
          removedCount: result.removedCount,
          wasTruncated: result.wasTruncated,
          availableBudget: ctxManager.availableBudget,
        });

        // Fire archive callback with removed messages (safe — user callback errors don't crash send)
        if (result.wasTruncated && this._onContextTrimmed) {
          const keptIds = new Set(result.messages.map(m => m.id));
          const removed = messagesToSend.filter(m => !keptIds.has(m.id));
          if (removed.length > 0) {
            try {
              this._onContextTrimmed(cid, removed);
            } catch {
              // User callback error — swallow to avoid disrupting send flow
            }
          }
        }

        messagesToSend = result.messages;
      }

      // Build a session snapshot with trimmed messages for adapter
      const sessionForAdapter: ChatSession = {
        ...updatedSession,
        messages: messagesToSend,
      };

      // 7. Get or create adapter (with retry for pre-stream connection errors)
      const adapter = await this.getOrCreateAdapterWithRetry();

      // 8. Create accumulator for building assistant message from stream
      const accumulator = new MessageAccumulator();

      // 9. Stream via adapter, passing runtime tools with context injection
      const runtimeTools = this._tools.size > 0
        ? this.injectToolContext([...this._tools.values()], {
            sessionId: cid as string,
            custom: updatedSession.metadata?.custom as Record<string, unknown> | undefined,
          })
        : undefined;
      const streamOptions: SendMessageOptions = {
        ...options,
        signal: this._abortController.signal,
        model: options?.model ?? this._currentModel,
        tools: runtimeTools,
      };

      const stream = await this.createStreamWithRetry(adapter, sessionForAdapter, message, streamOptions);

      const eventSource = this._streamTimeoutMs
        ? withStreamWatchdog(stream, { timeoutMs: this._streamTimeoutMs, signal: this._abortController.signal })
        : stream;

      for await (const event of eventSource) {
        if (this._abortController.isAborted) break;

        // Feed events to accumulator for building assistant message
        this.feedAccumulator(accumulator, event);

        // Apply onEvent middleware pipeline (sequential transform/suppress)
        let processedEvent: ChatEvent | null = event;
        for (const mw of this._middleware) {
          if (mw.onEvent && processedEvent) {
            processedEvent = await mw.onEvent(processedEvent, middlewareContext);
          }
        }

        if (processedEvent) {
          yield processedEvent;
        }
      }

      // If runtime was disposed during streaming, exit gracefully
      if (this._state.current === "disposed") {
        return;
      }

      // 10. Finalize accumulator and persist assistant message
      let assistantMessage = accumulator.finalize();

      // Apply onAfterReceive middleware pipeline
      for (const mw of this._middleware) {
        if (mw.onAfterReceive) {
          assistantMessage = await mw.onAfterReceive(assistantMessage, middlewareContext);
        }
      }

      await this._sessionStore.appendMessage(cid, assistantMessage);
      this._notifySessionChange();

      this._state.transition("idle");
    } catch (error) {
      // Apply onError middleware
      let processedError = error instanceof Error ? error : new Error(String(error));
      const middlewareContext: ChatMiddlewareContext = {
        sessionId: cid,
        signal: this._abortController?.signal ?? new AbortController().signal,
      };

      for (const mw of this._middleware) {
        if (mw.onError) {
          const result = await mw.onError(processedError, middlewareContext);
          if (result === null) {
            // Error suppressed by middleware
            if (this._state.canTransition("idle")) {
              this._state.transition("idle");
            }
            return;
          }
          processedError = result;
        }
      }

      if (this._state.canTransition("error")) {
        this._state.transition("error");
      }
      throw processedError;
    } finally {
      this._guard.release();
      this._abortController?.dispose();
      this._abortController = null;
    }
  }

  abort(): void {
    this._abortController?.abort("User abort");
  }

  // ── Backend / Model ────────────────────────────────────────

  get currentBackend(): string {
    return this._currentBackend;
  }

  get currentModel(): string | undefined {
    return this._currentModel;
  }

  async switchBackend(name: string): Promise<void> {
    this.assertNotDisposed();
    if (!this._backends[name]) {
      throw new ChatError(
        `Backend "${name}" not found in backends map`,
        { code: ChatErrorCode.INVALID_INPUT },
      );
    }

    // Dispose current adapter — new one created lazily on next send
    if (this._activeAdapter) {
      await this._activeAdapter.dispose();
      this._activeAdapter = null;
    }

    this._currentBackend = name;
  }

  switchModel(model: string): void {
    this.assertNotDisposed();
    this._currentModel = model;
  }

  async listModels(): Promise<ModelInfo[]> {
    this.assertNotDisposed();
    const adapter = await this.getOrCreateAdapter();
    return adapter.listModels();
  }

  // ── Tools ──────────────────────────────────────────────────

  get registeredTools(): ReadonlyMap<string, ToolDefinition> {
    return this._tools;
  }

  registerTool(tool: ToolDefinition): void {
    this.assertNotDisposed();
    this._tools.set(tool.name, tool);
  }

  removeTool(name: string): void {
    this.assertNotDisposed();
    this._tools.delete(name);
  }

  // ── Middleware ──────────────────────────────────────────────

  use(middleware: ChatMiddleware): void {
    this.assertNotDisposed();
    this._middleware.push(middleware);
  }

  removeMiddleware(middleware: ChatMiddleware): void {
    this.assertNotDisposed();
    const idx = this._middleware.indexOf(middleware);
    if (idx >= 0) this._middleware.splice(idx, 1);
  }

  // ── Context Stats ─────────────────────────────────────────

  getContextStats(sessionId: ChatIdLike): ContextStats | null {
    const cid = toChatId(sessionId);
    return this._contextStats.get(cid) ?? null;
  }

  // ── Session Subscription ──────────────────────────────────

  onSessionChange(callback: () => void): () => void {
    this._sessionListeners.add(callback);
    return () => { this._sessionListeners.delete(callback); };
  }

  private _notifySessionChange(): void {
    for (const cb of this._sessionListeners) {
      try { cb(); } catch { /* listener errors must not break runtime */ }
    }
  }

  // ── Private Helpers ────────────────────────────────────────

  private async getOrCreateAdapter(): Promise<IBackendAdapter> {
    if (this._activeAdapter) return this._activeAdapter;

    const factory = this._backends[this._currentBackend];
    if (!factory) {
      throw new ChatError(
        `Backend "${this._currentBackend}" not found`,
        { code: ChatErrorCode.INVALID_INPUT },
      );
    }

    this._activeAdapter = await factory();
    return this._activeAdapter;
  }

  /** Wrap each tool's execute to inject ToolContext as 2nd argument */
  private injectToolContext(tools: ToolDefinition[], context: ToolContext): ToolDefinition[] {
    return tools.map(tool => ({
      ...tool,
      execute: (params: unknown) => tool.execute(params, context),
    }));
  }

  /** Map ChatEvent to AgentEvent for MessageAccumulator */
  private feedAccumulator(acc: MessageAccumulator, event: ChatEvent): void {
    const agentEvent = chatEventToAgentEvent(event);
    if (agentEvent) acc.apply(agentEvent);
  }

  private createUserMessage(text: string): ChatMessage {
    return {
      id: createChatId(),
      role: "user",
      parts: [{ type: "text", text, status: "complete" }],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
  }

  private assertNotDisposed(): void {
    if (this._state.current === "disposed") {
      throw new ChatError(
        "Runtime is disposed",
        { code: ChatErrorCode.DISPOSED },
      );
    }
  }

  /** Get or create adapter with retry on connection errors */
  private async getOrCreateAdapterWithRetry(): Promise<IBackendAdapter> {
    const maxAttempts = this._retryConfig?.maxAttempts ?? 1;
    const delayMs = this._retryConfig?.delayMs ?? 0;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.getOrCreateAdapter();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxAttempts) {
          // Reset adapter so next attempt creates fresh
          this._activeAdapter = null;
          await delay(delayMs);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Create stream with retry for pre-stream connection errors.
   * Tries to get the first event from the stream; if that fails,
   * retries with a fresh adapter. Once first event is received,
   * the stream is committed (no more retries).
   */
  private async createStreamWithRetry(
    adapter: IBackendAdapter,
    session: ChatSession,
    message: string,
    options: SendMessageOptions | undefined,
  ): Promise<AsyncIterable<ChatEvent>> {
    const maxAttempts = this._retryConfig?.maxAttempts ?? 1;
    const delayMs = this._retryConfig?.delayMs ?? 0;
    let lastError: Error | undefined;
    let currentAdapter = adapter;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const stream = currentAdapter.streamMessage(session, message, options);
        const iterator = (stream as AsyncIterable<ChatEvent>)[Symbol.asyncIterator]();
        const first = await iterator.next();

        // First event received — stream is live. Wrap remaining into iterable.
        return (async function* () {
          if (!first.done) yield first.value;
          while (true) {
            const next = await iterator.next();
            if (next.done) break;
            yield next.value;
          }
        })();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxAttempts) {
          // Dispose failed adapter before creating fresh one
          if (this._activeAdapter) {
            await this._activeAdapter.dispose().catch(() => {});
          }
          this._activeAdapter = null;
          await delay(delayMs);
          currentAdapter = await this.getOrCreateAdapter();
        }
      }
    }

    throw lastError!;
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Factory ───────────────────────────────────────────────────

/**
 * Create a fully-wired chat runtime from configuration.
 *
 * @param options - Runtime configuration (backends, session store, context, middleware)
 * @returns IChatRuntime instance ready to use
 *
 * @example
 * ```typescript
 * import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
 * import { InMemorySessionStore } from "@witqq/agent-sdk/chat/sessions";
 *
 * const runtime = createChatRuntime({
 *   backends: {
 *     copilot: () => new CopilotAdapter({ agentConfig: { model: "gpt-4" } }),
 *   },
 *   defaultBackend: "copilot",
 *   sessionStore: new InMemorySessionStore(),
 * });
 * ```
 */
export function createChatRuntime<TMetadata extends Record<string, unknown> = Record<string, unknown>>(
  options: ChatRuntimeOptions,
): IChatRuntime<TMetadata> {
  return new ChatRuntime<TMetadata>(options);
}
