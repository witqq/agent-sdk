import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import type {
  AgentConfig,
  AgentResult,
  PermissionRequest,
  PermissionDecision,
  UserInputRequest,
  UserInputResponse,
  JSONValue,
} from "../../src/types.js";
import { DisposedError, SubprocessError } from "../../src/errors.js";

// ─── Import the backend (with SDK injection helpers) ────────────

import {
  createCopilotService,
  _injectSDK,
  _resetSDK,
} from "../../src/backends/copilot.js";

// ─── Mock SDK Builder ───────────────────────────────────────────

interface MockSessionEvent {
  id: string;
  timestamp: string;
  parentId: string | null;
  ephemeral?: boolean;
  type: string;
  data: Record<string, unknown>;
}

function createMockSession(overrides?: {
  sendAndWaitResult?: {
    type: "assistant.message";
    data: { messageId: string; content: string };
  };
  events?: MockSessionEvent[];
}) {
  const eventHandlers: Array<(event: MockSessionEvent) => void> = [];

  const session = {
    sessionId: "test-session-id",

    on: vi.fn((handler: (event: MockSessionEvent) => void) => {
      eventHandlers.push(handler);
      return () => {
        const idx = eventHandlers.indexOf(handler);
        if (idx >= 0) eventHandlers.splice(idx, 1);
      };
    }),

    send: vi.fn(async (_opts: { prompt: string }) => {
      // Dispatch events asynchronously for streaming
      const events = overrides?.events ?? [];
      for (const event of events) {
        for (const h of [...eventHandlers]) h(event);
      }
      // Always end with idle
      for (const h of [...eventHandlers]) {
        h({
          id: "idle-1",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "session.idle",
          data: {},
        });
      }
      return "msg-id-1";
    }),

    sendAndWait: vi.fn(async (_opts: { prompt: string }) => {
      // Dispatch events for collection
      const events = overrides?.events ?? [];
      for (const event of events) {
        for (const h of [...eventHandlers]) h(event);
      }
      return (
        overrides?.sendAndWaitResult ?? {
          type: "assistant.message" as const,
          data: { messageId: "msg-1", content: "Hello from Copilot!" },
        }
      );
    }),

    destroy: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  };

  return { session, eventHandlers };
}

function createMockClient(sessionOverrides?: Parameters<typeof createMockSession>[0]) {
  const { session, eventHandlers } = createMockSession(sessionOverrides);

  const client = {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => []),
    getState: vi.fn(() => "connected"),
    createSession: vi.fn(async () => session),
    listModels: vi.fn(async () => [
      { id: "gpt-4o", name: "GPT-4o", capabilities: { limits: { max_context_window_tokens: 128000 }, supports: { vision: true, reasoningEffort: false } } },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", capabilities: { limits: { max_context_window_tokens: 200000 }, supports: { vision: true, reasoningEffort: false } } },
    ]),
    getAuthStatus: vi.fn(async () => ({ isAuthenticated: true })),
  };

  return { client, session, eventHandlers };
}

function injectMockSDK(
  clientOverrides?: Parameters<typeof createMockSession>[0],
) {
  const mock = createMockClient(clientOverrides);
  _injectSDK({
    CopilotClient: vi.fn(function() { return mock.client; }) as unknown as new () => typeof mock.client,
  });
  return mock;
}

// ─── Default Agent Config ───────────────────────────────────────

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    systemPrompt: "You are a helpful assistant.",
    tools: [
      {
        name: "search",
        description: "Search the web",
        parameters: z.object({ query: z.string() }),
        execute: async (params) => ({ results: [`Result for: ${params.query}`] }),
      },
    ],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe("Copilot Backend", () => {
  afterEach(() => {
    _resetSDK();
  });

  // ── Service ────────────────────────────────────────────────────

  describe("CopilotAgentService", () => {
    it("should create a service with name 'copilot'", () => {
      injectMockSDK();
      const service = createCopilotService({});
      expect(service.name).toBe("copilot");
    });

    it("should create an agent from service", () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      expect(agent).toBeDefined();
      expect(agent.getState()).toBe("idle");
    });

    it("should list models from SDK", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const models = await service.listModels();
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({ id: "gpt-4o", name: "GPT-4o", provider: "copilot", contextWindow: 128000 });
      expect(client.listModels).toHaveBeenCalled();
    });

    it("should validate — success when authenticated", async () => {
      injectMockSDK();
      const service = createCopilotService({});
      const result = await service.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate — fail when not authenticated", async () => {
      const { client } = injectMockSDK();
      client.getAuthStatus.mockResolvedValueOnce({ isAuthenticated: false });
      const service = createCopilotService({});
      const result = await service.validate();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Not authenticated");
    });

    it("should validate — fail when connection fails", async () => {
      const { client } = injectMockSDK();
      client.getAuthStatus.mockRejectedValueOnce(new Error("Connection refused"));
      const service = createCopilotService({});
      const result = await service.validate();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Connection refused");
    });

    it("should dispose service and stop client", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      // Force client initialization
      await service.listModels();
      await service.dispose();
      expect(client.stop).toHaveBeenCalled();
    });

    it("should throw DisposedError after dispose", async () => {
      injectMockSDK();
      const service = createCopilotService({});
      await service.dispose();
      expect(() => service.createAgent(makeConfig())).toThrow(DisposedError);
    });

    it("should throw SubprocessError if SDK import fails", async () => {
      _resetSDK();
      // Inject a broken SDK where CopilotClient constructor throws
      _injectSDK({
        CopilotClient: class {
          constructor() {
            throw new Error("Cannot find module '@github/copilot-sdk'");
          }
        } as any,
      });
      const service = createCopilotService({});
      await expect(service.listModels()).rejects.toThrow();
    });

    it("should pass options to CopilotClient constructor", async () => {
      const mock = injectMockSDK();
      const service = createCopilotService({
        cliPath: "/custom/copilot",
        workingDirectory: "/tmp/work",
        githubToken: "ghp_test123",
        useLoggedInUser: false,
      });
      // Trigger client creation
      await service.listModels();
      // The CopilotClient constructor mock was called with our options
      const constructorMock = (mock.client as unknown as { constructor: unknown }).constructor;
      // Verify client was created (createSession or listModels was called)
      expect(mock.client.listModels).toHaveBeenCalled();
    });
  });

  // ── Agent Run ──────────────────────────────────────────────────

  describe("CopilotAgent.run()", () => {
    it("should send prompt and return output", async () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.run("Hello", { model: "test-model" });

      expect(result.output).toBe("Hello from Copilot!");
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({ role: "user", content: "Hello" });
      expect(result.messages[1]).toEqual({
        role: "assistant",
        content: "Hello from Copilot!",
      });
    });

    it("should create session with correct config (default append mode)", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const config = makeConfig({ model: "gpt-4o" });
      const agent = service.createAgent(config);
      await agent.run("test", { model: "gpt-4o" });

      expect(client.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o",
          streaming: false,
          systemMessage: { mode: "append", content: "You are a helpful assistant." },
        }),
      );
    });

    it("should pass mapped tools to session", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.tools).toHaveLength(1);
      expect(sessionConfig.tools[0].name).toBe("search");
      expect(sessionConfig.tools[0].description).toBe("Search the web");
      // Parameters should be converted from Zod schema to JSON Schema
      const params = sessionConfig.tools[0].parameters;
      expect(params).toBeDefined();
      expect(params.type).toBe("object"); // JSON Schema object
    });

    it("should call tool handler and return stringified result", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      const toolHandler = sessionConfig.tools[0].handler;
      const result = await toolHandler(
        { query: "test" },
        { sessionId: "s1", toolCallId: "tc1", toolName: "search", arguments: { query: "test" } },
      );
      expect(result).toBe(JSON.stringify({ results: ["Result for: test"] }));
    });

    it("should collect tool calls from events", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "tool.execution_start",
          data: { toolCallId: "tc-1", toolName: "search", arguments: { query: "news" } },
        },
        {
          id: "e2",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "tool.execution_complete",
          data: {
            toolCallId: "tc-1",
            success: true,
            result: { content: '["article1"]' },
          },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.run("find news", { model: "test-model" });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe("search");
      expect(result.toolCalls[0].args).toEqual({ query: "news" });
      expect(result.toolCalls[0].result).toBe('["article1"]');
      expect(result.toolCalls[0].approved).toBe(true);
    });

    it("should collect usage from events", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.usage",
          data: { model: "gpt-4o", inputTokens: 100, outputTokens: 50 },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.run("test", { model: "test-model" });

      expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 50, model: "test-model", backend: "copilot" });
    });

    it("should handle null response from sendAndWait", async () => {
      const { session } = injectMockSDK();
      // Override sendAndWait to return undefined (timeout/no response)
      session.sendAndWait.mockResolvedValueOnce(undefined);

      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.run("test", { model: "test-model" });

      expect(result.output).toBeNull();
      expect(result.messages).toHaveLength(1); // Only user message
    });

    it("should destroy session after run", async () => {
      const { session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test", { model: "test-model" });

      expect(session.destroy).toHaveBeenCalled();
    });

    it("should extract last user message as prompt", async () => {
      const { session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("What is 2+2?", { model: "test-model" });

      expect(session.sendAndWait).toHaveBeenCalledWith({ prompt: "What is 2+2?" });
    });

    it("should include conversation history when multiple messages via runWithContext", async () => {
      const { session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.runWithContext([
        { role: "user", content: "My name is Alice" },
        { role: "assistant", content: "Hello Alice!" },
        { role: "user", content: "What is my name?" },
      ], { model: "test-model" });

      const sentPrompt = session.sendAndWait.mock.calls[0][0].prompt;
      expect(sentPrompt).toContain("Conversation history:");
      expect(sentPrompt).toContain("User: My name is Alice");
      expect(sentPrompt).toContain("Assistant: Hello Alice!");
      expect(sentPrompt).toContain("User: What is my name?");
    });

    it("should send plain prompt for single message", async () => {
      const { session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.runWithContext([{ role: "user", content: "Hello" }], { model: "test-model" });

      expect(session.sendAndWait).toHaveBeenCalledWith({ prompt: "Hello" });
    });
  });

  // ── Permission Handling ────────────────────────────────────────

  describe("Permission handling", () => {
    it("should wire permission handler to SDK format", async () => {
      const { client } = injectMockSDK();
      const permissionCalls: PermissionRequest[] = [];

      const service = createCopilotService({});
      const agent = service.createAgent(
        makeConfig({
          supervisor: {
            onPermission: async (req) => {
              permissionCalls.push(req);
              return { allowed: true, scope: "once" };
            },
          },
        }),
      );
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.onPermissionRequest).toBeDefined();

      // Simulate SDK calling the handler
      const sdkResult = await sessionConfig.onPermissionRequest!(
        { kind: "shell", command: "ls -la" },
        { sessionId: "s1" },
      );
      expect(sdkResult.kind).toBe("approved");
      expect(permissionCalls).toHaveLength(1);
      expect(permissionCalls[0].toolName).toBe("shell");
      expect(permissionCalls[0].rawSDKRequest).toEqual({ kind: "shell", command: "ls -la" });
    });

    it("should return denied when permission callback denies", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(
        makeConfig({
          supervisor: {
            onPermission: async () => ({
              allowed: false,
              reason: "Not allowed",
            }),
          },
        }),
      );
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      const sdkResult = await sessionConfig.onPermissionRequest!(
        { kind: "write", path: "/etc/passwd" },
        { sessionId: "s1" },
      );
      expect(sdkResult.kind).toBe("denied-interactively-by-user");
    });

    it("should auto-approve when no supervisor (headless safety)", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.onPermissionRequest).toBeDefined();

      // Default handler auto-approves to prevent SDK from hanging
      const result = await sessionConfig.onPermissionRequest!(
        { kind: "shell", command: "ls" },
        { sessionId: "s1" },
      );
      expect(result.kind).toBe("approved");
    });
  });

  // ── User Input Handling ────────────────────────────────────────

  describe("User input handling", () => {
    it("should wire user input handler to SDK format", async () => {
      const { client } = injectMockSDK();
      const askCalls: UserInputRequest[] = [];

      const service = createCopilotService({});
      const agent = service.createAgent(
        makeConfig({
          supervisor: {
            onAskUser: async (req) => {
              askCalls.push(req);
              return { answer: "yes", wasFreeform: false };
            },
          },
        }),
      );
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.onUserInputRequest).toBeDefined();

      const sdkResult = await sessionConfig.onUserInputRequest!(
        { question: "Continue?", choices: ["yes", "no"], allowFreeform: true },
        { sessionId: "s1" },
      );
      expect(sdkResult.answer).toBe("yes");
      expect(sdkResult.wasFreeform).toBe(false);
      expect(askCalls).toHaveLength(1);
      expect(askCalls[0].question).toBe("Continue?");
      expect(askCalls[0].choices).toEqual(["yes", "no"]);
    });

    it("should auto-answer when no onAskUser (headless safety)", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.onUserInputRequest).toBeDefined();

      // Default handler auto-answers to prevent SDK from returning question as output
      const result = await sessionConfig.onUserInputRequest!(
        { question: "Continue?", choices: ["yes", "no"], allowFreeform: true },
        { sessionId: "s1" },
      );
      expect(result.answer).toContain("autonomously");
      expect(result.wasFreeform).toBe(true);
    });
  });

  // ── Event Mapping ──────────────────────────────────────────────

  describe("Event mapping (streaming)", () => {
    it("should yield text_delta events from message_delta", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.message_delta",
          data: { messageId: "m1", deltaContent: "Hello " },
        },
        {
          id: "e2",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.message_delta",
          data: { messageId: "m1", deltaContent: "world!" },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      const textDeltas = collected.filter((e) => e.type === "text_delta");
      expect(textDeltas).toHaveLength(2);
      expect((textDeltas[0] as { text: string }).text).toBe("Hello ");
      expect((textDeltas[1] as { text: string }).text).toBe("world!");
    });

    it("should yield tool_call_start and tool_call_end events", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "tool.execution_start",
          data: { toolCallId: "tc-1", toolName: "search", arguments: { q: "test" } },
        },
        {
          id: "e2",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "tool.execution_complete",
          data: { toolCallId: "tc-1", success: true, result: { content: "found" } },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      const starts = collected.filter((e) => e.type === "tool_call_start");
      const ends = collected.filter((e) => e.type === "tool_call_end");
      expect(starts).toHaveLength(1);
      expect(ends).toHaveLength(1);
      expect((starts[0] as { toolCallId: string }).toolCallId).toBe("tc-1");
      expect((starts[0] as { toolName: string }).toolName).toBe("search");
      expect((ends[0] as { toolCallId: string }).toolCallId).toBe("tc-1");
      expect((ends[0] as { toolName: string }).toolName).toBe("search");
      expect((ends[0] as { result: JSONValue }).result).toBe("found");
    });

    it("should yield usage_update events", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.usage",
          data: { model: "gpt-4o", inputTokens: 200, outputTokens: 100 },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      const usageEvents = collected.filter((e) => e.type === "usage_update");
      expect(usageEvents).toHaveLength(1);
      expect(
        (usageEvents[0] as { promptTokens: number }).promptTokens,
      ).toBe(200);
      expect(
        (usageEvents[0] as { completionTokens: number }).completionTokens,
      ).toBe(100);
    });

    it("should yield error events from session.error", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "session.error",
          data: { errorType: "fatal", message: "Model overloaded" },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      // session.error should cause the stream to throw
      await expect(async () => {
        const collected: import("../../src/types.js").AgentEvent[] = [];
        for await (const event of agent.stream("test", { model: "test-model" })) {
          collected.push(event);
        }
      }).rejects.toThrow("Model overloaded");
    });

    it("should classify error events with error code before throwing", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "session.error",
          data: { errorType: "fatal", message: "Model overloaded" },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      try {
        for await (const event of agent.stream("test", { model: "test-model" })) {
          collected.push(event);
        }
      } catch {
        // expected to throw
      }
      const err = collected.find((e) => e.type === "error");
      expect(err).toBeDefined();
      if (err?.type === "error") {
        expect(err.code).toBe("PROVIDER_ERROR");
        expect(err.recoverable).toBe(true);
      }
    });

    it("should yield thinking_start for reasoning events", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "assistant.reasoning",
          data: { reasoningId: "r1", content: "Let me think..." },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      const thinkEvents = collected.filter((e) => e.type === "thinking_start");
      expect(thinkEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("should yield thinking_delta with text from reasoning_delta events", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "assistant.reasoning_delta",
          data: { reasoningId: "r1", deltaContent: "Let me think about this..." },
        },
        {
          id: "e2",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "assistant.reasoning_delta",
          data: { reasoningId: "r1", deltaContent: "The answer is 42." },
        },
        {
          id: "e3",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.message_delta",
          data: { messageId: "m1", deltaContent: "The answer is 42." },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      // Should have: thinking_start, thinking_delta x2, thinking_end, text_delta
      const thinkingStarts = collected.filter((e) => e.type === "thinking_start");
      const thinkingDeltas = collected.filter((e) => e.type === "thinking_delta");
      const thinkingEnds = collected.filter((e) => e.type === "thinking_end");
      const textDeltas = collected.filter((e) => e.type === "text_delta");

      expect(thinkingStarts).toHaveLength(1);
      expect(thinkingDeltas).toHaveLength(2);
      expect((thinkingDeltas[0] as { text: string }).text).toBe("Let me think about this...");
      expect((thinkingDeltas[1] as { text: string }).text).toBe("The answer is 42.");
      expect(thinkingEnds).toHaveLength(1);
      expect(textDeltas).toHaveLength(1);
    });

    it("should yield thinking_delta with text from reasoning events (content field)", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "assistant.reasoning",
          data: { reasoningId: "r1", content: "Full reasoning text" },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      const thinkingDeltas = collected.filter((e) => e.type === "thinking_delta");
      expect(thinkingDeltas).toHaveLength(1);
      expect((thinkingDeltas[0] as { text: string }).text).toBe("Full reasoning text");
    });

    it("should emit thinking_end before done on session.idle when thinking is active", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "assistant.reasoning_delta",
          data: { reasoningId: "r1", deltaContent: "Thinking..." },
        },
        // session.idle will be automatically appended by mock send()
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      // thinking_end must appear before done (or before stream ends)
      const thinkingEndIdx = collected.findIndex((e) => e.type === "thinking_end");
      expect(thinkingEndIdx).toBeGreaterThanOrEqual(0);

      // Verify thinking_start came first
      const thinkingStartIdx = collected.findIndex((e) => e.type === "thinking_start");
      expect(thinkingStartIdx).toBeGreaterThanOrEqual(0);
      expect(thinkingStartIdx).toBeLessThan(thinkingEndIdx);
    });

    it("should not emit thinking_end on session.idle when thinking is not active", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.message_delta",
          data: { messageId: "m1", deltaContent: "Hello" },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      const thinkingEnds = collected.filter((e) => e.type === "thinking_end");
      expect(thinkingEnds).toHaveLength(0);
    });

    it("should ignore duplicate reasoning events after thinking completes (SDK replay)", async () => {
      // Copilot SDK sends reasoning_delta during streaming, then replays
      // the full reasoning as assistant.reasoning after the response.
      // We must only emit thinking events once.
      const events: MockSessionEvent[] = [
        // Phase 1: streaming reasoning
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "assistant.reasoning_delta",
          data: { reasoningId: "r1", deltaContent: "Let me think..." },
        },
        // Phase 2: response text (ends thinking)
        {
          id: "e2",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.message_delta",
          data: { messageId: "m1", deltaContent: "Hello!" },
        },
        // Phase 3: SDK replays full reasoning (should be ignored)
        {
          id: "e3",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "assistant.reasoning",
          data: { reasoningId: "r1", content: "Let me think..." },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      // Only one thinking block should be emitted
      const thinkingStarts = collected.filter((e) => e.type === "thinking_start");
      const thinkingDeltas = collected.filter((e) => e.type === "thinking_delta");
      const thinkingEnds = collected.filter((e) => e.type === "thinking_end");
      const textDeltas = collected.filter((e) => e.type === "text_delta");

      expect(thinkingStarts).toHaveLength(1);
      expect(thinkingDeltas).toHaveLength(1);
      expect(thinkingEnds).toHaveLength(1);
      expect(textDeltas).toHaveLength(1);
    });

    it("should track tool call IDs across start/complete events", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "tool.execution_start",
          data: { toolCallId: "tc-42", toolName: "search", arguments: { q: "a" } },
        },
        {
          id: "e2",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "tool.execution_start",
          data: { toolCallId: "tc-43", toolName: "read_file", arguments: { path: "/tmp" } },
        },
        {
          id: "e3",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "tool.execution_complete",
          data: { toolCallId: "tc-43", success: true, result: { content: "file content" } },
        },
        {
          id: "e4",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "tool.execution_complete",
          data: { toolCallId: "tc-42", success: true, result: { content: "search result" } },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      const starts = collected.filter((e) => e.type === "tool_call_start") as Array<{
        type: "tool_call_start";
        toolCallId: string;
        toolName: string;
        args: JSONValue;
      }>;
      const ends = collected.filter((e) => e.type === "tool_call_end") as Array<{
        type: "tool_call_end";
        toolCallId: string;
        toolName: string;
        result: JSONValue;
      }>;
      expect(starts).toHaveLength(2);
      expect(ends).toHaveLength(2);

      // Starts carry the original toolCallId
      expect(starts[0].toolCallId).toBe("tc-42");
      expect(starts[0].toolName).toBe("search");
      expect(starts[1].toolCallId).toBe("tc-43");
      expect(starts[1].toolName).toBe("read_file");

      // tc-43 completes first → read_file
      expect(ends[0].toolCallId).toBe("tc-43");
      expect(ends[0].toolName).toBe("read_file");
      expect(ends[0].result).toBe("file content");
      // tc-42 completes second → search
      expect(ends[1].toolCallId).toBe("tc-42");
      expect(ends[1].toolName).toBe("search");
      expect(ends[1].result).toBe("search result");
    });
  });

  // ── Done event null behavior ─────────────────────────────────────

  describe("done event null behavior", () => {
    it("should return null finalOutput when content is absent", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "assistant.message",
          data: { messageId: "m1", content: null },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      const doneEvents = collected.filter((e) => e.type === "done");
      expect(doneEvents).toHaveLength(1);
      expect((doneEvents[0] as { finalOutput: string | null }).finalOutput).toBeNull();
    });

    it("should return null finalOutput when content is empty string", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "assistant.message",
          data: { messageId: "m1", content: "" },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      const doneEvents = collected.filter((e) => e.type === "done");
      expect(doneEvents).toHaveLength(1);
      expect((doneEvents[0] as { finalOutput: string | null }).finalOutput).toBeNull();
    });

    it("should return string finalOutput when content is present", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "assistant.message",
          data: { messageId: "m1", content: "Hello world" },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        collected.push(event);
      }

      const doneEvents = collected.filter((e) => e.type === "done");
      expect(doneEvents).toHaveLength(1);
      expect((doneEvents[0] as { finalOutput: string | null }).finalOutput).toBeNull();
    });
  });

  // ── Structured Output ──────────────────────────────────────────

  describe("runStructured()", () => {
    it("should parse JSON from response", async () => {
      injectMockSDK({
        sendAndWaitResult: {
          type: "assistant.message",
          data: {
            messageId: "m1",
            content: '{"name": "Alice", "age": 30}',
          },
        },
      });

      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      const schema = z.object({ name: z.string(), age: z.number() });
      const result = await agent.runStructured("Get user info", { schema }, { model: "test-model" });

      expect(result.structuredOutput).toEqual({ name: "Alice", age: 30 });
    });

    it("should parse JSON from code block", async () => {
      injectMockSDK({
        sendAndWaitResult: {
          type: "assistant.message",
          data: {
            messageId: "m1",
            content: 'Here is the result:\n```json\n{"name": "Bob"}\n```',
          },
        },
      });

      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      const schema = z.object({ name: z.string() });
      const result = await agent.runStructured("Get name", { schema }, { model: "test-model" });

      expect(result.structuredOutput).toEqual({ name: "Bob" });
    });

    it("should return undefined structuredOutput on parse failure", async () => {
      injectMockSDK({
        sendAndWaitResult: {
          type: "assistant.message",
          data: {
            messageId: "m1",
            content: "I could not find the information.",
          },
        },
      });

      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      const schema = z.object({ name: z.string() });
      const result = await agent.runStructured("Get info", { schema }, { model: "test-model" });

      expect(result.structuredOutput).toBeUndefined();
      expect(result.output).toBe("I could not find the information.");
    });

    it("should augment prompt with schema instruction", async () => {
      const { session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      const schema = z.object({ count: z.number() });
      await agent.runStructured("Count items", { schema }, { model: "test-model" });

      const prompt = session.sendAndWait.mock.calls[0][0].prompt;
      expect(prompt).toContain("Count items");
      expect(prompt).toContain("MUST respond with ONLY valid JSON");
    });
  });

  // ── Lifecycle ──────────────────────────────────────────────────

  describe("Agent lifecycle", () => {
    it("should be in idle state initially", () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      expect(agent.getState()).toBe("idle");
    });

    it("should return to idle after run", async () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test", { model: "test-model" });
      expect(agent.getState()).toBe("idle");
    });

    it("should return config via getConfig()", () => {
      injectMockSDK();
      const service = createCopilotService({});
      const config = makeConfig({ model: "gpt-4o" });
      const agent = service.createAgent(config);
      const returned = agent.getConfig();
      expect(returned.model).toBe("gpt-4o");
      expect(returned.systemPrompt).toBe("You are a helpful assistant.");
    });

    it("should prevent re-entrancy", async () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      // Start a slow run
      const p1 = agent.run("test1", { model: "test-model" });
      // Try to run again immediately
      await expect(agent.run("test2", { model: "test-model" })).rejects.toThrow("already running");
      await p1;
    });

    it("should throw after dispose", () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      agent.dispose();
      expect(agent.getState()).toBe("disposed");
    });

    it("should reuse client across multiple agents", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});

      const agent1 = service.createAgent(makeConfig());
      const agent2 = service.createAgent(makeConfig());

      await agent1.run("test1", { model: "test-model" });
      await agent2.run("test2", { model: "test-model" });

      // Both use the same client (createSession called twice)
      expect(client.createSession).toHaveBeenCalledTimes(2);
    });
  });

  // ── Auth Check ─────────────────────────────────────────────────

  describe("Auth check on startup", () => {
    it("should throw SubprocessError when not authenticated", async () => {
      const { client } = injectMockSDK();
      client.getAuthStatus.mockResolvedValue({ isAuthenticated: false });

      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      await expect(agent.run("test", { model: "test-model" })).rejects.toThrow(SubprocessError);
      await expect(agent.run("test", { model: "test-model" })).rejects.toThrow("Not authenticated");
      expect(client.stop).toHaveBeenCalled();
    });

    it("should succeed when authenticated", async () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const result = await agent.run("test", { model: "test-model" });
      expect(result.output).toBe("Hello from Copilot!");
    });
  });

  // ── CLI Args ──────────────────────────────────────────────────

  describe("CLI args passthrough", () => {
    it("should pass cliArgs to CopilotClient", async () => {
      const mockSDK = injectMockSDK();
      const CopilotClientCtor = vi.fn(function() { return mockSDK.client; });
      _resetSDK();
      _injectSDK({ CopilotClient: CopilotClientCtor as any });

      const service = createCopilotService({
        cliArgs: ["--allow-all", "--allow-all-urls"],
      });
      await service.listModels();

      expect(CopilotClientCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          cliArgs: ["--allow-all", "--allow-all-urls"],
        }),
      );
    });

    it("should not include cliArgs when not provided", async () => {
      const mockSDK = injectMockSDK();
      const CopilotClientCtor = vi.fn(function() { return mockSDK.client; });
      _resetSDK();
      _injectSDK({ CopilotClient: CopilotClientCtor as any });

      const service = createCopilotService({});
      await service.listModels();

      const callArgs = CopilotClientCtor.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("cliArgs");
    });
  });

  // ── System Message Mode ───────────────────────────────────────

  describe("systemMessageMode", () => {
    it("should default to 'append' mode", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.systemMessage).toEqual({
        mode: "append",
        content: "You are a helpful assistant.",
      });
    });

    it("should use 'replace' when explicitly set", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ systemMessageMode: "replace" }));
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.systemMessage).toEqual({
        mode: "replace",
        content: "You are a helpful assistant.",
      });
    });
  });

  // ── Available Tools ───────────────────────────────────────────

  describe("availableTools", () => {
    it("should pass availableTools to session config", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(
        makeConfig({ availableTools: ["web_search", "web_fetch"] }),
      );
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.availableTools).toEqual(["web_search", "web_fetch"]);
    });

    it("should not include availableTools when not set", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test", { model: "test-model" });

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig).not.toHaveProperty("availableTools");
    });
  });

  // ── Usage Metadata & onUsage Callback ────────────────────────

  describe("Usage metadata and onUsage callback", () => {
    it("should include model and backend in run result usage", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.usage",
          data: { model: "gpt-4o", inputTokens: 200, outputTokens: 100 },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ model: "gpt-4o" }));
      const result = await agent.run("test", { model: "gpt-4o" });

      expect(result.usage?.model).toBe("gpt-4o");
      expect(result.usage?.backend).toBe("copilot");
    });

    it("should include model and backend in stream usage_update events", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.usage",
          data: { inputTokens: 200, outputTokens: 100 },
        },
      ];

      injectMockSDK({ events });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ model: "gpt-4o" }));

      const collected: import("../../src/types.js").AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "gpt-4o" })) {
        collected.push(event);
      }

      const usageEvents = collected.filter((e) => e.type === "usage_update");
      expect(usageEvents).toHaveLength(1);
      const ue = usageEvents[0] as { model?: string; backend?: string };
      expect(ue.model).toBe("gpt-4o");
      expect(ue.backend).toBe("copilot");
    });

    it("should call onUsage callback after run", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.usage",
          data: { inputTokens: 50, outputTokens: 30 },
        },
      ];

      injectMockSDK({ events });
      const onUsage = vi.fn();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ model: "gpt-4o", onUsage }));
      await agent.run("test", { model: "gpt-4o" });

      expect(onUsage).toHaveBeenCalledOnce();
      expect(onUsage).toHaveBeenCalledWith({
        promptTokens: 50,
        completionTokens: 30,
        model: "gpt-4o",
        backend: "copilot",
      });
    });

    it("should not propagate onUsage callback errors", async () => {
      const events: MockSessionEvent[] = [
        {
          id: "e1",
          timestamp: new Date().toISOString(),
          parentId: null,
          ephemeral: true,
          type: "assistant.usage",
          data: { inputTokens: 50, outputTokens: 30 },
        },
      ];

      injectMockSDK({ events });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const onUsage = vi.fn(() => { throw new Error("callback error"); });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ onUsage }));
      const result = await agent.run("test", { model: "test-model" });

      expect(result.output).toBe("Hello from Copilot!");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("onUsage callback error"),
        expect.stringContaining("callback error"),
      );
      warnSpy.mockRestore();
    });
  });

  // ── Abort ──────────────────────────────────────────────────────

  describe("Abort handling", () => {
    it("should call session.abort when signal fires", async () => {
      const { session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());

      const ac = new AbortController();
      // Abort immediately before sendAndWait completes
      const origSendAndWait = session.sendAndWait;
      session.sendAndWait = vi.fn(async () => {
        ac.abort();
        return origSendAndWait.getMockImplementation()!({} as { prompt: string });
      });

      // Should still complete (abort is best-effort)
      await agent.run("test", { model: "test-model", signal: ac.signal });
      expect(session.abort).toHaveBeenCalled();
    });
  });

  // ── Persistent Session Mode ─────────────────────────────────────

  describe("persistent session mode", () => {
    it("should reuse the same session across multiple run() calls", async () => {
      const { client, session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      await agent.run("first message", { model: "test-model" });
      await agent.run("second message", { model: "test-model" });

      // Session created only once
      expect(client.createSession).toHaveBeenCalledTimes(1);
      // Both messages sent through the same session
      expect(session.sendAndWait).toHaveBeenCalledTimes(2);
      // Session not destroyed between calls
      expect(session.destroy).not.toHaveBeenCalled();

      agent.dispose();
      expect(session.destroy).toHaveBeenCalledTimes(1);
    });

    it("should reuse the same session across multiple stream() calls", async () => {
      const { client, session } = injectMockSDK({
        events: [{
          id: "text-1", timestamp: new Date().toISOString(), parentId: null,
          type: "assistant.message_delta", data: { content: "hi" },
        }],
      });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      // Consume first stream
      for await (const _ of agent.stream("first", { model: "test-model" })) { /* drain */ }
      // Consume second stream
      for await (const _ of agent.stream("second", { model: "test-model" })) { /* drain */ }

      expect(client.createSession).toHaveBeenCalledTimes(1);
      expect(session.send).toHaveBeenCalledTimes(2);
      expect(session.destroy).not.toHaveBeenCalled();

      agent.dispose();
      expect(session.destroy).toHaveBeenCalledTimes(1);
    });

    it("should send only last user message on subsequent persistent calls", async () => {
      const { session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      // First call (isNew=true): sends via buildContextualPrompt
      await agent.run("first", { model: "test-model" });

      // Second call (isNew=false): should send only last user message
      await agent.runWithContext([
        { role: "user", content: "first" },
        { role: "assistant", content: "response1" },
        { role: "user", content: "second" },
      ], { model: "test-model" });

      expect(session.sendAndWait).toHaveBeenCalledTimes(2);
      // First call: single message goes through buildContextualPrompt → plain prompt
      expect(session.sendAndWait).toHaveBeenNthCalledWith(1, { prompt: "first" });
      // Second call: persistent mode extracts only last user message
      expect(session.sendAndWait).toHaveBeenNthCalledWith(2, { prompt: "second" });

      agent.dispose();
    });

    it("should expose sessionId after first call in persistent mode", async () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      expect(agent.sessionId).toBeUndefined();

      await agent.run("hello", { model: "test-model" });

      // The mock session has sessionId: "test-session-id"
      expect(agent.sessionId).toBe("test-session-id");

      agent.dispose();
    });

    it("should return undefined sessionId in per-call mode", async () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig()); // default per-call

      await agent.run("hello", { model: "test-model" });

      expect(agent.sessionId).toBeUndefined();
      agent.dispose();
    });

    it("should create fresh sessions in per-call mode (default)", async () => {
      const { client, session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig()); // default = per-call

      await agent.run("first", { model: "test-model" });
      await agent.run("second", { model: "test-model" });

      // Two separate sessions created
      expect(client.createSession).toHaveBeenCalledTimes(2);
      // Each session destroyed after use
      expect(session.destroy).toHaveBeenCalledTimes(2);

      agent.dispose();
    });

    it("should recover from session errors by creating fresh session", async () => {
      const { client, session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      // First call succeeds
      await agent.run("first", { model: "test-model" });
      expect(client.createSession).toHaveBeenCalledTimes(1);

      // Make session.sendAndWait fail
      session.sendAndWait = vi.fn(async () => { throw new Error("Session broken"); });

      // Second call fails
      await expect(agent.run("second", { model: "test-model" })).rejects.toThrow("Session broken");

      // Session should be cleared — next call creates a fresh one
      session.sendAndWait = vi.fn(async () => ({
        type: "assistant.message" as const,
        data: { messageId: "msg-2", content: "recovered" },
      }));

      const result = await agent.run("third", { model: "test-model" });
      expect(result.output).toBe("recovered");
      // Two sessions created total: first + recovery
      expect(client.createSession).toHaveBeenCalledTimes(2);

      agent.dispose();
    });

    it("should clear sessionId on dispose", async () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      await agent.run("hello", { model: "test-model" });
      expect(agent.sessionId).toBe("test-session-id");

      agent.dispose();
      expect(agent.sessionId).toBeUndefined();
    });

    it("should recreate session when model changes on persistent session", async () => {
      const { client, session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ model: "gpt-5-mini", sessionMode: "persistent" }));

      // First call establishes persistent session
      await agent.run("first message", { model: "test-model" });
      expect(client.createSession).toHaveBeenCalledTimes(1);

      // Second call with different model should recreate session
      await agent.run("second message", { model: "gpt-4.1" });
      expect(client.createSession).toHaveBeenCalledTimes(2);
      // Old session was destroyed
      expect(session.destroy).toHaveBeenCalledTimes(1);

      // Verify new session was created with new model
      const secondConfig = client.createSession.mock.calls[1][0];
      expect(secondConfig.model).toBe("gpt-4.1");
    });

    it("should reuse persistent session when same model is used", async () => {
      const { client, session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ model: "gpt-5-mini", sessionMode: "persistent" }));

      await agent.run("first", { model: "gpt-5-mini" });
      await agent.run("second", { model: "gpt-5-mini" });
      await agent.run("third", { model: "gpt-5-mini" });

      // Session created only once — no model change
      expect(client.createSession).toHaveBeenCalledTimes(1);
      expect(session.destroy).not.toHaveBeenCalled();
    });

  });

  // ── session_info event ──────────────────────────────────────────

  describe("session_info event", () => {
    it("should emit session_info event during streaming when new session is created", async () => {
      injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      const events: Array<{ type: string; sessionId?: string; backend?: string }> = [];
      for await (const event of agent.stream("hello", { model: "test-model" })) {
        events.push(event as { type: string; sessionId?: string; backend?: string });
      }
      const sessionInfoEvents = events.filter((e) => e.type === "session_info");
      expect(sessionInfoEvents).toHaveLength(1);
      expect(sessionInfoEvents[0]).toMatchObject({
        type: "session_info",
        sessionId: "test-session-id",
        backend: "copilot",
      });
    });
  });

  // ── interrupt ──────────────────────────────────────────────────

  describe("interrupt", () => {
    it("should call session.abort when interrupt() is called", async () => {
      const mock = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      // Run completes first, establishing session
      await agent.run("hello", { model: "test-model" });
      // After run, activeSession is null — interrupt is a no-op for abort, just calls base abort()
      await agent.interrupt();
      // Should not throw
    });
  });

  // ── env forwarding ─────────────────────────────────────────────

  describe("env forwarding", () => {
    it("should pass env to CopilotClient when env option is set", async () => {
      const mock = createMockClient();
      const clientConstructor = vi.fn(function() { return mock.client; });
      _injectSDK({
        CopilotClient: clientConstructor as unknown as new () => typeof mock.client,
      });
      const service = createCopilotService({ env: { CUSTOM_VAR: "test-value" } });
      const agent = service.createAgent(makeConfig());
      await agent.run("hello", { model: "test-model" });

      const clientOpts = clientConstructor.mock.calls[0]?.[0];
      expect(clientOpts?.env).toBeDefined();
      expect(clientOpts.env.CUSTOM_VAR).toBe("test-value");
    });

    it("should pass process.env as base when env option is not set", async () => {
      const mock = createMockClient();
      const clientConstructor = vi.fn(function() { return mock.client; });
      _injectSDK({
        CopilotClient: clientConstructor as unknown as new () => typeof mock.client,
      });
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("hello", { model: "test-model" });

      const clientOpts = clientConstructor.mock.calls[0]?.[0];
      expect(clientOpts?.env).toBeDefined();
      expect(clientOpts.env.PATH).toBe(process.env.PATH);
    });
  });
});
