/**
 * @witqq/agent-sdk/chat/backends/copilot
 *
 * CopilotChatAdapter wraps CopilotAgentService for chat use.
 * Supports persistent session mode for canResume/resume.
 */

import type {
  IAgentService,
  CopilotBackendOptions,
} from "../../types.js";
import type { BackendAdapterOptions } from "./types.js";
import { ResumableChatAdapter } from "./resumable.js";

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
export class CopilotChatAdapter extends ResumableChatAdapter {
  private readonly _copilotOptions?: CopilotBackendOptions;

  constructor(options: CopilotChatAdapterOptions) {
    super("copilot", options);
    this._copilotOptions = options.copilotOptions;
  }

  protected createService(): IAgentService {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCopilotService } = require("../../backends/copilot.js");
    return createCopilotService(this._copilotOptions || {});
  }
}
