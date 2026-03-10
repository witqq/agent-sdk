/**
 * Tests for usage tracking middleware.
 *
 * Verifies InMemoryUsageStore CRUD operations and the middleware's
 * event handling for token counting.
 */

import { describe, it, expect, vi } from "vitest";
import type { ChatEvent, ChatMiddlewareContext, ChatMessage, ChatId } from "../../../src/chat/core.js";
import { createChatId } from "../../../src/chat/core.js";
import {
  InMemoryUsageStore,
  createUsageMiddleware,
  type IUsageStore,
} from "../../../examples/usage-tracking/usage-middleware.js";

// ─── Helpers ───────────────────────────────────────────────────

function makeContext(sessionId?: ChatId): ChatMiddlewareContext {
  return {
    sessionId: sessionId ?? createChatId(),
    signal: new AbortController().signal,
  };
}

function makeMessage(role: "user" | "assistant" = "user"): ChatMessage {
  return {
    id: createChatId(),
    role,
    parts: [{ type: "text", text: "test", status: "complete" }],
    status: "complete",
    createdAt: new Date().toISOString(),
  };
}

// ─── InMemoryUsageStore ────────────────────────────────────────

describe("InMemoryUsageStore", () => {
  it("should return null for unknown session", async () => {
    const store = new InMemoryUsageStore();
    expect(await store.getUsage(createChatId())).toBeNull();
  });

  it("should record and retrieve usage", async () => {
    const store = new InMemoryUsageStore();
    const id = createChatId();

    await store.recordUsage(id, { promptTokens: 100, completionTokens: 50 });

    const usage = await store.getUsage(id);
    expect(usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      requestCount: 1,
    });
  });

  it("should accumulate usage across multiple records", async () => {
    const store = new InMemoryUsageStore();
    const id = createChatId();

    await store.recordUsage(id, { promptTokens: 100, completionTokens: 50 });
    await store.recordUsage(id, { promptTokens: 200, completionTokens: 80 });

    const usage = await store.getUsage(id);
    expect(usage!.promptTokens).toBe(300);
    expect(usage!.completionTokens).toBe(130);
    expect(usage!.totalTokens).toBe(430);
    expect(usage!.requestCount).toBe(2);
  });

  it("should track model and backend from latest record", async () => {
    const store = new InMemoryUsageStore();
    const id = createChatId();

    await store.recordUsage(id, { promptTokens: 10, completionTokens: 5, model: "gpt-4", backend: "copilot" });
    await store.recordUsage(id, { promptTokens: 10, completionTokens: 5, model: "gpt-5", backend: "vercel-ai" });

    const usage = await store.getUsage(id);
    expect(usage!.lastModel).toBe("gpt-5");
    expect(usage!.lastBackend).toBe("vercel-ai");
  });

  it("should compute total usage across sessions", async () => {
    const store = new InMemoryUsageStore();
    const id1 = createChatId();
    const id2 = createChatId();

    await store.recordUsage(id1, { promptTokens: 100, completionTokens: 50 });
    await store.recordUsage(id2, { promptTokens: 200, completionTokens: 80 });

    const total = await store.getTotalUsage();
    expect(total.promptTokens).toBe(300);
    expect(total.completionTokens).toBe(130);
    expect(total.totalTokens).toBe(430);
    expect(total.requestCount).toBe(2);
  });

  it("should list all sessions with usage", async () => {
    const store = new InMemoryUsageStore();
    await store.recordUsage(createChatId(), { promptTokens: 10, completionTokens: 5 });
    await store.recordUsage(createChatId(), { promptTokens: 20, completionTokens: 10 });

    const sessions = await store.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].usage.promptTokens).toBeDefined();
  });

  it("should clear all data", async () => {
    const store = new InMemoryUsageStore();
    await store.recordUsage(createChatId(), { promptTokens: 10, completionTokens: 5 });
    await store.clear();
    expect((await store.listSessions())).toHaveLength(0);
  });

  it("should return zero totals when empty", async () => {
    const store = new InMemoryUsageStore();
    const total = await store.getTotalUsage();
    expect(total.totalTokens).toBe(0);
    expect(total.requestCount).toBe(0);
  });
});

// ─── Usage Middleware ──────────────────────────────────────────

describe("createUsageMiddleware", () => {
  it("should record usage on done event", async () => {
    const store = new InMemoryUsageStore();
    const middleware = createUsageMiddleware(store);
    const sessionId = createChatId();
    const ctx = makeContext(sessionId);

    // Simulate request lifecycle
    middleware.onBeforeSend!(makeMessage(), ctx);

    // Usage event
    const usageEvent = { type: "usage", promptTokens: 100, completionTokens: 50 } as ChatEvent;
    middleware.onEvent!(usageEvent, ctx);

    // Done event triggers persistence
    const doneEvent = { type: "done" } as ChatEvent;
    middleware.onEvent!(doneEvent, ctx);

    // Wait for async store write
    await vi.waitFor(async () => {
      const usage = await store.getUsage(sessionId);
      expect(usage).not.toBeNull();
    });

    const usage = await store.getUsage(sessionId);
    expect(usage!.promptTokens).toBe(100);
    expect(usage!.completionTokens).toBe(50);
    expect(usage!.requestCount).toBe(1);
  });

  it("should record zero usage when no usage event before done", async () => {
    const store = new InMemoryUsageStore();
    const middleware = createUsageMiddleware(store);
    const sessionId = createChatId();
    const ctx = makeContext(sessionId);

    middleware.onBeforeSend!(makeMessage(), ctx);
    middleware.onEvent!({ type: "done" } as ChatEvent, ctx);

    await vi.waitFor(async () => {
      const usage = await store.getUsage(sessionId);
      expect(usage).not.toBeNull();
    });

    const usage = await store.getUsage(sessionId);
    expect(usage!.promptTokens).toBe(0);
    expect(usage!.requestCount).toBe(1);
  });

  it("should pass events through unchanged", () => {
    const store = new InMemoryUsageStore();
    const middleware = createUsageMiddleware(store);
    const ctx = makeContext();

    const textEvent = { type: "message:delta", text: "hello" } as ChatEvent;
    const result = middleware.onEvent!(textEvent, ctx);
    expect(result).toBe(textEvent);
  });

  it("should handle store errors gracefully", async () => {
    const failStore: IUsageStore = {
      getUsage: vi.fn().mockRejectedValue(new Error("db error")),
      recordUsage: vi.fn().mockRejectedValue(new Error("db error")),
      getTotalUsage: vi.fn().mockRejectedValue(new Error("db error")),
      listSessions: vi.fn().mockRejectedValue(new Error("db error")),
      clear: vi.fn().mockRejectedValue(new Error("db error")),
    };

    const middleware = createUsageMiddleware(failStore);
    const ctx = makeContext();

    middleware.onBeforeSend!(makeMessage(), ctx);
    middleware.onEvent!({ type: "usage", promptTokens: 10, completionTokens: 5 } as ChatEvent, ctx);

    // Should not throw
    expect(() => middleware.onEvent!({ type: "done" } as ChatEvent, ctx)).not.toThrow();
  });

  it("should accumulate usage across multiple requests to same session", async () => {
    const store = new InMemoryUsageStore();
    const middleware = createUsageMiddleware(store);
    const sessionId = createChatId();
    const ctx = makeContext(sessionId);

    // First request
    middleware.onBeforeSend!(makeMessage(), ctx);
    middleware.onEvent!({ type: "usage", promptTokens: 100, completionTokens: 50 } as ChatEvent, ctx);
    middleware.onEvent!({ type: "done" } as ChatEvent, ctx);

    // Second request
    middleware.onBeforeSend!(makeMessage(), ctx);
    middleware.onEvent!({ type: "usage", promptTokens: 200, completionTokens: 80 } as ChatEvent, ctx);
    middleware.onEvent!({ type: "done" } as ChatEvent, ctx);

    await vi.waitFor(async () => {
      const usage = await store.getUsage(sessionId);
      expect(usage!.requestCount).toBe(2);
    });

    const usage = await store.getUsage(sessionId);
    expect(usage!.promptTokens).toBe(300);
    expect(usage!.completionTokens).toBe(130);
    expect(usage!.totalTokens).toBe(430);
  });

  it("should track model from usage events", async () => {
    const store = new InMemoryUsageStore();
    const middleware = createUsageMiddleware(store);
    const sessionId = createChatId();
    const ctx = makeContext(sessionId);

    middleware.onBeforeSend!(makeMessage(), ctx);
    middleware.onEvent!(
      { type: "usage", promptTokens: 10, completionTokens: 5, model: "gpt-4" } as ChatEvent,
      ctx,
    );
    middleware.onEvent!({ type: "done" } as ChatEvent, ctx);

    await vi.waitFor(async () => {
      const usage = await store.getUsage(sessionId);
      expect(usage).not.toBeNull();
    });

    const usage = await store.getUsage(sessionId);
    expect(usage!.lastModel).toBe("gpt-4");
  });
});
