/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { ChatProvider, useChatRuntime } from "../../../src/chat/react/ChatProvider.js";
import { useChat } from "../../../src/chat/react/useChat.js";
import { useMessages } from "../../../src/chat/react/useMessages.js";
import { useSessions } from "../../../src/chat/react/useSessions.js";
import type { IChatRuntime } from "../../../src/chat/runtime.js";
import type { ChatSession, ChatMessage, ChatId, ChatEvent } from "../../../src/chat/core.js";

// ─── Mock Runtime Factory ────────────────────────────────────

function createMockRuntime(overrides: Partial<IChatRuntime> = {}): IChatRuntime {
  const listeners = new Set<() => void>();
  return {
    status: "idle",
    send: vi.fn(() => (async function* () {})()),
    abort: vi.fn(),
    dispose: vi.fn(),
    createSession: vi.fn(async () => createMockSession()),
    getSession: vi.fn(async () => null),
    listSessions: vi.fn(async () => []),
    deleteSession: vi.fn(async () => {}),
    switchSession: vi.fn(async () => createMockSession()),
    registerTool: vi.fn(),
    removeTool: vi.fn(),
    listModels: vi.fn(async () => []),
    use: vi.fn(),
    removeMiddleware: vi.fn(),
    activeSessionId: null,
    registeredTools: new Map(),
    getContextStats: vi.fn(() => null),
    onSessionChange: vi.fn((cb: () => void) => {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    }),
    ...overrides,
  } as unknown as IChatRuntime;
}

function createMockSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: "test-session-id" as unknown as ChatId,
    title: "Test Session",
    messages: [],
    config: { model: "gpt-4", backend: "copilot" },
    metadata: { messageCount: 0, totalTokens: 0 },
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1" as unknown as ChatMessage["id"],
    role: "assistant",
    parts: [{ type: "text", text: "Hello!", status: "complete" }],
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── ChatProvider + useChatRuntime ───────────────────────────

describe("ChatProvider + useChatRuntime", () => {
  it("provides runtime to children", () => {
    const runtime = createMockRuntime();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ChatProvider, { runtime }, children);

    const { result } = renderHook(() => useChatRuntime(), { wrapper });
    expect(result.current).toBe(runtime);
  });

  it("throws when used outside ChatProvider", () => {
    expect(() => {
      renderHook(() => useChatRuntime());
    }).toThrow("useChatRuntime must be used within a ChatProvider");
  });
});

// ─── useChat ─────────────────────────────────────────────────

describe("useChat", () => {
  let runtime: IChatRuntime;

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(ChatProvider, { runtime }, children);
  }

  beforeEach(() => {
    runtime = createMockRuntime();
  });

  it("returns initial state", () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    expect(result.current.sessionId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("uses provided sessionId", async () => {
    const session = createMockSession({
      messages: [createMockMessage()],
    });
    vi.mocked(runtime.getSession).mockResolvedValue(session);

    const { result } = renderHook(
      () => useChat({ sessionId: "test-session-id" }),
      { wrapper },
    );

    expect(result.current.sessionId).toBe("test-session-id");

    // Wait for effect to load messages
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.messages).toHaveLength(1);
  });

  it("creates session on first send", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);
    vi.mocked(runtime.getSession).mockResolvedValue(
      createMockSession({
        messages: [
          createMockMessage({ role: "user", parts: [{ type: "text", text: "hi", status: "complete" }] }),
          createMockMessage(),
        ],
      }),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(runtime.createSession).toHaveBeenCalledOnce();
    expect(runtime.send).toHaveBeenCalledOnce();
  });

  it("includes user message in final messages", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);
    vi.mocked(runtime.send).mockImplementation(() => (async function* () {})());
    vi.mocked(runtime.getSession).mockResolvedValue(
      createMockSession({
        messages: [
          createMockMessage({ role: "user", parts: [{ type: "text", text: "hello", status: "complete" }] }),
          createMockMessage({ parts: [{ type: "text", text: "Hi there!", status: "complete" }] }),
        ],
      }),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    // After send completes, messages should be refreshed from session
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].role).toBe("user");
    expect(result.current.messages[1].role).toBe("assistant");
  });

  it("sets isGenerating during send", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);

    let resolveStream: () => void;
    const streamBlock = new Promise<void>((r) => { resolveStream = r; });

    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () {
        await streamBlock;
      })();
    });
    vi.mocked(runtime.getSession).mockResolvedValue(session);

    const { result } = renderHook(() => useChat(), { wrapper });

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.sendMessage("hello");
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should be generating while stream is active
    expect(result.current.isGenerating).toBe(true);

    // Finish stream
    resolveStream!();
    await act(async () => { await sendPromise!; });

    expect(result.current.isGenerating).toBe(false);
  });

  it("handles errors from send", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);
    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () {
        throw new Error("Network error");
      })();
    });

    const onError = vi.fn();
    const { result } = renderHook(() => useChat({ onError }), { wrapper });

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe("Network error");
    expect(onError).toHaveBeenCalledWith(result.current.error);
  });

  it("clearError clears the error", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);
    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () {
        throw new Error("fail");
      })();
    });

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("stop calls runtime.abort()", () => {
    const { result } = renderHook(() => useChat(), { wrapper });

    act(() => {
      result.current.stop();
    });

    expect(runtime.abort).toHaveBeenCalledOnce();
  });

  it("newSession creates a new session and resets state", async () => {
    const session1 = createMockSession({ id: "s1" as unknown as ChatId });
    const session2 = createMockSession({ id: "s2" as unknown as ChatId });
    vi.mocked(runtime.createSession)
      .mockResolvedValueOnce(session1)
      .mockResolvedValueOnce(session2);
    vi.mocked(runtime.getSession).mockResolvedValue(session1);

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    const newId = await act(async () => {
      return result.current.newSession();
    });

    expect(newId).toBe("s2");
    expect(result.current.sessionId).toBe("s2");
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("prevents concurrent sends", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);

    let resolveStream: () => void;
    const streamPromise = new Promise<void>((r) => { resolveStream = r; });

    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () {
        await streamPromise;
      })();
    });
    vi.mocked(runtime.getSession).mockResolvedValue(session);

    const { result } = renderHook(() => useChat(), { wrapper });

    // Start first send (will block on stream)
    let send1Done = false;
    const send1 = act(async () => {
      await result.current.sendMessage("first");
      send1Done = true;
    });

    // Wait for the first send to enter streaming
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Try second send while first is active
    await act(async () => {
      await result.current.sendMessage("second");
    });

    // Only one send should have been called (second was skipped)
    expect(runtime.send).toHaveBeenCalledTimes(1);

    // Unblock first stream
    resolveStream!();
    await send1;
  });

  it("updates messages progressively during streaming", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);

    // Mock send to emit text_delta events as ChatEvents
    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () {
        yield { type: "message:delta" as const, messageId: "mid" as unknown as ChatId, text: "Hel" };
        yield { type: "message:delta" as const, messageId: "mid" as unknown as ChatId, text: "lo" };
        yield { type: "message:delta" as const, messageId: "mid" as unknown as ChatId, text: "!" };
      })() as AsyncIterable<ChatEvent>;
    });

    vi.mocked(runtime.getSession).mockResolvedValue(
      createMockSession({
        messages: [
          createMockMessage({ role: "user", parts: [{ type: "text", text: "hi", status: "complete" }] }),
          createMockMessage({ parts: [{ type: "text", text: "Hello!", status: "complete" }] }),
        ],
      }),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    // After completion, messages are replaced with session state
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].parts[0]).toMatchObject({ type: "text", text: "Hello!" });
  });

  it("shows streaming assistant message with tool calls", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);

    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () {
        yield { type: "tool:start" as const, messageId: "mid" as unknown as ChatId, toolCallId: "tc1", toolName: "search", args: { q: "test" } };
        yield { type: "tool:complete" as const, messageId: "mid" as unknown as ChatId, toolCallId: "tc1", toolName: "search", result: "found it" };
        yield { type: "message:delta" as const, messageId: "mid" as unknown as ChatId, text: "Done" };
      })() as AsyncIterable<ChatEvent>;
    });

    vi.mocked(runtime.getSession).mockResolvedValue(
      createMockSession({
        messages: [
          createMockMessage({ role: "user", parts: [{ type: "text", text: "hi", status: "complete" }] }),
          createMockMessage({
            parts: [
              { type: "tool_call", toolCallId: "tc1", name: "search", args: { q: "test" }, result: "found it", status: "complete" },
              { type: "text", text: "Done", status: "complete" },
            ],
          }),
        ],
      }),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(result.current.messages).toHaveLength(2);
    const assistantMsg = result.current.messages[1];
    expect(assistantMsg.parts).toHaveLength(2);
    expect(assistantMsg.parts[0]).toMatchObject({ type: "tool_call", name: "search" });
    expect(assistantMsg.parts[1]).toMatchObject({ type: "text", text: "Done" });
  });

  it("handles abort mid-stream gracefully", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);

    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () {
        yield { type: "message:delta" as const, messageId: "mid" as unknown as ChatId, text: "Par" };
        yield { type: "message:delta" as const, messageId: "mid" as unknown as ChatId, text: "tial" };
        // Simulate abort by throwing
        throw new Error("Aborted");
      })() as AsyncIterable<ChatEvent>;
    });

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    // Error should be set
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe("Aborted");
    expect(result.current.isGenerating).toBe(false);

    // Partial message should remain visible with error status
    const msgs = result.current.messages;
    const lastMsg = msgs[msgs.length - 1];
    expect(lastMsg.role).toBe("assistant");
    expect(lastMsg.status).toBe("error");
  });

  it("ignores non-accumulator events without crashing", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);

    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () {
        yield { type: "heartbeat" as const };
        yield { type: "message:delta" as const, messageId: "mid" as unknown as ChatId, text: "OK" };
        yield { type: "usage" as const, promptTokens: 10, completionTokens: 5, model: "gpt-4" };
      })() as AsyncIterable<ChatEvent>;
    });

    vi.mocked(runtime.getSession).mockResolvedValue(
      createMockSession({
        messages: [
          createMockMessage({ role: "user", parts: [{ type: "text", text: "hi", status: "complete" }] }),
          createMockMessage({ parts: [{ type: "text", text: "OK", status: "complete" }] }),
        ],
      }),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    // Should work fine — non-accumulator events ignored
    expect(result.current.messages).toHaveLength(2);
  });

  it("tracks usage from usage events", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);

    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () {
        yield { type: "message:start" as const, messageId: "mid" as unknown as ChatId, role: "assistant" as const };
        yield { type: "message:delta" as const, messageId: "mid" as unknown as ChatId, text: "Hi" };
        yield { type: "usage" as const, promptTokens: 100, completionTokens: 50, model: "gpt-5-mini" };
        yield { type: "message:complete" as const, messageId: "mid" as unknown as ChatId, message: createMockMessage() };
      })() as AsyncIterable<ChatEvent>;
    });

    vi.mocked(runtime.getSession).mockResolvedValue(
      createMockSession({
        messages: [
          createMockMessage({ role: "user", parts: [{ type: "text", text: "hi", status: "complete" }] }),
          createMockMessage({ parts: [{ type: "text", text: "Hi", status: "complete" }] }),
        ],
      }),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    // usage starts as null
    expect(result.current.usage).toBeNull();

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(result.current.usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      model: "gpt-5-mini",
    });
  });

  it("returns usage as null initially", () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    expect(result.current.usage).toBeNull();
  });

  it("updates usage with computed totalTokens", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);

    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () {
        yield { type: "usage" as const, promptTokens: 7, completionTokens: 3, model: undefined };
      })() as AsyncIterable<ChatEvent>;
    });

    vi.mocked(runtime.getSession).mockResolvedValue(
      createMockSession({
        messages: [
          createMockMessage({ role: "user", parts: [{ type: "text", text: "hi", status: "complete" }] }),
        ],
      }),
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(result.current.usage).toEqual({
      promptTokens: 7,
      completionTokens: 3,
      totalTokens: 10,
      model: undefined,
    });
  });

  it("retryLastMessage re-sends the last user message", async () => {
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);

    let callCount = 0;
    vi.mocked(runtime.send).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return (async function* () { throw new Error("fail"); })();
      }
      return (async function* () {
        yield { type: "message:delta" as const, text: "ok" } as ChatEvent;
      })() as AsyncIterable<ChatEvent>;
    });
    vi.mocked(runtime.getSession).mockResolvedValue(session);

    const { result } = renderHook(() => useChat(), { wrapper });

    // First send fails
    await act(async () => { await result.current.sendMessage("hello"); });
    expect(result.current.error).not.toBeNull();

    // Retry succeeds
    await act(async () => { await result.current.retryLastMessage(); });
    expect(result.current.error).toBeNull();
    expect(runtime.send).toHaveBeenCalledTimes(2);
  });

  it("retryLastMessage is no-op when no prior message", async () => {
    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => { await result.current.retryLastMessage(); });
    expect(runtime.send).not.toHaveBeenCalled();
  });

  it("autoDismissMs auto-clears error after timeout", async () => {
    vi.useFakeTimers();
    const session = createMockSession();
    vi.mocked(runtime.createSession).mockResolvedValue(session);
    vi.mocked(runtime.send).mockImplementation(() => {
      return (async function* () { throw new Error("timeout"); })();
    });

    const { result } = renderHook(
      () => useChat({ autoDismissMs: 3000 }),
      { wrapper },
    );

    await act(async () => { await result.current.sendMessage("hello"); });
    expect(result.current.error).not.toBeNull();

    // Advance just before dismiss
    act(() => { vi.advanceTimersByTime(2999); });
    expect(result.current.error).not.toBeNull();

    // Advance past dismiss threshold
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current.error).toBeNull();

    vi.useRealTimers();
  });
});

// ─── useMessages ─────────────────────────────────────────────

describe("useMessages", () => {
  let runtime: IChatRuntime;

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(ChatProvider, { runtime }, children);
  }

  beforeEach(() => {
    runtime = createMockRuntime();
  });

  it("returns empty messages for unknown session", async () => {
    vi.mocked(runtime.getSession).mockResolvedValue(null);

    const { result } = renderHook(
      () => useMessages({ sessionId: "unknown" }),
      { wrapper },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoaded).toBe(false);
  });

  it("loads messages from session", async () => {
    const messages = [createMockMessage(), createMockMessage({ id: "msg-2" as unknown as ChatMessage["id"] })];
    const session = createMockSession({ messages });
    vi.mocked(runtime.getSession).mockResolvedValue(session);

    const { result } = renderHook(
      () => useMessages({ sessionId: "test-session-id" }),
      { wrapper },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.isLoaded).toBe(true);
  });

  it("uses subscribe/getSnapshot when available", async () => {
    const messages = [createMockMessage()];
    let subscribeCallback: (() => void) | null = null;

    const session = createMockSession({
      messages,
      subscribe: (cb: () => void) => {
        subscribeCallback = cb;
        return () => { subscribeCallback = null; };
      },
      getSnapshot: () => createMockSession({
        messages: [...messages, createMockMessage({ id: "msg-new" as unknown as ChatMessage["id"] })],
      }),
    });
    vi.mocked(runtime.getSession).mockResolvedValue(session);

    const { result } = renderHook(
      () => useMessages({ sessionId: "test-session-id" }),
      { wrapper },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.messages).toHaveLength(1);
    expect(subscribeCallback).not.toBeNull();

    // Trigger subscription update
    act(() => {
      subscribeCallback!();
    });

    expect(result.current.messages).toHaveLength(2);
  });

  it("cleans up subscription on unmount", async () => {
    let unsubscribed = false;
    const session = createMockSession({
      messages: [],
      subscribe: () => {
        return () => { unsubscribed = true; };
      },
      getSnapshot: () => createMockSession(),
    });
    vi.mocked(runtime.getSession).mockResolvedValue(session);

    const { unmount } = renderHook(
      () => useMessages({ sessionId: "test-session-id" }),
      { wrapper },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    unmount();

    expect(unsubscribed).toBe(true);
  });

  it("falls back to polling when no subscribe", async () => {
    const messages1 = [createMockMessage()];
    const messages2 = [...messages1, createMockMessage({ id: "msg-2" as unknown as ChatMessage["id"] })];

    vi.mocked(runtime.getSession)
      .mockResolvedValueOnce(createMockSession({ messages: messages1 }))
      .mockResolvedValue(createMockSession({ messages: messages2 }));

    const { result } = renderHook(
      () => useMessages({ sessionId: "test-session-id" }),
      { wrapper },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.messages).toHaveLength(1);

    // Wait for poll interval
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });

    expect(result.current.messages).toHaveLength(2);
  });
});

// ─── useSessions ─────────────────────────────────────────────

describe("useSessions", () => {
  let runtime: IChatRuntime;
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode;

  beforeEach(() => {
    runtime = createMockRuntime({
      listSessions: vi.fn(async () => [
        createMockSession({ title: "Session A" }),
        createMockSession({ title: "Session B" }),
      ]),
    });
    wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ChatProvider, { runtime }, children);
  });

  it("loads sessions on mount", async () => {
    const { result } = renderHook(() => useSessions(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessions[0].title).toBe("Session A");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("refreshes on session change callback", async () => {
    let changeCallback: (() => void) | null = null;
    runtime = createMockRuntime({
      listSessions: vi.fn()
        .mockResolvedValueOnce([createMockSession({ title: "Before" })])
        .mockResolvedValueOnce([
          createMockSession({ title: "Before" }),
          createMockSession({ title: "After" }),
        ]),
      onSessionChange: vi.fn((cb: () => void) => {
        changeCallback = cb;
        return () => { changeCallback = null; };
      }),
    });
    wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ChatProvider, { runtime }, children);

    const { result } = renderHook(() => useSessions(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.sessions).toHaveLength(1);

    // Simulate session creation triggering callback
    await act(async () => {
      changeCallback!();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.sessions).toHaveLength(2);
  });

  it("returns SessionInfo format from full ChatSession objects", async () => {
    const { result } = renderHook(() => useSessions(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const info = result.current.sessions[0];
    expect(info).toHaveProperty("messageCount");
    expect(info).toHaveProperty("id");
    expect(info).toHaveProperty("title");
    expect(info).not.toHaveProperty("messages");
  });
});
