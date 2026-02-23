/**
 * @witqq/agent-sdk/chat/backends/copilot
 *
 * CopilotChatAdapter wraps CopilotAgentService for chat use.
 * Supports persistent session mode for canResume/resume.
 */

import type {
  ChatEvent,
  ChatSession,
  SendMessageOptions,
} from "../core.js";
import { toAgentMessage } from "../core.js";
import { ChatError, ChatErrorCode } from "../errors.js";
import type {
  IAgent,
  IAgentService,
  CopilotBackendOptions,
  Message,
} from "../../types.js";
import { BaseBackendAdapter } from "./base.js";
import type { BackendAdapterOptions } from "./types.js";

// ─── Copilot-Specific Options ──────────────────────────────────

/** Options for creating a CopilotChatAdapter */
export interface CopilotChatAdapterOptions extends BackendAdapterOptions {
  /** Copilot backend options (cliPath, token, etc.) */
  copilotOptions?: CopilotBackendOptions;
}

// ─── CopilotChatAdapter ────────────────────────────────────────

/**
 * Backend adapter for GitHub Copilot CLI.
 * Uses persistent session mode for session resume via CLI session ID.
 */
export class CopilotChatAdapter extends BaseBackendAdapter {
  private _backendSessionId: string | null = null;
  private readonly _copilotOptions?: CopilotBackendOptions;

  constructor(options: CopilotChatAdapterOptions) {
    // Force persistent session mode for resume support
    const agentConfig = {
      ...options.agentConfig,
      sessionMode: "persistent" as const,
    };
    super("copilot", { ...options, agentConfig });
    this._copilotOptions = options.copilotOptions;
  }

  protected createService(): IAgentService {
    // Lazy import to avoid requiring @github/copilot-sdk at load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAgentService } = require("../../index.js");
    return createAgentService("copilot", this._copilotOptions);
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
        code: ChatErrorCode.INVALID_INPUT,
      });
    }

    const agent = this.getOrCreateAgent(options);
    const currentSessionId = agent.sessionId;

    // No prior session — adapter was never streamed or session was lost
    if (!currentSessionId) {
      throw new ChatError(
        `No active session to resume (requested: ${backendSessionId})`,
        { code: ChatErrorCode.SESSION_NOT_FOUND },
      );
    }

    // Session ID mismatch — session expired or was replaced
    if (currentSessionId !== backendSessionId) {
      throw new ChatError(
        `Session expired: expected ${backendSessionId}, got ${currentSessionId}`,
        { code: ChatErrorCode.SESSION_EXPIRED },
      );
    }

    const messages: Message[] = session.messages.map(toAgentMessage);
    yield* this.streamAgentEvents(agent, messages, options);
  }

  protected captureSessionId(agent: IAgent): void {
    if (agent.sessionId) {
      this._backendSessionId = agent.sessionId;
    }
  }
}
