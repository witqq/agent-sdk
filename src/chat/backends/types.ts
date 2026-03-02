/**
 * @witqq/agent-sdk/chat/backends/types
 *
 * IChatBackend — core backend interface for sending/streaming messages.
 * IResumableBackend — extends IChatBackend with session resume support.
 */

import type {
  ChatEvent,
  ChatMessage,
  ChatSession,
  SendMessageOptions,
} from "../core.js";
import type {
  FullAgentConfig,
  IAgentService,
  ModelInfo,
} from "../../types.js";

// ─── Backend Adapter Options ───────────────────────────────────

/** Options for creating a backend adapter */
export interface BackendAdapterOptions {
  /** Agent configuration (model, systemPrompt, tools, etc.) */
  agentConfig: FullAgentConfig;
  /** Pre-created agent service (if adapter should not own lifecycle) */
  agentService?: IAgentService;
  /** Factory for lazy service creation (called on first use, not at construction) */
  agentServiceFactory?: () => IAgentService;
}

// ─── Core Backend Interface ────────────────────────────────────

/**
 * Core chat backend — send, stream, models, validate, dispose.
 * All backends implement this. Resume support is optional.
 *
 * Note: `agentService` is intentionally NOT on this interface.
 * It's an implementation detail exposed on BaseBackendAdapter for
 * advanced consumers who need direct service access.
 */
export interface IChatBackend {
  /** Backend name (e.g. "copilot", "claude", "vercel-ai") */
  readonly name: string;

  /** Send a message and receive a complete response */
  sendMessage(
    session: ChatSession,
    message: string,
    options?: SendMessageOptions,
  ): Promise<ChatMessage>;

  /** Stream a message response as ChatEvents */
  streamMessage(
    session: ChatSession,
    message: string,
    options?: SendMessageOptions,
  ): AsyncIterable<ChatEvent>;

  /** List available models */
  listModels(): Promise<ModelInfo[]>;

  /** Validate backend configuration/credentials */
  validate(): Promise<{ valid: boolean; errors: string[] }>;

  /** Dispose resources */
  dispose(): Promise<void>;

  /** Current effective model */
  readonly currentModel: string | undefined;
}

// ─── Resumable Backend Interface ───────────────────────────────

/**
 * Extended backend with session resume capabilities.
 * Only backends with persistent sessions (Copilot, Claude) implement this.
 * Use `isResumableBackend()` to type-narrow at runtime.
 */
export interface IResumableBackend extends IChatBackend {
  /** Whether this adapter supports session resume */
  canResume(): boolean;

  /**
   * Resume a previous session by its backend session ID.
   * Streams events from the resumed session.
   * @throws ChatError with SESSION_EXPIRED if session is no longer valid
   * @throws ChatError with SESSION_NOT_FOUND if session ID is unknown
   */
  resume(
    session: ChatSession,
    backendSessionId: string,
    options?: SendMessageOptions,
  ): AsyncIterable<ChatEvent>;

  /** The backend session ID from the last stream, or null if not yet streamed */
  readonly backendSessionId: string | null;
}

/** Type guard: checks if a backend adapter supports session resume */
export function isResumableBackend(
  adapter: IChatBackend,
): adapter is IResumableBackend {
  return "canResume" in adapter && typeof (adapter as IResumableBackend).canResume === "function";
}


