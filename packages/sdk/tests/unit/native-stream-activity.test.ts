import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as ai from "ai";
import type { LanguageModelV3, LanguageModelV3StreamPart } from "@ai-sdk/provider";
import type { AgentEvent } from "../../src/types.js";
import { createVercelAIService, _injectSDK, _injectCompat, _resetSDK } from "../../src/backends/vercel-ai.js";
import { AgentSDKError, ToolExecutionError } from "../../src/errors.js";
import { createClaudeService, _injectSDK as injectClaude, _resetSDK as resetClaude } from "../../src/backends/claude.js";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
type TimedPart = { delay: number; part: LanguageModelV3StreamPart };

// Only the network boundary is replaced. Real AI SDK streamText parses the
// fragments, validates the completed call and executes the registered tool.
function nativeModel(parts: TimedPart[]) {
  // Load the actual SDK before virtual time advances; module I/O is not model inactivity.
  _injectSDK(ai as never);
  const doStream = vi.fn<LanguageModelV3["doStream"]>(async ({ abortSignal }) => {
    let index = 0;
    return {
      stream: new ReadableStream<LanguageModelV3StreamPart>({
        async pull(controller) {
          const next = parts[index++];
          if (!next) { controller.close(); return; }
          if (next.delay) await new Promise<void>((resolve, reject) => {
            const abort = () => { clearTimeout(timer); reject(abortSignal?.reason); };
            const timer = setTimeout(() => { abortSignal?.removeEventListener("abort", abort); resolve(); }, next.delay);
            if (abortSignal?.aborted) abort();
            else abortSignal?.addEventListener("abort", abort, { once: true });
          });
          if (abortSignal?.aborted) throw abortSignal.reason;
          controller.enqueue(next.part);
        },
      }),
    };
  });
  const model: LanguageModelV3 = {
    specificationVersion: "v3", provider: "test", modelId: "activity-model",
    supportedUrls: {}, doStream,
    doGenerate: async () => { throw new Error("stream only"); },
  };
  _injectCompat({ createOpenAICompatible: () => ({ chatModel: () => model, languageModel: () => model }) } as never);
  return doStream;
}

function agent(execute = vi.fn(async (args: { text: string }) => args.text)) {
  return {
    execute,
    value: createVercelAIService({ apiKey: "unused", provider: "test" }).createAgent({
      systemPrompt: "Use the tool", maxTurns: 1, heartbeatInterval: 10,
      tools: [{ name: "save", description: "Save text", parameters: z.object({ text: z.string() }), execute }],
    }),
  };
}

async function collect(stream: AsyncIterable<AgentEvent>, events: AgentEvent[]) {
  try { for await (const event of stream) events.push(event); return { error: undefined }; }
  catch (error) { return { error }; }
}

afterEach(() => { _resetSDK(); resetClaude(); vi.useRealTimers(); });

describe("native stream activity through Vercel AI", () => {
  it.each([false, true])("keeps nonempty tool arguments alive until one complete execution (ACK=%s)", async acknowledgment => {
    vi.useFakeTimers();
    const doStream = nativeModel([
      { delay: 0, part: { type: "response-metadata", id: "response-1", timestamp: new Date(), modelId: "activity-model" } },
      { delay: 0, part: { type: "tool-input-start", id: "call-1", toolName: "save" } },
      { delay: 40, part: { type: "tool-input-delta", id: "call-1", delta: '{"text":' } },
      { delay: 40, part: { type: "tool-input-delta", id: "call-1", delta: '"long ' } },
      { delay: 40, part: { type: "tool-input-delta", id: "call-1", delta: 'text"}' } },
      { delay: 40, part: { type: "tool-input-end", id: "call-1" } },
      { delay: 0, part: { type: "tool-call", toolCallId: "call-1", toolName: "save", input: '{"text":"long text"}' } },
      { delay: 0, part: { type: "finish", usage, finishReason: { unified: "tool-calls", raw: "tool_calls" } } },
    ]);
    const { value, execute } = agent();
    const events: AgentEvent[] = [];
    const onProviderAcknowledgment = acknowledgment ? vi.fn() : undefined;
    const completed = collect(value.stream("write", { model: "activity-model", activityTimeoutMs: 100, onProviderAcknowledgment }), events);
    await vi.advanceTimersByTimeAsync(125);
    expect(execute).not.toHaveBeenCalled();
    expect(events.some(event => event.type === "tool_call_start")).toBe(false);
    await vi.advanceTimersByTimeAsync(40);
    expect((await completed).error).toBeUndefined();
    expect(execute).toHaveBeenCalledExactlyOnceWith({ text: "long text" });
    expect(events.filter(event => event.type === "tool_call_start")).toHaveLength(1);
    expect(events.filter(event => event.type === "tool_call_end")).toHaveLength(1);
    expect(events.at(-1)?.type).toBe("done");
    expect(doStream).toHaveBeenCalledTimes(1);
    if (onProviderAcknowledgment) expect(onProviderAcknowledgment).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ responseId: "response-1" }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not let synthetic heartbeat or empty native fragments hide silence", async () => {
    vi.useFakeTimers();
    nativeModel([
      { delay: 0, part: { type: "tool-input-start", id: "call-1", toolName: "save" } },
      ...Array.from({ length: 6 }, () => ({ delay: 30, part: { type: "tool-input-delta" as const, id: "call-1", delta: "" } })),
    ]);
    const { value, execute } = agent();
    const events: AgentEvent[] = [];
    const completed = collect(value.stream("write", { model: "activity-model", activityTimeoutMs: 100 }), events);
    await vi.advanceTimersByTimeAsync(105);
    expect((await completed).error).toMatchObject({ name: "ActivityTimeoutError" });
    expect(events.some(event => event.type === "heartbeat")).toBe(true);
    expect(execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not mistake empty text deltas or metadata for productive native activity", async () => {
    vi.useFakeTimers();
    nativeModel([
      { delay: 0, part: { type: "text-start", id: "text-1" } },
      ...Array.from({ length: 6 }, () => ({ delay: 30, part: { type: "text-delta" as const, id: "text-1", delta: "" } })),
    ]);
    const { value, execute } = agent();
    const completed = collect(value.stream("write", { model: "activity-model", activityTimeoutMs: 100 }), []);
    await vi.advanceTimersByTimeAsync(105);
    expect((await completed).error).toMatchObject({ name: "ActivityTimeoutError", streamActivity: { native: { eventCount: 0, byteCount: 0 } } });
    expect(execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports native arguments separately from semantic events without exposing their content", async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    nativeModel([
      { delay: 0, part: { type: "text-start", id: "text-1" } },
      { delay: 0, part: { type: "text-delta", id: "text-1", delta: "я" } },
      { delay: 0, part: { type: "text-end", id: "text-1" } },
      { delay: 0, part: { type: "tool-input-start", id: "call-1", toolName: "save" } },
      { delay: 40, part: { type: "tool-input-delta", id: "call-1", delta: '{"text":"secret' } },
      { delay: 40, part: { type: "tool-input-delta", id: "call-1", delta: ' argument' } },
      { delay: 300, part: { type: "tool-input-end", id: "call-1" } },
    ]);
    const { value, execute } = agent();
    const events: AgentEvent[] = [];
    const completed = collect(value.streamWithContext([{ role: "user", content: "write" }], { model: "activity-model", activityTimeoutMs: 100 }), events);
    await vi.advanceTimersByTimeAsync(185);
    const failure = (await completed).error;
    expect(AgentSDKError.is(failure)).toBe(true);
    const snapshot = (failure as AgentSDKError).streamActivity;
    expect(snapshot).toEqual({
      native: { eventCount: 3, byteCount: 26, firstEventAt: startedAt, lastEventAt: startedAt + 80 },
      semantic: { eventCount: 1, byteCount: 2, firstEventAt: startedAt, lastEventAt: startedAt },
    });
    expect(JSON.stringify(snapshot)).not.toContain("secret");
    expect(events.filter(event => event.type !== "heartbeat")).toEqual([{ type: "text_delta", text: "я" }]);
    expect(execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts incomplete native arguments without executing them and cleans up for the next stream", async () => {
    vi.useFakeTimers();
    nativeModel([
      { delay: 0, part: { type: "tool-input-start", id: "call-1", toolName: "save" } },
      { delay: 40, part: { type: "tool-input-delta", id: "call-1", delta: '{"text":' } },
      { delay: 400, part: { type: "tool-input-end", id: "call-1" } },
    ]);
    const { value, execute } = agent();
    const ac = new AbortController();
    const first = collect(value.stream("write", { model: "activity-model", activityTimeoutMs: 100, signal: ac.signal }), []);
    await vi.advanceTimersByTimeAsync(45);
    ac.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect((await first).error).toMatchObject({ name: "AbortError", streamActivity: { native: { eventCount: 1 } } });
    expect(execute).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(value.getState()).toBe("idle");
    const second = collect(value.stream("write again", { model: "activity-model", activityTimeoutMs: 30 }), []);
    await vi.advanceTimersByTimeAsync(35);
    expect((await second).error).toMatchObject({ name: "ActivityTimeoutError", streamActivity: { native: { eventCount: 0, firstEventAt: null } } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("observes the analogous Claude input_json_delta without inventing tool events", async () => {
    vi.useFakeTimers();
    const query = vi.fn(() => (async function* () {
      for (const partial_json of ['{"text":', '"long ', 'text"}']) {
        await new Promise(resolve => setTimeout(resolve, 40));
        yield { type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json } } };
      }
      yield { type: "assistant", message: { content: [{ type: "tool_use", name: "save", id: "call-1", input: { text: "long text" } }] } };
      yield { type: "result", subtype: "success", result: "done", modelUsage: {} };
    })());
    injectClaude({ query } as never);
    const value = createClaudeService({}).createAgent({ systemPrompt: "write", heartbeatInterval: 10 });
    const events: AgentEvent[] = [];
    const completed = collect(value.stream("write", { model: "test", activityTimeoutMs: 100 }), events);
    await vi.advanceTimersByTimeAsync(85);
    expect(events.filter(event => event.type !== "heartbeat")).toEqual([]);
    await vi.advanceTimersByTimeAsync(40);
    expect((await completed).error).toBeUndefined();
    expect(events.filter(event => event.type === "tool_call_start")).toEqual([{ type: "tool_call_start", toolCallId: "call-1", toolName: "save", args: { text: "long text" } }]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not replace an immutable primary tool error with a diagnostic assignment failure", async () => {
    nativeModel([
      { delay: 0, part: { type: "tool-call", toolCallId: "call-1", toolName: "save", input: '{"text":"complete"}' } },
      { delay: 0, part: { type: "finish", usage, finishReason: { unified: "tool-calls", raw: "tool_calls" } } },
    ]);
    const failure = Object.freeze(new ToolExecutionError("save", "primary failure"));
    const { value } = agent(vi.fn(async () => { throw failure; }));
    const events: AgentEvent[] = [];
    const result = await collect(value.stream("write", { model: "activity-model", activityTimeoutMs: 100 }), events);
    // Native tool failures remain recoverable error events, not whole-stream failures.
    expect(result.error).toBeUndefined();
    const event = events.find(event => event.type === "error");
    expect(event).toMatchObject({ type: "error", code: "TOOL_EXECUTION" });
    expect(event?.type === "error" ? event.cause : undefined).toBe(failure);
  });
});
