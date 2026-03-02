/**
 * @vitest-environment jsdom
 *
 * Integration test: React hooks working through RemoteChatClient with mock server.
 * Confirms that useChat + ChatProvider + RemoteChatClient form a working chain.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { ChatProvider } from "../../../src/chat/react/ChatProvider.js";
import { useChat } from "../../../src/chat/react/useChat.js";
import { RemoteChatClient } from "../../../src/chat/react/RemoteChatClient.js";
import type { ChatSession, ChatId, ChatEvent } from "../../../src/chat/core.js";

// ─── Helpers ──────────────────────────────────────────────────

function mockSession(id = "sess-1"): ChatSession {
  return {
    id: id as unknown as ChatId,
    title: "Test Session",
    status: "active",
    config: { backend: "copilot", model: "gpt-4.1" },
    messages: [],
    metadata: { messageCount: 0, custom: {} },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as ChatSession;
}

function sseResponse(events: ChatEvent[]): Response {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}`).join("\n") + "\ndata: [DONE]\n";
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Tests ────────────────────────────────────────────────────

describe("React hooks through RemoteChatClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let runtime: RemoteChatClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    runtime = new RemoteChatClient({
      baseUrl: "http://localhost:3456/api",
      fetch: fetchMock,
    });
  });

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(ChatProvider, { runtime, children });
  }

  it("useChat can send a message through RemoteChatClient", async () => {
    const session = mockSession("s1");
    const sessionWithMsg = {
      ...session,
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          parts: [{ type: "text", text: "Hello!", status: "complete" }],
          status: "complete",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      metadata: { messageCount: 1, custom: {} },
    };

    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/sessions/create")) {
        return Promise.resolve(jsonResponse(session));
      }
      if (url.includes("/send")) {
        return Promise.resolve(
          sseResponse([
            { type: "message:start", messageId: "msg-1" } as ChatEvent,
            { type: "message:delta", content: "Hello!" } as ChatEvent,
            { type: "message:complete", messageId: "msg-1" } as ChatEvent,
          ]),
        );
      }
      if (url.includes("/sessions/s1")) {
        return Promise.resolve(jsonResponse(sessionWithMsg));
      }
      return Promise.resolve(jsonResponse({}));
    });

    const { result } = renderHook(() => useChat(), { wrapper });

    // Send message — triggers createSession + send
    await act(async () => {
      await result.current.sendMessage("Hi there");
    });

    // Verify fetch was called for session creation and send
    const fetchCalls = fetchMock.mock.calls.map((c: unknown[]) => c[0]);
    expect(fetchCalls).toContain("http://localhost:3456/api/sessions/create");
    expect(fetchCalls).toContain("http://localhost:3456/api/send");
  });

  it("useChat.stop() calls abort on RemoteChatClient", async () => {
    const session = mockSession("s1");
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/sessions/create")) {
        return Promise.resolve(jsonResponse(session));
      }
      if (url.includes("/abort")) {
        return Promise.resolve(jsonResponse({}));
      }
      return Promise.resolve(jsonResponse({}));
    });

    const { result } = renderHook(() => useChat(), { wrapper });

    // Call stop — should trigger abort on runtime
    act(() => {
      result.current.stop();
    });

    // Verify abort POST was sent
    const abortCalls = fetchMock.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/abort"),
    );
    expect(abortCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("useChat reports idle status from runtime", () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    expect(result.current.status).toBe("idle");
  });

  it("ChatProvider provides RemoteChatClient to hooks", () => {
    const { result } = renderHook(
      () => useChat(),
      { wrapper },
    );

    // useChat should have initialized without errors
    expect(result.current.sendMessage).toBeDefined();
    expect(result.current.stop).toBeDefined();
    expect(result.current.isGenerating).toBe(false);
  });

  it("useChat creates session on first send via RemoteChatClient", async () => {
    const session = mockSession("auto-created");
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/sessions/create")) {
        return Promise.resolve(jsonResponse(session));
      }
      if (url.includes("/send")) {
        return Promise.resolve(sseResponse([]));
      }
      if (url.includes("/sessions/auto-created")) {
        return Promise.resolve(jsonResponse(session));
      }
      return Promise.resolve(jsonResponse({}));
    });

    const { result } = renderHook(() => useChat(), { wrapper });

    await act(async () => {
      await result.current.sendMessage("first message");
    });

    // Verify createSession was called
    const createCalls = fetchMock.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("/sessions/create"),
    );
    expect(createCalls.length).toBe(1);
  });
});
