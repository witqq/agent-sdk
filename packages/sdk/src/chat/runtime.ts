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
  RuntimeSendOptions,
} from "./core.js";
import { createChatId, toChatId, chatEventToAgentEvent } from "./core.js";
import type { IChatBackend } from "./backends/types.js";
import type { IChatSessionStore, CreateSessionOptions, SessionListOptions } from "./sessions.js";
import type { ContextWindowConfig, ContextStats } from "./context.js";
import { ContextWindowManager } from "./context.js";
import {
  StateMachine,
  RUNTIME_TRANSITIONS,
  ChatReentrancyGuard,
  ChatAbortController,
} from "./state.js";
import { ChatError, ErrorCode } from "./errors.js";
import { MessageAccumulator } from "./accumulator.js";
import { withStreamWatchdog } from "./watchdog.js";
import { ListenerSet } from "./listener-set.js";
import type { ToolDefinition, ToolContext } from "../types.js";
import type { ModelInfo } from "../types.js";
import type { AuthToken } from "../auth/types.js";
import type { ProviderConfig } from "./provider-types.js";

// ─── Runtime Configuration ─────────────────────────────────────

/** Factory function that creates a backend adapter on demand */
export type BackendAdapterFactory = (credentials: AuthToken) => IChatBackend | Promise<IChatBackend>;

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
  /** Retry configuration for pre-stream connection errors */
  retryConfig?: StreamRetryConfig;
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
  /**
   * Initial tools to register on the runtime.
   * Equivalent to calling `registerTool()` for each tool after creation.
   */
  tools?: ToolDefinition[];
}

/** Retry configuration for pre-stream failures (renamed to avoid clash with agent-level RetryConfig) */
export interface StreamRetryConfig {
  /** Maximum number of attempts (default: 1 = no retry) */
  maxAttempts: number;
  /** Delay between retries in milliseconds */
  delayMs: number;
}

/** @deprecated Use StreamRetryConfig */
export type RetryConfig = StreamRetryConfig;

// ─── Backend Discovery ─────────────────────────────────────────

/** Information about a registered backend */
export interface BackendInfo {
  /** Backend name (key in backends map) */
  name: string;
}

// ─── Provider CRUD Interface ───────────────────────────────────

/**
 * Provider CRUD operations — separated per Interface Segregation Principle.
 * Implemented by IChatClient (which needs provider management for UI).
 * Not required on IChatRuntime (providers are a handler-layer concern).
 */
export interface IProviderClient {
  listProviders(): Promise<ProviderConfig[]>;
  createProvider(config: Omit<ProviderConfig, "id" | "createdAt">): Promise<ProviderConfig>;
  updateProvider(id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>): Promise<void>;
  deleteProvider(id: string): Promise<void>;
}

// ─── IChatClient Interface (client-side remote) ────────────────

/** Callback for provider selection changes */
export type SelectionChangeCallback = (providerId: string | null) => void;

/**
 * Client-side interface for interacting with a remote chat server.
 * Fully self-contained — no shared base with IChatRuntime.
 * Extends IProviderClient for provider CRUD (ISP).
 * Used by React components and remote clients.
 *
 * @typeParam TMetadata - Type-level convenience for message metadata.
 *   NOT enforced at the storage boundary — session stores always use `unknown`.
 *   Consumers are responsible for metadata shape consistency.
 */
export interface IChatClient<TMetadata extends Record<string, unknown> = Record<string, unknown>>
  extends IProviderClient {

  // ── Lifecycle ──
  readonly status: RuntimeStatus;
  dispose(): Promise<void>;

  // ── Sessions ──
  createSession(options: CreateSessionOptions<TMetadata>): Promise<ChatSession<TMetadata>>;
  getSession(id: ChatIdLike): Promise<ChatSession<TMetadata> | null>;
  listSessions(options?: SessionListOptions): Promise<ChatSession<TMetadata>[]>;
  deleteSession(id: ChatIdLike): Promise<void>;

  // ── Client-side session state ──
  switchSession(id: ChatIdLike): Promise<ChatSession<TMetadata>>;
  readonly activeSessionId: ChatId | null;

  // ── Messaging ──
  /**
   * Send a message. Options are optional — the server handler resolves
   * model and backend from provider selection state.
   * Compare with IChatRuntime.send() where RuntimeSendOptions is required.
   */
  send(sessionId: ChatIdLike, message: string, options?: SendMessageOptions): AsyncIterable<ChatEvent>;

  // ── Messaging control ──
  abort(): void;

  // ── Provider Selection (local client state) ──
  selectProvider(providerId: string): void;
  readonly selectedProviderId: string | null;
  onSelectionChange(callback: SelectionChangeCallback): () => void;

  // ── Subscriptions ──
  onSessionChange(callback: () => void): () => void;

  // ── Discovery ──
  listModels(): Promise<ModelInfo[]>;
  listBackends(): Promise<BackendInfo[]>;

  // ── Context Stats ──
  getContextStats(sessionId: ChatIdLike): Promise<ContextStats | null>;
}

// ─── IChatRuntime Interface (server-only) ──────────────────────

/**
 * Server-side chat runtime. Fully self-contained — no shared base with IChatClient.
 * Manages backend adapters, tools, middleware, and context trimming.
 * Does NOT include client-facing provider CRUD or selection — those are
 * handled by the server handler layer.
 *
 * @typeParam TMetadata - Type-level convenience for message metadata.
 *   NOT enforced at the storage boundary — session stores always use `unknown`.
 *   Casts in `ChatRuntime.createSession()`/`getSession()` are intentionally unsafe
 *   to provide typed access. Consumers are responsible for metadata shape consistency.
 */
export interface IChatRuntime<TMetadata extends Record<string, unknown> = Record<string, unknown>> {

  // ── Lifecycle ──
  readonly status: RuntimeStatus;
  dispose(): Promise<void>;

  // ── Sessions ──
  createSession(options: CreateSessionOptions<TMetadata>): Promise<ChatSession<TMetadata>>;
  getSession(id: ChatIdLike): Promise<ChatSession<TMetadata> | null>;
  listSessions(options?: SessionListOptions): Promise<ChatSession<TMetadata>[]>;
  deleteSession(id: ChatIdLike): Promise<void>;

  // ── Messaging ──
  /**
   * Send a message. RuntimeSendOptions is required on the server — the caller
   * (usually a handler) must supply backend, model, and credentials.
   * Compare with IChatClient.send() where options are optional.
   */
  send(sessionId: ChatIdLike, message: string, options: RuntimeSendOptions): AsyncIterable<ChatEvent>;
  
  // ── Messaging control ──
  abort(): void;

  // ── Subscriptions ──
  onSessionChange(callback: () => void): () => void;

  // ── Discovery ──
  listModels(options?: { backend?: string; credentials?: AuthToken }): Promise<ModelInfo[]>;
  listBackends(): Promise<BackendInfo[]>;

  // ── Tools ──
  registerTool(tool: ToolDefinition): void;
  removeTool(name: string): void;
  readonly registeredTools: ReadonlyMap<string, ToolDefinition>;

  // ── Middleware ──
  use(middleware: ChatMiddleware): void;
  removeMiddleware(middleware: ChatMiddleware): void;

  // ── Context Stats ──
  getContextStats(sessionId: ChatIdLike): Promise<ContextStats | null>;
}

// ─── ChatRuntime Implementation ────────────────────────────────

class ChatRuntime<TMetadata extends Record<string, unknown> = Record<string, unknown>> implements IChatRuntime<TMetadata> {
  private readonly _state: StateMachine<RuntimeStatus>;
  private readonly _guard: ChatReentrancyGuard;
  private readonly _backends: Record<string, BackendAdapterFactory>;
  private readonly _sessionStore: IChatSessionStore;
  private readonly _contextConfig?: ContextWindowConfig;
  private readonly _ctxManager?: ContextWindowManager;
  private readonly _middleware: ChatMiddleware[];
  private readonly _tools = new Map<string, ToolDefinition>();
  private readonly _retryConfig?: StreamRetryConfig;
  private readonly _contextStats = new Map<ChatId, ContextStats>();
  private readonly _sessionUsage = new Map<ChatId, { promptTokens: number; completionTokens: number }>();
  private readonly _modelContextWindows = new Map<string, number>();
  private readonly _onContextTrimmed?: (sessionId: ChatIdLike, removedMessages: ChatMessage[]) => void;
  private readonly _streamTimeoutMs?: number;
  private readonly _sessionListeners = new ListenerSet<() => void>();

  private readonly _adapterPool = new Map<string, IChatBackend>();
  private readonly _defaultBackend: string;
  private _abortController: ChatAbortController | null = null;

  constructor(options: ChatRuntimeOptions) {
    this._state = new StateMachine<RuntimeStatus>("idle", RUNTIME_TRANSITIONS);
    this._guard = new ChatReentrancyGuard();
    this._backends = options.backends;
    this._defaultBackend = options.defaultBackend;
    this._sessionStore = options.sessionStore;
    this._contextConfig = options.context;
    if (this._contextConfig) {
      this._ctxManager = new ContextWindowManager(this._contextConfig);
    }
    this._middleware = [...(options.middleware ?? [])];
    this._retryConfig = options.retryConfig;
    this._onContextTrimmed = options.onContextTrimmed;
    this._streamTimeoutMs = options.streamTimeoutMs;

    if (!options.backends[options.defaultBackend]) {
      throw new ChatError(
        `Default backend "${options.defaultBackend}" not found in backends map`,
        { code: ErrorCode.INVALID_INPUT },
      );
    }

    // Register initial tools if provided
    if (options.tools) {
      for (const tool of options.tools) {
        this._tools.set(tool.name, tool);
      }
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

    // Dispose all adapters in pool
    for (const adapter of this._adapterPool.values()) {
      try { await adapter.dispose(); } catch { /* best-effort */ }
    }
    this._adapterPool.clear();
  }

  // ── Sessions ───────────────────────────────────────────────

  async createSession(options: CreateSessionOptions<TMetadata>): Promise<ChatSession<TMetadata>> {
    this.assertNotDisposed();
    const config: ChatSessionConfig = {
      model: options.config?.model ?? "",
      backend: options.config?.backend ?? this._defaultBackend,
      ...options.config,
    };
    const session = await this._sessionStore.createSession({ ...options, config });
    this._notifySessionChange();
    // TMetadata safety: session store uses unknown metadata. Cast is intentional —
    // consumers control metadata shape via TMetadata generic at compile time.
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
    this._sessionUsage.delete(cid);
    this._notifySessionChange();
  }

  // ── Messaging ──────────────────────────────────────────────

  async *send(
    sessionId: ChatIdLike,
    message: string,
    options: RuntimeSendOptions,
  ): AsyncIterable<ChatEvent> {
    this.validateSendInput(message, options);
    this._guard.acquire();

    const cid = toChatId(sessionId);
    this._abortController = new ChatAbortController(options?.signal);

    try {
      if (this._state.current === "error") {
        this._state.transition("idle");
      }
      this._state.transition("streaming");

      await this.loadSession(cid);
      const mwCtx: ChatMiddlewareContext = {
        sessionId: cid,
        signal: this._abortController.signal,
      };

      const userMessage = await this.applyBeforeSendMiddleware(
        this.createUserMessage(message), mwCtx,
      );
      if (userMessage === null) {
        // Middleware rejected the send — transition back to idle silently
        this._state.transition("idle");
        return;
      }
      const updatedSession = await this.persistAndReload(cid, userMessage);
      const sessionForAdapter = await this.trimSessionContext(cid, updatedSession, options.model);

      const stream = await this.prepareEventStream(
        cid, sessionForAdapter, updatedSession, message, options,
      );

      const accumulator = new MessageAccumulator();
      const eventSource = this._streamTimeoutMs
        ? withStreamWatchdog(stream, { timeoutMs: this._streamTimeoutMs, signal: this._abortController.signal })
        : stream;

      for await (const event of eventSource) {
        if (this._abortController.isAborted) break;
        this.feedAccumulator(accumulator, event);

        // Capture real usage data from usage events
        if (event.type === "usage") {
          this._sessionUsage.set(cid, {
            promptTokens: event.promptTokens,
            completionTokens: event.completionTokens,
          });
          this.updateContextStatsWithUsage(cid, event.promptTokens, event.completionTokens, options);
        }

        const processed = await this.applyOnEventMiddleware(event, mwCtx);
        if (processed) yield processed;
      }

      if (this._state.current === "disposed") return;

      await this.finalizeAssistantMessage(cid, accumulator, mwCtx);

      this._state.transition("idle");
    } catch (error) {
      const result = await this.handleSendError(error, cid);
      if (result !== null) throw result;
      // null = error suppressed by middleware, exit silently
    } finally {
      this._guard.release();
      this._abortController?.dispose();
      this._abortController = null;
    }
  }

  // ── Send Pipeline Stages ──────────────────────────────────────

  /** Stage 1: Validate send inputs (message content + required fields). */
  private validateSendInput(message: string, options: RuntimeSendOptions): void {
    this.assertNotDisposed();

    if (!message || message.trim().length === 0) {
      throw new ChatError("Message cannot be empty", { code: ErrorCode.INVALID_INPUT });
    }

    if (!options.model) {
      throw new ChatError(
        "options.model is required — caller must specify which model to use",
        { code: ErrorCode.INVALID_INPUT },
      );
    }

    if (!options.backend) {
      throw new ChatError(
        "options.backend is required — caller must specify which backend to use",
        { code: ErrorCode.INVALID_INPUT },
      );
    }

    if (!options.credentials) {
      throw new ChatError(
        "options.credentials is required — caller must provide authentication credentials",
        { code: ErrorCode.INVALID_INPUT },
      );
    }
  }

  /** Stage 2: Load session from store. */
  private async loadSession(cid: ChatId): Promise<ChatSession> {
    const session = await this._sessionStore.getSession(cid);
    if (!session) {
      throw new ChatError(
        `Session "${cid}" not found`,
        { code: ErrorCode.SESSION_NOT_FOUND },
      );
    }
    return session;
  }

  /** Stage 3: Apply onBeforeSend middleware pipeline. Returns null if middleware rejected the send. */
  private async applyBeforeSendMiddleware(
    userMessage: ChatMessage,
    ctx: ChatMiddlewareContext,
  ): Promise<ChatMessage | null> {
    let msg: ChatMessage | null = userMessage;
    for (const mw of this._middleware) {
      if (mw.onBeforeSend && msg) {
        msg = await mw.onBeforeSend(msg, ctx);
        if (msg === null) return null;
      }
    }
    return msg;
  }

  /** Stage 4: Persist user message and reload session with full history. */
  private async persistAndReload(cid: ChatId, userMessage: ChatMessage): Promise<ChatSession> {
    await this._sessionStore.appendMessage(cid, userMessage);
    return (await this._sessionStore.getSession(cid))!;
  }

  /** Stage 5: Auto-trim context window if configured. Returns session snapshot for adapter. */
  private async trimSessionContext(cid: ChatId, session: ChatSession, model?: string): Promise<ChatSession> {
    if (!this._ctxManager) return session;

    const ctxManager = this._ctxManager;
    const lastUsage = this._sessionUsage.get(cid);
    const modelContextWindow = model ? this._modelContextWindows.get(model) : undefined;

    // When real usage data is available, use average-based trimming
    if (lastUsage && modelContextWindow) {
      const result = ctxManager.fitMessagesWithUsage(
        session.messages,
        lastUsage.promptTokens,
        modelContextWindow,
      );

      this._contextStats.set(cid, {
        totalTokens: result.totalTokens,
        removedCount: result.removedCount,
        wasTruncated: result.wasTruncated,
        availableBudget: Math.max(0, modelContextWindow - result.totalTokens),
        realPromptTokens: lastUsage.promptTokens,
        realCompletionTokens: lastUsage.completionTokens,
        modelContextWindow,
      });

      if (result.wasTruncated && this._onContextTrimmed) {
        const keptIds = new Set(result.messages.map(m => m.id));
        const removed = session.messages.filter(m => !keptIds.has(m.id));
        if (removed.length > 0) {
          try { this._onContextTrimmed(cid, removed); } catch { /* swallow user callback errors */ }
        }
      }

      return { ...session, messages: result.messages };
    }

    // First message (no prior usage data): skip trimming, rely on model's large context window
    // Still use heuristic-based trimming as safety net via fitMessagesAsync
    const result = await ctxManager.fitMessagesAsync(session.messages);

    this._contextStats.set(cid, {
      totalTokens: result.totalTokens,
      removedCount: result.removedCount,
      wasTruncated: result.wasTruncated,
      availableBudget: ctxManager.availableBudget,
      modelContextWindow,
    });

    if (result.wasTruncated && this._onContextTrimmed) {
      const keptIds = new Set(result.messages.map(m => m.id));
      const removed = session.messages.filter(m => !keptIds.has(m.id));
      if (removed.length > 0) {
        try { this._onContextTrimmed(cid, removed); } catch { /* swallow user callback errors */ }
      }
    }

    return { ...session, messages: result.messages };
  }

  /** Update context stats with real usage data from a usage event. */
  private updateContextStatsWithUsage(
    cid: ChatId,
    promptTokens: number,
    completionTokens: number,
    options: RuntimeSendOptions,
  ): void {
    const modelContextWindow = options.model
      ? this._modelContextWindows.get(options.model)
      : undefined;

    const existing = this._contextStats.get(cid);
    this._contextStats.set(cid, {
      totalTokens: promptTokens,
      removedCount: existing?.removedCount ?? 0,
      wasTruncated: existing?.wasTruncated ?? false,
      availableBudget: modelContextWindow
        ? Math.max(0, modelContextWindow - promptTokens)
        : (existing?.availableBudget ?? 0),
      realPromptTokens: promptTokens,
      realCompletionTokens: completionTokens,
      modelContextWindow,
    });
  }

  /** Stage 6: Prepare event stream — adapter with retry, tool injection. */
  private async prepareEventStream(
    cid: ChatId,
    sessionForAdapter: ChatSession,
    fullSession: ChatSession,
    message: string,
    options: RuntimeSendOptions,
  ): Promise<AsyncIterable<ChatEvent>> {
    const adapter = await this.getOrCreateAdapterWithRetry(options.backend, options.credentials);

    const runtimeTools = this._tools.size > 0
      ? this.injectToolContext([...this._tools.values()], {
          sessionId: cid as string,
          custom: fullSession.metadata?.custom as Record<string, unknown> | undefined,
        })
      : undefined;

    const streamOptions: SendMessageOptions = {
      signal: this._abortController!.signal,
      model: options.model,
      systemPrompt: options.systemPrompt,
      tools: runtimeTools,
    };

    return this.createStreamWithRetry(
      adapter, sessionForAdapter, message, streamOptions,
      options.backend, options.credentials,
    );
  }

  /** Stage 7: Apply onEvent middleware pipeline (sequential transform/suppress). */
  private async applyOnEventMiddleware(
    event: ChatEvent,
    ctx: ChatMiddlewareContext,
  ): Promise<ChatEvent | null> {
    let processed: ChatEvent | null = event;
    for (const mw of this._middleware) {
      if (mw.onEvent && processed) {
        processed = await mw.onEvent(processed, ctx);
      }
    }
    return processed;
  }

  /** Stage 8: Finalize accumulator, apply afterReceive middleware, persist assistant message. */
  private async finalizeAssistantMessage(
    cid: ChatId,
    accumulator: MessageAccumulator,
    ctx: ChatMiddlewareContext,
  ): Promise<void> {
    let assistantMessage = accumulator.finalize();

    for (const mw of this._middleware) {
      if (mw.onAfterReceive) {
        assistantMessage = await mw.onAfterReceive(assistantMessage, ctx);
      }
    }

    await this._sessionStore.appendMessage(cid, assistantMessage);
    this._notifySessionChange();
  }

  /** Stage 9: Error handling — apply onError middleware, transition state. Returns null if suppressed. */
  private async handleSendError(error: unknown, cid: ChatId): Promise<Error | null> {
    let processedError = error instanceof Error ? error : new Error(String(error));
    const ctx: ChatMiddlewareContext = {
      sessionId: cid,
      signal: this._abortController?.signal ?? new AbortController().signal,
    };

    for (const mw of this._middleware) {
      if (mw.onError) {
        const result = await mw.onError(processedError, ctx);
        if (result === null) {
          if (this._state.canTransition("idle")) {
            this._state.transition("idle");
          }
          return null;
        }
        processedError = result;
      }
    }

    if (this._state.canTransition("error")) {
      this._state.transition("error");
    }
    return processedError;
  }

  abort(): void {
    this._abortController?.abort("User abort");
  }

  // ── Backend / Model ────────────────────────────────────────

  async listModels(options?: { backend?: string; credentials?: AuthToken }): Promise<ModelInfo[]> {
    this.assertNotDisposed();
    let models: ModelInfo[] = [];
    // Use existing adapter from pool if available
    const firstAdapter = [...this._adapterPool.values()][0];
    if (firstAdapter) {
      try { models = await firstAdapter.listModels(); } catch { return []; }
    } else if (options?.backend && options?.credentials) {
      // Pool empty — try to create adapter from provided credentials
      try {
        const adapter = await this.getOrCreateAdapter(options.backend, options.credentials);
        models = await adapter.listModels();
      } catch { return []; }
    }
    // Cache context windows for models that provide them
    for (const model of models) {
      if (model.contextWindow != null) {
        this._modelContextWindows.set(model.id, model.contextWindow);
      }
    }
    return models;
  }

  async listBackends(): Promise<BackendInfo[]> {
    this.assertNotDisposed();
    return Object.keys(this._backends).map((name) => ({ name }));
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

  async getContextStats(sessionId: ChatIdLike): Promise<ContextStats | null> {
    const cid = toChatId(sessionId);
    return this._contextStats.get(cid) ?? null;
  }

  // ── Session Subscription ──────────────────────────────────

  onSessionChange(callback: () => void): () => void {
    return this._sessionListeners.add(callback);
  }

  private _notifySessionChange(): void {
    this._sessionListeners.notify();
  }

  // ── Private Helpers ────────────────────────────────────────

  private async getOrCreateAdapter(backend: string, credentials: AuthToken): Promise<IChatBackend> {
    const key = this.getPoolKey(backend, credentials);
    const existing = this._adapterPool.get(key);
    if (existing) return existing;

    // Dispose stale adapters for same backend with different credentials
    for (const [oldKey, oldAdapter] of this._adapterPool) {
      if (oldKey.startsWith(backend + ":")) {
        try { await oldAdapter.dispose(); } catch { /* best-effort */ }
        this._adapterPool.delete(oldKey);
      }
    }

    const factory = this._backends[backend];
    if (!factory) {
      throw new ChatError(
        `Backend "${backend}" not found`,
        { code: ErrorCode.INVALID_INPUT },
      );
    }

    const adapter = await factory(credentials);

    this._adapterPool.set(key, adapter);
    return adapter;
  }

  private getPoolKey(backend: string, credentials: AuthToken): string {
    const token = credentials.accessToken;
    const hash = token.length > 16 ? token.slice(0, 8) + token.slice(-8) : token;
    return `${backend}:${hash}`;
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
        { code: ErrorCode.DISPOSED },
      );
    }
  }

  /** Get or create adapter with retry on connection errors */
  private async getOrCreateAdapterWithRetry(backend: string, credentials: AuthToken): Promise<IChatBackend> {
    const maxAttempts = this._retryConfig?.maxAttempts ?? 1;
    const delayMs = this._retryConfig?.delayMs ?? 0;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.getOrCreateAdapter(backend, credentials);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxAttempts) {
          // Remove cached adapter so next attempt creates fresh
          const key = this.getPoolKey(backend, credentials);
          const old = this._adapterPool.get(key);
          if (old) { try { await old.dispose(); } catch { /* best-effort */ } }
          this._adapterPool.delete(key);
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
    adapter: IChatBackend,
    session: ChatSession,
    message: string,
    options: SendMessageOptions | undefined,
    backend: string,
    credentials: AuthToken,
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
          try { await currentAdapter.dispose(); } catch { /* best-effort */ }
          const key = this.getPoolKey(backend, credentials);
          this._adapterPool.delete(key);
          await delay(delayMs);
          currentAdapter = await this.getOrCreateAdapter(backend, credentials);
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
