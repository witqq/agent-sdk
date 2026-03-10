/**
 * @witqq/agent-sdk/chat/backends/mock-llm
 *
 * MockLLMChatAdapter wraps MockLLMService for chat use.
 * No auth, no credentials — fully deterministic testing backend.
 */

import type { IAgentService, IAgent, MockLLMBackendOptions } from "../../types.js";
import type { BackendAdapterOptions } from "./types.js";
import { BaseBackendAdapter } from "./base.js";
import { createMockLLMService } from "../../backends/mock-llm.js";

// ─── MockLLM-Specific Options ──────────────────────────────────

/** Options for creating a MockLLMChatAdapter */
export interface MockLLMChatAdapterOptions extends BackendAdapterOptions {
  /** MockLLM backend options (mode, latency, streaming, etc.) */
  mockOptions?: MockLLMBackendOptions;
}

// ─── MockLLMChatAdapter ────────────────────────────────────────

/**
 * Backend adapter for Mock LLM.
 * Zero-auth, deterministic, fully configurable for E2E testing.
 */
export class MockLLMChatAdapter extends BaseBackendAdapter {
  constructor(options: MockLLMChatAdapterOptions) {
    // Use agentServiceFactory to avoid the base-class constructor calling
    // createService() before subclass fields are initialised.
    const mockOpts = options.mockOptions;
    super("mock-llm", {
      ...options,
      agentServiceFactory: () => createMockLLMService(mockOpts || {}),
    });
  }

  protected createService(): IAgentService {
    // Only reached if agentServiceFactory is not provided (never in practice).
    return createMockLLMService({});
  }

  protected captureSessionId(_agent: IAgent): void {
    // Mock LLM has no persistent sessions — no-op
  }
}
