import { describe, it, expect } from "vitest";
import {
  createChatId,
  toChatId,
  isChatMessage,
  isChatSession,
  isMessagePart,
  isTextPart,
  isToolCallPart,
  isReasoningPart,
  isSourcePart,
  isFilePart,
  isChatEvent,
  agentEventToChatEvent,
  chatEventToAgentEvent,
  adaptAgentEvents,
  toAgentMessage,
  toAgentMessages,
  fromAgentMessage,
  getMessageText,
  getMessageToolCalls,
  getMessageReasoning,
  extractToolResults,
  type ChatId,
  type ChatMessage,
  type ChatSession,
  type MessagePart,
  type ChatEvent,
  type ChatRole,
  type MessageStatus,
} from "../../../src/chat/core.js";
import type { AgentEvent } from "../../../src/types.js";

// ─── createChatId ──────────────────────────────────────────────

describe("createChatId", () => {
  it("returns a string", () => {
    const id = createChatId();
    expect(typeof id).toBe("string");
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createChatId()));
    expect(ids.size).toBe(100);
  });

  it("returns UUID format", () => {
    const id = createChatId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

// ─── toChatId ──────────────────────────────────────────────────

describe("toChatId", () => {
  it("accepts valid UUID v4", () => {
    const id = toChatId("550e8400-e29b-41d4-a716-446655440000");
    expect(id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("accepts IDs from createChatId", () => {
    const created = createChatId();
    const casted = toChatId(created);
    expect(casted).toBe(created);
  });

  it("throws TypeError for invalid string", () => {
    expect(() => toChatId("not-a-uuid")).toThrow(TypeError);
    expect(() => toChatId("not-a-uuid")).toThrow("Invalid ChatId");
  });

  it("throws for empty string", () => {
    expect(() => toChatId("")).toThrow(TypeError);
  });

  it("throws for UUID-like but wrong version", () => {
    // UUID v1 (version digit is 1, not 4)
    expect(() => toChatId("550e8400-e29b-11d4-a716-446655440000")).toThrow(TypeError);
  });

  it("accepts uppercase hex", () => {
    const id = toChatId("550E8400-E29B-41D4-A716-446655440000");
    expect(id).toBe("550E8400-E29B-41D4-A716-446655440000");
  });
});

// ─── ChatIdLike ───────────────────────────────────────────────

describe("ChatIdLike", () => {
  it("plain string is assignable to ChatIdLike", () => {
    // This is a compile-time test: if it compiles, ChatIdLike accepts string
    const plainString = "my-session-id";
    const idLike: import("../../../src/chat/core.js").ChatIdLike = plainString;
    expect(idLike).toBe("my-session-id");
  });

  it("branded ChatId is assignable to ChatIdLike", () => {
    const branded = createChatId();
    const idLike: import("../../../src/chat/core.js").ChatIdLike = branded;
    expect(typeof idLike).toBe("string");
  });
});

// ─── Type Guards ───────────────────────────────────────────────

describe("isChatMessage", () => {
  const validMessage: ChatMessage = {
    id: createChatId(),
    role: "user",
    parts: [{ type: "text", text: "hello", status: "complete" }],
    createdAt: new Date().toISOString(),
    status: "complete",
  };

  it("returns true for valid ChatMessage", () => {
    expect(isChatMessage(validMessage)).toBe(true);
  });

  it("returns true for all roles", () => {
    const roles: ChatRole[] = ["user", "assistant", "system"];
    for (const role of roles) {
      expect(isChatMessage({ ...validMessage, role })).toBe(true);
    }
  });

  it("returns false for 'tool' role", () => {
    expect(isChatMessage({ ...validMessage, role: "tool" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isChatMessage(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isChatMessage("string")).toBe(false);
    expect(isChatMessage(42)).toBe(false);
  });

  it("returns false for missing id", () => {
    const { id: _, ...noId } = validMessage;
    expect(isChatMessage(noId)).toBe(false);
  });

  it("returns false for invalid role", () => {
    expect(isChatMessage({ ...validMessage, role: "unknown" })).toBe(false);
  });

  it("returns false for missing status", () => {
    const { status: _, ...noStatus } = validMessage;
    expect(isChatMessage(noStatus)).toBe(false);
  });

  it("returns false for missing parts array", () => {
    const { parts: _, ...noParts } = validMessage;
    expect(isChatMessage(noParts)).toBe(false);
  });
});

describe("isChatSession", () => {
  const validSession: ChatSession = {
    id: createChatId(),
    messages: [],
    config: { model: "gpt-4", backend: "vercel-ai" },
    metadata: { messageCount: 0, totalTokens: 0 },
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("returns true for valid ChatSession", () => {
    expect(isChatSession(validSession)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isChatSession(null)).toBe(false);
  });

  it("returns false for missing config", () => {
    const { config: _, ...noConfig } = validSession;
    expect(isChatSession(noConfig)).toBe(false);
  });

  it("returns false for missing updatedAt", () => {
    const { updatedAt: _, ...noUpdated } = validSession;
    expect(isChatSession(noUpdated)).toBe(false);
  });

  it("returns false for missing status", () => {
    const { status: _, ...noStatus } = validSession;
    expect(isChatSession(noStatus)).toBe(false);
  });
});

describe("isMessagePart", () => {
  it("returns true for text part", () => {
    expect(isMessagePart({ type: "text", text: "hello", status: "complete" })).toBe(true);
  });

  it("returns true for reasoning part", () => {
    expect(isMessagePart({ type: "reasoning", text: "hmm", status: "complete" })).toBe(true);
  });

  it("returns true for tool_call part", () => {
    expect(
      isMessagePart({
        type: "tool_call",
        toolCallId: "1",
        name: "test",
        args: {},
        status: "pending",
      }),
    ).toBe(true);
  });

  it("returns true for source part", () => {
    expect(
      isMessagePart({ type: "source", url: "https://example.com", title: "Source", status: "complete" }),
    ).toBe(true);
  });

  it("returns true for file part", () => {
    expect(
      isMessagePart({ type: "file", name: "test.png", mimeType: "image/png", data: "base64data", status: "complete" }),
    ).toBe(true);
  });

  it("returns false for unknown type", () => {
    expect(isMessagePart({ type: "unknown" })).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isMessagePart(null)).toBe(false);
    expect(isMessagePart("text")).toBe(false);
  });
});

describe("isTextPart", () => {
  it("returns true for text part", () => {
    expect(isTextPart({ type: "text", text: "hello", status: "complete" })).toBe(true);
  });

  it("returns false for non-text part", () => {
    expect(isTextPart({ type: "reasoning", text: "hmm", status: "complete" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTextPart(null)).toBe(false);
  });
});

describe("isToolCallPart", () => {
  it("returns true for tool_call part", () => {
    expect(isToolCallPart({ type: "tool_call", toolCallId: "1", name: "test", args: {}, status: "pending" })).toBe(true);
  });

  it("returns false for non-tool_call part", () => {
    expect(isToolCallPart({ type: "text", text: "hello", status: "complete" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isToolCallPart(null)).toBe(false);
  });
});

describe("isReasoningPart", () => {
  it("returns true for reasoning part", () => {
    expect(isReasoningPart({ type: "reasoning", text: "thinking...", status: "complete" })).toBe(true);
  });

  it("returns false for non-reasoning part", () => {
    expect(isReasoningPart({ type: "text", text: "hello", status: "complete" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isReasoningPart(null)).toBe(false);
  });
});

describe("isSourcePart", () => {
  it("returns true for source part", () => {
    expect(isSourcePart({ type: "source", url: "https://example.com", status: "complete" })).toBe(true);
  });

  it("returns false for non-source part", () => {
    expect(isSourcePart({ type: "text", text: "hello", status: "complete" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSourcePart(null)).toBe(false);
  });
});

describe("isFilePart", () => {
  it("returns true for file part", () => {
    expect(isFilePart({ type: "file", name: "test.png", mimeType: "image/png", data: "base64", status: "complete" })).toBe(true);
  });

  it("returns false for non-file part", () => {
    expect(isFilePart({ type: "text", text: "hello", status: "complete" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isFilePart(null)).toBe(false);
  });
});

describe("isChatEvent", () => {
  it("returns true for all valid event types", () => {
    const events: ChatEvent[] = [
      { type: "message:start", messageId: "x" as ChatId, role: "user" },
      { type: "message:delta", messageId: "x" as ChatId, text: "hi" },
      {
        type: "message:complete",
        messageId: "x" as ChatId,
        message: {
          id: "x" as ChatId,
          role: "assistant",
          parts: [{ type: "text", text: "hi", status: "complete" as const }],
          createdAt: "",
          status: "complete",
        },
      },
      {
        type: "tool:start",
        messageId: "x" as ChatId,
        toolCallId: "1",
        toolName: "t",
        args: {},
      },
      {
        type: "tool:complete",
        messageId: "x" as ChatId,
        toolCallId: "1",
        toolName: "t",
        result: null,
      },
      { type: "thinking:start", messageId: "x" as ChatId },
      { type: "thinking:delta", messageId: "x" as ChatId, text: "..." },
      { type: "thinking:end", messageId: "x" as ChatId },
      {
        type: "permission:request",
        messageId: "x" as ChatId,
        toolName: "t",
        toolArgs: {},
      },
      {
        type: "permission:response",
        messageId: "x" as ChatId,
        toolName: "t",
        allowed: true,
      },
      { type: "usage", promptTokens: 10, completionTokens: 20 },
      { type: "session:created", sessionId: "x" as ChatId },
      { type: "session:updated", sessionId: "x" as ChatId },
      { type: "error", error: "err", recoverable: true },
      { type: "typing:start" },
      { type: "typing:end" },
      { type: "heartbeat" },
      { type: "done" },
      { type: "done", finalOutput: "text" },
    ];

    for (const event of events) {
      expect(isChatEvent(event)).toBe(true);
    }
  });

  it("returns false for unknown type", () => {
    expect(isChatEvent({ type: "unknown_event" })).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isChatEvent(null)).toBe(false);
  });
});

// ─── getMessageText / getMessageToolCalls / getMessageReasoning ─

describe("getMessageText", () => {
  it("returns joined text from text parts", () => {
    const msg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        { type: "text", text: "hello ", status: "complete" },
        { type: "text", text: "world", status: "complete" },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    expect(getMessageText(msg)).toBe("hello world");
  });

  it("ignores non-text parts", () => {
    const msg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        { type: "text", text: "hello", status: "complete" },
        { type: "tool_call", toolCallId: "1", name: "test", args: {}, status: "complete" },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    expect(getMessageText(msg)).toBe("hello");
  });

  it("returns empty string for no text parts", () => {
    const msg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        { type: "tool_call", toolCallId: "1", name: "test", args: {}, status: "complete" },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    expect(getMessageText(msg)).toBe("");
  });
});

describe("getMessageToolCalls", () => {
  it("returns tool call parts", () => {
    const msg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        { type: "text", text: "hello", status: "complete" },
        { type: "tool_call", toolCallId: "tc1", name: "search", args: { q: "test" }, status: "complete" },
        { type: "tool_call", toolCallId: "tc2", name: "calc", args: {}, status: "pending" },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const toolCalls = getMessageToolCalls(msg);
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].name).toBe("search");
    expect(toolCalls[1].name).toBe("calc");
  });
});

describe("getMessageReasoning", () => {
  it("returns joined reasoning text", () => {
    const msg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        { type: "reasoning", text: "Let me think...", status: "complete" },
        { type: "text", text: "answer", status: "complete" },
        { type: "reasoning", text: " More thinking.", status: "complete" },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    expect(getMessageReasoning(msg)).toBe("Let me think... More thinking.");
  });
});

// ─── extractToolResults ────────────────────────────────────────

describe("extractToolResults", () => {
  it("extracts tool results from tool call parts", () => {
    const msg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        { type: "tool_call", toolCallId: "tc1", name: "search", args: {}, result: "found", status: "complete" },
        { type: "tool_call", toolCallId: "tc2", name: "calc", args: {}, status: "pending" },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const results = extractToolResults(msg);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ toolCallId: "tc1", name: "search", result: "found", isError: undefined });
  });

  it("marks error results", () => {
    const msg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        { type: "tool_call", toolCallId: "tc1", name: "search", args: {}, result: "error", status: "error", error: "failed" },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const results = extractToolResults(msg);
    expect(results[0].isError).toBe(true);
  });
});

// ─── agentEventToChatEvent ─────────────────────────────────────

describe("agentEventToChatEvent", () => {
  const msgId = "test-msg" as ChatId;

  it("maps text_delta", () => {
    const result = agentEventToChatEvent(
      { type: "text_delta", text: "hello" },
      msgId,
    );
    expect(result).toEqual({
      type: "message:delta",
      messageId: msgId,
      text: "hello",
    });
  });

  it("maps thinking_start", () => {
    const result = agentEventToChatEvent({ type: "thinking_start" }, msgId);
    expect(result).toEqual({ type: "thinking:start", messageId: msgId });
  });

  it("maps thinking_delta", () => {
    const result = agentEventToChatEvent(
      { type: "thinking_delta", text: "hmm" },
      msgId,
    );
    expect(result).toEqual({
      type: "thinking:delta",
      messageId: msgId,
      text: "hmm",
    });
  });

  it("maps thinking_end", () => {
    const result = agentEventToChatEvent({ type: "thinking_end" }, msgId);
    expect(result).toEqual({ type: "thinking:end", messageId: msgId });
  });

  it("maps tool_call_start", () => {
    const result = agentEventToChatEvent(
      {
        type: "tool_call_start",
        toolCallId: "tc1",
        toolName: "search",
        args: { q: "test" },
      },
      msgId,
    );
    expect(result).toEqual({
      type: "tool:start",
      messageId: msgId,
      toolCallId: "tc1",
      toolName: "search",
      args: { q: "test" },
    });
  });

  it("maps tool_call_end", () => {
    const result = agentEventToChatEvent(
      {
        type: "tool_call_end",
        toolCallId: "tc1",
        toolName: "search",
        result: "found",
      },
      msgId,
    );
    expect(result).toEqual({
      type: "tool:complete",
      messageId: msgId,
      toolCallId: "tc1",
      toolName: "search",
      result: "found",
    });
  });

  it("maps permission_request", () => {
    const result = agentEventToChatEvent(
      {
        type: "permission_request",
        request: { toolName: "bash", toolArgs: { cmd: "ls" } },
      },
      msgId,
    );
    expect(result).toEqual({
      type: "permission:request",
      messageId: msgId,
      toolName: "bash",
      toolArgs: { cmd: "ls" },
    });
  });

  it("maps permission_response", () => {
    const result = agentEventToChatEvent(
      {
        type: "permission_response",
        toolName: "bash",
        decision: { allowed: true, scope: "session" },
      },
      msgId,
    );
    expect(result).toEqual({
      type: "permission:response",
      messageId: msgId,
      toolName: "bash",
      allowed: true,
    });
  });

  it("maps usage_update", () => {
    const result = agentEventToChatEvent(
      {
        type: "usage_update",
        promptTokens: 100,
        completionTokens: 50,
        model: "gpt-4",
      },
      msgId,
    );
    expect(result).toEqual({
      type: "usage",
      promptTokens: 100,
      completionTokens: 50,
      model: "gpt-4",
    });
  });

  it("maps error", () => {
    const result = agentEventToChatEvent(
      { type: "error", error: "oops", recoverable: false },
      msgId,
    );
    expect(result).toEqual({
      type: "error",
      error: "oops",
      recoverable: false,
      messageId: msgId,
    });
  });

  it("maps heartbeat", () => {
    const result = agentEventToChatEvent({ type: "heartbeat" }, msgId);
    expect(result).toEqual({ type: "heartbeat" });
  });

  it("returns null for done", () => {
    const result = agentEventToChatEvent(
      { type: "done", finalOutput: "ok" },
      msgId,
    );
    expect(result).toBeNull();
  });

  it("returns null for ask_user", () => {
    const result = agentEventToChatEvent(
      { type: "ask_user", request: { question: "?" } },
      msgId,
    );
    expect(result).toBeNull();
  });

  it("returns null for ask_user_response", () => {
    const result = agentEventToChatEvent(
      { type: "ask_user_response", answer: "yes" },
      msgId,
    );
    expect(result).toBeNull();
  });

  it("returns null for session_info", () => {
    const result = agentEventToChatEvent(
      { type: "session_info", sessionId: "s1", backend: "copilot" },
      msgId,
    );
    expect(result).toBeNull();
  });
});

// ─── adaptAgentEvents ──────────────────────────────────────────

describe("adaptAgentEvents", () => {
  it("converts stream of AgentEvents to ChatEvents", async () => {
    const msgId = "stream-msg" as ChatId;
    async function* agentEvents(): AsyncIterable<AgentEvent> {
      yield { type: "text_delta", text: "hello " };
      yield { type: "text_delta", text: "world" };
      yield { type: "done", finalOutput: "hello world" };
    }

    const chatEvents: ChatEvent[] = [];
    for await (const event of adaptAgentEvents(agentEvents(), msgId)) {
      chatEvents.push(event);
    }

    expect(chatEvents).toHaveLength(2);
    expect(chatEvents[0]).toEqual({
      type: "message:delta",
      messageId: msgId,
      text: "hello ",
    });
    expect(chatEvents[1]).toEqual({
      type: "message:delta",
      messageId: msgId,
      text: "world",
    });
  });

  it("filters out unmappable events", async () => {
    const msgId = "filter-msg" as ChatId;
    async function* agentEvents(): AsyncIterable<AgentEvent> {
      yield { type: "session_info", sessionId: "s1", backend: "copilot" };
      yield { type: "text_delta", text: "hi" };
      yield { type: "ask_user", request: { question: "?" } };
      yield { type: "heartbeat" };
    }

    const chatEvents: ChatEvent[] = [];
    for await (const event of adaptAgentEvents(agentEvents(), msgId)) {
      chatEvents.push(event);
    }

    expect(chatEvents).toHaveLength(2);
    expect(chatEvents[0].type).toBe("message:delta");
    expect(chatEvents[1].type).toBe("heartbeat");
  });
});

// ─── toAgentMessage / fromAgentMessage ─────────────────────────

describe("toAgentMessage", () => {
  it("converts user message", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "user",
      parts: [{ type: "text", text: "hello", status: "complete" }],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const agentMsg = toAgentMessage(chatMsg);
    expect(agentMsg).toEqual({ role: "user", content: "hello" });
  });

  it("converts assistant message with tool calls", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        { type: "text", text: "I'll search for that.", status: "complete" },
        { type: "tool_call", toolCallId: "tc1", name: "search", args: "query", status: "complete" },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const agentMsg = toAgentMessage(chatMsg);
    expect(agentMsg.role).toBe("assistant");
    expect(agentMsg.content).toBe("I'll search for that.");
    if (agentMsg.role === "assistant") {
      expect(agentMsg.toolCalls).toEqual([
        { id: "tc1", name: "search", args: "query" },
      ]);
    }
  });

  it("converts system message", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "system",
      parts: [{ type: "text", text: "You are a helpful assistant.", status: "complete" }],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const agentMsg = toAgentMessage(chatMsg);
    expect(agentMsg).toEqual({
      role: "system",
      content: "You are a helpful assistant.",
    });
  });

  it("extracts text from multiple text parts", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "user",
      parts: [
        { type: "text", text: "hello ", status: "complete" },
        { type: "source", url: "https://example.com", status: "complete" },
        { type: "text", text: "world", status: "complete" },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const agentMsg = toAgentMessage(chatMsg);
    expect(agentMsg).toEqual({ role: "user", content: "hello world" });
  });
});

// ─── toAgentMessages (plural — preserves tool results) ─────────

describe("toAgentMessages", () => {
  it("returns single message for user", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "user",
      parts: [{ type: "text", text: "hello", status: "complete" }],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const msgs = toAgentMessages(chatMsg);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({ role: "user", content: "hello" });
  });

  it("returns single message for system", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "system",
      parts: [{ type: "text", text: "You are a bot.", status: "complete" }],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const msgs = toAgentMessages(chatMsg);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({ role: "system", content: "You are a bot." });
  });

  it("returns single message for assistant without tool calls", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [{ type: "text", text: "Here is the answer.", status: "complete" }],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const msgs = toAgentMessages(chatMsg);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({ role: "assistant", content: "Here is the answer." });
  });

  it("returns single message for assistant with pending tool calls (no results)", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        { type: "tool_call", toolCallId: "tc1", name: "search", args: { q: "test" }, status: "running" },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const msgs = toAgentMessages(chatMsg);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("assistant");
    if (msgs[0].role === "assistant") {
      expect(msgs[0].toolCalls).toHaveLength(1);
    }
  });

  it("returns two messages for assistant with completed tool calls (with results)", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        { type: "text", text: "Let me search.", status: "complete" },
        {
          type: "tool_call",
          toolCallId: "tc1",
          name: "search",
          args: { q: "weather" },
          result: "Sunny, 25°C",
          status: "complete",
        },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const msgs = toAgentMessages(chatMsg);
    expect(msgs).toHaveLength(2);

    // First: assistant with toolCalls
    expect(msgs[0].role).toBe("assistant");
    if (msgs[0].role === "assistant") {
      expect(msgs[0].content).toBe("Let me search.");
      expect(msgs[0].toolCalls).toEqual([
        { id: "tc1", name: "search", args: { q: "weather" } },
      ]);
    }

    // Second: tool with toolResults
    expect(msgs[1].role).toBe("tool");
    if (msgs[1].role === "tool") {
      expect(msgs[1].toolResults).toEqual([
        { toolCallId: "tc1", name: "search", result: "Sunny, 25°C", isError: undefined },
      ]);
    }
  });

  it("handles multiple tool calls with results", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        {
          type: "tool_call",
          toolCallId: "tc1",
          name: "search",
          args: { q: "a" },
          result: "result-a",
          status: "complete",
        },
        {
          type: "tool_call",
          toolCallId: "tc2",
          name: "calc",
          args: { expr: "1+1" },
          result: "2",
          status: "complete",
        },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const msgs = toAgentMessages(chatMsg);
    expect(msgs).toHaveLength(2);

    if (msgs[0].role === "assistant") {
      expect(msgs[0].toolCalls).toHaveLength(2);
    }
    if (msgs[1].role === "tool") {
      expect(msgs[1].toolResults).toHaveLength(2);
      expect(msgs[1].toolResults[0].toolCallId).toBe("tc1");
      expect(msgs[1].toolResults[1].toolCallId).toBe("tc2");
    }
  });

  it("marks errored tool calls with isError", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        {
          type: "tool_call",
          toolCallId: "tc1",
          name: "search",
          args: {},
          result: "Error: timeout",
          status: "error",
        },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    const msgs = toAgentMessages(chatMsg);
    expect(msgs).toHaveLength(2);
    if (msgs[1].role === "tool") {
      expect(msgs[1].toolResults[0].isError).toBe(true);
    }
  });

  it("round-trips: fromAgentMessage → toAgentMessages preserves tool results", () => {
    // Start with agent-level messages (tool call + result)
    const assistantMsg = {
      role: "assistant" as const,
      content: "Calling tool",
      toolCalls: [{ id: "tc1", name: "search", args: { q: "test" } as const }],
    };
    const toolMsg = {
      role: "tool" as const,
      toolResults: [{ toolCallId: "tc1", name: "search", result: "found it" as const }],
    };

    // Convert to ChatMessage (fromAgentMessage merges tool results into assistant)
    const chatAssistant = fromAgentMessage(assistantMsg);
    const chatTool = fromAgentMessage(toolMsg);

    // The chat layer stores tool results on the assistant-role message
    // Merge them (simulating what accumulator does in practice)
    const mergedChat: ChatMessage = {
      ...chatAssistant,
      parts: [
        ...chatAssistant.parts,
        ...chatTool.parts.filter(p => p.type === "tool_call" && "result" in p),
      ],
    };

    // Now convert back — tool results should be preserved
    const agentMsgs = toAgentMessages(mergedChat);
    // Should have the tool_call parts from chatTool with results
    const toolResultMsgs = agentMsgs.filter(m => m.role === "tool");
    expect(toolResultMsgs.length).toBeGreaterThanOrEqual(1);
    if (toolResultMsgs[0].role === "tool") {
      expect(toolResultMsgs[0].toolResults[0].result).toBe("found it");
    }
  });

  it("toAgentMessage (deprecated) returns first message", () => {
    const chatMsg: ChatMessage = {
      id: createChatId(),
      role: "assistant",
      parts: [
        {
          type: "tool_call",
          toolCallId: "tc1",
          name: "search",
          args: {},
          result: "data",
          status: "complete",
        },
      ],
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    // Deprecated toAgentMessage returns first message (assistant)
    const msg = toAgentMessage(chatMsg);
    expect(msg.role).toBe("assistant");
  });
});

describe("fromAgentMessage", () => {
  it("converts user message", () => {
    const agentMsg = { role: "user" as const, content: "hello" };
    const chatMsg = fromAgentMessage(agentMsg);
    expect(chatMsg.role).toBe("user");
    expect(getMessageText(chatMsg)).toBe("hello");
    expect(chatMsg.status).toBe("complete");
    expect(chatMsg.id).toBeTruthy();
    expect(chatMsg.createdAt).toBeTruthy();
  });

  it("converts assistant message with tool calls", () => {
    const agentMsg = {
      role: "assistant" as const,
      content: "result",
      toolCalls: [{ id: "tc1", name: "test", args: "data" as const }],
    };
    const chatMsg = fromAgentMessage(agentMsg);
    expect(chatMsg.role).toBe("assistant");
    const toolCalls = getMessageToolCalls(chatMsg);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].toolCallId).toBe("tc1");
    expect(toolCalls[0].name).toBe("test");
    expect(toolCalls[0].args).toBe("data");
  });

  it("converts tool message to assistant with tool results", () => {
    const agentMsg = {
      role: "tool" as const,
      toolResults: [
        { toolCallId: "tc1", name: "test", result: "ok" as const },
      ],
    };
    const chatMsg = fromAgentMessage(agentMsg);
    expect(chatMsg.role).toBe("assistant");
    const toolCalls = getMessageToolCalls(chatMsg);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].toolCallId).toBe("tc1");
    expect(toolCalls[0].result).toBe("ok");
  });

  it("uses provided id", () => {
    const id = "custom-id" as ChatId;
    const chatMsg = fromAgentMessage(
      { role: "user", content: "hi" },
      id,
    );
    expect(chatMsg.id).toBe(id);
  });

  it("generates id when not provided", () => {
    const chatMsg = fromAgentMessage({ role: "user", content: "hi" });
    expect(chatMsg.id).toBeTruthy();
    expect(chatMsg.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

// ─── MessageStatus type check ──────────────────────────────────

describe("MessageStatus", () => {
  it("covers all valid statuses", () => {
    const statuses: MessageStatus[] = [
      "pending",
      "streaming",
      "complete",
      "error",
      "cancelled",
    ];
    for (const status of statuses) {
      const msg: ChatMessage = {
        id: createChatId(),
        role: "user",
        parts: [{ type: "text", text: "test", status: "complete" }],
        createdAt: new Date().toISOString(),
        status,
      };
      expect(isChatMessage(msg)).toBe(true);
    }
  });
});

// ─── ChatMiddleware ────────────────────────────────────────────

describe("ChatMiddleware", () => {
  it("compiles with all hooks defined", () => {
    const mw: import("../../../src/chat/core.js").ChatMiddleware = {
      onBeforeSend: (msg) => msg,
      onEvent: (event) => event,
      onAfterReceive: (msg) => msg,
      onError: (err) => err,
    };
    expect(mw).toBeDefined();
    expect(mw.onBeforeSend).toBeTypeOf("function");
    expect(mw.onEvent).toBeTypeOf("function");
    expect(mw.onAfterReceive).toBeTypeOf("function");
    expect(mw.onError).toBeTypeOf("function");
  });

  it("compiles with no hooks (all optional)", () => {
    const mw: import("../../../src/chat/core.js").ChatMiddleware = {};
    expect(mw).toBeDefined();
  });

  it("ChatMiddlewareContext has required fields", () => {
    const ctx: import("../../../src/chat/core.js").ChatMiddlewareContext = {
      sessionId: "test-session",
      signal: AbortSignal.abort(),
    };
    expect(ctx.sessionId).toBe("test-session");
    expect(ctx.signal).toBeInstanceOf(AbortSignal);
  });
});

// ─── chatEventToAgentEvent ─────────────────────────────────────

describe("chatEventToAgentEvent", () => {
  const msgId = createChatId();

  it("converts message:delta to text_delta", () => {
    const result = chatEventToAgentEvent({ type: "message:delta", messageId: msgId, text: "hello" });
    expect(result).toEqual({ type: "text_delta", text: "hello" });
  });

  it("converts thinking:start to thinking_start", () => {
    const result = chatEventToAgentEvent({ type: "thinking:start", messageId: msgId });
    expect(result).toEqual({ type: "thinking_start" });
  });

  it("converts thinking:delta to thinking_delta", () => {
    const result = chatEventToAgentEvent({ type: "thinking:delta", messageId: msgId, text: "hmm" });
    expect(result).toEqual({ type: "thinking_delta", text: "hmm" });
  });

  it("converts thinking:end to thinking_end", () => {
    const result = chatEventToAgentEvent({ type: "thinking:end", messageId: msgId });
    expect(result).toEqual({ type: "thinking_end" });
  });

  it("converts tool:start to tool_call_start", () => {
    const result = chatEventToAgentEvent({
      type: "tool:start", messageId: msgId,
      toolCallId: "tc1", toolName: "search", args: { q: "test" },
    });
    expect(result).toEqual({
      type: "tool_call_start", toolCallId: "tc1", toolName: "search", args: { q: "test" },
    });
  });

  it("converts tool:complete to tool_call_end", () => {
    const result = chatEventToAgentEvent({
      type: "tool:complete", messageId: msgId,
      toolCallId: "tc1", toolName: "search", result: "found",
    });
    expect(result).toEqual({
      type: "tool_call_end", toolCallId: "tc1", toolName: "search", result: "found",
    });
  });

  it("converts error to error event", () => {
    const result = chatEventToAgentEvent({
      type: "error", messageId: msgId, error: "fail", recoverable: false,
    });
    expect(result).toMatchObject({ type: "error", recoverable: false });
  });

  it("returns null for heartbeat", () => {
    expect(chatEventToAgentEvent({ type: "heartbeat" })).toBeNull();
  });

  it("returns null for usage", () => {
    expect(chatEventToAgentEvent({
      type: "usage", promptTokens: 10, completionTokens: 5, model: "gpt-4",
    })).toBeNull();
  });

  it("returns null for message:start", () => {
    expect(chatEventToAgentEvent({ type: "message:start", messageId: msgId, role: "assistant" })).toBeNull();
  });

  it("returns null for message:complete", () => {
    const msg: ChatMessage = {
      id: msgId, role: "assistant", parts: [], status: "complete",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    expect(chatEventToAgentEvent({ type: "message:complete", messageId: msgId, message: msg })).toBeNull();
  });

  it("returns null for permission events", () => {
    expect(chatEventToAgentEvent({
      type: "permission:request", messageId: msgId, toolName: "x", toolArgs: {},
    })).toBeNull();
    expect(chatEventToAgentEvent({
      type: "permission:response", messageId: msgId, toolName: "x", allowed: true,
    })).toBeNull();
  });
});
