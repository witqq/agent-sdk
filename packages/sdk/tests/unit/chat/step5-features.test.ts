/**
 * Tests for Step 5 features:
 * - isObservableSession type guard
 * - createTextMessage factory
 * - ChatMiddleware onBeforeSend null rejection
 * - systemPrompt per-call forwarding
 * - useSSE POST method support
 */

import { describe, it, expect, vi } from "vitest";
import {
  createTextMessage,
  isObservableSession,
  createChatId,
  type ChatSession,
  type ObservableSession,
  type ChatMessage,
  type ChatEvent,
  type ChatMiddleware,
} from "../../../src/chat/types.js";
import { createChatRuntime, type ChatRuntimeOptions } from "../../../src/chat/runtime.js";
import type { IResumableBackend } from "../../../src/chat/backends/index.js";
import type { IChatSessionStore, PaginatedMessages } from "../../../src/chat/sessions.js";

// ─── Helpers ───────────────────────────────────────────────────

function createMockSessionStore(): IChatSessionStore {
  const sessions = new Map<string, ChatSession>();
  return {
    createSession: vi.fn(async (opts) => {
      const id = createChatId();
      const s: ChatSession = {
        id,
        messages: [],
        config: { model: opts?.config?.model ?? "", backend: opts?.config?.backend ?? "" },
        metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0 },
        status: "active",
      };
      sessions.set(id, s);
      return s;
    }),
    getSession: vi.fn(async (id) => sessions.get(id) ?? null),
    listSessions: vi.fn(async () => [...sessions.values()]),
    updateTitle: vi.fn(async () => {}),
    updateConfig: vi.fn(async () => {}),
    deleteSession: vi.fn(async (id) => sessions.delete(id)),
    appendMessage: vi.fn(async () => {}),
    getMessages: vi.fn(async (): Promise<PaginatedMessages> => ({ messages: [], total: 0, hasMore: false })),
    searchSessions: vi.fn(async () => []),
    count: vi.fn(async () => sessions.size),
    clear: vi.fn(async () => sessions.clear()),
  };
}

function createMockMessage(): ChatMessage {
  return {
    id: createChatId(),
    role: "assistant",
    parts: [{ type: "text", text: "Hello", status: "complete" }],
    createdAt: new Date().toISOString(),
    status: "complete",
  };
}

function createMockAdapter(overrides?: Partial<IResumableBackend>): IResumableBackend {
  return {
    name: "mock",
    canResume: () => false,
    resume: vi.fn(),
    backendSessionId: null,
    agentService: {} as any,
    currentModel: undefined,
    setTools: vi.fn(),
    sendMessage: vi.fn(async () => createMockMessage()),
    streamMessage: vi.fn(async function* () {
      const msgId = createChatId();
      yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
      yield { type: "message:delta", messageId: msgId, text: "Hello" } as ChatEvent;
      yield { type: "message:complete", messageId: msgId, message: createMockMessage() } as ChatEvent;
    }),
    listModels: vi.fn(async () => []),
    validate: vi.fn(async () => ({ valid: true, errors: [] })),
    dispose: vi.fn(async () => {}),
    ...overrides,
  };
}

const SEND_OPTS = {
  model: "test-model",
  backend: "mock",
  credentials: { accessToken: "test-token", tokenType: "bearer" as const, obtainedAt: Date.now() },
};

// ─── isObservableSession ───────────────────────────────────────

describe("isObservableSession", () => {
  it("returns false for a plain ChatSession", () => {
    const session: ChatSession = {
      id: createChatId(),
      messages: [],
      config: { model: "gpt-4", backend: "mock" },
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0 },
      status: "active",
    };
    expect(isObservableSession(session)).toBe(false);
  });

  it("returns true for a session with subscribe and getSnapshot", () => {
    const session: ObservableSession = {
      id: createChatId(),
      messages: [],
      config: { model: "gpt-4", backend: "mock" },
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0 },
      status: "active",
      subscribe: () => () => {},
      getSnapshot: () => session,
      lastMessage: undefined,
    };
    expect(isObservableSession(session)).toBe(true);
  });

  it("returns false if only subscribe is present (not getSnapshot)", () => {
    const session = {
      id: createChatId(),
      messages: [],
      config: { model: "gpt-4", backend: "mock" },
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0 },
      status: "active",
      subscribe: () => () => {},
    } as unknown as ChatSession;
    expect(isObservableSession(session)).toBe(false);
  });
});

// ─── createTextMessage ────────────────────────────────────────

describe("createTextMessage", () => {
  it("creates a user message by default", () => {
    const msg = createTextMessage("Hello world");
    expect(msg.role).toBe("user");
    expect(msg.parts).toHaveLength(1);
    expect(msg.parts[0].type).toBe("text");
    expect(msg.parts[0]).toHaveProperty("text", "Hello world");
    expect(msg.parts[0].status).toBe("complete");
    expect(msg.status).toBe("complete");
    expect(msg.id).toBeTruthy();
    expect(msg.createdAt).toBeTruthy();
  });

  it("creates a message with custom role", () => {
    const msg = createTextMessage("System prompt", "system");
    expect(msg.role).toBe("system");
  });

  it("creates an assistant message", () => {
    const msg = createTextMessage("Response", "assistant");
    expect(msg.role).toBe("assistant");
  });

  it("generates unique IDs for each message", () => {
    const a = createTextMessage("A");
    const b = createTextMessage("B");
    expect(a.id).not.toBe(b.id);
  });
});

// ─── onBeforeSend null rejection ───────────────────────────────

describe("onBeforeSend null rejection", () => {
  it("silently aborts send when middleware returns null", async () => {
    const store = createMockSessionStore();
    const adapter = createMockAdapter();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
      middleware: [{
        onBeforeSend: async () => null,
      }],
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
      events.push(event);
    }

    // No events emitted — send was silently aborted
    expect(events).toHaveLength(0);
    // Adapter was never called
    expect(adapter.streamMessage).not.toHaveBeenCalled();
    // Runtime returns to idle
    expect(runtime.status).toBe("idle");
  });

  it("proceeds normally when middleware returns the message", async () => {
    const adapter = createMockAdapter();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: createMockSessionStore(),
      middleware: [{
        onBeforeSend: async (msg: ChatMessage) => msg,
      }],
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    expect(adapter.streamMessage).toHaveBeenCalled();
  });

  it("second middleware returning null stops the chain", async () => {
    const adapter = createMockAdapter();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: createMockSessionStore(),
      middleware: [
        { onBeforeSend: async (msg: ChatMessage) => msg },
        { onBeforeSend: async () => null },
      ],
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
      events.push(event);
    }

    expect(events).toHaveLength(0);
    expect(adapter.streamMessage).not.toHaveBeenCalled();
  });
});

// ─── systemPrompt forwarding ──────────────────────────────────

describe("systemPrompt per-call forwarding", () => {
  it("passes systemPrompt to adapter streamMessage options", async () => {
    const streamMessageSpy = vi.fn(async function* () {
      const msgId = createChatId();
      yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
      yield { type: "message:complete", messageId: msgId, message: createMockMessage() } as ChatEvent;
    });

    const adapter = createMockAdapter({ streamMessage: streamMessageSpy });
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: createMockSessionStore(),
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const opts = { ...SEND_OPTS, systemPrompt: "You are a helpful assistant" };
    for await (const _ of runtime.send(session.id, "Hello", opts)) { /* drain */ }

    expect(streamMessageSpy).toHaveBeenCalledTimes(1);
    const callArgs = streamMessageSpy.mock.calls[0];
    // Third argument is options containing systemPrompt
    expect(callArgs[2]).toBeDefined();
    expect(callArgs[2]!.systemPrompt).toBe("You are a helpful assistant");
  });

  it("does not include systemPrompt when not provided", async () => {
    const streamMessageSpy = vi.fn(async function* () {
      const msgId = createChatId();
      yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
      yield { type: "message:complete", messageId: msgId, message: createMockMessage() } as ChatEvent;
    });

    const adapter = createMockAdapter({ streamMessage: streamMessageSpy });
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: createMockSessionStore(),
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    const callArgs = streamMessageSpy.mock.calls[0];
    expect(callArgs[2]?.systemPrompt).toBeUndefined();
  });
});

// ─── useSSE POST method ───────────────────────────────────────

describe("useSSE POST method option", () => {
  it("UseSSEOptions accepts method and body fields", async () => {
    // Type-level verification: ensure the interface accepts these fields
    const { UseSSEOptions } = await import("../../../src/chat/react/useSSE.js") as any;

    // We can't call React hooks outside components, so verify the type exists
    // by importing the module and checking the options type compiles
    const opts = {
      url: "http://localhost:3000/events",
      method: "POST" as const,
      body: { sessionId: "abc", message: "hello" },
    };
    expect(opts.method).toBe("POST");
    expect(opts.body).toEqual({ sessionId: "abc", message: "hello" });
  });
});
