/**
 * @witqq/agent-sdk/chat/backends/vercel-ai
 *
 * VercelAIChatAdapter wraps VercelAIAgentService for chat use.
 * Stateless adapter — canResume() always returns false.
 * Each streamMessage/sendMessage creates a fresh agent (per-call session mode).
 */

import type {
  ChatEvent,
  ChatSession,
  SendMessageOptions,
} from "../core.js";
import { ChatError, ChatErrorCode } from "../errors.js";
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
 */
export class VercelAIChatAdapter extends BaseBackendAdapter {
  private readonly _vercelOptions?: VercelAIBackendOptions;

  constructor(options: VercelAIChatAdapterOptions) {
    // Vercel AI is stateless — per-call session mode (default)
    super("vercel-ai", options);
    this._vercelOptions = options.vercelOptions;
  }

  protected createService(): IAgentService {
    // Lazy import to avoid requiring ai + @ai-sdk/openai-compatible at load time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAgentService } = require("../../index.js");
    return createAgentService("vercel-ai", this._vercelOptions);
  }

  get backendSessionId(): string | null {
    return null;
  }

  canResume(): boolean {
    return false;
  }

  async *resume(
    _session: ChatSession,
    _backendSessionId: string,
    _options?: SendMessageOptions,
  ): AsyncIterable<ChatEvent> {
    throw new ChatError(
      "Vercel AI adapter does not support session resume (stateless)",
      { code: ChatErrorCode.PROVIDER_ERROR },
    );
  }

  protected captureSessionId(_agent: IAgent): void {
    // No-op: Vercel AI is stateless, no session ID to capture
  }
}
