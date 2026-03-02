/**
 * @witqq/agent-sdk/testing
 *
 * Test utilities for consumers of the agent-sdk.
 * Provides mock factories for IAgentService, IChatRuntime, and IChatClient.
 *
 * @module @witqq/agent-sdk/testing
 */

export {
  createMockAgentService,
  type MockAgentServiceOptions,
} from "./mock-agent-service.js";

export {
  createMockRuntime,
  type MockRuntimeOptions,
} from "./mock-runtime.js";

export {
  createMockChatClient,
  type MockChatClientOptions,
} from "./mock-chat-client.js";

export {
  createMockSession,
  createMockMessage,
  type MockSessionOptions,
  type MockMessageOptions,
} from "./mock-data.js";
