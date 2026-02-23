/**
 * Client-side runtime adapter that implements IChatRuntime by delegating
 * operations over HTTP/SSE to a remote server.
 *
 * Bridges the gap between SDK React hooks (which require an in-process runtime)
 * and the common architecture where ChatRuntime runs on a server.
 *
 * @example
 * ```ts
 * import { RemoteChatRuntime } from "@witqq/agent-sdk/chat/react";
 * import { ChatProvider } from "@witqq/agent-sdk/chat/react";
 *
 * const runtime = new RemoteChatRuntime({ baseUrl: "/api" });
 * <ChatProvider runtime={runtime}> ... </ChatProvider>
 * ```
 */

import type { ChatEvent, ChatSession, ChatId, ChatIdLike, RuntimeStatus, ChatMiddleware, SendMessageOptions } from "../core.js";
import type { IChatRuntime } from "../runtime.js";
import type { ToolDefinition, ModelInfo } from "../../types.js";
import type { CreateSessionOptions, SessionListOptions } from "../sessions.js";
import type { ContextStats } from "../context.js";

// ─── Server Endpoint Contract ──────────────────────────────────

/**
 * Standard server endpoint contract.
 * Server implementations expose these routes to work with RemoteChatRuntime.
 *
 * POST   {baseUrl}/sessions/create   — Create session
 * GET    {baseUrl}/sessions/{id}     — Get session
 * GET    {baseUrl}/sessions          — List sessions
 * DELETE {baseUrl}/sessions/{id}     — Delete session
 * POST   {baseUrl}/sessions/{id}/archive — Archive session
 * POST   {baseUrl}/send              — Send message (SSE stream response)
 * POST   {baseUrl}/abort             — Abort current stream
 * GET    {baseUrl}/models            — List models
 * POST   {baseUrl}/backend/switch    — Switch backend
 * POST   {baseUrl}/model/switch      — Switch model
 */
export interface RemoteChatRuntimeOptions {
  /** Base URL for API endpoints (e.g. "/api" or "https://example.com/api") */
  baseUrl: string;
  /** Optional headers for all requests (e.g. auth tokens) */
  headers?: Record<string, string>;
  /** Custom fetch implementation for testability */
  fetch?: typeof globalThis.fetch;
}

// ─── RemoteChatRuntime ─────────────────────────────────────────

export class RemoteChatRuntime implements IChatRuntime {
  private _status: RuntimeStatus = "idle";
  private _activeSessionId: ChatId | null = null;
  private _currentBackend = "default";
  private _currentModel: string | undefined;
  private _abortController: AbortController | null = null;
  private readonly _tools = new Map<string, ToolDefinition>();
  private readonly _middlewares: ChatMiddleware[] = [];

  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(options: RemoteChatRuntimeOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.headers = options.headers ?? {};
    this._fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  get status(): RuntimeStatus {
    return this._status;
  }

  async dispose(): Promise<void> {
    this.abort();
    this._status = "disposed";
  }

  private assertNotDisposed(): void {
    if (this._status === "disposed") {
      throw new Error("Runtime is disposed");
    }
  }

  // ─── Sessions ───────────────────────────────────────────────

  get activeSessionId(): ChatId | null {
    return this._activeSessionId;
  }

  async createSession(options: CreateSessionOptions): Promise<ChatSession> {
    this.assertNotDisposed();
    const res = await this._post("/sessions/create", options);
    const session = await res.json() as ChatSession;
    this._activeSessionId = session.id;
    this._notifySessionChange();
    return session;
  }

  async getSession(id: ChatIdLike): Promise<ChatSession | null> {
    this.assertNotDisposed();
    const res = await this._get(`/sessions/${id}`);
    if (res.status === 404) return null;
    return await res.json() as ChatSession;
  }

  async listSessions(_options?: SessionListOptions): Promise<ChatSession[]> {
    this.assertNotDisposed();
    const res = await this._get("/sessions");
    return await res.json() as ChatSession[];
  }

  async deleteSession(id: ChatIdLike): Promise<void> {
    this.assertNotDisposed();
    await this._delete(`/sessions/${id}`);
    if (this._activeSessionId === (id as ChatId)) {
      this._activeSessionId = null;
    }
    this._notifySessionChange();
  }

  async archiveSession(id: ChatIdLike): Promise<void> {
    this.assertNotDisposed();
    await this._post(`/sessions/${id}/archive`, {});
    this._notifySessionChange();
  }

  async switchSession(id: ChatIdLike): Promise<ChatSession> {
    this.assertNotDisposed();
    const session = await this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    this._activeSessionId = session.id;
    return session;
  }

  // ─── Messaging ──────────────────────────────────────────────

  async *send(
    sessionId: ChatIdLike,
    message: string,
    options?: SendMessageOptions,
  ): AsyncIterable<ChatEvent> {
    this.assertNotDisposed();
    this._status = "streaming";
    this._abortController = new AbortController();

    try {
      const res = await this._fetch(`${this.baseUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...this.headers,
        },
        body: JSON.stringify({
          sessionId,
          message,
          model: options?.model,
        }),
        signal: this._abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`Send failed: ${res.status} ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error("No response body for SSE stream");
      }

      yield* this._parseSSEStream(res.body, this._abortController.signal);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Abort is expected — not an error
      } else {
        this._status = "error";
        throw err;
      }
    } finally {
      this._abortController = null;
      if (this._status === "streaming") {
        this._status = "idle";
      }
      this._notifySessionChange();
    }
  }

  abort(): void {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    if (this._status === "streaming") {
      this._status = "idle";
    }
    // Fire-and-forget server abort notification
    this._post("/abort", {}).catch(() => {});
  }

  // ─── Backend / Model ────────────────────────────────────────

  get currentBackend(): string {
    return this._currentBackend;
  }

  get currentModel(): string | undefined {
    return this._currentModel;
  }

  async switchBackend(name: string): Promise<void> {
    this.assertNotDisposed();
    await this._post("/backend/switch", { backend: name });
    this._currentBackend = name;
  }

  switchModel(model: string): void {
    this._currentModel = model;
    // Fire-and-forget to sync server
    this._post("/model/switch", { model }).catch(() => {});
  }

  async listModels(): Promise<ModelInfo[]> {
    this.assertNotDisposed();
    const res = await this._get("/models");
    return await res.json() as ModelInfo[];
  }

  // ─── Tools (client-side registry) ───────────────────────────

  get registeredTools(): ReadonlyMap<string, ToolDefinition> {
    return this._tools;
  }

  registerTool(tool: ToolDefinition): void {
    this._tools.set(tool.name, tool);
  }

  removeTool(name: string): void {
    this._tools.delete(name);
  }

  // ─── Middleware (client-side) ───────────────────────────────

  use(middleware: ChatMiddleware): void {
    this._middlewares.push(middleware);
  }

  removeMiddleware(middleware: ChatMiddleware): void {
    const idx = this._middlewares.indexOf(middleware);
    if (idx !== -1) this._middlewares.splice(idx, 1);
  }

  // ─── Context ────────────────────────────────────────────────

  getContextStats(_sessionId: ChatIdLike): ContextStats | null {
    // Context management is server-side; client doesn't track this
    return null;
  }

  private readonly _sessionListeners = new Set<() => void>();

  onSessionChange(callback: () => void): () => void {
    this._sessionListeners.add(callback);
    return () => { this._sessionListeners.delete(callback); };
  }

  private _notifySessionChange(): void {
    for (const cb of this._sessionListeners) {
      try { cb(); } catch { /* ignore */ }
    }
  }

  // ─── Internal HTTP helpers ──────────────────────────────────

  private async _get(path: string): Promise<Response> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: { ...this.headers },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res;
  }

  private async _post(path: string, body: unknown): Promise<Response> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res;
  }

  private async _delete(path: string): Promise<Response> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: { ...this.headers },
    });
    if (!res.ok) {
      throw new Error(`DELETE ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res;
  }

  // ─── SSE Parser ─────────────────────────────────────────────

  private async *_parseSSEStream(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Create a promise that rejects on abort — used to race with reader.read()
    const abortPromise = new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });

    try {
      while (true) {
        if (signal.aborted) break;

        // Race reader.read() against abort signal
        const { done, value } = await Promise.race([
          reader.read(),
          abortPromise,
        ]);
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!; // Keep incomplete line in buffer

        for (const line of lines) {
          if (signal.aborted) return;
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") return;
            try {
              yield JSON.parse(data) as ChatEvent;
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Expected on abort — exit cleanly
      } else {
        throw err;
      }
    } finally {
      reader.releaseLock();
    }
  }
}
