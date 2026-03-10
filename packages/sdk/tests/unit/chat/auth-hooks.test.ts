// @vitest-environment jsdom
/**
 * Tests for per-backend auth hooks:
 * useCopilotAuth, useClaudeAuth, useApiKeyAuth.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCopilotAuth } from "../../../src/chat/react/auth/useCopilotAuth.js";
import { useClaudeAuth } from "../../../src/chat/react/auth/useClaudeAuth.js";
import { useApiKeyAuth } from "../../../src/chat/react/auth/useApiKeyAuth.js";

function createMockFetch(responses: Record<string, unknown> = {}) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, "http://localhost").pathname;
    const body = init?.body ? JSON.parse(init.body as string) : {};

    // Default responses
    if (path.endsWith("/auth/start") && body.provider === "copilot") {
      return { ok: true, json: async () => responses["copilot-start"] ?? { userCode: "ABC-123", verificationUrl: "https://github.com/login/device" } };
    }
    if (path.endsWith("/auth/copilot/poll")) {
      return { ok: true, json: async () => responses["copilot-poll"] ?? { success: true } };
    }
    if (path.endsWith("/auth/start") && body.provider === "claude") {
      return { ok: true, json: async () => responses["claude-start"] ?? { authorizeUrl: "https://claude.ai/oauth/authorize?code=..." } };
    }
    if (path.endsWith("/auth/claude/complete")) {
      return { ok: true, json: async () => responses["claude-complete"] ?? { success: true } };
    }
    if (path.endsWith("/auth/vercel/complete")) {
      return { ok: true, json: async () => responses["vercel-complete"] ?? { success: true } };
    }
    return { ok: false, json: async () => ({ error: "Unknown route" }) };
  }) as unknown as typeof globalThis.fetch;
}

/* ─── useCopilotAuth ──────────────────────────────────────────────── */

describe("useCopilotAuth", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() =>
      useCopilotAuth({ baseUrl: "http://localhost/api/auth", fetch: createMockFetch() }),
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.token).toBeNull();
    expect(result.current.deviceCode).toBeNull();
  });

  it("performs device flow: sets deviceCode, polls, becomes authenticated", async () => {
    const onAuthenticated = vi.fn();
    const mockFetch = createMockFetch();
    const { result } = renderHook(() =>
      useCopilotAuth({
        baseUrl: "http://localhost/api/auth",
        fetch: mockFetch,
        onAuthenticated,
      }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.deviceCode).toBe("ABC-123");
    expect(result.current.verificationUrl).toBe("https://github.com/login/device");
    expect(result.current.token).not.toBeNull();
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });

  it("handles errors gracefully", async () => {
    const errorFetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "Auth failed" }),
    })) as unknown as typeof globalThis.fetch;

    const { result } = renderHook(() =>
      useCopilotAuth({ baseUrl: "http://localhost/api/auth", fetch: errorFetch }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("Auth failed");
  });

  it("resets state cleanly", async () => {
    const { result } = renderHook(() =>
      useCopilotAuth({ baseUrl: "http://localhost/api/auth", fetch: createMockFetch() }),
    );

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("authenticated");

    act(() => { result.current.reset(); });
    expect(result.current.status).toBe("idle");
    expect(result.current.token).toBeNull();
    expect(result.current.deviceCode).toBeNull();
  });
});

/* ─── useClaudeAuth ───────────────────────────────────────────────── */

describe("useClaudeAuth", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() =>
      useClaudeAuth({ baseUrl: "http://localhost/api/auth", fetch: createMockFetch() }),
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.authorizeUrl).toBeNull();
  });

  it("starts OAuth flow and sets authorizeUrl", async () => {
    const { result } = renderHook(() =>
      useClaudeAuth({ baseUrl: "http://localhost/api/auth", fetch: createMockFetch() }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("pending");
    expect(result.current.authorizeUrl).toBe("https://claude.ai/oauth/authorize?code=...");
  });

  it("completes OAuth and becomes authenticated", async () => {
    const onAuthenticated = vi.fn();
    const { result } = renderHook(() =>
      useClaudeAuth({
        baseUrl: "http://localhost/api/auth",
        fetch: createMockFetch(),
        onAuthenticated,
      }),
    );

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.complete("auth-code-123");
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.token).not.toBeNull();
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });

  it("handles start error", async () => {
    const errorFetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "OAuth init failed" }),
    })) as unknown as typeof globalThis.fetch;

    const { result } = renderHook(() =>
      useClaudeAuth({ baseUrl: "http://localhost/api/auth", fetch: errorFetch }),
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("OAuth init failed");
  });

  it("resets all state", async () => {
    const { result } = renderHook(() =>
      useClaudeAuth({ baseUrl: "http://localhost/api/auth", fetch: createMockFetch() }),
    );

    await act(async () => { await result.current.start(); });
    act(() => { result.current.reset(); });

    expect(result.current.status).toBe("idle");
    expect(result.current.authorizeUrl).toBeNull();
    expect(result.current.token).toBeNull();
  });
});

/* ─── useApiKeyAuth ───────────────────────────────────────────────── */

describe("useApiKeyAuth", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() =>
      useApiKeyAuth({ baseUrl: "http://localhost/api/auth", fetch: createMockFetch() }),
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.token).toBeNull();
  });

  it("submits API key and becomes authenticated", async () => {
    const onAuthenticated = vi.fn();
    const { result } = renderHook(() =>
      useApiKeyAuth({
        baseUrl: "http://localhost/api/auth",
        fetch: createMockFetch(),
        onAuthenticated,
      }),
    );

    await act(async () => {
      await result.current.submit("sk-test-key-123");
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.token).not.toBeNull();
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });

  it("submits API key with custom baseUrl", async () => {
    const mockFetch = createMockFetch();
    const { result } = renderHook(() =>
      useApiKeyAuth({ baseUrl: "http://localhost/api/auth", fetch: mockFetch }),
    );

    await act(async () => {
      await result.current.submit("sk-key", "https://custom.api.com/v1");
    });

    expect(result.current.status).toBe("authenticated");
    // Verify the baseUrl was sent
    const lastCall = mockFetch.mock.calls[0];
    const body = JSON.parse(lastCall[1]?.body as string);
    expect(body.baseUrl).toBe("https://custom.api.com/v1");
  });

  it("rejects empty API key", async () => {
    const { result } = renderHook(() =>
      useApiKeyAuth({ baseUrl: "http://localhost/api/auth", fetch: createMockFetch() }),
    );

    await act(async () => {
      await result.current.submit("");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("API key cannot be empty");
  });

  it("rejects whitespace-only API key", async () => {
    const { result } = renderHook(() =>
      useApiKeyAuth({ baseUrl: "http://localhost/api/auth", fetch: createMockFetch() }),
    );

    await act(async () => {
      await result.current.submit("   ");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("API key cannot be empty");
  });

  it("handles server error", async () => {
    const errorFetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "Invalid key" }),
    })) as unknown as typeof globalThis.fetch;

    const { result } = renderHook(() =>
      useApiKeyAuth({ baseUrl: "http://localhost/api/auth", fetch: errorFetch }),
    );

    await act(async () => {
      await result.current.submit("bad-key");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("Invalid key");
  });

  it("resets state", async () => {
    const { result } = renderHook(() =>
      useApiKeyAuth({ baseUrl: "http://localhost/api/auth", fetch: createMockFetch() }),
    );

    await act(async () => { await result.current.submit("sk-key"); });
    expect(result.current.status).toBe("authenticated");

    act(() => { result.current.reset(); });
    expect(result.current.status).toBe("idle");
    expect(result.current.token).toBeNull();
  });
});
