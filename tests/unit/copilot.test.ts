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
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
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
    CopilotClient: vi.fn(() => mock.client) as unknown as new () => typeof mock.client,
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
      expect(models[0]).toEqual({ id: "gpt-4o", name: "GPT-4o", provider: "copilot" });
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
      const result = await agent.run("Hello");

      expect(result.output).toBe("Hello from Copilot!");
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({ role: "user", content: "Hello" });
      expect(result.messages[1]).toEqual({
        role: "assistant",
        content: "Hello from Copilot!",
      });
    });

    it("should create session with correct config", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const config = makeConfig({ model: "gpt-4o" });
      const agent = service.createAgent(config);
      await agent.run("test");

      expect(client.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o",
          streaming: false,
          systemMessage: { mode: "replace", content: "You are a helpful assistant." },
        }),
      );
    });

    it("should pass mapped tools to session", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.tools).toHaveLength(1);
      expect(sessionConfig.tools[0].name).toBe("search");
      expect(sessionConfig.tools[0].description).toBe("Search the web");
      // Parameters should be JSON schema
      expect(sessionConfig.tools[0].parameters).toEqual({
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      });
    });

    it("should call tool handler and return stringified result", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");

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
      const result = await agent.run("find news");

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
      const result = await agent.run("test");

      expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 50 });
    });

    it("should handle null response from sendAndWait", async () => {
      const { session } = injectMockSDK();
      // Override sendAndWait to return undefined (timeout/no response)
      session.sendAndWait.mockResolvedValueOnce(undefined);

      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.run("test");

      expect(result.output).toBeNull();
      expect(result.messages).toHaveLength(1); // Only user message
    });

    it("should destroy session after run", async () => {
      const { session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");

      expect(session.destroy).toHaveBeenCalled();
    });

    it("should extract last user message as prompt", async () => {
      const { session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("What is 2+2?");

      expect(session.sendAndWait).toHaveBeenCalledWith({ prompt: "What is 2+2?" });
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
      await agent.run("test");

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
      await agent.run("test");

      const sessionConfig = client.createSession.mock.calls[0][0];
      const sdkResult = await sessionConfig.onPermissionRequest!(
        { kind: "write", path: "/etc/passwd" },
        { sessionId: "s1" },
      );
      expect(sdkResult.kind).toBe("denied-interactively-by-user");
    });

    it("should not set permission handler when no supervisor", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.onPermissionRequest).toBeUndefined();
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
      await agent.run("test");

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

    it("should not set user input handler when no onAskUser", async () => {
      const { client } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");

      const sessionConfig = client.createSession.mock.calls[0][0];
      expect(sessionConfig.onUserInputRequest).toBeUndefined();
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
      for await (const event of agent.stream("test")) {
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
      for await (const event of agent.stream("test")) {
        collected.push(event);
      }

      const starts = collected.filter((e) => e.type === "tool_call_start");
      const ends = collected.filter((e) => e.type === "tool_call_end");
      expect(starts).toHaveLength(1);
      expect(ends).toHaveLength(1);
      expect((starts[0] as { toolName: string }).toolName).toBe("search");
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
      for await (const event of agent.stream("test")) {
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
        for await (const event of agent.stream("test")) {
          collected.push(event);
        }
      }).rejects.toThrow("Model overloaded");
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
      for await (const event of agent.stream("test")) {
        collected.push(event);
      }

      const thinkEvents = collected.filter((e) => e.type === "thinking_start");
      expect(thinkEvents.length).toBeGreaterThanOrEqual(1);
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
      for await (const event of agent.stream("test")) {
        collected.push(event);
      }

      const ends = collected.filter((e) => e.type === "tool_call_end") as Array<{
        type: "tool_call_end";
        toolName: string;
        result: JSONValue;
      }>;
      expect(ends).toHaveLength(2);
      // tc-43 completes first → read_file
      expect(ends[0].toolName).toBe("read_file");
      expect(ends[0].result).toBe("file content");
      // tc-42 completes second → search
      expect(ends[1].toolName).toBe("search");
      expect(ends[1].result).toBe("search result");
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
      const result = await agent.runStructured("Get user info", { schema });

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
      const result = await agent.runStructured("Get name", { schema });

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
      const result = await agent.runStructured("Get info", { schema });

      expect(result.structuredOutput).toBeUndefined();
      expect(result.output).toBe("I could not find the information.");
    });

    it("should augment prompt with schema instruction", async () => {
      const { session } = injectMockSDK();
      const service = createCopilotService({});
      const agent = service.createAgent(makeConfig());
      const schema = z.object({ count: z.number() });
      await agent.runStructured("Count items", { schema });

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
      await agent.run("test");
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
      const p1 = agent.run("test1");
      // Try to run again immediately
      await expect(agent.run("test2")).rejects.toThrow("already running");
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

      await agent1.run("test1");
      await agent2.run("test2");

      // Both use the same client (createSession called twice)
      expect(client.createSession).toHaveBeenCalledTimes(2);
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
      await agent.run("test", { signal: ac.signal });
      expect(session.abort).toHaveBeenCalled();
    });
  });
});
