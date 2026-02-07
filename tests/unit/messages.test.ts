import { describe, it, expect } from "vitest";
import {
  messagesToPrompt,
  contentToText,
  buildSystemPrompt,
} from "../../src/utils/messages.js";
import type { Message } from "../../src/types.js";

describe("messagesToPrompt", () => {
  it("should concatenate user messages", () => {
    const messages: Message[] = [
      { role: "user", content: "hello" },
      { role: "user", content: "world" },
    ];
    expect(messagesToPrompt(messages)).toBe("hello\n\nworld");
  });

  it("should include system and assistant messages", () => {
    const messages: Message[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];
    const prompt = messagesToPrompt(messages);
    expect(prompt).toContain("You are helpful");
    expect(prompt).toContain("hi");
    expect(prompt).toContain("hello");
  });

  it("should handle tool messages", () => {
    const messages: Message[] = [
      { role: "tool", content: "result", toolResults: [] },
    ];
    expect(messagesToPrompt(messages)).toBe("result");
  });

  it("should handle multi-part content", () => {
    const messages: Message[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "look at this" },
          { type: "text", text: " image" },
        ],
      },
    ];
    expect(messagesToPrompt(messages)).toBe("look at this\n image");
  });
});

describe("contentToText", () => {
  it("should return string content as-is", () => {
    expect(contentToText("hello")).toBe("hello");
  });

  it("should join text parts from array content", () => {
    const content = [
      { type: "text" as const, text: "part1" },
      { type: "text" as const, text: "part2" },
    ];
    expect(contentToText(content)).toBe("part1\npart2");
  });
});

describe("buildSystemPrompt", () => {
  it("should return base when no schema instruction", () => {
    expect(buildSystemPrompt("You are helpful")).toBe("You are helpful");
  });

  it("should append schema instruction", () => {
    const result = buildSystemPrompt(
      "You are helpful",
      "Respond in JSON format",
    );
    expect(result).toBe("You are helpful\n\nRespond in JSON format");
  });
});
