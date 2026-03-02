/**
 * Tests for IResumableBackend, BaseBackendAdapter, CopilotChatAdapter,
 * ClaudeChatAdapter, VercelAIChatAdapter, and IChatTransport.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BaseBackendAdapter } from "../../../src/chat/backends/base.js";
import { CopilotChatAdapter } from "../../../src/chat/backends/copilot.js";
import { ClaudeChatAdapter } from "../../../src/chat/backends/claude.js";
import { VercelAIChatAdapter } from "../../../src/chat/backends/vercel-ai.js";
import { SSEChatTransport, streamToTransport } from "../../../src/chat/backends/transport.js";
import type { IChatTransport, WritableResponse } from "../../../src/chat/backends/transport.js";
import { isResumableBackend } from "../../../src/chat/backends/types.js";
import type { IResumableBackend, BackendAdapterOptions } from "../../../src/chat/backends/types.js";
import type {
  ChatSession,
  ChatEvent,
  SendMessageOptions,
} from "../../../src/chat/core.js";
import { createChatId } from "../../../src/chat/core.js";
import { ChatError, ErrorCode } from "../../../src/chat/errors.js";
import type {
  IAgent,
  IAgentService,
  AgentConfig,
  AgentEvent,
  ModelInfo,
  ValidationResult,
} from "../../../src/types.js";

// ─── Mock Helpers ──────────────────────────────────────────────

function createMockAgent(options?: {
  sessionId?: string;
  events?: AgentEvent[];
  model?: string;
}): IAgent {
  const events = options?.events ?? [
    { type: "text_delta" as const, text: "Hello " },
    { type: "text_delta" as const, text: "world" },
  ];

  return {
    sessionId: options?.sessionId,
    run: vi.fn(),
    runWithContext: vi.fn(),
    runStructured: vi.fn(),
    stream: vi.fn(),
    streamWithContext: vi.fn().mockImplementation(async function* () {
      for (const e of events) yield e;
    }),
    abort: vi.fn(),
    interrupt: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue("idle"),
    getConfig: vi.fn().mockReturnValue({}),
    dispose: vi.fn(),
  };
}

function createMockService(agent?: IAgent): IAgentService {
  const mockAgent = agent ?? createMockAgent();
  return {
    name: "test-service",
    createAgent: vi.fn().mockReturnValue(mockAgent),
    listModels: vi.fn().mockResolvedValue([
      { id: "gpt-4", name: "GPT-4" },
    ] satisfies ModelInfo[]),
    validate: vi.fn().mockResolvedValue({
      valid: true,
      errors: [],
    } satisfies ValidationResult),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockSession(): ChatSession {
  return {
    id: createChatId(),
    messages: [],
    config: { model: "gpt-4", backend: "copilot" },
    metadata: { messageCount: 0, totalTokens: 0 },
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultAgentConfig(): AgentConfig {
  return {
    systemPrompt: "You are a helpful assistant",
    tools: [],
  };
}

async function collectEvents(iterable: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const e of iterable) events.push(e);
  return events;
}

// ─── SESSION_EXPIRED Error Code ────────────────────────────────

describe("ErrorCode.SESSION_EXPIRED", () => {
  it("exists in ErrorCode enum", () => {
    expect(ErrorCode.SESSION_EXPIRED).toBe("SESSION_EXPIRED");
  });

  it("can create ChatError with SESSION_EXPIRED code", () => {
    const error = new ChatError("Session expired", {
      code: ErrorCode.SESSION_EXPIRED,
    });
    expect(error.code).toBe(ErrorCode.SESSION_EXPIRED);
    expect(error.message).toBe("Session expired");
    expect(error.retryable).toBe(false);
  });
});

// ─── BaseBackendAdapter (via concrete subclass) ────────────────

describe("BaseBackendAdapter", () => {
  let mockService: IAgentService;
  let mockAgent: IAgent;

  // Minimal concrete subclass for testing base behavior
  class TestAdapter extends BaseBackendAdapter {
    constructor(options: BackendAdapterOptions) {
      super("test", options);
    }

    protected createService(): IAgentService {
      throw new Error("Should not be called when service is provided");
    }

    protected captureSessionId(agent: IAgent): void {
      // No-op for test
    }
  }

  beforeEach(() => {
    mockAgent = createMockAgent();
    mockService = createMockService(mockAgent);
  });

  it("uses provided agentService", () => {
    const adapter = new TestAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: mockService,
    });
    expect(adapter.agentService).toBe(mockService);
  });

  it("name reflects adapter name", () => {
    const adapter = new TestAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: mockService,
    });
    expect(adapter.name).toBe("test");
  });

  describe("streamMessage", () => {
    it("emits message:start, deltas, and message:complete", async () => {
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: mockService,
      });
      const session = createMockSession();
      const events = await collectEvents(
        adapter.streamMessage(session, "Hi"),
      );

      expect(events[0]).toEqual(
        expect.objectContaining({ type: "message:start", role: "assistant" }),
      );

      const deltas = events.filter((e) => e.type === "message:delta");
      expect(deltas).toHaveLength(2);

      const complete = events.find((e) => e.type === "message:complete");
      expect(complete).toBeDefined();
      if (complete?.type === "message:complete") {
        expect(complete.message.role).toBe("assistant");
        expect(complete.message.parts[0]).toEqual(
          expect.objectContaining({ type: "text", text: "Hello world" }),
        );
      }
    });

    it("passes messages to agent.streamWithContext", async () => {
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: mockService,
      });
      const session = createMockSession();
      await collectEvents(adapter.streamMessage(session, "Hi"));

      expect(mockAgent.streamWithContext).toHaveBeenCalledWith(
        [{ role: "user", content: "Hi" }],
        expect.objectContaining({}),
      );
    });

    it("passes abort signal from options", async () => {
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: mockService,
      });
      const session = createMockSession();
      const controller = new AbortController();
      await collectEvents(
        adapter.streamMessage(session, "Hi", { signal: controller.signal }),
      );

      expect(mockAgent.streamWithContext).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ signal: controller.signal }),
      );
    });
  });

  describe("sendMessage", () => {
    it("accumulates text from stream and returns ChatMessage", async () => {
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: mockService,
      });
      const session = createMockSession();
      const message = await adapter.sendMessage(session, "Hi");

      expect(message.role).toBe("assistant");
      expect(message.parts[0]).toEqual(
        expect.objectContaining({ type: "text", text: "Hello world" }),
      );
      expect(message.status).toBe("complete");
    });
  });

  describe("listModels", () => {
    it("delegates to agentService.listModels()", async () => {
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: mockService,
      });
      const models = await adapter.listModels();
      expect(models).toEqual([{ id: "gpt-4", name: "GPT-4" }]);
      expect(mockService.listModels).toHaveBeenCalled();
    });
  });

  describe("validate", () => {
    it("delegates to agentService.validate()", async () => {
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: mockService,
      });
      const result = await adapter.validate();
      expect(result).toEqual({ valid: true, errors: [] });
    });
  });

  describe("dispose", () => {
    it("does NOT dispose injected service (ownership semantics)", async () => {
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: mockService,
      });
      // Force agent creation
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );
      await adapter.dispose();

      expect(mockService.dispose).not.toHaveBeenCalled();
    });

    it("disposes self-created service", async () => {
      const selfCreatedService = createMockService();
      // TestAdapter.createService returns the mock, simulating self-creation
      class SelfCreatingAdapter extends TestAdapter {
        protected override createService() { return selfCreatedService; }
      }
      const adapter = new SelfCreatingAdapter({
        agentConfig: createDefaultAgentConfig(),
        // no agentService — triggers createService()
      });
      await adapter.dispose();
      expect(selfCreatedService.dispose).toHaveBeenCalled();
    });

    it("is idempotent", async () => {
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: mockService,
      });
      await adapter.dispose();
      await adapter.dispose();
      // Injected service should not be disposed at all
      expect(mockService.dispose).not.toHaveBeenCalled();
    });

    it("throws DISPOSED on subsequent operations", async () => {
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: mockService,
      });
      await adapter.dispose();

      await expect(adapter.sendMessage(createMockSession(), "Hi")).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.DISPOSED }),
      );
    });
  });

  describe("event bridge", () => {
    it("converts thinking events", async () => {
      const thinkingAgent = createMockAgent({
        events: [
          { type: "thinking_start" as const },
          { type: "thinking_delta" as const, text: "reasoning..." },
          { type: "thinking_end" as const },
          { type: "text_delta" as const, text: "Answer" },
        ],
      });
      const service = createMockService(thinkingAgent);
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: service,
      });

      const events = await collectEvents(
        adapter.streamMessage(createMockSession(), "Think"),
      );

      const types = events.map((e) => e.type);
      expect(types).toContain("thinking:start");
      expect(types).toContain("thinking:delta");
      expect(types).toContain("thinking:end");
      expect(types).toContain("message:delta");
    });

    it("converts tool call events", async () => {
      const toolAgent = createMockAgent({
        events: [
          {
            type: "tool_call_start" as const,
            toolCallId: "tc-1",
            toolName: "search",
            args: { query: "test" },
          },
          {
            type: "tool_call_end" as const,
            toolCallId: "tc-1",
            toolName: "search",
            result: "found it",
          },
          { type: "text_delta" as const, text: "Done" },
        ],
      });
      const service = createMockService(toolAgent);
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: service,
      });

      const events = await collectEvents(
        adapter.streamMessage(createMockSession(), "Search"),
      );

      const toolStart = events.find((e) => e.type === "tool:start");
      expect(toolStart).toBeDefined();
      if (toolStart?.type === "tool:start") {
        expect(toolStart.toolName).toBe("search");
        expect(toolStart.args).toEqual({ query: "test" });
      }

      const toolComplete = events.find((e) => e.type === "tool:complete");
      expect(toolComplete).toBeDefined();
      if (toolComplete?.type === "tool:complete") {
        expect(toolComplete.result).toBe("found it");
      }
    });

    it("converts usage events", async () => {
      const usageAgent = createMockAgent({
        events: [
          { type: "text_delta" as const, text: "Hi" },
          {
            type: "usage_update" as const,
            promptTokens: 10,
            completionTokens: 5,
            model: "gpt-4",
          },
        ],
      });
      const service = createMockService(usageAgent);
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: service,
      });

      const events = await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );

      const usage = events.find((e) => e.type === "usage");
      expect(usage).toBeDefined();
      if (usage?.type === "usage") {
        expect(usage.promptTokens).toBe(10);
        expect(usage.completionTokens).toBe(5);
      }
    });

    it("converts error events", async () => {
      const errorAgent = createMockAgent({
        events: [
          {
            type: "error" as const,
            error: "Something went wrong",
            recoverable: true,
          },
        ],
      });
      const service = createMockService(errorAgent);
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: service,
      });

      const events = await collectEvents(
        adapter.streamMessage(createMockSession(), "Fail"),
      );

      const error = events.find((e) => e.type === "error");
      expect(error).toBeDefined();
      if (error?.type === "error") {
        expect(error.error).toBe("Something went wrong");
        expect(error.recoverable).toBe(true);
      }
    });

    it("filters unmappable events (done, session_info)", async () => {
      const mixedAgent = createMockAgent({
        events: [
          { type: "text_delta" as const, text: "Hi" },
          { type: "done" as const, output: "done", usage: undefined },
          { type: "heartbeat" as const },
        ],
      });
      const service = createMockService(mixedAgent);
      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: service,
      });

      const events = await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );

      // message:start + message:delta + heartbeat + message:complete
      const types = events.map((e) => e.type);
      expect(types).not.toContain("done");
      expect(types).toContain("heartbeat");
    });
  });

  describe("model tracking in persistent sessions", () => {
    it("recreates agent when model changes in persistent mode", async () => {
      const agent1 = createMockAgent();
      const agent2 = createMockAgent();
      let createCount = 0;
      const service = createMockService(agent1);
      (service.createAgent as ReturnType<typeof vi.fn>).mockImplementation(() => {
        createCount++;
        return createCount === 1 ? agent1 : agent2;
      });

      const adapter = new TestAdapter({
        agentConfig: { ...createDefaultAgentConfig(), sessionMode: "persistent" },
        agentService: service,
      });

      // First call
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi", { model: "model-a" }),
      );
      expect(createCount).toBe(1);

      // Same model — reuse
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi", { model: "model-a" }),
      );
      expect(createCount).toBe(1);

      // Different model — recreate
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi", { model: "model-b" }),
      );
      expect(createCount).toBe(2);
      expect(agent1.dispose).toHaveBeenCalled();
    });
  });

  describe("lazy service initialization", () => {
    it("uses agentServiceFactory for lazy creation", async () => {
      const service = createMockService();
      const factory = vi.fn().mockReturnValue(service);

      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentServiceFactory: factory,
      });

      // Factory not called yet
      expect(factory).not.toHaveBeenCalled();

      // Access triggers lazy init
      const svc = adapter.agentService;
      expect(factory).toHaveBeenCalledTimes(1);
      expect(svc).toBe(service);

      // Second access returns cached
      expect(adapter.agentService).toBe(service);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("dispose is safe when service was never created", async () => {
      const factory = vi.fn().mockReturnValue(createMockService());

      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentServiceFactory: factory,
      });

      // Dispose without ever creating service
      await adapter.dispose();
      expect(factory).not.toHaveBeenCalled();
    });

    it("listModels triggers lazy init", async () => {
      const service = createMockService();
      const factory = vi.fn().mockReturnValue(service);

      const adapter = new TestAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentServiceFactory: factory,
      });

      const models = await adapter.listModels();
      expect(factory).toHaveBeenCalledTimes(1);
      expect(models).toEqual([{ id: "gpt-4", name: "GPT-4" }]);
    });
  });
});

// ─── CopilotChatAdapter ────────────────────────────────────────

describe("CopilotChatAdapter", () => {
  let mockAgent: IAgent;
  let mockService: IAgentService;

  beforeEach(() => {
    mockAgent = createMockAgent({ sessionId: "copilot-session-123" });
    mockService = createMockService(mockAgent);
  });

  function createAdapter() {
    return new CopilotChatAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: mockService,
    });
  }

  it("has name 'copilot'", () => {
    expect(createAdapter().name).toBe("copilot");
  });

  it("forces persistent session mode", () => {
    const adapter = createAdapter();
    // Agent creation should use persistent session mode
    const session = createMockSession();
    // Trigger agent creation
    const stream = adapter.streamMessage(session, "Hi");
    // The adapter should have called createAgent with sessionMode: "persistent"
    // We verify by checking the mock
    expect(mockService.createAgent).not.toHaveBeenCalled(); // Not yet
    // Consume the stream to trigger creation
    return collectEvents(stream).then(() => {
      expect(mockService.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({ sessionMode: "persistent" }),
      );
    });
  });

  describe("backendSessionId", () => {
    it("is null before streaming", () => {
      expect(createAdapter().backendSessionId).toBeNull();
    });

    it("captures session ID after streaming", async () => {
      const adapter = createAdapter();
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );
      expect(adapter.backendSessionId).toBe("copilot-session-123");
    });
  });

  describe("canResume", () => {
    it("returns false before streaming", () => {
      expect(createAdapter().canResume()).toBe(false);
    });

    it("returns true after streaming with session ID", async () => {
      const adapter = createAdapter();
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );
      expect(adapter.canResume()).toBe(true);
    });
  });

  describe("resume", () => {
    it("throws INVALID_INPUT when backendSessionId is empty", async () => {
      const adapter = createAdapter();
      const session = createMockSession();

      await expect(
        collectEvents(adapter.resume(session, "")),
      ).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.INVALID_INPUT }),
      );
    });

    it("throws SESSION_EXPIRED when session IDs don't match", async () => {
      // First, stream to create the persistent agent
      const adapter = createAdapter();
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );

      // Try to resume with a different session ID
      const session = createMockSession();

      await expect(
        collectEvents(adapter.resume(session, "different-session-id")),
      ).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.SESSION_EXPIRED }),
      );
    });

    it("throws SESSION_NOT_FOUND when resuming fresh adapter", async () => {
      // Fresh adapter with agent that has no sessionId
      const freshAgent = createMockAgent({ sessionId: undefined });
      const freshService = createMockService(freshAgent);
      const adapter = new CopilotChatAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: freshService,
      });

      // Force agent creation by streaming first
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );

      // Resume should throw SESSION_NOT_FOUND since agent has no sessionId
      await expect(
        collectEvents(adapter.resume(createMockSession(), "some-session-id")),
      ).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.SESSION_NOT_FOUND }),
      );
    });

    it("streams events when session ID matches", async () => {
      const adapter = createAdapter();
      // First stream to establish session
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );

      // Resume with correct session ID
      const session = createMockSession();
      const events = await collectEvents(
        adapter.resume(session, "copilot-session-123"),
      );

      expect(events[0]).toEqual(
        expect.objectContaining({ type: "message:start" }),
      );
      const complete = events.find((e) => e.type === "message:complete");
      expect(complete).toBeDefined();
    });

    it("throws DISPOSED when adapter is disposed", async () => {
      const adapter = createAdapter();
      await adapter.dispose();

      await expect(
        collectEvents(adapter.resume(createMockSession(), "any-id")),
      ).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.DISPOSED }),
      );
    });
  });

  describe("persistent session reuse", () => {
    it("reuses agent across calls", async () => {
      const adapter = createAdapter();
      const session = createMockSession();

      await collectEvents(adapter.streamMessage(session, "First"));
      await collectEvents(adapter.streamMessage(session, "Second"));

      // createAgent should only be called once (persistent mode)
      expect(mockService.createAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe("agentService getter", () => {
    it("exposes underlying service", () => {
      const adapter = createAdapter();
      expect(adapter.agentService).toBe(mockService);
    });
  });
});

// ─── ClaudeChatAdapter ─────────────────────────────────────────

describe("ClaudeChatAdapter", () => {
  let mockAgent: IAgent;
  let mockService: IAgentService;

  beforeEach(() => {
    mockAgent = createMockAgent({ sessionId: "claude-session-abc" });
    mockService = createMockService(mockAgent);
  });

  function createAdapter() {
    return new ClaudeChatAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: mockService,
    });
  }

  it("has name 'claude'", () => {
    expect(createAdapter().name).toBe("claude");
  });

  it("forces persistent session mode", async () => {
    const adapter = createAdapter();
    await collectEvents(
      adapter.streamMessage(createMockSession(), "Hi"),
    );
    expect(mockService.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionMode: "persistent" }),
    );
  });

  describe("backendSessionId", () => {
    it("is null before streaming", () => {
      expect(createAdapter().backendSessionId).toBeNull();
    });

    it("captures session ID after streaming", async () => {
      const adapter = createAdapter();
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );
      expect(adapter.backendSessionId).toBe("claude-session-abc");
    });
  });

  describe("canResume", () => {
    it("returns false before streaming", () => {
      expect(createAdapter().canResume()).toBe(false);
    });

    it("returns true after streaming with session ID", async () => {
      const adapter = createAdapter();
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );
      expect(adapter.canResume()).toBe(true);
    });
  });

  describe("resume", () => {
    it("throws INVALID_INPUT when backendSessionId is empty", async () => {
      const adapter = createAdapter();
      await expect(
        collectEvents(adapter.resume(createMockSession(), "")),
      ).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.INVALID_INPUT }),
      );
    });

    it("throws SESSION_EXPIRED when session IDs don't match", async () => {
      const adapter = createAdapter();
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );

      await expect(
        collectEvents(adapter.resume(createMockSession(), "different-session")),
      ).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.SESSION_EXPIRED }),
      );
    });

    it("throws SESSION_NOT_FOUND when resuming fresh adapter", async () => {
      const freshAgent = createMockAgent({ sessionId: undefined });
      const freshService = createMockService(freshAgent);
      const adapter = new ClaudeChatAdapter({
        agentConfig: createDefaultAgentConfig(),
        agentService: freshService,
      });

      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );

      await expect(
        collectEvents(adapter.resume(createMockSession(), "some-session-id")),
      ).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.SESSION_NOT_FOUND }),
      );
    });

    it("streams events when session ID matches", async () => {
      const adapter = createAdapter();
      await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );

      const events = await collectEvents(
        adapter.resume(createMockSession(), "claude-session-abc"),
      );

      expect(events[0]).toEqual(
        expect.objectContaining({ type: "message:start" }),
      );
      const complete = events.find((e) => e.type === "message:complete");
      expect(complete).toBeDefined();
    });

    it("throws DISPOSED when adapter is disposed", async () => {
      const adapter = createAdapter();
      await adapter.dispose();

      await expect(
        collectEvents(adapter.resume(createMockSession(), "any-id")),
      ).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.DISPOSED }),
      );
    });
  });

  describe("persistent session reuse", () => {
    it("reuses agent across calls", async () => {
      const adapter = createAdapter();
      const session = createMockSession();

      await collectEvents(adapter.streamMessage(session, "First"));
      await collectEvents(adapter.streamMessage(session, "Second"));

      expect(mockService.createAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe("agentService getter", () => {
    it("exposes underlying service", () => {
      const adapter = createAdapter();
      expect(adapter.agentService).toBe(mockService);
    });
  });
});

// ─── VercelAIChatAdapter ───────────────────────────────────────

describe("VercelAIChatAdapter", () => {
  let mockAgent: IAgent;
  let mockService: IAgentService;

  beforeEach(() => {
    mockAgent = createMockAgent();
    mockService = createMockService(mockAgent);
  });

  function createAdapter() {
    return new VercelAIChatAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: mockService,
    });
  }

  it("has name 'vercel-ai'", () => {
    expect(createAdapter().name).toBe("vercel-ai");
  });

  it("does not have backendSessionId (stateless, no IResumableBackend)", async () => {
    const adapter = createAdapter();
    expect("backendSessionId" in adapter).toBe(false);
  });

  it("does not have canResume (stateless, no IResumableBackend)", async () => {
    const adapter = createAdapter();
    expect("canResume" in adapter).toBe(false);
  });

  describe("streamMessage", () => {
    it("emits message:start, deltas, and message:complete", async () => {
      const adapter = createAdapter();
      const events = await collectEvents(
        adapter.streamMessage(createMockSession(), "Hi"),
      );

      expect(events[0]).toEqual(
        expect.objectContaining({ type: "message:start", role: "assistant" }),
      );
      const deltas = events.filter((e) => e.type === "message:delta");
      expect(deltas).toHaveLength(2);
      const complete = events.find((e) => e.type === "message:complete");
      expect(complete).toBeDefined();
    });

    it("creates fresh agent per call (stateless)", async () => {
      const adapter = createAdapter();
      const session = createMockSession();
      await collectEvents(adapter.streamMessage(session, "First"));
      await collectEvents(adapter.streamMessage(session, "Second"));
      // Per-call mode: new agent each time
      expect(mockService.createAgent).toHaveBeenCalledTimes(2);
    });
  });

  describe("sendMessage", () => {
    it("returns ChatMessage", async () => {
      const adapter = createAdapter();
      const msg = await adapter.sendMessage(createMockSession(), "Hi");
      expect(msg.role).toBe("assistant");
      expect(msg.status).toBe("complete");
    });
  });

  describe("dispose", () => {
    it("does NOT dispose injected service", async () => {
      const adapter = createAdapter();
      await adapter.dispose();
      expect(mockService.dispose).not.toHaveBeenCalled();
    });

    it("throws DISPOSED after dispose", async () => {
      const adapter = createAdapter();
      await adapter.dispose();
      await expect(
        adapter.sendMessage(createMockSession(), "Hi"),
      ).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.DISPOSED }),
      );
    });
  });
});

// ─── IChatTransport / SSEChatTransport ─────────────────────────

describe("SSEChatTransport", () => {
  function createMockResponse(): WritableResponse & {
    chunks: string[];
    headers: Record<string, string> | null;
    statusCode: number | null;
    ended: boolean;
  } {
    const mock = {
      chunks: [] as string[],
      headers: null as Record<string, string> | null,
      statusCode: null as number | null,
      ended: false,
      get writableEnded() { return mock.ended; },
      writeHead(code: number, headers: Record<string, string>) {
        mock.statusCode = code;
        mock.headers = headers;
      },
      write(chunk: string) {
        mock.chunks.push(chunk);
        return true;
      },
      end() {
        mock.ended = true;
      },
    };
    return mock;
  }

  it("sets SSE headers on construction", () => {
    const res = createMockResponse();
    new SSEChatTransport(res);
    expect(res.statusCode).toBe(200);
    expect(res.headers?.["Content-Type"]).toBe("text/event-stream");
    expect(res.headers?.["Cache-Control"]).toBe("no-cache");
  });

  it("isOpen is true initially", () => {
    const res = createMockResponse();
    const transport = new SSEChatTransport(res);
    expect(transport.isOpen).toBe(true);
  });

  it("send writes SSE data line", () => {
    const res = createMockResponse();
    const transport = new SSEChatTransport(res);
    const event: ChatEvent = { type: "message:start", messageId: "m1", role: "assistant" };
    transport.send(event);
    expect(res.chunks).toHaveLength(1);
    expect(res.chunks[0]).toBe(`data: ${JSON.stringify(event)}\n\n`);
  });

  it("close sends [DONE] and ends response", () => {
    const res = createMockResponse();
    const transport = new SSEChatTransport(res);
    transport.close();
    expect(res.chunks).toContain("data: [DONE]\n\n");
    expect(res.ended).toBe(true);
    expect(transport.isOpen).toBe(false);
  });

  it("error sends error event and ends response", () => {
    const res = createMockResponse();
    const transport = new SSEChatTransport(res);
    transport.error(new Error("test failure"));
    expect(res.chunks).toHaveLength(1);
    const parsed = JSON.parse(res.chunks[0].replace("data: ", "").trim());
    expect(parsed.type).toBe("error");
    expect(parsed.error).toBe("test failure");
    expect(res.ended).toBe(true);
  });

  it("send is no-op after close", () => {
    const res = createMockResponse();
    const transport = new SSEChatTransport(res);
    transport.close();
    transport.send({ type: "message:start", messageId: "m1", role: "assistant" });
    // Only [DONE] was sent, no additional data
    expect(res.chunks).toHaveLength(1);
  });

  it("close is idempotent", () => {
    const res = createMockResponse();
    const transport = new SSEChatTransport(res);
    transport.close();
    transport.close();
    // Only one [DONE] and end
    expect(res.chunks.filter((c) => c.includes("[DONE]"))).toHaveLength(1);
  });
});

describe("streamToTransport", () => {
  function createMockTransport(): IChatTransport & {
    events: ChatEvent[];
    closed: boolean;
    errored: Error | null;
  } {
    const mock = {
      events: [] as ChatEvent[],
      closed: false,
      errored: null as Error | null,
      _open: true,
      get isOpen() { return mock._open; },
      send(event: ChatEvent) { mock.events.push(event); },
      close() { mock.closed = true; mock._open = false; },
      error(err: Error) { mock.errored = err; mock._open = false; },
    };
    return mock;
  }

  it("pipes events to transport and closes", async () => {
    const transport = createMockTransport();
    async function* events(): AsyncIterable<ChatEvent> {
      yield { type: "message:start", messageId: "m1", role: "assistant" };
      yield { type: "message:delta", messageId: "m1", text: "Hello" };
    }
    await streamToTransport(events(), transport);
    expect(transport.events).toHaveLength(3); // 2 stream events + done event
    expect(transport.events[2]).toEqual({ type: "done", finalOutput: "Hello" });
    expect(transport.closed).toBe(true);
  });

  it("sends error to transport on failure", async () => {
    const transport = createMockTransport();
    async function* events(): AsyncIterable<ChatEvent> {
      yield { type: "message:start", messageId: "m1", role: "assistant" };
      throw new Error("stream failed");
    }
    await streamToTransport(events(), transport);
    expect(transport.errored).not.toBeNull();
    expect(transport.errored!.message).toBe("stream failed");
  });

  it("stops when transport closes mid-stream", async () => {
    const transport = createMockTransport();
    let yielded = 0;
    async function* events(): AsyncIterable<ChatEvent> {
      yield { type: "message:start", messageId: "m1", role: "assistant" };
      yielded++;
      transport._open = false; // Simulate client disconnect
      yield { type: "message:delta", messageId: "m1", text: "ignored" };
      yielded++;
    }
    await streamToTransport(events(), transport);
    // Only the first event and the delta (which was skipped due to !isOpen) should be sent
    expect(transport.events).toHaveLength(1);
  });
});

// ─── IResumableBackend contract ──────────────────────────────────

describe("IResumableBackend contract", () => {
  it("CopilotChatAdapter implements all IChatBackend methods", () => {
    const adapter = new CopilotChatAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: createMockService(),
    });

    // IChatBackend methods
    expect(typeof adapter.sendMessage).toBe("function");
    expect(typeof adapter.streamMessage).toBe("function");
    expect(typeof adapter.listModels).toBe("function");
    expect(typeof adapter.validate).toBe("function");
    expect(typeof adapter.dispose).toBe("function");

    // IResumableBackend additions
    expect(typeof adapter.canResume).toBe("function");
    expect(typeof adapter.resume).toBe("function");
    expect(adapter.backendSessionId).toBeNull();
    expect(adapter.agentService).toBeDefined();
    expect(typeof adapter.name).toBe("string");
  });

  it("ClaudeChatAdapter implements all IChatBackend methods", () => {
    const adapter = new ClaudeChatAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: createMockService(),
    });

    expect(typeof adapter.sendMessage).toBe("function");
    expect(typeof adapter.streamMessage).toBe("function");
    expect(typeof adapter.listModels).toBe("function");
    expect(typeof adapter.validate).toBe("function");
    expect(typeof adapter.dispose).toBe("function");

    expect(typeof adapter.canResume).toBe("function");
    expect(typeof adapter.resume).toBe("function");
    expect(adapter.backendSessionId).toBeNull();
    expect(adapter.agentService).toBeDefined();
    expect(adapter.name).toBe("claude");
  });

  it("VercelAIChatAdapter implements IChatBackend methods", () => {
    const adapter = new VercelAIChatAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: createMockService(),
    });

    // IChatBackend methods (no resume support — stateless)
    expect(typeof adapter.sendMessage).toBe("function");
    expect(typeof adapter.streamMessage).toBe("function");
    expect(typeof adapter.listModels).toBe("function");
    expect(typeof adapter.validate).toBe("function");
    expect(typeof adapter.dispose).toBe("function");

    expect(adapter.agentService).toBeDefined();
    expect(adapter.name).toBe("vercel-ai");

    // VercelAI does NOT implement IResumableBackend
    expect("canResume" in adapter).toBe(false);
    expect("resume" in adapter).toBe(false);
    expect("backendSessionId" in adapter).toBe(false);
  });
});

// ─── isResumableBackend type guard ─────────────────────────────

describe("isResumableBackend", () => {
  it("returns true for CopilotChatAdapter", () => {
    const adapter = new CopilotChatAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: createMockService(),
    });
    expect(isResumableBackend(adapter)).toBe(true);
  });

  it("returns true for ClaudeChatAdapter", () => {
    const adapter = new ClaudeChatAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: createMockService(),
    });
    expect(isResumableBackend(adapter)).toBe(true);
  });

  it("returns false for VercelAIChatAdapter", () => {
    const adapter = new VercelAIChatAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: createMockService(),
    });
    expect(isResumableBackend(adapter)).toBe(false);
  });
});

describe("BaseBackendAdapter stateless tool/model handling", () => {
  let mockService: IAgentService;
  let mockAgent: IAgent;
  let secondAgent: IAgent;

  class TestAdapter extends BaseBackendAdapter {
    constructor(options: BackendAdapterOptions) {
      super("test", options);
    }

    protected createService(): IAgentService {
      throw new Error("Should not be called when service is provided");
    }

    protected captureSessionId(agent: IAgent): void {
      // No-op for test
    }
  }

  beforeEach(() => {
    mockAgent = createMockAgent();
    secondAgent = createMockAgent();
    mockService = createMockService(mockAgent);
    // Second createAgent call returns secondAgent
    (mockService.createAgent as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockAgent)
      .mockReturnValueOnce(secondAgent);
  });

  it("currentModel returns config model", () => {
    const adapter = new TestAdapter({
      agentConfig: { ...createDefaultAgentConfig(), model: "gpt-4" },
      agentService: mockService,
    });
    expect(adapter.currentModel).toBe("gpt-4");
  });

  it("currentModel returns undefined when config has no model", () => {
    const adapter = new TestAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: mockService,
    });
    expect(adapter.currentModel).toBeUndefined();
  });

  it("setTools is a deprecated no-op", async () => {
    const adapter = new TestAdapter({
      agentConfig: { ...createDefaultAgentConfig(), sessionMode: "persistent" },
      agentService: mockService,
    });
    const session = createMockSession();
    await collectEvents(adapter.streamMessage(session, "Hi"));
    expect(mockService.createAgent).toHaveBeenCalledTimes(1);

    // setTools is no-op — does NOT dispose cached agent
    adapter.setTools();
    expect(mockAgent.dispose).not.toHaveBeenCalled();

    // Same persistent agent reused on next call
    await collectEvents(adapter.streamMessage(session, "Hello"));
    expect(mockService.createAgent).toHaveBeenCalledTimes(1);
  });

  it("tools passed per-call via SendMessageOptions reach agent", async () => {
    const adapter = new TestAdapter({
      agentConfig: createDefaultAgentConfig(),
      agentService: mockService,
    });
    const tools = [{ name: "my_tool", description: "desc", parameters: {}, execute: async () => "ok" }];
    const session = createMockSession();
    await collectEvents(adapter.streamMessage(session, "Hi", { tools }));

    expect(mockAgent.streamWithContext).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ tools }),
    );
  });

  it("non-persistent mode disposes previous agent on each call (P23 fix)", async () => {
    const adapter = new TestAdapter({
      agentConfig: createDefaultAgentConfig(), // default: per-call
      agentService: mockService,
    });
    const session = createMockSession();
    // First stream — creates and caches agent
    await collectEvents(adapter.streamMessage(session, "First"));
    expect(mockService.createAgent).toHaveBeenCalledTimes(1);

    // Second stream — should dispose first agent before creating new one
    await collectEvents(adapter.streamMessage(session, "Second"));
    expect(mockAgent.dispose).toHaveBeenCalled();
    expect(mockService.createAgent).toHaveBeenCalledTimes(2);
  });

  it("per-call model override via streamMessage options", async () => {
    const adapter = new TestAdapter({
      agentConfig: { ...createDefaultAgentConfig(), model: "gpt-4" },
      agentService: mockService,
    });

    const session = createMockSession();
    await collectEvents(
      adapter.streamMessage(session, "Hi", { model: "gpt-6" }),
    );

    // Per-call model is passed to agent.streamWithContext, not createAgent
    expect(mockAgent.streamWithContext).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ model: "gpt-6" }),
    );
  });

  it("agent config does not include tool overrides (tools per-call only)", async () => {
    const configTools = [{ name: "config_tool", description: "from config", parameters: {} }];
    const adapter = new TestAdapter({
      agentConfig: { ...createDefaultAgentConfig(), tools: configTools },
      agentService: mockService,
    });

    const session = createMockSession();
    await collectEvents(adapter.streamMessage(session, "Hi"));

    // Agent created with config tools only — no merging with runtime tools
    expect(mockService.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({ tools: configTools }),
    );
  });

  it("persistent mode recreates agent when model changes between calls", async () => {
    const adapter = new TestAdapter({
      agentConfig: { ...createDefaultAgentConfig(), sessionMode: "persistent", model: "gpt-4" },
      agentService: mockService,
    });
    const session = createMockSession();

    // First call with config model
    await collectEvents(adapter.streamMessage(session, "Hi"));
    expect(mockService.createAgent).toHaveBeenCalledTimes(1);

    // Second call with different model — should recreate agent
    await collectEvents(adapter.streamMessage(session, "Hello", { model: "gpt-6" }));
    expect(mockAgent.dispose).toHaveBeenCalled();
    expect(mockService.createAgent).toHaveBeenCalledTimes(2);
  });
});

// ─── Barrel exports ────────────────────────────────────────────

describe("chat/backends barrel exports", () => {
  it("exports all expected types and classes", async () => {
    const barrel = await import("../../../src/chat/backends/index.js");
    expect(barrel.BaseBackendAdapter).toBeDefined();
    expect(barrel.CopilotChatAdapter).toBeDefined();
    expect(barrel.ClaudeChatAdapter).toBeDefined();
    expect(barrel.VercelAIChatAdapter).toBeDefined();
    expect(barrel.SSEChatTransport).toBeDefined();
    expect(barrel.streamToTransport).toBeDefined();
  });
});
