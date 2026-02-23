/**
 * Typed HTTP client for demo server endpoints.
 *
 * Wraps fetch with typed methods for all demo API routes.
 * Used by E2E tests to interact with the running demo server.
 */
import { collectSSEEvents, parseSSEStream, type SSEEvent } from "./sse-parser.js";

export class DemoApiClient {
  constructor(private readonly baseUrl: string) {}

  // ─── Health ──────────────────────────────────────────────

  async health(): Promise<{ ok: boolean }> {
    return this.get("/api/health");
  }

  // ─── Auth ────────────────────────────────────────────────

  async listSavedTokens(): Promise<{ saved: string[] }> {
    return this.get("/api/tokens/saved");
  }

  async useToken(provider: string): Promise<{ ok: boolean; provider?: string; error?: string }> {
    return this.post("/api/tokens/use", { provider });
  }

  async clearTokens(): Promise<{ ok: boolean }> {
    return this.post("/api/tokens/clear", {});
  }

  // ─── Sessions ────────────────────────────────────────────

  async createSession(title?: string): Promise<{ id: string; title?: string }> {
    return this.post("/api/chat/sessions/create", { title });
  }

  async getSession(id: string): Promise<Record<string, unknown>> {
    return this.get(`/api/chat/sessions/${id}`);
  }

  async listSessions(): Promise<Array<Record<string, unknown>>> {
    return this.get("/api/chat/sessions");
  }

  async deleteSession(id: string): Promise<{ ok: boolean }> {
    return this.delete(`/api/chat/sessions/${id}`);
  }

  // ─── Chat ────────────────────────────────────────────────

  /**
   * Send a message and collect all SSE events.
   * Returns the full list of events from the stream.
   * @param timeoutMs - Abort the stream after this many ms (default: 90000)
   */
  async sendMessage(
    sessionId: string,
    message: string,
    options?: { model?: string; timeoutMs?: number },
  ): Promise<SSEEvent[]> {
    const body: Record<string, unknown> = { sessionId, message };
    if (options?.model) body.model = options.model;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 90_000);

    try {
      const res = await fetch(`${this.baseUrl}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /api/chat/send failed (${res.status}): ${text}`);
      }

      return await collectSSEEvents(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Send a message and return the raw SSE stream for incremental processing.
   * @param timeoutMs - Abort the stream after this many ms (default: 90000)
   */
  async sendMessageStream(
    sessionId: string,
    message: string,
    options?: { model?: string; timeoutMs?: number },
  ): Promise<AsyncGenerator<SSEEvent>> {
    const body: Record<string, unknown> = { sessionId, message };
    if (options?.model) body.model = options.model;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 90_000);

    try {
      const res = await fetch(`${this.baseUrl}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`POST /api/chat/send failed (${res.status}): ${text}`);
      }

      return parseSSEStream(res);
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  // ─── Models ──────────────────────────────────────────────

  async listModels(): Promise<Array<{ id?: string; name?: string }>> {
    return this.get("/api/chat/models");
  }

  async switchModel(model: string): Promise<{ ok?: boolean; error?: string }> {
    const res = await fetch(`${this.baseUrl}/api/chat/model/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    return res.json() as Promise<{ ok?: boolean; error?: string }>;
  }

  // ─── Backend ─────────────────────────────────────────────

  async switchBackend(backend: string): Promise<{ ok?: boolean; error?: string }> {
    return this.post("/api/chat/backend/switch", { backend });
  }

  // ─── Internal ────────────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GET ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: "DELETE" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DELETE ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }
}
