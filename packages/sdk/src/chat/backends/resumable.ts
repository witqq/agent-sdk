/**
 * @witqq/agent-sdk/chat/backends/resumable
 *
 * Abstract base for CLI-backed adapters with session resume support.
 * Shared by CopilotChatAdapter and ClaudeChatAdapter — the only
 * difference between them is createService() and constructor options.
 */

import type {
  ChatEvent,
  ChatSession,
  SendMessageOptions,
} from "../core.js";
import { toAgentMessages } from "../core.js";
import { ChatError, ErrorCode } from "../errors.js";
import type {
  IAgent,
  Message,
} from "../../types.js";
import { BaseBackendAdapter } from "./base.js";
import type { BackendAdapterOptions, IResumableBackend } from "./types.js";

/**
 * Abstract base for backend adapters that support session resume.
 * Handles backendSessionId tracking, canResume(), resume(), captureSessionId().
 * Subclasses only define constructor (with backend-specific options) and createService().
 */
export abstract class ResumableChatAdapter extends BaseBackendAdapter implements IResumableBackend {
  private _backendSessionId: string | null = null;

  constructor(name: string, options: BackendAdapterOptions) {
    // Force persistent session mode for resume support
    const agentConfig = {
      ...options.agentConfig,
      sessionMode: "persistent" as const,
    };
    super(name, { ...options, agentConfig });
  }

  get backendSessionId(): string | null {
    return this._backendSessionId;
  }

  canResume(): boolean {
    return this._backendSessionId !== null;
  }

  async *resume(
    session: ChatSession,
    backendSessionId: string,
    options?: SendMessageOptions,
  ): AsyncIterable<ChatEvent> {
    this.assertNotDisposed();

    if (!backendSessionId) {
      throw new ChatError("Backend session ID is required for resume", {
        code: ErrorCode.INVALID_INPUT,
      });
    }

    const agent = this.getOrCreateAgent(options);
    const currentSessionId = agent.sessionId;

    if (!currentSessionId) {
      throw new ChatError(
        `No active session to resume (requested: ${backendSessionId})`,
        { code: ErrorCode.SESSION_NOT_FOUND },
      );
    }

    if (currentSessionId !== backendSessionId) {
      throw new ChatError(
        `Session expired: expected ${backendSessionId}, got ${currentSessionId}`,
        { code: ErrorCode.SESSION_EXPIRED },
      );
    }

    const messages: Message[] = session.messages.flatMap(toAgentMessages);
    yield* this.streamAgentEvents(agent, messages, options);
  }

  protected captureSessionId(agent: IAgent): void {
    if (agent.sessionId) {
      this._backendSessionId = agent.sessionId;
    }
  }
}
