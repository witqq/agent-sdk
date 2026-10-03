import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { InvalidPromptError } from "ai";
import { createVercelAIService, _resetSDK } from "../../src/backends/vercel-ai.js";
import { AgentSDKError } from "../../src/errors.js";
import type { AgentEvent, Message } from "../../src/types.js";

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
    { role: "assistant", content: "Collecting evidence", toolCalls: [
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

  it("preserves explicit SDK retry for a typed recoverable error and observes successful native usage", async () => {
    const original = new AgentSDKError("Offline timeout", { code: "TIMEOUT", retryable: true });
    const requests = transport(false, "Done", original);
    const instance = agent();
    const result = await instance.run("Answer", { model: "offline-model", retry: { maxRetries: 1, initialDelayMs: 0 } });
    expect(requests).toHaveLength(2);
    expect(result.output).toBe("Done");
    expect(result.usage).toMatchObject({ promptTokens: 41, completionTokens: 7, cost: 0.003 });
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
    expect(wire[1]).toMatchObject({ role: "assistant", content: "Collecting evidence", tool_calls: [
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
