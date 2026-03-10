/**
 * Tests for createAuthHandler and token store implementations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReadableRequest, WritableResponse } from "../../../src/chat/server/handler.js";
import { createAuthHandler } from "../../../src/chat/server/auth-handler.js";
import type {
  AuthHandlerOptions,
  ICopilotAuth,
  IClaudeAuth,
} from "../../../src/chat/server/auth-handler.js";
import { InMemoryTokenStore } from "../../../src/chat/server/token-store.js";
import type { ITokenStore } from "../../../src/chat/server/token-store.js";
import type { CopilotAuthToken, ClaudeAuthToken, AuthToken } from "../../../src/auth/types.js";

// ─── Mock Helpers ──────────────────────────────────────────────

function mockReq(method: string, url: string, body?: Record<string, unknown>): ReadableRequest {
  const bodyStr = body ? JSON.stringify(body) : "";
  return {
    method,
    url,
    on(event: string, listener: (chunk?: Buffer | string) => void): void {
      if (event === "data" && bodyStr) {
        listener(Buffer.from(bodyStr));
      }
      if (event === "end") {
        listener();
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
    _status: 200,
    _headers: {} as Record<string, string>,
    _body: "",
    _ended: false,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
      return res;
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
  };
  return res;
}

function parseBody(res: { _body: string }): Record<string, unknown> {
  return JSON.parse(res._body) as Record<string, unknown>;
}

const COPILOT_TOKEN: CopilotAuthToken = {
  accessToken: "gho_test123",
  tokenType: "bearer",
  obtainedAt: 1000,
  login: "testuser",
};

const CLAUDE_TOKEN: ClaudeAuthToken = {
  accessToken: "sk-ant-test",
  tokenType: "bearer",
  expiresIn: 28800,
  obtainedAt: 1000,
  refreshToken: "sk-ant-rt-test",
  scopes: ["user:inference"],
};

function mockCopilotAuth(): ICopilotAuth {
  return {
    startDeviceFlow: vi.fn().mockResolvedValue({
      userCode: "ABCD-1234",
      verificationUrl: "https://github.com/login/device",
      waitForToken: vi.fn().mockResolvedValue(COPILOT_TOKEN),
    }),
  };
}

function mockClaudeAuth(): IClaudeAuth {
  return {
    startOAuthFlow: vi.fn().mockReturnValue({
      authorizeUrl: "https://claude.ai/oauth/authorize?client_id=test",
      completeAuth: vi.fn().mockResolvedValue(CLAUDE_TOKEN),
    }),
  };
}

function makeHandler(overrides?: Partial<AuthHandlerOptions>) {
  const tokenStore = new InMemoryTokenStore();
  const opts: AuthHandlerOptions = {
    tokenStore,
    createCopilotAuth: () => mockCopilotAuth(),
    createClaudeAuth: () => mockClaudeAuth(),
    ...overrides,
    ...(overrides?.tokenStore ? {} : { tokenStore }),
  };
  return { handler: createAuthHandler(opts), tokenStore: opts.tokenStore as ITokenStore };
}

// ─── Auth Start ────────────────────────────────────────────────

describe("createAuthHandler", () => {
  describe("POST /auth/start", () => {
    it("starts copilot device flow", async () => {
      const { handler } = makeHandler();
      const req = mockReq("POST", "/auth/start", { provider: "copilot" });
      const res = mockRes();
      await handler(req, res);
      expect(res._status).toBe(200);
      const body = parseBody(res);
      expect(body.userCode).toBe("ABCD-1234");
      expect(body.verificationUrl).toBe("https://github.com/login/device");
    });

    it("starts claude OAuth flow", async () => {
      const { handler } = makeHandler();
      const req = mockReq("POST", "/auth/start", { provider: "claude" });
      const res = mockRes();
      await handler(req, res);
      expect(res._status).toBe(200);
      const body = parseBody(res);
      expect(body.authorizeUrl).toContain("claude.ai/oauth/authorize");
    });

    it("returns ready for vercel-ai", async () => {
      const { handler } = makeHandler();
      const req = mockReq("POST", "/auth/start", { provider: "vercel-ai" });
      const res = mockRes();
      await handler(req, res);
      expect(res._status).toBe(200);
      expect(parseBody(res)).toEqual({ ready: true });
    });

    it("returns 400 for missing provider", async () => {
      const { handler } = makeHandler();
      const req = mockReq("POST", "/auth/start", {});
      const res = mockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
      expect(parseBody(res).error).toContain("provider is required");
    });

    it("returns 400 for invalid provider", async () => {
      const { handler } = makeHandler();
      const req = mockReq("POST", "/auth/start", { provider: "unknown" });
      const res = mockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
    });

    it("returns 400 when copilot auth not configured", async () => {
      const { handler } = makeHandler({ createCopilotAuth: undefined });
      const req = mockReq("POST", "/auth/start", { provider: "copilot" });
      const res = mockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
      expect(parseBody(res).error).toContain("not configured");
    });

    it("returns 400 when claude auth not configured", async () => {
      const { handler } = makeHandler({ createClaudeAuth: undefined });
      const req = mockReq("POST", "/auth/start", { provider: "claude" });
      const res = mockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
      expect(parseBody(res).error).toContain("not configured");
    });
  });

  // ─── Copilot Poll ──────────────────────────────────────────────

  describe("POST /auth/copilot/poll", () => {
    it("polls and saves copilot token", async () => {
      const { handler, tokenStore } = makeHandler();
      // Start flow first
      await handler(mockReq("POST", "/auth/start", { provider: "copilot" }), mockRes());
      // Poll
      const res = mockRes();
      await handler(mockReq("POST", "/auth/copilot/poll"), res);
      expect(res._status).toBe(200);
      const body = parseBody(res);
      expect(body.ok).toBe(true);
      expect(body.login).toBe("testuser");
      // Token saved
      const saved = await tokenStore.load("copilot");
      expect(saved?.accessToken).toBe("gho_test123");
    });

    it("returns 400 when no active flow", async () => {
      const { handler } = makeHandler();
      const res = mockRes();
      await handler(mockReq("POST", "/auth/copilot/poll"), res);
      expect(res._status).toBe(400);
      expect(parseBody(res).error).toContain("No active Copilot flow");
    });

    it("calls onAuth callback after copilot poll", async () => {
      const onAuth = vi.fn();
      const { handler } = makeHandler({ onAuth });
      await handler(mockReq("POST", "/auth/start", { provider: "copilot" }), mockRes());
      await handler(mockReq("POST", "/auth/copilot/poll"), mockRes());
      expect(onAuth).toHaveBeenCalledWith("copilot", expect.objectContaining({ accessToken: "gho_test123" }));
    });
  });

  // ─── Claude Complete ───────────────────────────────────────────

  describe("POST /auth/claude/complete", () => {
    it("completes and saves claude token", async () => {
      const { handler, tokenStore } = makeHandler();
      await handler(mockReq("POST", "/auth/start", { provider: "claude" }), mockRes());
      const res = mockRes();
      await handler(mockReq("POST", "/auth/claude/complete", { code: "auth-code-123" }), res);
      expect(res._status).toBe(200);
      expect(parseBody(res).ok).toBe(true);
      const saved = await tokenStore.load("claude");
      expect(saved?.accessToken).toBe("sk-ant-test");
    });

    it("returns 400 when no active flow", async () => {
      const { handler } = makeHandler();
      const res = mockRes();
      await handler(mockReq("POST", "/auth/claude/complete", { code: "abc" }), res);
      expect(res._status).toBe(400);
      expect(parseBody(res).error).toContain("No active Claude flow");
    });

    it("returns 400 when code is missing", async () => {
      const { handler } = makeHandler();
      await handler(mockReq("POST", "/auth/start", { provider: "claude" }), mockRes());
      const res = mockRes();
      await handler(mockReq("POST", "/auth/claude/complete", {}), res);
      expect(res._status).toBe(400);
      expect(parseBody(res).error).toContain("code is required");
    });

    it("calls onAuth callback after claude complete", async () => {
      const onAuth = vi.fn();
      const { handler } = makeHandler({ onAuth });
      await handler(mockReq("POST", "/auth/start", { provider: "claude" }), mockRes());
      await handler(mockReq("POST", "/auth/claude/complete", { code: "abc" }), mockRes());
      expect(onAuth).toHaveBeenCalledWith("claude", expect.objectContaining({ accessToken: "sk-ant-test" }));
    });
  });

  // ─── Vercel Complete ───────────────────────────────────────────

  describe("POST /auth/vercel/complete", () => {
    it("saves vercel-ai token", async () => {
      const { handler, tokenStore } = makeHandler();
      const res = mockRes();
      await handler(mockReq("POST", "/auth/vercel/complete", { apiKey: "sk-test" }), res);
      expect(res._status).toBe(200);
      expect(parseBody(res).ok).toBe(true);
      const saved = await tokenStore.load("vercel-ai");
      expect(saved?.accessToken).toBe("sk-test");
    });

    it("preserves baseUrl in stored token", async () => {
      const { handler, tokenStore } = makeHandler();
      await handler(
        mockReq("POST", "/auth/vercel/complete", { apiKey: "sk-test", baseUrl: "https://custom.api/v1" }),
        mockRes(),
      );
      const saved = await tokenStore.load("vercel-ai") as Record<string, unknown>;
      expect(saved.baseUrl).toBe("https://custom.api/v1");
    });

    it("returns 400 when apiKey is missing", async () => {
      const { handler } = makeHandler();
      const res = mockRes();
      await handler(mockReq("POST", "/auth/vercel/complete", {}), res);
      expect(res._status).toBe(400);
      expect(parseBody(res).error).toContain("apiKey is required");
    });

    it("calls onAuth callback", async () => {
      const onAuth = vi.fn();
      const { handler } = makeHandler({ onAuth });
      await handler(mockReq("POST", "/auth/vercel/complete", { apiKey: "sk-test" }), mockRes());
      expect(onAuth).toHaveBeenCalledWith("vercel-ai", expect.objectContaining({ accessToken: "sk-test" }));
    });

    it("passes baseUrl to onAuth callback when provided", async () => {
      const onAuth = vi.fn();
      const { handler } = makeHandler({ onAuth });
      await handler(
        mockReq("POST", "/auth/vercel/complete", { apiKey: "sk-test", baseUrl: "https://custom.api/v1" }),
        mockRes(),
      );
      const receivedToken = onAuth.mock.calls[0][1] as Record<string, unknown>;
      expect(receivedToken.baseUrl).toBe("https://custom.api/v1");
    });
  });

  // ─── Dispose ───────────────────────────────────────────────────

  describe("POST /auth/dispose", () => {
    it("returns ok", async () => {
      const { handler } = makeHandler();
      const res = mockRes();
      await handler(mockReq("POST", "/auth/dispose"), res);
      expect(res._status).toBe(200);
      expect(parseBody(res)).toEqual({ ok: true });
    });

    it("clears pending flows", async () => {
      const { handler } = makeHandler();
      // Start copilot flow
      await handler(mockReq("POST", "/auth/start", { provider: "copilot" }), mockRes());
      // Dispose
      await handler(mockReq("POST", "/auth/dispose"), mockRes());
      // Poll should fail (flow cleared)
      const res = mockRes();
      await handler(mockReq("POST", "/auth/copilot/poll"), res);
      expect(res._status).toBe(400);
    });

    it("calls onLogout callback", async () => {
      const onLogout = vi.fn();
      const tokenStore = new InMemoryTokenStore();
      const handler = createAuthHandler({ tokenStore, onLogout });
      const res = mockRes();
      await handler(mockReq("POST", "/auth/dispose"), res);
      expect(onLogout).toHaveBeenCalledOnce();
    });
  });

  // ─── Token Management ──────────────────────────────────────────

  describe("GET /tokens/saved", () => {
    it("returns empty list when no tokens", async () => {
      const { handler } = makeHandler();
      const res = mockRes();
      await handler(mockReq("GET", "/tokens/saved"), res);
      expect(res._status).toBe(200);
      expect(parseBody(res)).toEqual({ saved: [] });
    });

    it("returns providers with saved tokens", async () => {
      const tokenStore = new InMemoryTokenStore();
      await tokenStore.save("copilot", COPILOT_TOKEN);
      await tokenStore.save("claude", CLAUDE_TOKEN);
      const { handler } = makeHandler({ tokenStore });
      const res = mockRes();
      await handler(mockReq("GET", "/tokens/saved"), res);
      const body = parseBody(res);
      expect((body.saved as string[]).sort()).toEqual(["claude", "copilot"]);
    });
  });

  describe("POST /tokens/use", () => {
    it("activates a saved token", async () => {
      const onAuth = vi.fn();
      const tokenStore = new InMemoryTokenStore();
      await tokenStore.save("copilot", COPILOT_TOKEN);
      const { handler } = makeHandler({ tokenStore, onAuth });
      const res = mockRes();
      await handler(mockReq("POST", "/tokens/use", { provider: "copilot" }), res);
      expect(res._status).toBe(200);
      expect(parseBody(res)).toEqual({ ok: true, provider: "copilot" });
      expect(onAuth).toHaveBeenCalledWith("copilot", expect.objectContaining({ accessToken: "gho_test123" }));
    });

    it("returns 404 when no saved token", async () => {
      const { handler } = makeHandler();
      const res = mockRes();
      await handler(mockReq("POST", "/tokens/use", { provider: "copilot" }), res);
      expect(res._status).toBe(404);
    });

    it("returns 400 for missing provider", async () => {
      const { handler } = makeHandler();
      const res = mockRes();
      await handler(mockReq("POST", "/tokens/use", {}), res);
      expect(res._status).toBe(400);
    });
  });

  describe("POST /tokens/clear", () => {
    it("clears all tokens", async () => {
      const tokenStore = new InMemoryTokenStore();
      await tokenStore.save("copilot", COPILOT_TOKEN);
      await tokenStore.save("claude", CLAUDE_TOKEN);
      const { handler } = makeHandler({ tokenStore });
      const res = mockRes();
      await handler(mockReq("POST", "/tokens/clear"), res);
      expect(res._status).toBe(200);
      expect(parseBody(res)).toEqual({ ok: true });
      expect(await tokenStore.list()).toEqual([]);
    });

    it("calls onLogout when clearing tokens", async () => {
      const onLogout = vi.fn();
      const { handler } = makeHandler({ onLogout });
      const res = mockRes();
      await handler(mockReq("POST", "/tokens/clear"), res);
      expect(res._status).toBe(200);
      expect(onLogout).toHaveBeenCalledOnce();
    });
  });

  // ─── Route prefix ──────────────────────────────────────────────

  describe("prefix support", () => {
    it("strips prefix before route matching", async () => {
      const tokenStore = new InMemoryTokenStore();
      const handler = createAuthHandler({ tokenStore, prefix: "/api/auth" });
      const res = mockRes();
      await handler(mockReq("GET", "/api/auth/tokens/saved"), res);
      expect(res._status).toBe(200);
      expect(parseBody(res)).toEqual({ saved: [] });
    });
  });

  // ─── 404 ───────────────────────────────────────────────────────

  describe("unknown routes", () => {
    it("returns 404 for unknown path", async () => {
      const { handler } = makeHandler();
      const res = mockRes();
      await handler(mockReq("GET", "/unknown"), res);
      expect(res._status).toBe(404);
    });
  });

  // ─── Error handling ────────────────────────────────────────────

  describe("error handling", () => {
    it("returns 500 on unexpected error", async () => {
      const copilotAuth: ICopilotAuth = {
        startDeviceFlow: vi.fn().mockRejectedValue(new Error("Network fail")),
      };
      const { handler } = makeHandler({ createCopilotAuth: () => copilotAuth });
      const res = mockRes();
      await handler(mockReq("POST", "/auth/start", { provider: "copilot" }), res);
      expect(res._status).toBe(500);
      expect(parseBody(res).error).toContain("Network fail");
    });
  });

  // ─── Query string stripping ────────────────────────────────────

  describe("query string handling", () => {
    it("strips query string before route matching", async () => {
      const { handler } = makeHandler();
      const res = mockRes();
      await handler(mockReq("GET", "/tokens/saved?_t=123"), res);
      expect(res._status).toBe(200);
    });
  });

  // ─── New flow clears pending state ─────────────────────────────

  describe("flow isolation", () => {
    it("starting new flow clears pending copilot flow", async () => {
      const { handler } = makeHandler();
      // Start copilot
      await handler(mockReq("POST", "/auth/start", { provider: "copilot" }), mockRes());
      // Start claude (clears copilot)
      await handler(mockReq("POST", "/auth/start", { provider: "claude" }), mockRes());
      // Copilot poll should fail
      const res = mockRes();
      await handler(mockReq("POST", "/auth/copilot/poll"), res);
      expect(res._status).toBe(400);
    });
  });
});

// ─── InMemoryTokenStore ──────────────────────────────────────────

describe("InMemoryTokenStore", () => {
  let store: InMemoryTokenStore;

  beforeEach(() => {
    store = new InMemoryTokenStore();
  });

  it("save and load", async () => {
    await store.save("copilot", COPILOT_TOKEN);
    const loaded = await store.load("copilot");
    expect(loaded?.accessToken).toBe("gho_test123");
  });

  it("returns null for missing token", async () => {
    expect(await store.load("nonexistent")).toBeNull();
  });

  it("clear removes specific token", async () => {
    await store.save("copilot", COPILOT_TOKEN);
    await store.save("claude", CLAUDE_TOKEN);
    await store.clear("copilot");
    expect(await store.load("copilot")).toBeNull();
    expect(await store.load("claude")).not.toBeNull();
  });

  it("clearAll removes all tokens", async () => {
    await store.save("copilot", COPILOT_TOKEN);
    await store.save("claude", CLAUDE_TOKEN);
    await store.clearAll();
    expect(await store.list()).toEqual([]);
  });

  it("list returns provider names", async () => {
    await store.save("copilot", COPILOT_TOKEN);
    await store.save("vercel-ai", { accessToken: "k", tokenType: "bearer", obtainedAt: 0 });
    const list = await store.list();
    expect(list.sort()).toEqual(["copilot", "vercel-ai"]);
  });

  it("save overwrites existing", async () => {
    await store.save("copilot", COPILOT_TOKEN);
    await store.save("copilot", { ...COPILOT_TOKEN, accessToken: "new-token" });
    const loaded = await store.load("copilot");
    expect(loaded?.accessToken).toBe("new-token");
  });

  it("load returns a copy (not a reference)", async () => {
    await store.save("copilot", COPILOT_TOKEN);
    const a = await store.load("copilot");
    const b = await store.load("copilot");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
