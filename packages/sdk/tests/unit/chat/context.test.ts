import { describe, it, expect, vi } from "vitest";

import {
  estimateTokens,
  ContextWindowManager,
  type ContextWindowConfig,
} from "../../../src/chat/context.js";
import type { ChatMessage, ChatId } from "../../../src/chat/core.js";
import { createChatId, getMessageText } from "../../../src/chat/core.js";

// ─── Test helpers ──────────────────────────────────────────────

function msg(
  role: ChatMessage["role"],
  content: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: createChatId(),
    role,
    parts: [{ type: "text" as const, text: content, status: "complete" as const }],
    createdAt: new Date().toISOString(),
    status: "complete",
    ...overrides,
  };
}

function systemMsg(content: string): ChatMessage {
  return msg("system", content);
}

function userMsg(content: string): ChatMessage {
  return msg("user", content);
}

function assistantMsg(content: string): ChatMessage {
  return msg("assistant", content);
}

// ─── estimateTokens ────────────────────────────────────────────

describe("estimateTokens", () => {
  it("estimates tokens for a simple text message", () => {
    const m = msg("user", "Hello, world!");
    const tokens = estimateTokens(m);
    expect(tokens).toBeGreaterThan(0);
    // "user" (4) + 4 overhead + "Hello, world!" (13) = 21 chars / 4 = 6 tokens
    expect(tokens).toBe(Math.ceil(21 / 4));
  });

  it("uses configurable charsPerToken ratio", () => {
    const m = msg("user", "Hello, world!");
    const t3 = estimateTokens(m, { charsPerToken: 3 });
    const t4 = estimateTokens(m, { charsPerToken: 4 });
    expect(t3).toBeGreaterThan(t4);
  });

  it("counts content parts (text, reasoning)", () => {
    const m = msg("assistant", "", {
      parts: [
        { type: "text", text: "Response text here", status: "complete" as const },
        { type: "reasoning", text: "Let me think about this...", status: "complete" as const },
      ],
    });
    const tokens = estimateTokens(m);
    expect(tokens).toBeGreaterThan(0);
    // Should count both text and reasoning
    const expectedChars =
      "assistant".length + 4 + "Response text here".length + "Let me think about this...".length;
    expect(tokens).toBe(Math.ceil(expectedChars / 4));
  });

  it("counts tool call parts", () => {
    const m = msg("assistant", "Using tool", {
      parts: [
        { type: "text", text: "Using tool", status: "complete" as const },
        { type: "tool_call", toolCallId: "tc1", name: "search", args: { query: "test" }, status: "complete" as const },
      ],
    });
    const withTools = estimateTokens(m);
    const withoutTools = estimateTokens(msg("assistant", "Using tool"));
    expect(withTools).toBeGreaterThan(withoutTools);
  });

  it("counts tool call parts with results", () => {
    const m = msg("assistant", "", {
      parts: [
        { type: "tool_call", toolCallId: "tc1", name: "search", args: {}, result: { data: [1, 2, 3] }, status: "complete" as const },
      ],
    });
    const tokens = estimateTokens(m);
    expect(tokens).toBeGreaterThan(0);
  });

  it("handles empty content", () => {
    const m = msg("user", "");
    const tokens = estimateTokens(m);
    // Role overhead only: "user" (4) + 4 = 8 chars / 4 = 2 tokens
    expect(tokens).toBe(2);
  });

  it("handles source content parts", () => {
    const m = msg("assistant", "", {
      parts: [
        { type: "source", url: "https://en.wikipedia.org", title: "Wikipedia", status: "complete" } as const,
      ],
    });
    const tokens = estimateTokens(m);
    expect(tokens).toBeGreaterThan(0);
  });

  it("handles tool_call content parts", () => {
    const m = msg("assistant", "", {
      parts: [
        {
          type: "tool_call" as const,
          toolCallId: "tc1",
          name: "search",
          args: { query: "test" },
          status: "complete" as const,
        },
      ],
    });
    const tokens = estimateTokens(m);
    expect(tokens).toBeGreaterThan(0);
  });
});

// ─── ContextWindowManager ──────────────────────────────────────

describe("ContextWindowManager", () => {
  describe("constructor and properties", () => {
    it("exposes available budget", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 4096,
        reservedTokens: 500,
      });
      expect(mgr.availableBudget).toBe(3596);
    });

    it("defaults reservedTokens to 0", () => {
      const mgr = new ContextWindowManager({ maxTokens: 4096 });
      expect(mgr.availableBudget).toBe(4096);
    });

    it("handles budget of 0", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 100,
        reservedTokens: 100,
      });
      expect(mgr.availableBudget).toBe(0);
    });

    it("clamps negative budget to 0", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 100,
        reservedTokens: 200,
      });
      expect(mgr.availableBudget).toBe(0);
    });
  });

  describe("estimateMessageTokens", () => {
    it("delegates to estimateTokens with config", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 4096,
        estimation: { charsPerToken: 3 },
      });
      const m = userMsg("Hello");
      expect(mgr.estimateMessageTokens(m)).toBe(
        estimateTokens(m, { charsPerToken: 3 }),
      );
    });
  });

  describe("fitMessages — all fit", () => {
    it("returns all messages when they fit", () => {
      const mgr = new ContextWindowManager({ maxTokens: 10000 });
      const messages = [userMsg("Hi"), assistantMsg("Hello!")];
      const result = mgr.fitMessages(messages);
      expect(result.messages).toHaveLength(2);
      expect(result.removedCount).toBe(0);
      expect(result.wasTruncated).toBe(false);
    });

    it("handles empty messages array", () => {
      const mgr = new ContextWindowManager({ maxTokens: 4096 });
      const result = mgr.fitMessages([]);
      expect(result.messages).toEqual([]);
      expect(result.totalTokens).toBe(0);
      expect(result.removedCount).toBe(0);
      expect(result.wasTruncated).toBe(false);
    });
  });

  // ── Truncate Oldest Strategy ──

  describe("truncate-oldest strategy", () => {
    it("removes oldest non-system messages first", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 14,
        strategy: "truncate-oldest",
      });
      const messages = [
        userMsg("First message"),
        assistantMsg("Second message"),
        userMsg("Third message"),
        assistantMsg("Fourth message"),
      ];
      const result = mgr.fitMessages(messages);
      expect(result.wasTruncated).toBe(true);
      expect(result.removedCount).toBeGreaterThan(0);
      // Latest messages should be kept
      const lastKept = result.messages[result.messages.length - 1];
      expect(getMessageText(lastKept)).toBe("Fourth message");
    });

    it("always preserves system messages", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 20,
        strategy: "truncate-oldest",
      });
      const sys = systemMsg("You are a helpful assistant");
      const messages = [
        sys,
        userMsg("First"),
        assistantMsg("Second"),
        userMsg("Third"),
        assistantMsg("Fourth"),
      ];
      const result = mgr.fitMessages(messages);
      expect(result.messages.some((m) => m.role === "system")).toBe(true);
      expect(
        getMessageText(result.messages.find((m) => m.role === "system")!),
      ).toBe("You are a helpful assistant");
    });

    it("preserves message order", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 30,
        strategy: "truncate-oldest",
      });
      const messages = [
        systemMsg("System prompt"),
        userMsg("Q1"),
        assistantMsg("A1"),
        userMsg("Q2"),
        assistantMsg("A2"),
      ];
      const result = mgr.fitMessages(messages);
      // Verify order is preserved
      for (let i = 1; i < result.messages.length; i++) {
        const prevIdx = messages.indexOf(result.messages[i - 1]);
        const currIdx = messages.indexOf(result.messages[i]);
        expect(currIdx).toBeGreaterThan(prevIdx);
      }
    });

    it("is the default strategy", () => {
      const mgr = new ContextWindowManager({ maxTokens: 10 });
      const messages = [
        userMsg("First message here"),
        assistantMsg("Second message here"),
        userMsg("Third"),
      ];
      const result = mgr.fitMessages(messages);
      expect(result.wasTruncated).toBe(true);
      // Should behave like truncate-oldest
      const lastKept = result.messages[result.messages.length - 1];
      expect(getMessageText(lastKept)).toBe("Third");
    });
  });

  // ── Sliding Window Strategy ──

  describe("sliding-window strategy", () => {
    it("keeps most recent messages that fit", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 10,
        strategy: "sliding-window",
      });
      const messages = [
        userMsg("First message"),
        assistantMsg("Second message"),
        userMsg("Third"),
      ];
      const result = mgr.fitMessages(messages);
      expect(result.wasTruncated).toBe(true);
      expect(getMessageText(result.messages[result.messages.length - 1])).toBe(
        "Third",
      );
    });

    it("stops adding when next message doesn't fit", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 15,
        strategy: "sliding-window",
      });
      const messages = [
        userMsg("A".repeat(100)),
        userMsg("B".repeat(100)),
        userMsg("Short"),
      ];
      const result = mgr.fitMessages(messages);
      expect(result.messages).toHaveLength(1);
      expect(getMessageText(result.messages[0])).toBe("Short");
    });

    it("does not preserve system messages (pure recency)", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 15,
        strategy: "sliding-window",
      });
      const messages = [
        systemMsg("System"),
        userMsg("A".repeat(100)),
        userMsg("Recent"),
      ];
      const result = mgr.fitMessages(messages);
      // System message at index 0 may be dropped
      expect(result.messages.every((m) => getMessageText(m) !== "A".repeat(100))).toBe(
        true,
      );
    });
  });

  // ── Summarize Placeholder Strategy ──

  describe("summarize-placeholder strategy", () => {
    it("replaces removed messages with placeholder", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 15,
        strategy: "summarize-placeholder",
      });
      const messages = [
        userMsg("First message"),
        assistantMsg("Second message"),
        userMsg("Third"),
        assistantMsg("Fourth"),
      ];
      const result = mgr.fitMessages(messages);
      expect(result.wasTruncated).toBe(true);
      const placeholder = result.messages.find(
        (m) => (m.metadata as Record<string, unknown>)?.isSummary === true,
      );
      expect(placeholder).toBeTruthy();
      expect(getMessageText(placeholder!)).toMatch(/omitted for context window/);
    });

    it("preserves system messages before placeholder", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 25,
        strategy: "summarize-placeholder",
      });
      const messages = [
        systemMsg("System prompt"),
        userMsg("First"),
        assistantMsg("Second"),
        userMsg("Third"),
      ];
      const result = mgr.fitMessages(messages);
      expect(result.messages[0].role).toBe("system");
      expect(getMessageText(result.messages[0])).toBe("System prompt");
    });

    it("includes removed count in placeholder text", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 30,
        strategy: "summarize-placeholder",
      });
      const messages = [
        userMsg("A".repeat(50)),
        userMsg("B".repeat(50)),
        userMsg("Short"),
      ];
      const result = mgr.fitMessages(messages);
      const placeholder = result.messages.find(
        (m) => (m.metadata as Record<string, unknown>)?.isSummary === true,
      );
      expect(placeholder).toBeTruthy();
      expect(getMessageText(placeholder!)).toMatch(/\d+ earlier message/);
    });

    it("uses singular for 1 removed message", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 30,
        strategy: "summarize-placeholder",
      });
      const messages = [
        userMsg("A".repeat(100)),
        userMsg("Short"),
      ];
      const result = mgr.fitMessages(messages);
      const placeholder = result.messages.find(
        (m) => (m.metadata as Record<string, unknown>)?.isSummary === true,
      );
      if (placeholder && result.removedCount === 1) {
        expect(getMessageText(placeholder)).toMatch(/1 earlier message omitted/);
        expect(getMessageText(placeholder)).not.toMatch(/messages/);
      }
    });
  });

  // ── Edge Cases ──

  describe("edge cases", () => {
    it("handles single message that exceeds budget", () => {
      const mgr = new ContextWindowManager({ maxTokens: 5 });
      const messages = [userMsg("A".repeat(1000))];
      const result = mgr.fitMessages(messages);
      // With truncate-oldest, a single non-system message that doesn't fit
      // will be excluded (budget exceeded)
      expect(result.wasTruncated).toBe(true);
    });

    it("handles single message that fits", () => {
      const mgr = new ContextWindowManager({ maxTokens: 10000 });
      const messages = [userMsg("Hello")];
      const result = mgr.fitMessages(messages);
      expect(result.messages).toHaveLength(1);
      expect(result.wasTruncated).toBe(false);
    });

    it("handles only system messages", () => {
      const mgr = new ContextWindowManager({ maxTokens: 10000 });
      const messages = [systemMsg("Prompt 1"), systemMsg("Prompt 2")];
      const result = mgr.fitMessages(messages);
      expect(result.messages).toHaveLength(2);
      expect(result.wasTruncated).toBe(false);
    });

    it("works with reservedTokens consuming most budget", () => {
      const mgr = new ContextWindowManager({
        maxTokens: 100,
        reservedTokens: 95,
      });
      const messages = [userMsg("A".repeat(100))];
      const result = mgr.fitMessages(messages);
      expect(result.wasTruncated).toBe(true);
    });

    it("returns copy of messages array (not same reference)", () => {
      const mgr = new ContextWindowManager({ maxTokens: 10000 });
      const messages = [userMsg("Hi")];
      const result = mgr.fitMessages(messages);
      expect(result.messages).not.toBe(messages);
    });
  });

  // ── fitMessagesAsync ──

  describe("fitMessagesAsync", () => {
    it("produces custom summary from async summarizer", async () => {
      const summarizer = async (removed: readonly ChatMessage[]) =>
        `Summary of ${removed.length} messages: ${removed.map(m => getMessageText(m)).join(", ")}`;
      const mgr = new ContextWindowManager({
        maxTokens: 15,
        strategy: "summarize-placeholder",
        summarizer,
      });
      const messages = [
        userMsg("First message"),
        assistantMsg("Second message"),
        userMsg("Third"),
        assistantMsg("Fourth"),
      ];
      const result = await mgr.fitMessagesAsync(messages);
      expect(result.wasTruncated).toBe(true);
      const placeholder = result.messages.find(
        (m) => (m.metadata as Record<string, unknown>)?.isSummary === true,
      );
      expect(placeholder).toBeTruthy();
      expect(getMessageText(placeholder!)).toMatch(/^Summary of /);
      expect(getMessageText(placeholder!)).not.toMatch(/omitted for context window/);
    });

    it("falls back to static placeholder when no summarizer configured", async () => {
      const mgr = new ContextWindowManager({
        maxTokens: 15,
        strategy: "summarize-placeholder",
      });
      const messages = [
        userMsg("First message"),
        assistantMsg("Second message"),
        userMsg("Third"),
        assistantMsg("Fourth"),
      ];
      const result = await mgr.fitMessagesAsync(messages);
      expect(result.wasTruncated).toBe(true);
      const placeholder = result.messages.find(
        (m) => (m.metadata as Record<string, unknown>)?.isSummary === true,
      );
      expect(placeholder).toBeTruthy();
      expect(getMessageText(placeholder!)).toMatch(/omitted for context window/);
    });

    it("falls back to static placeholder when summarizer throws", async () => {
      const summarizer = async () => { throw new Error("LLM unavailable"); };
      const mgr = new ContextWindowManager({
        maxTokens: 15,
        strategy: "summarize-placeholder",
        summarizer,
      });
      const messages = [
        userMsg("First message"),
        assistantMsg("Second message"),
        userMsg("Third"),
      ];
      const result = await mgr.fitMessagesAsync(messages);
      expect(result.wasTruncated).toBe(true);
      const placeholder = result.messages.find(
        (m) => (m.metadata as Record<string, unknown>)?.isSummary === true,
      );
      expect(placeholder).toBeTruthy();
      expect(getMessageText(placeholder!)).toMatch(/omitted for context window/);
    });

    it("behaves like fitMessages for non-summarize strategies", async () => {
      const summarizer = vi.fn(async () => "should not be called");
      const mgr = new ContextWindowManager({
        maxTokens: 10,
        strategy: "truncate-oldest",
        summarizer,
      });
      const messages = [
        userMsg("First message"),
        assistantMsg("Second message"),
        userMsg("Third"),
      ];
      const result = await mgr.fitMessagesAsync(messages);
      expect(result.wasTruncated).toBe(true);
      expect(summarizer).not.toHaveBeenCalled();
    });

    it("returns sync result when all messages fit", async () => {
      const summarizer = vi.fn(async () => "should not be called");
      const mgr = new ContextWindowManager({
        maxTokens: 100000,
        strategy: "summarize-placeholder",
        summarizer,
      });
      const messages = [userMsg("Hello")];
      const result = await mgr.fitMessagesAsync(messages);
      expect(result.wasTruncated).toBe(false);
      expect(summarizer).not.toHaveBeenCalled();
    });
  });

  // ─── fitMessagesWithUsage (real-data-based trimming) ─────────

  describe("fitMessagesWithUsage", () => {
    it("returns all messages when usage is within budget", () => {
      const mgr = new ContextWindowManager({ maxTokens: 8000 });
      const messages = [userMsg("Hello"), assistantMsg("Hi there")];
      const result = mgr.fitMessagesWithUsage(messages, 3000, 8000);
      expect(result.messages).toHaveLength(2);
      expect(result.wasTruncated).toBe(false);
      expect(result.totalTokens).toBe(3000);
      expect(result.removedCount).toBe(0);
    });

    it("removes oldest non-system messages when over budget", () => {
      const mgr = new ContextWindowManager({ maxTokens: 4000 });
      const messages = [
        userMsg("First"),
        assistantMsg("Response 1"),
        userMsg("Second"),
        assistantMsg("Response 2"),
        userMsg("Third"),
        assistantMsg("Response 3"),
      ];
      // 5000 tokens with 4000 context window → needs to free 1000 tokens
      // avg = 5000/6 ≈ 833 per message → need to remove ceil(1000/833) = 2 messages
      const result = mgr.fitMessagesWithUsage(messages, 5000, 4000);
      expect(result.wasTruncated).toBe(true);
      expect(result.removedCount).toBe(2);
      expect(result.messages).toHaveLength(4);
    });

    it("preserves system messages during trim", () => {
      const mgr = new ContextWindowManager({ maxTokens: 4000 });
      const messages = [
        systemMsg("System prompt"),
        userMsg("First"),
        assistantMsg("Response 1"),
        userMsg("Second"),
      ];
      // 5000 tokens, need to free 1000, avg = 5000/4 = 1250, remove 1 non-system
      const result = mgr.fitMessagesWithUsage(messages, 5000, 4000);
      expect(result.messages[0].role).toBe("system");
      expect(result.removedCount).toBe(1);
    });

    it("respects reservedTokens", () => {
      const mgr = new ContextWindowManager({ maxTokens: 4000, reservedTokens: 500 });
      const messages = [
        userMsg("First"),
        assistantMsg("Response"),
      ];
      // 3600 tokens, budget = 4000-500 = 3500 → needs trim
      const result = mgr.fitMessagesWithUsage(messages, 3600, 4000);
      expect(result.wasTruncated).toBe(true);
    });

    it("returns empty array for empty messages", () => {
      const mgr = new ContextWindowManager({ maxTokens: 4000 });
      const result = mgr.fitMessagesWithUsage([], 0, 4000);
      expect(result.messages).toHaveLength(0);
      expect(result.wasTruncated).toBe(false);
    });
  });
});