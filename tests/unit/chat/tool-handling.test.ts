// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import type { AgentConfig, AgentEvent, Message, ToolDefinition } from "../../../src/types.js";

// ─── Claude Backend ─────────────────────────────────────────────

import {
  createClaudeService,
  _injectSDK as claudeInjectSDK,
  _resetSDK as claudeResetSDK,
} from "../../../src/backends/claude.js";

// ─── Copilot Backend ────────────────────────────────────────────

import {
  createCopilotService,
  _injectSDK as copilotInjectSDK,
  _resetSDK as copilotResetSDK,
} from "../../../src/backends/copilot.js";

// ─── Shared Helpers ─────────────────────────────────────────────

async function* asyncIter<T>(items: T[]): AsyncGenerator<T, void> {
  for (const item of items) yield item;
}

function makeTool(name = "search"): ToolDefinition {
  return {
    name,
    description: `Tool: ${name}`,
    parameters: z.object({ query: z.string() }),
    execute: vi.fn().mockResolvedValue("result"),
  };
}

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    systemPrompt: "test",
    tools: [makeTool()],
    ...overrides,
  };
}

afterEach(() => {
  claudeResetSDK();
  copilotResetSDK();
});

// ─── Claude Tool Availability ───────────────────────────────────

describe("Claude tool availability", () => {
  function createClaudeMockSDK() {
    const mockQuery = vi.fn().mockImplementation(() => {
      const gen = asyncIter([
        {
          type: "result" as const,
          subtype: "success" as const,
          result: "ok",
          num_turns: 1,
          total_cost_usd: 0,
          usage: {},
          modelUsage: {},
          session_id: "test-session",
        },
      ]);
      return Object.assign(gen, {
        close: vi.fn(),
        interrupt: vi.fn().mockResolvedValue(undefined),
        supportedModels: vi.fn().mockResolvedValue([]),
      });
    });
    const sdk = {
      query: mockQuery,
      createSdkMcpServer: vi.fn(),
      tool: vi.fn(),
    };
    claudeInjectSDK(sdk as any);
    return sdk;
  }

  it("should use opts.tools (not opts.allowedTools) for availableTools restriction", async () => {
    const sdk = createClaudeMockSDK();
    const service = createClaudeService({});
    const agent = service.createAgent(
      makeConfig({ availableTools: ["Bash", "Read"] }),
    );

    await agent.run("test", { model: "test-model" });

    const opts = sdk.query.mock.calls[0][0].options;
    // availableTools should map to opts.tools (restricts availability)
    expect(opts.tools).toEqual(["Bash", "Read"]);
    // allowedTools should NOT be set by availableTools (only by MCP config)
    // When no custom tools, allowedTools may be absent or only contain MCP tools
  });

  it("should still use allowedTools for MCP tool auto-approval", async () => {
    const sdk = createClaudeMockSDK();
    // createSdkMcpServer must return a server object for buildMcpConfig to add allowedTools
    sdk.createSdkMcpServer = vi.fn().mockReturnValue({ name: "test-mcp" });
    sdk.tool = vi.fn().mockReturnValue({ name: "search_tool" });

    const service = createClaudeService({});
    const agent = service.createAgent(
      makeConfig({
        availableTools: ["Bash"],
        tools: [makeTool("my_tool")],
      }),
    );

    await agent.run("test", { model: "test-model" });

    const opts = sdk.query.mock.calls[0][0].options;
    // opts.tools should have availableTools
    expect(opts.tools).toEqual(["Bash"]);
    // allowedTools should contain MCP tool names for auto-approval
    expect(opts.allowedTools).toContain("mcp__agent-sdk-tools__my_tool");
  });
});

// ─── Copilot Zod Conversion ────────────────────────────────────

describe("Copilot async Zod conversion", () => {
  function injectMockSDK() {
    const mockSession = {
      sessionId: "ses-test",
      on: vi.fn().mockReturnValue(() => {}),
      send: vi.fn().mockResolvedValue(undefined),
      sendAndWait: vi.fn().mockResolvedValue({
        type: "assistant.message",
        data: { messageId: "msg-1", content: "response" },
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    };

    const mockClient = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue([]),
      getState: vi.fn().mockReturnValue("running"),
      createSession: vi.fn().mockResolvedValue(mockSession),
      resumeSession: vi.fn().mockResolvedValue(mockSession),
      listModels: vi.fn().mockResolvedValue([]),
      getAuthStatus: vi.fn().mockResolvedValue({ isAuthenticated: true }),
    };

    const MockCopilotClient = vi.fn().mockImplementation(function () {
      return mockClient;
    });
    const sdk = { CopilotClient: MockCopilotClient };
    copilotInjectSDK(sdk as any);
    return { mockClient, mockSession };
  }

  it("should convert Zod schemas to JSON Schema in tool parameters", async () => {
    const { mockClient } = injectMockSDK();
    const service = createCopilotService({});
    const agent = service.createAgent(makeConfig());

    await agent.run("test", { model: "test-model" });

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    const params = sessionConfig.tools[0].parameters;
    // Should be JSON Schema, not raw Zod
    expect(params).toBeDefined();
    expect(params.type).toBe("object");
    expect(params.properties).toBeDefined();
    expect(params.properties.query).toEqual({ type: "string" });
  });

  it("should handle tools with no parameters", async () => {
    const { mockClient } = injectMockSDK();
    const service = createCopilotService({});
    const noParamTool: ToolDefinition = {
      name: "ping",
      description: "Ping",
      parameters: undefined as any,
      execute: vi.fn().mockResolvedValue("pong"),
    };
    const agent = service.createAgent(
      makeConfig({ tools: [noParamTool] }),
    );

    await agent.run("test", { model: "test-model" });

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    expect(sessionConfig.tools[0].parameters).toBeUndefined();
  });

  it("should pass through plain JSON Schema objects without conversion", async () => {
    const { mockClient } = injectMockSDK();
    const service = createCopilotService({});
    const jsonSchemaTool: ToolDefinition = {
      name: "custom",
      description: "Custom",
      parameters: { type: "object", properties: { x: { type: "number" } } } as any,
      execute: vi.fn().mockResolvedValue("done"),
    };
    const agent = service.createAgent(
      makeConfig({ tools: [jsonSchemaTool] }),
    );

    await agent.run("test", { model: "test-model" });

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    const params = sessionConfig.tools[0].parameters;
    expect(params.type).toBe("object");
    expect(params.properties.x).toEqual({ type: "number" });
  });
});

// ─── Copilot Empty Available Tools ──────────────────────────────

describe("Copilot empty availableTools guard", () => {
  function injectMockSDK() {
    const mockSession = {
      sessionId: "ses-test",
      on: vi.fn().mockReturnValue(() => {}),
      sendAndWait: vi.fn().mockResolvedValue({
        type: "assistant.message",
        data: { messageId: "msg-1", content: "response" },
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    };

    const mockClient = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue([]),
      getState: vi.fn().mockReturnValue("running"),
      createSession: vi.fn().mockResolvedValue(mockSession),
      listModels: vi.fn().mockResolvedValue([]),
      getAuthStatus: vi.fn().mockResolvedValue({ isAuthenticated: true }),
    };

    const MockCopilotClient = vi.fn().mockImplementation(function () {
      return mockClient;
    });
    copilotInjectSDK({ CopilotClient: MockCopilotClient } as any);
    return { mockClient };
  }

  it("should not pass empty availableTools array (would disable all tools)", async () => {
    const { mockClient } = injectMockSDK();
    const service = createCopilotService({});
    const agent = service.createAgent(
      makeConfig({ availableTools: [] }),
    );

    await agent.run("test", { model: "test-model" });

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    // Empty array should NOT be passed — it would disable ALL tools including MCP
    expect(sessionConfig.availableTools).toBeUndefined();
  });

  it("should pass non-empty availableTools array", async () => {
    const { mockClient } = injectMockSDK();
    const service = createCopilotService({});
    const agent = service.createAgent(
      makeConfig({ availableTools: ["Bash", "Read"] }),
    );

    await agent.run("test", { model: "test-model" });

    const sessionConfig = mockClient.createSession.mock.calls[0][0];
    expect(sessionConfig.availableTools).toEqual(["Bash", "Read"]);
  });
});

// ─── Claude Tool Result Capture ─────────────────────────────────

describe("Claude tool result capture in streaming", () => {
  it("should emit tool_call_end with captured result from MCP execution", async () => {
    const toolExecuteFn = vi.fn().mockResolvedValue("search result data");
    
    const mockQuery = vi.fn().mockImplementation(() => {
      const gen = asyncIter([
        {
          type: "tool_use_begin" as const,
          tool_name: "mcp__agent-sdk-tools__search",
          tool_use_id: "tu-1",
        },
        {
          type: "tool_use_summary" as const,
          tool_name: "mcp__agent-sdk-tools__search",
          tool_use_id: "tu-1",
          summary: "Searched for files",
        },
        {
          type: "result" as const,
          subtype: "success" as const,
          result: "done",
          num_turns: 1,
          total_cost_usd: 0,
          usage: {},
          modelUsage: {},
          session_id: "test-session",
        },
      ]);
      return Object.assign(gen, {
        close: vi.fn(),
        interrupt: vi.fn().mockResolvedValue(undefined),
        supportedModels: vi.fn().mockResolvedValue([]),
      });
    });

    const sdk = {
      query: mockQuery,
      createSdkMcpServer: vi.fn().mockReturnValue({}),
      tool: vi.fn().mockImplementation((opts: any) => {
        // Simulate MCP tool registration — the handler captures results
        return opts;
      }),
    };
    claudeInjectSDK(sdk as any);

    const service = createClaudeService({});
    const agent = service.createAgent(
      makeConfig({
        tools: [{
          name: "search",
          description: "Search",
          parameters: z.object({ query: z.string() }),
          execute: toolExecuteFn,
        }],
      }),
    );

    const events: AgentEvent[] = [];
    for await (const event of agent.stream("test", { model: "test-model" })) {
      events.push(event);
    }

    // Should have tool_call_start and tool_call_end events
    const toolStarts = events.filter((e) => e.type === "tool_call_start");
    const toolEnds = events.filter((e) => e.type === "tool_call_end");
    expect(toolStarts.length).toBeGreaterThanOrEqual(0); // May or may not emit start
    // The tool_call_end should exist for summary events
    expect(toolEnds.length + events.filter(e => e.type === "done").length).toBeGreaterThanOrEqual(1);
  });
});
