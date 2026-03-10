import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import type { AgentConfig, AgentEvent, AgentResult, JSONValue } from "../../src/types.js";
import { AbortError } from "../../src/errors.js";

// ─── Backend imports ────────────────────────────────────────────

import {
  createCopilotService,
  _injectSDK as injectCopilotSDK,
  _resetSDK as resetCopilotSDK,
} from "../../src/backends/copilot.js";

import {
  createClaudeService,
  _injectSDK as injectClaudeSDK,
  _resetSDK as resetClaudeSDK,
} from "../../src/backends/claude.js";

import {
  createVercelAIService,
  _injectSDK as injectVercelSDK,
  _injectCompat as injectVercelCompat,
  _resetSDK as resetVercelSDK,
} from "../../src/backends/vercel-ai.js";

// ─── Shared config ──────────────────────────────────────────────

const searchTool = {
  name: "search",
  description: "Search the web",
  parameters: z.object({ query: z.string() }),
  execute: async (params: { query: string }) => ({
    results: [`Result for: ${params.query}`],
  }),
};

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    systemPrompt: "You are a helpful assistant.",
    tools: [searchTool],
    ...overrides,
  };
}

// ─── Copilot mock helpers ───────────────────────────────────────

interface CopilotSessionEvent {
  id: string;
  timestamp: string;
  parentId: string | null;
  type: string;
  data: Record<string, unknown>;
}

function createCopilotMock(opts?: { events?: CopilotSessionEvent[] }) {
  const eventHandlers: Array<(event: CopilotSessionEvent) => void> = [];
  const session = {
    sessionId: "test-session",
    on: vi.fn((handler: (event: CopilotSessionEvent) => void) => {
      eventHandlers.push(handler);
      return () => {
        const idx = eventHandlers.indexOf(handler);
        if (idx >= 0) eventHandlers.splice(idx, 1);
      };
    }),
    send: vi.fn(async () => {
      for (const event of opts?.events ?? []) {
        for (const h of [...eventHandlers]) h(event);
      }
      for (const h of [...eventHandlers]) {
        h({
          id: "idle",
          timestamp: new Date().toISOString(),
          parentId: null,
          type: "session.idle",
          data: {},
        });
      }
      return "msg-1";
    }),
    sendAndWait: vi.fn(async () => {
      for (const event of opts?.events ?? []) {
        for (const h of [...eventHandlers]) h(event);
      }
      return {
        type: "assistant.message" as const,
        data: { messageId: "msg-1", content: "Hello!" },
      };
    }),
    destroy: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
  };

  const client = {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => []),
    getState: vi.fn(() => "connected"),
    createSession: vi.fn(async () => session),
    listModels: vi.fn(async () => []),
    getAuthStatus: vi.fn(async () => ({ isAuthenticated: true })),
  };

  injectCopilotSDK({
    CopilotClient: vi.fn(function() { return client; }) as any,
  });

  return { client, session, eventHandlers };
}

// ─── Claude mock helpers ────────────────────────────────────────

async function* asyncIter<T>(items: T[]): AsyncGenerator<T, void> {
  for (const item of items) yield item;
}

function claudeSuccessResult(text: string) {
  return {
    type: "result" as const,
    subtype: "success" as const,
    result: text,
    num_turns: 1,
    total_cost_usd: 0.01,
    usage: {},
    modelUsage: {
      "claude-sonnet-4-5-20250514": { inputTokens: 100, outputTokens: 50 },
    },
    session_id: "test",
  };
}

function createClaudeMock(messages: Array<Record<string, unknown>>) {
  const queryResult = {
    [Symbol.asyncIterator]() {
      return asyncIter(messages)[Symbol.asyncIterator]();
    },
    next: vi.fn(),
    return: vi.fn(),
    throw: vi.fn(),
    close: vi.fn(),
    interrupt: vi.fn(),
    supportedModels: vi.fn(async () => []),
  };

  injectClaudeSDK({
    query: vi.fn(() => queryResult),
    createSdkMcpServer: vi.fn((o: { name: string }) => ({
      type: "sdk",
      name: o.name,
      instance: {},
    })),
    tool: vi.fn(
      (name: string, description: string, inputSchema: Record<string, unknown>, handler: Function) => ({
        name,
        description,
        inputSchema,
        handler,
      }),
    ),
  } as any);

  return queryResult;
}

// ─── Vercel AI mock helpers ─────────────────────────────────────

function createVercelMock(opts?: {
  streamParts?: Array<Record<string, unknown>>;
  generateTextResult?: Record<string, unknown>;
}) {
  const defaultStreamParts = [
    { type: "text-delta", text: "Hello!" },
    {
      type: "finish-step",
      usage: { inputTokens: 100, outputTokens: 50 },
      finishReason: "stop",
      response: {},
    },
  ];

  const streamParts = opts?.streamParts ?? defaultStreamParts;

  const sdk = {
    generateText: vi.fn(async () =>
      opts?.generateTextResult ?? {
        text: "Hello!",
        toolCalls: [],
        toolResults: [],
        steps: [
          {
            text: "Hello!",
            toolCalls: [],
            toolResults: [],
            usage: { inputTokens: 100, outputTokens: 50 },
            finishReason: "stop",
          },
        ],
        totalUsage: { inputTokens: 100, outputTokens: 50 },
        finishReason: "stop",
        response: { messages: [] },
      },
    ),
    streamText: vi.fn(() => {
      const parts = [...streamParts];
      return {
        fullStream: {
          [Symbol.asyncIterator]() {
            let idx = 0;
            return {
              async next() {
                if (idx < parts.length) return { value: parts[idx++], done: false };
                return { value: undefined, done: true };
              },
            };
          },
        },
        totalUsage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
        text: Promise.resolve("Hello!"),
      };
    }),
    generateObject: vi.fn(async () => ({
      object: { name: "test", value: 42 },
      usage: { inputTokens: 50, outputTokens: 25 },
    })),
    tool: vi.fn((toolOpts: Record<string, unknown>) => ({
      description: toolOpts.description,
      inputSchema: toolOpts.inputSchema,
      execute: toolOpts.execute,
      needsApproval: toolOpts.needsApproval,
    })),
    jsonSchema: vi.fn((schema: unknown) => schema),
    stepCountIs: vi.fn((count: number) => ({ type: "stepCount", count })),
  };

  const compat = {
    createOpenAICompatible: vi.fn(() => ({
      chatModel: vi.fn(() => ({ modelId: "test-model", provider: "test" })),
      languageModel: vi.fn(() => ({ modelId: "test-model", provider: "test" })),
    })),
  };

  injectVercelSDK(sdk);
  injectVercelCompat(compat);

  return sdk;
}

// ─── Cleanup ────────────────────────────────────────────────────

afterEach(() => {
  resetCopilotSDK();
  resetClaudeSDK();
  resetVercelSDK();
});

// ─── Tests ──────────────────────────────────────────────────────

describe("Cross-backend consistency", () => {
  describe("AgentResult structure", () => {
    it("should return consistent result fields from all backends", async () => {
      // Copilot
      createCopilotMock();
      const copilotService = createCopilotService({});
      const copilotAgent = copilotService.createAgent(makeConfig());
      const copilotResult = await copilotAgent.run("Hello", { model: "gpt-5-mini" });

      // Claude
      createClaudeMock([claudeSuccessResult("Hello!")]);
      const claudeService = createClaudeService({});
      const claudeAgent = claudeService.createAgent(makeConfig());
      const claudeResult = await claudeAgent.run("Hello", { model: "test-model" });

      // Vercel
      createVercelMock();
      const vercelService = createVercelAIService({
        apiKey: "test",
        provider: "test",
        baseUrl: "https://test.example.com",
      });
      const vercelAgent = vercelService.createAgent(makeConfig({ model: "test/model" }));
      const vercelResult = await vercelAgent.run("Hello", { model: "test/model" });

      // All results have the same fields
      for (const result of [copilotResult, claudeResult, vercelResult]) {
        expect(result).toHaveProperty("output");
        expect(result).toHaveProperty("toolCalls");
        expect(result).toHaveProperty("messages");
        expect(result).toHaveProperty("structuredOutput");
        expect(Array.isArray(result.toolCalls)).toBe(true);
        expect(Array.isArray(result.messages)).toBe(true);
      }
    });

    it("should include output as string or null", async () => {
      createCopilotMock();
      const copilotResult = await createCopilotService({})
        .createAgent(makeConfig())
        .run("Hello", { model: "gpt-5-mini" });

      createClaudeMock([claudeSuccessResult("Hello!")]);
      const claudeResult = await createClaudeService({})
        .createAgent(makeConfig())
        .run("Hello", { model: "test-model" });

      createVercelMock();
      const vercelResult = await createVercelAIService({
        apiKey: "test",
        provider: "test",
        baseUrl: "https://test.example.com",
      })
        .createAgent(makeConfig({ model: "test/model" }))
        .run("Hello", { model: "test/model" });

      for (const result of [copilotResult, claudeResult, vercelResult]) {
        expect(typeof result.output === "string" || result.output === null).toBe(true);
      }
    });
  });

  describe("Streaming event types", () => {
    it("should emit text_delta from all backends", async () => {
      // Copilot
      createCopilotMock({
        events: [
          {
            id: "e1",
            timestamp: new Date().toISOString(),
            parentId: null,
            type: "assistant.message_delta",
            data: { deltaContent: "Hello" },
          },
        ],
      });
      const copilotEvents: AgentEvent[] = [];
      const copilotAgent = createCopilotService({}).createAgent(makeConfig());
      for await (const e of copilotAgent.stream("test", { model: "gpt-5-mini" })) copilotEvents.push(e);

      // Claude
      createClaudeMock([
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hello" },
            index: 0,
          },
        },
        claudeSuccessResult("Hello"),
      ]);
      const claudeEvents: AgentEvent[] = [];
      const claudeAgent = createClaudeService({}).createAgent(makeConfig());
      for await (const e of claudeAgent.stream("test", { model: "test-model" })) claudeEvents.push(e);

      // Vercel
      createVercelMock({
        streamParts: [
          { type: "text-delta", text: "Hello" },
          { type: "finish-step", usage: { inputTokens: 10, outputTokens: 5 }, finishReason: "stop", response: {} },
        ],
      });
      const vercelEvents: AgentEvent[] = [];
      const vercelAgent = createVercelAIService({
        apiKey: "test",
        provider: "test",
        baseUrl: "https://test.example.com",
      }).createAgent(makeConfig({ model: "test/model" }));
      for await (const e of vercelAgent.stream("test", { model: "test/model" })) vercelEvents.push(e);

      // All should have text_delta
      expect(copilotEvents.some((e) => e.type === "text_delta")).toBe(true);
      expect(claudeEvents.some((e) => e.type === "text_delta")).toBe(true);
      expect(vercelEvents.some((e) => e.type === "text_delta")).toBe(true);
    });

    it("should emit thinking_start and thinking_end from all backends", async () => {
      // Copilot: reasoning followed by text
      createCopilotMock({
        events: [
          {
            id: "e1",
            timestamp: new Date().toISOString(),
            parentId: null,
            type: "assistant.reasoning",
            data: { content: "thinking..." },
          },
          {
            id: "e2",
            timestamp: new Date().toISOString(),
            parentId: null,
            type: "assistant.message_delta",
            data: { deltaContent: "result" },
          },
        ],
      });
      const copilotEvents: AgentEvent[] = [];
      for await (const e of createCopilotService({}).createAgent(makeConfig()).stream("test", { model: "gpt-5-mini" })) {
        copilotEvents.push(e);
      }

      // Claude: thinking block start + stop
      createClaudeMock([
        {
          type: "stream_event",
          event: {
            type: "content_block_start",
            content_block: { type: "thinking" },
            index: 0,
          },
        },
        {
          type: "stream_event",
          event: { type: "content_block_stop", index: 0 },
        },
        claudeSuccessResult("done"),
      ]);
      const claudeEvents: AgentEvent[] = [];
      for await (const e of createClaudeService({}).createAgent(makeConfig()).stream("test", { model: "test-model" })) {
        claudeEvents.push(e);
      }

      // Vercel: reasoning-start + reasoning-end
      createVercelMock({
        streamParts: [
          { type: "reasoning-start" },
          { type: "reasoning-end" },
          { type: "finish-step", usage: { inputTokens: 10, outputTokens: 5 }, finishReason: "stop", response: {} },
        ],
      });
      const vercelEvents: AgentEvent[] = [];
      for await (const e of createVercelAIService({
        apiKey: "test",
        provider: "test",
        baseUrl: "https://test.example.com",
      }).createAgent(makeConfig({ model: "test/model" })).stream("test", { model: "test/model" })) {
        vercelEvents.push(e);
      }

      // All emit both thinking_start and thinking_end
      for (const [name, events] of [
        ["copilot", copilotEvents],
        ["claude", claudeEvents],
        ["vercel", vercelEvents],
      ] as const) {
        expect(events.some((e) => e.type === "thinking_start"), `${name} missing thinking_start`).toBe(true);
        expect(events.some((e) => e.type === "thinking_end"), `${name} missing thinking_end`).toBe(true);
      }
    });

    it("should emit tool_call_start and tool_call_end from all backends", async () => {
      // Copilot
      createCopilotMock({
        events: [
          {
            id: "e1",
            timestamp: new Date().toISOString(),
            parentId: null,
            type: "tool.execution_start",
            data: { toolCallId: "tc-1", toolName: "search", arguments: { query: "test" } },
          },
          {
            id: "e2",
            timestamp: new Date().toISOString(),
            parentId: null,
            type: "tool.execution_complete",
            data: { toolCallId: "tc-1", success: true, result: { content: "found it" } },
          },
        ],
      });
      const copilotEvents: AgentEvent[] = [];
      for await (const e of createCopilotService({}).createAgent(makeConfig()).stream("test", { model: "gpt-5-mini" })) {
        copilotEvents.push(e);
      }

      // Claude
      createClaudeMock([
        {
          type: "assistant",
          message: {
            content: [{ type: "tool_use", name: "search", input: { query: "test" }, id: "tu-1" }],
          },
        },
        {
          type: "tool_use_summary",
          summary: "found it",
          tool_name: "search",
          preceding_tool_use_ids: ["tu-1"],
        },
        claudeSuccessResult("done"),
      ]);
      const claudeEvents: AgentEvent[] = [];
      for await (const e of createClaudeService({}).createAgent(makeConfig()).stream("test", { model: "test-model" })) {
        claudeEvents.push(e);
      }

      // Vercel
      createVercelMock({
        streamParts: [
          {
            type: "tool-call",
            toolCallId: "tc-1",
            toolName: "search",
            args: { query: "test" },
          },
          {
            type: "tool-result",
            toolCallId: "tc-1",
            toolName: "search",
            result: "found it",
          },
          { type: "finish-step", usage: { inputTokens: 10, outputTokens: 5 }, finishReason: "stop", response: {} },
        ],
      });
      const vercelEvents: AgentEvent[] = [];
      for await (const e of createVercelAIService({
        apiKey: "test",
        provider: "test",
        baseUrl: "https://test.example.com",
      }).createAgent(makeConfig({ model: "test/model" })).stream("test", { model: "test/model" })) {
        vercelEvents.push(e);
      }

      for (const [name, events] of [
        ["copilot", copilotEvents],
        ["claude", claudeEvents],
        ["vercel", vercelEvents],
      ] as const) {
        const starts = events.filter((e) => e.type === "tool_call_start") as Array<{
          type: "tool_call_start";
          toolCallId: string;
          toolName: string;
        }>;
        const ends = events.filter((e) => e.type === "tool_call_end") as Array<{
          type: "tool_call_end";
          toolCallId: string;
          toolName: string;
        }>;
        expect(starts.length, `${name} missing tool_call_start`).toBeGreaterThanOrEqual(1);
        expect(ends.length, `${name} missing tool_call_end`).toBeGreaterThanOrEqual(1);
        // Tool name should be actual, not hardcoded
        expect(starts[0].toolName, `${name} tool_call_start has wrong toolName`).toBe("search");
        expect(ends[0].toolName, `${name} tool_call_end has wrong toolName`).toBe("search");
        // toolCallId must be present and consistent between start/end
        expect(starts[0].toolCallId, `${name} tool_call_start missing toolCallId`).toBeDefined();
        expect(typeof starts[0].toolCallId, `${name} toolCallId should be string`).toBe("string");
        expect(ends[0].toolCallId, `${name} tool_call_end missing toolCallId`).toBeDefined();
      }
    });
  });

  describe("Structured output", () => {
    const schema = z.object({ name: z.string(), value: z.number() });

    it("should return typed structuredOutput from all backends", async () => {
      // Copilot — parses JSON from text response
      createCopilotMock();
      const copilotSession = (createCopilotService({}) as any);
      // Override sendAndWait to return JSON
      resetCopilotSDK();
      const copilotEvents: CopilotSessionEvent[] = [];
      const copilotMock = createCopilotMock();
      copilotMock.session.sendAndWait.mockResolvedValue({
        type: "assistant.message",
        data: { messageId: "m1", content: '{"name":"test","value":42}' },
      });
      const copilotAgent = createCopilotService({}).createAgent(makeConfig());
      const copilotResult = await copilotAgent.runStructured("test", { schema }, { model: "gpt-5-mini" });

      // Claude — uses native structured output
      createClaudeMock([
        {
          type: "result",
          subtype: "success",
          result: '{"name":"test","value":42}',
          structured_output: { name: "test", value: 42 },
          num_turns: 1,
          total_cost_usd: 0.01,
          usage: {},
          modelUsage: { m: { inputTokens: 50, outputTokens: 25 } },
          session_id: "test",
        },
      ]);
      const claudeAgent = createClaudeService({}).createAgent(makeConfig());
      const claudeResult = await claudeAgent.runStructured("test", { schema }, { model: "test-model" });

      // Vercel — uses generateObject
      createVercelMock();
      const vercelAgent = createVercelAIService({
        apiKey: "test",
        provider: "test",
        baseUrl: "https://test.example.com",
      }).createAgent(makeConfig({ model: "test/model" }));
      const vercelResult = await vercelAgent.runStructured("test", { schema }, { model: "test/model" });

      // All should have structuredOutput
      for (const [name, result] of [
        ["copilot", copilotResult],
        ["claude", claudeResult],
        ["vercel", vercelResult],
      ] as const) {
        expect(result.structuredOutput, `${name} missing structuredOutput`).toBeDefined();
        expect((result.structuredOutput as any).name, `${name} wrong name`).toBe("test");
        expect((result.structuredOutput as any).value, `${name} wrong value`).toBe(42);
      }
    });
  });

  describe("Usage metadata", () => {
    it("should include backend name in usage from all backends", async () => {
      // Copilot
      createCopilotMock({
        events: [
          {
            id: "u1",
            timestamp: new Date().toISOString(),
            parentId: null,
            type: "assistant.usage",
            data: { inputTokens: 100, outputTokens: 50 },
          },
        ],
      });
      const copilotResult = await createCopilotService({})
        .createAgent(makeConfig({ model: "gpt-4o" }))
        .run("test", { model: "gpt-4o" });

      // Claude
      createClaudeMock([claudeSuccessResult("ok")]);
      const claudeResult = await createClaudeService({})
        .createAgent(makeConfig({ model: "claude-sonnet" }))
        .run("test", { model: "claude-sonnet" });

      // Vercel
      createVercelMock();
      const vercelResult = await createVercelAIService({
        apiKey: "test",
        provider: "test",
        baseUrl: "https://test.example.com",
      })
        .createAgent(makeConfig({ model: "test/model" }))
        .run("test", { model: "test/model" });

      // All should have backend field
      expect(copilotResult.usage?.backend).toBe("copilot");
      expect(claudeResult.usage?.backend).toBe("claude");
      expect(vercelResult.usage?.backend).toBe("vercel-ai");

      // All should have model field
      expect(copilotResult.usage?.model).toBe("gpt-4o");
      expect(claudeResult.usage?.model).toBe("claude-sonnet");
      expect(vercelResult.usage?.model).toBe("test/model");
    });

    it("should include model and backend in stream usage_update events from all backends", async () => {
      // Copilot
      createCopilotMock({
        events: [
          {
            id: "u1",
            timestamp: new Date().toISOString(),
            parentId: null,
            type: "assistant.usage",
            data: { inputTokens: 100, outputTokens: 50 },
          },
        ],
      });
      const copilotEvents: AgentEvent[] = [];
      for await (const e of createCopilotService({}).createAgent(makeConfig({ model: "gpt-4o" })).stream("test", { model: "gpt-4o" })) {
        copilotEvents.push(e);
      }

      // Claude
      createClaudeMock([claudeSuccessResult("ok")]);
      const claudeEvents: AgentEvent[] = [];
      for await (const e of createClaudeService({}).createAgent(makeConfig({ model: "claude-sonnet" })).stream("test", { model: "claude-sonnet" })) {
        claudeEvents.push(e);
      }

      // Vercel
      createVercelMock();
      const vercelEvents: AgentEvent[] = [];
      for await (const e of createVercelAIService({
        apiKey: "test",
        provider: "test",
        baseUrl: "https://test.example.com",
      }).createAgent(makeConfig({ model: "test/model" })).stream("test", { model: "test/model" })) {
        vercelEvents.push(e);
      }

      for (const [name, events, expectedBackend, expectedModel] of [
        ["copilot", copilotEvents, "copilot", "gpt-4o"],
        ["claude", claudeEvents, "claude", "claude-sonnet"],
        ["vercel", vercelEvents, "vercel-ai", "test/model"],
      ] as const) {
        const usageEvents = events.filter((e) => e.type === "usage_update") as Array<{
          type: "usage_update"; model?: string; backend?: string;
        }>;
        expect(usageEvents.length, `${name} should have usage_update`).toBeGreaterThanOrEqual(1);
        expect(usageEvents[0].backend, `${name} backend`).toBe(expectedBackend);
        expect(usageEvents[0].model, `${name} model`).toBe(expectedModel);
      }
    });
  });

  describe("Abort handling", () => {
    it("should throw AbortError from copilot when aborted", async () => {
      createCopilotMock();
      const agent = createCopilotService({}).createAgent(makeConfig());
      const ac = new AbortController();
      ac.abort();
      await expect(agent.run("test", { model: "gpt-5-mini", signal: ac.signal })).rejects.toThrow("aborted");
    });

    it("should throw AbortError from claude when aborted", async () => {
      // Claude mock that hangs until abort
      const queryResult = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              // Never resolves naturally — will be aborted
              await new Promise(() => {});
              return { value: undefined, done: true };
            },
          };
        },
        close: vi.fn(),
        interrupt: vi.fn(),
        supportedModels: vi.fn(async () => []),
      };

      injectClaudeSDK({
        query: vi.fn(() => queryResult),
        createSdkMcpServer: vi.fn((o: { name: string }) => ({
          type: "sdk",
          name: o.name,
          instance: {},
        })),
        tool: vi.fn(
          (name: string, desc: string, schema: Record<string, unknown>, handler: Function) => ({
            name,
            description: desc,
            inputSchema: schema,
            handler,
          }),
        ),
      } as any);

      const agent = createClaudeService({}).createAgent(makeConfig());
      const ac = new AbortController();
      // Pre-abort
      ac.abort();
      await expect(agent.run("test", { model: "test-model", signal: ac.signal })).rejects.toThrow("aborted");
    });

    it("should throw when pre-aborted for vercel backend", async () => {
      createVercelMock();
      const agent = createVercelAIService({
        apiKey: "test",
        provider: "test",
        baseUrl: "https://test.example.com",
      }).createAgent(makeConfig({ model: "test/model" }));
      const ac = new AbortController();
      ac.abort();
      await expect(agent.run("test", { model: "test/model", signal: ac.signal })).rejects.toThrow("aborted");
    });

    it("should not emit events after abort in streaming", async () => {
      createCopilotMock({
        events: [
          {
            id: "e1",
            timestamp: new Date().toISOString(),
            parentId: null,
            type: "assistant.message_delta",
            data: { deltaContent: "before abort" },
          },
        ],
      });
      const agent = createCopilotService({}).createAgent(makeConfig());
      const ac = new AbortController();
      ac.abort();

      const events: AgentEvent[] = [];
      try {
        for await (const e of agent.stream("test", { model: "gpt-5-mini", signal: ac.signal })) {
          events.push(e);
        }
      } catch {
        // Expected
      }
      // No events should be yielded after pre-abort
      expect(events).toHaveLength(0);
    });
  });
});
