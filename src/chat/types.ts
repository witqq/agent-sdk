/**
 * @witqq/agent-sdk — Chat domain types
 *
 * All type definitions and interfaces for the chat layer.
 * Pure types + ChatId generation (tightly coupled to branded type).
 */

import type { UsageData, ToolDefinition, ErrorCode } from "../types.js";
import type { AuthToken } from "../auth/types.js";

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
export type SessionStatus = "active";
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

// ─── Supporting Types ──────────────────────────────────────────

// ─── Chat Session ──────────────────────────────────────────────

/** Session configuration snapshot */
export interface ChatSessionConfig {
  model: string;
  backend: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Session metadata tracking usage statistics and custom extensions.
 *
 * Updated automatically by session stores on each `addMessage()` call.
 * The generic `TCustom` parameter allows type-safe application-specific
 * metadata via the `custom` field.
 *
 * @typeParam TCustom - Shape of the `custom` field (defaults to `Record<string, unknown>`)
 */
export interface ChatSessionMetadata<TCustom extends Record<string, unknown> = Record<string, unknown>> {
  /** Number of messages in the session (updated by session store) */
  messageCount: number;
  /** Total token count across all messages in the session */
  totalTokens: number;
  /** Optional tags for session categorization and filtering */
  tags?: string[];
  /** Application-specific metadata — typed via the TCustom generic parameter */
  custom?: TCustom;
}

/** Chat session — a conversation with ordered messages (pure serializable data) */
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
}

/**
 * Reactive wrapper around ChatSession — provides subscribe/getSnapshot for
 * React useSyncExternalStore integration and lastMessage convenience getter.
 * Session stores may optionally return ObservableSession instances.
 */
export interface ObservableSession<TCustom extends Record<string, unknown> = Record<string, unknown>>
  extends ChatSession<TCustom> {
  /** Subscribe to session changes (for React useSyncExternalStore) */
  subscribe(callback: () => void): () => void;
  /** Get immutable snapshot of session state (for React useSyncExternalStore) */
  getSnapshot(): ChatSession<TCustom>;
  /** Last message in the session */
  readonly lastMessage: ChatMessage | undefined;
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
      code?: ErrorCode;
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
  /** Transform message before sending to backend. Return null to reject the send. */
  onBeforeSend?(message: ChatMessage, context: ChatMiddlewareContext): ChatMessage | null | Promise<ChatMessage | null>;
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
  /** Model to use for this request. Required for server-side runtime.send(). */
  model?: string;
  /** Per-call system prompt override (forwarded to the backend agent) */
  systemPrompt?: string;
  context?: Record<string, unknown>;
  /** Additional tools to include in this request */
  tools?: ToolDefinition[];
}

/** Options for runtime.send() — requires backend routing info */
export interface RuntimeSendOptions {
  /** Backend to route this request to (key in backends map) */
  backend: string;
  /** Authentication credentials for the backend factory */
  credentials: AuthToken;
  /** Model to use for this request */
  model: string;
  /** Per-call system prompt override (forwarded to the backend agent) */
  systemPrompt?: string;
  /** Abort signal */
  signal?: AbortSignal;
  /** Request-scoped context */
  context?: Record<string, unknown>;
  /** Additional tools */
  tools?: ToolDefinition[];
}

/**
 * @deprecated IChatProvider has been inlined into IChatBackend.
 * Import IChatBackend from "@witqq/agent-sdk/chat/backends" instead.
 * Kept as type alias for backward compatibility.
 */
export type IChatProvider = import("./backends/types.js").IChatBackend;

// ─── Factory Functions ─────────────────────────────────────────

/**
 * Create a simple text ChatMessage.
 *
 * @param text - Message text content
 * @param role - Message role (default: "user")
 * @returns A complete ChatMessage with a single TextPart
 */
export function createTextMessage(text: string, role: ChatRole = "user"): ChatMessage {
  return {
    id: createChatId(),
    role,
    parts: [{ type: "text", text, status: "complete" }],
    createdAt: new Date().toISOString(),
    status: "complete",
  };
}

/** Type guard: checks if a session has reactive API (subscribe/getSnapshot) */
export function isObservableSession<TCustom extends Record<string, unknown> = Record<string, unknown>>(
  session: ChatSession<TCustom>,
): session is ObservableSession<TCustom> {
  return "subscribe" in session && typeof (session as ObservableSession<TCustom>).subscribe === "function"
    && "getSnapshot" in session && typeof (session as ObservableSession<TCustom>).getSnapshot === "function";
}
