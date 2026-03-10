import type { Message, MessageContent } from "../types.js";
import { getTextContent } from "../types.js";

/** Convert our Message[] to a flat prompt string (for CLIs that accept text) */
export function messagesToPrompt(messages: Message[]): string {
  return messages
    .map((msg) => {
      switch (msg.role) {
        case "user":
          return contentToText(msg.content);
        case "assistant":
          return contentToText(msg.content);
        case "system":
          return msg.content;
        case "tool":
          return msg.content ?? "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

/** Convert MessageContent to plain text */
export function contentToText(content: MessageContent): string {
  return getTextContent(content);
}

/** Build a system prompt with optional structured output instruction */
export function buildSystemPrompt(
  base: string,
  schemaInstruction?: string,
): string {
  if (!schemaInstruction) return base;
  return `${base}\n\n${schemaInstruction}`;
}
