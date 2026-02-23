import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createChatServer } from "../../../src/chat/server/chat-server.js";
import type { IChatRuntime } from "../../../src/chat/runtime.js";
import type { ReadableRequest, WritableResponse } from "../../../src/chat/server/handler.js";
import { InMemoryTokenStore } from "../../../src/chat/server/token-store.js";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── Mock Helpers ──────────────────────────────────────────────

function mockRuntime(): IChatRuntime {
  return {
    status: "idle" as const,
    currentBackend: "copilot",
    currentModel: "gpt-5-mini",
    send: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn(),
    dispose: vi.fn(),
    createSession: vi.fn().mockResolvedValue({
      id: "s1",
      title: "Test",
      messages: [],
      config: { model: "gpt-5-mini", backend: "copilot" },
      metadata: { createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0 },
      status: "active",
    }),
    getSession: vi.fn().mockResolvedValue(null),
    listSessions: vi.fn().mockResolvedValue([]),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    archiveSession: vi.fn().mockResolvedValue(undefined),
    switchSession: vi.fn().mockResolvedValue(undefined),
    registerTool: vi.fn(),
    removeTool: vi.fn(),
    switchBackend: vi.fn(),
    switchModel: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
    use: vi.fn(),
    getContextStats: vi.fn().mockReturnValue(null),
  } as unknown as IChatRuntime;
}

function mockReq(method: string, url: string, body?: unknown): ReadableRequest & { headers?: Record<string, string | string[] | undefined> } {
  const bodyStr = body ? JSON.stringify(body) : "";
  return {
    method,
    url,
    headers: { origin: "http://localhost:3000" },
    on(event: string, listener: (...args: unknown[]) => void) {
      if (event === "data" && bodyStr) {
        (listener as (chunk: Buffer | string) => void)(bodyStr);
      }
      if (event === "end") {
        (listener as () => void)();
      }
    },
  };
}

function mockRes(): WritableResponse & { _status: number; _headers: Record<string, string>; _body: string; _chunks: string[] } {
  const state = {
    _status: 0,
    _headers: {} as Record<string, string>,
    _body: "",
    _chunks: [] as string[],
    _ended: false,
    get writableEnded() { return state._ended; },
    setHeader(name: string, value: string) { state._headers[name.toLowerCase()] = value; },
    writeHead(status: number, headers: Record<string, string> = {}) {
      state._status = status;
      Object.assign(state._headers, headers);
    },
    write(chunk: string) { state._chunks.push(chunk); return true; },
    end(body?: string) {
      if (body) state._body = body;
      state._ended = true;
    },
  };
  return state;
}

function parseBody(res: ReturnType<typeof mockRes>): unknown {
  return JSON.parse(res._body || res._chunks.join(""));
}

// ─── Tests ─────────────────────────────────────────────────────

describe("createChatServer", () => {
  describe("routing", () => {
    it("routes chat requests to chat handler", async () => {
      const runtime = mockRuntime();
      const handler = createChatServer({ runtime });
      const res = mockRes();
      await handler(mockReq("POST", "/api/chat/sessions/create", { title: "Test" }), res);
      expect(res._status).toBe(200);
      expect(runtime.createSession).toHaveBeenCalled();
    });

    it("routes auth requests to auth handler", async () => {
      const tokenStore = new InMemoryTokenStore();
      const runtime = mockRuntime();
      const handler = createChatServer({
        runtime,
        auth: { tokenStore },
      });
      const res = mockRes();
      await handler(mockReq("GET", "/api/auth/tokens/saved"), res);
      expect(res._status).toBe(200);
    });

    it("returns 404 for unknown routes", async () => {
      const runtime = mockRuntime();
      const handler = createChatServer({ runtime });
      const res = mockRes();
      await handler(mockReq("GET", "/unknown"), res);
      expect(res._status).toBe(404);
    });

    it("does not mount auth when auth option is not provided", async () => {
      const runtime = mockRuntime();
      const handler = createChatServer({ runtime });
      const res = mockRes();
      await handler(mockReq("GET", "/api/auth/tokens/saved"), res);
      expect(res._status).toBe(404);
    });
  });

  describe("custom prefixes", () => {
    it("uses custom chat prefix", async () => {
      const runtime = mockRuntime();
      const handler = createChatServer({ runtime, chatPrefix: "/chat" });
      const res = mockRes();
      await handler(mockReq("POST", "/chat/sessions/create", { title: "Test" }), res);
      expect(res._status).toBe(200);
      expect(runtime.createSession).toHaveBeenCalled();
    });

    it("uses custom auth prefix", async () => {
      const tokenStore = new InMemoryTokenStore();
      const runtime = mockRuntime();
      const handler = createChatServer({
        runtime,
        auth: { tokenStore },
        authPrefix: "/auth",
      });
      const res = mockRes();
      await handler(mockReq("GET", "/auth/tokens/saved"), res);
      expect(res._status).toBe(200);
    });
  });

  describe("CORS", () => {
    it("handles OPTIONS preflight", async () => {
      const runtime = mockRuntime();
      const handler = createChatServer({ runtime });
      const res = mockRes();
      await handler(mockReq("OPTIONS", "/api/chat/sessions"), res);
      expect(res._status).toBe(204);
    });

    it("can disable CORS", async () => {
      const runtime = mockRuntime();
      const handler = createChatServer({ runtime, cors: false });
      const res = mockRes();
      // OPTIONS without CORS should fall through to 404
      await handler(mockReq("OPTIONS", "/anything"), res);
      expect(res._status).toBe(404);
    });
  });

  describe("static file serving", () => {
    const testDir = path.join(__dirname, "__test_static__");

    beforeEach(() => {
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, "index.html"), "<html>hi</html>");
      fs.writeFileSync(path.join(testDir, "style.css"), "body{}");
    });

    afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("serves index.html for root path", async () => {
      const runtime = mockRuntime();
      const handler = createChatServer({
        runtime,
        staticDir: testDir,
        chatPrefix: "/api/chat",
      });
      const res = mockRes();
      await handler(mockReq("GET", "/"), res);
      expect(res._status).toBe(200);
      expect(res._headers["Content-Type"]).toBe("text/html");
      expect(res._chunks.join("")).toContain("<html>hi</html>");
    });

    it("serves CSS with correct MIME type", async () => {
      const runtime = mockRuntime();
      const handler = createChatServer({
        runtime,
        staticDir: testDir,
        chatPrefix: "/api/chat",
      });
      const res = mockRes();
      await handler(mockReq("GET", "/style.css"), res);
      expect(res._status).toBe(200);
      expect(res._headers["Content-Type"]).toBe("text/css");
    });

    it("returns 404 for non-existent files", async () => {
      const runtime = mockRuntime();
      const handler = createChatServer({
        runtime,
        staticDir: testDir,
        chatPrefix: "/api/chat",
      });
      const res = mockRes();
      await handler(mockReq("GET", "/nonexistent.txt"), res);
      expect(res._status).toBe(404);
    });

    it("prevents directory traversal", async () => {
      const runtime = mockRuntime();
      const handler = createChatServer({
        runtime,
        staticDir: testDir,
        chatPrefix: "/api/chat",
      });
      const res = mockRes();
      await handler(mockReq("GET", "/../../../etc/passwd"), res);
      // Should either 403 or 404, but NOT serve the file
      expect(res._status).toBeGreaterThanOrEqual(403);
    });

    it("prevents sibling-prefix directory traversal (CWE-22)", async () => {
      // If staticDir = /path/__test_static__, a request that resolves to
      // /path/__test_static__-secrets/secret.txt must NOT be served.
      // The attack: /../__test_static__-secrets/secret.txt traverses UP then into sibling.
      const siblingDir = testDir + "-secrets";
      fs.mkdirSync(siblingDir, { recursive: true });
      fs.writeFileSync(path.join(siblingDir, "secret.txt"), "top-secret");
      try {
        const runtime = mockRuntime();
        const handler = createChatServer({
          runtime,
          staticDir: testDir,
          chatPrefix: "/api/chat",
        });
        const res = mockRes();
        const basename = path.basename(testDir);
        // Traverse up from staticDir then into sibling directory
        await handler(mockReq("GET", `/../${basename}-secrets/secret.txt`), res);
        // Must NOT serve the sibling file
        expect(res._chunks.join("")).not.toContain("top-secret");
        expect(res._status).toBeGreaterThanOrEqual(403);
      } finally {
        fs.rmSync(siblingDir, { recursive: true, force: true });
      }
    });
  });
});
