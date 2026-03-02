/**
 * @witqq/agent-sdk/chat/core
 *
 * Barrel re-export of chat domain types, guards, bridge, conversion, and utilities.
 * Modularized into focused files — this file preserves the public API surface.
 */

// Domain types
export type {
  ChatId,
  ChatIdLike,
  PartStatus,
  ToolCallStatus,
  MessageStatus,
  SessionStatus,
  RuntimeStatus,
  TextPart,
  ReasoningPart,
  ToolCallPart,
  SourcePart,
  FilePart,
  MessagePart,
  ChatRole,
  ChatMessageMetadata,
  ChatMessageStatus,
  ChatMessage,
  ChatSessionConfig,
  ChatSessionMetadata,
  ChatSession,
  ObservableSession,
  SessionInfo,
  ChatEvent,
  ChatEventType,
  ChatMiddlewareContext,
  ChatMiddleware,
  SendMessageOptions,
  RuntimeSendOptions,
  IChatProvider,
} from "./types.js";

// ID generation, message factories, and utilities
export { createChatId, toChatId, createTextMessage, isObservableSession } from "./types.js";
export { getMessageText, getMessageToolCalls, getMessageReasoning } from "./chat-utils.js";

// Type guards
export {
  isChatMessage,
  isChatSession,
  isMessagePart,
  isTextPart,
  isToolCallPart,
  isReasoningPart,
  isSourcePart,
  isFilePart,
  isChatEvent,
} from "./guards.js";

// AgentEvent ↔ ChatEvent bridge
export { agentEventToChatEvent, adaptAgentEvents, chatEventToAgentEvent } from "./bridge.js";

// Message conversion (ChatMessage ↔ agent-sdk Message)
export { toAgentMessage, fromAgentMessage, extractToolResults } from "./conversion.js";
