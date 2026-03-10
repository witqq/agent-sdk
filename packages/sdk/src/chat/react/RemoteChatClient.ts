/**
 * Client-side adapter that implements IChatClient by delegating
 * operations over HTTP/SSE to a remote server.
 *
 * Bridges the gap between SDK React hooks (which require an in-process runtime)
 * and the common architecture where ChatRuntime runs on a server.
 *
 * @example
 * ```ts
 * import { RemoteChatClient } from "@witqq/agent-sdk/chat/react";
 * import { ChatProvider } from "@witqq/agent-sdk/chat/react";
 *
 * const client = new RemoteChatClient({ baseUrl: "/api" });
 * <ChatProvider runtime={client}> ... </ChatProvider>
 * ```
 */

import type { ChatEvent, ChatSession, ChatId, ChatIdLike, RuntimeStatus, SendMessageOptions } from "../core.js";
import type { IChatClient, BackendInfo, SelectionChangeCallback } from "../runtime.js";
import type { ModelInfo } from "../../types.js";
import type { CreateSessionOptions, SessionListOptions } from "../sessions.js";
import type { ProviderConfig } from "../provider-types.js";
import type { ContextStats } from "../context.js";
import { ListenerSet } from "../listener-set.js";

// ─── Server Endpoint Contract ──────────────────────────────────

/**
 * Standard server endpoint contract.
 * Server implementations expose these routes to work with RemoteChatClient.
 *
 * POST   {baseUrl}/sessions/create   — Create session
 * GET    {baseUrl}/sessions/{id}     — Get session
 * GET    {baseUrl}/sessions          — List sessions
 * DELETE {baseUrl}/sessions/{id}     — Delete session
 * GET    {baseUrl}/sessions/{id}/context-stats — Get context window stats
 * POST   {baseUrl}/send              — Send message (SSE stream response)
 * POST   {baseUrl}/abort             — Abort current stream
 * GET    {baseUrl}/models            — List models
 * GET    {baseUrl}/backends          — List backends
 * POST   {baseUrl}/model/switch      — Switch model
 * POST   {baseUrl}/provider/switch   — Switch provider (backend + model)
 * GET    {baseUrl}/providers         — List providers
 * POST   {baseUrl}/providers         — Create provider
 * PUT    {baseUrl}/providers/{id}    — Update provider
 * DELETE {baseUrl}/providers/{id}    — Delete provider
 */
export interface RemoteChatClientOptions {
  /** Base URL for API endpoints (e.g. "/api" or "https://example.com/api") */
  baseUrl: string;
  /** Optional headers for all requests (e.g. auth tokens) */
  headers?: Record<string, string>;
  /** Custom fetch implementation for testability */
  fetch?: typeof globalThis.fetch;
}

// ─── RemoteChatClient ─────────────────────────────────────────

export class RemoteChatClient implements IChatClient {
  private _status: RuntimeStatus = "idle";
  private _activeSessionId: ChatId | null = null;
  private _selectedProviderId: string | null = null;
  private _abortController: AbortController | null = null;

  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly _fetch: typeof globalThis.fetch;
  private readonly _selectionListeners = new ListenerSet<SelectionChangeCallback>();

  constructor(options: RemoteChatClientOptions) {
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

  // ─── Provider Selection ────────────────────────────────────

  get selectedProviderId(): string | null {
    return this._selectedProviderId;
  }

  selectProvider(providerId: string): void {
    this.assertNotDisposed();
    this._selectedProviderId = providerId;
    this._notifySelectionChange(providerId);
  }

  onSelectionChange(callback: SelectionChangeCallback): () => void {
    return this._selectionListeners.add(callback);
  }

  private _notifySelectionChange(providerId: string | null): void {
    this._selectionListeners.notify(providerId);
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

  /**
   * Fetch context window stats from server.
   * Returns null if stats not available (e.g. no messages sent yet).
   */
  async getContextStats(sessionId: ChatIdLike): Promise<ContextStats | null> {
    this.assertNotDisposed();
    const res = await this._get(`/sessions/${sessionId}/context-stats`);
    const data = await res.json();
    return data as ContextStats | null;
  }

  async switchSession(id: ChatIdLike): Promise<ChatSession> {
    this.assertNotDisposed();
    const session = await this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    this._activeSessionId = session.id;
    this._notifySessionChange();
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
          providerId: this._selectedProviderId ?? undefined,
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

  // ─── Discovery ─────────────────────────────────────────────

  async listModels(): Promise<ModelInfo[]> {
    this.assertNotDisposed();
    const res = await this._get("/models");
    return await res.json() as ModelInfo[];
  }

  async listBackends(): Promise<BackendInfo[]> {
    this.assertNotDisposed();
    const res = await this._get("/backends");
    return await res.json() as BackendInfo[];
  }

  // ─── Providers ──────────────────────────────────────────────

  async listProviders(): Promise<ProviderConfig[]> {
    this.assertNotDisposed();
    const res = await this._get("/providers");
    return await res.json() as ProviderConfig[];
  }

  async createProvider(config: Omit<ProviderConfig, "id" | "createdAt">): Promise<ProviderConfig> {
    this.assertNotDisposed();
    const res = await this._post("/providers", config);
    return await res.json() as ProviderConfig;
  }

  async updateProvider(id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>): Promise<void> {
    this.assertNotDisposed();
    await this._put(`/providers/${id}`, changes);
  }

  async deleteProvider(id: string): Promise<void> {
    this.assertNotDisposed();
    await this._delete(`/providers/${id}`);
  }

  // ─── Session Change Notifications ────────────────────────────

  private readonly _sessionListeners = new ListenerSet<() => void>();

  onSessionChange(callback: () => void): () => void {
    return this._sessionListeners.add(callback);
  }

  private _notifySessionChange(): void {
    this._sessionListeners.notify();
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

  private async _put(path: string, body: unknown): Promise<Response> {
    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`PUT ${path} failed: ${res.status} ${res.statusText}`);
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
