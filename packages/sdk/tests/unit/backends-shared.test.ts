import { describe, it, expect } from "vitest";
import { extractLastUserPrompt, buildContextualPrompt } from "../../src/backends/shared.js";
import type { Message } from "../../src/types.js";

describe("backends/shared", () => {
  describe("extractLastUserPrompt", () => {
    it("returns last user message text", () => {
      const messages: Message[] = [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "world" },
      ];
      expect(extractLastUserPrompt(messages)).toBe("world");
    });

    it("returns empty string for no user messages", () => {
      const messages: Message[] = [
        { role: "assistant", content: "hi" },
      ];
      expect(extractLastUserPrompt(messages)).toBe("");
    });

    it("returns empty string for empty array", () => {
      expect(extractLastUserPrompt([])).toBe("");
    });
  });

  describe("buildContextualPrompt", () => {
    it("returns user prompt for single message", () => {
      const messages: Message[] = [
        { role: "user", content: "hello" },
      ];
      expect(buildContextualPrompt(messages)).toBe("hello");
    });

    it("builds context for multi-turn conversation", () => {
      const messages: Message[] = [
        { role: "user", content: "first" },
        { role: "assistant", content: "response" },
        { role: "user", content: "second" },
      ];
      const result = buildContextualPrompt(messages);
      expect(result).toContain("Conversation history:");
      expect(result).toContain("User: first");
      expect(result).toContain("Assistant: response");
      expect(result).toContain("User: second");
    });

    it("returns empty string for empty array", () => {
      expect(buildContextualPrompt([])).toBe("");
    });

    it("includes tool call information", () => {
      const messages: Message[] = [
        { role: "user", content: "do something" },
        { role: "assistant", content: "ok", toolCalls: [{ name: "read_file", args: { path: "/tmp" } }] },
        { role: "user", content: "continue" },
      ];
      const result = buildContextualPrompt(messages);
      expect(result).toContain("Tool call: read_file");
    });
  });
});
