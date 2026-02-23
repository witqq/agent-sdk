/**
 * @witqq/agent-sdk/chat/backends/claude
 *
 * ClaudeChatAdapter wraps ClaudeAgentService for chat use.
 * Supports persistent session mode with Claude's session_id for resume.
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
  ClaudeBackendOptions,
  Message,
} from "../../types.js";
import { BaseBackendAdapter } from "./base.js";
import type { BackendAdapterOptions } from "./types.js";

// ─── Claude-Specific Options ──────────────────────────────────

/** Options for creating a ClaudeChatAdapter */
export interface ClaudeChatAdapterOptions extends BackendAdapterOptions {
  /** Claude backend options (cliPath, model, etc.) */
  claudeOptions?: ClaudeBackendOptions;
}

// ─── ClaudeChatAdapter ─────────────────────────────────────────

/**
 * Backend adapter for Claude CLI.
 * Uses persistent session mode for session resume via Claude's session_id.
 */
export class ClaudeChatAdapter extends BaseBackendAdapter {
  private _backendSessionId: string | null = null;
  private readonly _claudeOptions?: ClaudeBackendOptions;

  constructor(options: ClaudeChatAdapterOptions) {
    // Force persistent session mode for resume support
    const agentConfig = {
      ...options.agentConfig,
      sessionMode: "persistent" as const,
    };
    super("claude", { ...options, agentConfig });
    this._claudeOptions = options.claudeOptions;
  }

  protected createService(): IAgentService {
    // Lazy import to avoid requiring @anthropic-ai/claude-agent-sdk at load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAgentService } = require("../../index.js");
    return createAgentService("claude", this._claudeOptions);
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
