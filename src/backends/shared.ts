/**
 * Shared utilities for CLI backends (Copilot, Claude).
 * Extracted to avoid duplication between copilot.ts and claude.ts.
 */
import type { Message, JSONValue } from "../types.js";
import { getTextContent } from "../types.js";

/** Extract the last user message as plain text */
export function extractLastUserPrompt(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user") {
      return getTextContent(msg.content);
    }
  }
  return "";
}

function serializeToolCall(tc: { name: string; args: JSONValue }): string {
  const args = typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args);
  return `  Tool call: ${tc.name}(${args})`;
}

function serializeToolResult(tr: { name: string; result: JSONValue; isError?: boolean }): string {
  const result = typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result);
  const prefix = tr.isError ? "[ERROR] " : "";
  return `  ${tr.name} → ${prefix}${result}`;
}

/** Build prompt with conversation history for CLI backends that create fresh sessions */
export function buildContextualPrompt(messages: Message[]): string {
  if (messages.length <= 1) {
    return extractLastUserPrompt(messages);
  }

  const history = messages.slice(0, -1).map((msg) => {
    if (msg.role === "user") {
      return `User: ${msg.content ? getTextContent(msg.content) : ""}`;
    }
    if (msg.role === "tool" && msg.toolResults) {
      const results = msg.toolResults.map(serializeToolResult).join("\n");
      return `Tool results:\n${results}`;
    }
    if (msg.role === "assistant") {
      const parts: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const thinking = (msg as any).thinking as string | undefined;
      if (thinking) {
        parts.push(`[reasoning: ${thinking}]`);
      }
      const text = msg.content ? getTextContent(msg.content) : "";
      if (text) parts.push(text);
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        parts.push(msg.toolCalls.map(serializeToolCall).join("\n"));
      }
      return `Assistant: ${parts.join("\n")}`;
    }
    const text = msg.content ? getTextContent(msg.content) : "";
    return `${msg.role}: ${text}`;
  }).join("\n");

  const lastPrompt = extractLastUserPrompt(messages);

  return `Conversation history:\n${history}\n\nUser: ${lastPrompt}`;
}
