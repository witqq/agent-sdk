/**
 * @witqq/agent-sdk/chat/core
 *
 * Foundational chat types and utilities: ChatMessage, ChatSession, ChatEvent,
 * IChatProvider, type guards, and AgentEvent↔ChatEvent bridge functions.
 */

import type {
  AgentEvent,
  Message,
  ToolCall,
  ToolResult,
  ToolDefinition,
  UsageData,
  ModelInfo,
  JSONValue,
} from "../types.js";

// ─── Unique ID ─────────────────────────────────────────────────

/** Branded type for unique identifiers */
export type ChatId = string & { readonly __brand: "ChatId" };

/**
 * Generate a new unique ChatId (crypto.randomUUID-based)
 * @returns Branded ChatId string
 */
export function createChatId(): ChatId {
  return crypto.randomUUID() as ChatId;
}

/** UUID v4 pattern for ChatId validation */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Cast a string to ChatId with UUID format validation.
 * Use this instead of manual `as ChatId` type assertions.
 *
 * @param value - String to validate and cast
 * @returns Branded ChatId
 * @throws {TypeError} If value is not a valid UUID v4 format
 *
 * @example
 * ```ts
 * const id = toChatId("550e8400-e29b-41d4-a716-446655440000");
 * ```
 */
export function toChatId(value: string): ChatId {
  if (!UUID_RE.test(value)) {
    throw new TypeError(`Invalid ChatId: "${value}" is not a valid UUID`);
  }
  return value as ChatId;
}

/**
 * Accepts either a plain string or branded ChatId for API convenience.
 * Use this in public API signatures so consumers don't need `as ChatId` casts.
 */
export type ChatIdLike = string | ChatId;

// ─── Status Types ──────────────────────────────────────────────

/** Lifecycle status of a message part (text, reasoning, etc.) */
export type PartStatus = "pending" | "streaming" | "complete" | "error";
/** Lifecycle status of a tool call within a message */
export type ToolCallStatus = "pending" | "running" | "requires_approval" | "complete" | "error" | "denied";
/** Lifecycle status of an entire message */
export type MessageStatus = "pending" | "streaming" | "complete" | "error" | "cancelled";
/** Lifecycle status of a chat session */
export type SessionStatus = "active" | "archived";
/** Lifecycle status of the chat runtime */
export type RuntimeStatus = "idle" | "streaming" | "error" | "disposed";

// ─── Message Parts (union) ─────────────────────────────────────

/** Plain text content part */
export interface TextPart { type: "text"; text: string; status: PartStatus; }
/** Model reasoning/thinking content part */
export interface ReasoningPart { type: "reasoning"; text: string; status: PartStatus; }
/** Tool invocation part with call ID, arguments, optional result */
export interface ToolCallPart { type: "tool_call"; toolCallId: string; name: string; args: unknown; result?: unknown; status: ToolCallStatus; error?: string; }
/** Source reference part (URL citation) */
export interface SourcePart { type: "source"; url: string; title?: string; status: PartStatus; }
/** File attachment part (base64-encoded data) */
export interface FilePart { type: "file"; name: string; mimeType: string; data: string; status: PartStatus; }
/** Union of all message part types */
export type MessagePart = TextPart | ReasoningPart | ToolCallPart | SourcePart | FilePart;

// ─── Chat Message ──────────────────────────────────────────────

/** Role of message author */
export type ChatRole = "user" | "assistant" | "system";

/** Metadata attached to messages — useful preset for the TMetadata generic */
export interface ChatMessageMetadata {
  model?: string;
  backend?: string;
  usage?: UsageData;
  isSummary?: boolean;
  isArchived?: boolean;
  estimatedTokens?: number;
  custom?: Record<string, unknown>;
}

/** Message status */
export type ChatMessageStatus = MessageStatus;

/** A single chat message — the fundamental unit of conversation */
export interface ChatMessage<TMetadata = unknown> {
  id: ChatId;
  role: ChatRole;
  parts: MessagePart[];
  metadata?: TMetadata;
  createdAt: string;
  updatedAt?: string;
  status: MessageStatus;
}

// ─── Convenience Getters ───────────────────────────────────────

/**
 * Join all TextPart texts in a message
 * @param message - The chat message to extract text from
 * @returns Concatenated text content
 */
export function getMessageText(message: ChatMessage): string {
  return message.parts
    .filter((p): p is TextPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * Filter all ToolCallParts from a message
 * @param message - The chat message to extract tool calls from
 * @returns Array of ToolCallPart
 */
export function getMessageToolCalls(message: ChatMessage): ToolCallPart[] {
  return message.parts.filter((p): p is ToolCallPart => p.type === "tool_call");
}

/**
 * Join all ReasoningPart texts in a message
 * @param message - The chat message to extract reasoning from
 * @returns Concatenated reasoning content
 */
export function getMessageReasoning(message: ChatMessage): string {
  return message.parts
    .filter((p): p is ReasoningPart => p.type === "reasoning")
    .map((p) => p.text)
    .join("");
}

// ─── Supporting Types ──────────────────────────────────────────

/** Options for sending a message */
export interface SendOpts { sessionId?: string; model?: string; signal?: AbortSignal; metadata?: Record<string, unknown>; }
/** Options for creating a new session */
export interface CreateSessionOpts { id?: string; title?: string; model?: string; metadata?: Record<string, unknown>; }
/** Options for listing sessions with pagination */
export interface ListOpts { limit?: number; offset?: number; status?: SessionStatus; }
/** Options for backend execution (model, tokens, tools) */
export interface BackendOpts { model: string; signal?: AbortSignal; systemPrompt?: string; temperature?: number; maxTokens?: number; tools?: Record<string, unknown>; providerOptions?: Record<string, unknown>; }
/** Context passed to tool execute functions */
export interface ToolContext { sessionId: string; userId?: string; signal: AbortSignal; }
/** Configuration for creating a chat runtime */
export interface ChatRuntimeConfig { backend: string; model?: string; apiKey?: string; baseUrl?: string; context?: { maxTokens?: number; reserveTokens?: number; strategy?: "sliding" | "summarize" | "truncate"; }; retry?: { maxRetries?: number; initialDelay?: number; backoffFactor?: number; }; providerOptions?: Record<string, unknown>; }

// ─── Chat Session ──────────────────────────────────────────────

/** Session configuration snapshot */
export interface ChatSessionConfig {
  model: string;
  backend: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Session metadata */
export interface ChatSessionMetadata<TCustom extends Record<string, unknown> = Record<string, unknown>> {
  messageCount: number;
  totalTokens: number;
  tags?: string[];
  custom?: TCustom;
}

/** Chat session — a conversation with ordered messages */
export interface ChatSession<TCustom extends Record<string, unknown> = Record<string, unknown>> {
  id: ChatId;
  title?: string;
  messages: ChatMessage[];
  config: ChatSessionConfig;
  metadata: ChatSessionMetadata<TCustom>;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  backendSessionId?: string;
  /** Subscribe to session changes (for React useSyncExternalStore) */
  subscribe?(callback: () => void): () => void;
  /** Get immutable snapshot of session state (for React useSyncExternalStore) */
  getSnapshot?(): ChatSession<TCustom>;
  /** Last message in the session */
  readonly lastMessage?: ChatMessage;
}

/** Lightweight session info for listing (without full message array) */
export interface SessionInfo {
  id: ChatId;
  title?: string;
  status: SessionStatus;
  messageCount: number;
  lastMessage?: ChatMessage;
  createdAt: string;
  updatedAt: string;
}

// ─── Chat Events ───────────────────────────────────────────────

/** Events emitted during chat operation */
export type ChatEvent =
  | { type: "message:start"; messageId: ChatId; role: ChatRole }
  | { type: "message:delta"; messageId: ChatId; text: string }
  | { type: "message:complete"; messageId: ChatId; message: ChatMessage }
  | {
      type: "tool:start";
      messageId: ChatId;
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool:complete";
      messageId: ChatId;
      toolCallId: string;
      toolName: string;
      result: unknown;
      isError?: boolean;
    }
  | { type: "thinking:start"; messageId: ChatId }
  | { type: "thinking:delta"; messageId: ChatId; text: string }
  | { type: "thinking:end"; messageId: ChatId }
  | {
      type: "permission:request";
      messageId: ChatId;
      toolName: string;
      toolArgs: Record<string, unknown>;
    }
  | {
      type: "permission:response";
      messageId: ChatId;
      toolName: string;
      allowed: boolean;
    }
  | {
      type: "usage";
      promptTokens: number;
      completionTokens: number;
      model?: string;
    }
  | { type: "session:created"; sessionId: ChatId }
  | { type: "session:updated"; sessionId: ChatId }
  | {
      type: "error";
      error: string;
      recoverable: boolean;
      messageId?: ChatId;
    }
  | { type: "typing:start" }
  | { type: "typing:end" }
  | { type: "heartbeat" }
  | { type: "done"; finalOutput?: string };

/** All possible ChatEvent type strings */
export type ChatEventType = ChatEvent["type"];

// ─── Chat Middleware ───────────────────────────────────────────

/** Context passed to ChatMiddleware hooks */
export interface ChatMiddlewareContext {
  sessionId: ChatId;
  signal: AbortSignal;
}

/** Runtime-level middleware for the send/receive lifecycle.
 *  Different from EventMiddleware which operates at the event bus level. */
export interface ChatMiddleware {
  /** Transform message before sending to backend */
  onBeforeSend?(message: ChatMessage, context: ChatMiddlewareContext): ChatMessage | Promise<ChatMessage>;
  /** Transform/intercept stream events */
  onEvent?(event: ChatEvent, context: ChatMiddlewareContext): ChatEvent | null | Promise<ChatEvent | null>;
  /** Transform completed message after receiving from backend */
  onAfterReceive?(message: ChatMessage, context: ChatMiddlewareContext): ChatMessage | Promise<ChatMessage>;
  /** Intercept errors — return null to suppress, return error to propagate */
  onError?(error: Error, context: ChatMiddlewareContext): Error | null | Promise<Error | null>;
}

// ─── Chat Provider Abstraction ─────────────────────────────────

/** Options for sending a message to a provider */
export interface SendMessageOptions {
  signal?: AbortSignal;
  model?: string;
  context?: Record<string, unknown>;
  /** Additional tools to include in this request */
  tools?: ToolDefinition[];
}

/** Abstract chat provider — wraps an IAgentService for chat use */
export interface IChatProvider {
  readonly name: string;
  sendMessage(
    session: ChatSession,
    message: string,
    options?: SendMessageOptions,
  ): Promise<ChatMessage>;
  streamMessage(
    session: ChatSession,
    message: string,
    options?: SendMessageOptions,
  ): AsyncIterable<ChatEvent>;
  listModels(): Promise<ModelInfo[]>;
  validate(): Promise<{ valid: boolean; errors: string[] }>;
  dispose(): Promise<void>;
}

// ─── Type Guards ───────────────────────────────────────────────

/**
 * Check if a value is a ChatMessage
 * @param value - Value to check
 * @returns True if value has ChatMessage shape
 */
export function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.role === "string" &&
    (obj.role === "user" ||
      obj.role === "assistant" ||
      obj.role === "system") &&
    Array.isArray(obj.parts) &&
    typeof obj.createdAt === "string" &&
    typeof obj.status === "string"
  );
}

/**
 * Check if a value is a ChatSession
 * @param value - Value to check
 * @returns True if value has ChatSession shape
 */
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

/**
 * Check if a value is a MessagePart
 * @param value - Value to check
 * @returns True if value has MessagePart shape
 */
export function isMessagePart(value: unknown): value is MessagePart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.type === "string" &&
    (obj.type === "text" ||
      obj.type === "reasoning" ||
      obj.type === "tool_call" ||
      obj.type === "source" ||
      obj.type === "file")
  );
}

/**
 * Check if a value is a TextPart
 * @param value - Value to check
 * @returns True if value is a TextPart
 */
export function isTextPart(value: unknown): value is TextPart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "text" && typeof obj.text === "string";
}

/**
 * Check if a value is a ToolCallPart
 * @param value - Value to check
 * @returns True if value is a ToolCallPart
 */
export function isToolCallPart(value: unknown): value is ToolCallPart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "tool_call" && typeof obj.toolCallId === "string" && typeof obj.name === "string";
}

/**
 * Check if a value is a ReasoningPart
 * @param value - Value to check
 * @returns True if value is a ReasoningPart
 */
export function isReasoningPart(value: unknown): value is ReasoningPart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "reasoning" && typeof obj.text === "string";
}

/**
 * Check if a value is a SourcePart
 * @param value - Value to check
 * @returns True if value is a SourcePart
 */
export function isSourcePart(value: unknown): value is SourcePart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "source" && typeof obj.url === "string";
}

/**
 * Check if a value is a FilePart
 * @param value - Value to check
 * @returns True if value is a FilePart
 */
export function isFilePart(value: unknown): value is FilePart {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "file" && typeof obj.name === "string" && typeof obj.mimeType === "string";
}

/**
 * Check if a value is a ChatEvent
 * @param value - Value to check
 * @returns True if value has a valid ChatEvent type
 */
export function isChatEvent(value: unknown): value is ChatEvent {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  const validTypes: ChatEventType[] = [
    "message:start",
    "message:delta",
    "message:complete",
    "tool:start",
    "tool:complete",
    "thinking:start",
    "thinking:delta",
    "thinking:end",
    "permission:request",
    "permission:response",
    "usage",
    "session:created",
    "session:updated",
    "error",
    "typing:start",
    "typing:end",
    "heartbeat",
    "done",
  ];
  return validTypes.includes(obj.type as ChatEventType);
}

// ─── Agent Event Adapter ───────────────────────────────────────

/**
 * Map a single AgentEvent to a ChatEvent (or null if no mapping)
 * @param event - The AgentEvent to convert
 * @param messageId - ChatId to associate with the event
 * @returns Corresponding ChatEvent or null if unmappable
 */
export function agentEventToChatEvent(
  event: AgentEvent,
  messageId: ChatId,
): ChatEvent | null {
  switch (event.type) {
    case "text_delta":
      return { type: "message:delta", messageId, text: event.text };
    case "thinking_start":
      return { type: "thinking:start", messageId };
    case "thinking_delta":
      return { type: "thinking:delta", messageId, text: event.text };
    case "thinking_end":
      return { type: "thinking:end", messageId };
    case "tool_call_start":
      return {
        type: "tool:start",
        messageId,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args as Record<string, unknown>,
      };
    case "tool_call_end":
      return {
        type: "tool:complete",
        messageId,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
      };
    case "permission_request":
      return {
        type: "permission:request",
        messageId,
        toolName: event.request.toolName,
        toolArgs: event.request.toolArgs,
      };
    case "permission_response":
      return {
        type: "permission:response",
        messageId,
        toolName: event.toolName,
        allowed: event.decision.allowed,
      };
    case "usage_update":
      return {
        type: "usage",
        promptTokens: event.promptTokens,
        completionTokens: event.completionTokens,
        model: event.model,
      };
    case "error":
      return {
        type: "error",
        error: event.error,
        recoverable: event.recoverable,
        messageId,
      };
    case "heartbeat":
      return { type: "heartbeat" };
    case "ask_user":
    case "ask_user_response":
    case "session_info":
    case "done":
      return null;
    default:
      return null;
  }
}

/**
 * Convert AgentEvent async iterable to ChatEvent async iterable
 * @param events - Source agent events
 * @param messageId - ChatId to associate with converted events
 * @returns Async iterable of ChatEvent (nulls filtered out)
 */
export async function* adaptAgentEvents(
  events: AsyncIterable<AgentEvent>,
  messageId: ChatId,
): AsyncIterable<ChatEvent> {
  for await (const event of events) {
    const chatEvent = agentEventToChatEvent(event, messageId);
    if (chatEvent !== null) {
      yield chatEvent;
    }
  }
}

/**
 * Map a ChatEvent back to an AgentEvent for accumulator consumption.
 * Returns null for events that don't map to accumulator-relevant AgentEvents
 * (e.g. message:start, message:complete, usage, permission:*, heartbeat).
 *
 * @param event - The ChatEvent to convert
 * @returns Corresponding AgentEvent or null if not accumulator-relevant
 */
export function chatEventToAgentEvent(event: ChatEvent): AgentEvent | null {
  switch (event.type) {
    case "message:delta":
      return { type: "text_delta", text: event.text };
    case "thinking:start":
      return { type: "thinking_start" };
    case "thinking:delta":
      return { type: "thinking_delta", text: event.text };
    case "thinking:end":
      return { type: "thinking_end" };
    case "tool:start":
      return {
        type: "tool_call_start",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args as JSONValue,
      };
    case "tool:complete":
      return {
        type: "tool_call_end",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result as JSONValue,
      };
    case "error":
      return { type: "error", error: event.error, recoverable: event.recoverable };
    default:
      return null;
  }
}

// ─── Message Conversion ────────────────────────────────────────

/**
 * Convert a ChatMessage to agent-sdk Message format
 * @param message - The ChatMessage to convert
 * @returns agent-sdk Message
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
 * @param message - The agent-sdk Message to convert
 * @param id - Optional ChatId (auto-generated if omitted)
 * @returns ChatMessage with status "complete"
 */
export function fromAgentMessage(message: Message, id?: ChatId): ChatMessage {
  const chatId = id ?? createChatId();
  const now = new Date().toISOString();

  const parts: MessagePart[] = [];

  // Build text content
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

  // Add tool calls from assistant messages
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

  // Add tool results — map 'tool' role to 'assistant'
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

  // Ensure at least an empty text part for empty messages
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
 * @param message - The ChatMessage to extract results from
 * @returns Array of ToolResult for completed tool calls
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
