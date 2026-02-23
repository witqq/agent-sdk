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
    archiveSession: vi.fn().mockResolvedValue(undefined),
    switchSession: vi.fn().mockResolvedValue(mockSession()),
    activeSessionId: null,
    send: vi.fn().mockReturnValue((async function* () {
      yield { type: "message:delta", text: "Hello" } as ChatEvent;
    })()),
    abort: vi.fn(),
    switchBackend: vi.fn().mockResolvedValue(undefined),
    switchModel: vi.fn(),
    listModels: vi.fn().mockResolvedValue([{ id: "gpt-4.1", name: "GPT-4.1" }]),
    currentBackend: "copilot",
    currentModel: "gpt-4.1",
    registerTool: vi.fn(),
    removeTool: vi.fn(),
    registeredTools: new Map(),
    use: vi.fn(),
    removeMiddleware: vi.fn(),
    getContextStats: vi.fn().mockReturnValue(null),
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
          config: { model: "gpt-4.1", backend: "copilot" },
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

    it("POST /sessions/:id/archive archives session", async () => {
      const req = mockReq("POST", "/sessions/sess-1/archive");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.archiveSession).toHaveBeenCalledWith("sess-1");
      expect(res._status).toBe(200);
      expect(JSON.parse(res._body)).toEqual({ ok: true });
    });

    it("GET /sessions/:id decodes URI-encoded IDs", async () => {
      const req = mockReq("GET", "/sessions/a%20b%2Fc");
      const res = mockRes();
      await handler(req, res);

      expect(runtime.getSession).toHaveBeenCalledWith("a b/c");
    });
  });

  describe("messaging routes", () => {
    it("POST /send streams SSE events", async () => {
      const req = mockReq("POST", "/send", { sessionId: "sess-1", message: "Hello" });
      const res = mockRes();
      await handler(req, res);

      expect(runtime.send).toHaveBeenCalledWith("sess-1", "Hello", undefined);
      expect(res._status).toBe(200);
      expect(res._headers["Content-Type"]).toBe("text/event-stream");
      expect(res._body).toContain("data:");
      expect(res._body).toContain("[DONE]");
    });

    it("POST /send accepts 'content' as alias for 'message'", async () => {
      const req = mockReq("POST", "/send", { sessionId: "sess-1", content: "Hi" });
      const res = mockRes();
      await handler(req, res);

      expect(runtime.send).toHaveBeenCalledWith("sess-1", "Hi", undefined);
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

    it("POST /send forwards model option", async () => {
      const req = mockReq("POST", "/send", { sessionId: "s", message: "Hi", model: "gpt-5" });
      const res = mockRes();
      await handler(req, res);

      expect(runtime.send).toHaveBeenCalledWith("s", "Hi", { model: "gpt-5" });
    });

    it("POST /send handles stream error gracefully", async () => {
      (runtime.send as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          throw new Error("Stream broke");
        })(),
      );
      const req = mockReq("POST", "/send", { sessionId: "s", message: "Hi" });
      const res = mockRes();
      await handler(req, res);

      expect(res._body).toContain("Stream broke");
      expect(res._ended).toBe(true);
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

    it("POST /backend/switch calls runtime.switchBackend()", async () => {
      const req = mockReq("POST", "/backend/switch", { backend: "claude" });
      const res = mockRes();
      await handler(req, res);

      expect(runtime.switchBackend).toHaveBeenCalledWith("claude");
      expect(JSON.parse(res._body)).toEqual({ ok: true });
    });

    it("POST /model/switch calls runtime.switchModel()", async () => {
      const req = mockReq("POST", "/model/switch", { model: "gpt-5" });
      const res = mockRes();
      await handler(req, res);

      expect(runtime.switchModel).toHaveBeenCalledWith("gpt-5");
      expect(JSON.parse(res._body)).toEqual({ ok: true });
    });

    it("POST /backend/switch returns 400 when backend missing", async () => {
      const req = mockReq("POST", "/backend/switch", {});
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(runtime.switchBackend).not.toHaveBeenCalled();
    });

    it("POST /model/switch returns 400 when model missing", async () => {
      const req = mockReq("POST", "/model/switch", {});
      const res = mockRes();
      await handler(req, res);

      expect(res._status).toBe(400);
      expect(runtime.switchModel).not.toHaveBeenCalled();
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

      // Session archive
      const r5 = mockRes();
      await prefixHandler(mockReq("POST", "/api/chat/sessions/id-1/archive"), r5);
      expect(r5._status).toBe(200);

      // Send
      const r6 = mockRes();
      await prefixHandler(mockReq("POST", "/api/chat/send", { sessionId: "s", message: "Hi" }), r6);
      expect(r6._status).toBe(200);

      // Abort
      const r7 = mockRes();
      await prefixHandler(mockReq("POST", "/api/chat/abort"), r7);
      expect(r7._status).toBe(200);

      // Models
      const r8 = mockRes();
      await prefixHandler(mockReq("GET", "/api/chat/models"), r8);
      expect(r8._status).toBe(200);

      // Backend switch
      const r9 = mockRes();
      await prefixHandler(mockReq("POST", "/api/chat/backend/switch", { backend: "x" }), r9);
      expect(r9._status).toBe(200);

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
