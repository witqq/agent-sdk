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
import { ReentrancyError, DisposedError, AbortError } from "../../src/errors.js";

// ─── Concrete Test Implementation ──────────────────────────────

class TestAgent extends BaseAgent {
  public runCalled = false;
  public structuredCalled = false;
  public streamCalled = false;
  public lastMessages: Message[] = [];
  public lastSignal: AbortSignal | null = null;

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
    _options: RunOptions | undefined,
    signal: AbortSignal,
  ): Promise<AgentResult> {
    this.runCalled = true;
    this.lastMessages = messages;
    this.lastSignal = signal;

    if (this.runDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.runDelay));
    }
    this.checkAbort(signal);
    return this.mockResult;
  }

  protected async executeRunStructured<T>(
    messages: Message[],
    _schema: StructuredOutputConfig<T>,
    _options: RunOptions | undefined,
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
    _options: RunOptions | undefined,
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
      await agent.run("hello");
      expect(agent.runCalled).toBe(true);
      expect(agent.lastMessages).toEqual([
        { role: "user", content: "hello" },
      ]);
    });

    it("should return result from executeRun", async () => {
      const agent = makeAgent();
      const result = await agent.run("test");
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

      await agent.run("test");
      expect(statesDuringRun).toContain("running");
      expect(agent.getState()).toBe("idle");
    });

    it("should reset state to idle even on error", async () => {
      const agent = makeAgent();
      (agent as any).executeRun = async () => {
        throw new Error("boom");
      };
      await expect(agent.run("test")).rejects.toThrow("boom");
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
      await agent.runWithContext(messages);
      expect(agent.lastMessages).toEqual(messages);
    });
  });

  describe("runStructured()", () => {
    it("should call executeRunStructured", async () => {
      const agent = makeAgent();
      const schema: StructuredOutputConfig<{ title: string }> = {
        name: "test",
        schema: {} as any,
      };
      const result = await agent.runStructured("test", schema);
      expect(agent.structuredCalled).toBe(true);
      expect(result.structuredOutput).toEqual({ title: "test" });
    });
  });

  describe("stream()", () => {
    it("should yield events from executeStream", async () => {
      const agent = makeAgent();
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("test")) {
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

      for await (const _ of agent.stream("test")) {
        // consume
      }
      expect(stateDuringStream).toBe("streaming");
      expect(agent.getState()).toBe("idle");
    });
  });

  describe("re-entrancy guard (M8)", () => {
    it("should throw ReentrancyError if run called while running", async () => {
      const agent = makeAgent();
      agent.runDelay = 50;

      const first = agent.run("first");
      await expect(agent.run("second")).rejects.toThrow(ReentrancyError);
      await first;
    });

    it("should throw ReentrancyError if stream called while running", async () => {
      const agent = makeAgent();
      agent.runDelay = 50;

      const first = agent.run("first");
      // stream() is async generator — guard throws on first iteration
      const iter = agent.stream("second")[Symbol.asyncIterator]();
      await expect(iter.next()).rejects.toThrow(ReentrancyError);
      await first;
    });

    it("should allow sequential runs", async () => {
      const agent = makeAgent();
      await agent.run("first");
      await agent.run("second");
      expect(agent.getState()).toBe("idle");
    });
  });

  describe("disposed guard", () => {
    it("should throw DisposedError after dispose", async () => {
      const agent = makeAgent();
      agent.dispose();
      expect(agent.getState()).toBe("disposed");
      await expect(agent.run("test")).rejects.toThrow(DisposedError);
    });

    it("should throw DisposedError for stream after dispose", async () => {
      const agent = makeAgent();
      agent.dispose();
      const iter = agent.stream("test")[Symbol.asyncIterator]();
      await expect(iter.next()).rejects.toThrow(DisposedError);
    });

    it("should throw DisposedError for runStructured after dispose", async () => {
      const agent = makeAgent();
      agent.dispose();
      await expect(
        agent.runStructured("test", { name: "s", schema: {} as any }),
      ).rejects.toThrow(DisposedError);
    });
  });

  describe("abort()", () => {
    it("should abort the current operation", async () => {
      const agent = makeAgent();
      agent.runDelay = 200;

      (agent as any).executeRun = async (
        _msgs: Message[],
        _opts: RunOptions | undefined,
        signal: AbortSignal,
      ) => {
        await new Promise((r) => setTimeout(r, 100));
        if (signal.aborted) throw new AbortError();
        return agent.mockResult;
      };

      const runPromise = agent.run("test");
      setTimeout(() => agent.abort(), 10);
      await expect(runPromise).rejects.toThrow(AbortError);
      expect(agent.getState()).toBe("idle");
    });

    it("should link to external abort signal", async () => {
      const agent = makeAgent();
      const externalAc = new AbortController();

      (agent as any).executeRun = async (
        _msgs: Message[],
        _opts: RunOptions | undefined,
        signal: AbortSignal,
      ) => {
        await new Promise((r) => setTimeout(r, 100));
        if (signal.aborted) throw new AbortError();
        return agent.mockResult;
      };

      const runPromise = agent.run("test", { signal: externalAc.signal });
      setTimeout(() => externalAc.abort(), 10);
      await expect(runPromise).rejects.toThrow(AbortError);
    });

    it("should handle already-aborted external signal", async () => {
      const agent = makeAgent();
      const externalAc = new AbortController();
      externalAc.abort();

      (agent as any).executeRun = async (
        _msgs: Message[],
        _opts: RunOptions | undefined,
        signal: AbortSignal,
      ) => {
        if (signal.aborted) throw new AbortError();
        return agent.mockResult;
      };

      await expect(
        agent.run("test", { signal: externalAc.signal }),
      ).rejects.toThrow(AbortError);
    });

    it("should be no-op if not running", () => {
      const agent = makeAgent();
      expect(() => agent.abort()).not.toThrow();
    });
  });

  describe("dispose()", () => {
    it("should abort current operation", () => {
      const agent = makeAgent();
      agent.dispose();
      expect(agent.getState()).toBe("disposed");
    });
  });
});
