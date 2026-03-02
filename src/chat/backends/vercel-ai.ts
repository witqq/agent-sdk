/**
 * @witqq/agent-sdk/chat/backends/vercel-ai
 *
 * VercelAIChatAdapter wraps VercelAIAgentService for chat use.
 * Stateless adapter — implements IChatBackend only (no resume support).
 * Each streamMessage/sendMessage creates a fresh agent (per-call session mode).
 */

import type {
  IAgent,
  IAgentService,
  VercelAIBackendOptions,
} from "../../types.js";
import { BaseBackendAdapter } from "./base.js";
import type { BackendAdapterOptions } from "./types.js";

// ─── Vercel AI-Specific Options ────────────────────────────────

/** Options for creating a VercelAIChatAdapter */
export interface VercelAIChatAdapterOptions extends BackendAdapterOptions {
  /** Vercel AI backend options (baseURL, apiKey, provider, etc.) */
  vercelOptions?: VercelAIBackendOptions;
}

// ─── VercelAIChatAdapter ───────────────────────────────────────

/**
 * Backend adapter for Vercel AI SDK (API-based).
 * Stateless — each call creates a fresh agent. Does not support resume.
 * Implements IChatBackend only (no IResumableBackend).
 */
export class VercelAIChatAdapter extends BaseBackendAdapter {
  private readonly _vercelOptions?: VercelAIBackendOptions;

  constructor(options: VercelAIChatAdapterOptions) {
    // Vercel AI is stateless — per-call session mode (default)
    super("vercel-ai", options);
    this._vercelOptions = options.vercelOptions;
  }

  protected createService(): IAgentService {
    // Use synchronous factory directly (not the async registry createAgentService)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createVercelAIService } = require("../../backends/vercel-ai.js");
    return createVercelAIService(this._vercelOptions || {});
  }

  protected captureSessionId(_agent: IAgent): void {
    // No-op: Vercel AI is stateless, no session ID to capture
  }
}
