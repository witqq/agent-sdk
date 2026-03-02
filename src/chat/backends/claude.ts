/**
 * @witqq/agent-sdk/chat/backends/claude
 *
 * ClaudeChatAdapter wraps ClaudeAgentService for chat use.
 * Supports persistent session mode with Claude's session_id for resume.
 */

import type {
  IAgentService,
  ClaudeBackendOptions,
} from "../../types.js";
import type { BackendAdapterOptions } from "./types.js";
import { ResumableChatAdapter } from "./resumable.js";

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
export class ClaudeChatAdapter extends ResumableChatAdapter {
  private readonly _claudeOptions?: ClaudeBackendOptions;

  constructor(options: ClaudeChatAdapterOptions) {
    super("claude", options);
    this._claudeOptions = options.claudeOptions;
  }

  protected createService(): IAgentService {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClaudeService } = require("../../backends/claude.js");
    return createClaudeService(this._claudeOptions || {});
  }
}
