import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { InvalidPromptError } from "ai";
import { createVercelAIService, _resetSDK } from "../../src/backends/vercel-ai.js";
import { AgentSDKError, ProviderAcknowledgmentError } from "../../src/errors.js";
import type { AgentEvent, Message, RunOptions } from "../../src/types.js";
import { getTextContent } from "../../src/types.js";
import { agentEventToChatEvent } from "../../src/chat/bridge.js";

afterEach(() => { vi.unstubAllGlobals(); _resetSDK(); });

function agent() {
  return createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
    .createAgent({ model: "offline-model", tools: [], modelParams: { maxTokens: 123 } });
}

const usage = { prompt_tokens: 41, completion_tokens: 7, total_tokens: 48, cost: 0.003 };
function transport(stream: boolean, content = "Done", firstFailure?: Error) {
  const requests: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init: RequestInit) => {
    if (String(url) !== "https://offline.invalid/v1/chat/completions") throw new Error("Unexpected offline fixture URL");
    requests.push(JSON.parse(String(init.body)));
    if (requests.length === 1 && firstFailure) throw firstFailure;
    const response = { id: "offline-response", object: "chat.completion", created: 1, model: "offline-model",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage };
    if (!stream) return Response.json(response);
    const chunks = [
      { ...response, object: "chat.completion.chunk", usage: undefined,
        choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] },
      { ...response, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
    ];
    return new Response(chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n",
      { headers: { "content-type": "text/event-stream" } });
  }));
  return requests;
}

function context(): Message[] {
  return [
    { role: "user", content: "Use the collected evidence." },
    { role: "assistant", content: "Collecting evidence", thinking: "Private legacy reasoning", toolCalls: [
      { id: "call-text", name: "search", args: { query: "example" } },
      { id: "call-json", name: "read", args: { page: 1 } },
      { id: "call-error-text", name: "read", args: { page: 2 } },
      { id: "call-error-json", name: "read", args: { page: 3 } },
    ] },
    { role: "tool", toolResults: [
      { toolCallId: "call-text", name: "search", result: "Source text" },
      { toolCallId: "call-json", name: "read", result: { title: "Source", count: 2 } },
      { toolCallId: "call-error-text", name: "read", result: "Unavailable", isError: true },
      { toolCallId: "call-error-json", name: "read", result: { reason: "Unavailable" }, isError: true },
    ] },
  ];
}

describe("Vercel native AI protocol without live provider calls", () => {
  function sse(chunks: unknown[] | ((request: number) => unknown[])) {
    const fetch = vi.fn(async (url: unknown, _init?: RequestInit) => {
      if (String(url) !== "https://offline.invalid/v1/chat/completions") throw new Error("Unexpected offline fixture URL");
      const parts = typeof chunks === "function" ? chunks(fetch.mock.calls.length) : chunks;
      return new Response(parts.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n",
        { headers: { "content-type": "text/event-stream" } });
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  function chunk(delta: Record<string, unknown>, finishReason: string | null = null, reportedUsage?: typeof usage) {
    return { id: "offline-response", object: "chat.completion.chunk", created: 1, model: "offline-model",
      choices: [{ index: 0, delta, finish_reason: finishReason }], ...(reportedUsage ? { usage: reportedUsage } : {}) };
  }

  it("preserves completed native reasoning and tool metadata through JSON and a separate agent operation", async () => {
    const reasoning = "Compare the retained measurements before requesting their original source.";
    const signature = "offline-native-signature";
    const fetch = sse(request => request === 1 ? [
      chunk({ role: "assistant", reasoning_content: reasoning.slice(0, 24) }),
      chunk({ reasoning_content: reasoning.slice(24), content: "Opening the original.", tool_calls: [
        { index: 0, id: "call-context", type: "function", function: { name: "lookup", arguments: "{}" },
          extra_content: { google: { thought_signature: signature } } },
      ] }),
      chunk({}, "tool_calls", usage),
    ] : [{ ...chunk({ content: "The retained result is supported." }), id: "second-response" },
      { ...chunk({}, "stop", usage), id: "second-response" }]);
    let applicationResult: string | undefined;
    const service = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" });
    const first = service.createAgent({ model: "offline-model", maxTurns: 1, tools: [{ name: "lookup",
      description: "Read the original", parameters: z.object({}), execute: async () => {
        applicationResult = "Actual retained source result";
        return applicationResult;
      } }] });
    const events: AgentEvent[] = [];
    for await (const event of first.stream("Check the measurements.", { model: "offline-model" })) events.push(event);
    first.dispose();
    const terminal = events.find(event => event.type === "done") as
      (Extract<AgentEvent, { type: "done" }> & { messages?: Message[] }) | undefined;
    expect(terminal?.messages).toEqual(expect.any(Array));
    const completed = terminal!.messages!.find(message => message.role === "assistant");
    expect(completed).toBeDefined();
    expect(applicationResult).toBe("Actual retained source result");
    const restored: Message = JSON.parse(JSON.stringify(completed));
    expect(getTextContent(restored.content)).toBe("Opening the original.");
    expect(agentEventToChatEvent(terminal!, "context-message")).toEqual({
      type: "done", finalOutput: undefined, finishReason: "tool-calls" });
    const second = service.createAgent({ model: "offline-model", maxTurns: 1, tools: [] });
    const secondEvents: AgentEvent[] = [];
    for await (const event of second.streamWithContext([
      { role: "user", content: "Check the measurements." }, restored,
      { role: "tool", toolResults: [{ toolCallId: "call-context", name: "lookup", result: applicationResult! }] },
    ], { model: "offline-model" })) secondEvents.push(event);
    second.dispose();
    service.dispose();
    expect(fetch).toHaveBeenCalledTimes(2);
    const wire = JSON.parse(String(fetch.mock.calls[1][1]?.body)).messages as Array<Record<string, unknown>>;
    expect(wire[1]).toMatchObject({ role: "assistant", content: "Opening the original.", reasoning_content: reasoning,
      tool_calls: [{ id: "call-context", function: { name: "lookup", arguments: "{}" },
        extra_content: { google: { thought_signature: signature } } }] });
    expect(wire[2]).toEqual({ role: "tool", tool_call_id: "call-context", content: applicationResult });
    expect(secondEvents.find(event => event.type === "done")).toMatchObject({
      finalOutput: null, streamed: true, finishReason: "stop" });
    expect(secondEvents.findLast(event => event.type === "usage_update")).toMatchObject({
      promptTokens: 41, completionTokens: 7, cost: 0.003 });
  });

  async function drain(instance: ReturnType<typeof agent>, options: Partial<RunOptions> & {
    onProviderAcknowledgment?: (observation: { provider: string; modelCallIndex: number; responseId: string; modelId?: string; timestamp?: string }) => void | Promise<void>;
  } = {}) {
    const events: AgentEvent[] = [];
    let failure: unknown;
    try {
      for await (const event of instance.stream("Answer", { model: "offline-model", retry: { maxRetries: 1, initialDelayMs: 0 }, ...options })) events.push(event);
    } catch (error) { failure = error; }
    instance.dispose();
    return { events, failure };
  }

  it("provider acknowledgment is awaited before text or usage reaches the caller", async () => {
    const fetch = sse([chunk({ content: "Done" }), chunk({}, "stop", usage)]);
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const observations: unknown[] = [];
    const events: AgentEvent[] = [];
    const instance = agent();
    const done = (async () => {
      for await (const event of instance.stream("Answer", { model: "offline-model", onProviderAcknowledgment: async observation => {
        observations.push(observation);
        await barrier;
      } } as RunOptions)) events.push(event);
    })();
    await vi.waitFor(() => expect(observations).toEqual([{ provider: "openrouter", modelCallIndex: 0,
      responseId: "offline-response", modelId: "offline-model", timestamp: "1970-01-01T00:00:01.000Z" }]));
    expect(events.some(event => event.type === "text_delta" || event.type === "usage_update" || event.type === "done")).toBe(false);
    release();
    await done;
    expect(events.some(event => event.type === "done")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    instance.dispose();
  });

  it("provider acknowledgment persists the native ID before cancellation without waiting for usage", async () => {
    const fetch = sse([chunk({ content: "Partial" }), chunk({}, "stop", usage)]);
    const controller = new AbortController();
    const observed: unknown[] = [];
    const { events } = await drain(agent(), { signal: controller.signal, onProviderAcknowledgment: observation => {
      observed.push(observation);
      controller.abort();
    } });
    expect(observed).toEqual([expect.objectContaining({ responseId: "offline-response", modelCallIndex: 0 })]);
    expect(events.some(event => event.type === "done")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("provider acknowledgment never manufactures missing identity and handles a late ID (late=%s)", async late => {
    const first = chunk({ content: "One" });
    const last = chunk({}, "stop", usage);
    const withoutIdentity = (part: ReturnType<typeof chunk>) => { const { id, model, created, ...rest } = part; return rest; };
    const fetch = sse([withoutIdentity(first), late ? last : withoutIdentity(last)]);
    const observed: unknown[] = [];
    const { events, failure } = await drain(agent(), { onProviderAcknowledgment: observation => { observed.push(observation); } });
    expect(failure).toBeUndefined();
    expect(observed).toEqual(late ? [expect.objectContaining({ responseId: "offline-response", modelId: "offline-model", modelCallIndex: 0 })] : []);
    expect(events.some(event => event.type === "done")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("provider acknowledgment deduplicates repeated native metadata", async () => {
    const fetch = sse([chunk({ content: "One" }), chunk({ content: "Two" }), chunk({}, "stop", usage)]);
    const persist = vi.fn(async () => {});
    const { failure, events } = await drain(agent(), { onProviderAcknowledgment: persist });
    expect(failure).toBeUndefined();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(events.some(event => event.type === "done")).toBe(true);
    expect(events.some(event => (event as { type: string }).type === "raw")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("provider acknowledgment does not invent optional model or timestamp metadata", async () => {
    const { model, created, ...first } = chunk({ content: "Done" });
    const { model: lastModel, created: lastCreated, ...last } = chunk({}, "stop", usage);
    const fetch = sse([first, last]);
    const persist = vi.fn(async () => {});
    const { failure } = await drain(agent(), { onProviderAcknowledgment: persist });
    expect(failure).toBeUndefined();
    expect(persist).toHaveBeenCalledExactlyOnceWith({ provider: "openrouter", modelCallIndex: 0, responseId: "offline-response" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([{ id: "another-response" }, { model: "another-model" }, { created: 2 }])("provider acknowledgment rejects contradictory native identity without overwriting the first ($id$model$created)", async conflict => {
    const fetch = sse([chunk({ content: "One" }), { ...chunk({}, "stop", usage), ...conflict }]);
    const persist = vi.fn(async () => {});
    const { failure, events } = await drain(agent(), { onProviderAcknowledgment: persist });
    expect(ProviderAcknowledgmentError.is(failure)).toBe(true);
    expect(failure).toMatchObject({ reason: "identity_conflict", observation: { responseId: "offline-response" }, retryable: false });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(events.some(event => event.type === "done")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("provider acknowledgment persistence failure preserves local origin even when its cause is retryable timeout", async () => {
    const fetch = sse([chunk({ content: "Done" }), chunk({}, "stop", usage)]);
    const cause = new AgentSDKError("Local database timeout", { code: "TIMEOUT", retryable: true });
    const { failure, events } = await drain(agent(), { retry: { maxRetries: 1, initialDelayMs: 0, retryableErrors: ["TIMEOUT"] },
      onProviderAcknowledgment: async () => { throw cause; } });
    expect(ProviderAcknowledgmentError.is(failure)).toBe(true);
    expect(failure).toMatchObject({ reason: "persistence_failed", cause, retryable: false });
    expect((failure as AgentSDKError).code).toBeUndefined();
    expect((failure as AgentSDKError).providerRequestSent).toBeUndefined();
    expect(events.some(event => event.type === "done")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("provider acknowledgment isolates concurrent runs without cross-run identity", async () => {
    const fetch = sse(request => [{ ...chunk({ content: "Done" }), id: `native-${request}` }, { ...chunk({}, "stop", usage), id: `native-${request}` }]);
    const service = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" });
    const first = service.createAgent({ model: "offline-model", tools: [] });
    const second = service.createAgent({ model: "offline-model", tools: [] });
    const seen: Array<{ responseId: string; modelCallIndex: number }> = [];
    const sharedOptions: RunOptions = Object.freeze({ model: "offline-model", onProviderAcknowledgment: async value => {
      seen.push(value);
      await Promise.resolve();
    } });
    const collect = async (instance: ReturnType<typeof agent>) => {
      for await (const _event of instance.stream("Answer", sharedOptions)) { /* same exact options object */ }
      instance.dispose();
    };
    await Promise.all([collect(first), collect(second)]);
    expect(seen.map(value => [value.responseId, value.modelCallIndex]).sort()).toEqual([["native-1", 0], ["native-2", 0]]);
    expect(fetch).toHaveBeenCalledTimes(2);
    service.dispose();
  });

  it("provider acknowledgment binds each model call before tool execution without a duplicate dispatch", async () => {
    const fetch = sse(request => request === 1 ? [chunk({ tool_calls: [{ index: 0, id: "tool-1", type: "function", function: { name: "lookup", arguments: "{}" } }] }), chunk({}, "tool_calls", usage)]
      : [{ ...chunk({ content: "Done" }), id: "native-2" }, { ...chunk({}, "stop", usage), id: "native-2" }]);
    const seen: Array<{ responseId: string; modelCallIndex: number }> = [];
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" }).createAgent({ model: "offline-model", maxTurns: 2,
      tools: [{ name: "lookup", description: "Lookup", parameters: z.object({}), execute: async () => {
        expect(seen).toEqual([expect.objectContaining({ responseId: "offline-response", modelCallIndex: 0 })]);
        return "Retained source";
      } }] });
    const { failure } = await drain(instance, { onProviderAcknowledgment: value => { seen.push(value); } });
    expect(failure).toBeUndefined();
    expect(seen.map(value => [value.modelCallIndex, value.responseId])).toEqual([[0, "offline-response"], [1, "native-2"]]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("provider acknowledgment counts streaming physical calls without ID and resets on the next operation", async () => {
    const withoutId = (part: ReturnType<typeof chunk>) => { const { id, ...rest } = part; return rest; };
    const fetch = sse(request => request === 1
      ? [withoutId(chunk({ tool_calls: [{ index: 0, id: "tool-1", type: "function", function: { name: "lookup", arguments: "{}" } }] })), withoutId(chunk({}, "tool_calls", usage))]
      : [{ ...chunk({ content: "Done" }), id: `native-${request}` }, { ...chunk({}, "stop", usage), id: `native-${request}` }]);
    const seen: Array<{ responseId: string; modelCallIndex: number }> = [];
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" }).createAgent({ model: "offline-model", maxTurns: 2,
      tools: [{ name: "lookup", description: "Lookup", parameters: z.object({}), execute: async () => "Retained source" }] });
    const options: RunOptions = Object.freeze({ model: "offline-model", onProviderAcknowledgment: value => { seen.push(value); } });
    for await (const _event of instance.stream("First", options)) { /* drain */ }
    for await (const _event of instance.stream("Second", options)) { /* same exact options object */ }
    expect(seen.map(value => [value.responseId, value.modelCallIndex])).toEqual([["native-2", 1], ["native-3", 0]]);
    expect(fetch).toHaveBeenCalledTimes(3);
    instance.dispose();
  });

  it.each([false, true])("provider acknowledgment uses actual non-streaming response identity (structured=%s)", async structured => {
    const requests = transport(false, structured ? '{"answer":"Done"}' : "Done");
    const instance = agent();
    const persist = vi.fn(async () => {});
    const options = { model: "offline-model", onProviderAcknowledgment: persist };
    const result = structured
      ? await instance.runStructured("Answer", { schema: z.object({ answer: z.string() }) }, options)
      : await instance.run("Answer", options);
    if (structured) expect(result.structuredOutput).toEqual({ answer: "Done" });
    else expect(result.output).toBe("Done");
    expect(persist).toHaveBeenCalledExactlyOnceWith({ provider: "openrouter", modelCallIndex: 0,
      responseId: "offline-response", modelId: "offline-model", timestamp: "1970-01-01T00:00:01.000Z" });
    expect(requests).toHaveLength(1);
    instance.dispose();
  });

  it("provider acknowledgment non-streaming persistence failure cannot retry the sent request", async () => {
    const requests = transport(false);
    const instance = agent();
    const cause = new AgentSDKError("Local network timeout", { code: "NETWORK", retryable: true });
    await expect(instance.run("Answer", { model: "offline-model", retry: { maxRetries: 1, initialDelayMs: 0 },
      onProviderAcknowledgment: async () => { throw cause; } })).rejects.toMatchObject({
      name: "ProviderAcknowledgmentError", reason: "persistence_failed", cause, retryable: false,
    });
    expect(requests).toHaveLength(1);
    instance.dispose();
  });

  it.each([false, true])("preserves structured SSE rejection without false success or native retry (usage=%s)", async measured => {
    const providerError = { message: "Offline provider rate limit", code: 429, type: "offline_error", param: "messages" };
    const fetch = sse([...(measured ? [chunk({}, null, usage)] : []), { error: providerError }]);
    const { events, failure } = await drain(agent());
    expect(AgentSDKError.is(failure)).toBe(true);
    expect(failure).toMatchObject({ message: providerError.message, code: "RATE_LIMIT", httpStatus: 429, retryable: false, cause: providerError });
    const error = events.find(e => e.type === "error");
    expect(error).toMatchObject({ error: providerError.message, code: "RATE_LIMIT", cause: failure });
    expect(events.filter(e => e.type === "done")).toEqual([]);
    expect(events.filter(e => e.type === "usage_update")).toEqual(measured
      ? [expect.objectContaining({ promptTokens: 41, completionTokens: 7, cost: 0.003 })] : []);
    expect(failure).not.toHaveProperty("providerRequestSent", false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("bounds provider object causes and excludes unrecognized error payload", async () => {
    const fetch = sse([{ error: { message: "x".repeat(3000), code: "c".repeat(300), type: "t".repeat(300), param: "p".repeat(400), metadata: { private: "not public" } } }]);
    const { failure } = await drain(agent());
    expect(AgentSDKError.is(failure)).toBe(true);
    expect((failure as Error).message).toHaveLength(2048);
    expect((failure as Error).cause).toEqual({ message: "x".repeat(2048), code: "c".repeat(128), type: "t".repeat(128), param: "p".repeat(256) });
    expect((failure as AgentSDKError).httpStatus).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("correlates a throwing tool with its original cause and measured model usage", async () => {
    const original = new Error("Offline tool unavailable");
    const fetch = sse([
      chunk({ role: "assistant", tool_calls: [{ index: 0, id: "call-offline-tool", type: "function", function: { name: "lookup", arguments: '{"query":"example"}' } }] }),
      chunk({}, "tool_calls", usage),
    ]);
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
      .createAgent({ model: "offline-model", maxTurns: 1, tools: [{ name: "lookup", description: "Offline lookup", parameters: z.object({ query: z.string() }), execute: async () => { throw original; } }] });
    const { events, failure } = await drain(instance);
    expect(failure).toBeUndefined();
    const error = events.find(e => e.type === "error");
    expect(error).toMatchObject({ code: "TOOL_EXECUTION", recoverable: true, toolCallId: "call-offline-tool", toolName: "lookup" });
    expect(error?.cause?.cause).toBe(original);
    expect(error).not.toHaveProperty("localToolRefusal");
    expect(events.filter(e => e.type === "tool_call_end")).toEqual([]);
    expect(events.findLast(e => e.type === "usage_update")).toMatchObject({ promptTokens: 41, completionTokens: 7, cost: 0.003 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves a legitimate delayed tool name after an initially empty name without guessing arguments", async () => {
    const execute = vi.fn(async (args: { query: string }) => ({ observed: args.query }));
    const fetch = sse([
      chunk({ tool_calls: [{ index: 0, id: "call-delayed", type: "function", function: { name: "", arguments: '{"query":' } }] }),
      chunk({ tool_calls: [{ index: 0, function: { name: "lookup", arguments: '"observed"}' } }] }),
      chunk({}, "tool_calls", usage),
    ]);
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
      .createAgent({ model: "offline-model", maxTurns: 1, tools: [{ name: "lookup", description: "Offline lookup",
        parameters: z.object({ query: z.string() }), execute }] });
    const { events, failure } = await drain(instance);
    expect(failure).toBeUndefined();
    expect(events.filter(event => event.type === "tool_call_start")).toEqual([
      { type: "tool_call_start", toolCallId: "call-delayed", toolName: "lookup", args: { query: "observed" } },
    ]);
    expect(events.filter(event => event.type === "tool_call_end")).toEqual([
      { type: "tool_call_end", toolCallId: "call-delayed", toolName: "lookup", result: { observed: "observed" } },
    ]);
    expect(execute).toHaveBeenCalledExactlyOnceWith({ query: "observed" });
    expect(events.filter(event => event.type === "error")).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retains actual nonexistent-call input and a local parse refusal without successful tool output", async () => {
    const execute = vi.fn(async () => "must not execute");
    const fetch = sse([
      chunk({ tool_calls: [{ index: 0, id: "call-refused", type: "function", function: { name: "unavailable", arguments: 'null' } }] }),
      chunk({}, "tool_calls", usage),
    ]);
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
      .createAgent({ model: "offline-model", maxTurns: 1, tools: [{ name: "lookup", description: "Offline lookup",
        parameters: z.object({ query: z.string() }), execute }] });
    const { events, failure } = await drain(instance);
    expect(failure).toBeUndefined();
    expect(events.find(event => event.type === "tool_call_start")).toEqual({
      type: "tool_call_start", toolCallId: "call-refused", toolName: "unavailable", args: null,
    });
    expect(events.find(event => event.type === "error")).toMatchObject({ code: "TOOL_EXECUTION",
      localToolRefusal: { reason: "no_such_tool", toolCallId: "call-refused", toolName: "unavailable", args: null,
        toolExecutionStarted: false, providerExecuted: false } });
    expect(events.filter(event => event.type === "tool_call_end")).toEqual([]);
    expect(events.findLast(event => event.type === "usage_update")).toMatchObject({ promptTokens: 41, completionTokens: 7, cost: 0.003 });
    expect(execute).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["lookup", "ask_user"])("rejects declared invalid input before %s execution with native proof", async name => {
    const execute = vi.fn(async () => "must not execute");
    const args = name === "lookup" ? { query: 42 } : { question: 42 };
    const fetch = sse([
      chunk({ tool_calls: [{ index: 0, id: "call-invalid", type: "function", function: { name, arguments: JSON.stringify(args) } }] }),
      chunk({}, "tool_calls", usage),
    ]);
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
      .createAgent({ model: "offline-model", maxTurns: 1,
        tools: [{ name: "lookup", description: "Offline lookup", parameters: z.object({ query: z.string() }), execute }],
        supervisor: { onAskUser: execute } });
    const { events, failure } = await drain(instance);
    expect(failure).toBeUndefined();
    expect(events.find(event => event.type === "tool_call_start")).toMatchObject({ toolCallId: "call-invalid", toolName: name, args });
    expect(events.find(event => event.type === "error")).toMatchObject({ localToolRefusal: {
      reason: "invalid_tool_input", toolCallId: "call-invalid", toolName: name, args,
      toolExecutionStarted: false, providerExecuted: false,
    } });
    expect(events.filter(event => event.type === "tool_call_end")).toEqual([]);
    expect(events.findLast(event => event.type === "usage_update")).toMatchObject({ promptTokens: 41, completionTokens: 7, cost: 0.003 });
    expect(execute).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([{ names: [] }, { names: ["lookup", "other"] }])("never guesses a valid name from absent or conflicting later names ($names)", async ({ names }) => {
    const execute = vi.fn(async () => "must not execute");
    const fetch = sse([
      chunk({ tool_calls: [{ index: 0, id: "call-empty", type: "function", function: { name: "", arguments: '{"query":"observed"}' } }] }),
      ...names.map(name => chunk({ tool_calls: [{ index: 0, function: { name, arguments: "" } }] })),
      chunk({}, "tool_calls", usage),
    ]);
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
      .createAgent({ model: "offline-model", maxTurns: 1, tools: [{ name: "lookup", description: "Offline lookup", parameters: z.object({ query: z.string() }), execute }] });
    const { events, failure } = await drain(instance);
    expect(failure).toBeUndefined();
    expect(events.find(event => event.type === "error")).toMatchObject({ localToolRefusal: {
      reason: "no_such_tool", toolCallId: "call-empty", toolName: "", args: { query: "observed" },
    } });
    expect(execute).not.toHaveBeenCalled();
    expect(events.filter(event => event.type === "tool_call_end")).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not reuse delayed-name observations between requests on one agent", async () => {
    const execute = vi.fn(async (args: { query: string }) => args.query);
    const fetch = sse(request => [
      chunk({ tool_calls: [{ index: 0, id: "call-repeated", type: "function", function: { name: "", arguments: '{"query":"observed"}' } }] }),
      ...(request === 1 ? [chunk({ tool_calls: [{ index: 0, function: { name: "lookup", arguments: "" } }] })] : []),
      chunk({}, "tool_calls", usage),
    ]);
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
      .createAgent({ model: "offline-model", maxTurns: 1, tools: [{ name: "lookup", description: "Offline lookup", parameters: z.object({ query: z.string() }), execute }] });
    const runs: AgentEvent[][] = [];
    for (let i = 0; i < 2; i++) {
      const events: AgentEvent[] = [];
      for await (const event of instance.stream("Answer", { model: "offline-model" })) events.push(event);
      runs.push(events);
    }
    instance.dispose();
    expect(execute).toHaveBeenCalledExactlyOnceWith({ query: "observed" });
    expect(runs[0].some(event => event.type === "tool_call_end")).toBe(true);
    expect(runs[1].find(event => event.type === "error")).toMatchObject({ localToolRefusal: { toolName: "", reason: "no_such_tool" } });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not make an unfinished refused-call stream complete or invent its usage", async () => {
    const execute = vi.fn(async () => "must not execute");
    const fetch = sse([
      chunk({ tool_calls: [{ index: 0, id: "call-unfinished", type: "function", function: { name: "missing", arguments: 'null' } }] }),
    ]);
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
      .createAgent({ model: "offline-model", maxTurns: 1, tools: [{ name: "lookup", description: "Offline lookup", parameters: z.object({ query: z.string() }), execute }] });
    const { events, failure } = await drain(instance);
    expect(failure).toMatchObject({ message: "Response stream ended without a finish reason." });
    expect(events.filter(event => event.type === "done" || event.type === "usage_update" || event.type === "tool_call_end")).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves partial text without fabricating zero usage or successful terminal output", async () => {
    const fetch = sse([chunk({ role: "assistant", reasoning_content: "Incomplete private reasoning", content: "Partial answer" })]);
    const { events, failure } = await drain(agent());
    expect(events.filter(e => e.type === "text_delta").map(e => e.text).join("")).toBe("Partial answer");
    expect(events.some(e => e.type === "thinking_delta")).toBe(true);
    expect(AgentSDKError.is(failure)).toBe(true);
    expect((failure as Error).message).toBe("Response stream ended without a finish reason.");
    expect(events.filter(e => e.type === "usage_update" || e.type === "done")).toEqual([]);
    expect(failure).not.toHaveProperty("providerRequestSent", false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    { reported: { prompt_tokens: 41 }, expected: { promptTokens: 41, completionTokens: 0, tokenUsageKnown: { promptTokens: true, completionTokens: false } } },
    { reported: { completion_tokens: 7 }, expected: { promptTokens: 0, completionTokens: 7, tokenUsageKnown: { promptTokens: false, completionTokens: true } } },
    { reported: { prompt_tokens: 0, completion_tokens: 0 }, expected: { promptTokens: 0, completionTokens: 0, tokenUsageKnown: { promptTokens: true, completionTokens: true } } },
  ])("distinguishes measured partial usage and explicit zero from absent counters ($reported)", async ({ reported, expected }) => {
    const fetch = sse([chunk({ role: "assistant", content: "Answer" }), { ...chunk({}, "stop"), usage: reported }]);
    const onUsage = vi.fn();
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
      .createAgent({ model: "offline-model", tools: [], onUsage });
    const { events, failure } = await drain(instance);
    expect(failure).toBeUndefined();
    expect(events.filter(e => e.type === "usage_update")).toEqual([expect.objectContaining(expected)]);
    expect(onUsage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(expected));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("marks a measured prefix incomplete after a later unknown provider step", async () => {
    const fetch = sse(request => request === 1 ? [
      chunk({ tool_calls: [{ index: 0, id: "call-prefix", type: "function", function: { name: "lookup", arguments: '{}' } }] }),
      { ...chunk({}, "tool_calls"), usage },
    ] : [{ error: { message: "Offline later provider failure", code: 503 } }]);
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
      .createAgent({ model: "offline-model", maxTurns: 2, tools: [{ name: "lookup", description: "Offline lookup", parameters: z.object({}), execute: async () => "Source" }] });
    const { events, failure } = await drain(instance);
    expect((failure as Error).message).toBe("Offline later provider failure");
    expect(events.filter(e => e.type === "usage_update")).toEqual([
      expect.objectContaining({ promptTokens: 41, completionTokens: 7, cost: 0.003, tokenUsageKnown: { promptTokens: true, completionTokens: true } }),
      expect.objectContaining({ promptTokens: 41, completionTokens: 7, tokenUsageKnown: { promptTokens: false, completionTokens: false } }),
    ]);
    expect(events.findLast(e => e.type === "usage_update")?.cost).toBeUndefined();
    expect(events.filter(e => e.type === "done")).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["blocking", "structured", "streaming"].flatMap(mode =>
    [undefined, 0].map(maxRetries => ({ mode, maxRetries }))))(
    "performs one native HTTP attempt on 503 ($mode, retry=$maxRetries)", async ({ mode, maxRetries }) => {
      const fetch = vi.fn(async (url: unknown) => {
        if (String(url) !== "https://offline.invalid/v1/chat/completions") throw new Error("Unexpected offline fixture URL");
        return Response.json({ error: { message: "Offline provider unavailable" } },
          { status: 503, headers: { "retry-after": "0" } });
      });
      vi.stubGlobal("fetch", fetch);
      const instance = agent();
      const options = { model: "offline-model", ...(maxRetries === undefined ? {} : { retry: { maxRetries } }) };
      let failure: unknown;
      try {
        if (mode === "blocking") await instance.run("Answer", options);
        else if (mode === "structured") await instance.runStructured("Answer", { schema: z.object({ answer: z.string() }) }, options);
        else for await (const _event of instance.stream("Answer", options)) { /* drain */ }
      } catch (error) { failure = error; }
      expect(failure).toBeDefined();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(failure).not.toHaveProperty("providerRequestSent", false);
      instance.dispose();
    });

  it.each(["blocking", "structured"])("preserves explicit SDK retry and native invocation index across one public operation (%s)", async mode => {
    const original = new AgentSDKError("Offline timeout", { code: "TIMEOUT", retryable: true });
    const requests = transport(false, mode === "structured" ? '{"answer":"Done"}' : "Done", original);
    const instance = agent();
    const observations: Array<{ responseId: string; modelCallIndex: number }> = [];
    const options: RunOptions = { model: "offline-model", retry: { maxRetries: 1, initialDelayMs: 0 },
      onProviderAcknowledgment: value => { observations.push(value); } };
    const result = mode === "structured"
      ? await instance.runStructured("Answer", { schema: z.object({ answer: z.string() }) }, options)
      : await instance.run("Answer", options);
    expect(requests).toHaveLength(2);
    expect(observations).toEqual([expect.objectContaining({ responseId: "offline-response", modelCallIndex: 1 })]);
    expect(result.output).toBe(mode === "structured" ? '{"answer":"Done"}' : "Done");
    expect(result.usage).toMatchObject({ promptTokens: 41, completionTokens: 7, cost: 0.003 });
    if (mode === "structured") await instance.runStructured("Again", { schema: z.object({ answer: z.string() }) }, options);
    else await instance.run("Again", options);
    expect(requests).toHaveLength(3);
    expect(observations.map(value => value.modelCallIndex)).toEqual([1, 0]);
    instance.dispose();
  });

  it.each([false, true])("replays tool provenance, enforces the cap and meters native usage (stream=%s)", async stream => {
    const requests = transport(stream);
    const messages = context();
    const before = structuredClone(messages);
    const references = [...messages];
    const instance = agent();
    if (stream) {
      const events: AgentEvent[] = [];
      for await (const event of instance.streamWithContext(messages, { model: "offline-model" })) events.push(event);
      expect(events.filter(e => e.type === "text_delta").map(e => e.text).join("")).toBe("Done");
      expect(events.findLast(e => e.type === "usage_update")).toMatchObject({ promptTokens: 41, completionTokens: 7, cost: 0.003 });
    } else {
      const result = await instance.runWithContext(messages, { model: "offline-model" });
      expect(result.output).toBe("Done");
      expect(result.usage).toMatchObject({ promptTokens: 41, completionTokens: 7, cost: 0.003 });
    }
    expect(requests).toHaveLength(1);
    expect(requests[0].max_tokens).toBe(123);
    const wire = requests[0].messages as Array<Record<string, unknown>>;
    expect(wire[1]).toMatchObject({ role: "assistant", content: "Collecting evidence", reasoning_content: "Private legacy reasoning", tool_calls: [
      { id: "call-text", type: "function", function: { name: "search", arguments: '{"query":"example"}' } },
      { id: "call-json", type: "function", function: { name: "read", arguments: '{"page":1}' } },
      { id: "call-error-text", type: "function", function: { name: "read", arguments: '{"page":2}' } },
      { id: "call-error-json", type: "function", function: { name: "read", arguments: '{"page":3}' } },
    ] });
    expect(wire.slice(2)).toEqual([
      { role: "tool", tool_call_id: "call-text", content: "Source text" },
      { role: "tool", tool_call_id: "call-json", content: '{"title":"Source","count":2}' },
      { role: "tool", tool_call_id: "call-error-text", content: "Unavailable" },
      { role: "tool", tool_call_id: "call-error-json", content: '{"reason":"Unavailable"}' },
    ]);
    expect(messages).toEqual(before);
    references.forEach((message, index) => expect(messages[index]).toBe(message));
    instance.dispose();
  });

  it("enforces the public output cap and returns native usage for structured output", async () => {
    const requests = transport(false, '{"answer":"Done"}');
    const instance = agent();
    const result = await instance.runStructured("Answer", { schema: z.object({ answer: z.string() }) }, { model: "offline-model" });
    expect(result.structuredOutput).toEqual({ answer: "Done" });
    expect(result.usage).toMatchObject({ promptTokens: 41, completionTokens: 7, cost: 0.003 });
    expect(requests[0].max_tokens).toBe(123);
    instance.dispose();
  });

  it.each([false, true])("preserves native local refusal with explicit unsent evidence (stream=%s)", async stream => {
    const requests = transport(stream);
    const instance = agent();
    const malformed = [{ role: "system", content: 42 }] as unknown as Message[];
    let failure: unknown;
    try {
      if (stream) { for await (const _event of instance.streamWithContext(malformed, { model: "offline-model" })) { /* drain */ } }
      else await instance.runWithContext(malformed, { model: "offline-model" });
    } catch (error) { failure = error; }
    expect(AgentSDKError.is(failure)).toBe(true);
    expect(failure).toMatchObject({ code: "INVALID_INPUT", retryable: false, providerRequestSent: false });
    expect(InvalidPromptError.isInstance((failure as Error).cause)).toBe(true);
    expect(requests).toHaveLength(0);
    instance.dispose();
  });

  it.each([false, true])("does not label a native prompt error from HTTP transport as unsent (stream=%s)", async stream => {
    const native = new InvalidPromptError({ prompt: [], message: "Provider rejected prompt" });
    const fetch = vi.fn(async () => { throw native; });
    vi.stubGlobal("fetch", fetch);
    const instance = agent();
    let failure: unknown;
    try {
      if (stream) { for await (const _event of instance.stream("Answer", { model: "offline-model" })) { /* drain */ } }
      else await instance.run("Answer", { model: "offline-model" });
    } catch (error) { failure = error; }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(failure).toBe(native);
    expect(failure).not.toHaveProperty("providerRequestSent", false);
    instance.dispose();
  });

  it("proves structured prompt rejection is unsent", async () => {
    const requests = transport(false);
    const instance = createVercelAIService({ apiKey: "offline-key", baseUrl: "https://offline.invalid/v1" })
      .createAgent({ model: "offline-model", tools: [], systemPrompt: 42 as unknown as string });
    let failure: unknown;
    try { await instance.runStructured("Answer", { schema: z.object({ answer: z.string() }) }, { model: "offline-model" }); }
    catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: "INVALID_INPUT", providerRequestSent: false });
    expect(InvalidPromptError.isInstance((failure as Error).cause)).toBe(true);
    expect(requests).toHaveLength(0);
    instance.dispose();
  });

  it("observes dispatch separately when the cached model is reused", async () => {
    const requests = transport(false);
    const instance = agent();
    await instance.run("Valid", { model: "offline-model" });
    await expect(instance.runWithContext([{ role: "system", content: 42 }] as unknown as Message[],
      { model: "offline-model" })).rejects.toMatchObject({ code: "INVALID_INPUT", providerRequestSent: false });
    expect(requests).toHaveLength(1);
    instance.dispose();
  });
});
