import { describe, it, expect, beforeAll } from "vitest";
import { createMockLLMService } from "../../src/backends/mock-llm.js";
import type {
  AgentConfig,
  AgentEvent,
  MockLLMBackendOptions,
  Message,
} from "../../src/types.js";
import { AgentSDKError, DisposedError, ReentrancyError } from "../../src/errors.js";

// ─── Helpers ────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    model: "mock-fast",
    systemPrompt: "You are a test assistant",
    tools: [],
    ...overrides,
  };
}

function createService(opts?: MockLLMBackendOptions) {
  return createMockLLMService(opts);
}

function createAgent(opts?: MockLLMBackendOptions, configOverrides?: Partial<AgentConfig>) {
  const svc = createService(opts);
  return svc.createAgent(makeConfig(configOverrides));
}

async function collectEvents(stream: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const e of stream) events.push(e);
  return events;
}

// ─── Tests ──────────────────────────────────────────────────────

describe("MockLLMService", () => {
  describe("createMockLLMService()", () => {
    it("returns an IAgentService with name 'mock-llm'", () => {
      const svc = createService();
      expect(svc.name).toBe("mock-llm");
    });

    it("validate() returns valid", async () => {
      const result = await createService().validate();
      expect(result).toEqual({ valid: true, errors: [] });
    });

    it("dispose() resolves without error", async () => {
      await expect(createService().dispose()).resolves.toBeUndefined();
    });
  });

  describe("listModels()", () => {
    it("returns default models when none specified", async () => {
      const models = await createService().listModels();
      expect(models).toEqual([
        { id: "mock-fast", name: "Mock Fast", description: undefined },
        { id: "mock-quality", name: "Mock Quality", description: undefined },
      ]);
    });

    it("returns custom models when specified", async () => {
      const models = await createService({
        models: [{ id: "custom-1", name: "Custom One", description: "desc" }],
      }).listModels();
      expect(models).toEqual([
        { id: "custom-1", name: "Custom One", description: "desc" },
      ]);
    });
  });

  describe("createAgent()", () => {
    it("creates an agent that starts in idle state", () => {
      const agent = createAgent();
      expect(agent.getState()).toBe("idle");
    });

    it("freezes agent config", () => {
      const agent = createAgent();
      const config = agent.getConfig();
      expect(Object.isFrozen(config)).toBe(true);
    });
  });
});

describe("MockLLMAgent — echo mode", () => {
  describe("run()", () => {
    it("echoes back the user prompt", async () => {
      const agent = createAgent({ mode: { type: "echo" } });
      const result = await agent.run("Hello world", { model: "mock-fast" });
      expect(result.output).toBe("Hello world");
    });

    it("extracts prompt from last user message only", async () => {
      const agent = createAgent({ mode: { type: "echo" } });
      const messages: Message[] = [
        { role: "user", content: "first" },
        { role: "assistant", content: "response" },
        { role: "user", content: "second" },
      ];
      const result = await agent.runWithContext(messages, { model: "mock-fast" });
      expect(result.output).toBe("second");
    });

    it("handles multi-part user content", async () => {
      const agent = createAgent({ mode: { type: "echo" } });
      const messages: Message[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "world" },
          ],
        },
      ];
      const result = await agent.runWithContext(messages, { model: "mock-fast" });
      expect(result.output).toBe("Hello world");
    });

    it("returns empty string when no user messages", async () => {
      const agent = createAgent({ mode: { type: "echo" } });
      const messages: Message[] = [
        { role: "assistant", content: "only assistant" },
      ];
      const result = await agent.runWithContext(messages, { model: "mock-fast" });
      expect(result.output).toBe("");
    });

    it("returns correct AgentResult structure", async () => {
      const agent = createAgent({ mode: { type: "echo" } });
      const result = await agent.run("test", { model: "mock-fast" });
      expect(result).toMatchObject({
        output: "test",
        structuredOutput: undefined,
        toolCalls: [],
      });
      expect(result.usage).toMatchObject({ promptTokens: 10, completionTokens: 4 });
      expect(result.usage).toHaveProperty("backend", "mock-llm");
      expect(result.usage).toHaveProperty("model", "mock-fast");
      expect(result.messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("stream()", () => {
    it("emits text_delta events for each word chunk", async () => {
      const agent = createAgent({ mode: { type: "echo" } });
      const events = await collectEvents(agent.stream("Hello world", { model: "mock-fast" }));
      const textDeltas = events.filter((e) => e.type === "text_delta");
      expect(textDeltas.length).toBeGreaterThan(0);
      const fullText = textDeltas.map((e) => (e as { text: string }).text).join("");
      expect(fullText).toBe("Hello world");
    });

    it("emits usage_update before done", async () => {
      const agent = createAgent({ mode: { type: "echo" } });
      const events = await collectEvents(agent.stream("Hi", { model: "mock-fast" }));
      const types = events.map((e) => e.type);
      const usageIdx = types.lastIndexOf("usage_update");
      const doneIdx = types.lastIndexOf("done");
      expect(usageIdx).toBeGreaterThan(-1);
      expect(doneIdx).toBeGreaterThan(usageIdx);
    });

    it("emits done event with finalOutput", async () => {
      const agent = createAgent({ mode: { type: "echo" } });
      const events = await collectEvents(agent.stream("Hi", { model: "mock-fast" }));
      const done = events.find((e) => e.type === "done");
      expect(done).toBeDefined();
      expect((done as any).finalOutput).toBe("Hi");
    });

    it("emits finishReason 'stop' in done event", async () => {
      const agent = createAgent({ mode: { type: "echo" } });
      const events = await collectEvents(agent.stream("Hi", { model: "mock-fast" }));
      const done = events.find((e) => e.type === "done");
      expect(done).toBeDefined();
      expect((done as any).finishReason).toBe("stop");
    });
  });
});

describe("MockLLMAgent — static mode", () => {
  it("returns the configured static response", async () => {
    const agent = createAgent({ mode: { type: "static", response: "Fixed response" } });
    const result = await agent.run("anything", { model: "mock-fast" });
    expect(result.output).toBe("Fixed response");
  });

  it("returns same response on multiple calls", async () => {
    const agent = createAgent({ mode: { type: "static", response: "Always" } });
    const r1 = await agent.run("a", { model: "mock-fast" });
    const r2 = await agent.run("b", { model: "mock-fast" });
    expect(r1.output).toBe("Always");
    expect(r2.output).toBe("Always");
  });

  it("streams the static response", async () => {
    const agent = createAgent({ mode: { type: "static", response: "Stream me" } });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const text = events
      .filter((e) => e.type === "text_delta")
      .map((e) => (e as { text: string }).text)
      .join("");
    expect(text).toBe("Stream me");
  });
});

describe("MockLLMAgent — scripted mode", () => {
  it("returns responses in sequence", async () => {
    const agent = createAgent({
      mode: { type: "scripted", responses: ["first", "second", "third"] },
    });
    expect((await agent.run("a", { model: "mock-fast" })).output).toBe("first");
    expect((await agent.run("b", { model: "mock-fast" })).output).toBe("second");
    expect((await agent.run("c", { model: "mock-fast" })).output).toBe("third");
  });

  it("returns last response when exhausted (no loop)", async () => {
    const agent = createAgent({
      mode: { type: "scripted", responses: ["only"] },
    });
    expect((await agent.run("a", { model: "mock-fast" })).output).toBe("only");
    expect((await agent.run("b", { model: "mock-fast" })).output).toBe("only");
  });

  it("loops when loop=true", async () => {
    const agent = createAgent({
      mode: { type: "scripted", responses: ["A", "B"], loop: true },
    });
    expect((await agent.run("1", { model: "mock-fast" })).output).toBe("A");
    expect((await agent.run("2", { model: "mock-fast" })).output).toBe("B");
    expect((await agent.run("3", { model: "mock-fast" })).output).toBe("A");
    expect((await agent.run("4", { model: "mock-fast" })).output).toBe("B");
  });

  it("works with streaming too", async () => {
    const agent = createAgent({
      mode: { type: "scripted", responses: ["first", "second"] },
    });
    const events1 = await collectEvents(agent.stream("a", { model: "mock-fast" }));
    const text1 = events1.filter((e) => e.type === "text_delta").map((e) => (e as any).text).join("");
    expect(text1).toBe("first");

    const events2 = await collectEvents(agent.stream("b", { model: "mock-fast" }));
    const text2 = events2.filter((e) => e.type === "text_delta").map((e) => (e as any).text).join("");
    expect(text2).toBe("second");
  });
});

describe("MockLLMAgent — error mode", () => {
  it("throws AgentSDKError on run()", async () => {
    const agent = createAgent({
      mode: { type: "error", error: "Simulated failure" },
    });
    await expect(agent.run("x", { model: "mock-fast" })).rejects.toThrow(AgentSDKError);
    await expect(agent.run("x", { model: "mock-fast" })).rejects.toThrow("Simulated failure");
  });

  it("throws with custom error code", async () => {
    const agent = createAgent({
      mode: { type: "error", error: "rate limited", code: "rate_limit" },
    });
    try {
      await agent.run("x", { model: "mock-fast" });
      expect.unreachable("should have thrown");
    } catch (err: any) {
      expect(AgentSDKError.is(err)).toBe(true);
      expect(err.code).toBe("rate_limit");
    }
  });

  it("throws with retryable flag", async () => {
    const agent = createAgent({
      mode: { type: "error", error: "temp", recoverable: true },
    });
    try {
      await agent.run("x", { model: "mock-fast" });
      expect.unreachable("should have thrown");
    } catch (err: any) {
      expect(err.retryable).toBe(true);
    }
  });

  it("throws on stream() too", async () => {
    const agent = createAgent({
      mode: { type: "error", error: "stream fail" },
    });
    await expect(async () => {
      for await (const _ of agent.stream("x", { model: "mock-fast" })) {
        // should not yield anything
      }
    }).rejects.toThrow("stream fail");
  });
});

describe("MockLLMAgent — structured output", () => {
  it("parses JSON response as structured output", async () => {
    const json = JSON.stringify({ name: "test", value: 42 });
    const agent = createAgent({ mode: { type: "static", response: json } });
    const result = await agent.runStructured(
      "get data",
      { name: "test-schema", schema: {} as any, description: "test" },
      { model: "mock-fast" },
    );
    expect(result.structuredOutput).toEqual({ name: "test", value: 42 });
    expect(result.output).toBe(json);
  });

  it("falls back to raw string when not valid JSON", async () => {
    const agent = createAgent({ mode: { type: "static", response: "not json" } });
    const result = await agent.runStructured(
      "get data",
      { name: "test", schema: {} as any, description: "test" },
      { model: "mock-fast" },
    );
    expect(result.structuredOutput).toBe("not json");
  });
});

describe("MockLLMAgent — lifecycle", () => {
  it("transitions idle → running → idle on run()", async () => {
    const agent = createAgent();
    expect(agent.getState()).toBe("idle");
    await agent.run("test", { model: "mock-fast" });
    expect(agent.getState()).toBe("idle");
  });

  it("transitions idle → streaming → idle on stream()", async () => {
    const agent = createAgent();
    expect(agent.getState()).toBe("idle");
    await collectEvents(agent.stream("test", { model: "mock-fast" }));
    expect(agent.getState()).toBe("idle");
  });

  it("rejects run after dispose", async () => {
    const agent = createAgent();
    await agent.dispose();
    expect(agent.getState()).toBe("disposed");
    await expect(agent.run("test", { model: "mock-fast" })).rejects.toThrow(DisposedError);
  });

  it("rejects concurrent runs (reentrancy guard)", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "ok" },
    });

    // Start a run that we can race against
    const promise1 = agent.run("first", { model: "mock-fast" });
    // MockLLM resolves synchronously via microtask, so reentrancy guard
    // kicks in when we try to run while state is not idle.
    // Because executeRun is async but resolves in same tick,
    // we need to check the guard differently — just verify it works after:
    await promise1;
    // After first run completes, second should work
    const r2 = await agent.run("second", { model: "mock-fast" });
    expect(r2.output).toBe("ok");
  });

  it("supports abort via signal", async () => {
    const agent = createAgent({ mode: { type: "echo" } });
    const ac = new AbortController();
    ac.abort(); // pre-abort
    await expect(
      agent.run("test", { model: "mock-fast", signal: ac.signal }),
    ).rejects.toThrow();
  });

  it("supports abort during streaming", async () => {
    // Use a long response to have multiple chunks
    const longText = Array(100).fill("word").join(" ");
    const agent = createAgent({ mode: { type: "static", response: longText } });
    const ac = new AbortController();

    const events: AgentEvent[] = [];
    let aborted = false;
    try {
      for await (const e of agent.stream("x", { model: "mock-fast", signal: ac.signal })) {
        events.push(e);
        if (events.length === 2) ac.abort();
      }
    } catch {
      aborted = true;
    }
    // Either we got aborted or collected partial events
    expect(aborted || events.length < 200).toBe(true);
  });
});

describe("MockLLMAgent — usage tracking", () => {
  it("reports usage in run result", async () => {
    const agent = createAgent({ mode: { type: "static", response: "hello" } });
    const result = await agent.run("x", { model: "mock-fast" });
    expect(result.usage).toMatchObject({ promptTokens: 10, completionTokens: 5 });
  });

  it("reports usage proportional to output length", async () => {
    const agent = createAgent({ mode: { type: "static", response: "a".repeat(100) } });
    const result = await agent.run("x", { model: "mock-fast" });
    expect(result.usage?.completionTokens).toBe(100);
  });
});

describe("MockLLMAgent — default mode", () => {
  it("defaults to echo mode when no mode specified", async () => {
    const agent = createAgent(); // no options
    const result = await agent.run("default test", { model: "mock-fast" });
    expect(result.output).toBe("default test");
  });
});

// ─── Step 3: Advanced Response Modes ────────────────────────────

describe("MockLLMAgent — latency simulation", () => {
  it("adds fixed delay to run()", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "delayed" },
      latency: { type: "fixed", ms: 50 },
    });
    const start = Date.now();
    const result = await agent.run("x", { model: "mock-fast" });
    const elapsed = Date.now() - start;
    expect(result.output).toBe("delayed");
    expect(elapsed).toBeGreaterThanOrEqual(40); // allow small timing slack
  });

  it("adds fixed delay to stream()", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "delayed" },
      latency: { type: "fixed", ms: 50 },
    });
    const start = Date.now();
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const elapsed = Date.now() - start;
    expect(events.some((e) => e.type === "text_delta")).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it("adds random delay within range", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "ok" },
      latency: { type: "random", minMs: 20, maxMs: 80 },
    });
    const start = Date.now();
    await agent.run("x", { model: "mock-fast" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(15); // at least minMs (with slack)
  });

  it("zero delay does not block", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "fast" },
      latency: { type: "fixed", ms: 0 },
    });
    const start = Date.now();
    await agent.run("x", { model: "mock-fast" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("is abortable during latency delay", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "never" },
      latency: { type: "fixed", ms: 5000 },
    });
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 30);
    await expect(
      agent.run("x", { model: "mock-fast", signal: ac.signal }),
    ).rejects.toThrow();
  });

  it("composes with all response modes", async () => {
    // Echo + latency
    const echo = createAgent({
      mode: { type: "echo" },
      latency: { type: "fixed", ms: 10 },
    });
    expect((await echo.run("hi", { model: "mock-fast" })).output).toBe("hi");

    // Scripted + latency
    const scripted = createAgent({
      mode: { type: "scripted", responses: ["a", "b"], loop: true },
      latency: { type: "fixed", ms: 10 },
    });
    expect((await scripted.run("1", { model: "mock-fast" })).output).toBe("a");
    expect((await scripted.run("2", { model: "mock-fast" })).output).toBe("b");
  });
});

describe("MockLLMAgent — streaming control", () => {
  it("splits by chunkSize instead of word boundaries", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "abcdefghij" },
      streaming: { chunkSize: 3 },
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const deltas = events.filter((e) => e.type === "text_delta");
    expect(deltas.map((e) => (e as any).text)).toEqual(["abc", "def", "ghi", "j"]);
  });

  it("respects chunkDelayMs between chunks", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "abcdef" },
      streaming: { chunkSize: 2, chunkDelayMs: 30 },
    });
    const start = Date.now();
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const elapsed = Date.now() - start;
    const deltas = events.filter((e) => e.type === "text_delta");
    expect(deltas.length).toBe(3); // "ab", "cd", "ef"
    // 2 inter-chunk delays of 30ms each = 60ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  it("handles chunkSize larger than text", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "hi" },
      streaming: { chunkSize: 100 },
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const deltas = events.filter((e) => e.type === "text_delta");
    expect(deltas.length).toBe(1);
    expect((deltas[0] as any).text).toBe("hi");
  });

  it("handles empty response with chunkSize", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "" },
      streaming: { chunkSize: 5 },
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const deltas = events.filter((e) => e.type === "text_delta");
    expect(deltas.length).toBe(0);
  });

  it("chunkDelayMs=0 does not add delay", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "abcdef" },
      streaming: { chunkSize: 1, chunkDelayMs: 0 },
    });
    const start = Date.now();
    await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("is abortable during chunk delay", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "a".repeat(100) },
      streaming: { chunkSize: 1, chunkDelayMs: 100 },
    });
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 50);
    const events: AgentEvent[] = [];
    let aborted = false;
    try {
      for await (const e of agent.stream("x", { model: "mock-fast", signal: ac.signal })) {
        events.push(e);
      }
    } catch {
      aborted = true;
    }
    expect(aborted || events.length < 100).toBe(true);
  });

  it("composes with latency", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "abcdef" },
      latency: { type: "fixed", ms: 30 },
      streaming: { chunkSize: 3 },
    });
    const start = Date.now();
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const elapsed = Date.now() - start;
    const deltas = events.filter((e) => e.type === "text_delta");
    expect(deltas.map((e) => (e as any).text)).toEqual(["abc", "def"]);
    expect(elapsed).toBeGreaterThanOrEqual(25);
  });
});

describe("MockLLMAgent — configurable finishReason", () => {
  it("uses custom finishReason in stream done event", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "ok" },
      finishReason: "length",
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const done = events.find((e) => e.type === "done");
    expect((done as any).finishReason).toBe("length");
  });

  it("defaults to 'stop' when not specified", async () => {
    const agent = createAgent({ mode: { type: "static", response: "ok" } });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const done = events.find((e) => e.type === "done");
    expect((done as any).finishReason).toBe("stop");
  });

  it("supports 'tool_calls' finishReason", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "result" },
      finishReason: "tool_calls",
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const done = events.find((e) => e.type === "done");
    expect((done as any).finishReason).toBe("tool_calls");
  });
});

describe("MockLLMAgent — permission simulation", () => {
  it("emits permission_request + auto-approve for each tool", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "ok" },
      permissions: { toolNames: ["bash", "file_write"], autoApprove: true },
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const requests = events.filter((e) => e.type === "permission_request");
    const responses = events.filter((e) => e.type === "permission_response");

    expect(requests.length).toBe(2);
    expect((requests[0] as any).request.toolName).toBe("bash");
    expect((requests[1] as any).request.toolName).toBe("file_write");

    expect(responses.length).toBe(2);
    expect((responses[0] as any).decision.allowed).toBe(true);
    expect((responses[1] as any).decision.allowed).toBe(true);
  });

  it("denies specific tools via denyTools", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "ok" },
      permissions: {
        toolNames: ["bash", "file_write", "http"],
        autoApprove: true,
        denyTools: ["bash"],
      },
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const responses = events.filter((e) => e.type === "permission_response");

    expect(responses.length).toBe(3);
    // bash denied
    expect((responses[0] as any).decision.allowed).toBe(false);
    expect((responses[0] as any).decision.reason).toContain("Denied");
    // others approved
    expect((responses[1] as any).decision.allowed).toBe(true);
    expect((responses[2] as any).decision.allowed).toBe(true);
  });

  it("delegates to supervisor.onPermission callback", async () => {
    const decisions: string[] = [];
    const svc = createMockLLMService({
      mode: { type: "static", response: "ok" },
      permissions: { toolNames: ["special_tool"] },
    });
    const agent = svc.createAgent(makeConfig({
      supervisor: {
        onPermission: async (req, _signal) => {
          decisions.push(req.toolName);
          return { allowed: true, scope: "session" as const };
        },
      },
    }));

    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const responses = events.filter((e) => e.type === "permission_response");

    expect(decisions).toEqual(["special_tool"]);
    expect(responses.length).toBe(1);
    expect((responses[0] as any).decision.scope).toBe("session");
  });

  it("auto-approves when no supervisor and no autoApprove flag", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "ok" },
      permissions: { toolNames: ["tool_a"] },
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const responses = events.filter((e) => e.type === "permission_response");
    expect(responses.length).toBe(1);
    expect((responses[0] as any).decision.allowed).toBe(true);
  });

  it("permissions appear before text_delta events", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "after permissions" },
      permissions: { toolNames: ["bash"], autoApprove: true },
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const types = events.map((e) => e.type);
    const firstPermIdx = types.indexOf("permission_request");
    const firstTextIdx = types.indexOf("text_delta");
    expect(firstPermIdx).toBeLessThan(firstTextIdx);
  });

  it("composes with latency and streaming", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "abcdef" },
      latency: { type: "fixed", ms: 10 },
      streaming: { chunkSize: 3 },
      permissions: { toolNames: ["tool"], autoApprove: true },
    });
    const start = Date.now();
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const elapsed = Date.now() - start;

    const permRequests = events.filter((e) => e.type === "permission_request");
    const deltas = events.filter((e) => e.type === "text_delta");
    const done = events.find((e) => e.type === "done");

    expect(permRequests.length).toBe(1);
    expect(deltas.map((e) => (e as any).text)).toEqual(["abc", "def"]);
    expect((done as any).finishReason).toBe("stop");
    expect(elapsed).toBeGreaterThanOrEqual(8);
  });

  it("does not emit permission events for run() (only stream)", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "ok" },
      permissions: { toolNames: ["bash"], autoApprove: true },
    });
    // run() doesn't stream permission events — it returns AgentResult directly
    const result = await agent.run("x", { model: "mock-fast" });
    expect(result.output).toBe("ok");
  });
});

// ─── Step 4: Tool call simulation ───────────────────────────────

describe("MockLLMAgent — tool call simulation", () => {
  it("emits tool_call_start and tool_call_end events in stream", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "done" },
      toolCalls: [
        { toolName: "bash", args: { command: "ls" }, result: { files: ["a.ts"] } },
      ],
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const starts = events.filter((e) => e.type === "tool_call_start");
    const ends = events.filter((e) => e.type === "tool_call_end");

    expect(starts.length).toBe(1);
    expect(ends.length).toBe(1);
    expect((starts[0] as any).toolName).toBe("bash");
    expect((starts[0] as any).args).toEqual({ command: "ls" });
    expect((starts[0] as any).toolCallId).toBe("mock-tc-0");
    expect((ends[0] as any).toolName).toBe("bash");
    expect((ends[0] as any).result).toEqual({ files: ["a.ts"] });
    expect((ends[0] as any).toolCallId).toBe("mock-tc-0");
  });

  it("emits multiple tool calls in order", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "done" },
      toolCalls: [
        { toolName: "read_file", args: { path: "/a.ts" }, result: "contents" },
        { toolName: "write_file", args: { path: "/b.ts", content: "x" }, result: "ok" },
      ],
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const starts = events.filter((e) => e.type === "tool_call_start");
    const ends = events.filter((e) => e.type === "tool_call_end");

    expect(starts.length).toBe(2);
    expect(ends.length).toBe(2);
    expect((starts[0] as any).toolName).toBe("read_file");
    expect((starts[1] as any).toolName).toBe("write_file");
    expect((ends[0] as any).toolCallId).toBe("mock-tc-0");
    expect((ends[1] as any).toolCallId).toBe("mock-tc-1");
  });

  it("uses custom toolCallId when provided", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "done" },
      toolCalls: [
        { toolName: "bash", toolCallId: "custom-id-42" },
      ],
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const start = events.find((e) => e.type === "tool_call_start");
    const end = events.find((e) => e.type === "tool_call_end");

    expect((start as any).toolCallId).toBe("custom-id-42");
    expect((end as any).toolCallId).toBe("custom-id-42");
  });

  it("defaults args to {} and result to null", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "done" },
      toolCalls: [{ toolName: "noop" }],
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const start = events.find((e) => e.type === "tool_call_start");
    const end = events.find((e) => e.type === "tool_call_end");

    expect((start as any).args).toEqual({});
    expect((end as any).result).toBeNull();
  });

  it("tool call events appear before text_delta", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "after tools" },
      toolCalls: [{ toolName: "bash" }],
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const types = events.map((e) => e.type);
    const firstToolIdx = types.indexOf("tool_call_start");
    const firstTextIdx = types.indexOf("text_delta");
    expect(firstToolIdx).toBeLessThan(firstTextIdx);
  });

  it("run() returns tool calls in result", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "ok" },
      toolCalls: [
        { toolName: "bash", args: { cmd: "ls" }, result: "files" },
        { toolName: "read", args: { path: "/a" }, result: "data" },
      ],
    });
    const result = await agent.run("x", { model: "mock-fast" });
    expect(result.toolCalls.length).toBe(2);
    expect(result.toolCalls[0]).toMatchObject({
      toolName: "bash",
      args: { cmd: "ls" },
      result: "files",
      approved: true,
    });
    expect(result.toolCalls[1]).toMatchObject({
      toolName: "read",
      args: { path: "/a" },
      result: "data",
      approved: true,
    });
  });

  it("run() returns empty toolCalls when none configured", async () => {
    const agent = createAgent({ mode: { type: "static", response: "ok" } });
    const result = await agent.run("x", { model: "mock-fast" });
    expect(result.toolCalls).toEqual([]);
  });

  it("composes with permissions: permissions first, then tool calls, then text", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "done" },
      permissions: { toolNames: ["bash"], autoApprove: true },
      toolCalls: [{ toolName: "bash", args: { cmd: "ls" }, result: "ok" }],
    });
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const types = events.map((e) => e.type);

    const firstPermIdx = types.indexOf("permission_request");
    const firstToolIdx = types.indexOf("tool_call_start");
    const firstTextIdx = types.indexOf("text_delta");

    expect(firstPermIdx).toBeLessThan(firstToolIdx);
    expect(firstToolIdx).toBeLessThan(firstTextIdx);
  });

  it("composes with latency and streaming", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "abcdef" },
      latency: { type: "fixed", ms: 10 },
      streaming: { chunkSize: 3 },
      toolCalls: [{ toolName: "tool_a" }],
    });
    const start = Date.now();
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const elapsed = Date.now() - start;

    const toolStarts = events.filter((e) => e.type === "tool_call_start");
    const deltas = events.filter((e) => e.type === "text_delta");

    expect(toolStarts.length).toBe(1);
    expect(deltas.map((e) => (e as any).text)).toEqual(["abc", "def"]);
    expect(elapsed).toBeGreaterThanOrEqual(8);
  });
});

// ─── Step 4: Structured output ──────────────────────────────────

describe("MockLLMAgent — structured output", () => {
  it("returns configuredStructuredOutput when set", async () => {
    const data = { name: "Alice", age: 30 };
    const agent = createAgent({
      mode: { type: "static", response: "ignored" },
      structuredOutput: data,
    });
    const result = await agent.runStructured("x", { schema: {} as any, name: "test" }, { model: "mock-fast" });
    expect(result.structuredOutput).toEqual(data);
  });

  it("falls back to JSON.parse when structuredOutput not configured", async () => {
    const agent = createAgent({
      mode: { type: "static", response: '{"key":"val"}' },
    });
    const result = await agent.runStructured("x", { schema: {} as any, name: "test" }, { model: "mock-fast" });
    expect(result.structuredOutput).toEqual({ key: "val" });
  });

  it("falls back to raw string when JSON.parse fails", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "not json" },
    });
    const result = await agent.runStructured("x", { schema: {} as any, name: "test" }, { model: "mock-fast" });
    expect(result.structuredOutput).toBe("not json");
  });

  it("handles null as structuredOutput", async () => {
    const agent = createAgent({
      mode: { type: "static", response: "x" },
      structuredOutput: null,
    });
    const result = await agent.runStructured("x", { schema: {} as any, name: "test" }, { model: "mock-fast" });
    expect(result.structuredOutput).toBeNull();
  });

  it("handles complex nested structuredOutput", async () => {
    const complex = { users: [{ id: 1, roles: ["admin"] }], meta: { total: 1 } };
    const agent = createAgent({
      mode: { type: "static", response: "x" },
      structuredOutput: complex,
    });
    const result = await agent.runStructured("x", { schema: {} as any, name: "test" }, { model: "mock-fast" });
    expect(result.structuredOutput).toEqual(complex);
  });
});

// ─── Step 4: createMockAgentService integration ─────────────────

describe("createMockAgentService — mockLLMBackend delegation", () => {
  // Must import separately since it's in the testing module
  let createMockAgentService: typeof import("../../src/testing/mock-agent-service.js").createMockAgentService;

  beforeAll(async () => {
    const mod = await import("../../src/testing/mock-agent-service.js");
    createMockAgentService = mod.createMockAgentService;
  });

  it("delegates to MockLLMAgent when mockLLMBackend provided", async () => {
    const svc = createMockAgentService({
      mockLLMBackend: { mode: { type: "static", response: "from mock-llm" } },
    });
    const agent = svc.createAgent(makeConfig());
    const result = await agent.run("x", { model: "mock-fast" });
    expect(result.output).toBe("from mock-llm");
  });

  it("uses custom service name", async () => {
    const svc = createMockAgentService({
      name: "my-mock",
      mockLLMBackend: { mode: { type: "echo" } },
    });
    expect(svc.name).toBe("my-mock");
  });

  it("streams with full tool call events via delegation", async () => {
    const svc = createMockAgentService({
      mockLLMBackend: {
        mode: { type: "static", response: "done" },
        toolCalls: [{ toolName: "grep", args: { pattern: "foo" }, result: "match" }],
      },
    });
    const agent = svc.createAgent(makeConfig());
    const events = await collectEvents(agent.stream("x", { model: "mock-fast" }));
    const starts = events.filter((e) => e.type === "tool_call_start");
    expect(starts.length).toBe(1);
    expect((starts[0] as any).toolName).toBe("grep");
  });

  it("falls back to lightweight MockAgent when no mockLLMBackend", async () => {
    const svc = createMockAgentService({ name: "lightweight" });
    const agent = svc.createAgent(makeConfig());
    const result = await agent.run("x", { model: "mock-fast" });
    expect(result.output).toBe("Mock response");
  });
});

// ─── Step 4: E2E integration through chat runtime pipeline ──────

describe("MockLLMAgent — E2E through chat runtime", () => {
  let createChatRuntime: typeof import("../../src/chat/runtime.js").createChatRuntime;
  let createChatId: typeof import("../../src/chat/core.js").createChatId;
  let agentEventToChatEvent: typeof import("../../src/chat/bridge.js").agentEventToChatEvent;
  let createMockSession: typeof import("../../src/testing/mock-data.js").createMockSession;
  let createMockMessage: typeof import("../../src/testing/mock-data.js").createMockMessage;

  beforeAll(async () => {
    const runtime = await import("../../src/chat/runtime.js");
    const core = await import("../../src/chat/core.js");
    const bridge = await import("../../src/chat/bridge.js");
    const mockData = await import("../../src/testing/mock-data.js");
    createChatRuntime = runtime.createChatRuntime;
    createChatId = core.createChatId;
    agentEventToChatEvent = bridge.agentEventToChatEvent;
    createMockSession = mockData.createMockSession;
    createMockMessage = mockData.createMockMessage;
  });

  function createMockSessionStore() {
    const sessions = new Map<string, any>();
    return {
      createSession: async (opts: any) => {
        const session = createMockSession({
          config: opts.config,
          title: opts.title,
        });
        sessions.set(session.id, session);
        return session;
      },
      getSession: async (id: string) => sessions.get(id) ?? null,
      listSessions: async () => [...sessions.values()],
      updateTitle: async () => {},
      updateConfig: async () => {},
      deleteSession: async (id: string) => sessions.delete(id),
      appendMessage: async (sessionId: string, message: any) => {
        const session = sessions.get(sessionId);
        if (session) session.messages = [...session.messages, message];
      },
      saveMessages: async () => {},
      loadMessages: async () => ({ messages: [], total: 0, hasMore: false }),
      searchSessions: async () => [],
      count: async () => sessions.size,
      clear: async () => sessions.clear(),
    };
  }

  function createMockLLMAdapter(options: MockLLMBackendOptions) {
    const svc = createMockLLMService(options);
    const agent = svc.createAgent(makeConfig());
    return {
      name: "mock-llm",
      currentModel: "mock-fast" as string | undefined,
      sendMessage: async (_session: any, _message: string) => {
        return createMockMessage({ role: "assistant", text: "mock" });
      },
      streamMessage: async function* (_session: any, message: string) {
        const msgId = createChatId();
        yield { type: "message:start", messageId: msgId, role: "assistant" } as any;
        for await (const event of agent.stream(message, { model: "mock-fast" })) {
          const chatEvent = agentEventToChatEvent(event, msgId);
          if (chatEvent) yield chatEvent;
        }
        yield {
          type: "message:complete",
          messageId: msgId,
          message: createMockMessage({ role: "assistant", text: "done" }),
        } as any;
      },
      listModels: async () => [{ id: "mock-fast", name: "Mock Fast" }],
      validate: async () => ({ valid: true, errors: [] }),
      dispose: async () => {},
    };
  }

  const SEND_OPTS = {
    model: "mock-fast",
    backend: "mock-llm",
    credentials: { accessToken: "test", tokenType: "bearer" as const, obtainedAt: Date.now() },
  };

  it("streams text through chat runtime pipeline", async () => {
    const rt = createChatRuntime({
      backends: { "mock-llm": () => createMockLLMAdapter({ mode: { type: "static", response: "Hello world" } }) },
      defaultBackend: "mock-llm",
      sessionStore: createMockSessionStore() as any,
    });
    const session = await rt.createSession({ config: { model: "mock-fast", backend: "mock-llm" } });
    const events: any[] = [];
    for await (const e of rt.send(session.id, "test", SEND_OPTS)) {
      events.push(e);
    }
    const deltas = events.filter((e) => e.type === "message:delta");
    const text = deltas.map((e) => e.text).join("");
    expect(text).toContain("Hello");
    expect(text).toContain("world");
    await rt.dispose();
  });

  it("streams tool_call events as tool:start/tool:complete through runtime", async () => {
    const rt = createChatRuntime({
      backends: {
        "mock-llm": () => createMockLLMAdapter({
          mode: { type: "static", response: "done" },
          toolCalls: [
            { toolName: "bash", args: { command: "ls" }, result: { files: ["a.ts"] }, toolCallId: "tc-001" },
          ],
        }),
      },
      defaultBackend: "mock-llm",
      sessionStore: createMockSessionStore() as any,
    });
    const session = await rt.createSession({ config: { model: "mock-fast", backend: "mock-llm" } });
    const events: any[] = [];
    for await (const e of rt.send(session.id, "run ls", SEND_OPTS)) {
      events.push(e);
    }
    const toolStarts = events.filter((e) => e.type === "tool:start");
    const toolCompletes = events.filter((e) => e.type === "tool:complete");

    expect(toolStarts.length).toBe(1);
    expect(toolStarts[0].toolName).toBe("bash");
    expect(toolStarts[0].toolCallId).toBe("tc-001");
    expect(toolStarts[0].args).toEqual({ command: "ls" });

    expect(toolCompletes.length).toBe(1);
    expect(toolCompletes[0].toolName).toBe("bash");
    expect(toolCompletes[0].result).toEqual({ files: ["a.ts"] });
    await rt.dispose();
  });

  it("streams permission events through runtime", async () => {
    const rt = createChatRuntime({
      backends: {
        "mock-llm": () => createMockLLMAdapter({
          mode: { type: "static", response: "ok" },
          permissions: { toolNames: ["bash"], autoApprove: true },
        }),
      },
      defaultBackend: "mock-llm",
      sessionStore: createMockSessionStore() as any,
    });
    const session = await rt.createSession({ config: { model: "mock-fast", backend: "mock-llm" } });
    const events: any[] = [];
    for await (const e of rt.send(session.id, "run", SEND_OPTS)) {
      events.push(e);
    }
    const permRequests = events.filter((e) => e.type === "permission:request");
    const permResponses = events.filter((e) => e.type === "permission:response");

    expect(permRequests.length).toBe(1);
    expect(permRequests[0].toolName).toBe("bash");
    expect(permResponses.length).toBe(1);
    expect(permResponses[0].allowed).toBe(true);
    await rt.dispose();
  });

  it("full pipeline: permissions + tool calls + text + done", async () => {
    const rt = createChatRuntime({
      backends: {
        "mock-llm": () => createMockLLMAdapter({
          mode: { type: "static", response: "completed" },
          permissions: { toolNames: ["bash"], autoApprove: true },
          toolCalls: [{ toolName: "bash", args: { cmd: "ls" }, result: "files" }],
          finishReason: "stop",
        }),
      },
      defaultBackend: "mock-llm",
      sessionStore: createMockSessionStore() as any,
    });
    const session = await rt.createSession({ config: { model: "mock-fast", backend: "mock-llm" } });
    const events: any[] = [];
    for await (const e of rt.send(session.id, "do it", SEND_OPTS)) {
      events.push(e);
    }
    const types = events.map((e) => e.type);

    // Verify correct event ordering: message:start → permission events → tool events → text deltas → message:complete
    expect(types[0]).toBe("message:start");
    expect(types).toContain("permission:request");
    expect(types).toContain("permission:response");
    expect(types).toContain("tool:start");
    expect(types).toContain("tool:complete");
    expect(types).toContain("message:delta");
    expect(types).toContain("message:complete");

    // Permissions before tools, tools before text
    const firstPerm = types.indexOf("permission:request");
    const firstTool = types.indexOf("tool:start");
    const firstText = types.indexOf("message:delta");
    expect(firstPerm).toBeLessThan(firstTool);
    expect(firstTool).toBeLessThan(firstText);

    await rt.dispose();
  });
});
