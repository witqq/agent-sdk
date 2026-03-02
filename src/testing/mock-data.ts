/**
 * Mock data factories for creating test ChatSession and ChatMessage instances.
 */
import type { ChatSession, ChatMessage, MessagePart, ChatSessionConfig, ChatId } from "../chat/core.js";
import { createChatId } from "../chat/core.js";

/** Options for createMockSession. */
export interface MockSessionOptions {
  id?: string;
  title?: string;
  messages?: ChatMessage[];
  config?: Partial<ChatSessionConfig>;
  metadata?: Record<string, unknown>;
  status?: "active";
}

/** Options for createMockMessage. */
export interface MockMessageOptions {
  id?: string;
  role?: "user" | "assistant" | "system";
  text?: string;
  parts?: MessagePart[];
  status?: "pending" | "streaming" | "complete" | "error";
  metadata?: Record<string, unknown>;
}

/**
 * Create a mock ChatSession for testing.
 *
 * ```ts
 * const session = createMockSession({ title: "Test chat" });
 * ```
 */
export function createMockSession(options: MockSessionOptions = {}): ChatSession {
  const id = (options.id ?? createChatId()) as ChatId;
  const now = new Date().toISOString();
  return {
    id,
    title: options.title ?? "Test Session",
    messages: options.messages ?? [],
    config: {
      model: options.config?.model ?? "test-model",
      backend: options.config?.backend ?? "test-backend",
      systemPrompt: options.config?.systemPrompt ?? "",
    },
    metadata: {
      messageCount: options.messages?.length ?? 0,
      totalTokens: 0,
      custom: options.metadata ?? {},
    },
    status: options.status ?? "active",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a mock ChatMessage for testing.
 *
 * ```ts
 * const msg = createMockMessage({ role: "user", text: "Hello" });
 * ```
 */
export function createMockMessage(options: MockMessageOptions = {}): ChatMessage {
  const id = createChatId();
  const parts: MessagePart[] = options.parts ?? (options.text
    ? [{ type: "text" as const, text: options.text, status: "complete" as const }]
    : [{ type: "text" as const, text: "Test message", status: "complete" as const }]);
  const now = new Date().toISOString();
  return {
    id,
    role: options.role ?? "user",
    parts,
    status: options.status ?? "complete",
    createdAt: now,
    metadata: options.metadata ?? {},
  };
}
