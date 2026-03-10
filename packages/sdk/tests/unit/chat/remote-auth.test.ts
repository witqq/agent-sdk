/**
 * @vitest-environment jsdom
 */

/**
 * Tests for useRemoteAuth — server-delegated authentication hook.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRemoteAuth } from "../../../src/chat/react/useRemoteAuth.js";
import type { UseRemoteAuthOptions } from "../../../src/chat/react/useRemoteAuth.js";

function createMockFetch(responses: Record<string, unknown>) {
  return vi.fn(async (url: string, _opts?: RequestInit) => {
    const path = new URL(url, "http://test").pathname;
    // Find matching response by path suffix
    for (const [key, value] of Object.entries(responses)) {
      if (path.endsWith(key)) {
        return {
          ok: true,
          json: async () => value,
        } as Response;
      }
    }
    return {
      ok: false,
      json: async () => ({ error: "Not found" }),
    } as Response;
  });
}

function createErrorFetch(errorMsg: string) {
  return vi.fn(async () => ({
    ok: false,
    json: async () => ({ error: errorMsg }),
  })) as unknown as typeof globalThis.fetch;
}

describe("useRemoteAuth", () => {
  let baseOptions: Omit<UseRemoteAuthOptions, "fetch">;

  beforeEach(() => {
    baseOptions = {
      backend: "copilot",
      baseUrl: "http://test/api/auth",
    };
  });

  it("starts in idle state", () => {
    const mockFetch = createMockFetch({});
    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, fetch: mockFetch }),
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBeNull();
  });

  // ─── Copilot Device Flow ─────────────────────────────────

  it("copilot: starts device flow via server", async () => {
    const mockFetch = createMockFetch({
      "/auth/start": { userCode: "ABCD-1234", verificationUrl: "https://github.com/login/device" },
      "/auth/copilot/poll": { ok: true, login: "testuser" },
    });
    const onAuth = vi.fn();

    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, fetch: mockFetch, onAuthenticated: onAuth }),
    );

    await act(async () => {
      await result.current.startDeviceFlow();
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.deviceCode).toBe("ABCD-1234");
    expect(result.current.verificationUrl).toBe("https://github.com/login/device");
    expect(result.current.token).not.toBeNull();
    expect(onAuth).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("copilot: handles start error", async () => {
    const mockFetch = createErrorFetch("Copilot auth not configured");

    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, fetch: mockFetch }),
    );

    await act(async () => {
      await result.current.startDeviceFlow();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("Copilot auth not configured");
  });

  it("copilot: skips if backend is not copilot", async () => {
    const mockFetch = createMockFetch({});
    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, backend: "claude", fetch: mockFetch }),
    );

    await act(async () => {
      await result.current.startDeviceFlow();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ─── Claude OAuth ────────────────────────────────────────

  it("claude: starts OAuth flow via server", async () => {
    const mockFetch = createMockFetch({
      "/auth/start": { authorizeUrl: "https://claude.ai/oauth?code=xyz" },
    });

    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, backend: "claude", fetch: mockFetch }),
    );

    await act(async () => {
      await result.current.startOAuthFlow();
    });

    expect(result.current.authorizeUrl).toBe("https://claude.ai/oauth?code=xyz");
    expect(result.current.status).toBe("pending");
  });

  it("claude: completes OAuth via server", async () => {
    const mockFetch = createMockFetch({
      "/auth/start": { authorizeUrl: "https://claude.ai/oauth" },
      "/auth/claude/complete": { ok: true },
    });
    const onAuth = vi.fn();

    const { result } = renderHook(() =>
      useRemoteAuth({
        ...baseOptions,
        backend: "claude",
        fetch: mockFetch,
        onAuthenticated: onAuth,
      }),
    );

    await act(async () => {
      await result.current.startOAuthFlow();
    });
    await act(async () => {
      await result.current.completeOAuth("auth-code-123");
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.token).not.toBeNull();
    expect(onAuth).toHaveBeenCalledTimes(1);
  });

  // ─── Vercel AI / API Key ─────────────────────────────────

  it("vercel-ai: submits API key via server", async () => {
    const mockFetch = createMockFetch({
      "/auth/vercel/complete": { ok: true },
    });
    const onAuth = vi.fn();

    const { result } = renderHook(() =>
      useRemoteAuth({
        ...baseOptions,
        backend: "vercel-ai",
        fetch: mockFetch,
        onAuthenticated: onAuth,
      }),
    );

    await act(async () => {
      await result.current.submitApiKey("sk-test-key");
    });

    expect(result.current.status).toBe("authenticated");
    expect(onAuth).toHaveBeenCalledTimes(1);
  });

  it("vercel-ai: rejects empty API key", async () => {
    const mockFetch = createMockFetch({});

    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, backend: "vercel-ai", fetch: mockFetch }),
    );

    await act(async () => {
      await result.current.submitApiKey("");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("API key cannot be empty");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("vercel-ai: passes baseUrl with API key", async () => {
    const mockFetch = createMockFetch({
      "/auth/vercel/complete": { ok: true },
    });

    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, backend: "vercel-ai", fetch: mockFetch }),
    );

    await act(async () => {
      await result.current.submitApiKey("sk-key", "https://openrouter.ai/api/v1");
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("openrouter.ai"),
      }),
    );
  });

  // ─── Token Management ────────────────────────────────────

  it("loads saved providers", async () => {
    const mockFetch = createMockFetch({
      "/tokens/saved": { saved: ["copilot", "vercel-ai"] },
    });

    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, fetch: mockFetch }),
    );

    await act(async () => {
      await result.current.loadSavedTokens();
    });

    expect(result.current.savedProviders).toEqual(["copilot", "vercel-ai"]);
  });

  it("uses saved token", async () => {
    const mockFetch = createMockFetch({
      "/tokens/use": { ok: true, provider: "copilot" },
    });
    const onAuth = vi.fn();

    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, fetch: mockFetch, onAuthenticated: onAuth }),
    );

    await act(async () => {
      await result.current.useSavedToken("copilot");
    });

    expect(result.current.status).toBe("authenticated");
    expect(onAuth).toHaveBeenCalledTimes(1);
  });

  it("clears tokens", async () => {
    const mockFetch = createMockFetch({
      "/tokens/saved": { saved: ["copilot"] },
      "/tokens/clear": { ok: true },
    });

    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, fetch: mockFetch }),
    );

    await act(async () => {
      await result.current.loadSavedTokens();
    });
    expect(result.current.savedProviders).toHaveLength(1);

    await act(async () => {
      await result.current.clearTokens();
    });
    expect(result.current.savedProviders).toHaveLength(0);
  });

  // ─── Reset ───────────────────────────────────────────────

  it("reset returns to idle state", async () => {
    const mockFetch = createMockFetch({
      "/auth/start": { userCode: "CODE", verificationUrl: "https://gh.io" },
      "/auth/copilot/poll": { ok: true, login: "u" },
    });

    const { result } = renderHook(() =>
      useRemoteAuth({ ...baseOptions, fetch: mockFetch }),
    );

    await act(async () => {
      await result.current.startDeviceFlow();
    });
    expect(result.current.status).toBe("authenticated");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.token).toBeNull();
    expect(result.current.deviceCode).toBeNull();
    expect(result.current.verificationUrl).toBeNull();
    expect(result.current.authorizeUrl).toBeNull();
    expect(result.current.savedProviders).toHaveLength(0);
  });

  // ─── Custom Headers ──────────────────────────────────────

  it("passes custom headers to requests", async () => {
    const mockFetch = createMockFetch({
      "/auth/start": { userCode: "X", verificationUrl: "https://gh.io" },
      "/auth/copilot/poll": { ok: true, login: "u" },
    });

    const { result } = renderHook(() =>
      useRemoteAuth({
        ...baseOptions,
        fetch: mockFetch,
        headers: { Authorization: "Bearer xyz" },
      }),
    );

    await act(async () => {
      await result.current.startDeviceFlow();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer xyz" }),
      }),
    );
  });
});


// ─── Crypto Isolation ──────────────────────────────────────

describe("crypto isolation", () => {
  it("useRemoteAuth source has no node:crypto import", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(
      path.resolve("src/chat/react/useRemoteAuth.ts"),
      "utf-8",
    );
    expect(content).not.toContain("import { createHash");
    expect(content).not.toContain("import { randomBytes");
    expect(content).not.toContain("from \"node:crypto\"");
    expect(content).not.toContain("from \"crypto\"");
  });

  it("useRemoteAuth source has no auth class imports (only types)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(
      path.resolve("src/chat/react/useRemoteAuth.ts"),
      "utf-8",
    );
    // Should not import CopilotAuth or ClaudeAuth classes (which pull in node:crypto)
    // Note: useCopilotAuth/useClaudeAuth hooks are fine — they are browser-safe React hooks
    expect(content).not.toMatch(/import\s+\{[^}]*\bCopilotAuth\b/);
    expect(content).not.toMatch(/import\s+\{[^}]*\bClaudeAuth\b/);
    expect(content).not.toMatch(/from\s+["']\.\.\/\.\.\/auth\/copilot/);
    expect(content).not.toMatch(/from\s+["']\.\.\/\.\.\/auth\/claude[^/]/);
    // Only type imports from auth/types.ts
    expect(content).toContain("from \"../../auth/types.js\"");
  });

  it("react/index.ts exports useRemoteAuth", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(
      path.resolve("src/chat/react/index.ts"),
      "utf-8",
    );
    expect(content).toContain("useRemoteAuth");
    expect(content).toContain("UseRemoteAuthOptions");
    expect(content).toContain("UseRemoteAuthReturn");
  });

  // ─── start() auto-dispatch ───────────────────────────────

  describe("start()", () => {
    const authBaseOptions: Omit<UseRemoteAuthOptions, "fetch"> = {
      backend: "copilot",
      baseUrl: "http://test/api/auth",
    };

    it("dispatches to startDeviceFlow for copilot", async () => {
      const mockFetch = createMockFetch({
        "/auth/start": {
          userCode: "ABCD-1234",
          verificationUrl: "https://github.com/login/device",
        },
        "/auth/copilot/poll": {
          token: { accessToken: "tok" },
        },
      });

      const { result } = renderHook(() =>
        useRemoteAuth({ ...authBaseOptions, backend: "copilot", fetch: mockFetch }),
      );

      await act(async () => {
        await result.current.start();
      });

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[0]).toContain("/auth/start");
    });

    it("dispatches to startOAuthFlow for claude", async () => {
      const mockFetch = createMockFetch({
        "/auth/start": {
          authorizeUrl: "https://claude.ai/oauth/authorize?code=xyz",
        },
      });

      const { result } = renderHook(() =>
        useRemoteAuth({ ...authBaseOptions, backend: "claude", fetch: mockFetch }),
      );

      await act(async () => {
        await result.current.start();
      });

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[0]).toContain("/auth/start");
    });

    it("accepts explicit provider override", async () => {
      const mockFetch = createMockFetch({
        "/auth/start": {
          authorizeUrl: "https://claude.ai/oauth/authorize",
        },
      });

      // backend is copilot but we call start("claude")
      const { result } = renderHook(() =>
        useRemoteAuth({ ...authBaseOptions, backend: "copilot", fetch: mockFetch }),
      );

      await act(async () => {
        await result.current.start("claude");
      });

      // Should route to claude OAuth not copilot device flow
      expect(result.current.authorizeUrl).toBe("https://claude.ai/oauth/authorize");
    });

    it("throws for vercel-ai (requires submitApiKey)", async () => {
      const mockFetch = createMockFetch({});

      const { result } = renderHook(() =>
        useRemoteAuth({ ...authBaseOptions, backend: "vercel-ai", fetch: mockFetch }),
      );

      await act(async () => {
        await result.current.start();
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error?.message).toMatch(/submitApiKey/);
    });

    it("throws for unknown provider", async () => {
      const mockFetch = createMockFetch({});

      const { result } = renderHook(() =>
        useRemoteAuth({ ...authBaseOptions, backend: "copilot", fetch: mockFetch }),
      );

      await act(async () => {
        await result.current.start("unknown" as any);
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error?.message).toMatch(/Unknown auth provider/);
    });
  });
});
