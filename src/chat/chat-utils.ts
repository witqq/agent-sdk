/**
 * @witqq/agent-sdk — Chat utility functions
 */

import type { ChatMessage, TextPart, ToolCallPart, ReasoningPart } from "./types.js";
export { createChatId, toChatId } from "./types.js";

/**
 * Join all TextPart texts in a message
 */
export function getMessageText(message: ChatMessage): string {
  return message.parts
    .filter((p): p is TextPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * Filter all ToolCallParts from a message
 */
export function getMessageToolCalls(message: ChatMessage): ToolCallPart[] {
  return message.parts.filter((p): p is ToolCallPart => p.type === "tool_call");
}

/**
 * Join all ReasoningPart texts in a message
 */
export function getMessageReasoning(message: ChatMessage): string {
  return message.parts
    .filter((p): p is ReasoningPart => p.type === "reasoning")
    .map((p) => p.text)
    .join("");
}
