/**
 * Tests for @witqq/agent-sdk/chat barrel export.
 * Verifies that commonly needed symbols resolve from the barrel.
 */

import { describe, it, expect } from "vitest";

describe("chat barrel export", () => {
  it("re-exports core types and utilities", async () => {
    const barrel = await import("../../../src/chat/index.js");

    // IDs
    expect(barrel.createChatId).toBeTypeOf("function");
    expect(barrel.toChatId).toBeTypeOf("function");

    // Type guards
    expect(barrel.isChatMessage).toBeTypeOf("function");
    expect(barrel.isChatSession).toBeTypeOf("function");
    expect(barrel.isMessagePart).toBeTypeOf("function");
    expect(barrel.isTextPart).toBeTypeOf("function");
    expect(barrel.isReasoningPart).toBeTypeOf("function");
    expect(barrel.isToolCallPart).toBeTypeOf("function");
    expect(barrel.isSourcePart).toBeTypeOf("function");
    expect(barrel.isFilePart).toBeTypeOf("function");
    expect(barrel.isChatEvent).toBeTypeOf("function");

    // Utilities
    expect(barrel.getMessageText).toBeTypeOf("function");
    expect(barrel.getMessageToolCalls).toBeTypeOf("function");
    expect(barrel.getMessageReasoning).toBeTypeOf("function");

    // Bridge
    expect(barrel.agentEventToChatEvent).toBeTypeOf("function");
    expect(barrel.adaptAgentEvents).toBeTypeOf("function");
    expect(barrel.toAgentMessage).toBeTypeOf("function");
    expect(barrel.toAgentMessages).toBeTypeOf("function");
    expect(barrel.fromAgentMessage).toBeTypeOf("function");
  });

  it("re-exports runtime factory", async () => {
    const barrel = await import("../../../src/chat/index.js");

    expect(barrel.createChatRuntime).toBeTypeOf("function");
  });

  it("re-exports session stores", async () => {
    const barrel = await import("../../../src/chat/index.js");

    expect(barrel.InMemorySessionStore).toBeTypeOf("function");
    expect(barrel.FileSessionStore).toBeTypeOf("function");
  });

  it("re-exports error utilities", async () => {
    const barrel = await import("../../../src/chat/index.js");

    expect(barrel.ChatError).toBeTypeOf("function");
    expect(barrel.ErrorCode).toBeDefined();
    expect(barrel.classifyError).toBeTypeOf("function");
    expect(barrel.isRetryable).toBeTypeOf("function");
    expect(barrel.withRetry).toBeTypeOf("function");
    expect(barrel.ExponentialBackoffStrategy).toBeTypeOf("function");
  });

  it("re-exports backend adapters", async () => {
    const barrel = await import("../../../src/chat/index.js");

    expect(barrel.BaseBackendAdapter).toBeTypeOf("function");
    expect(barrel.CopilotChatAdapter).toBeTypeOf("function");
    expect(barrel.ClaudeChatAdapter).toBeTypeOf("function");
    expect(barrel.VercelAIChatAdapter).toBeTypeOf("function");
    expect(barrel.MockLLMChatAdapter).toBeTypeOf("function");
    expect(barrel.SSEChatTransport).toBeTypeOf("function");
    expect(barrel.WsChatTransport).toBeTypeOf("function");
    expect(barrel.InProcessChatTransport).toBeTypeOf("function");
    expect(barrel.streamToTransport).toBeTypeOf("function");
  });

  it("re-exports context window manager", async () => {
    const barrel = await import("../../../src/chat/index.js");

    expect(barrel.ContextWindowManager).toBeTypeOf("function");
    expect(barrel.estimateTokens).toBeTypeOf("function");
  });

  it("re-exports accumulator", async () => {
    const barrel = await import("../../../src/chat/index.js");

    expect(barrel.MessageAccumulator).toBeTypeOf("function");
  });

  it("re-exports stream watchdog", async () => {
    const barrel = await import("../../../src/chat/index.js");

    expect(barrel.withStreamWatchdog).toBeTypeOf("function");
  });

  it("re-exports event utilities", async () => {
    const barrel = await import("../../../src/chat/index.js");

    expect(barrel.TypedEventEmitter).toBeTypeOf("function");
    expect(barrel.ChatEventBus).toBeTypeOf("function");
  });

  it("createChatId generates valid branded ID", async () => {
    const { createChatId, toChatId } = await import("../../../src/chat/index.js");

    const id = createChatId();
    expect(typeof id).toBe("string");
    // Should be accepted by toChatId without throwing
    expect(toChatId(id)).toBe(id);
  });
});
