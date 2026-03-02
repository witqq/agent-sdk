/**
 * @witqq/agent-sdk — ChatMessage ↔ agent-sdk Message conversion
 */

import type { Message, ToolCall, ToolResult, JSONValue } from "../types.js";
import type { ChatId, ChatMessage, ChatRole, MessagePart } from "./types.js";
import { createChatId, getMessageText, getMessageToolCalls } from "./chat-utils.js";

/**
 * Convert a ChatMessage to agent-sdk Message format
 */
export function toAgentMessage(message: ChatMessage): Message {
  const textContent = getMessageText(message);
  const toolCallParts = getMessageToolCalls(message);

  switch (message.role) {
    case "user":
      return { role: "user", content: textContent };
    case "assistant": {
      const toolCalls: ToolCall[] | undefined = toolCallParts.length > 0
        ? toolCallParts.map((p) => ({ id: p.toolCallId, name: p.name, args: p.args as JSONValue }))
        : undefined;
      return {
        role: "assistant",
        content: textContent,
        toolCalls,
      };
    }
    case "system":
      return { role: "system", content: textContent };
  }
}

/**
 * Convert an agent-sdk Message to ChatMessage
 */
export function fromAgentMessage(message: Message, id?: ChatId): ChatMessage {
  const chatId = id ?? createChatId();
  const now = new Date().toISOString();

  const parts: MessagePart[] = [];

  const textContent =
    typeof message.content === "string"
      ? message.content
      : Array.isArray(message.content)
        ? message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n")
        : (message.content ?? "");

  if (textContent) {
    parts.push({ type: "text", text: textContent, status: "complete" });
  }

  if (message.role === "assistant" && message.toolCalls) {
    for (const tc of message.toolCalls) {
      parts.push({
        type: "tool_call",
        toolCallId: tc.id,
        name: tc.name,
        args: tc.args,
        status: "complete",
      });
    }
  }

  if (message.role === "tool" && message.toolResults) {
    for (const tr of message.toolResults) {
      parts.push({
        type: "tool_call",
        toolCallId: tr.toolCallId,
        name: tr.name,
        args: {},
        result: tr.result,
        status: "complete",
      });
    }
  }

  if (parts.length === 0) {
    parts.push({ type: "text", text: "", status: "complete" });
  }

  const role: ChatRole = message.role === "tool" ? "assistant" : message.role;

  return {
    id: chatId,
    role,
    parts,
    createdAt: now,
    status: "complete",
  };
}

/**
 * Extract ToolResults from ToolCallParts that have results
 */
export function extractToolResults(message: ChatMessage): ToolResult[] {
  return getMessageToolCalls(message)
    .filter((p) => p.result !== undefined)
    .map((p) => ({
      toolCallId: p.toolCallId,
      name: p.name,
      result: p.result as JSONValue,
      isError: p.status === "error" ? true : undefined,
    }));
}
