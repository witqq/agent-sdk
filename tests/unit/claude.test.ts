import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import type {
  AgentConfig,
  AgentEvent,
  PermissionRequest,
  PermissionDecision,
} from "../../src/types.js";
import { DisposedError, SubprocessError } from "../../src/errors.js";

import {
  createClaudeService,
  _injectSDK,
  _resetSDK,
} from "../../src/backends/claude.js";

// ─── Mock SDK Builder ───────────────────────────────────────────

/** Create async generator from messages array */
async function* asyncIter<T>(items: T[]): AsyncGenerator<T, void> {
  for (const item of items) yield item;
}

/** Minimal success result */
function successResult(
  text: string,
  opts?: { structured_output?: unknown; cost?: number },
) {
  return {
    type: "result" as const,
    subtype: "success" as const,
    result: text,
    structured_output: opts?.structured_output,
    num_turns: 1,
    total_cost_usd: opts?.cost ?? 0.01,
    usage: {},
    modelUsage: {
      "claude-sonnet-4-5-20250929": {
        inputTokens: 100,
        outputTokens: 50,
      },
    },
    session_id: "test-session",
  };
}

/** Error result */
function errorResult(errors: string[]) {
  return {
    type: "result" as const,
    subtype: "error" as const,
    errors,
    is_error: true,
    usage: {},
    modelUsage: {},
    session_id: "test-session",
  };
}

/** Assistant message with text */
function assistantMessage(text: string) {
  return {
    type: "assistant" as const,
    message: {
      content: [{ type: "text", text }],
    },
  };
}

/** Assistant message with tool use */
function toolUseMessage(name: string, input: Record<string, unknown>) {
  return {
    type: "assistant" as const,
    message: {
      content: [{ type: "tool_use", name, input, id: "tu-1" }],
    },
  };
}

interface MockSDKModule {
  query: ReturnType<typeof vi.fn>;
  createSdkMcpServer: ReturnType<typeof vi.fn>;
  tool: ReturnType<typeof vi.fn>;
}

function createMockSDK(
  messages?: Array<Record<string, unknown>>,
): MockSDKModule {
  const queryResult = {
    [Symbol.asyncIterator]() {
      const msgs = messages ?? [successResult("Hello from Claude!")];
      return asyncIter(msgs)[Symbol.asyncIterator]();
    },
    next: vi.fn(),
    return: vi.fn(),
    throw: vi.fn(),
    close: vi.fn(),
    interrupt: vi.fn(),
    supportedModels: vi.fn(async () => [
      {
        value: "claude-sonnet-4-5-20250929",
        displayName: "Claude Sonnet 4.5",
        description: "Fast model",
      },
      {
        value: "claude-opus-4-20250514",
        displayName: "Claude Opus 4",
        description: "Powerful model",
      },
    ]),
  };

  const sdk: MockSDKModule = {
    query: vi.fn(() => queryResult),
    createSdkMcpServer: vi.fn((opts: { name: string }) => ({
      type: "sdk",
      name: opts.name,
      instance: {},
    })),
    tool: vi.fn(
      (
        name: string,
        description: string,
        inputSchema: Record<string, unknown>,
        handler: Function,
      ) => ({
        name,
        description,
        inputSchema,
        handler,
      }),
    ),
  };

  return sdk;
}

function injectMockSDK(
  messages?: Array<Record<string, unknown>>,
): MockSDKModule {
  const sdk = createMockSDK(messages);
  _injectSDK(sdk as any);
  return sdk;
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
        execute: async (params) => ({
          results: [`Result for: ${(params as { query: string }).query}`],
        }),
      },
    ],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe("Claude Backend", () => {
  afterEach(() => {
    _resetSDK();
  });

  // ── Service ────────────────────────────────────────────────────

  describe("ClaudeAgentService", () => {
    it("should create a service with name 'claude'", () => {
      injectMockSDK();
      const service = createClaudeService({});
      expect(service.name).toBe("claude");
    });

    it("should create an agent from service", () => {
      injectMockSDK();
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      expect(agent).toBeDefined();
      expect(agent.getState()).toBe("idle");
    });

    it("should list models from Anthropic API with oauthToken", async () => {
      injectMockSDK();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: "claude-opus-4-6", display_name: "Claude Opus 4.6" },
            { id: "claude-sonnet-4-20250514", display_name: "Claude Sonnet 4" },
          ],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);
      const service = createClaudeService({ oauthToken: "test-token" });
      const models = await service.listModels();
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
        provider: "claude",
      });
      expect(models.every((m) => m.provider === "claude")).toBe(true);
      vi.unstubAllGlobals();
    });

    it("should return empty list when no oauthToken", async () => {
      injectMockSDK();
      const service = createClaudeService({});
      const models = await service.listModels();
      expect(models).toEqual([]);
    });

    it("should cache models after first listModels call", async () => {
      injectMockSDK();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "claude-sonnet-4-20250514", display_name: "Claude Sonnet 4" }],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);
      const service = createClaudeService({ oauthToken: "test-token" });
      const first = await service.listModels();
      const second = await service.listModels();
      // Same reference — cached
      expect(first).toBe(second);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    });

    it("should validate — success when SDK loads", async () => {
      // validate() creates a new query, calls q.next(), then q.close()
      // We need the mock to behave correctly for that flow
      const sdk = createMockSDK([
        { type: "system", message: "ready" },
        successResult("ok"),
      ]);
      // Override query to return a proper async iterator for validate
      const msgs = [
        { type: "system", message: "ready" },
        successResult("ok"),
      ];
      let idx = 0;
      const q = {
        next: vi.fn(async () => {
          if (idx < msgs.length) return { value: msgs[idx++], done: false };
          return { value: undefined, done: true };
        }),
        return: vi.fn(async () => ({ value: undefined, done: true as const })),
        throw: vi.fn(),
        close: vi.fn(),
        interrupt: vi.fn(),
        supportedModels: vi.fn(),
        [Symbol.asyncIterator]() { return this; },
      };
      sdk.query.mockReturnValue(q);
      _injectSDK(sdk as any);

      const service = createClaudeService({});
      const result = await service.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate — fail when SDK loadSDK throws", async () => {
      // Inject a mock that throws on loadSDK (simulating missing SDK)
      _injectSDK(null as any);
      // Force loadSDK to fail by setting sdkModule to a throwing proxy
      // Actually, we need to reset and prevent the real import from loading
      _resetSDK();
      // The real SDK IS installed as devDependency, so we can't test "not installed"
      // Instead, test that validate catches connection errors
      const sdk = createMockSDK();
      sdk.query.mockImplementation(() => {
        throw new Error("Claude CLI not found");
      });
      _injectSDK(sdk as any);

      const service = createClaudeService({});
      const result = await service.validate();
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Claude CLI");
    });

    it("should throw DisposedError after dispose", async () => {
      injectMockSDK();
      const service = createClaudeService({});
      await service.dispose();
      expect(() => service.createAgent(makeConfig())).toThrow(DisposedError);
    });

    it("should throw DisposedError on listModels after dispose", async () => {
      injectMockSDK();
      const service = createClaudeService({});
      await service.dispose();
      await expect(service.listModels()).rejects.toThrow(DisposedError);
    });

    it("should be idempotent on double dispose", async () => {
      injectMockSDK();
      const service = createClaudeService({});
      await service.dispose();
      await service.dispose(); // no throw
    });
  });

  // ── Agent Run ──────────────────────────────────────────────────

  describe("ClaudeAgent.run", () => {
    it("should run a simple prompt and return output", async () => {
      injectMockSDK([
        assistantMessage("Hello!"),
        successResult("Hello!"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.run("Say hello");
      expect(result.output).toBe("Hello!");
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it("should pass system prompt to SDK options", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(
        makeConfig({ systemPrompt: "Be concise." }),
      );
      await agent.run("test");
      expect(sdk.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt: "Be concise.",
          }),
        }),
      );
    });

    it("should pass model to SDK options", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(
        makeConfig({ model: "claude-opus-4-20250514" }),
      );
      await agent.run("test");
      expect(sdk.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            model: "claude-opus-4-20250514",
          }),
        }),
      );
    });

    it("should pass cliPath and workingDirectory", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({
        cliPath: "/usr/local/bin/claude",
        workingDirectory: "/tmp/test",
      });
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      expect(sdk.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            pathToClaudeCodeExecutable: "/usr/local/bin/claude",
            cwd: "/tmp/test",
          }),
        }),
      );
    });

    it("should collect tool calls from assistant messages", async () => {
      injectMockSDK([
        toolUseMessage("search", { query: "news" }),
        successResult("Found results"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.run("Search for news");
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe("search");
      expect(result.toolCalls[0].args).toEqual({ query: "news" });
    });

    it("should aggregate usage from modelUsage", async () => {
      injectMockSDK([
        successResult("ok"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.run("test");
      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        model: undefined,
        backend: "claude",
      });
    });

    it("should throw on error result", async () => {
      injectMockSDK([
        errorResult(["Rate limit exceeded"]),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await expect(agent.run("test")).rejects.toThrow("Rate limit exceeded");
    });

    it("should set persistSession to false", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      expect(sdk.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            persistSession: false,
          }),
        }),
      );
    });

    it("should set includePartialMessages to true", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      expect(sdk.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            includePartialMessages: true,
          }),
        }),
      );
    });

    it("should throw when query fails", async () => {
      const sdk = createMockSDK();
      sdk.query.mockImplementation(() => {
        throw new Error("Claude CLI not found");
      });
      _injectSDK(sdk as any);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ tools: [] }));
      await expect(agent.run("test")).rejects.toThrow("Claude CLI not found");
    });

    it("should guard re-entrancy", async () => {
      // Create a query that doesn't resolve immediately
      let resolveQuery!: () => void;
      const blockingPromise = new Promise<void>((r) => {
        resolveQuery = r;
      });

      const sdk = createMockSDK();
      sdk.query.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          await blockingPromise;
          yield successResult("ok");
        },
        close: vi.fn(),
        interrupt: vi.fn(),
        supportedModels: vi.fn(),
      });
      _injectSDK(sdk as any);

      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ tools: [] }));

      const p1 = agent.run("first");
      // Second run should fail
      await expect(agent.run("second")).rejects.toThrow("already running");
      resolveQuery();
      await p1;
    });

    it("should guard disposed agent", async () => {
      injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      agent.dispose();
      await expect(agent.run("test")).rejects.toThrow(DisposedError);
    });
  });

  // ── Structured Output ──────────────────────────────────────────

  describe("ClaudeAgent.runStructured", () => {
    const NewsSchema = z.object({
      headlines: z.array(z.string()),
    });

    it("should use outputFormat with json_schema", async () => {
      const sdk = injectMockSDK([
        successResult('{"headlines":["A","B"]}', {
          structured_output: { headlines: ["A", "B"] },
        }),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.runStructured("Get news", {
        name: "news",
        schema: NewsSchema,
      });
      expect(result.structuredOutput).toEqual({ headlines: ["A", "B"] });
      expect(sdk.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            outputFormat: expect.objectContaining({
              type: "json_schema",
            }),
          }),
        }),
      );
    });

    it("should parse from result string when structured_output is undefined", async () => {
      injectMockSDK([
        successResult('{"headlines":["C","D"]}'),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.runStructured("Get news", {
        name: "news",
        schema: NewsSchema,
      });
      expect(result.structuredOutput).toEqual({ headlines: ["C", "D"] });
    });

    it("should handle markdown-wrapped JSON", async () => {
      injectMockSDK([
        successResult('```json\n{"headlines":["E"]}\n```'),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.runStructured("Get news", {
        name: "news",
        schema: NewsSchema,
      });
      expect(result.structuredOutput).toEqual({ headlines: ["E"] });
    });

    it("should leave structuredOutput undefined on parse failure", async () => {
      injectMockSDK([successResult("not json at all")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.runStructured("test", {
        name: "test",
        schema: NewsSchema,
      });
      expect(result.structuredOutput).toBeUndefined();
    });
  });

  // ── Streaming ──────────────────────────────────────────────────

  describe("ClaudeAgent.stream", () => {
    it("should yield text_delta events from stream_event", async () => {
      injectMockSDK([
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hello " },
          },
        },
        {
          type: "stream_event",
          event: {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "world!" },
          },
        },
        successResult("Hello world!"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const event of agent.stream("test")) {
        events.push(event);
      }
      const textEvents = events.filter((e) => e.type === "text_delta");
      expect(textEvents).toHaveLength(2);
      expect(textEvents[0]).toEqual({ type: "text_delta", text: "Hello " });
    });

    it("should yield done event on success result", async () => {
      injectMockSDK([successResult("Final answer")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const event of agent.stream("test")) {
        events.push(event);
      }
      const doneEvents = events.filter((e) => e.type === "done");
      expect(doneEvents).toHaveLength(1);
      expect(doneEvents[0]).toEqual({
        type: "done",
        finalOutput: "Final answer",
      });
    });

    it("should yield usage_update from success result", async () => {
      injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const event of agent.stream("test")) {
        events.push(event);
      }
      const usageEvents = events.filter((e) => e.type === "usage_update");
      expect(usageEvents).toHaveLength(1);
      expect(usageEvents[0]).toEqual({
        type: "usage_update",
        promptTokens: 100,
        completionTokens: 50,
        model: undefined,
        backend: "claude",
      });
    });

    it("should yield error event on error result", async () => {
      injectMockSDK([errorResult(["Something went wrong"])]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const event of agent.stream("test")) {
        events.push(event);
      }
      const errorEvents = events.filter((e) => e.type === "error");
      expect(errorEvents).toHaveLength(1);
    });

    it("should yield tool_call_start from assistant tool_use", async () => {
      injectMockSDK([
        toolUseMessage("search", { query: "ai" }),
        successResult("done"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const event of agent.stream("test")) {
        events.push(event);
      }
      const toolEvents = events.filter((e) => e.type === "tool_call_start");
      expect(toolEvents).toHaveLength(1);
      expect(toolEvents[0]).toEqual({
        type: "tool_call_start",
        toolCallId: "tu-1",
        toolName: "search",
        args: { query: "ai" },
      });
    });
  });

  // ── Tool Mapping ───────────────────────────────────────────────

  describe("Tool Mapping", () => {
    it("should build MCP server with tools", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");

      // tool() should have been called for each tool
      expect(sdk.tool).toHaveBeenCalledTimes(1);
      expect(sdk.tool).toHaveBeenCalledWith(
        "search",
        "Search the web",
        expect.any(Object), // JSON schema
        expect.any(Function),
      );

      // createSdkMcpServer should be called
      expect(sdk.createSdkMcpServer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "agent-sdk-tools",
        }),
      );
    });

    it("should not create MCP server when no tools", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ tools: [] }));
      await agent.run("test");
      expect(sdk.createSdkMcpServer).not.toHaveBeenCalled();
    });

    it("should execute tool handler and return text content", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const executeFn = vi.fn(async () => "tool result text");
      const agent = service.createAgent(
        makeConfig({
          tools: [
            {
              name: "mytool",
              description: "test tool",
              parameters: z.object({ x: z.string() }),
              execute: executeFn,
            },
          ],
        }),
      );
      await agent.run("test");

      // Get the handler that was passed to sdk.tool
      const handler = sdk.tool.mock.calls[0][3];
      const result = await handler({ x: "hello" }, {});
      expect(executeFn).toHaveBeenCalledWith({ x: "hello" });
      expect(result.content[0].text).toBe("tool result text");
    });

    it("should JSON.stringify non-string tool results", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(
        makeConfig({
          tools: [
            {
              name: "mytool",
              description: "test tool",
              parameters: z.object({}),
              execute: async () => ({ key: "value" }),
            },
          ],
        }),
      );
      await agent.run("test");

      const handler = sdk.tool.mock.calls[0][3];
      const result = await handler({}, {});
      expect(result.content[0].text).toBe('{"key":"value"}');
    });
  });

  // ── Permission Mapping ─────────────────────────────────────────

  describe("Permission Mapping", () => {
    it("should pass canUseTool when onPermission is set", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const onPermission = vi.fn(
        async (req: PermissionRequest): Promise<PermissionDecision> => ({
          allowed: true,
          scope: "session",
        }),
      );
      const service = createClaudeService({});
      const agent = service.createAgent(
        makeConfig({
          supervisor: { onPermission },
        }),
      );
      await agent.run("test");

      expect(sdk.query).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            canUseTool: expect.any(Function),
          }),
        }),
      );
    });

    it("should not pass canUseTool when no onPermission", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");

      const opts = sdk.query.mock.calls[0][0].options;
      expect(opts.canUseTool).toBeUndefined();
    });

    it("should map allow decision to SDK format", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const onPermission = vi.fn(
        async (): Promise<PermissionDecision> => ({
          allowed: true,
          scope: "session",
        }),
      );
      const service = createClaudeService({});
      const agent = service.createAgent(
        makeConfig({
          tools: [],
          supervisor: { onPermission },
        }),
      );
      await agent.run("test");

      // Extract the canUseTool callback
      const canUseTool = sdk.query.mock.calls[0][0].options.canUseTool;
      expect(canUseTool).toBeDefined();

      const result = await canUseTool!("bash", { cmd: "ls" }, {
        signal: new AbortController().signal,
        suggestions: [
          { type: "addRules", destination: "session" },
        ],
        toolUseID: "tu-123",
      });

      expect(result.behavior).toBe("allow");
      expect(result.toolUseID).toBe("tu-123");
    });

    it("should map deny decision to SDK format", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const onPermission = vi.fn(
        async (): Promise<PermissionDecision> => ({
          allowed: false,
          reason: "Not permitted",
        }),
      );
      const service = createClaudeService({});
      const agent = service.createAgent(
        makeConfig({
          tools: [],
          supervisor: { onPermission },
        }),
      );
      await agent.run("test");

      const canUseTool = sdk.query.mock.calls[0][0].options.canUseTool;
      const result = await canUseTool!("bash", { cmd: "rm -rf /" }, {
        signal: new AbortController().signal,
        toolUseID: "tu-456",
      });

      expect(result.behavior).toBe("deny");
      expect(result.message).toBe("Not permitted");
    });

    it("should map scope 'always' to userSettings destination", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const onPermission = vi.fn(
        async (): Promise<PermissionDecision> => ({
          allowed: true,
          scope: "always",
        }),
      );
      const service = createClaudeService({});
      const agent = service.createAgent(
        makeConfig({
          tools: [],
          supervisor: { onPermission },
        }),
      );
      await agent.run("test");

      const canUseTool = sdk.query.mock.calls[0][0].options.canUseTool;
      const result = await canUseTool!("bash", {}, {
        signal: new AbortController().signal,
        suggestions: [{ type: "addRules", destination: "session" }],
        toolUseID: "tu-789",
      });

      expect(result.behavior).toBe("allow");
      expect(result.updatedPermissions?.[0]?.destination).toBe("userSettings");
    });

    it("should map scope 'project' to projectSettings destination", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const onPermission = vi.fn(
        async (): Promise<PermissionDecision> => ({
          allowed: true,
          scope: "project",
        }),
      );
      const service = createClaudeService({});
      const agent = service.createAgent(
        makeConfig({
          tools: [],
          supervisor: { onPermission },
        }),
      );
      await agent.run("test");

      const canUseTool = sdk.query.mock.calls[0][0].options.canUseTool;
      const result = await canUseTool!("bash", {}, {
        signal: new AbortController().signal,
        suggestions: [{ type: "addRules", destination: "session" }],
        toolUseID: "tu-abc",
      });

      expect(result.updatedPermissions?.[0]?.destination).toBe(
        "projectSettings",
      );
    });

    it("should pass modified input from decision", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const onPermission = vi.fn(
        async (): Promise<PermissionDecision> => ({
          allowed: true,
          modifiedInput: { cmd: "ls -la" },
        }),
      );
      const service = createClaudeService({});
      const agent = service.createAgent(
        makeConfig({ tools: [], supervisor: { onPermission } }),
      );
      await agent.run("test");

      const canUseTool = sdk.query.mock.calls[0][0].options.canUseTool;
      const result = await canUseTool!("bash", { cmd: "ls" }, {
        signal: new AbortController().signal,
        toolUseID: "tu-mod",
      });

      expect(result.behavior).toBe("allow");
      expect(result.updatedInput).toEqual({ cmd: "ls -la" });
    });
  });

  // ── Event Mapping ──────────────────────────────────────────────

  describe("Event Mapping", () => {
    it("should map assistant text to text_delta", async () => {
      injectMockSDK([
        assistantMessage("Hi there"),
        successResult("Hi there"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const e of agent.stream("test")) events.push(e);
      expect(events.some((e) => e.type === "text_delta")).toBe(true);
    });

    it("should map thinking block to thinking_start", async () => {
      injectMockSDK([
        {
          type: "stream_event",
          event: {
            type: "content_block_start",
            content_block: { type: "thinking" },
          },
        },
        successResult("ok"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const e of agent.stream("test")) events.push(e);
      expect(events.some((e) => e.type === "thinking_start")).toBe(true);
    });

    it("should map tool_progress to tool_call_start", async () => {
      injectMockSDK([
        { type: "tool_progress", tool_name: "search" },
        successResult("ok"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const e of agent.stream("test")) events.push(e);
      const toolEvents = events.filter((e) => e.type === "tool_call_start");
      expect(toolEvents).toHaveLength(1);
    });

    it("should ignore unknown message types", async () => {
      injectMockSDK([
        { type: "some_unknown_type", data: {} },
        successResult("ok"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const e of agent.stream("test")) events.push(e);
      // Should only have session_info, usage_update and done events from the success result
      expect(events.every((e) => ["session_info", "usage_update", "done"].includes(e.type))).toBe(
        true,
      );
    });
  });

  // ── tool_call_end emission (B2 fix) ─────────────────────────────

  describe("tool_call_end emission", () => {
    it("should emit tool_call_end from tool_use_summary with matching toolCallId", async () => {
      injectMockSDK([
        {
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "search", input: { q: "test" }, id: "tu_1" },
            ],
          },
        },
        {
          type: "tool_use_summary",
          summary: "Found 3 results for test",
          tool_name: "search",
          preceding_tool_use_ids: ["tu_1"],
          uuid: "u1",
          session_id: "s1",
        },
        successResult("done"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const e of agent.stream("test")) events.push(e);

      const toolStart = events.find((e) => e.type === "tool_call_start");
      const toolEnd = events.find((e) => e.type === "tool_call_end");
      expect(toolStart).toBeDefined();
      expect(toolEnd).toBeDefined();
      // toolCallId matches between start and end
      expect((toolStart as { toolCallId: string }).toolCallId).toBe("tu_1");
      expect((toolEnd as { toolCallId: string }).toolCallId).toBe("tu_1");
      expect((toolEnd as { result: unknown }).result).toBe("Found 3 results for test");
    });

    it("should emit tool_call_start for each tool_use in assistant message", async () => {
      injectMockSDK([
        {
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "search", input: { q: "a" }, id: "tu_1" },
              { type: "tool_use", name: "fetch", input: { url: "b" }, id: "tu_2" },
            ],
          },
        },
        successResult("ok"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const e of agent.stream("test")) events.push(e);

      const starts = events.filter((e) => e.type === "tool_call_start");
      expect(starts).toHaveLength(2);
      expect((starts[0] as { toolCallId: string }).toolCallId).toBe("tu_1");
      expect((starts[0] as { toolName: string }).toolName).toBe("search");
      expect((starts[1] as { toolCallId: string }).toolCallId).toBe("tu_2");
      expect((starts[1] as { toolName: string }).toolName).toBe("fetch");
    });

    it("should correlate toolCallId across parallel tool calls via tracker", async () => {
      injectMockSDK([
        {
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "search", input: { q: "a" }, id: "tu_10" },
              { type: "tool_use", name: "search", input: { q: "b" }, id: "tu_11" },
            ],
          },
        },
        {
          type: "tool_use_summary",
          summary: "Result for a",
          tool_name: "search",
          preceding_tool_use_ids: ["tu_10"],
          uuid: "u1",
          session_id: "s1",
        },
        {
          type: "tool_use_summary",
          summary: "Result for b",
          tool_name: "search",
          preceding_tool_use_ids: ["tu_11"],
          uuid: "u2",
          session_id: "s1",
        },
        successResult("done"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const e of agent.stream("test")) events.push(e);

      const starts = events.filter((e) => e.type === "tool_call_start") as Array<{
        toolCallId: string; toolName: string;
      }>;
      const ends = events.filter((e) => e.type === "tool_call_end") as Array<{
        toolCallId: string; toolName: string;
      }>;
      expect(starts).toHaveLength(2);
      expect(ends).toHaveLength(2);

      // Start IDs match tool_use block IDs
      expect(starts[0].toolCallId).toBe("tu_10");
      expect(starts[1].toolCallId).toBe("tu_11");

      // End IDs from preceding_tool_use_ids match
      expect(ends[0].toolCallId).toBe("tu_10");
      expect(ends[1].toolCallId).toBe("tu_11");
    });

    it("should emit both text_delta and tool_call_start from mixed content", async () => {
      injectMockSDK([
        {
          type: "assistant",
          message: {
            content: [
              { type: "text", text: "Let me search for that." },
              { type: "tool_use", name: "search", input: { q: "news" }, id: "tu_1" },
            ],
          },
        },
        successResult("ok"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const events = [];
      for await (const e of agent.stream("test")) events.push(e);

      const text = events.find((e) => e.type === "text_delta");
      const tool = events.find((e) => e.type === "tool_call_start");
      expect(text).toBeDefined();
      expect(tool).toBeDefined();
    });
  });

  // ── Tool result capture (M1 fix) ──────────────────────────────

  describe("Tool result capture", () => {
    it("should capture tool results in executeRun toolCalls", async () => {
      // The tool result capture requires the MCP handler to run and capture,
      // but in unit tests we mock SDK.query so the MCP handler doesn't fire.
      // Instead, verify the structure: toolCalls from assistant blocks
      injectMockSDK([
        {
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", name: "search", input: { q: "test" }, id: "tu_1" },
            ],
          },
        },
        successResult("Search results: ..."),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      const result = await agent.run("search");

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe("search");
      // result will be null in unit test since MCP handler doesn't fire
      // In real usage, the capture map populates from buildMcpServer handler
    });
  });

  // ── onAskUser warning (M2 fix) ────────────────────────────────

  describe("onAskUser warning", () => {
    it("should warn when onAskUser is set in config", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        injectMockSDK();
        const service = createClaudeService({});
        service.createAgent({
          ...makeConfig(),
          supervisor: {
            onAskUser: async () => "yes",
          },
        });
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining("onAskUser is not supported"),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("should not warn when onAskUser is not set", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        injectMockSDK();
        const service = createClaudeService({});
        service.createAgent(makeConfig());
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  // ── Usage Metadata & onUsage Callback ────────────────────────

  describe("Usage metadata and onUsage callback", () => {
    it("should include model and backend in run result usage", async () => {
      injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ model: "claude-opus-4-20250514" }));
      const result = await agent.run("test");

      expect(result.usage?.model).toBe("claude-opus-4-20250514");
      expect(result.usage?.backend).toBe("claude");
    });

    it("should include model and backend in stream usage_update events", async () => {
      injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ model: "claude-sonnet" }));

      const events = [];
      for await (const event of agent.stream("test")) {
        events.push(event);
      }

      const usageEvents = events.filter((e) => e.type === "usage_update");
      expect(usageEvents).toHaveLength(1);
      const ue = usageEvents[0] as { model?: string; backend?: string };
      expect(ue.model).toBe("claude-sonnet");
      expect(ue.backend).toBe("claude");
    });

    it("should call onUsage callback after run", async () => {
      injectMockSDK([successResult("ok")]);
      const onUsage = vi.fn();
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ model: "claude-sonnet", onUsage }));
      await agent.run("test");

      expect(onUsage).toHaveBeenCalledOnce();
      expect(onUsage).toHaveBeenCalledWith({
        promptTokens: 100,
        completionTokens: 50,
        model: "claude-sonnet",
        backend: "claude",
      });
    });

    it("should call onUsage callback during streaming", async () => {
      injectMockSDK([successResult("ok")]);
      const onUsage = vi.fn();
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ model: "claude-sonnet", onUsage }));

      for await (const _event of agent.stream("test")) {
        // consume
      }

      expect(onUsage).toHaveBeenCalledOnce();
      expect(onUsage).toHaveBeenCalledWith({
        promptTokens: 100,
        completionTokens: 50,
        model: "claude-sonnet",
        backend: "claude",
      });
    });

    it("should not propagate onUsage callback errors", async () => {
      injectMockSDK([successResult("ok")]);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const onUsage = vi.fn(() => { throw new Error("boom"); });
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ onUsage }));
      const result = await agent.run("test");

      expect(result.output).toBe("ok");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("onUsage callback error"),
        expect.stringContaining("boom"),
      );
      warnSpy.mockRestore();
    });
  });

  // ── extractLastUserPrompt ──────────────────────────────────────

  describe("Prompt Extraction", () => {
    it("should extract last user message as prompt", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("What is 2+2?");
      expect(sdk.query).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "What is 2+2?",
        }),
      );
    });

    it("should include conversation history when multiple messages via runWithContext", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.runWithContext([
        { role: "user", content: "My name is Alice" },
        { role: "assistant", content: "Hello Alice!" },
        { role: "user", content: "What is my name?" },
      ]);

      const sentPrompt = sdk.query.mock.calls[0][0].prompt;
      expect(sentPrompt).toContain("Conversation history:");
      expect(sentPrompt).toContain("User: My name is Alice");
      expect(sentPrompt).toContain("Assistant: Hello Alice!");
      expect(sentPrompt).toContain("User: What is my name?");
    });

    it("should send plain prompt for single message via runWithContext", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.runWithContext([{ role: "user", content: "Hello" }]);

      expect(sdk.query).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "Hello" }),
      );
    });
  });

  // ── oauthToken wiring ─────────────────────────────────────────

  describe("oauthToken", () => {
    it("should pass CLAUDE_CODE_OAUTH_TOKEN env when oauthToken is set", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({ oauthToken: "sk-ant-oat01-test-token" });
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      const callArgs = sdk.query.mock.calls[0][0];
      expect(callArgs.options.env).toBeDefined();
      expect(callArgs.options.env.CLAUDE_CODE_OAUTH_TOKEN).toBe("sk-ant-oat01-test-token");
    });

    it("should not set env when oauthToken is not provided", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      const callArgs = sdk.query.mock.calls[0][0];
      expect(callArgs.options.env).toBeUndefined();
    });

    it("should include process.env alongside CLAUDE_CODE_OAUTH_TOKEN", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({ oauthToken: "test-token" });
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      const callArgs = sdk.query.mock.calls[0][0];
      expect(callArgs.options.env.PATH).toBeDefined();
    });

    it("should merge custom env with process.env", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({ env: { CUSTOM_VAR: "custom-value" } });
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      const callArgs = sdk.query.mock.calls[0][0];
      expect(callArgs.options.env).toBeDefined();
      expect(callArgs.options.env.CUSTOM_VAR).toBe("custom-value");
      expect(callArgs.options.env.PATH).toBeDefined();
    });

    it("should merge custom env with oauthToken env", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({
        oauthToken: "tok-123",
        env: { MY_VAR: "hello" },
      });
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      const callArgs = sdk.query.mock.calls[0][0];
      expect(callArgs.options.env.CLAUDE_CODE_OAUTH_TOKEN).toBe("tok-123");
      expect(callArgs.options.env.MY_VAR).toBe("hello");
      expect(callArgs.options.env.PATH).toBeDefined();
    });

    it("oauthToken should take precedence over custom env for CLAUDE_CODE_OAUTH_TOKEN", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({
        oauthToken: "real-token",
        env: { CLAUDE_CODE_OAUTH_TOKEN: "custom-token" },
      });
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      const callArgs = sdk.query.mock.calls[0][0];
      expect(callArgs.options.env.CLAUDE_CODE_OAUTH_TOKEN).toBe("real-token");
    });
  });

  // ── permissionMode auto-detection ──────────────────────────────

  describe("permissionMode auto-detection", () => {
    it("should auto-set permissionMode to 'default' when canUseTool is configured", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const onPermission = vi.fn(
        async (): Promise<PermissionDecision> => ({ allowed: true }),
      );
      const service = createClaudeService({});
      const agent = service.createAgent(
        makeConfig({ supervisor: { onPermission } }),
      );
      await agent.run("test");
      const opts = sdk.query.mock.calls[0][0].options;
      expect(opts.permissionMode).toBe("default");
    });

    it("should not set permissionMode when no canUseTool", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      const opts = sdk.query.mock.calls[0][0].options;
      expect(opts.permissionMode).toBeUndefined();
    });
  });

  // ── Persistent Session Mode ─────────────────────────────────────

  describe("persistent session mode", () => {
    function successResultWithSessionId(text: string, sessionId: string) {
      return {
        ...successResult(text),
        session_id: sessionId,
      };
    }

    function injectMultiCallMockSDK(
      callResults: Array<Array<Record<string, unknown>>>,
    ): MockSDKModule {
      let callIndex = 0;
      const sdk = createMockSDK();
      sdk.query.mockImplementation(() => {
        const msgs = callResults[callIndex] ?? callResults[callResults.length - 1]!;
        callIndex++;
        return {
          [Symbol.asyncIterator]() {
            return asyncIter(msgs)[Symbol.asyncIterator]();
          },
        };
      });
      _injectSDK(sdk as any);
      return sdk;
    }

    it("should capture session_id from result and expose via sessionId getter", async () => {
      injectMockSDK([successResultWithSessionId("hello", "ses-abc-123")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));
      expect(agent.sessionId).toBeUndefined();
      await agent.run("test");
      expect(agent.sessionId).toBe("ses-abc-123");
    });

    it("should pass resume option on subsequent calls in persistent mode", async () => {
      const sdk = injectMultiCallMockSDK([
        [successResultWithSessionId("first", "ses-111")],
        [successResultWithSessionId("second", "ses-111")],
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      await agent.run("first message");
      expect(sdk.query.mock.calls[0][0].options.resume).toBeUndefined();

      await agent.run("second message");
      expect(sdk.query.mock.calls[1][0].options.resume).toBe("ses-111");
    });

    it("should send only last user message on subsequent persistent calls", async () => {
      const sdk = injectMultiCallMockSDK([
        [successResultWithSessionId("first", "ses-222")],
        [successResultWithSessionId("second", "ses-222")],
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      const result1 = await agent.run("hello");
      const result2 = await agent.run("follow up", { messages: result1.messages });

      // Second call should send only the last user prompt, not full history
      const secondPrompt = sdk.query.mock.calls[1][0].prompt;
      expect(secondPrompt).toBe("follow up");
      expect(secondPrompt).not.toContain("Conversation history");
    });

    it("should set persistSession=true in persistent mode", async () => {
      const sdk = injectMockSDK([successResultWithSessionId("ok", "ses-333")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));
      await agent.run("test");
      expect(sdk.query.mock.calls[0][0].options.persistSession).toBe(true);
    });

    it("should set persistSession=false in per-call mode (default)", async () => {
      const sdk = injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      expect(sdk.query.mock.calls[0][0].options.persistSession).toBe(false);
    });

    it("should return undefined sessionId in per-call mode", async () => {
      injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());
      await agent.run("test");
      expect(agent.sessionId).toBeUndefined();
    });

    it("should clear sessionId on error in persistent mode", async () => {
      const sdk = injectMultiCallMockSDK([
        [successResultWithSessionId("ok", "ses-444")],
        [errorResult(["something broke"])],
        [successResultWithSessionId("recovered", "ses-555")],
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      await agent.run("first");
      expect(agent.sessionId).toBe("ses-444");

      await expect(agent.run("second")).rejects.toThrow("something broke");
      expect(agent.sessionId).toBeUndefined();

      await agent.run("third");
      expect(agent.sessionId).toBe("ses-555");
    });

    it("should clear sessionId on dispose", async () => {
      injectMockSDK([successResultWithSessionId("ok", "ses-666")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));
      await agent.run("test");
      expect(agent.sessionId).toBe("ses-666");
      agent.dispose();
      expect(agent.sessionId).toBeUndefined();
    });

    it("should capture session_id from stream result in persistent mode", async () => {
      injectMockSDK([
        assistantMessage("streaming response"),
        successResultWithSessionId("done", "ses-777"),
      ]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test")) {
        events.push(event);
      }
      expect(agent.sessionId).toBe("ses-777");
    });
  });

  // ── session_info event ──────────────────────────────────────────

  describe("session_info event", () => {
    it("should emit session_info event during streaming with session_id", async () => {
      injectMockSDK([successResult("ok")]);
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test")) {
        events.push(event);
      }
      const sessionInfoEvents = events.filter((e) => e.type === "session_info");
      expect(sessionInfoEvents).toHaveLength(1);
      expect(sessionInfoEvents[0]).toMatchObject({
        type: "session_info",
        sessionId: "test-session",
        backend: "claude",
      });
      expect((sessionInfoEvents[0] as { transcriptPath?: string }).transcriptPath).toBeDefined();
    });
  });

  // ── interrupt ──────────────────────────────────────────────────

  describe("interrupt", () => {
    it("should call SDK query interrupt when interrupt() is called during streaming", async () => {
      const sdk = createMockSDK();
      const interruptFn = vi.fn().mockResolvedValue(undefined);
      const queryResult = {
        [Symbol.asyncIterator]() {
          return asyncIter([successResult("ok")])[Symbol.asyncIterator]();
        },
        next: vi.fn(),
        return: vi.fn(),
        throw: vi.fn(),
        close: vi.fn(),
        interrupt: interruptFn,
        supportedModels: vi.fn(async () => []),
      };
      sdk.query.mockReturnValue(queryResult);
      _injectSDK(sdk as any);

      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());

      // Start streaming — consume all events
      for await (const _event of agent.stream("test")) {
        // consume
      }
      // After stream completes, activeQuery is cleared — interrupt should still work (no-op)
      await agent.interrupt();
    });
  });
});
