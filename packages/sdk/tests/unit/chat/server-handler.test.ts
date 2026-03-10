import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChatHandler, corsMiddleware } from "../../../src/chat/server/index.js";
import type { ReadableRequest, WritableResponse } from "../../../src/chat/server/handler.js";
import type { IChatRuntime } from "../../../src/chat/runtime.js";
import type { ChatSession, ChatId, ChatEvent } from "../../../src/chat/core.js";

// ─── Mock Helpers ──────────────────────────────────────────────

function mockSession(id = "sess-1"): ChatSession {
  return {
    id: id as unknown as ChatId,
    title: "Test Session",
    status: "active",
    config: { backend: "copilot", model: "gpt-4.1" },
    messages: [],
    metadata: { messageCount: 0, totalTokens: 0, custom: {} },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as ChatSession;
}

function mockRuntime(): IChatRuntime {
  return {
    status: "idle",
    dispose: vi.fn(),
    createSession: vi.fn().mockResolvedValue(mockSession()),
    getSession: vi.fn().mockResolvedValue(mockSession()),
    listSessions: vi.fn().mockResolvedValue([mockSession()]),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockReturnValue((async function* () {
      yield { type: "message:delta", text: "Hello" } as ChatEvent;
    })()),
    abort: vi.fn(),
    listModels: vi.fn().mockResolvedValue([{ id: "gpt-4.1", name: "GPT-4.1" }]),
    listBackends: vi.fn().mockReturnValue([
      { name: "copilot" },
      { name: "claude" },
    ]),
    registerTool: vi.fn(),
    removeTool: vi.fn(),
    registeredTools: new Map(),
    use: vi.fn(),
    removeMiddleware: vi.fn(),
    getContextStats: vi.fn().mockReturnValue(null),
    onSessionChange: vi.fn().mockReturnValue(() => {}),
  };
}

function mockReq(method: string, url: string, body?: unknown): ReadableRequest {
  const bodyStr = body ? JSON.stringify(body) : "";
  return {
    method,
    url,
    on(event: string, listener: (arg?: unknown) => void) {
      if (event === "data" && bodyStr) {
        queueMicrotask(() => listener(Buffer.from(bodyStr)));
      }
      if (event === "end") {
        queueMicrotask(() => listener());
      }
    },
  } as ReadableRequest;
}

function mockRes(): WritableResponse & {
  _status: number;
  _headers: Record<string, string>;
  _body: string;
  _ended: boolean;
} {
  const res = {
    _status: 0,
    _headers: {} as Record<string, string>,
    _body: "",
    _ended: false,
    writeHead(statusCode: number, headers?: Record<string, string>) {
      res._status = statusCode;
      if (headers) Object.assign(res._headers, headers);
    },
    setHeader(name: string, value: string) {
      res._headers[name] = value;
    },
    write(chunk: string) {
      res._body += chunk;
      return true;
    },
    end(body?: string) {
      if (body) res._body += body;
      res._ended = true;
    },
    get writableEnded() { return res._ended; },
  };
  return res;
}

// ─── createChatHandler Tests ──────────────────────────────────

describe("createChatHandler", () => {
  let runtime: IChatRuntime;
  let handler: (req: ReadableRequest, res: WritableResponse) => Promise<void>;

  beforeEach(() => {
    runtime = mockRuntime();
    handler = createChatHandler(runtime);
  });

  describe("session routes", () => {
    it("POST /sessions/create creates session", async () => {
      const req = mockReq("POST", "/sessions/create", { title: "Test" });
      const res = mockRes();
      await handler(req, res);

      expect(runtime.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Test" }),
      );
      expect(res._status).toBe(200);
      const body = JSON.parse(res._body);
      expect(body.id).toBe("sess-1");
    });

    it("POST /sessions/create uses default config when none provided", async () => {
      const req = mockReq("POST", "/sessions/create", {});
      const res = mockRes();
      await handler(req, res);

      expect(runtime.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { model: "", backend: "" },
        }),
      );
    });

    it("POST /sessions/create forwards tags and custom metadata", async () => {
      const req = mockReq("POST", "/sessions/create", {
        title: "Tagged",
        config: { model: "gpt-4.1", backend: "copilot" },
        tags: ["test", "debug"],
        custom: { theme: "dark" },
      });
      const res = mockRes();
      await handler(req, res);

      expect(runtime.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ["test", "debug"],
          custom: { theme: "dark" },
        }),
      );
    });

    it("GET /sessions/:id returns session", async () => {
      const req = mockReq("GET", "/sessions/sess-1");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.getSession).toHaveBeenCalledWith("sess-1");
      expect(res._status).toBe(200);
    });

    it("GET /sessions/:id returns 404 for missing session", async () => {
      (runtime.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const req = mockReq("GET", "/sessions/nonexistent");
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(404);
      expect(JSON.parse(res._body)).toEqual({ error: "Not found" });
    });

    it("GET /sessions lists sessions", async () => {
      const req = mockReq("GET", "/sessions");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.listSessions).toHaveBeenCalled();
      expect(res._status).toBe(200);
      const body = JSON.parse(res._body);
      expect(Array.isArray(body)).toBe(true);
    });

    it("DELETE /sessions/:id deletes session", async () => {
      const req = mockReq("DELETE", "/sessions/sess-1");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.deleteSession).toHaveBeenCalledWith("sess-1");
      expect(res._status).toBe(200);
      expect(JSON.parse(res._body)).toEqual({ ok: true });
    });

    it("GET /sessions/:id/context-stats returns context stats", async () => {
      const stats = { totalTokens: 150, removedCount: 0, wasTruncated: false, availableBudget: 7850 };
      (runtime.getContextStats as ReturnType<typeof vi.fn>).mockReturnValue(stats);
      const req = mockReq("GET", "/sessions/sess-1/context-stats");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.getContextStats).toHaveBeenCalledWith("sess-1");
      expect(res._status).toBe(200);
      expect(JSON.parse(res._body)).toEqual(stats);
    });

    it("GET /sessions/:id/context-stats returns null when no stats", async () => {
      (runtime.getContextStats as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const req = mockReq("GET", "/sessions/sess-1/context-stats");
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      expect(JSON.parse(res._body)).toBeNull();
    });

    it("GET /sessions/:id decodes URI-encoded IDs", async () => {
      const req = mockReq("GET", "/sessions/a%20b%2Fc");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.getSession).toHaveBeenCalledWith("a b/c");
    });
  });

  describe("messaging routes", () => {
    it("POST /send returns 400 when no provider infra configured", async () => {
      const req = mockReq("POST", "/send", { sessionId: "sess-1", message: "Hello", model: "gpt-4.1" });
      const res = mockRes();
      await handler(req, res);

      // Without providerStore + tokenStore, backend/credentials can't be resolved
      expect(res._status).toBe(400);
    });

    it("POST /send accepts 'content' as alias for 'message' (returns 400 without provider infra)", async () => {
      const req = mockReq("POST", "/send", { sessionId: "sess-1", content: "Hi", model: "gpt-4.1" });
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
    });

    it("POST /send returns 400 when sessionId missing", async () => {
      const req = mockReq("POST", "/send", { message: "Hello" });
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(JSON.parse(res._body).error).toContain("required");
    });

    it("POST /send returns 400 when message missing", async () => {
      const req = mockReq("POST", "/send", { sessionId: "sess-1" });
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
    });

    it("POST /send returns 400 without model or provider infra", async () => {
      const req = mockReq("POST", "/send", { sessionId: "s", message: "Hi", model: "gpt-5" });
      const res = mockRes();
      await handler(req, res);

      // No provider infra → 400
      expect(res._status).toBe(400);
    });

    it("POST /send handles stream error gracefully (with provider infra)", async () => {
      (runtime.send as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          throw new Error("Stream broke");
        })(),
      );
      const providerStore = {
        get: vi.fn().mockResolvedValue({ id: "p1", backend: "copilot", model: "gpt-4.1", label: "Test", createdAt: 1 }),
        list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      };
      const tokenStore = {
        load: vi.fn().mockResolvedValue({ accessToken: "tok" }),
        save: vi.fn(), clear: vi.fn(), clearAll: vi.fn(), list: vi.fn(),
      };
      const h = createChatHandler(runtime, { providerStore, tokenStore });
      const req = mockReq("POST", "/send", { sessionId: "s", message: "Hi", providerId: "p1" });
      const res = mockRes();
      await h(req, res);

      expect(res._body).toContain("Stream broke");
      expect(res._ended).toBe(true);
    });

    it("POST /send returns 400 when no model available", async () => {
      const req = mockReq("POST", "/send", { sessionId: "s", message: "Hi" });
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(JSON.parse(res._body).error).toContain("model is required");
      expect(runtime.send).not.toHaveBeenCalled();
    });

    it("POST /abort calls runtime.abort()", async () => {
      const req = mockReq("POST", "/abort");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.abort).toHaveBeenCalled();
      expect(res._status).toBe(200);
    });
  });

  describe("model and backend routes", () => {
    it("GET /models returns model list", async () => {
      const req = mockReq("GET", "/models");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.listModels).toHaveBeenCalled();
      expect(res._status).toBe(200);
      const body = JSON.parse(res._body);
      expect(body).toEqual([{ id: "gpt-4.1", name: "GPT-4.1" }]);
    });

    it("GET /backends returns backend list", async () => {
      const req = mockReq("GET", "/backends");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.listBackends).toHaveBeenCalled();
      expect(res._status).toBe(200);
      const body = JSON.parse(res._body);
      expect(body).toEqual([
        { name: "copilot" },
        { name: "claude" },
      ]);
    });

    it("POST /backend/switch returns 404 (removed route)", async () => {
      const req = mockReq("POST", "/backend/switch", { backend: "claude" });
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(404);
    });

    it("POST /model/switch stores model in handler", async () => {
      const req = mockReq("POST", "/model/switch", { model: "gpt-5" });
      const res = mockRes();
      await handler(req, res);

      expect(JSON.parse(res._body)).toEqual({ ok: true });
    });

    it("POST /model/switch returns 400 when model missing", async () => {
      const req = mockReq("POST", "/model/switch", {});
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
    });
  });

  describe("error handling", () => {
    it("returns 404 for unknown routes", async () => {
      const req = mockReq("GET", "/unknown");
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(404);
    });

    it("returns 500 when runtime throws", async () => {
      (runtime.listModels as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Backend down"));
      const req = mockReq("GET", "/models");
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(500);
      expect(JSON.parse(res._body).error).toBe("Backend down");
    });
  });

  describe("prefix option", () => {
    it("strips prefix before matching routes", async () => {
      const prefixHandler = createChatHandler(runtime, { prefix: "/api/chat" });
      const req = mockReq("GET", "/api/chat/sessions");
      const res = mockRes();
      await prefixHandler(req, res);

      expect(runtime.listSessions).toHaveBeenCalled();
      expect(res._status).toBe(200);
    });

    it("all 10 routes work with prefix", async () => {
      const prefixHandler = createChatHandler(runtime, { prefix: "/api/chat" });

      // Session create
      const r1 = mockRes();
      await prefixHandler(mockReq("POST", "/api/chat/sessions/create", { title: "X" }), r1);
      expect(r1._status).toBe(200);

      // Session get
      const r2 = mockRes();
      await prefixHandler(mockReq("GET", "/api/chat/sessions/id-1"), r2);
      expect(r2._status).toBe(200);

      // Session list
      const r3 = mockRes();
      await prefixHandler(mockReq("GET", "/api/chat/sessions"), r3);
      expect(r3._status).toBe(200);

      // Session delete
      const r4 = mockRes();
      await prefixHandler(mockReq("DELETE", "/api/chat/sessions/id-1"), r4);
      expect(r4._status).toBe(200);

      // Send (returns 400 without provider infra)
      const r6 = mockRes();
      await prefixHandler(mockReq("POST", "/api/chat/send", { sessionId: "s", message: "Hi", model: "gpt-4.1" }), r6);
      expect(r6._status).toBe(400);

      // Abort
      const r7 = mockRes();
      await prefixHandler(mockReq("POST", "/api/chat/abort"), r7);
      expect(r7._status).toBe(200);

      // Models
      const r8 = mockRes();
      await prefixHandler(mockReq("GET", "/api/chat/models"), r8);
      expect(r8._status).toBe(200);

      // Backend switch (removed route)
      const r9 = mockRes();
      await prefixHandler(mockReq("POST", "/api/chat/backend/switch", { backend: "x" }), r9);
      expect(r9._status).toBe(404);

      // Model switch
      const r10 = mockRes();
      await prefixHandler(mockReq("POST", "/api/chat/model/switch", { model: "y" }), r10);
      expect(r10._status).toBe(200);
    });
  });

  describe("query string handling", () => {
    it("strips query string from URL before route matching", async () => {
      const req = mockReq("GET", "/sessions?foo=bar&baz=1");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.listSessions).toHaveBeenCalled();
      expect(res._status).toBe(200);
    });

    it("strips query string with prefix", async () => {
      const prefixHandler = createChatHandler(runtime, { prefix: "/api" });
      const req = mockReq("GET", "/api/models?v=2");
      const res = mockRes();
      await prefixHandler(req, res);

      expect(runtime.listModels).toHaveBeenCalled();
      expect(res._status).toBe(200);
    });

    it("strips query string from session ID routes", async () => {
      const req = mockReq("GET", "/sessions/id-1?fields=all");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.getSession).toHaveBeenCalledWith("id-1");
      expect(res._status).toBe(200);
    });
  });

  describe("body size limit", () => {
    it("returns 413 when body exceeds maxBodySize", async () => {
      const smallHandler = createChatHandler(runtime, { maxBodySize: 10 });
      // Body is larger than 10 bytes
      const req = mockReq("POST", "/sessions/create", { title: "This is a very long title that exceeds the limit" });
      const res = mockRes();
      await smallHandler(req, res);

      expect(res._status).toBe(413);
      expect(JSON.parse(res._body)).toEqual({ error: "Request body too large" });
    });

    it("returns 400 on malformed JSON body", async () => {
      const req = {
        method: "POST",
        url: "/sessions/create",
        on(event: string, listener: (arg?: unknown) => void) {
          if (event === "data") {
            queueMicrotask(() => listener(Buffer.from("not-valid-json{")));
          }
          if (event === "end") {
            queueMicrotask(() => listener());
          }
        },
      } as ReadableRequest;
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(JSON.parse(res._body)).toEqual({ error: "Invalid JSON in request body" });
    });
  });

  describe("provider routes", () => {
    let providerHandler: (req: ReadableRequest, res: WritableResponse) => Promise<void>;
    let store: import("../../../src/chat/server/provider-store.js").InMemoryProviderStore;

    beforeEach(async () => {
      const { InMemoryProviderStore } = await import("../../../src/chat/server/provider-store.js");
      store = new InMemoryProviderStore();
      providerHandler = createChatHandler(runtime, { providerStore: store });
    });

    it("GET /providers returns empty list", async () => {
      const req = mockReq("GET", "/providers");
      const res = mockRes();
      await providerHandler(req, res);
      expect(res._status).toBe(200);
      expect(JSON.parse(res._body)).toEqual([]);
    });

    it("POST /providers creates a provider", async () => {
      const req = mockReq("POST", "/providers", {
        backend: "copilot",
        model: "gpt-5-mini",
        label: "Test",
      });
      const res = mockRes();
      await providerHandler(req, res);
      expect(res._status).toBe(201);
      const body = JSON.parse(res._body);
      expect(body.backend).toBe("copilot");
      expect(body.model).toBe("gpt-5-mini");
      expect(body.label).toBe("Test");
      expect(body.id).toBeDefined();
    });

    it("POST /providers rejects missing model", async () => {
      const req = mockReq("POST", "/providers", { backend: "copilot" });
      const res = mockRes();
      await providerHandler(req, res);
      expect(res._status).toBe(400);
    });

    it("POST /providers rejects missing backend", async () => {
      const req = mockReq("POST", "/providers", { model: "gpt-5-mini", label: "X" });
      const res = mockRes();
      await providerHandler(req, res);
      expect(res._status).toBe(400);
    });

    it("GET /providers/:id retrieves a provider", async () => {
      await store.create({ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "P1", createdAt: Date.now() });
      const req = mockReq("GET", "/providers/p1");
      const res = mockRes();
      await providerHandler(req, res);
      expect(res._status).toBe(200);
      expect(JSON.parse(res._body).id).toBe("p1");
    });

    it("GET /providers/:id returns 404 for missing", async () => {
      const req = mockReq("GET", "/providers/nonexistent");
      const res = mockRes();
      await providerHandler(req, res);
      expect(res._status).toBe(404);
    });

    it("PUT /providers/:id updates a provider", async () => {
      await store.create({ id: "p2", backend: "copilot", model: "gpt-5-mini", label: "Old", createdAt: Date.now() });
      const req = mockReq("PUT", "/providers/p2", { label: "New" });
      const res = mockRes();
      await providerHandler(req, res);
      expect(res._status).toBe(200);
      expect(JSON.parse(res._body).label).toBe("New");
    });

    it("PUT /providers/:id returns 404 for missing", async () => {
      const req = mockReq("PUT", "/providers/missing", { label: "X" });
      const res = mockRes();
      await providerHandler(req, res);
      expect(res._status).toBe(404);
    });

    it("DELETE /providers/:id deletes a provider", async () => {
      await store.create({ id: "p3", backend: "copilot", model: "gpt-5-mini", label: "ToDelete", createdAt: Date.now() });
      const req = mockReq("DELETE", "/providers/p3");
      const res = mockRes();
      await providerHandler(req, res);
      expect(res._status).toBe(200);
      expect(JSON.parse(res._body)).toEqual({ ok: true });

      // Verify it's gone
      const getReq = mockReq("GET", "/providers/p3");
      const getRes = mockRes();
      await providerHandler(getReq, getRes);
      expect(getRes._status).toBe(404);
    });

    it("GET /providers lists all providers", async () => {
      await store.create({ id: "a", backend: "copilot", model: "m1", label: "A", createdAt: Date.now() });
      await store.create({ id: "b", backend: "claude", model: "m2", label: "B", createdAt: Date.now() });
      const req = mockReq("GET", "/providers");
      const res = mockRes();
      await providerHandler(req, res);
      expect(res._status).toBe(200);
      const list = JSON.parse(res._body);
      expect(list).toHaveLength(2);
    });
  });
});

// ─── corsMiddleware Tests ─────────────────────────────────────

describe("corsMiddleware", () => {
  it("sets CORS headers on normal requests", () => {
    const cors = corsMiddleware();
    const req = { method: "GET" };
    const res = mockRes();

    const handled = cors(req, res);

    expect(handled).toBe(false);
    expect(res._headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(res._headers["Access-Control-Allow-Methods"]).toContain("GET");
    expect(res._headers["Access-Control-Allow-Headers"]).toContain("Content-Type");
  });

  it("handles OPTIONS preflight and returns true", () => {
    const cors = corsMiddleware();
    const req = { method: "OPTIONS" };
    const res = mockRes();

    const handled = cors(req, res);

    expect(handled).toBe(true);
    expect(res._status).toBe(204);
    expect(res._ended).toBe(true);
    expect(res._headers["Access-Control-Max-Age"]).toBe("86400");
  });

  it("accepts custom origin", () => {
    const cors = corsMiddleware({ origin: "https://example.com" });
    const req = { method: "GET" };
    const res = mockRes();

    cors(req, res);

    expect(res._headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
  });

  it("accepts array of origins — matches request Origin header", () => {
    const cors = corsMiddleware({ origin: ["https://a.com", "https://b.com"] });
    const req = { method: "GET", headers: { origin: "https://b.com" } };
    const res = mockRes();

    cors(req, res);

    expect(res._headers["Access-Control-Allow-Origin"]).toBe("https://b.com");
    expect(res._headers["Vary"]).toBe("Origin");
  });

  it("accepts array of origins — falls back to first when no match", () => {
    const cors = corsMiddleware({ origin: ["https://a.com", "https://b.com"] });
    const req = { method: "GET", headers: { origin: "https://c.com" } };
    const res = mockRes();

    cors(req, res);

    expect(res._headers["Access-Control-Allow-Origin"]).toBe("https://a.com");
  });

  it("accepts custom methods and headers", () => {
    const cors = corsMiddleware({
      methods: ["GET", "POST"],
      headers: ["Content-Type", "X-Custom"],
    });
    const req = { method: "GET" };
    const res = mockRes();

    cors(req, res);

    expect(res._headers["Access-Control-Allow-Methods"]).toBe("GET, POST");
    expect(res._headers["Access-Control-Allow-Headers"]).toBe("Content-Type, X-Custom");
  });

  it("accepts custom maxAge", () => {
    const cors = corsMiddleware({ maxAge: 3600 });
    const req = { method: "OPTIONS" };
    const res = mockRes();

    cors(req, res);

    expect(res._headers["Access-Control-Max-Age"]).toBe("3600");
  });

  // ─── Edge cases ────────────────────────────────────────────

  it("array origin with missing headers on request falls back to first origin", () => {
    const cors = corsMiddleware({ origin: ["https://a.com", "https://b.com"] });
    const req = { method: "GET" }; // no headers at all
    const res = mockRes();

    cors(req, res);

    expect(res._headers["Access-Control-Allow-Origin"]).toBe("https://a.com");
    expect(res._headers["Vary"]).toBe("Origin");
  });

  it("array origin with non-string origin header falls back to first origin", () => {
    const cors = corsMiddleware({ origin: ["https://a.com", "https://b.com"] });
    const req = { method: "GET", headers: { origin: ["https://b.com"] as unknown as string } };
    const res = mockRes();

    cors(req, res);

    // origin is string[] not string — typeof check fails → falls back
    expect(res._headers["Access-Control-Allow-Origin"]).toBe("https://a.com");
  });

  it("request with undefined method is not treated as OPTIONS", () => {
    const cors = corsMiddleware();
    const req = {} as { method?: string };
    const res = mockRes();

    const handled = cors(req, res);

    expect(handled).toBe(false);
    expect(res._ended).toBe(false);
    expect(res._headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("empty origin array does not crash", () => {
    // Defensive: user passes empty array
    const cors = corsMiddleware({ origin: [] });
    const req = { method: "GET", headers: { origin: "https://x.com" } };
    const res = mockRes();

    cors(req, res);

    expect(res._headers["Access-Control-Allow-Origin"]).toBe(undefined);
    expect(res._headers["Vary"]).toBe("Origin");
  });
});

// ─── ChatServerHooks (new consolidated interface) ──────────────

describe("createChatHandler with ChatServerHooks", () => {
  let runtime: ReturnType<typeof mockRuntime>;
  beforeEach(() => { runtime = mockRuntime(); });

  describe("hooks.filterModels", () => {
    it("filters model list via hooks", async () => {
      runtime.listModels.mockResolvedValue([
        { id: "gpt-5-mini", name: "GPT 5 mini" },
        { id: "gpt-5", name: "GPT 5" },
      ]);
      const handler = createChatHandler(runtime, {
        hooks: { filterModels: (models) => models.filter(m => m.id === "gpt-5-mini") },
      });
      const req = mockReq("GET", "/models");
      const res = mockRes();
      await handler(req, res);
      const body = JSON.parse(res._body);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("gpt-5-mini");
    });

  });

  describe("hooks.onModelSwitch", () => {
    it("calls onModelSwitch and allows when no throw", async () => {
      const onModelSwitch = vi.fn();
      const handler = createChatHandler(runtime, {
        hooks: { onModelSwitch },
      });
      const req = mockReq("POST", "/model/switch", { model: "gpt-5-mini" });
      const res = mockRes();
      await handler(req, res);
      expect(onModelSwitch).toHaveBeenCalledWith("gpt-5-mini");
    });

    it("rejects with 403 when onModelSwitch throws", async () => {
      const handler = createChatHandler(runtime, {
        hooks: { onModelSwitch: () => { throw new Error("Forbidden model"); } },
      });
      const req = mockReq("POST", "/model/switch", { model: "gpt-5" });
      const res = mockRes();
      await handler(req, res);
      expect(res._status).toBe(403);
      expect(JSON.parse(res._body).error).toBe("Forbidden model");
    });

  });

  describe("hooks.onBackendSwitch (removed route)", () => {
    it("/backend/switch route returns 404 (removed)", async () => {
      const onBackendSwitch = vi.fn();
      const handler = createChatHandler(runtime, {
        hooks: { onBackendSwitch },
      });
      const req = mockReq("POST", "/backend/switch", { backend: "claude" });
      const res = mockRes();
      await handler(req, res);
      expect(res._status).toBe(404);
      expect(onBackendSwitch).not.toHaveBeenCalled();
    });
  });

  describe("hooks.onProviderSwitch", () => {
    it("calls onProviderSwitch with providerId and backend", async () => {
      const providerStore = {
        get: vi.fn().mockResolvedValue({ id: "p1", backend: "claude", model: "haiku", label: "test", createdAt: 1 }),
        list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      };
      const onProviderSwitch = vi.fn();
      const handler = createChatHandler(runtime, {
        providerStore,
        hooks: { onProviderSwitch },
      });
      const req = mockReq("POST", "/provider/switch", { providerId: "p1" });
      const res = mockRes();
      await handler(req, res);
      expect(onProviderSwitch).toHaveBeenCalledWith({ providerId: "p1", backend: "claude" });
    });
  });

  describe("hooks.onBeforeSend", () => {
    it("calls onBeforeSend before processing send", async () => {
      const onBeforeSend = vi.fn();
      runtime.send.mockReturnValue((async function* () {
        yield { type: "done", finalOutput: "test" };
      })());
      const handler = createChatHandler(runtime, {
        hooks: { onBeforeSend },
      });
      const req = mockReq("POST", "/send", { sessionId: "s1", message: "hello" });
      const res = mockRes();
      await handler(req, res);
      expect(onBeforeSend).toHaveBeenCalledWith("s1", "hello");
    });

    it("rejects with 403 when onBeforeSend throws", async () => {
      const handler = createChatHandler(runtime, {
        hooks: { onBeforeSend: () => { throw new Error("Rate limited"); } },
      });
      const req = mockReq("POST", "/send", { sessionId: "s1", message: "hello" });
      const res = mockRes();
      await handler(req, res);
      expect(res._status).toBe(403);
      expect(JSON.parse(res._body).error).toBe("Rate limited");
    });
  });

  describe("provider/switch stores model for subsequent send", () => {
    it("POST /provider/switch resolves provider and stores model in handler state", async () => {
      const { InMemoryProviderStore } = await import("../../../src/chat/server/provider-store.js");
      const providerStore = new InMemoryProviderStore();
      await providerStore.create({
        id: "p1", backend: "copilot", model: "gpt-5-mini", label: "Test", createdAt: Date.now(),
      });
      const tokenStore = {
        load: vi.fn().mockResolvedValue({ accessToken: "tok" }),
        save: vi.fn(), clear: vi.fn(), clearAll: vi.fn(), list: vi.fn(),
      };
      const handler = createChatHandler(runtime, { providerStore, tokenStore });

      // Switch to provider — stores model in handler state
      const switchReq = mockReq("POST", "/provider/switch", { providerId: "p1" });
      const switchRes = mockRes();
      await handler(switchReq, switchRes);
      expect(switchRes._status).toBe(200);

      // Send with providerId — should use stored model from provider
      const sendReq = mockReq("POST", "/send", { sessionId: "sess-1", message: "Hi", providerId: "p1" });
      const sendRes = mockRes();
      await handler(sendReq, sendRes);

      expect(sendRes._status).toBe(200);
      expect(runtime.send).toHaveBeenCalledWith("sess-1", "Hi", expect.objectContaining({ model: "gpt-5-mini" }));
    });
  });

  describe("hooks.onError", () => {
    it("calls onError when an unhandled error occurs", async () => {
      runtime.listModels.mockRejectedValue(new Error("DB crash"));
      const onError = vi.fn();
      const handler = createChatHandler(runtime, {
        hooks: { onError },
      });
      const req = mockReq("GET", "/models");
      const res = mockRes();
      await handler(req, res);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "DB crash" }),
        { route: "/models", method: "GET" },
      );
      expect(res._status).toBe(500);
    });
  });

  describe("transportFactory", () => {
    it("uses custom transport factory instead of SSEChatTransport", async () => {
      const sentEvents: ChatEvent[] = [];
      let closeCalled = false;
      let errorCalled = false;

      const customTransport = {
        isOpen: true,
        send(event: ChatEvent) { sentEvents.push(event); },
        error(_err: Error) { errorCalled = true; },
        close() { closeCalled = true; (customTransport as any).isOpen = false; },
      };

      const providerStore = {
        get: vi.fn().mockResolvedValue({ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "Test", createdAt: 1 }),
        list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      };
      const tokenStore = {
        load: vi.fn().mockResolvedValue({ accessToken: "tok" }),
        save: vi.fn(), clear: vi.fn(), clearAll: vi.fn(), list: vi.fn(),
      };

      const handler = createChatHandler(runtime, {
        transportFactory: (_req, _res) => customTransport as any,
        providerStore,
        tokenStore,
      });

      const sendReq = mockReq("POST", "/send", { sessionId: "sess-1", message: "Hi", providerId: "p1" });
      const sendRes = mockRes();
      await handler(sendReq, sendRes);

      // Custom transport should have received events + close
      expect(sentEvents.length).toBeGreaterThan(0);
      expect(closeCalled).toBe(true);
      expect(errorCalled).toBe(false);
    });
  });

  // ─── Route module imports ──────────────────────────────────────

  describe("route modules are independently importable", () => {
    it("sessionRoutes handles session create", async () => {
      const { sessionRoutes } = await import("../../../src/chat/server/routes/sessions.js");
      const rt = mockRuntime();
      const ctx = {
        runtime: rt,
        maxBodySize: 1_048_576,
        state: {},
      } as import("../../../src/chat/server/routes/types.js").RouteContext;

      const req = mockReq("POST", "/sessions/create", { title: "My Chat" });
      const res = mockRes();
      const handled = await sessionRoutes("POST", "/sessions/create", req, res, ctx);

      expect(handled).toBe(true);
      expect(rt.createSession).toHaveBeenCalled();
    });

    it("messageRoutes returns false for non-message paths", async () => {
      const { messageRoutes } = await import("../../../src/chat/server/routes/messages.js");
      const ctx = {
        runtime: mockRuntime(),
        maxBodySize: 1_048_576,
        state: {},
      } as import("../../../src/chat/server/routes/types.js").RouteContext;

      const req = mockReq("GET", "/sessions");
      const res = mockRes();
      const handled = await messageRoutes("GET", "/sessions", req, res, ctx);

      expect(handled).toBe(false);
    });

    it("configRoutes handles model switch (validation only, no state mutation)", async () => {
      const { configRoutes } = await import("../../../src/chat/server/routes/config.js");
      const ctx = {
        runtime: mockRuntime(),
        maxBodySize: 1_048_576,
        state: {},
      } as import("../../../src/chat/server/routes/types.js").RouteContext;

      const req = mockReq("POST", "/model/switch", { model: "gpt-5-mini" });
      const res = mockRes();
      const handled = await configRoutes("POST", "/model/switch", req, res, ctx);

      expect(handled).toBe(true);
    });

    it("providerRoutes returns false when no providerStore", async () => {
      const { providerRoutes } = await import("../../../src/chat/server/routes/providers.js");
      const ctx = {
        runtime: mockRuntime(),
        maxBodySize: 1_048_576,
        state: {},
      } as import("../../../src/chat/server/routes/types.js").RouteContext;

      const req = mockReq("GET", "/providers");
      const res = mockRes();
      const handled = await providerRoutes("GET", "/providers", req, res, ctx);

      expect(handled).toBe(false);
    });
  });

  describe("providerId-based /send", () => {
    it("resolves model from providerId when providerStore + tokenStore configured", async () => {
      runtime = mockRuntime();
      const providerStore = {
        get: vi.fn().mockResolvedValue({ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "Test", createdAt: Date.now() }),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      const tokenStore = {
        load: vi.fn().mockResolvedValue({ accessToken: "tok" }),
        save: vi.fn(),
        clear: vi.fn(),
        clearAll: vi.fn(),
        list: vi.fn(),
      };
      const handler = createChatHandler(runtime, { providerStore, tokenStore });

      const req = mockReq("POST", "/send", { sessionId: "s1", message: "Hello", providerId: "p1" });
      const res = mockRes();
      await handler(req, res);

      // Should have called send with the provider's model
      expect(runtime.send).toHaveBeenCalledWith("s1", "Hello", expect.objectContaining({ model: "gpt-5-mini" }));
    });

    it("returns 404 when providerId not found", async () => {
      runtime = mockRuntime();
      const providerStore = {
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      const tokenStore = {
        load: vi.fn(),
        save: vi.fn(),
        clear: vi.fn(),
        clearAll: vi.fn(),
        list: vi.fn(),
      };
      const handler = createChatHandler(runtime, { providerStore, tokenStore });

      const req = mockReq("POST", "/send", { sessionId: "s1", message: "Hello", providerId: "nonexistent" });
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(404);
      expect(JSON.parse(res._body).error).toContain("not found");
      expect(runtime.send).not.toHaveBeenCalled();
    });

    it("returns 401 when token not found for provider's backend", async () => {
      runtime = mockRuntime();
      const providerStore = {
        get: vi.fn().mockResolvedValue({ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "Test", createdAt: Date.now() }),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      const tokenStore = {
        load: vi.fn().mockResolvedValue(null),
        save: vi.fn(),
        clear: vi.fn(),
        clearAll: vi.fn(),
        list: vi.fn(),
      };
      const handler = createChatHandler(runtime, { providerStore, tokenStore });

      const req = mockReq("POST", "/send", { sessionId: "s1", message: "Hello", providerId: "p1" });
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(401);
      expect(JSON.parse(res._body).error).toContain("Authentication required");
      expect(runtime.send).not.toHaveBeenCalled();
    });

    it("returns 400 when providerId missing and providerStore+tokenStore configured", async () => {
      runtime = mockRuntime();
      const providerStore = {
        get: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      const tokenStore = {
        save: vi.fn(),
        load: vi.fn(),
        clear: vi.fn(),
        clearAll: vi.fn(),
        list: vi.fn(),
      };
      const handler = createChatHandler(runtime, { providerStore, tokenStore });

      const req = mockReq("POST", "/send", { sessionId: "s1", message: "Hello" });
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
    });

    it("returns 400 when no providerStore configured (backend/credentials missing)", async () => {
      runtime = mockRuntime();
      const handler = createChatHandler(runtime);

      // Switch model via handler state
      const switchReq = mockReq("POST", "/model/switch", { model: "gpt-4.1" });
      const switchRes = mockRes();
      await handler(switchReq, switchRes);

      const req = mockReq("POST", "/send", { sessionId: "s1", message: "Hello" });
      const res = mockRes();
      await handler(req, res);

      // Without providerStore, backend/credentials can't be resolved
      expect(res._status).toBe(400);
    });

    it("body.model overrides providerId model", async () => {
      runtime = mockRuntime();
      const providerStore = {
        get: vi.fn().mockResolvedValue({ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "Test", createdAt: Date.now() }),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      const tokenStore = {
        load: vi.fn().mockResolvedValue({ accessToken: "tok" }),
        save: vi.fn(),
        clear: vi.fn(),
        clearAll: vi.fn(),
        list: vi.fn(),
      };
      const handler = createChatHandler(runtime, { providerStore, tokenStore });

      const req = mockReq("POST", "/send", { sessionId: "s1", message: "Hello", providerId: "p1", model: "gpt-4.1" });
      const res = mockRes();
      await handler(req, res);

      // Explicit body.model should take precedence over provider's model
      expect(runtime.send).toHaveBeenCalledWith("s1", "Hello", expect.objectContaining({ model: "gpt-4.1" }));
    });

    it("passes backend and credentials through RuntimeSendOptions", async () => {
      runtime = mockRuntime();
      const providerStore = {
        get: vi.fn().mockResolvedValue({ id: "p1", backend: "claude", model: "claude-haiku", label: "Claude", createdAt: Date.now() }),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      const tokenStore = {
        load: vi.fn().mockResolvedValue({ accessToken: "tok" }),
        save: vi.fn(),
        clear: vi.fn(),
        clearAll: vi.fn(),
        list: vi.fn(),
      };
      const handler = createChatHandler(runtime, { providerStore, tokenStore });

      const req = mockReq("POST", "/send", { sessionId: "s1", message: "Hello", providerId: "p1" });
      const res = mockRes();
      await handler(req, res);

      expect(runtime.send).toHaveBeenCalledWith("s1", "Hello", expect.objectContaining({
        model: "claude-haiku",
        backend: "claude",
        credentials: { accessToken: "tok" },
      }));
    });
  });
});
