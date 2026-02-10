import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import type {
  AgentConfig,
  PermissionRequest,
  PermissionDecision,
  JSONValue,
} from "../../src/types.js";
import { DisposedError, DependencyError, ToolExecutionError } from "../../src/errors.js";

import {
  createVercelAIService,
  _injectSDK,
  _injectCompat,
  _resetSDK,
} from "../../src/backends/vercel-ai.js";

// ─── Mock SDK Builder ───────────────────────────────────────────

function createMockLanguageModel() {
  return { modelId: "test-model", provider: "test" };
}

function createMockProvider() {
  const model = createMockLanguageModel();
  return {
    chatModel: vi.fn(() => model),
    languageModel: vi.fn(() => model),
  };
}

function createMockCompatModule() {
  const provider = createMockProvider();
  return {
    createOpenAICompatible: vi.fn(() => provider),
    _provider: provider,
  };
}

interface MockSDKOptions {
  generateTextResult?: Record<string, unknown>;
  streamParts?: Array<Record<string, unknown>>;
  generateObjectResult?: Record<string, unknown>;
}

function createMockSDK(opts?: MockSDKOptions) {
  const defaultGenerateTextResult = {
    text: "Hello from Vercel AI!",
    toolCalls: [],
    toolResults: [],
    steps: [
      {
        text: "Hello from Vercel AI!",
        toolCalls: [],
        toolResults: [],
        usage: { inputTokens: 100, outputTokens: 50 },
        finishReason: "stop",
      },
    ],
    totalUsage: { inputTokens: 100, outputTokens: 50 },
    finishReason: "stop",
    response: { messages: [] },
  };

  const defaultStreamParts = [
    { type: "text-delta", text: "Hello ", id: "t1" },
    { type: "text-delta", text: "world!", id: "t2" },
    {
      type: "finish-step",
      usage: { inputTokens: 80, outputTokens: 30 },
      finishReason: "stop",
      response: {},
    },
  ];

  const defaultGenerateObjectResult = {
    object: { name: "test", value: 42 },
    usage: { inputTokens: 50, outputTokens: 25 },
  };

  const streamParts = opts?.streamParts ?? defaultStreamParts;

  const sdk = {
    generateText: vi.fn(async () => opts?.generateTextResult ?? defaultGenerateTextResult),
    streamText: vi.fn(() => {
      const parts = [...streamParts];
      return {
        fullStream: {
          [Symbol.asyncIterator]() {
            let idx = 0;
            return {
              async next() {
                if (idx < parts.length) {
                  return { value: parts[idx++], done: false };
                }
                return { value: undefined, done: true };
              },
            };
          },
        },
        totalUsage: Promise.resolve({ inputTokens: 80, outputTokens: 30 }),
        text: Promise.resolve("Hello world!"),
      };
    }),
    generateObject: vi.fn(async () => opts?.generateObjectResult ?? defaultGenerateObjectResult),
    tool: vi.fn((toolOpts: Record<string, unknown>) => ({
      description: toolOpts.description,
      parameters: toolOpts.parameters,
      execute: toolOpts.execute,
      needsApproval: toolOpts.needsApproval,
    })),
    jsonSchema: vi.fn((schema: unknown) => schema),
  };

  return sdk;
}

function baseConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    systemPrompt: "You are a test assistant.",
    tools: [],
    model: "test/model",
    ...overrides,
  };
}

const BACKEND_OPTIONS = {
  apiKey: "test-api-key",
  provider: "test-provider",
  baseUrl: "https://test.example.com/api/v1",
};

// ─── Cleanup ────────────────────────────────────────────────────

afterEach(() => {
  _resetSDK();
});

// ─── Service Lifecycle ──────────────────────────────────────────

describe("VercelAIAgentService", () => {
  it("should create a service with correct name", () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    expect(service.name).toBe("vercel-ai");
  });

  it("should create an agent", () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());
    expect(agent).toBeDefined();
    expect(agent.getState()).toBe("idle");
  });

  it("should throw DisposedError after dispose", async () => {
    const service = createVercelAIService(BACKEND_OPTIONS);
    await service.dispose();
    expect(() => service.createAgent(baseConfig())).toThrow(DisposedError);
  });

  it("should validate with valid options", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const result = await service.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate with missing apiKey", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService({ apiKey: "" });
    const result = await service.validate();
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("apiKey");
  });

  it("should return empty models list when /models endpoint fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal("fetch", mockFetch);
    const service = createVercelAIService(BACKEND_OPTIONS);
    const models = await service.listModels();
    expect(models).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("should return empty models list when fetch throws", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);
    const service = createVercelAIService(BACKEND_OPTIONS);
    const models = await service.listModels();
    expect(models).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("should return models from /models endpoint when available", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: "custom-model-1" }, { id: "custom-model-2" }],
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    try {
      const service = createVercelAIService(BACKEND_OPTIONS);
      const models = await service.listModels();
      expect(models).toEqual([{ id: "custom-model-1" }, { id: "custom-model-2" }]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.example.com/api/v1/models",
        expect.objectContaining({
          headers: { Authorization: "Bearer test-api-key" },
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should be idempotent on dispose", async () => {
    const service = createVercelAIService(BACKEND_OPTIONS);
    await service.dispose();
    await service.dispose(); // no throw
  });
});

// ─── Basic Run ──────────────────────────────────────────────────

describe("VercelAIAgent.run", () => {
  it("should execute a simple run", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    const result = await agent.run("Hello");

    expect(result.output).toBe("Hello from Vercel AI!");
    expect(result.toolCalls).toEqual([]);
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 50, model: "test/model", backend: "vercel-ai" });
    expect(result.messages).toHaveLength(2); // user + assistant

    // Verify SDK was called correctly
    expect(sdk.generateText).toHaveBeenCalledOnce();
    const callArgs = sdk.generateText.mock.calls[0][0];
    expect(callArgs.system).toBe("You are a test assistant.");
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0]).toEqual({ role: "user", content: "Hello" });
  });

  it("should pass model params", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(
      baseConfig({
        modelParams: { temperature: 0.5, maxTokens: 1000, topP: 0.9 },
      }),
    );

    await agent.run("Test");

    const callArgs = sdk.generateText.mock.calls[0][0];
    expect(callArgs.temperature).toBe(0.5);
    expect(callArgs.maxTokens).toBe(1000);
    expect(callArgs.topP).toBe(0.9);
  });

  it("should handle null output", async () => {
    const sdk = createMockSDK({
      generateTextResult: {
        text: "",
        toolCalls: [],
        toolResults: [],
        steps: [],
        totalUsage: { inputTokens: 10, outputTokens: 0 },
        finishReason: "stop",
        response: { messages: [] },
      },
    });
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());
    const result = await agent.run("Hello");

    expect(result.output).toBeNull();
    expect(result.messages).toHaveLength(1); // only user
  });

  it("should create provider with correct options", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());
    await agent.run("Test");

    expect(compat.createOpenAICompatible).toHaveBeenCalledWith({
      name: "test-provider",
      baseURL: "https://test.example.com/api/v1",
      apiKey: "test-api-key",
    });
  });

  it("should use default provider/baseUrl when not specified", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService({ apiKey: "key-123" });
    const agent = service.createAgent(baseConfig());
    await agent.run("Test");

    expect(compat.createOpenAICompatible).toHaveBeenCalledWith({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: "key-123",
    });
  });
});

// ─── Tool Calls ─────────────────────────────────────────────────

describe("VercelAIAgent.run with tools", () => {
  it("should map tools to SDK format", async () => {
    const sdk = createMockSDK({
      generateTextResult: {
        text: "Done",
        toolCalls: [{ toolCallId: "tc-1", toolName: "greet", args: { name: "Alice" } }],
        toolResults: [{ toolCallId: "tc-1", toolName: "greet", result: "Hello Alice!" }],
        steps: [
          {
            text: "",
            toolCalls: [{ toolCallId: "tc-1", toolName: "greet", args: { name: "Alice" } }],
            toolResults: [{ toolCallId: "tc-1", toolName: "greet", result: "Hello Alice!" }],
            usage: { inputTokens: 200, outputTokens: 100 },
            finishReason: "tool-calls",
          },
          {
            text: "Done",
            toolCalls: [],
            toolResults: [],
            usage: { inputTokens: 300, outputTokens: 50 },
            finishReason: "stop",
          },
        ],
        totalUsage: { inputTokens: 500, outputTokens: 150 },
        finishReason: "stop",
        response: { messages: [] },
      },
    });
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const greetTool = {
      name: "greet",
      description: "Greet a person",
      parameters: z.object({ name: z.string() }),
      execute: vi.fn(async (args: { name: string }) => `Hello ${args.name}!`),
    };

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig({ tools: [greetTool] }));
    const result = await agent.run("Greet Alice");

    expect(result.output).toBe("Done");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].toolName).toBe("greet");
    expect(result.toolCalls[0].args).toEqual({ name: "Alice" });
    expect(result.toolCalls[0].result).toBe("Hello Alice!");
    expect(result.toolCalls[0].approved).toBe(true);

    // Verify tool was passed to SDK
    expect(sdk.tool).toHaveBeenCalledOnce();
    const toolCallArgs = sdk.tool.mock.calls[0][0];
    expect(toolCallArgs.description).toBe("Greet a person");
  });

  it("should pass tools to generateText", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const tool = {
      name: "test-tool",
      description: "A test tool",
      parameters: z.object({ x: z.string() }),
      execute: vi.fn(async () => "ok"),
    };

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig({ tools: [tool] }));
    await agent.run("Test");

    const callArgs = sdk.generateText.mock.calls[0][0];
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools["test-tool"]).toBeDefined();
  });
});

// ─── Permission Flow ────────────────────────────────────────────

describe("VercelAIAgent permission handling", () => {
  it("should call onPermission for tools with needsApproval", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const onPermission = vi.fn(
      async (req: PermissionRequest): Promise<PermissionDecision> => ({
        allowed: true,
        scope: "once",
      }),
    );

    const dangerousTool = {
      name: "delete-file",
      description: "Delete a file",
      parameters: z.object({ path: z.string() }),
      needsApproval: true,
      execute: vi.fn(async (args: { path: string }) => `Deleted ${args.path}`),
    };

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(
      baseConfig({
        tools: [dangerousTool],
        supervisor: { onPermission },
      }),
    );

    // The tool's execute wrapper checks permissions
    // We need to call the wrapped execute to test this
    expect(sdk.tool).not.toHaveBeenCalled(); // not yet — agent created but tools mapped lazily

    // Trigger tool mapping by running
    await agent.run("Delete test.txt");

    // The tool was mapped
    expect(sdk.tool).toHaveBeenCalledOnce();
    const toolDef = sdk.tool.mock.results[0].value;

    // Call the execute wrapper directly to test permission check
    const result = await toolDef.execute({ path: "/tmp/test.txt" });
    expect(onPermission).toHaveBeenCalledOnce();
    expect(onPermission.mock.calls[0][0].toolName).toBe("delete-file");
    expect(onPermission.mock.calls[0][0].toolArgs).toEqual({ path: "/tmp/test.txt" });
    expect(result).toBe("Deleted /tmp/test.txt");
  });

  it("should deny tool execution when permission is denied", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({
        allowed: false,
        reason: "Too dangerous",
      }),
    );

    const tool = {
      name: "danger",
      description: "Dangerous tool",
      parameters: z.object({ x: z.string() }),
      needsApproval: true,
      execute: vi.fn(async () => "should not execute"),
    };

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(
      baseConfig({
        tools: [tool],
        supervisor: { onPermission },
      }),
    );

    await agent.run("Do something dangerous");

    const toolDef = sdk.tool.mock.results[0].value;
    await expect(toolDef.execute({ x: "test" })).rejects.toThrow(ToolExecutionError);
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it("should use modified input from permission decision", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({
        allowed: true,
        scope: "once",
        modifiedInput: { path: "/safe/path.txt" },
      }),
    );

    const tool = {
      name: "write-file",
      description: "Write a file",
      parameters: z.object({ path: z.string() }),
      needsApproval: true,
      execute: vi.fn(async (args: { path: string }) => `Wrote ${args.path}`),
    };

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(
      baseConfig({
        tools: [tool],
        supervisor: { onPermission },
      }),
    );

    await agent.run("Write file");

    const toolDef = sdk.tool.mock.results[0].value;
    const result = await toolDef.execute({ path: "/dangerous/path.txt" });
    expect(result).toBe("Wrote /safe/path.txt");
  });
});

// ─── Session Auto-Approve ───────────────────────────────────────

describe("VercelAIAgent session auto-approve", () => {
  it("should auto-approve after session scope decision", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({
        allowed: true,
        scope: "session",
      }),
    );

    const tool = {
      name: "read-file",
      description: "Read a file",
      parameters: z.object({ path: z.string() }),
      needsApproval: true,
      execute: vi.fn(async (args: { path: string }) => `Content of ${args.path}`),
    };

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(
      baseConfig({
        tools: [tool],
        supervisor: { onPermission },
      }),
    );

    // First run — triggers tool mapping
    await agent.run("Read file");
    const toolDef = sdk.tool.mock.results[0].value;

    // First call — should ask permission
    await toolDef.execute({ path: "a.txt" });
    expect(onPermission).toHaveBeenCalledTimes(1);

    // Second call — should auto-approve (session scope)
    await toolDef.execute({ path: "b.txt" });
    expect(onPermission).toHaveBeenCalledTimes(1); // not called again
  });

  it("should NOT auto-approve for 'once' scope", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({
        allowed: true,
        scope: "once",
      }),
    );

    const tool = {
      name: "exec",
      description: "Execute command",
      parameters: z.object({ cmd: z.string() }),
      needsApproval: true,
      execute: vi.fn(async (args: { cmd: string }) => `Ran ${args.cmd}`),
    };

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(
      baseConfig({
        tools: [tool],
        supervisor: { onPermission },
      }),
    );

    await agent.run("Run commands");
    const toolDef = sdk.tool.mock.results[0].value;

    await toolDef.execute({ cmd: "ls" });
    expect(onPermission).toHaveBeenCalledTimes(1);

    await toolDef.execute({ cmd: "pwd" });
    expect(onPermission).toHaveBeenCalledTimes(2); // called again
  });
});

// ─── Streaming ──────────────────────────────────────────────────

describe("VercelAIAgent.stream", () => {
  it("should stream text events", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    const events: Array<Record<string, unknown>> = [];
    for await (const event of agent.stream("Hello")) {
      events.push(event as Record<string, unknown>);
    }

    const textEvents = events.filter((e) => e.type === "text_delta");
    expect(textEvents).toHaveLength(2);
    expect(textEvents[0].text).toBe("Hello ");
    expect(textEvents[1].text).toBe("world!");

    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0].finalOutput).toBe("Hello world!");

    // Should have usage update events
    const usageEvents = events.filter((e) => e.type === "usage_update");
    expect(usageEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("should stream tool events", async () => {
    const sdk = createMockSDK({
      streamParts: [
        { type: "tool-call", toolName: "greet", toolCallId: "tc-1", args: { name: "Bob" } },
        { type: "tool-result", toolName: "greet", toolCallId: "tc-1", result: "Hi Bob!" },
        { type: "text-delta", text: "Done", id: "t1" },
        { type: "finish-step", usage: { inputTokens: 50, outputTokens: 20 }, finishReason: "stop" },
      ],
    });
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    const events: Array<Record<string, unknown>> = [];
    for await (const event of agent.stream("Greet Bob")) {
      events.push(event as Record<string, unknown>);
    }

    const toolStart = events.find((e) => e.type === "tool_call_start");
    expect(toolStart).toBeDefined();
    expect(toolStart!.toolCallId).toBe("tc-1");
    expect(toolStart!.toolName).toBe("greet");

    const toolEnd = events.find((e) => e.type === "tool_call_end");
    expect(toolEnd).toBeDefined();
    expect(toolEnd!.toolCallId).toBe("tc-1");
    expect(toolEnd!.result).toBe("Hi Bob!");
  });

  it("should map reasoning events", async () => {
    const sdk = createMockSDK({
      streamParts: [
        { type: "reasoning-start", id: "r1" },
        { type: "reasoning-delta", id: "r1", text: "Thinking..." },
        { type: "reasoning-end", id: "r1" },
        { type: "text-delta", text: "Answer", id: "t1" },
        { type: "finish-step", usage: { inputTokens: 50, outputTokens: 20 }, finishReason: "stop" },
      ],
    });
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    const events: Array<Record<string, unknown>> = [];
    for await (const event of agent.stream("Think")) {
      events.push(event as Record<string, unknown>);
    }

    expect(events.find((e) => e.type === "thinking_start")).toBeDefined();
    expect(events.find((e) => e.type === "thinking_end")).toBeDefined();
    // reasoning-delta mapped to thinking_delta (not text_delta)
    const thinkingDeltas = events.filter((e) => e.type === "thinking_delta");
    expect(thinkingDeltas).toHaveLength(1);
    expect(thinkingDeltas[0].text).toBe("Thinking...");
    // text_delta should only contain actual output text
    const textDeltas = events.filter((e) => e.type === "text_delta");
    expect(textDeltas.some((e) => e.text === "Thinking...")).toBe(false);
  });

  it("should not leak reasoning text into text_delta events", async () => {
    const sdk = createMockSDK({
      streamParts: [
        { type: "reasoning-start", id: "r1" },
        { type: "reasoning-delta", id: "r1", text: "Let me think step by step..." },
        { type: "reasoning-delta", id: "r1", text: "First, I need to consider..." },
        { type: "reasoning-end", id: "r1" },
        { type: "text-delta", text: "The answer is 42.", id: "t1" },
        { type: "finish-step", usage: { inputTokens: 100, outputTokens: 50 }, finishReason: "stop" },
      ],
    });
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    const events: Array<Record<string, unknown>> = [];
    for await (const event of agent.stream("What is the meaning of life?")) {
      events.push(event as Record<string, unknown>);
    }

    // thinking_delta events carry reasoning text
    const thinkingDeltas = events.filter((e) => e.type === "thinking_delta");
    expect(thinkingDeltas).toHaveLength(2);
    expect(thinkingDeltas[0].text).toBe("Let me think step by step...");
    expect(thinkingDeltas[1].text).toBe("First, I need to consider...");

    // text_delta events carry only output text — no reasoning leakage
    const textDeltas = events.filter((e) => e.type === "text_delta");
    expect(textDeltas).toHaveLength(1);
    expect(textDeltas[0].text).toBe("The answer is 42.");

    // thinking_start/end bracket the reasoning
    const thinkingStart = events.findIndex((e) => e.type === "thinking_start");
    const thinkingEnd = events.findIndex((e) => e.type === "thinking_end");
    expect(thinkingStart).toBeLessThan(thinkingEnd);
  });

  it("should propagate toolCallId consistently between start and end", async () => {
    const sdk = createMockSDK({
      streamParts: [
        { type: "tool-call", toolName: "search", toolCallId: "tc-abc", args: { q: "first" } },
        { type: "tool-result", toolName: "search", toolCallId: "tc-abc", result: "result-1" },
        { type: "tool-call", toolName: "fetch", toolCallId: "tc-def", args: { url: "http://x" } },
        { type: "tool-result", toolName: "fetch", toolCallId: "tc-def", result: "result-2" },
        { type: "text-delta", text: "Done", id: "t1" },
        { type: "finish-step", usage: { inputTokens: 50, outputTokens: 20 }, finishReason: "stop" },
      ],
    });
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    const events: Array<Record<string, unknown>> = [];
    for await (const event of agent.stream("Test tools")) {
      events.push(event as Record<string, unknown>);
    }

    const starts = events.filter((e) => e.type === "tool_call_start");
    const ends = events.filter((e) => e.type === "tool_call_end");
    expect(starts).toHaveLength(2);
    expect(ends).toHaveLength(2);

    // Each start/end pair shares the same toolCallId
    expect(starts[0].toolCallId).toBe("tc-abc");
    expect(ends[0].toolCallId).toBe("tc-abc");
    expect(starts[1].toolCallId).toBe("tc-def");
    expect(ends[1].toolCallId).toBe("tc-def");
  });

  it("should map error events", async () => {
    const sdk = createMockSDK({
      streamParts: [
        { type: "error", error: new Error("Something failed") },
      ],
    });
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    const events: Array<Record<string, unknown>> = [];
    for await (const event of agent.stream("Test")) {
      events.push(event as Record<string, unknown>);
    }

    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.error).toBe("Something failed");
    expect(errorEvent!.recoverable).toBe(false);
  });
});

// ─── Structured Output ──────────────────────────────────────────

describe("VercelAIAgent.runStructured", () => {
  it("should generate structured output via generateObject", async () => {
    const sdk = createMockSDK({
      generateObjectResult: {
        object: { city: "Paris", population: 2161000 },
        usage: { inputTokens: 60, outputTokens: 30 },
      },
    });
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const schema = z.object({
      city: z.string(),
      population: z.number(),
    });

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    const result = await agent.runStructured("Tell me about Paris", {
      schema,
      name: "city-info",
      description: "City information",
    });

    expect(result.structuredOutput).toEqual({ city: "Paris", population: 2161000 });
    expect(result.usage).toEqual({ promptTokens: 60, completionTokens: 30, model: "test/model", backend: "vercel-ai" });
    expect(result.output).toBe('{"city":"Paris","population":2161000}');

    // Verify generateObject was called
    expect(sdk.generateObject).toHaveBeenCalledOnce();
    const callArgs = sdk.generateObject.mock.calls[0][0];
    expect(callArgs.schemaName).toBe("city-info");
    expect(callArgs.schemaDescription).toBe("City information");
  });

  it("should handle schema validation failure gracefully", async () => {
    const sdk = createMockSDK({
      generateObjectResult: {
        object: { wrong: "shape" },
        usage: { inputTokens: 50, outputTokens: 25 },
      },
    });
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const schema = z.object({
      name: z.string(),
      count: z.number(),
    });

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());
    const result = await agent.runStructured("Test", { schema });

    // structuredOutput should be undefined because zod validation fails
    expect(result.structuredOutput).toBeUndefined();
    expect(result.output).toBe('{"wrong":"shape"}');
  });
});

// ─── Agent Lifecycle ────────────────────────────────────────────

describe("VercelAIAgent lifecycle", () => {
  it("should not allow run after dispose", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());
    agent.dispose();

    await expect(agent.run("Hello")).rejects.toThrow("disposed");
  });

  it("should not allow concurrent runs", async () => {
    const sdk = createMockSDK();
    // Make generateText slow
    sdk.generateText = vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve({
        text: "ok",
        toolCalls: [],
        toolResults: [],
        steps: [],
        totalUsage: { inputTokens: 10, outputTokens: 5 },
        finishReason: "stop",
        response: { messages: [] },
      }), 100)),
    );
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    const p1 = agent.run("First");
    expect(() => {
      // synchronous check — state is "running" before await
      // We need a tiny delay to let the state update
    }).not.toThrow();

    // The second run should throw reentrancy
    await expect(agent.run("Second")).rejects.toThrow("already running");
    await p1;
  });

  it("should handle abort signal", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const ac = new AbortController();
    ac.abort();

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    await expect(agent.run("Hello", { signal: ac.signal })).rejects.toThrow("aborted");
  });

  it("should return to idle state after run", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    expect(agent.getState()).toBe("idle");
    await agent.run("Hello");
    expect(agent.getState()).toBe("idle");
  });

  it("should inject ask_user tool when onAskUser is set", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const onAskUser = vi.fn().mockResolvedValue({ answer: "42", wasFreeform: true });

    // Mock generateText to capture tools and trigger ask_user
    sdk.generateText = vi.fn().mockImplementation(async (opts: Record<string, unknown>) => {
      const tools = opts.tools as Record<string, { execute: (args: unknown) => Promise<unknown> }>;
      expect(tools).toHaveProperty("ask_user");
      // Call the ask_user tool to verify routing
      const result = await tools.ask_user.execute({ question: "What is the answer?" });
      expect(result).toBe("42");
      return {
        text: "The answer is 42",
        toolCalls: [],
        toolResults: [],
        steps: [],
        totalUsage: { inputTokens: 10, outputTokens: 5 },
        finishReason: "stop",
        response: { messages: [] },
      };
    });

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(
      baseConfig({
        supervisor: { onAskUser },
      }),
    );

    await agent.run("Ask the user something");
    expect(onAskUser).toHaveBeenCalledOnce();
    expect(onAskUser.mock.calls[0][0]).toEqual({
      question: "What is the answer?",
      allowFreeform: true,
    });
  });
});

// ─── runWithContext ──────────────────────────────────────────────

describe("VercelAIAgent.runWithContext", () => {
  it("should pass multiple messages", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig());

    await agent.runWithContext([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "How are you?" },
    ]);

    const callArgs = sdk.generateText.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(3);
  });
});

// ─── Usage Metadata & onUsage Callback ──────────────────────────

describe("Usage metadata and onUsage callback", () => {
  it("should include model and backend in run result usage", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig({ model: "my-model" }));
    const result = await agent.run("Hello");

    expect(result.usage?.model).toBe("my-model");
    expect(result.usage?.backend).toBe("vercel-ai");
  });

  it("should include model and backend in stream usage_update events", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig({ model: "stream-model" }));

    const events: Array<Record<string, unknown>> = [];
    for await (const event of agent.stream("Hello")) {
      events.push(event as Record<string, unknown>);
    }

    const usageEvents = events.filter((e) => e.type === "usage_update");
    expect(usageEvents.length).toBeGreaterThanOrEqual(1);
    for (const ue of usageEvents) {
      expect(ue.model).toBe("stream-model");
      expect(ue.backend).toBe("vercel-ai");
    }
  });

  it("should call onUsage callback after run with correct data", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const onUsage = vi.fn();
    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig({ model: "cb-model", onUsage }));
    await agent.run("Hello");

    expect(onUsage).toHaveBeenCalledOnce();
    expect(onUsage).toHaveBeenCalledWith({
      promptTokens: 100,
      completionTokens: 50,
      model: "cb-model",
      backend: "vercel-ai",
    });
  });

  it("should call onUsage callback during streaming", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const onUsage = vi.fn();
    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig({ model: "s-model", onUsage }));

    for await (const _event of agent.stream("Hello")) {
      // consume
    }

    // Called for each usage_update event (finish-step + final totalUsage)
    expect(onUsage).toHaveBeenCalled();
    for (const call of onUsage.mock.calls) {
      expect(call[0].backend).toBe("vercel-ai");
      expect(call[0].model).toBe("s-model");
    }
  });

  it("should not propagate onUsage callback errors", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onUsage = vi.fn(() => { throw new Error("callback boom"); });
    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig({ onUsage }));
    const result = await agent.run("Hello");

    // Run should succeed despite callback error
    expect(result.output).toBe("Hello from Vercel AI!");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("onUsage callback error"),
      expect.stringContaining("callback boom"),
    );
    warnSpy.mockRestore();
  });
});

// ─── Tool Execute Error Handling ────────────────────────────────

describe("VercelAIAgent tool error handling", () => {
  it("should wrap tool execution errors", async () => {
    const sdk = createMockSDK();
    const compat = createMockCompatModule();
    _injectSDK(sdk);
    _injectCompat(compat);

    const failingTool = {
      name: "fail",
      description: "Always fails",
      parameters: z.object({}),
      execute: vi.fn(async () => {
        throw new Error("Boom");
      }),
    };

    const service = createVercelAIService(BACKEND_OPTIONS);
    const agent = service.createAgent(baseConfig({ tools: [failingTool] }));
    await agent.run("Test");

    const toolDef = sdk.tool.mock.results[0].value;
    await expect(toolDef.execute({})).rejects.toThrow(ToolExecutionError);
  });
});
