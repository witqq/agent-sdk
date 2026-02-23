/**
 * React bindings for agent-sdk chat module.
 *
 * Headless hooks and components that wrap IChatRuntime
 * for building chat UIs with minimal boilerplate.
 *
 * @module @witqq/agent-sdk/chat/react
 */

export { ChatProvider, useChatRuntime } from "./ChatProvider.js";
export { useChat } from "./useChat.js";
export type { UseChatOptions, UseChatReturn } from "./useChat.js";
export { useMessages } from "./useMessages.js";
export type { UseMessagesOptions, UseMessagesReturn } from "./useMessages.js";
export { useSessions } from "./useSessions.js";
export type { UseSessionsReturn } from "./useSessions.js";
export { Message } from "./Message.js";
export type { MessageProps } from "./Message.js";
export { ThinkingBlock } from "./ThinkingBlock.js";
export type { ThinkingBlockProps } from "./ThinkingBlock.js";
export { ToolCallView } from "./ToolCallView.js";
export type { ToolCallViewProps } from "./ToolCallView.js";
export { useToolApproval } from "./useToolApproval.js";
export type { UseToolApprovalReturn, PendingToolRequest } from "./useToolApproval.js";
export { MarkdownRenderer } from "./MarkdownRenderer.js";
export type { MarkdownRendererProps } from "./MarkdownRenderer.js";
export { Thread } from "./Thread.js";
export type { ThreadProps } from "./Thread.js";
export { Composer } from "./Composer.js";
export type { ComposerProps } from "./Composer.js";
export { ThreadProvider, useThreadSlots, useOptionalThreadSlots } from "./ThreadSlots.js";
export type { ThreadSlotOverrides, ThreadProviderProps } from "./ThreadSlots.js";
export { ThreadList } from "./ThreadList.js";
export type { ThreadListProps } from "./ThreadList.js";
export { useSSE } from "./useSSE.js";
export type { SSEStatus, UseSSEOptions, UseSSEReturn } from "./useSSE.js";
export { useModels } from "./useModels.js";
export type { ModelInfo, ModelOption, UseModelsReturn } from "./useModels.js";
export { ModelSelector } from "./ModelSelector.js";
export type { ModelSelectorProps } from "./ModelSelector.js";
export { useAuth } from "./useAuth.js";
export type {
  AuthBackend,
  AuthStatus,
  UseAuthOptions,
  UseAuthReturn,
} from "./useAuth.js";
export { useRemoteAuth } from "./useRemoteAuth.js";
export type {
  RemoteAuthBackend,
  RemoteAuthStatus,
  UseRemoteAuthOptions,
  UseRemoteAuthReturn,
} from "./useRemoteAuth.js";
export { useRemoteChat } from "./useRemoteChat.js";
export type {
  RemoteChatPhase,
  UseRemoteChatOptions,
  UseRemoteChatReturn,
} from "./useRemoteChat.js";
export { AuthDialog } from "./AuthDialog.js";
export type { AuthDialogProps } from "./AuthDialog.js";
export { RemoteChatRuntime } from "./RemoteChatRuntime.js";
export type { RemoteChatRuntimeOptions } from "./RemoteChatRuntime.js";
