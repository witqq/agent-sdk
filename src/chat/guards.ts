/**
 * @witqq/agent-sdk — Chat type guards
 */

import type {
  ChatMessage,
  ChatSession,
  MessagePart,
  TextPart,
  ToolCallPart,
  ReasoningPart,
  SourcePart,
  FilePart,
  ChatEvent,
} from "./types.js";

/** Check if a value is a ChatMessage */
export function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.role === "string" &&
    (obj.role === "user" || obj.role === "assistant" || obj.role === "system") &&
    Array.isArray(obj.parts) &&
    typeof obj.createdAt === "string" &&
    typeof obj.status === "string"
  );
}

/** Check if a value is a ChatSession */
export function isChatSession(value: unknown): value is ChatSession {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    Array.isArray(obj.messages) &&
    typeof obj.config === "object" &&
    obj.config !== null &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string" &&
    typeof obj.status === "string"
  );
}

/** Check if a value is a MessagePart */
export function isMessagePart(value: unknown): value is MessagePart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.type === "string" &&
    (obj.type === "text" || obj.type === "reasoning" || obj.type === "tool_call" || obj.type === "source" || obj.type === "file")
  );
}

/** Check if a value is a TextPart */
export function isTextPart(value: unknown): value is TextPart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "text" && typeof obj.text === "string";
}

/** Check if a value is a ToolCallPart */
export function isToolCallPart(value: unknown): value is ToolCallPart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "tool_call" && typeof obj.toolCallId === "string" && typeof obj.name === "string";
}

/** Check if a value is a ReasoningPart */
export function isReasoningPart(value: unknown): value is ReasoningPart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "reasoning" && typeof obj.text === "string";
}

/** Check if a value is a SourcePart */
export function isSourcePart(value: unknown): value is SourcePart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "source" && typeof obj.url === "string";
}

/** Check if a value is a FilePart */
export function isFilePart(value: unknown): value is FilePart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "file" && typeof obj.name === "string" && typeof obj.mimeType === "string";
}

const VALID_CHAT_EVENT_TYPES: ReadonlySet<string> = new Set([
  "message:start", "message:delta", "message:complete",
  "tool:start", "tool:complete",
  "thinking:start", "thinking:delta", "thinking:end",
  "permission:request", "permission:response",
  "usage", "session:created", "session:updated",
  "error", "typing:start", "typing:end", "heartbeat", "done",
]);

/** Check if a value is a ChatEvent */
export function isChatEvent(value: unknown): value is ChatEvent {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return VALID_CHAT_EVENT_TYPES.has(obj.type as string);
}
