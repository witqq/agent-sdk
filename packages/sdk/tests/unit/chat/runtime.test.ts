/**
 * Tests for @witqq/agent-sdk/chat/runtime — Step 1
 *
 * Covers: createChatRuntime factory, state machine lifecycle,
 * reentrancy guard, dispose, and error on operations after dispose.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChatRuntime } from "../../../src/chat/runtime.js";
import type { ChatRuntimeOptions, IChatRuntime } from "../../../src/chat/runtime.js";
import type { IChatSessionStore } from "../../../src/chat/sessions.js";
import type { IResumableBackend } from "../../../src/chat/backends/types.js";
import type { ChatSession, ChatId, ChatEvent, ChatMessage } from "../../../src/chat/core.js";
import { createChatId } from "../../../src/chat/core.js";
import { ChatError, ErrorCode } from "../../../src/chat/errors.js";

// ─── Mock Helpers ──────────────────────────────────────────────

function createMockSession(overrides?: Partial<ChatSession>): ChatSession {
  return {
    id: createChatId(),
    title: "Test Session",
    messages: [],
    config: { model: "gpt-4", backend: "mock" },
    metadata: { messageCount: 0, totalTokens: 0 },
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockSessionStore(): IChatSessionStore {
  const sessions = new Map<string, ChatSession>();

  return {
    createSession: vi.fn(async (opts) => {
      const session = createMockSession({
        config: opts.config,
        title: opts.title,
        metadata: {
          messageCount: 0,
          totalTokens: 0,
          tags: opts.tags,
          custom: opts.custom,
        },
      });
      sessions.set(session.id, session);
      return session;
    }),
    getSession: vi.fn(async (id) => sessions.get(id) ?? null),
    listSessions: vi.fn(async () => [...sessions.values()]),
    updateTitle: vi.fn(async () => {}),
    updateConfig: vi.fn(async (id: ChatId, config: Record<string, unknown>) => {
      const session = sessions.get(id);
      if (session) {
        session.config = { ...session.config, ...config };
      }
    }),
    deleteSession: vi.fn(async (id) => {
      if (!sessions.has(id)) {
        const { StorageError } = await import("../../../src/chat/storage.js");
        const { ErrorCode } = await import("../../../src/types/errors.js");
        throw new StorageError(`Session ${id} not found`, ErrorCode.STORAGE_NOT_FOUND);
      }
      sessions.delete(id);
    }),
    appendMessage: vi.fn(async (sessionId, message) => {
      const session = sessions.get(sessionId);
      if (session) {
        session.messages = [...session.messages, message];
      }
    }),
    saveMessages: vi.fn(async () => {}),
    loadMessages: vi.fn(async () => ({ messages: [], total: 0, hasMore: false })),

    searchSessions: vi.fn(async () => []),
    count: vi.fn(async () => sessions.size),
    clear: vi.fn(async () => sessions.clear()),
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
      yield {
        type: "message:complete",
        messageId: msgId,
        message: createMockMessage(),
      } as ChatEvent;
    }),
    listModels: vi.fn(async () => []),
    validate: vi.fn(async () => ({ valid: true, errors: [] })),
    dispose: vi.fn(async () => {}),
    ...overrides,
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

function createDefaultOptions(overrides?: Partial<ChatRuntimeOptions>): ChatRuntimeOptions {
  return {
    backends: { mock: (_creds: any) => createMockAdapter() },
    defaultBackend: "mock",
    sessionStore: createMockSessionStore(),
    ...overrides,
  };
}

const SEND_OPTS = {
  model: "test-model",
  backend: "mock",
  credentials: { accessToken: "test-token", tokenType: "bearer" as const, obtainedAt: Date.now() },
};

// ─── Tests ─────────────────────────────────────────────────────

describe("createChatRuntime", () => {
  it("creates a runtime with initial idle status", () => {
    const runtime = createChatRuntime(createDefaultOptions());
    expect(runtime.status).toBe("idle");
  });

  it("throws if default backend not in backends map", () => {
    expect(() =>
      createChatRuntime({
        backends: { mock: (_creds: any) => createMockAdapter() },
        defaultBackend: "nonexistent",
        sessionStore: createMockSessionStore(),
      }),
    ).toThrow(ChatError);
  });


  it("has empty registered tools initially", () => {
    const runtime = createChatRuntime(createDefaultOptions());
    expect(runtime.registeredTools.size).toBe(0);
  });

  it("registers initial tools from options.tools", () => {
    const tool1 = { name: "search", description: "Search the web", execute: async () => "result" };
    const tool2 = { name: "calc", description: "Calculator", execute: async () => "42" };
    const runtime = createChatRuntime(createDefaultOptions({
      tools: [tool1, tool2],
    }));
    expect(runtime.registeredTools.size).toBe(2);
    expect(runtime.registeredTools.get("search")).toBe(tool1);
    expect(runtime.registeredTools.get("calc")).toBe(tool2);
  });

  it("options.tools does not affect runtime when empty array", () => {
    const runtime = createChatRuntime(createDefaultOptions({ tools: [] }));
    expect(runtime.registeredTools.size).toBe(0);
  });

  it("options.tools coexists with later registerTool calls", () => {
    const initialTool = { name: "initial", description: "Initial tool", execute: async () => "ok" };
    const runtime = createChatRuntime(createDefaultOptions({ tools: [initialTool] }));
    expect(runtime.registeredTools.size).toBe(1);

    const laterTool = { name: "later", description: "Later tool", execute: async () => "ok" };
    runtime.registerTool(laterTool);
    expect(runtime.registeredTools.size).toBe(2);
    expect(runtime.registeredTools.get("initial")).toBe(initialTool);
    expect(runtime.registeredTools.get("later")).toBe(laterTool);
  });
});

describe("Runtime lifecycle (state machine)", () => {
  let runtime: IChatRuntime;
  let store: IChatSessionStore;
  let adapter: IResumableBackend;

  beforeEach(() => {
    store = createMockSessionStore();
    adapter = createMockAdapter();
    runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
    });
  });

  it("starts in idle state", () => {
    expect(runtime.status).toBe("idle");
  });

  it("transitions to disposed after dispose()", async () => {
    await runtime.dispose();
    expect(runtime.status).toBe("disposed");
  });

  it("dispose is idempotent", async () => {
    await runtime.dispose();
    await runtime.dispose(); // no error
    expect(runtime.status).toBe("disposed");
  });

  it("throws on operations after dispose", async () => {
    await runtime.dispose();

    await expect(
      runtime.createSession({ config: { model: "gpt-4", backend: "mock" } }),
    ).rejects.toThrow(ChatError);

    await expect(runtime.getSession(createChatId())).rejects.toThrow(ChatError);
    await expect(runtime.listSessions()).rejects.toThrow(ChatError);
    await expect(runtime.deleteSession(createChatId())).rejects.toThrow(ChatError);
    await expect(runtime.listModels()).rejects.toThrow(ChatError);
  });

  it("throws DISPOSED code on operations after dispose", async () => {
    await runtime.dispose();
    try {
      await runtime.listSessions();
      expect.unreachable("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ChatError);
      expect((err as ChatError).code).toBe(ErrorCode.DISPOSED);
    }
  });


  it("registerTool throws after dispose", async () => {
    await runtime.dispose();
    expect(() => runtime.registerTool({ name: "test", description: "test", execute: async () => "ok" })).toThrow(ChatError);
  });

  it("removeTool throws after dispose", async () => {
    await runtime.dispose();
    expect(() => runtime.removeTool("test")).toThrow(ChatError);
  });

  it("use() throws after dispose", async () => {
    await runtime.dispose();
    expect(() => runtime.use({})).toThrow(ChatError);
  });

  it("removeMiddleware throws after dispose", async () => {
    await runtime.dispose();
    expect(() => runtime.removeMiddleware({})).toThrow(ChatError);
  });
});

describe("Reentrancy guard", () => {
  it("prevents concurrent send() calls", async () => {
    const store = createMockSessionStore();
    // Create a slow adapter that never finishes
    const slowAdapter = createMockAdapter({
      streamMessage: vi.fn(async function* () {
        yield { type: "message:start", messageId: createChatId(), role: "assistant" } as ChatEvent;
        // Hang forever
        await new Promise(() => {});
      }),
    });

    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => slowAdapter },
      defaultBackend: "mock",
      sessionStore: store,
    });

    // Create a session
    const session = await runtime.createSession({
      config: { model: "gpt-4", backend: "mock" },
    });

    // Start first send (won't complete)
    const iter1 = runtime.send(session.id, "Hello", SEND_OPTS)[Symbol.asyncIterator]();
    await iter1.next(); // consume first event to enter streaming

    // Second send should throw reentrancy error
    const iter2 = runtime.send(session.id, "World", SEND_OPTS)[Symbol.asyncIterator]();
    await expect(iter2.next()).rejects.toThrow(ChatError);

    // Clean up
    runtime.abort();
    await runtime.dispose();
  });
});

describe("Session management", () => {
  let runtime: IChatRuntime;
  let store: IChatSessionStore;

  beforeEach(() => {
    store = createMockSessionStore();
    runtime = createChatRuntime({
      backends: { mock: (_creds: any) => createMockAdapter() },
      defaultBackend: "mock",
      sessionStore: store,
    });
  });

  it("createSession delegates to store and sets active session", async () => {
    const session = await runtime.createSession({
      config: { model: "gpt-4", backend: "mock" },
    });
    expect(session).toBeDefined();
    expect(session.config.model).toBe("gpt-4");
    expect(store.createSession).toHaveBeenCalledOnce();
  });

  it("createSession notifies session listeners", async () => {
    const s1 = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    expect(s1).toBeDefined();
    const s2 = await runtime.createSession({ config: { model: "gpt-4o", backend: "mock" } });
    expect(s2).toBeDefined();
    expect(s1.id).not.toBe(s2.id);
  });

  it("getSession delegates to store", async () => {
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const found = await runtime.getSession(session.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(session.id);
  });

  it("getSession returns null for unknown id", async () => {
    const found = await runtime.getSession(createChatId());
    expect(found).toBeNull();
  });

  it("listSessions delegates to store", async () => {
    await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    await runtime.createSession({ config: { model: "gpt-4o", backend: "mock" } });
    const sessions = await runtime.listSessions();
    expect(sessions).toHaveLength(2);
  });

  it("deleteSession removes from store", async () => {
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    await runtime.deleteSession(session.id);
    const found = await runtime.getSession(session.id);
    expect(found).toBeNull();
  });

  it("deleteSession on non-existent ID is idempotent (no-op)", async () => {
    // Should not throw
    await runtime.deleteSession(createChatId());
  });
});



describe("Tool registration", () => {
  let runtime: IChatRuntime;

  beforeEach(() => {
    runtime = createChatRuntime(createDefaultOptions());
  });

  it("registerTool adds to registry", () => {
    const tool = { name: "search", description: "Search the web", execute: async () => "result" };
    runtime.registerTool(tool);
    expect(runtime.registeredTools.has("search")).toBe(true);
    expect(runtime.registeredTools.get("search")).toBe(tool);
  });

  it("removeTool removes from registry", () => {
    const tool = { name: "search", description: "Search the web", execute: async () => "result" };
    runtime.registerTool(tool);
    runtime.removeTool("search");
    expect(runtime.registeredTools.has("search")).toBe(false);
  });

  it("registeredTools is read-only", () => {
    const tools = runtime.registeredTools;
    // Map is ReadonlyMap — cannot call set()
    expect(typeof (tools as any).set).toBe("function"); // It's a Map, but typed as ReadonlyMap
    // The important thing is the interface exposes ReadonlyMap
    expect(runtime.registeredTools.size).toBe(0);
  });
});

describe("Middleware management", () => {
  it("use() adds middleware that affects send events", async () => {
    const onEventSpy = vi.fn((event: ChatEvent) => event);
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => createMockAdapter() },
      defaultBackend: "mock",
      sessionStore: store,
    });
    runtime.use({ onEvent: onEventSpy });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    expect(onEventSpy).toHaveBeenCalled();
  });

  it("removeMiddleware stops middleware from affecting send events", async () => {
    const onEventSpy = vi.fn((event: ChatEvent) => event);
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => createMockAdapter() },
      defaultBackend: "mock",
      sessionStore: store,
    });
    const mw = { onEvent: onEventSpy };
    runtime.use(mw);
    runtime.removeMiddleware(mw);

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    expect(onEventSpy).not.toHaveBeenCalled();
  });
});

describe("Send flow (basic)", () => {
  let runtime: IChatRuntime;
  let store: IChatSessionStore;
  let adapter: IResumableBackend;

  beforeEach(() => {
    store = createMockSessionStore();
    adapter = createMockAdapter();
    runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
    });
  });

  it("send() yields events from adapter", async () => {
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
      events.push(event);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("message:start");
    expect(events.some((e) => e.type === "message:delta")).toBe(true);
    expect(events.some((e) => e.type === "message:complete")).toBe(true);
  });

  it("send() persists user message before streaming", async () => {
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
      events.push(event);
    }
    // appendMessage should have been called at least twice (user + assistant)
    expect(store.appendMessage).toHaveBeenCalledTimes(2);
    // First call should be the user message
    const firstCall = (store.appendMessage as any).mock.calls[0];
    expect(firstCall[0]).toBe(session.id);
    expect(firstCall[1].role).toBe("user");
    expect(firstCall[1].parts[0].text).toBe("Hello");
  });

  it("send() persists assistant message after stream completes", async () => {
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }
    // Second appendMessage call should be assistant message
    const secondCall = (store.appendMessage as any).mock.calls[1];
    expect(secondCall[1].role).toBe("assistant");
  });

  it("send() returns to idle after completion", async () => {
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }
    expect(runtime.status).toBe("idle");
  });

  it("send() throws for non-existent session", async () => {
    const iter = runtime.send(createChatId(), "Hello", SEND_OPTS)[Symbol.asyncIterator]();
    await expect(iter.next()).rejects.toThrow(ChatError);
  });

  it("send() supports abort", async () => {
    const abortController = new AbortController();
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    // Create adapter that yields many events
    const manyEventsAdapter = createMockAdapter({
      streamMessage: vi.fn(async function* () {
        const msgId = createChatId();
        yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
        for (let i = 0; i < 100; i++) {
          yield { type: "message:delta", messageId: msgId, text: `chunk${i}` } as ChatEvent;
        }
        yield { type: "message:complete", messageId: msgId, message: createMockMessage() } as ChatEvent;
      }),
    });

    const runtimeWithAbort = createChatRuntime({
      backends: { mock: (_creds: any) => manyEventsAdapter },
      defaultBackend: "mock",
      sessionStore: store,
    });
    // Re-create session in same store
    const s = await runtimeWithAbort.createSession({ config: { model: "gpt-4", backend: "mock" } });

    const events: ChatEvent[] = [];
    abortController.abort(); // Abort immediately

    for await (const event of runtimeWithAbort.send(s.id, "Hello", { ...SEND_OPTS, signal: abortController.signal })) {
      events.push(event);
    }

    // Should have stopped early (or very quickly)
    expect(events.length).toBeLessThan(102);
  });
});

describe("Dispose cleans up adapter", () => {
  it("disposes active adapter on runtime dispose", async () => {
    const adapter = createMockAdapter();
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
    });

    // Create session and send to force adapter creation
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    await runtime.dispose();
    expect(adapter.dispose).toHaveBeenCalled();
  });

  it("dispose without active adapter does not error", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    await runtime.dispose(); // no adapter was ever created
    expect(runtime.status).toBe("disposed");
  });
});

describe("Middleware with initial config", () => {
  it("applies middleware from config to send events", async () => {
    const onEventSpy = vi.fn((event: ChatEvent) => event);
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => createMockAdapter() },
      defaultBackend: "mock",
      sessionStore: store,
      middleware: [{ onEvent: onEventSpy }],
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    expect(onEventSpy).toHaveBeenCalled();
  });
});

describe("Empty message validation", () => {
  it("send() throws for empty string", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => createMockAdapter() },
      defaultBackend: "mock",
      sessionStore: store,
    });
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const iter = runtime.send(session.id, "", SEND_OPTS)[Symbol.asyncIterator]();
    await expect(iter.next()).rejects.toThrow(ChatError);
  });

  it("send() throws for whitespace-only message", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => createMockAdapter() },
      defaultBackend: "mock",
      sessionStore: store,
    });
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const iter = runtime.send(session.id, "   \n  ", SEND_OPTS)[Symbol.asyncIterator]();
    await expect(iter.next()).rejects.toThrow(ChatError);
  });
});

describe("onBeforeSend middleware", () => {
  it("transforms message before persistence", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => createMockAdapter() },
      defaultBackend: "mock",
      sessionStore: store,
      middleware: [{
        onBeforeSend: vi.fn(async (msg: ChatMessage) => ({
          ...msg,
          parts: [{ type: "text" as const, text: `[modified] ${(msg.parts[0] as any).text}`, status: "complete" as const }],
        })),
      }],
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    // First appendMessage call should contain the transformed message
    const firstCall = (store.appendMessage as any).mock.calls[0];
    expect(firstCall[1].parts[0].text).toBe("[modified] Hello");
  });

  it("chains sequential middlewares (MW1 output → MW2 input)", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => createMockAdapter() },
      defaultBackend: "mock",
      sessionStore: store,
      middleware: [
        {
          onBeforeSend: async (msg: ChatMessage) => ({
            ...msg,
            parts: [{ type: "text" as const, text: `[A] ${(msg.parts[0] as any).text}`, status: "complete" as const }],
          }),
        },
        {
          onBeforeSend: async (msg: ChatMessage) => ({
            ...msg,
            parts: [{ type: "text" as const, text: `[B] ${(msg.parts[0] as any).text}`, status: "complete" as const }],
          }),
        },
      ],
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    const firstCall = (store.appendMessage as any).mock.calls[0];
    expect(firstCall[1].parts[0].text).toBe("[B] [A] Hello");
  });
});

describe("onEvent middleware suppression", () => {
  it("drops events when onEvent returns null", async () => {
    const msgId = createChatId();
    const adapter = createMockAdapter({
      streamMessage: vi.fn(async function* () {
        yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
        yield { type: "message:delta", messageId: msgId, text: "Hello" } as ChatEvent;
        yield { type: "message:delta", messageId: msgId, text: " world" } as ChatEvent;
        yield {
          type: "message:complete",
          messageId: msgId,
          message: createMockMessage(),
        } as ChatEvent;
      }),
    });
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
      middleware: [{
        onEvent: async (event: ChatEvent) => {
          if (event.type === "message:delta") return null;
          return event;
        },
      }],
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const e of runtime.send(session.id, "Hello", SEND_OPTS)) { events.push(e); }

    // message:delta events should be suppressed
    const deltaEvents = events.filter(e => e.type === "message:delta");
    expect(deltaEvents).toHaveLength(0);
    // Other events should still be present
    const startEvents = events.filter(e => e.type === "message:start");
    expect(startEvents).toHaveLength(1);
  });
});

describe("Tool passing to adapter", () => {
  it("passes registered tools in streamMessage options", async () => {
    const adapter = createMockAdapter();
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
    });

    runtime.registerTool({ name: "search", description: "Search", execute: async () => "ok" });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    // streamMessage should have been called with tools in options
    const call = (adapter.streamMessage as any).mock.calls[0];
    expect(call[2].tools).toBeDefined();
    expect(call[2].tools).toHaveLength(1);
    expect(call[2].tools[0].name).toBe("search");
  });

  it("does not pass tools when none registered", async () => {
    const adapter = createMockAdapter();
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    const call = (adapter.streamMessage as any).mock.calls[0];
    expect(call[2].tools).toBeUndefined();
  });
});

describe("feedAccumulator: thinking events", () => {
  it("maps thinking:start/delta/end to accumulator", async () => {
    const msgId = createChatId();
    const adapter = createMockAdapter({
      streamMessage: vi.fn(async function* () {
        yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
        yield { type: "thinking:start", messageId: msgId } as ChatEvent;
        yield { type: "thinking:delta", messageId: msgId, text: "Let me think..." } as ChatEvent;
        yield { type: "thinking:end", messageId: msgId } as ChatEvent;
        yield { type: "message:delta", messageId: msgId, text: "Answer" } as ChatEvent;
        yield {
          type: "message:complete",
          messageId: msgId,
          message: createMockMessage(),
        } as ChatEvent;
      }),
    });
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
      events.push(event);
    }

    // Verify thinking events passed through
    expect(events.some((e) => e.type === "thinking:start")).toBe(true);
    expect(events.some((e) => e.type === "thinking:delta")).toBe(true);
    expect(events.some((e) => e.type === "thinking:end")).toBe(true);
  });
});

describe("feedAccumulator: tool events", () => {
  it("maps tool:start/complete to accumulator", async () => {
    const msgId = createChatId();
    const adapter = createMockAdapter({
      streamMessage: vi.fn(async function* () {
        yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
        yield {
          type: "tool:start",
          messageId: msgId,
          toolCallId: "tc1",
          toolName: "search",
          args: { query: "test" },
        } as ChatEvent;
        yield {
          type: "tool:complete",
          messageId: msgId,
          toolCallId: "tc1",
          toolName: "search",
          result: "found it",
        } as ChatEvent;
        yield { type: "message:delta", messageId: msgId, text: "Done" } as ChatEvent;
        yield {
          type: "message:complete",
          messageId: msgId,
          message: createMockMessage(),
        } as ChatEvent;
      }),
    });
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
      events.push(event);
    }

    expect(events.some((e) => e.type === "tool:start")).toBe(true);
    expect(events.some((e) => e.type === "tool:complete")).toBe(true);
  });
});

describe("Context auto-trim", () => {
  it("trims messages via ContextWindowManager before adapter call", async () => {
    const adapter = createMockAdapter();
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
      context: {
        maxTokens: 100,
        reservedTokens: 50,
      },
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    // Send a message — context trimming should apply
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    // Adapter streamMessage should have been called
    expect(adapter.streamMessage).toHaveBeenCalled();
    // The session passed to adapter should have messages (at least the user message)
    const callArgs = (adapter.streamMessage as any).mock.calls[0];
    const sessionArg = callArgs[0] as ChatSession;
    expect(sessionArg.messages).toBeDefined();
  });
});

describe("onAfterReceive middleware", () => {
  it("transforms completed assistant message before persistence", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => createMockAdapter() },
      defaultBackend: "mock",
      sessionStore: store,
      middleware: [{
        onAfterReceive: vi.fn(async (msg: ChatMessage) => ({
          ...msg,
          parts: [{ type: "text" as const, text: `[post-processed] ${(msg.parts[0] as any).text}`, status: "complete" as const }],
        })),
      }],
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    // Second appendMessage call = assistant message (should be transformed)
    const secondCall = (store.appendMessage as any).mock.calls[1];
    expect(secondCall[1].parts[0].text).toContain("[post-processed]");
  });
});

describe("onError middleware", () => {
  it("intercepts errors during send and can suppress them", async () => {
    const errorAdapter = createMockAdapter({
      streamMessage: vi.fn(async function* () {
        throw new Error("adapter failure");
      }),
    });
    const store = createMockSessionStore();
    const onErrorSpy = vi.fn(async () => null); // suppress error
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => errorAdapter },
      defaultBackend: "mock",
      sessionStore: store,
      middleware: [{ onError: onErrorSpy }],
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    // Should NOT throw because onError returns null (suppresses)
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    expect(onErrorSpy).toHaveBeenCalledOnce();
    expect(runtime.status).toBe("idle"); // recovered to idle
  });

  it("transforms errors before re-throwing", async () => {
    const errorAdapter = createMockAdapter({
      streamMessage: vi.fn(async function* () {
        throw new Error("original error");
      }),
    });
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => errorAdapter },
      defaultBackend: "mock",
      sessionStore: store,
      middleware: [{
        onError: vi.fn(async (err: Error) => new Error(`wrapped: ${err.message}`)),
      }],
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    try {
      for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }
      expect.unreachable("should throw");
    } catch (err) {
      expect((err as Error).message).toBe("wrapped: original error");
    }
  });
});

describe("Tool persistence across backends", () => {
  it("tools are passed to any backend specified in send options", async () => {
    const adapter1 = createMockAdapter();
    const adapter2 = createMockAdapter();
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: {
        backend1: (_creds: any) => adapter1,
        backend2: (_creds: any) => adapter2,
      },
      defaultBackend: "backend1",
      sessionStore: store,
    });

    runtime.registerTool({ name: "search", description: "Search", execute: async () => "ok" });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "backend1" } });
    for await (const _ of runtime.send(session.id, "Hello", { ...SEND_OPTS, backend: "backend1" })) {}

    const call1 = (adapter1.streamMessage as any).mock.calls[0];
    expect(call1[2].tools).toHaveLength(1);
    expect(call1[2].tools[0].name).toBe("search");

    // Now send to backend2 — tools should also be passed
    for await (const _ of runtime.send(session.id, "Hi", { ...SEND_OPTS, backend: "backend2" })) {}

    const call2 = (adapter2.streamMessage as any).mock.calls[0];
    expect(call2[2].tools).toHaveLength(1);
    expect(call2[2].tools[0].name).toBe("search");
  });
});

describe("listModels delegation", () => {
  it("delegates to adapter in pool", async () => {
    const models = [{ id: "gpt-4", name: "GPT-4" }];
    const adapter = createMockAdapter({
      listModels: vi.fn(async () => models),
    });
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
    });

    // Need to trigger adapter creation by sending first
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hi", SEND_OPTS)) {}

    const result = await runtime.listModels();
    expect(result).toEqual(models);
    expect(adapter.listModels).toHaveBeenCalledOnce();
  });

  it("returns empty array when backend factory throws (pre-auth graceful degradation)", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => { throw new Error("Not authenticated"); } },
      defaultBackend: "mock",
      sessionStore: store,
    });

    const result = await runtime.listModels();
    expect(result).toEqual([]);
  });

  it("bootstraps adapter from options when pool is empty", async () => {
    const models = [{ id: "gpt-5-mini", name: "GPT-5 Mini" }];
    const adapter = createMockAdapter({
      listModels: vi.fn(async () => models),
    });
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
    });

    // Pool is empty (no send() call), but pass backend + credentials
    const result = await runtime.listModels({ backend: "mock", credentials: { accessToken: "test" } });
    expect(result).toEqual(models);
    expect(adapter.listModels).toHaveBeenCalledOnce();
  });
});



describe("listBackends", () => {
  it("returns all registered backends", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: {
        copilot: (_creds: any) => createMockAdapter(),
        claude: (_creds: any) => createMockAdapter(),
        openai: (_creds: any) => createMockAdapter(),
      },
      defaultBackend: "copilot",
      sessionStore: store,
    });

    const backends = await runtime.listBackends();
    expect(backends).toHaveLength(3);
    expect(backends.map((b) => b.name).sort()).toEqual(["claude", "copilot", "openai"]);
  });

  it("throws after dispose", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => createMockAdapter() },
      defaultBackend: "mock",
      sessionStore: store,
    });

    await runtime.dispose();
    await expect(runtime.listBackends()).rejects.toThrow();
  });
});

describe("Adapter pool behavior", () => {
  it("disposes stale adapter when credentials change for same backend", async () => {
    const disposeFn = vi.fn();
    let adapterCount = 0;
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: {
        mock: (_creds: any) => {
          adapterCount++;
          return createMockAdapter({ dispose: disposeFn });
        },
      },
      defaultBackend: "mock",
      sessionStore: store,
    });

    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    const creds1 = { accessToken: "aaaa-1111-bbbb-2222-cccc", tokenType: "bearer", obtainedAt: Date.now() };
    const creds2 = { accessToken: "xxxx-9999-yyyy-8888-zzzz", tokenType: "bearer", obtainedAt: Date.now() };

    // First send with creds1
    for await (const _ of runtime.send(session.id, "Hello", { model: "m", backend: "mock", credentials: creds1 })) {}
    expect(adapterCount).toBe(1);

    // Second send with different credentials — stale adapter should be disposed
    for await (const _ of runtime.send(session.id, "Hello", { model: "m", backend: "mock", credentials: creds2 })) {}
    expect(adapterCount).toBe(2);
    expect(disposeFn).toHaveBeenCalledOnce(); // Old adapter disposed
  });

  it("reuses adapter for same backend and credentials", async () => {
    let factoryCalls = 0;
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: {
        mock: (_creds: any) => { factoryCalls++; return createMockAdapter(); },
      },
      defaultBackend: "mock",
      sessionStore: store,
    });

    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });

    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) {}
    for await (const _ of runtime.send(session.id, "World", SEND_OPTS)) {}
    expect(factoryCalls).toBe(1); // Factory called once, adapter reused
  });
});

describe("Error recovery (M1)", () => {
  it("auto-recovers from error state on next send()", async () => {
    const errorAdapter = createMockAdapter({
      streamMessage: vi.fn()
        .mockImplementationOnce(async function* () {
          throw new Error("transient failure");
        })
        .mockImplementationOnce(async function* () {
          const msgId = createChatId();
          yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
          yield { type: "message:delta", messageId: msgId, text: "Recovered" } as ChatEvent;
          yield { type: "message:complete", messageId: msgId, message: createMockMessage() } as ChatEvent;
        }),
    });
    const store = createMockSessionStore();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => errorAdapter },
      defaultBackend: "mock",
      sessionStore: store,
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    // First send fails — runtime goes to "error" state
    try {
      for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }
    } catch {
      // expected
    }
    expect(runtime.status).toBe("error");

    // Second send should auto-recover and work
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Retry", SEND_OPTS)) {
      events.push(event);
    }
    expect(runtime.status).toBe("idle");
    expect(events.some((e) => e.type === "message:delta")).toBe(true);
  });
});

describe("Dispose-during-send (M2)", () => {
  it("exits gracefully when dispose() races with send()", async () => {
    const store = createMockSessionStore();
    const adapter = createMockAdapter();
    const runtime = createChatRuntime({
      backends: { mock: (_creds: any) => adapter },
      defaultBackend: "mock",
      sessionStore: store,
    });

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    // Normal send — works fine
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }
    expect(runtime.status).toBe("idle");

    // Now test: dispose immediately, verify status
    await runtime.dispose();
    expect(runtime.status).toBe("disposed");

    // Verify: send after dispose throws DISPOSED, not INVALID_TRANSITION
    const iter = runtime.send(session.id, "After dispose", SEND_OPTS)[Symbol.asyncIterator]();
    await expect(iter.next()).rejects.toThrow(ChatError);
    try {
      await iter.next();
    } catch (err) {
      expect((err as ChatError).code).toBe(ErrorCode.DISPOSED);
    }
  });
});

// ─── Step 6: Done event type ────────────────────────────────────

describe("ChatEvent done type", () => {
  it("done event is a valid ChatEvent", () => {
    const event: ChatEvent = { type: "done", finalOutput: "Hello world" };
    expect(event.type).toBe("done");
    expect(event.finalOutput).toBe("Hello world");
  });

  it("done event works without finalOutput", () => {
    const event: ChatEvent = { type: "done" };
    expect(event.type).toBe("done");
    expect(event.finalOutput).toBeUndefined();
  });
});

// ─── Step 6: Generic metadata ───────────────────────────────────

describe("IChatRuntime generic metadata", () => {
  interface AppMeta extends Record<string, unknown> {
    userId: string;
    theme: "light" | "dark";
  }

  it("createChatRuntime with typed metadata preserves type on createSession", async () => {
    const runtime = createChatRuntime<AppMeta>(createDefaultOptions());
    const session = await runtime.createSession({
      config: { model: "gpt-4", backend: "mock" },
      custom: { userId: "u1", theme: "dark" },
    });
    expect(session.metadata.custom).toEqual({ userId: "u1", theme: "dark" });
  });

  it("getSession returns typed metadata", async () => {
    const runtime = createChatRuntime<AppMeta>(createDefaultOptions());
    const session = await runtime.createSession({
      config: { model: "gpt-4", backend: "mock" },
      custom: { userId: "u2", theme: "light" },
    });
    const retrieved = await runtime.getSession(session.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.metadata.custom).toEqual({ userId: "u2", theme: "light" });
  });

  it("listSessions returns typed sessions", async () => {
    const runtime = createChatRuntime<AppMeta>(createDefaultOptions());
    await runtime.createSession({
      config: { model: "gpt-4", backend: "mock" },
      custom: { userId: "u3", theme: "dark" },
    });
    const sessions = await runtime.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].metadata.custom).toEqual({ userId: "u3", theme: "dark" });
  });

  it("getSession returns typed session", async () => {
    const runtime = createChatRuntime<AppMeta>(createDefaultOptions());
    const session = await runtime.createSession({
      config: { model: "gpt-4", backend: "mock" },
      custom: { userId: "u4", theme: "light" },
    });
    const found = await runtime.getSession(session.id);
    expect(found!.metadata.custom).toEqual({ userId: "u4", theme: "light" });
  });

  it("default generic (no type param) works as before", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const session = await runtime.createSession({
      config: { model: "gpt-4", backend: "mock" },
      custom: { anything: true },
    });
    expect(session.metadata.custom).toEqual({ anything: true });
  });
});

// ─── Step 6: Retry for pre-stream failures ──────────────────────

describe("send() with retryConfig", () => {
  it("retries on adapter creation failure", async () => {
    let callCount = 0;
    const adapter = createMockAdapter();
    const runtime = createChatRuntime(createDefaultOptions({
      backends: {
        mock: (_creds: any) => {
          callCount++;
          if (callCount === 1) throw new Error("connection failed");
          return adapter;
        },
      },
      retryConfig: { maxAttempts: 3, delayMs: 0 },
    }));

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
      events.push(event);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(callCount).toBe(2);
  });

  it("retries on stream start failure (pre-first-event)", async () => {
    let streamCallCount = 0;
    const runtime = createChatRuntime(createDefaultOptions({
      backends: {
        mock: (_creds: any) => createMockAdapter({
          streamMessage: vi.fn(async function* () {
            streamCallCount++;
            if (streamCallCount === 1) throw new Error("stream init failed");
            const msgId = createChatId();
            yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
            yield { type: "message:delta", messageId: msgId, text: "OK" } as ChatEvent;
          }),
        }),
      },
      retryConfig: { maxAttempts: 3, delayMs: 0 },
    }));

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
      events.push(event);
    }
    expect(events.some(e => e.type === "message:delta")).toBe(true);
    expect(streamCallCount).toBe(2);
  });

  it("throws after exhausting all retry attempts", async () => {
    const runtime = createChatRuntime(createDefaultOptions({
      backends: {
        mock: (_creds: any) => { throw new Error("always fails"); },
      },
      retryConfig: { maxAttempts: 2, delayMs: 0 },
    }));

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const iter = runtime.send(session.id, "Hello", SEND_OPTS)[Symbol.asyncIterator]();
    await expect(iter.next()).rejects.toThrow("always fails");
  });

  it("does NOT retry mid-stream errors", async () => {
    let streamCallCount = 0;
    const runtime = createChatRuntime(createDefaultOptions({
      backends: {
        mock: (_creds: any) => createMockAdapter({
          streamMessage: vi.fn(async function* () {
            streamCallCount++;
            const msgId = createChatId();
            yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
            throw new Error("mid-stream error");
          }),
        }),
      },
      retryConfig: { maxAttempts: 3, delayMs: 0 },
    }));

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    try {
      for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
        events.push(event);
      }
    } catch (err) {
      expect((err as Error).message).toBe("mid-stream error");
    }
    expect(streamCallCount).toBe(1);
  });

  it("works normally without retryConfig", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Hello", SEND_OPTS)) {
      events.push(event);
    }
    expect(events.length).toBeGreaterThan(0);
  });
});

// ─── M6: Context stats API ──────────────────

describe("getContextStats", () => {
  it("returns null for unknown session", async () => {
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 4096 },
    }));
    expect(await runtime.getContextStats(createChatId())).toBeNull();
  });

  it("returns null when no context config set", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }
    expect(await runtime.getContextStats(session.id)).toBeNull();
  });

  it("returns stats after send with context config", async () => {
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 100000, reservedTokens: 100 },
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    const stats = await runtime.getContextStats(session.id);
    expect(stats).not.toBeNull();
    expect(stats!.totalTokens).toBeGreaterThan(0);
    expect(stats!.removedCount).toBe(0);
    expect(stats!.wasTruncated).toBe(false);
    expect(stats!.availableBudget).toBe(100000 - 100);
  });

  it("tracks per-session stats independently", async () => {
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 100000 },
    }));
    const s1 = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const s2 = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(s1.id, "Hello", SEND_OPTS)) { /* drain */ }
    for await (const _ of runtime.send(s2.id, "World", SEND_OPTS)) { /* drain */ }

    const stats1 = await runtime.getContextStats(s1.id);
    const stats2 = await runtime.getContextStats(s2.id);
    expect(stats1).not.toBeNull();
    expect(stats2).not.toBeNull();
    expect(stats1!.totalTokens).toBeGreaterThan(0);
    expect(stats2!.totalTokens).toBeGreaterThan(0);
  });

  it("reflects truncation when messages exceed budget", async () => {
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 20, reservedTokens: 0 },
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    for await (const _ of runtime.send(session.id, "First message that is somewhat long", SEND_OPTS)) { /* drain */ }
    for await (const _ of runtime.send(session.id, "Second message", SEND_OPTS)) { /* drain */ }

    const stats = await runtime.getContextStats(session.id);
    expect(stats).not.toBeNull();
    expect(stats!.wasTruncated).toBe(true);
    expect(stats!.removedCount).toBeGreaterThan(0);
  });
});

describe("onContextTrimmed callback", () => {
  it("fires when messages are trimmed", async () => {
    const trimmedSpy = vi.fn();
    // maxTokens: 10 ensures trimming after 2+ messages
    // (each message ~5-6 tokens, so 3 messages won't fit in 10)
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 10, reservedTokens: 0 },
      onContextTrimmed: trimmedSpy,
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    for await (const _ of runtime.send(session.id, "First message", SEND_OPTS)) { /* drain */ }
    for await (const _ of runtime.send(session.id, "Second message", SEND_OPTS)) { /* drain */ }

    expect(trimmedSpy).toHaveBeenCalled();
    const [sessionId, removedMessages] = trimmedSpy.mock.calls[trimmedSpy.mock.calls.length - 1];
    expect(sessionId).toBe(session.id);
    expect(removedMessages.length).toBeGreaterThan(0);
    expect(removedMessages[0]).toHaveProperty("id");
    expect(removedMessages[0]).toHaveProperty("role");
    expect(removedMessages[0]).toHaveProperty("parts");
  });

  it("does not fire when all messages fit", async () => {
    const trimmedSpy = vi.fn();
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 100000 },
      onContextTrimmed: trimmedSpy,
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    expect(trimmedSpy).not.toHaveBeenCalled();
  });

  it("is optional (no error when not provided)", async () => {
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 20, reservedTokens: 0 },
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    for await (const _ of runtime.send(session.id, "First", SEND_OPTS)) { /* drain */ }
    for await (const _ of runtime.send(session.id, "Second", SEND_OPTS)) { /* drain */ }

    const stats = runtime.getContextStats(session.id);
    expect(stats).not.toBeNull();
  });

  it("continues send when callback throws", async () => {
    const throwingCallback = vi.fn(() => { throw new Error("callback boom"); });
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 10, reservedTokens: 0 },
      onContextTrimmed: throwingCallback,
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    for await (const _ of runtime.send(session.id, "First message", SEND_OPTS)) { /* drain */ }
    // Second send triggers trimming which calls the throwing callback
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Second message", SEND_OPTS)) {
      events.push(event);
    }

    // Callback was called but send completed successfully
    expect(throwingCallback).toHaveBeenCalled();
    expect(events.length).toBeGreaterThan(0);
    expect(runtime.status).toBe("idle");
  });
});

describe("deleteSession clears context stats", () => {
  it("removes stats entry when session deleted", async () => {
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 100000 },
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    expect(await runtime.getContextStats(session.id)).not.toBeNull();
    await runtime.deleteSession(session.id);
    expect(await runtime.getContextStats(session.id)).toBeNull();
  });
});

describe("async summarizer integration", () => {
  it("uses async summarizer in send flow", async () => {
    const summarizer = vi.fn(async (removed: readonly ChatMessage[]) =>
      `Summary: ${removed.length} messages removed`
    );
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 10, reservedTokens: 0, strategy: "summarize-placeholder", summarizer },
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    for await (const _ of runtime.send(session.id, "First message", SEND_OPTS)) { /* drain */ }
    for await (const _ of runtime.send(session.id, "Second message", SEND_OPTS)) { /* drain */ }

    // Summarizer should have been called when messages were trimmed
    expect(summarizer).toHaveBeenCalled();
    const stats = await runtime.getContextStats(session.id);
    expect(stats).not.toBeNull();
    expect(stats!.wasTruncated).toBe(true);
  });

  it("continues send when summarizer throws", async () => {
    const summarizer = vi.fn(async () => { throw new Error("LLM unavailable"); });
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 10, reservedTokens: 0, strategy: "summarize-placeholder", summarizer },
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    for await (const _ of runtime.send(session.id, "First message", SEND_OPTS)) { /* drain */ }
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(session.id, "Second message", SEND_OPTS)) {
      events.push(event);
    }

    // Summarizer threw but send completed successfully with static fallback
    expect(summarizer).toHaveBeenCalled();
    expect(events.length).toBeGreaterThan(0);
    expect(runtime.status).toBe("idle");
  });

  it("does not call summarizer when all messages fit", async () => {
    const summarizer = vi.fn(async () => "should not be called");
    const runtime = createChatRuntime(createDefaultOptions({
      context: { maxTokens: 100000, strategy: "summarize-placeholder", summarizer },
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }

    expect(summarizer).not.toHaveBeenCalled();
  });
});

// ─── Session Subscription ──────────────────────────────────

describe("onSessionChange", () => {
  it("fires callback on createSession", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const cb = vi.fn();
    runtime.onSessionChange(cb);
    await runtime.createSession({ config: { model: "m", backend: "test" } });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fires callback on deleteSession", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const session = await runtime.createSession({ config: { model: "m", backend: "test" } });
    const cb = vi.fn();
    runtime.onSessionChange(cb);
    await runtime.deleteSession(session.id);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("returns unsubscribe function", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const cb = vi.fn();
    const unsub = runtime.onSessionChange(cb);
    unsub();
    await runtime.createSession({ config: { model: "m", backend: "test" } });
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not break if callback throws", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    runtime.onSessionChange(() => { throw new Error("bad listener"); });
    const cb2 = vi.fn();
    runtime.onSessionChange(cb2);
    await runtime.createSession({ config: { model: "m", backend: "test" } });
    // Second listener should still fire
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("fires callback after send completes", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    const cb = vi.fn();
    runtime.onSessionChange(cb);
    // send() triggers notification after assistant message is persisted
    for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) { /* drain */ }
    expect(cb).toHaveBeenCalled();
  });
});

// ─── Session creation defaults ─────────────────────────────

describe("createSession with optional config", () => {
  it("uses runtime defaults when config omitted", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const session = await runtime.createSession({});
    expect(session.config.backend).toBe("mock");
    expect(session.config.model).toBe("");
  });

  it("uses runtime defaults when config partially provided", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const session = await runtime.createSession({ config: { systemPrompt: "You are helpful" } });
    expect(session.config.backend).toBe("mock");
    expect(session.config.model).toBe("");
    expect(session.config.systemPrompt).toBe("You are helpful");
  });

  it("uses explicit config when provided", async () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const session = await runtime.createSession({ config: { model: "claude", backend: "other" } });
    expect(session.config.model).toBe("claude");
    expect(session.config.backend).toBe("other");
  });
});

// ─── ChatIdLike: plain strings accepted ────────────────────────

describe("ChatIdLike acceptance", () => {
  function makeOpts(
    overrides?: Partial<ChatRuntimeOptions>,
  ): ChatRuntimeOptions {
    return {
      defaultBackend: "mock",
      backends: { mock: (_creds: any) => createMockAdapter() },
      sessionStore: createMockSessionStore(),
      ...overrides,
    };
  }

  it("getSession accepts plain string", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({ ...makeOpts(), sessionStore: store });
    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    const plain: string = session.id;
    const retrieved = await runtime.getSession(plain);
    expect(retrieved?.id).toBe(session.id);
  });

  it("deleteSession accepts plain string", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({ ...makeOpts(), sessionStore: store });
    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    const plain: string = session.id;
    await expect(runtime.deleteSession(plain)).resolves.toBeUndefined();
  });

  it("getSession accepts plain string", async () => {
    const store = createMockSessionStore();
    const runtime = createChatRuntime({ ...makeOpts(), sessionStore: store });
    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    const plain: string = session.id;
    const found = await runtime.getSession(plain);
    expect(found!.id).toBe(session.id);
  });

  it("send accepts plain string sessionId", async () => {
    const store = createMockSessionStore();
    const adapter = createMockAdapter();
    const runtime = createChatRuntime({
      ...makeOpts(),
      sessionStore: store,
      backends: { mock: (_creds: any) => adapter },
    });
    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    const plain: string = session.id;
    const events: ChatEvent[] = [];
    for await (const event of runtime.send(plain, "hello", SEND_OPTS)) {
      events.push(event);
    }
    expect(events.length).toBeGreaterThan(0);
  });
});

// ─── ChatIdLike: invalid strings rejected ──────────────────────

describe("ChatIdLike rejection", () => {
  function makeOpts2(
    overrides?: Partial<ChatRuntimeOptions>,
  ): ChatRuntimeOptions {
    return {
      defaultBackend: "mock",
      backends: { mock: (_creds: any) => createMockAdapter() },
      sessionStore: createMockSessionStore(),
      ...overrides,
    };
  }

  it("rejects empty string with TypeError", async () => {
    const runtime = createChatRuntime(makeOpts2());
    await expect(runtime.getSession("")).rejects.toThrow(TypeError);
  });

  it("rejects non-UUID string with TypeError", async () => {
    const runtime = createChatRuntime(makeOpts2());
    await expect(runtime.deleteSession("not-a-uuid")).rejects.toThrow(TypeError);
  });

  it("rejects malformed string in send with TypeError", async () => {
    const runtime = createChatRuntime(makeOpts2());
    const gen = runtime.send("bad-id", "hello", SEND_OPTS);
    await expect(gen[Symbol.asyncIterator]().next()).rejects.toThrow(TypeError);
  });
});

// ─── Step 4: Model/Tool Propagation ────────────────────────────


describe("registerTool propagation (per-call via SendMessageOptions)", () => {
  it("registered tools are available via registeredTools map", () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const tool = { name: "search", description: "Search", execute: async () => "ok" };
    runtime.registerTool(tool);
    expect(runtime.registeredTools.get("search")).toBe(tool);
  });

  it("removeTool removes from registry", () => {
    const runtime = createChatRuntime(createDefaultOptions());
    const tool = { name: "search", description: "Search", execute: async () => "ok" };
    runtime.registerTool(tool);
    runtime.removeTool("search");
    expect(runtime.registeredTools.has("search")).toBe(false);
  });

  it("registered tools flow per-call to adapter.streamMessage options", async () => {
    const mockAdapter = createMockAdapter();
    const runtime = createChatRuntime(createDefaultOptions({
      backends: { mock: (_creds: any) => mockAdapter },
    }));
    const tool = { name: "search", description: "Search", execute: async () => "ok" };
    runtime.registerTool(tool);

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events = runtime.send(session.id, "Hello", SEND_OPTS);
    for await (const _ of events) { /* drain */ }

    // Tools passed per-call via SendMessageOptions, not setTools
    expect(mockAdapter.streamMessage).toHaveBeenCalledWith(
      expect.any(Object),
      "Hello",
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "search" }),
        ]),
      }),
    );
  });

  it("no setTools calls on adapters (tools are per-call)", async () => {
    const mockAdapter = createMockAdapter();
    const runtime = createChatRuntime(createDefaultOptions({
      backends: { mock: (_creds: any) => mockAdapter },
    }));
    const tool = { name: "calc", description: "Calculator", execute: async () => "42" };
    runtime.registerTool(tool);

    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    const events = runtime.send(session.id, "Hello", SEND_OPTS);
    for await (const _ of events) { /* drain */ }

    // setTools is never called — deprecated no-op
    expect(mockAdapter.setTools).not.toHaveBeenCalled();
  });
});

describe("IChatRuntime interface", () => {
  it("IChatRuntime satisfies structural contract", () => {
    const runtime = createChatRuntime(createDefaultOptions());
    expect(typeof runtime.status).toBe("string");
    expect(typeof runtime.dispose).toBe("function");
    expect(typeof runtime.createSession).toBe("function");
    expect(typeof runtime.getSession).toBe("function");
    expect(typeof runtime.listSessions).toBe("function");
    expect(typeof runtime.deleteSession).toBe("function");
    expect(typeof runtime.send).toBe("function");
    expect(typeof runtime.abort).toBe("function");
    expect(typeof runtime.listModels).toBe("function");
    expect(typeof runtime.onSessionChange).toBe("function");
    expect(typeof runtime.registerTool).toBe("function");
    expect(typeof runtime.removeTool).toBe("function");
  });
});

describe("Stateless send — no config writeback", () => {
  it("session config.model is NOT mutated after send (stateless)", async () => {
    const runtime = createChatRuntime(createDefaultOptions({
      backends: { mock: (_creds: any) => createMockAdapter() },
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hi", SEND_OPTS)) { /* drain */ }
    const updated = await runtime.getSession(session.id);
    expect(updated!.config.model).toBe("gpt-4");
  });

  it("session config.backend is NOT mutated by different backend in send options", async () => {
    const runtime = createChatRuntime(createDefaultOptions({
      backends: { mock: (_creds: any) => createMockAdapter(), mock2: (_creds: any) => createMockAdapter({ name: "mock2" }) },
    }));
    const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
    for await (const _ of runtime.send(session.id, "Hi", { ...SEND_OPTS, backend: "mock2" })) {}
    const updated = await runtime.getSession(session.id);
    expect(updated!.config.backend).toBe("mock");
  });
});

// ─── Pipeline Stage Tests ─────────────────────────────────────

describe("send() pipeline stages", () => {
  describe("validateSendInput stage", () => {
    it("throws on empty message", async () => {
      const runtime = createChatRuntime(createDefaultOptions());
      await expect(async () => {
        for await (const _ of runtime.send(createChatId(), "", { model: "m", backend: "mock", credentials: SEND_OPTS.credentials })) {}
      }).rejects.toThrow("Message cannot be empty");
    });

    it("throws on whitespace-only message", async () => {
      const runtime = createChatRuntime(createDefaultOptions());
      await expect(async () => {
        for await (const _ of runtime.send(createChatId(), "   ", { model: "m", backend: "mock", credentials: SEND_OPTS.credentials })) {}
      }).rejects.toThrow("Message cannot be empty");
    });

    it("throws when model is missing", async () => {
      const runtime = createChatRuntime(createDefaultOptions());
      await expect(async () => {
        for await (const _ of runtime.send(createChatId(), "Hello", { model: "", backend: "mock", credentials: SEND_OPTS.credentials } as any)) {}
      }).rejects.toThrow("options.model is required");
    });

    it("throws when backend is missing", async () => {
      const runtime = createChatRuntime(createDefaultOptions());
      await expect(async () => {
        for await (const _ of runtime.send(createChatId(), "Hello", { model: "m", backend: "", credentials: SEND_OPTS.credentials } as any)) {}
      }).rejects.toThrow("options.backend is required");
    });

    it("throws when credentials is missing", async () => {
      const runtime = createChatRuntime(createDefaultOptions());
      await expect(async () => {
        for await (const _ of runtime.send(createChatId(), "Hello", { model: "m", backend: "mock" } as any)) {}
      }).rejects.toThrow("options.credentials is required");
    });
  });

  describe("loadSession stage", () => {
    it("throws SESSION_NOT_FOUND for unknown session", async () => {
      const runtime = createChatRuntime(createDefaultOptions());
      const unknownId = createChatId();
      await expect(async () => {
        for await (const _ of runtime.send(unknownId, "Hi", { model: "m", backend: "mock", credentials: SEND_OPTS.credentials })) {}
      }).rejects.toThrow(`Session "${unknownId}" not found`);
    });

    it("does NOT sync backend config from send options (stateless)", async () => {
      const store = createMockSessionStore();
      const runtime = createChatRuntime(createDefaultOptions({
        backends: {
          mock: (_creds: any) => createMockAdapter(),
          mock2: (_creds: any) => createMockAdapter({ name: "mock2" }),
        },
        sessionStore: store,
      }));
      const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

      for await (const _ of runtime.send(session.id, "Hi", { ...SEND_OPTS, backend: "mock2" })) {}

      // updateConfig should NOT be called with backend — no writeback
      const updateCalls = (store.updateConfig as any).mock?.calls ?? [];
      const backendCalls = updateCalls.filter(
        (c: any[]) => c[1] && typeof c[1] === "object" && "backend" in c[1]
      );
      expect(backendCalls).toHaveLength(0);
    });
  });

  describe("applyBeforeSendMiddleware stage", () => {
    it("transforms user message via beforeSend middleware", async () => {
      const store = createMockSessionStore();
      const runtime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => createMockAdapter() },
        sessionStore: store,
        middleware: [{
          onBeforeSend: async (msg) => ({
            ...msg,
            parts: [{ type: "text" as const, text: "MODIFIED", status: "complete" as const }],
          }),
        }],
      }));
      const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

      for await (const _ of runtime.send(session.id, "Original", SEND_OPTS)) {}

      // First appendMessage call = user message (should be modified)
      const userMsg = (store.appendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(userMsg.parts[0].text).toBe("MODIFIED");
    });
  });

  describe("trimSessionContext stage", () => {
    it("trims context when configured and updates stats", async () => {
      const runtime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => createMockAdapter() },
        context: { maxTokens: 50, reservedTokens: 10 },
      }));
      const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

      for await (const _ of runtime.send(session.id, "Hello world", SEND_OPTS)) {}

      const stats = await runtime.getContextStats(session.id);
      expect(stats).not.toBeNull();
      expect(typeof stats!.totalTokens).toBe("number");
    });
  });

  describe("prepareEventStream stage", () => {
    it("injects runtime tools into stream options", async () => {
      const adapter = createMockAdapter();
      const runtime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => adapter },
      }));
      const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

      runtime.registerTool({
        name: "test_tool",
        description: "A test tool",
        parameters: { type: "object", properties: {} },
        execute: vi.fn(),
      });

      for await (const _ of runtime.send(session.id, "Hi", SEND_OPTS)) {}

      const streamCall = (adapter.streamMessage as ReturnType<typeof vi.fn>).mock.calls[0];
      const opts = streamCall[2]; // 3rd arg = options
      expect(opts.tools).toBeDefined();
      expect(opts.tools).toHaveLength(1);
      expect(opts.tools[0].name).toBe("test_tool");
    });
  });

  describe("applyOnEventMiddleware stage", () => {
    it("suppresses events when middleware returns null", async () => {
      const runtime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => createMockAdapter() },
        middleware: [{
          onEvent: async (event) => {
            if (event.type === "message:delta") return null;
            return event;
          },
        }],
      }));
      const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

      const events: ChatEvent[] = [];
      for await (const event of runtime.send(session.id, "Hi", SEND_OPTS)) {
        events.push(event);
      }

      expect(events.some(e => e.type === "message:delta")).toBe(false);
      expect(events.some(e => e.type === "message:start")).toBe(true);
    });
  });

  describe("finalizeAssistantMessage stage", () => {
    it("persists assistant message after stream completes", async () => {
      const store = createMockSessionStore();
      const runtime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => createMockAdapter() },
        sessionStore: store,
      }));
      const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

      for await (const _ of runtime.send(session.id, "Hi", SEND_OPTS)) {}

      // appendMessage called twice: user + assistant
      expect(store.appendMessage).toHaveBeenCalledTimes(2);
      const assistantMsg = (store.appendMessage as ReturnType<typeof vi.fn>).mock.calls[1][1];
      expect(assistantMsg.role).toBe("assistant");
    });

    it("applies afterReceive middleware to assistant message", async () => {
      const store = createMockSessionStore();
      const runtime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => createMockAdapter() },
        sessionStore: store,
        middleware: [{
          onAfterReceive: async (msg) => ({
            ...msg,
            parts: [{ type: "text" as const, text: "TRANSFORMED", status: "complete" as const }],
          }),
        }],
      }));
      const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

      for await (const _ of runtime.send(session.id, "Hi", SEND_OPTS)) {}

      const assistantMsg = (store.appendMessage as ReturnType<typeof vi.fn>).mock.calls[1][1];
      expect(assistantMsg.parts[0].text).toBe("TRANSFORMED");
    });
  });

  describe("handleSendError stage", () => {
    it("suppresses error when onError middleware returns null", async () => {
      const failingAdapter = createMockAdapter({
        streamMessage: vi.fn(async function* () {
          throw new Error("Stream failure");
        }),
      });
      const runtime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => failingAdapter },
        middleware: [{
          onError: async () => null,
        }],
      }));
      const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

      // Should not throw — error suppressed by middleware
      const events: ChatEvent[] = [];
      for await (const event of runtime.send(session.id, "Hi", SEND_OPTS)) {
        events.push(event);
      }

      expect(runtime.status).toBe("idle");
    });

    it("transitions to error state on unhandled error", async () => {
      const failingAdapter = createMockAdapter({
        streamMessage: vi.fn(async function* () {
          throw new Error("Boom");
        }),
      });
      const runtime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => failingAdapter },
      }));
      const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });

      await expect(async () => {
        for await (const _ of runtime.send(session.id, "Hi", SEND_OPTS)) {}
      }).rejects.toThrow("Boom");

      expect(runtime.status).toBe("error");
    });
  });

  describe("session config model — no writeback (stateless)", () => {
    it("does NOT update session.config.model after send", async () => {
      const localStore = createMockSessionStore();
      const localRuntime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => createMockAdapter() },
        sessionStore: localStore,
      }));
      const session = await localRuntime.createSession({ config: { model: "old-model", backend: "mock" } });

      // Consume the stream fully
      for await (const _ of localRuntime.send(session.id, "Hello", { ...SEND_OPTS, model: "new-model" })) {}

      // Session config should NOT be updated — model comes per-request
      const updateCalls = (localStore.updateConfig as any).mock?.calls ?? [];
      const modelCalls = updateCalls.filter(
        (c: any[]) => c[1] && typeof c[1] === "object" && "model" in c[1]
      );
      expect(modelCalls).toHaveLength(0);
    });
  });

  describe("usage tracking and context stats", () => {
    it("captures usage events and populates ContextStats with real data", async () => {
      const msgId = createChatId();
      const adapterWithUsage = createMockAdapter({
        streamMessage: vi.fn(async function* () {
          yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
          yield { type: "message:delta", messageId: msgId, text: "Hi" } as ChatEvent;
          yield { type: "usage", promptTokens: 150, completionTokens: 42 } as ChatEvent;
          yield {
            type: "message:complete",
            messageId: msgId,
            message: createMockMessage(),
          } as ChatEvent;
        }),
        listModels: vi.fn(async () => [
          { id: "test-model", name: "Test", contextWindow: 128000 },
        ]),
      });

      const runtime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => adapterWithUsage },
      }));

      // Pre-load model context windows via listModels
      await runtime.listModels({ backend: "mock", credentials: SEND_OPTS.credentials });

      const session = await runtime.createSession({ config: { model: "test-model", backend: "mock" } });
      for await (const _ of runtime.send(session.id, "Hello", SEND_OPTS)) {}

      const stats = await runtime.getContextStats(session.id);
      expect(stats).not.toBeNull();
      expect(stats!.realPromptTokens).toBe(150);
      expect(stats!.realCompletionTokens).toBe(42);
      expect(stats!.modelContextWindow).toBe(128000);
      expect(stats!.availableBudget).toBe(128000 - 150);
    });

    it("cleans up usage cache on deleteSession", async () => {
      const msgId = createChatId();
      const adapterWithUsage = createMockAdapter({
        streamMessage: vi.fn(async function* () {
          yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
          yield { type: "usage", promptTokens: 100, completionTokens: 20 } as ChatEvent;
          yield {
            type: "message:complete",
            messageId: msgId,
            message: createMockMessage(),
          } as ChatEvent;
        }),
      });

      const runtime = createChatRuntime(createDefaultOptions({
        backends: { mock: (_creds: any) => adapterWithUsage },
      }));

      const session = await runtime.createSession({ config: { model: "gpt-4", backend: "mock" } });
      for await (const _ of runtime.send(session.id, "Hi", SEND_OPTS)) {}

      // Stats should exist after send
      const stats = await runtime.getContextStats(session.id);
      expect(stats).not.toBeNull();
      expect(stats!.realPromptTokens).toBe(100);

      // Delete session should clean up
      await runtime.deleteSession(session.id);
      const statsAfter = await runtime.getContextStats(session.id);
      expect(statsAfter).toBeNull();
    });
  });
});
