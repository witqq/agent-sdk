/**
 * @vitest-environment jsdom
 */

/**
 * Tests for useRemoteChat — lifecycle hook orchestrating auth → runtime → session.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRemoteChat } from "../../../src/chat/react/useRemoteChat.js";
import type { UseRemoteChatOptions } from "../../../src/chat/react/useRemoteChat.js";
import { RemoteChatRuntime } from "../../../src/chat/react/RemoteChatRuntime.js";

// Intercept RemoteChatRuntime constructor
const mockCreateSession = vi.fn();
vi.mock("../../../src/chat/react/RemoteChatRuntime.js", () => ({
  RemoteChatRuntime: vi.fn(),
}));

const MockedRuntime = vi.mocked(RemoteChatRuntime);

function makeMockRuntimeInstance() {
  return {
    createSession: mockCreateSession,
    dispose: vi.fn(),
    send: vi.fn(),
    abort: vi.fn(),
    listModels: vi.fn().mockResolvedValue([]),
    switchBackend: vi.fn(),
    switchModel: vi.fn(),
    getSession: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([]),
    deleteSession: vi.fn(),
    archiveSession: vi.fn(),
    switchSession: vi.fn(),
    registerTool: vi.fn(),
    removeTool: vi.fn(),
    use: vi.fn(),
    getContextStats: vi.fn().mockReturnValue(null),
    status: "idle",
  } as unknown as RemoteChatRuntime;
}

function createMockFetch(responses: Record<string, unknown>) {
  return vi.fn(async (url: string, _opts?: RequestInit) => {
    const path = new URL(url, "http://test").pathname;
    for (const [key, value] of Object.entries(responses)) {
      if (path.endsWith(key)) {
        return { ok: true, json: async () => value } as Response;
      }
    }
    return { ok: false, json: async () => ({ error: "Not found" }) } as Response;
  });
}

function authReadyFetch() {
  return createMockFetch({
    "/tokens/saved": { saved: ["copilot"] },
    "/tokens/use": { token: { accessToken: "test-token", expiresAt: Date.now() + 60000 } },
  });
}

describe("useRemoteChat", () => {
  let defaultOptions: UseRemoteChatOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply mock implementation — must use function() (not arrow) for new operator
    MockedRuntime.mockImplementation(function() { return makeMockRuntimeInstance(); });
    mockCreateSession.mockResolvedValue({ id: "session-1", title: "New", messages: [], status: "active" });

    defaultOptions = {
      chatBaseUrl: "http://test/api/chat",
      authBaseUrl: "http://test/api/auth",
      backend: "copilot",
      fetch: createMockFetch({ "/tokens/saved": { saved: [] } }) as unknown as typeof globalThis.fetch,
    };
  });

  it("transitions to unauthenticated when no saved tokens", async () => {
    const { result } = renderHook(() => useRemoteChat(defaultOptions));

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(result.current.phase).toBe("unauthenticated");
    expect(result.current.runtime).toBeNull();
    expect(result.current.sessionId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("auto-restores saved token and reaches ready", async () => {
    const opts: UseRemoteChatOptions = {
      ...defaultOptions,
      fetch: authReadyFetch() as unknown as typeof globalThis.fetch,
    };

    const { result } = renderHook(() => useRemoteChat(opts));

    await act(async () => {
      await new Promise(r => setTimeout(r, 200));
    });

    expect(result.current.phase).toBe("ready");
    expect(result.current.runtime).not.toBeNull();
    expect(result.current.sessionId).toBe("session-1");
  });

  it("skips auto-restore when autoRestore=false", async () => {
    const fetchSpy = createMockFetch({ "/tokens/saved": { saved: [] } });
    const opts: UseRemoteChatOptions = {
      ...defaultOptions,
      autoRestore: false,
      fetch: fetchSpy as unknown as typeof globalThis.fetch,
    };

    const { result } = renderHook(() => useRemoteChat(opts));

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(result.current.phase).toBe("initializing");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("handles runtime creation failure", async () => {
    mockCreateSession.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() =>
      useRemoteChat({
        ...defaultOptions,
        fetch: authReadyFetch() as unknown as typeof globalThis.fetch,
      }),
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 200));
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.error?.message).toBe("Network error");
    expect(result.current.runtime).toBeNull();
  });

  it("newSession creates session and updates sessionId", async () => {
    const { result } = renderHook(() =>
      useRemoteChat({
        ...defaultOptions,
        fetch: authReadyFetch() as unknown as typeof globalThis.fetch,
      }),
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 200));
    });
    expect(result.current.phase).toBe("ready");

    mockCreateSession.mockResolvedValueOnce({ id: "session-2", title: "New 2", messages: [], status: "active" });
    let newId: string;
    await act(async () => {
      newId = await result.current.newSession();
    });
    expect(newId!).toBe("session-2");
    expect(result.current.sessionId).toBe("session-2");
  });

  it("newSession throws when runtime not ready", async () => {
    const { result } = renderHook(() => useRemoteChat(defaultOptions));

    await expect(result.current.newSession()).rejects.toThrow("Runtime not ready");
  });

  it("logout resets to unauthenticated", async () => {
    const logoutFetch = createMockFetch({
      "/tokens/saved": { saved: ["copilot"] },
      "/tokens/use": { token: { accessToken: "t", expiresAt: Date.now() + 60000 } },
      "/tokens/clear": { ok: true },
    });

    const { result } = renderHook(() =>
      useRemoteChat({
        ...defaultOptions,
        fetch: logoutFetch as unknown as typeof globalThis.fetch,
      }),
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 200));
    });
    expect(result.current.phase).toBe("ready");

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.phase).toBe("unauthenticated");
    expect(result.current.runtime).toBeNull();
    expect(result.current.sessionId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("calls onReady when reaching ready phase", async () => {
    const onReady = vi.fn();

    renderHook(() =>
      useRemoteChat({
        ...defaultOptions,
        fetch: authReadyFetch() as unknown as typeof globalThis.fetch,
        onReady,
      }),
    );

    await act(async () => {
      await new Promise(r => setTimeout(r, 200));
    });

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("exposes auth sub-hook for manual control", async () => {
    const { result } = renderHook(() => useRemoteChat(defaultOptions));

    expect(result.current.auth).toBeDefined();
    expect(typeof result.current.auth.startDeviceFlow).toBe("function");
    expect(typeof result.current.auth.loadSavedTokens).toBe("function");
    expect(typeof result.current.auth.start).toBe("function");
  });

  it("prevents state updates after unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useRemoteChat({
        ...defaultOptions,
        fetch: authReadyFetch() as unknown as typeof globalThis.fetch,
      }),
    );

    // Unmount before lifecycle completes
    unmount();

    // Wait for async operations to settle — should not throw
    await act(async () => {
      await new Promise(r => setTimeout(r, 200));
    });

    // Phase was set before unmount; no crash from post-unmount setState
    expect(result.current.phase).toBeDefined();
  });

  it("re-authenticates after logout", async () => {
    const logoutFetch = createMockFetch({
      "/tokens/saved": { saved: ["copilot"] },
      "/tokens/use": { ok: true },
      "/tokens/clear": { ok: true },
    });

    const { result } = renderHook(() =>
      useRemoteChat({
        ...defaultOptions,
        fetch: logoutFetch as unknown as typeof globalThis.fetch,
      }),
    );

    // Reach ready state
    await act(async () => {
      await new Promise(r => setTimeout(r, 200));
    });
    expect(result.current.phase).toBe("ready");

    // Logout
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.phase).toBe("unauthenticated");

    // Manually trigger re-auth via auth.start()
    await act(async () => {
      await result.current.auth.useSavedToken("copilot");
    });

    // Wait for runtime creation
    await act(async () => {
      await new Promise(r => setTimeout(r, 200));
    });
    expect(result.current.phase).toBe("ready");
    expect(result.current.runtime).not.toBeNull();
    expect(result.current.sessionId).toBe("session-1");
  });
});
