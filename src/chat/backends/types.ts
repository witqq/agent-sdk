/**
 * @witqq/agent-sdk/chat/backends/types
 *
 * IBackendAdapter extends IChatProvider with session resume capabilities.
 * Backend adapters own the IAgentService lifecycle and normalize events.
 */

import type {
  ChatEvent,
  ChatSession,
  IChatProvider,
  SendMessageOptions,
} from "../core.js";
import type {
  AgentConfig,
  IAgentService,
} from "../../types.js";

// ─── Backend Adapter Options ───────────────────────────────────

/** Options for creating a backend adapter */
export interface BackendAdapterOptions {
  /** Agent configuration (model, systemPrompt, tools, etc.) */
  agentConfig: AgentConfig;
  /** Pre-created agent service (if adapter should not own lifecycle) */
  agentService?: IAgentService;
}

// ─── Backend Adapter Interface ─────────────────────────────────

/**
 * Extended chat provider with session resume support.
 * Adapters wrap an IAgentService, manage its lifecycle,
 * and bridge AgentEvent → ChatEvent via the existing bridge.
 */
export interface IBackendAdapter extends IChatProvider {
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

  /** The underlying agent service (for advanced consumers) */
  readonly agentService: IAgentService;
}
