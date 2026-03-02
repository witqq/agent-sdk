/**
 * React bindings for agent-sdk chat module.
 *
 * Headless hooks and components that wrap IChatClient
 * for building chat UIs with minimal boilerplate.
 *
 * @module @witqq/agent-sdk/chat/react
 */

export { ChatProvider, useChatRuntime } from "./ChatProvider.js";
export { useChat } from "./useChat.js";
export type { UseChatOptions, UseChatReturn, ChatUsage } from "./useChat.js";
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
export type { ModelOption, UseModelsReturn } from "./useModels.js";
export { ModelSelector } from "./ModelSelector.js";
export type { ModelSelectorProps } from "./ModelSelector.js";
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
export { CopilotAuthForm } from "./auth/CopilotAuthForm.js";
export { ClaudeAuthForm } from "./auth/ClaudeAuthForm.js";
export { VercelAIAuthForm } from "./auth/VercelAIAuthForm.js";
export type { AuthFormProps, AuthFormComponent } from "./auth/types.js";
export { BackendSelector } from "./BackendSelector.js";
export type { BackendSelectorProps } from "./BackendSelector.js";
export { useBackends } from "./useBackends.js";
export type { UseBackendsReturn } from "./useBackends.js";
export { useProviders } from "./useProviders.js";
export type { UseProvidersReturn } from "./useProviders.js";
export { ProviderSelector } from "./ProviderSelector.js";
export type { ProviderSelectorProps } from "./ProviderSelector.js";
export { ProviderModelSelector } from "./ProviderModelSelector.js";
export type { ProviderModelSelectorProps, ProviderModelItem } from "./ProviderModelSelector.js";
export { ProviderSettings } from "./ProviderSettings.js";
export type { ProviderSettingsProps } from "./ProviderSettings.js";
export { ChatUI } from "./ChatUI.js";
export type { ChatUIProps, ChatUISlots } from "./ChatUI.js";
export { ChatLayout } from "./ChatLayout.js";
export type { ChatLayoutProps } from "./ChatLayout.js";
export { ChatHeader } from "./ChatHeader.js";
export type { ChatHeaderProps } from "./ChatHeader.js";
export { ChatInputArea } from "./ChatInputArea.js";
export type { ChatInputAreaProps } from "./ChatInputArea.js";
export { ChatSettingsOverlay } from "./ChatSettingsOverlay.js";
export type { ChatSettingsOverlayProps } from "./ChatSettingsOverlay.js";
export { UsageBadge } from "./UsageBadge.js";
export type { UsageBadgeProps } from "./UsageBadge.js";
export { ContextStatsDisplay } from "./ContextStatsDisplay.js";
export type { ContextStatsDisplayProps } from "./ContextStatsDisplay.js";
export { PermissionDialog } from "./PermissionDialog.js";
export type { PermissionDialogProps } from "./PermissionDialog.js";
export { useVirtualMessages } from "./useVirtualMessages.js";
export type {
  VirtualizeOptions,
  VirtualMessagesResult,
} from "./useVirtualMessages.js";
export { RemoteChatClient } from "./RemoteChatClient.js";
export type { RemoteChatClientOptions } from "./RemoteChatClient.js";
export { useCopilotAuth } from "./auth/useCopilotAuth.js";
export type { UseCopilotAuthOptions, UseCopilotAuthReturn } from "./auth/useCopilotAuth.js";
export { useClaudeAuth } from "./auth/useClaudeAuth.js";
export type { UseClaudeAuthOptions, UseClaudeAuthReturn } from "./auth/useClaudeAuth.js";
export { useApiKeyAuth } from "./auth/useApiKeyAuth.js";
export type { UseApiKeyAuthOptions, UseApiKeyAuthReturn } from "./auth/useApiKeyAuth.js";
