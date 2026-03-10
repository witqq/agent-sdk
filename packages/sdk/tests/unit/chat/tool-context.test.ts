/**
 * Tests for ToolContext injection in ChatRuntime.
 *
 * Verifies that runtime-registered tools receive a ToolContext
 * with session ID and custom metadata when invoked through ChatRuntime.send().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChatRuntime } from "../../../src/chat/runtime.js";
import type { ChatRuntimeOptions } from "../../../src/chat/runtime.js";
import type { IChatSessionStore } from "../../../src/chat/sessions.js";
import type { IResumableBackend } from "../../../src/chat/backends/types.js";
import type { ChatSession, ChatEvent, ChatMessage, ChatId } from "../../../src/chat/core.js";
import { createChatId } from "../../../src/chat/core.js";
import type { ToolDefinition, ToolContext } from "../../../src/types.js";

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
    updateConfig: vi.fn(async () => {}),
    deleteSession: vi.fn(async (id) => { sessions.delete(id); }),
    appendMessage: vi.fn(async (sessionId, message) => {
      const session = sessions.get(sessionId);
      if (session) session.messages = [...session.messages, message];
    }),
    saveMessages: vi.fn(async () => {}),
    loadMessages: vi.fn(async () => ({ messages: [], total: 0, hasMore: false })),

    searchSessions: vi.fn(async () => []),
    count: vi.fn(async () => sessions.size),
    clear: vi.fn(async () => sessions.clear()),

  };
}

/**
 * Creates a mock adapter that captures the tools passed to streamMessage.
 * This lets us inspect how runtime wraps tools with context injection.
 */
function createCapturingAdapter(): {
  adapter: IResumableBackend;
  getCapturedTools: () => ToolDefinition[] | undefined;
} {
  let capturedTools: ToolDefinition[] | undefined;

  const adapter = {
    name: "mock",
    canResume: () => false,
    resume: vi.fn(),
    backendSessionId: null,
    agentService: {} as any,
    currentModel: undefined,
    sendMessage: vi.fn(async () => ({
      id: createChatId(),
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "ok", status: "complete" as const }],
      createdAt: new Date().toISOString(),
      status: "complete" as const,
    })),
    streamMessage: vi.fn(async function* (_session, _message, options) {
      capturedTools = options?.tools;
      const msgId = createChatId();
      yield { type: "message:start", messageId: msgId, role: "assistant" } as ChatEvent;
      yield { type: "message:delta", messageId: msgId, text: "Hello" } as ChatEvent;
      yield {
        type: "message:complete",
        messageId: msgId,
        message: {
          id: msgId,
          role: "assistant",
          parts: [{ type: "text", text: "Hello", status: "complete" }],
          createdAt: new Date().toISOString(),
          status: "complete",
        },
      } as ChatEvent;
    }),
    listModels: vi.fn(async () => []),
    validate: vi.fn(async () => ({ valid: true, errors: [] })),
    dispose: vi.fn(async () => {}),
  };

  return { adapter, getCapturedTools: () => capturedTools };
}

function createOptions(
  adapter: IResumableBackend,
  store?: IChatSessionStore,
): ChatRuntimeOptions {
  return {
    backends: { mock: (_creds: any) => adapter },
    defaultBackend: "mock",
    sessionStore: store ?? createMockSessionStore(),
  };
}

async function drain(stream: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const e of stream) events.push(e);
  return events;
}

// ─── Tests ─────────────────────────────────────────────────────

describe("ToolContext injection", () => {
  it("passes ToolContext with sessionId to registered tool execute", async () => {
    const receivedContexts: (ToolContext | undefined)[] = [];
    const tool: ToolDefinition = {
      name: "test_tool",
      description: "Test",
      parameters: { type: "object", properties: {} } as any,
      execute: vi.fn((_params: unknown, context?: ToolContext) => {
        receivedContexts.push(context);
        return "result";
      }),
    };

    const { adapter, getCapturedTools } = createCapturingAdapter();
    const runtime = createChatRuntime(createOptions(adapter));
    runtime.registerTool(tool);

    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    await drain(runtime.send(session.id, "hello", { model: "test-model", backend: "mock", credentials: { accessToken: "test-token", tokenType: "bearer", obtainedAt: Date.now() } }));

    // The adapter should receive tools with context-injecting wrappers
    const tools = getCapturedTools();
    expect(tools).toBeDefined();
    expect(tools!.length).toBe(1);
    expect(tools![0].name).toBe("test_tool");

    // Call the wrapped execute to verify context injection
    await tools![0].execute({ query: "test" });
    expect(receivedContexts).toHaveLength(1);
    expect(receivedContexts[0]).toBeDefined();
    expect(receivedContexts[0]!.sessionId).toBe(session.id);
  });

  it("includes session custom metadata in ToolContext", async () => {
    let capturedContext: ToolContext | undefined;
    const tool: ToolDefinition = {
      name: "ctx_tool",
      description: "Context test",
      parameters: { type: "object", properties: {} } as any,
      execute: vi.fn((_params: unknown, context?: ToolContext) => {
        capturedContext = context;
        return "ok";
      }),
    };

    const { adapter, getCapturedTools } = createCapturingAdapter();
    const store = createMockSessionStore();
    const runtime = createChatRuntime(createOptions(adapter, store));
    runtime.registerTool(tool);

    const session = await runtime.createSession({
      config: { model: "m", backend: "mock" },
      custom: { userId: "u-123", tenantId: "t-456" },
    });
    await drain(runtime.send(session.id, "hello", { model: "test-model", backend: "mock", credentials: { accessToken: "test-token", tokenType: "bearer", obtainedAt: Date.now() } }));

    const tools = getCapturedTools();
    await tools![0].execute({});
    expect(capturedContext).toBeDefined();
    expect(capturedContext!.custom).toEqual({ userId: "u-123", tenantId: "t-456" });
  });

  it("works with tools that ignore context parameter", async () => {
    const tool: ToolDefinition = {
      name: "simple_tool",
      description: "No context",
      parameters: { type: "object", properties: {} } as any,
      execute: vi.fn((_params: unknown) => "simple result"),
    };

    const { adapter, getCapturedTools } = createCapturingAdapter();
    const runtime = createChatRuntime(createOptions(adapter));
    runtime.registerTool(tool);

    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    await drain(runtime.send(session.id, "hello", { model: "test-model", backend: "mock", credentials: { accessToken: "test-token", tokenType: "bearer", obtainedAt: Date.now() } }));

    const tools = getCapturedTools();
    const result = await tools![0].execute({ input: "data" });
    expect(result).toBe("simple result");
    expect(tool.execute).toHaveBeenCalledWith({ input: "data" }, expect.objectContaining({ sessionId: session.id }));
  });

  it("isolates context between different send calls", async () => {
    const contexts: ToolContext[] = [];
    const tool: ToolDefinition = {
      name: "track_tool",
      description: "Track context",
      parameters: { type: "object", properties: {} } as any,
      execute: vi.fn((_params: unknown, context?: ToolContext) => {
        if (context) contexts.push(context);
        return "ok";
      }),
    };

    const { adapter, getCapturedTools } = createCapturingAdapter();
    const store = createMockSessionStore();
    const runtime = createChatRuntime(createOptions(adapter, store));
    runtime.registerTool(tool);

    const session1 = await runtime.createSession({
      config: { model: "m", backend: "mock" },
      custom: { env: "dev" },
    });
    const session2 = await runtime.createSession({
      config: { model: "m", backend: "mock" },
      custom: { env: "prod" },
    });

    // Send to session 1
    await drain(runtime.send(session1.id, "hello", { model: "test-model", backend: "mock", credentials: { accessToken: "test-token", tokenType: "bearer", obtainedAt: Date.now() } }));
    const tools1 = getCapturedTools();
    await tools1![0].execute({});

    // Send to session 2
    await drain(runtime.send(session2.id, "world", { model: "test-model", backend: "mock", credentials: { accessToken: "test-token", tokenType: "bearer", obtainedAt: Date.now() } }));
    const tools2 = getCapturedTools();
    await tools2![0].execute({});

    expect(contexts).toHaveLength(2);
    expect(contexts[0].sessionId).toBe(session1.id);
    expect(contexts[0].custom).toEqual({ env: "dev" });
    expect(contexts[1].sessionId).toBe(session2.id);
    expect(contexts[1].custom).toEqual({ env: "prod" });
  });

  it("handles session without custom metadata (context.custom is undefined)", async () => {
    let capturedContext: ToolContext | undefined;
    const tool: ToolDefinition = {
      name: "meta_tool",
      description: "Metadata test",
      parameters: { type: "object", properties: {} } as any,
      execute: vi.fn((_params: unknown, context?: ToolContext) => {
        capturedContext = context;
        return "ok";
      }),
    };

    const { adapter, getCapturedTools } = createCapturingAdapter();
    const runtime = createChatRuntime(createOptions(adapter));
    runtime.registerTool(tool);

    // Create session without custom metadata
    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    await drain(runtime.send(session.id, "hello", { model: "test-model", backend: "mock", credentials: { accessToken: "test-token", tokenType: "bearer", obtainedAt: Date.now() } }));

    const tools = getCapturedTools();
    await tools![0].execute({});
    expect(capturedContext).toBeDefined();
    expect(capturedContext!.sessionId).toBe(session.id);
    expect(capturedContext!.custom).toBeUndefined();
  });

  it("does not pass tools to adapter when no tools registered", async () => {
    const { adapter, getCapturedTools } = createCapturingAdapter();
    const runtime = createChatRuntime(createOptions(adapter));

    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    await drain(runtime.send(session.id, "hello", { model: "test-model", backend: "mock", credentials: { accessToken: "test-token", tokenType: "bearer", obtainedAt: Date.now() } }));

    // No tools registered — adapter should receive undefined tools
    expect(getCapturedTools()).toBeUndefined();
  });

  it("preserves original tool properties (name, description, parameters) in wrapped tools", async () => {
    const tool: ToolDefinition = {
      name: "full_tool",
      description: "A fully specified tool",
      parameters: { type: "object", properties: { x: { type: "number" } } } as any,
      execute: vi.fn(() => "done"),
    };

    const { adapter, getCapturedTools } = createCapturingAdapter();
    const runtime = createChatRuntime(createOptions(adapter));
    runtime.registerTool(tool);

    const session = await runtime.createSession({ config: { model: "m", backend: "mock" } });
    await drain(runtime.send(session.id, "hello", { model: "test-model", backend: "mock", credentials: { accessToken: "test-token", tokenType: "bearer", obtainedAt: Date.now() } }));

    const tools = getCapturedTools();
    expect(tools![0].name).toBe("full_tool");
    expect(tools![0].description).toBe("A fully specified tool");
    expect(tools![0].parameters).toEqual({ type: "object", properties: { x: { type: "number" } } });
  });
});
