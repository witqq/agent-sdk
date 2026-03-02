/**
 * @witqq/agent-sdk/chat
 *
 * Barrel re-export of the most commonly needed consumer types from
 * the Chat SDK.  For granular imports use the individual sub-paths
 * (e.g. `@witqq/agent-sdk/chat/core`).
 *
 * Excludes React bindings (`/chat/react`) and server utilities
 * (`/chat/server`) — import those directly when needed.
 */

// ─── Core types & utilities ────────────────────────────────────

export {
  // IDs
  type ChatId,
  type ChatIdLike,
  createChatId,
  toChatId,
  // Message types
  type ChatMessage,
  type ChatMessageMetadata,
  type MessagePart,
  type TextPart,
  type ReasoningPart,
  type ToolCallPart,
  type SourcePart,
  type FilePart,
  type PartStatus,
  type ToolCallStatus,
  type MessageStatus,
  type ChatMessageStatus,
  type ChatRole,
  // Session types
  type ChatSession,
  type ObservableSession,
  type SessionInfo,
  type ChatSessionConfig,
  type SessionStatus,
  type RuntimeStatus,
  // Event types
  type ChatEvent,
  type ChatEventType,
  // Provider interface
  /** @deprecated Use IChatBackend from "@witqq/agent-sdk/chat/backends" */
  type IChatProvider,
  type ChatMiddleware,
  type ChatMiddlewareContext,
  type SendMessageOptions,
  type RuntimeSendOptions,
  // Type guards
  isChatMessage,
  isChatSession,
  isMessagePart,
  isTextPart,
  isReasoningPart,
  isToolCallPart,
  isSourcePart,
  isFilePart,
  isChatEvent,
  // Utilities
  getMessageText,
  getMessageToolCalls,
  getMessageReasoning,
  // Factories
  createTextMessage,
  isObservableSession,
  // Bridge
  agentEventToChatEvent,
  adaptAgentEvents,
  toAgentMessage,
  toAgentMessages,
  fromAgentMessage,
} from "./core.js";

// ─── Runtime ───────────────────────────────────────────────────

export {
  type IChatClient,
  type IChatRuntime,
  type IProviderClient,
  type ChatRuntimeOptions,
  type BackendAdapterFactory,
  type BackendInfo,
  type RetryConfig,
  type StreamRetryConfig,
  type SelectionChangeCallback,
  createChatRuntime,
} from "./runtime.js";

// ─── Session stores ────────────────────────────────────────────

export {
  type ISessionReader,
  type ISessionWriter,
  type IChatSessionStore,
  type PaginatedMessages,
  type CreateSessionOptions,
  InMemorySessionStore,
  FileSessionStore,
} from "./sessions.js";

// ─── Errors ────────────────────────────────────────────────────

export {
  ChatError,
  ErrorCode,
  classifyError,
  isRetryable,
  withRetry,
  ExponentialBackoffStrategy,
} from "./errors.js";

// ─── Utilities ─────────────────────────────────────────────────

export { ListenerSet } from "./listener-set.js";

// ─── Backend adapters ──────────────────────────────────────────

export {
  type IChatBackend,
  type IResumableBackend,
  type BackendAdapterOptions,
  isResumableBackend,
  BaseBackendAdapter,
  CopilotChatAdapter,
  ClaudeChatAdapter,
  VercelAIChatAdapter,
  type IChatTransport,
  SSEChatTransport,
  WsChatTransport,
  InProcessChatTransport,
  streamToTransport,
} from "./backends/index.js";

// ─── Context ───────────────────────────────────────────────────

export {
  ContextWindowManager,
  estimateTokens,
  type ContextWindowConfig,
  type ContextWindowResult,
  type ContextStats,
  type OverflowStrategy,
} from "./context.js";

// ─── Accumulator ───────────────────────────────────────────────

export { MessageAccumulator } from "./accumulator.js";
export { withStreamWatchdog } from "./watchdog.js";
export type { StreamWatchdogConfig } from "./watchdog.js";

// ─── Events ────────────────────────────────────────────────────

export {
  TypedEventEmitter,
  ChatEventBus,
} from "./events.js";

// ─── Provider types ────────────────────────────────────────────

export type {
  ProviderConfig,
  IProviderStore,
} from "./provider-types.js";
