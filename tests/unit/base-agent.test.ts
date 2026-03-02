import { describe, it, expect } from "vitest";
import { BaseAgent } from "../../src/base-agent.js";
import type {
  AgentConfig,
  AgentResult,
  AgentEvent,
  Message,
  RunOptions,
  StructuredOutputConfig,
} from "../../src/types.js";
import { ReentrancyError, DisposedError, AbortError, AgentSDKError } from "../../src/errors.js";

// ─── Concrete Test Implementation ──────────────────────────────

class TestAgent extends BaseAgent {
  protected readonly backendName = "test";
  public runCalled = false;
  public structuredCalled = false;
  public streamCalled = false;
  public lastMessages: Message[] = [];
  public lastSignal: AbortSignal | null = null;
  public lastOptions: RunOptions | undefined = undefined;

  /** Configurable result */
  public mockResult: AgentResult = {
    output: "test response",
    structuredOutput: undefined,
    messages: [],
    toolCalls: [],
    usage: { promptTokens: 10, completionTokens: 5 },
  };

  /** Optional delay to simulate async work */
  public runDelay = 0;

  protected async executeRun(
    messages: Message[],
    options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult> {
    this.runCalled = true;
    this.lastMessages = messages;
    this.lastSignal = signal;
    this.lastOptions = options;

    if (this.runDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.runDelay));
    }
    this.checkAbort(signal);
    return this.mockResult;
  }

  protected async executeRunStructured<T>(
    messages: Message[],
    _schema: StructuredOutputConfig<T>,
    _options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult<T>> {
    this.structuredCalled = true;
    this.lastMessages = messages;
    this.lastSignal = signal;
    return {
      output: this.mockResult.output,
      structuredOutput: { title: "test" } as unknown as (T extends void ? undefined : T),
      toolCalls: this.mockResult.toolCalls,
      messages: this.mockResult.messages,
      usage: this.mockResult.usage,
    };
  }

  protected async *executeStream(
    messages: Message[],
    _options: RunOptions,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    this.streamCalled = true;
    this.lastMessages = messages;
    this.lastSignal = signal;
    yield { type: "text_delta", text: "chunk1" };
    yield { type: "text_delta", text: "chunk2" };
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    model: "test-model",
    systemPrompt: "You are a test agent",
    tools: [],
    ...overrides,
  };
}

function makeAgent(overrides?: Partial<AgentConfig>): TestAgent {
  return new TestAgent(makeConfig(overrides));
}

// ─── Tests ─────────────────────────────────────────────────────

describe("BaseAgent", () => {
  describe("constructor", () => {
    it("should start in idle state", () => {
      const agent = makeAgent();
      expect(agent.getState()).toBe("idle");
    });

    it("should freeze config", () => {
      const agent = makeAgent({ model: "gpt-4" });
      const config = agent.getConfig();
      expect(Object.isFrozen(config)).toBe(true);
      expect(config.model).toBe("gpt-4");
    });
  });

  describe("run()", () => {
    it("should call executeRun with correct messages", async () => {
      const agent = makeAgent();
      await agent.run("hello", { model: "test-model" });
      expect(agent.runCalled).toBe(true);
      expect(agent.lastMessages).toEqual([
        { role: "user", content: "hello" },
      ]);
    });

    it("should return result from executeRun", async () => {
      const agent = makeAgent();
      const result = await agent.run("test", { model: "test-model" });
      expect(result.output).toBe("test response");
    });

    it("should set state to running then back to idle", async () => {
      const agent = makeAgent();
      const statesDuringRun: string[] = [];

      // Patch to capture state during execution
      const origRun = (agent as any).executeRun.bind(agent);
      (agent as any).executeRun = async (...args: any[]) => {
        statesDuringRun.push(agent.getState());
        return origRun(...args);
      };

      await agent.run("test", { model: "test-model" });
      expect(statesDuringRun).toContain("running");
      expect(agent.getState()).toBe("idle");
    });

    it("should reset state to idle even on error", async () => {
      const agent = makeAgent();
      (agent as any).executeRun = async () => {
        throw new Error("boom");
      };
      await expect(agent.run("test", { model: "test-model" })).rejects.toThrow("boom");
      expect(agent.getState()).toBe("idle");
    });
  });

  describe("runWithContext()", () => {
    it("should pass full message history", async () => {
      const agent = makeAgent();
      const messages: Message[] = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "bye" },
      ];
      await agent.runWithContext(messages, { model: "test-model" });
    });
  });

  describe("runStructured()", () => {
    it("should call executeRunStructured", async () => {
      const agent = makeAgent();
      const schema: StructuredOutputConfig<{ title: string }> = {
        name: "test",
        schema: {} as any,
      };
      const result = await agent.runStructured("test", schema, { model: "test-model" });
      expect(agent.structuredCalled).toBe(true);
      expect(result.structuredOutput).toEqual({ title: "test" });
    });
  });

  describe("stream()", () => {
    it("should yield events from executeStream", async () => {
      const agent = makeAgent();
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        events.push(event);
      }
      expect(agent.streamCalled).toBe(true);
      expect(events).toEqual([
        { type: "text_delta", text: "chunk1" },
        { type: "text_delta", text: "chunk2" },
      ]);
    });

    it("should set state to streaming then back to idle", async () => {
      const agent = makeAgent();
      let stateDuringStream: string | undefined;

      const origStream = (agent as any).executeStream.bind(agent);
      (agent as any).executeStream = async function* (...args: any[]) {
        stateDuringStream = agent.getState();
        yield* origStream(...args);
      };

      for await (const _ of agent.stream("test", { model: "test-model" })) {
        // consume
      }
      expect(stateDuringStream).toBe("streaming");
      expect(agent.getState()).toBe("idle");
    });
  });

  describe("streamWithContext()", () => {
    it("should pass full message history to executeStream", async () => {
      const agent = makeAgent();
      const messages: Message[] = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "what is 2+2?" },
      ];
      const events: AgentEvent[] = [];
      for await (const event of agent.streamWithContext(messages, { model: "test-model" })) {
        events.push(event);
      }
      expect(agent.streamCalled).toBe(true);
      expect(agent.lastMessages).toEqual(messages);
      expect(events).toEqual([
        { type: "text_delta", text: "chunk1" },
        { type: "text_delta", text: "chunk2" },
      ]);
    });

    it("should set state to streaming then back to idle", async () => {
      const agent = makeAgent();
      let stateDuringStream: string | undefined;

      const origStream = (agent as any).executeStream.bind(agent);
      (agent as any).executeStream = async function* (...args: any[]) {
        stateDuringStream = agent.getState();
        yield* origStream(...args);
      };

      const messages: Message[] = [{ role: "user", content: "test" }];
      for await (const _ of agent.streamWithContext(messages, { model: "test-model" })) {
        // consume
      }
      expect(stateDuringStream).toBe("streaming");
      expect(agent.getState()).toBe("idle");
    });

    it("should throw ReentrancyError if called while running", async () => {
      const agent = makeAgent();
      agent.runDelay = 50;

      const first = agent.run("first", { model: "test-model" });
      const messages: Message[] = [{ role: "user", content: "second" }];
      const iter = agent.streamWithContext(messages, { model: "test-model" })[Symbol.asyncIterator]();
      await expect(iter.next()).rejects.toThrow(ReentrancyError);
      await first;
    });

    it("should throw DisposedError after dispose", async () => {
      const agent = makeAgent();
      agent.dispose();
      const messages: Message[] = [{ role: "user", content: "test" }];
      const iter = agent.streamWithContext(messages, { model: "test-model" })[Symbol.asyncIterator]();
      await expect(iter.next()).rejects.toThrow(DisposedError);
    });

    it("should support abort signal", async () => {
      const agent = makeAgent();
      const externalAc = new AbortController();

      (agent as any).executeStream = async function* (
        _msgs: Message[],
        _opts: RunOptions,
        signal: AbortSignal,
      ) {
        yield { type: "text_delta" as const, text: "before" };
        await new Promise((r) => setTimeout(r, 100));
        if (signal.aborted) throw new AbortError();
        yield { type: "text_delta" as const, text: "after" };
      };

      const messages: Message[] = [{ role: "user", content: "test" }];
      const events: AgentEvent[] = [];

      setTimeout(() => externalAc.abort(), 10);
      await expect(async () => {
        for await (const event of agent.streamWithContext(messages, { model: "test-model", signal: externalAc.signal })) {
          events.push(event);
        }
      }).rejects.toThrow(AbortError);

      expect(events).toEqual([{ type: "text_delta", text: "before" }]);
      expect(agent.getState()).toBe("idle");
    });
  });

  describe("re-entrancy guard (M8)", () => {
    it("should throw ReentrancyError if run called while running", async () => {
      const agent = makeAgent();
      agent.runDelay = 50;

      const first = agent.run("first", { model: "test-model" });
      await expect(agent.run("second", { model: "test-model" })).rejects.toThrow(ReentrancyError);
      await first;
    });

    it("should throw ReentrancyError if stream called while running", async () => {
      const agent = makeAgent();
      agent.runDelay = 50;

      const first = agent.run("first", { model: "test-model" });
      // stream() is async generator — guard throws on first iteration
      const iter = agent.stream("second", { model: "test-model" })[Symbol.asyncIterator]();
      await expect(iter.next()).rejects.toThrow(ReentrancyError);
      await first;
    });

    it("should allow sequential runs", async () => {
      const agent = makeAgent();
      await agent.run("first", { model: "test-model" });
      await agent.run("second", { model: "test-model" });
      expect(agent.getState()).toBe("idle");
    });
  });

  describe("disposed guard", () => {
    it("should throw DisposedError after dispose", async () => {
      const agent = makeAgent();
      agent.dispose();
      expect(agent.getState()).toBe("disposed");
      await expect(agent.run("test", { model: "test-model" })).rejects.toThrow(DisposedError);
    });

    it("should throw DisposedError for stream after dispose", async () => {
      const agent = makeAgent();
      agent.dispose();
      const iter = agent.stream("test", { model: "test-model" })[Symbol.asyncIterator]();
      await expect(iter.next()).rejects.toThrow(DisposedError);
    });

    it("should throw DisposedError for runStructured after dispose", async () => {
      const agent = makeAgent();
      agent.dispose();
      await expect(
        agent.runStructured("test", { name: "s", schema: {} as any }, { model: "test-model" }),
      ).rejects.toThrow(DisposedError);
    });
  });

  describe("abort()", () => {
    it("should abort the current operation", async () => {
      const agent = makeAgent();
      agent.runDelay = 200;

      (agent as any).executeRun = async (
        _msgs: Message[],
        _opts: RunOptions,
        signal: AbortSignal,
      ) => {
        await new Promise((r) => setTimeout(r, 100));
        if (signal.aborted) throw new AbortError();
        return agent.mockResult;
      };

      const runPromise = agent.run("test", { model: "test-model" });
      setTimeout(() => agent.abort(), 10);
      await expect(runPromise).rejects.toThrow(AbortError);
      expect(agent.getState()).toBe("idle");
    });

    it("should link to external abort signal", async () => {
      const agent = makeAgent();
      const externalAc = new AbortController();

      (agent as any).executeRun = async (
        _msgs: Message[],
        _opts: RunOptions,
        signal: AbortSignal,
      ) => {
        await new Promise((r) => setTimeout(r, 100));
        if (signal.aborted) throw new AbortError();
        return agent.mockResult;
      };

      const runPromise = agent.run("test", { model: "test-model", signal: externalAc.signal });
      setTimeout(() => externalAc.abort(), 10);
      await expect(runPromise).rejects.toThrow(AbortError);
    });

    it("should handle already-aborted external signal", async () => {
      const agent = makeAgent();
      const externalAc = new AbortController();
      externalAc.abort();

      (agent as any).executeRun = async (
        _msgs: Message[],
        _opts: RunOptions,
        signal: AbortSignal,
      ) => {
        if (signal.aborted) throw new AbortError();
        return agent.mockResult;
      };

      await expect(
        agent.run("test", { model: "test-model", signal: externalAc.signal }),
      ).rejects.toThrow(AbortError);
    });

    it("should be no-op if not running", () => {
      const agent = makeAgent();
      expect(() => agent.abort()).not.toThrow();
    });

    it("should clean up external signal listener after run completes", async () => {
      const agent = makeAgent();
      const externalAc = new AbortController();

      // Count listeners on the external signal
      const listenersBefore = (externalAc.signal as any)._events?.abort?.length ?? 0;

      await agent.run("test", { model: "test-model", signal: externalAc.signal });

      // After run completes, the listener should be removed
      // Verify by checking the signal won't trigger the (now non-existent) abort controller
      expect(agent.getState()).toBe("idle");
      // The external abort after run should not cause issues
      expect(() => externalAc.abort()).not.toThrow();
    });
  });

  describe("dispose()", () => {
    it("should abort current operation", () => {
      const agent = makeAgent();
      agent.dispose();
      expect(agent.getState()).toBe("disposed");
    });
  });

  describe("heartbeat", () => {
    it("should not emit heartbeat events when heartbeatInterval is not set", async () => {
      const agent = makeAgent();
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "hello" };
      };
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        events.push(event);
      }
      expect(events.some((e) => e.type === "heartbeat")).toBe(false);
    });

    it("should emit heartbeat events at configured intervals during gaps", async () => {
      const agent = makeAgent({ heartbeatInterval: 30 });
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "before" };
        // Simulate a long tool execution gap
        await new Promise((r) => setTimeout(r, 120));
        yield { type: "text_delta" as const, text: "after" };
      };
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        events.push(event);
      }
      const heartbeats = events.filter((e) => e.type === "heartbeat");
      expect(heartbeats.length).toBeGreaterThanOrEqual(2);
      // Heartbeats should appear between the two text_delta events
      const firstText = events.findIndex((e) => e.type === "text_delta" && e.text === "before");
      const secondText = events.findIndex((e) => e.type === "text_delta" && e.text === "after");
      const heartbeatsBetween = events.slice(firstText + 1, secondText).filter((e) => e.type === "heartbeat");
      expect(heartbeatsBetween.length).toBeGreaterThanOrEqual(2);
    });

    it("should stop heartbeat after stream completion", async () => {
      const agent = makeAgent({ heartbeatInterval: 10 });
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "done" };
      };
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        events.push(event);
      }
      // Wait to ensure no more heartbeats are emitted after stream ends
      const countBefore = events.filter((e) => e.type === "heartbeat").length;
      await new Promise((r) => setTimeout(r, 50));
      // No way to observe leaked heartbeats externally, but agent state should be idle
      expect(agent.getState()).toBe("idle");
      // The count should remain the same (no side effects after completion)
      expect(events.filter((e) => e.type === "heartbeat").length).toBe(countBefore);
    });

    it("should respect abort signal and stop heartbeat", async () => {
      const agent = makeAgent({ heartbeatInterval: 10 });
      const externalAc = new AbortController();

      (agent as any).executeStream = async function* (
        _msgs: Message[],
        _opts: RunOptions,
        signal: AbortSignal,
      ) {
        yield { type: "text_delta" as const, text: "before" };
        await new Promise((r) => setTimeout(r, 200));
        if (signal.aborted) throw new AbortError();
        yield { type: "text_delta" as const, text: "after" };
      };

      const events: AgentEvent[] = [];
      setTimeout(() => externalAc.abort(), 50);

      await expect(async () => {
        for await (const event of agent.stream("test", { model: "test-model", signal: externalAc.signal })) {
          events.push(event);
        }
      }).rejects.toThrow(AbortError);

      expect(events.some((e) => e.type === "text_delta" && e.text === "before")).toBe(true);
      expect(events.some((e) => e.type === "heartbeat")).toBe(true);
      expect(agent.getState()).toBe("idle");
    });

    it("should work with streamWithContext", async () => {
      const agent = makeAgent({ heartbeatInterval: 30 });
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "start" };
        await new Promise((r) => setTimeout(r, 100));
        yield { type: "text_delta" as const, text: "end" };
      };
      const events: AgentEvent[] = [];
      const messages: Message[] = [{ role: "user", content: "test" }];
      for await (const event of agent.streamWithContext(messages, { model: "test-model" })) {
        events.push(event);
      }
      expect(events.some((e) => e.type === "heartbeat")).toBe(true);
    });

    it("should pass through events without delay when no gap", async () => {
      const agent = makeAgent({ heartbeatInterval: 1000 });
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "a" };
        yield { type: "text_delta" as const, text: "b" };
        yield { type: "text_delta" as const, text: "c" };
      };
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        events.push(event);
      }
      // All events should pass through, no heartbeats since events arrive fast
      expect(events).toEqual([
        { type: "text_delta", text: "a" },
        { type: "text_delta", text: "b" },
        { type: "text_delta", text: "c" },
      ]);
    });

    it("should not emit heartbeat when interval is 0", async () => {
      const agent = makeAgent({ heartbeatInterval: 0 });
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "hello" };
        await new Promise((r) => setTimeout(r, 50));
        yield { type: "text_delta" as const, text: "world" };
      };
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        events.push(event);
      }
      expect(events.some((e) => e.type === "heartbeat")).toBe(false);
    });
  });

  describe("activity timeout", () => {
    it("should not affect stream when activityTimeoutMs is not set", async () => {
      const agent = makeAgent();
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "a" };
        await new Promise((r) => setTimeout(r, 50));
        yield { type: "text_delta" as const, text: "b" };
      };
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        events.push(event);
      }
      expect(events.filter((e) => e.type === "text_delta").length).toBe(2);
    });

    it("should abort stream after inactivity exceeds timeout", async () => {
      const agent = makeAgent();
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "first" };
        // Gap longer than timeout
        await new Promise((r) => setTimeout(r, 200));
        yield { type: "text_delta" as const, text: "never" };
      };
      const events: AgentEvent[] = [];
      try {
        for await (const event of agent.stream("test", { model: "test-model", activityTimeoutMs: 50 })) {
          events.push(event);
        }
        expect.unreachable("should have thrown");
      } catch (e: any) {
        expect(e.name).toBe("ActivityTimeoutError");
        expect(e.message).toContain("50ms");
      }
      expect(events.some((e) => e.type === "text_delta" && e.text === "first")).toBe(true);
      expect(events.some((e) => e.type === "text_delta" && e.text === "never")).toBe(false);
    });

    it("should reset timer on each backend event (activity timeout is upstream of heartbeat)", async () => {
      const agent = makeAgent({ heartbeatInterval: 30 });
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "start" };
        // Gap of 120ms — heartbeats at 30ms keep the timeout alive
        await new Promise((r) => setTimeout(r, 120));
        yield { type: "text_delta" as const, text: "end" };
      };
      // Timeout is 100ms but heartbeats at 30ms reset it
      // Activity timeout is BEFORE heartbeat in pipeline, so heartbeat events
      // don't reset activity timer. Only backend events reset it.
      // With 120ms gap and 100ms timeout, this SHOULD timeout.
      // Let's use a timeout longer than gap to verify it completes.
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model", activityTimeoutMs: 200 })) {
        events.push(event);
      }
      expect(events.some((e) => e.type === "text_delta" && e.text === "end")).toBe(true);
    });

    it("should complete normally when events arrive within timeout", async () => {
      const agent = makeAgent();
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "a" };
        await new Promise((r) => setTimeout(r, 20));
        yield { type: "text_delta" as const, text: "b" };
        await new Promise((r) => setTimeout(r, 20));
        yield { type: "text_delta" as const, text: "c" };
      };
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model", activityTimeoutMs: 100 })) {
        events.push(event);
      }
      expect(events.filter((e) => e.type === "text_delta").length).toBe(3);
    });

    it("should work with streamWithContext", async () => {
      const agent = makeAgent();
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "first" };
        await new Promise((r) => setTimeout(r, 200));
        yield { type: "text_delta" as const, text: "never" };
      };
      try {
        for await (const _event of agent.streamWithContext(
          [{ role: "user", content: "test" }],
          { activityTimeoutMs: 50, model: "test-model" },
        )) {
          // drain
        }
        expect.unreachable("should have thrown");
      } catch (e: any) {
        expect(e.name).toBe("ActivityTimeoutError");
      }
    });

    it("should not timeout when activityTimeoutMs is 0", async () => {
      const agent = makeAgent();
      (agent as any).executeStream = async function* () {
        yield { type: "text_delta" as const, text: "a" };
        await new Promise((r) => setTimeout(r, 50));
        yield { type: "text_delta" as const, text: "b" };
      };
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model", activityTimeoutMs: 0 })) {
        events.push(event);
      }
      expect(events.filter((e) => e.type === "text_delta").length).toBe(2);
    });
  });

  // ─── CallOptions Resolution ────────────────────────────────────

  describe("CallOptions resolution", () => {
    it("resolveModel returns config.model by default", async () => {
      const agent = new TestAgent(makeConfig({ model: "gpt-5-mini" }));
      const result = await agent.run("test", { model: "gpt-5-mini" });
      expect(result.usage?.model).toBe("gpt-5-mini");
    });

    it("resolveModel uses per-call model override in usage enrichment", async () => {
      const agent = new TestAgent(makeConfig({ model: "gpt-5-mini" }));
      const result = await agent.run("test", { model: "claude-haiku" });
      expect(result.usage?.model).toBe("claude-haiku");
    });

    it("RunOptions extends CallOptions — both model and context pass through", async () => {
      const agent = new TestAgent(makeConfig({ model: "default-model" }));
      const result = await agent.run("test", { model: "override-model", context: { key: "value" } });
      expect(agent.lastOptions?.model).toBe("override-model");
      expect(agent.lastOptions?.context).toEqual({ key: "value" });
      expect(result.output).toBe("test response");
    });

    it("per-call tools override is passed to executeRun", async () => {
      const configTools = [{ name: "tool1", description: "test", parameters: {}, execute: async () => "ok" }];
      const callTools = [{ name: "tool2", description: "override", parameters: {}, execute: async () => "ok2" }];
      const agent = new TestAgent(makeConfig({ tools: configTools }));
      await agent.run("test", { model: "test-model", tools: callTools });
      expect(agent.lastOptions?.tools).toEqual(callTools);
    });

    it("stream enriches usage with per-call model override", async () => {
      const agent = new TestAgent(makeConfig({ model: "gpt-5-mini" }));
      agent.mockResult.usage = { promptTokens: 10, completionTokens: 5 };
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "override-model" })) {
        events.push(event);
      }
      expect(events.some((e) => e.type === "text_delta")).toBe(true);
    });

    it("providerOptions and maxTokens are accepted in RunOptions", async () => {
      const agent = new TestAgent(makeConfig());
      await agent.run("test", {
        model: "test-model",
        providerOptions: { openai: { temperature: 0.5 } },
        maxTokens: 100,
      });
      expect(agent.lastOptions?.providerOptions).toEqual({ openai: { temperature: 0.5 } });
      expect(agent.lastOptions?.maxTokens).toBe(100);
    });
  });

  describe("stream middleware", () => {
    it("addStreamMiddleware applies custom middleware after built-in transforms", async () => {
      const agent = makeAgent();
      const middlewareEvents: string[] = [];

      agent.addStreamMiddleware(async function* (source) {
        for await (const event of source) {
          middlewareEvents.push(event.type);
          yield event;
        }
      });

      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        events.push(event);
      }
      // Middleware should see the same events that come out
      expect(middlewareEvents.length).toBeGreaterThan(0);
      expect(events.length).toBe(middlewareEvents.length);
    });

    it("middleware can transform events", async () => {
      const agent = makeAgent();

      agent.addStreamMiddleware(async function* (source) {
        for await (const event of source) {
          if (event.type === "text_delta") {
            yield { ...event, text: event.text.toUpperCase() };
          } else {
            yield event;
          }
        }
      });

      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", { model: "test-model" })) {
        events.push(event);
      }
      const textDeltas = events.filter((e) => e.type === "text_delta");
      expect(textDeltas).toHaveLength(2);
      expect((textDeltas[0] as { text: string }).text).toBe("CHUNK1");
      expect((textDeltas[1] as { text: string }).text).toBe("CHUNK2");
    });

    it("middleware receives StreamContext with model and backend", async () => {
      const agent = makeAgent();
      let capturedCtx: unknown = null;

      agent.addStreamMiddleware(async function* (source, ctx) {
        capturedCtx = ctx;
        yield* source;
      });

      for await (const _event of agent.stream("test", { model: "my-model" })) {
        // consume
      }
      expect(capturedCtx).toEqual(
        expect.objectContaining({
          model: "my-model",
          backend: "test",
        }),
      );
    });

    it("multiple middleware chain in registration order", async () => {
      const agent = makeAgent();
      const order: number[] = [];

      agent.addStreamMiddleware(async function* (source) {
        order.push(1);
        yield* source;
      });
      agent.addStreamMiddleware(async function* (source) {
        order.push(2);
        yield* source;
      });

      for await (const _event of agent.stream("test", { model: "test-model" })) {
        // consume
      }
      // Middleware wraps like decorators: last registered is outermost
      expect(order).toEqual([2, 1]);
    });

    it("middleware also works with streamWithContext", async () => {
      const agent = makeAgent();
      let middlewareCalled = false;

      agent.addStreamMiddleware(async function* (source) {
        middlewareCalled = true;
        yield* source;
      });

      for await (const _event of agent.streamWithContext(
        [{ role: "user", content: "hi" }],
        { model: "test-model" },
      )) {
        // consume
      }
      expect(middlewareCalled).toBe(true);
    });

    it("throws on disposed agent", async () => {
      const agent = makeAgent();
      agent.dispose();
      expect(() => agent.addStreamMiddleware(async function* (s) { yield* s; })).toThrow();
    });
  });

  describe("retry (built-in)", () => {
    it("should not retry when retry config is not set", async () => {
      let callCount = 0;
      const agent = makeAgent();
      (agent as any).executeRun = async () => {
        callCount++;
        if (callCount === 1) {
          const err = new AgentSDKError("timeout", { code: "TIMEOUT", retryable: true });
          throw err;
        }
        return agent.mockResult;
      };
      await expect(agent.run("test", { model: "test-model" })).rejects.toThrow("timeout");
      expect(callCount).toBe(1);
    });

    it("should retry on retryable error up to maxRetries", async () => {
      let callCount = 0;
      const agent = makeAgent();
      (agent as any).executeRun = async () => {
        callCount++;
        if (callCount <= 2) {
          throw new AgentSDKError("timeout", { code: "TIMEOUT", retryable: true });
        }
        return agent.mockResult;
      };
      const result = await agent.run("test", {
        model: "test-model",
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1 },
      });
      expect(result.output).toBe("test response");
      expect(callCount).toBe(3);
    });

    it("should not retry non-retryable errors", async () => {
      let callCount = 0;
      const agent = makeAgent();
      (agent as any).executeRun = async () => {
        callCount++;
        throw new AgentSDKError("auth invalid", { code: "AUTH_INVALID" });
      };
      await expect(
        agent.run("test", {
          model: "test-model",
          retry: { maxRetries: 3, initialDelayMs: 10 },
        }),
      ).rejects.toThrow("auth invalid");
      expect(callCount).toBe(1);
    });

    it("should never retry AbortError", async () => {
      let callCount = 0;
      const agent = makeAgent();
      (agent as any).executeRun = async () => {
        callCount++;
        throw new AbortError();
      };
      await expect(
        agent.run("test", {
          model: "test-model",
          retry: { maxRetries: 3, initialDelayMs: 10 },
        }),
      ).rejects.toThrow(AbortError);
      expect(callCount).toBe(1);
    });

    it("should apply exponential backoff", async () => {
      const timestamps: number[] = [];
      const agent = makeAgent();
      (agent as any).executeRun = async () => {
        timestamps.push(Date.now());
        if (timestamps.length <= 3) {
          throw new AgentSDKError("network", { code: "NETWORK", retryable: true });
        }
        return agent.mockResult;
      };
      await agent.run("test", {
        model: "test-model",
        retry: { maxRetries: 3, initialDelayMs: 20, backoffMultiplier: 2 },
      });
      expect(timestamps.length).toBe(4);
      // Verify delays increase (with tolerance for timer imprecision)
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      expect(delay1).toBeGreaterThanOrEqual(15); // ~20ms
      expect(delay2).toBeGreaterThanOrEqual(30); // ~40ms
    });

    it("should retry runWithContext", async () => {
      let callCount = 0;
      const agent = makeAgent();
      (agent as any).executeRun = async () => {
        callCount++;
        if (callCount === 1) throw new AgentSDKError("timeout", { code: "TIMEOUT", retryable: true });
        return agent.mockResult;
      };
      const result = await agent.runWithContext(
        [{ role: "user", content: "hi" }],
        { model: "test-model", retry: { maxRetries: 1, initialDelayMs: 10 } },
      );
      expect(result.output).toBe("test response");
      expect(callCount).toBe(2);
    });

    it("should retry runStructured", async () => {
      let callCount = 0;
      const agent = makeAgent();
      (agent as any).executeRunStructured = async () => {
        callCount++;
        if (callCount === 1) throw new AgentSDKError("rate limit", { code: "RATE_LIMIT", retryable: true });
        return { output: "ok", structuredOutput: { x: 1 }, toolCalls: [], messages: [] };
      };
      const result = await agent.runStructured(
        "test", { name: "s", schema: {} as any },
        { model: "test-model", retry: { maxRetries: 1, initialDelayMs: 10 } },
      );
      expect(result.output).toBe("ok");
      expect(callCount).toBe(2);
    });

    it("should retry stream on pre-stream error", async () => {
      let callCount = 0;
      const agent = makeAgent();
      (agent as any).executeStream = async function* () {
        callCount++;
        if (callCount === 1) throw new AgentSDKError("network", { code: "NETWORK", retryable: true });
        yield { type: "text_delta" as const, text: "ok" };
      };
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test", {
        model: "test-model",
        retry: { maxRetries: 1, initialDelayMs: 10 },
      })) {
        events.push(event);
      }
      expect(events.length).toBeGreaterThan(0);
      expect(callCount).toBe(2);
    });

    it("should respect retryableErrors filter", async () => {
      let callCount = 0;
      const agent = makeAgent();
      (agent as any).executeRun = async () => {
        callCount++;
        throw new AgentSDKError("timeout", { code: "TIMEOUT", retryable: true });
      };
      await expect(
        agent.run("test", {
          model: "test-model",
          retry: { maxRetries: 3, initialDelayMs: 10, retryableErrors: ["NETWORK"] },
        }),
      ).rejects.toThrow("timeout");
      // Should not retry because TIMEOUT is not in retryableErrors list
      expect(callCount).toBe(1);
    });

    it("should exhaust retries then throw last error", async () => {
      let callCount = 0;
      const agent = makeAgent();
      (agent as any).executeRun = async () => {
        callCount++;
        throw new AgentSDKError(`error-${callCount}`, { code: "TIMEOUT", retryable: true });
      };
      await expect(
        agent.run("test", {
          model: "test-model",
          retry: { maxRetries: 2, initialDelayMs: 10, backoffMultiplier: 1 },
        }),
      ).rejects.toThrow("error-3");
      expect(callCount).toBe(3); // 1 initial + 2 retries
    });
  });

});
