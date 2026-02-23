// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import type { AgentConfig, AgentEvent, Message } from "../../../src/types.js";

// ─── Claude Backend Tests ───────────────────────────────────────

import {
  createClaudeService,
  _injectSDK as claudeInjectSDK,
  _resetSDK as claudeResetSDK,
} from "../../../src/backends/claude.js";

// ─── Copilot Backend Tests ──────────────────────────────────────

import {
  createCopilotService,
  _injectSDK as copilotInjectSDK,
  _resetSDK as copilotResetSDK,
} from "../../../src/backends/copilot.js";

// ─── Shared Helpers ─────────────────────────────────────────────

async function* asyncIter<T>(items: T[]): AsyncGenerator<T, void> {
  for (const item of items) yield item;
}

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    systemPrompt: "test",
    tools: [],
    ...overrides,
  };
}

function successResult(text: string, sessionId = "test-session") {
  return {
    type: "result" as const,
    subtype: "success" as const,
    result: text,
    num_turns: 1,
    total_cost_usd: 0,
    usage: {},
    modelUsage: { "claude-sonnet": { inputTokens: 100, outputTokens: 50 } },
    session_id: sessionId,
  };
}

function errorResult(errors: string[]) {
  return {
    type: "result" as const,
    subtype: "error" as const,
    errors,
    is_error: true,
    usage: {},
    modelUsage: {},
    session_id: "",
  };
}

afterEach(() => {
  claudeResetSDK();
  copilotResetSDK();
});

// ─── Claude Session Lifecycle ───────────────────────────────────

describe("Claude session lifecycle", () => {
  function createClaudeMockSDK(callResults: Array<Array<Record<string, unknown>>>) {
    let callIndex = 0;
    const mockQuery = vi.fn().mockImplementation(() => {
      const msgs = callResults[callIndex] ?? callResults[callResults.length - 1]!;
      callIndex++;
      const gen = asyncIter(msgs);
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

  it("should accept resumeSessionId in backend options", () => {
    const service = createClaudeService({ resumeSessionId: "ses-resume-123" });
    expect(service).toBeDefined();
  });

  it("should restore session ID from resumeSessionId config", async () => {
    const sdk = createClaudeMockSDK([
      [successResult("resumed ok", "ses-resumed")],
    ]);
    const service = createClaudeService({ resumeSessionId: "ses-old-123" });
    const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

    // The first query should use resume with the stored session ID
    await agent.run("hello");

    const queryOpts = sdk.query.mock.calls[0][0].options;
    expect(queryOpts.resume).toBe("ses-old-123");
    expect(queryOpts.persistSession).toBe(true);
  });

  it("should retry with full history on resume failure", async () => {
    const sdk = createClaudeMockSDK([
      // First attempt (resume) fails
      [errorResult(["session expired"])],
      // Retry with full context succeeds
      [successResult("recovered", "ses-new")],
    ]);
    const service = createClaudeService({ resumeSessionId: "ses-old" });
    const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

    const messages: Message[] = [
      { role: "user", content: "first question" },
      { role: "assistant", content: "first answer" },
      { role: "user", content: "second question" },
    ];
    const result = await agent.runWithContext(messages);

    // First call uses resume
    expect(sdk.query.mock.calls[0][0].options.resume).toBe("ses-old");
    // Retry does NOT use resume (cleared)
    expect(sdk.query.mock.calls[1][0].options.resume).toBeUndefined();
    // Retry prompt includes full conversation history
    expect(sdk.query.mock.calls[1][0].prompt).toContain("Conversation history:");
    expect(result.output).toBe("recovered");
    expect(agent.sessionId).toBe("ses-new");
  });

  it("should throw on retry failure (non-recoverable)", async () => {
    createClaudeMockSDK([
      // First attempt (resume) fails
      [errorResult(["session expired"])],
      // Retry also fails
      [errorResult(["fatal error"])],
    ]);
    const service = createClaudeService({ resumeSessionId: "ses-old" });
    const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

    await expect(agent.run("test")).rejects.toThrow("fatal error");
    expect(agent.sessionId).toBeUndefined();
  });

  it("should retry on resume failure in executeStream", async () => {
    // For streaming, resume failure manifests as thrown error from the query iterator
    let callIndex = 0;
    const mockQuery = vi.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // First call (resume) — throw error
        const gen = (async function*() {
          throw new Error("session expired");
        })();
        return Object.assign(gen, {
          close: vi.fn(),
          interrupt: vi.fn().mockResolvedValue(undefined),
          supportedModels: vi.fn().mockResolvedValue([]),
        });
      }
      // Retry succeeds
      const gen = asyncIter([successResult("stream recovered", "ses-stream-new")]);
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

    const service = createClaudeService({ resumeSessionId: "ses-stream-old" });
    const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

    const events: AgentEvent[] = [];
    for await (const event of agent.stream("test")) {
      events.push(event);
    }

    // Should have recovered and produced events
    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);
    expect(agent.sessionId).toBe("ses-stream-new");
  });
});

// ─── Copilot Session Lifecycle ──────────────────────────────────

describe("Copilot session lifecycle", () => {
  function createCopilotMockSDK(opts: {
    resumeSuccess?: boolean;
    resumeSessionId?: string;
  } = {}) {
    const mockSession = {
      sessionId: "ses-copilot-new",
      on: vi.fn().mockReturnValue(() => {}),
      send: vi.fn().mockResolvedValue(undefined),
      sendAndWait: vi.fn().mockResolvedValue({
        type: "assistant.message",
        data: { messageId: "msg-1", content: "ok" },
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    };

    const resumedSession = {
      ...mockSession,
      sessionId: opts.resumeSessionId ?? "ses-copilot-resumed",
    };

    const mockClient = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue([]),
      getState: vi.fn().mockReturnValue("running"),
      createSession: vi.fn().mockResolvedValue(mockSession),
      resumeSession: opts.resumeSuccess !== false
        ? vi.fn().mockResolvedValue(resumedSession)
        : vi.fn().mockRejectedValue(new Error("session not found")),
      listModels: vi.fn().mockResolvedValue([]),
      getAuthStatus: vi.fn().mockResolvedValue({ isAuthenticated: true }),
    };

    // Use function() not arrow — arrow functions can't be called with `new`
    const MockCopilotClient = vi.fn().mockImplementation(function () { return mockClient; });
    const sdk = { CopilotClient: MockCopilotClient };
    copilotInjectSDK(sdk as any);
    return { sdk, mockClient, mockSession, resumedSession };
  }

  it("should accept resumeSessionId in backend options", () => {
    const service = createCopilotService({ resumeSessionId: "ses-resume-123" });
    expect(service).toBeDefined();
  });

  it("should attempt to resume stored session before creating new one", async () => {
    const { mockClient, resumedSession } = createCopilotMockSDK({
      resumeSuccess: true,
      resumeSessionId: "ses-stored",
    });
    const service = createCopilotService({ resumeSessionId: "ses-stored" });
    const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

    await agent.run("test");

    // Should have called resumeSession with stored ID
    expect(mockClient.resumeSession).toHaveBeenCalledWith(
      "ses-stored",
      expect.any(Object),
    );
    // Should NOT have called createSession
    expect(mockClient.createSession).not.toHaveBeenCalled();
    expect(agent.sessionId).toBe("ses-stored");
  });

  it("should fall back to createSession when resume fails", async () => {
    const { mockClient } = createCopilotMockSDK({ resumeSuccess: false });
    const service = createCopilotService({ resumeSessionId: "ses-broken" });
    const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

    await agent.run("test");

    // Should have attempted resume
    expect(mockClient.resumeSession).toHaveBeenCalledWith(
      "ses-broken",
      expect.any(Object),
    );
    // Should have fallen back to create
    expect(mockClient.createSession).toHaveBeenCalled();
    expect(agent.sessionId).toBe("ses-copilot-new");
  });

  it("should only attempt resume once", async () => {
    const { mockClient } = createCopilotMockSDK({ resumeSuccess: false });
    const service = createCopilotService({ resumeSessionId: "ses-once" });
    const agent = service.createAgent(makeConfig({ sessionMode: "persistent" }));

    await agent.run("first");
    await agent.run("second");

    // resumeSession called only once (first call)
    expect(mockClient.resumeSession).toHaveBeenCalledTimes(1);
  });
});

// ─── History Serialization ──────────────────────────────────────

describe("History serialization", () => {
  describe("Claude buildContextualPrompt includes tool metadata", () => {
    function createClaudeMockSDK() {
      const mockQuery = vi.fn().mockImplementation(() => {
        const gen = asyncIter([successResult("ok")]);
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

    it("should include tool calls in contextual prompt", async () => {
      const sdk = createClaudeMockSDK();
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());

      const messages: Message[] = [
        { role: "user", content: "find files" },
        {
          role: "assistant",
          content: "I'll search for files",
          toolCalls: [
            { id: "tc-1", name: "search", args: { query: "*.ts" } },
          ],
        },
        {
          role: "tool",
          toolResults: [
            { toolCallId: "tc-1", name: "search", result: "found 5 files" },
          ],
        },
        { role: "user", content: "now list them" },
      ];

      await agent.runWithContext(messages);

      const prompt = sdk.query.mock.calls[0][0].prompt;
      expect(prompt).toContain("Tool call: search");
      expect(prompt).toContain("*.ts");
      expect(prompt).toContain("Tool results:");
      expect(prompt).toContain("search →");
      expect(prompt).toContain("found 5 files");
    });

    it("should include thinking in contextual prompt", async () => {
      const sdk = createClaudeMockSDK();
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());

      const messages: Message[] = [
        { role: "user", content: "analyze" },
        // Attach thinking via extended message (runtime typing)
        Object.assign(
          { role: "assistant" as const, content: "I analyzed it" },
          { thinking: "Let me think about this..." },
        ),
        { role: "user", content: "what did you find?" },
      ];

      await agent.runWithContext(messages);

      const prompt = sdk.query.mock.calls[0][0].prompt;
      expect(prompt).toContain("[reasoning: Let me think about this...]");
    });

    it("should include error tool results", async () => {
      const sdk = createClaudeMockSDK();
      const service = createClaudeService({});
      const agent = service.createAgent(makeConfig());

      const messages: Message[] = [
        { role: "user", content: "run cmd" },
        {
          role: "tool",
          toolResults: [
            { toolCallId: "tc-1", name: "exec", result: "permission denied", isError: true },
          ],
        },
        { role: "user", content: "try again" },
      ];

      await agent.runWithContext(messages);

      const prompt = sdk.query.mock.calls[0][0].prompt;
      expect(prompt).toContain("[ERROR]");
      expect(prompt).toContain("permission denied");
    });
  });

  describe("Vercel AI messagesToSDK preserves tool metadata", () => {
    // We test messagesToSDK indirectly through the agent — it's internal.
    // Alternatively, we can import and test the Vercel AI backend.
    // Since messagesToSDK is not exported, we test through agent behavior.

    it("should preserve tool calls in assistant messages", async () => {
      // Create a mock for Vercel AI SDK
      const mockGenerateText = vi.fn().mockResolvedValue({
        text: "result",
        toolCalls: [],
        toolResults: [],
        steps: [{
          text: "result",
          toolCalls: [],
          toolResults: [],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: "stop",
        }],
        totalUsage: { inputTokens: 10, outputTokens: 5 },
        finishReason: "stop",
        response: { messages: [] },
      });

      const { _injectSDK, _injectCompat, createVercelAIService } = await import("../../../src/backends/vercel-ai.js");

      _injectSDK({
        generateText: mockGenerateText,
        streamText: vi.fn(),
        generateObject: vi.fn(),
        tool: vi.fn((opts: any) => opts),
        jsonSchema: vi.fn((s: any) => s),
        stepCountIs: vi.fn((n: number) => n),
      } as any);

      _injectCompat({
        createOpenAICompatible: vi.fn().mockReturnValue({
          chatModel: vi.fn().mockReturnValue({}),
          languageModel: vi.fn().mockReturnValue({}),
        }),
      } as any);

      const service = createVercelAIService({ apiKey: "test-key" });
      const agent = service.createAgent(makeConfig());

      const messages: Message[] = [
        { role: "user", content: "test" },
        {
          role: "assistant",
          content: "I used a tool",
          toolCalls: [{ id: "tc-1", name: "search", args: { q: "test" } }],
        },
        {
          role: "tool",
          toolResults: [
            { toolCallId: "tc-1", name: "search", result: "found it", isError: false },
          ],
        },
        { role: "user", content: "thanks" },
      ];

      await agent.runWithContext(messages);

      const sdkMessages = mockGenerateText.mock.calls[0][0].messages;
      // Assistant message should have toolCalls
      const assistantMsg = sdkMessages.find((m: any) => m.role === "assistant");
      expect(assistantMsg.toolCalls).toBeDefined();
      expect(assistantMsg.toolCalls[0].name).toBe("search");
      expect(assistantMsg.toolCalls[0].args).toEqual({ q: "test" });

      // Tool message should have toolResults
      const toolMsg = sdkMessages.find((m: any) => m.role === "tool" && m.toolResults);
      expect(toolMsg.toolResults).toBeDefined();
      expect(toolMsg.toolResults[0].name).toBe("search");
      expect(toolMsg.toolResults[0].result).toBe("found it");

      // Cleanup
      const { _resetSDK } = await import("../../../src/backends/vercel-ai.js");
      _resetSDK();
    });

    it("should include thinking in assistant messages", async () => {
      const mockGenerateText = vi.fn().mockResolvedValue({
        text: "result",
        toolCalls: [],
        toolResults: [],
        steps: [{
          text: "result",
          toolCalls: [],
          toolResults: [],
          usage: { inputTokens: 10, outputTokens: 5 },
          finishReason: "stop",
        }],
        totalUsage: { inputTokens: 10, outputTokens: 5 },
        finishReason: "stop",
        response: { messages: [] },
      });

      const { _injectSDK, _injectCompat, createVercelAIService } = await import("../../../src/backends/vercel-ai.js");

      _injectSDK({
        generateText: mockGenerateText,
        streamText: vi.fn(),
        generateObject: vi.fn(),
        tool: vi.fn((opts: any) => opts),
        jsonSchema: vi.fn((s: any) => s),
        stepCountIs: vi.fn((n: number) => n),
      } as any);

      _injectCompat({
        createOpenAICompatible: vi.fn().mockReturnValue({
          chatModel: vi.fn().mockReturnValue({}),
          languageModel: vi.fn().mockReturnValue({}),
        }),
      } as any);

      const service = createVercelAIService({ apiKey: "test-key" });
      const agent = service.createAgent(makeConfig());

      const messages: Message[] = [
        { role: "user", content: "analyze" },
        Object.assign(
          { role: "assistant" as const, content: "Done analyzing" },
          { thinking: "Let me reason..." },
        ),
        { role: "user", content: "what?" },
      ];

      await agent.runWithContext(messages);

      const sdkMessages = mockGenerateText.mock.calls[0][0].messages;
      const assistantMsg = sdkMessages.find((m: any) => m.role === "assistant");
      expect(assistantMsg.content).toContain("[reasoning: Let me reason...]");

      const { _resetSDK } = await import("../../../src/backends/vercel-ai.js");
      _resetSDK();
    });
  });
});
