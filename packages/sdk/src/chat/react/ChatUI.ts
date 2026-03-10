/**
 * @witqq/agent-sdk/chat/react — ChatUI
 *
 * Composite component that wires Thread, Composer, ThreadList, ModelSelector,
 * and ProviderSettings into a complete chat interface. Consumers get a full AI chat
 * in ~3 lines:
 *
 *   import { ChatUI } from "@witqq/agent-sdk/chat/react";
 *   <ChatUI runtime={myRuntime} />
 *
 * Slot system: replace any sub-component while keeping all others as defaults.
 *
 * Built from composable sub-components: ChatLayout, ChatHeader, ChatInputArea,
 * ChatSettingsOverlay — each usable independently for custom layouts.
 */

import {
  createElement,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type ComponentType,
} from "react";
import type { ChatMessage, ReasoningPart, ToolCallPart } from "../core.js";
import type { ContextStats } from "../context.js";
import type { IChatClient } from "../runtime.js";
import { ChatProvider, useChatRuntime } from "./ChatProvider.js";
import { useChat } from "./useChat.js";
import { useSessions } from "./useSessions.js";
import { useModels } from "./useModels.js";
import { useBackends } from "./useBackends.js";
import { useProviders } from "./useProviders.js";
import { Thread, type ThreadProps } from "./Thread.js";
import { type ComposerProps } from "./Composer.js";
import { ThreadList, type ThreadListProps } from "./ThreadList.js";
import { type ModelSelectorProps } from "./ModelSelector.js";
import { type BackendSelectorProps } from "./BackendSelector.js";
import type { ProviderSelectorProps } from "./ProviderSelector.js";
import { type ProviderModelSelectorProps } from "./ProviderModelSelector.js";
import { type ProviderSettingsProps } from "./ProviderSettings.js";
import { ContextStatsDisplay, type ContextStatsDisplayProps } from "./ContextStatsDisplay.js";
import { ThreadProvider } from "./ThreadSlots.js";
import { ChatLayout } from "./ChatLayout.js";
import { ChatHeader } from "./ChatHeader.js";
import { ChatInputArea } from "./ChatInputArea.js";
import { ChatSettingsOverlay } from "./ChatSettingsOverlay.js";

/** Slot overrides for ChatUI sub-components. */
export interface ChatUISlots {
  /** Replace the Thread component. */
  thread?: ComponentType<ThreadProps>;
  /** Replace the Composer component. */
  composer?: ComponentType<ComposerProps>;
  /** Replace the ThreadList (sidebar) component. */
  threadList?: ComponentType<ThreadListProps>;
  /** Replace the ModelSelector component (used in header when no providers). */
  modelSelector?: ComponentType<ModelSelectorProps>;
  /** Replace the BackendSelector component. */
  backendSelector?: ComponentType<BackendSelectorProps>;
  /** Replace the ProviderSelector component (legacy, use providerModelSelector). */
  providerSelector?: ComponentType<ProviderSelectorProps>;
  /** Replace the unified ProviderModelSelector component (near composer). */
  providerModelSelector?: ComponentType<ProviderModelSelectorProps>;
  /** Replace the ProviderSettings component. */
  providerSettings?: ComponentType<ProviderSettingsProps>;
  /** Replace the ContextStatsDisplay component. */
  contextStats?: ComponentType<ContextStatsDisplayProps>;
  /** Custom auth dialog element rendered when provided. */
  authDialog?: ReactNode;
  /** Custom message renderer (forwarded to ThreadProvider). */
  renderMessage?: (message: ChatMessage, index: number) => ReactNode;
  /** Custom tool call renderer (forwarded to ThreadProvider). */
  renderToolCall?: (part: ToolCallPart, index: number) => ReactNode;
  /** Custom thinking block renderer (forwarded to ThreadProvider). */
  renderThinkingBlock?: (part: ReasoningPart, index: number) => ReactNode;
}

/** Props for the ChatUI composite component. */
export interface ChatUIProps {
  /** The chat runtime or client instance. ChatUI wraps it in ChatProvider. Accepts IChatClient. */
  runtime: IChatClient;
  /** Slot overrides for sub-components. */
  slots?: ChatUISlots;
  /** CSS class on the root element. */
  className?: string;
  /** Show the session sidebar. Default: true. */
  showSidebar?: boolean;
  /** Show the model selector header. Default: true. */
  showModelSelector?: boolean;
  /** Show the backend selector in header. Default: false. */
  showBackendSelector?: boolean;
  /** Show the provider selector near composer. Default: auto (true when providers available). */
  showProviderSelector?: boolean;
  /** Base URL for auth API (needed by ProviderSettings). */
  authBaseUrl?: string;
  /** Placeholder text for the Composer textarea. */
  placeholder?: string;
}

/**
 * Internal component rendered inside ChatProvider.
 * Uses hooks that require the ChatProvider context.
 */
function ChatUIInner({
  slots,
  className,
  showSidebar = true,
  showModelSelector = true,
  showBackendSelector: showBackendSelectorProp,
  showProviderSelector: _showProviderSelectorProp,
  authBaseUrl,
  placeholder,
}: Omit<ChatUIProps, "runtime">): ReactNode {
  const runtime = useChatRuntime();
  const { messages, sendMessage, stop, isGenerating, newSession, error, clearError, retryLastMessage, usage } = useChat();
  const { sessions } = useSessions();
  const { models, refresh: refreshModels } = useModels();
  const { backends } = useBackends();
  const { providers, createProvider, updateProvider, deleteProvider, selectProvider, refresh } = useProviders();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState<string | undefined>(undefined);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

  const hasProviders = providers.length > 0;

  // Track active provider — initialize from first provider, update on switch
  useEffect(() => {
    if (providers.length > 0 && !activeProviderId) {
      setActiveProviderId(providers[0].id);
      selectProvider(providers[0].id);
    }
  }, [providers, activeProviderId, selectProvider]);

  const showBackendSelectorResolved = showBackendSelectorProp ?? false;

  const handleSelect = useCallback(async (id: string) => {
    try { await runtime.switchSession(id); } catch { /* session may not exist */ }
  }, [runtime]);

  const handleCreate = useCallback(async () => {
    try { await newSession(); } catch { /* best effort */ }
  }, [newSession]);

  const handleDelete = useCallback(async (id: string) => {
    try { await runtime.deleteSession(id); } catch { /* best effort */ }
  }, [runtime]);

  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
  }, []);

  const handleBackendSelect = useCallback((_name: string) => {
    refreshModels();
  }, [refreshModels]);

  const handleProviderSelect = useCallback((id: string) => {
    selectProvider(id);
    setActiveProviderId(id);
  }, [selectProvider]);

  const hasSlotOverrides = !!(slots?.renderToolCall || slots?.renderMessage || slots?.renderThinkingBlock);
  const ThreadComponent = slots?.thread ?? Thread;
  const ThreadListComponent = slots?.threadList ?? ThreadList;
  const ContextStatsComponent = slots?.contextStats ?? ContextStatsDisplay;

  // Context stats — getContextStats may be sync (IChatRuntime) or async (RemoteChatClient)
  const [contextStats, setContextStats] = useState<ContextStats | null>(null);
  useEffect(() => {
    if (!runtime.activeSessionId) {
      setContextStats(null);
      return;
    }
    const result = runtime.getContextStats(runtime.activeSessionId);
    if (result instanceof Promise) {
      result.then(setContextStats, () => setContextStats(null));
    } else {
      setContextStats(result);
    }
  }, [runtime, runtime.activeSessionId, messages.length]);

  // Empty state: shown when no providers connected and no messages
  const showEmptyState = !hasProviders && messages.length === 0;

  const mainContent = createElement("div", { "data-chat-main": "" },
    createElement(ChatHeader, {
      showBackendSelector: showBackendSelectorResolved,
      showModelSelector,
      hasProviders,
      backends,
      models,
      selectedModel: selectedModelId,
      onBackendSelect: handleBackendSelect,
      onModelSelect: handleModelSelect,
      BackendSelectorComponent: slots?.backendSelector,
      ModelSelectorComponent: slots?.modelSelector,
    }),
    contextStats ? createElement(ContextStatsComponent, { stats: contextStats }) : null,
    error
      ? createElement("div", { "data-chat-error": "" },
          createElement("span", { "data-chat-error-text": "" }, error.message),
          createElement("div", { "data-chat-error-actions": "" },
            createElement("button", {
              "data-action": "retry",
              type: "button",
              onClick: retryLastMessage,
            }, "Retry"),
            createElement("button", {
              "data-action": "dismiss-error",
              type: "button",
              onClick: clearError,
            }, "✕"),
          ),
          error.stack
            ? createElement("details", { "data-chat-error-details": "" },
                createElement("summary", null, "Details"),
                createElement("pre", null, error.stack),
              )
            : null,
        )
      : null,
    showEmptyState
      ? createElement("div", { "data-chat-empty-state": "" },
          createElement("div", { "data-chat-empty-title": "" }, "Connect a provider to start chatting"),
          createElement("button", {
            "data-action": "open-settings",
            onClick: () => setSettingsOpen(true),
          }, "+ Connect Provider"),
        )
      : createElement(ThreadComponent, { messages, isGenerating, autoScroll: true }),
    createElement(ChatInputArea, {
      onSend: sendMessage,
      onStop: stop,
      isGenerating,
      placeholder,
      providers,
      models,
      activeProviderId,
      selectedModel: selectedModelId,
      onSelectProvider: handleProviderSelect,
      onSelectModel: handleModelSelect,
      onSettingsClick: () => setSettingsOpen(true),
      ComposerComponent: slots?.composer,
      ProviderModelSelectorComponent: slots?.providerModelSelector,
      usage,
    }),
  );

  const wrappedMain = hasSlotOverrides
    ? createElement(ThreadProvider, {
        renderToolCall: slots!.renderToolCall,
        renderMessage: slots!.renderMessage,
        renderThinkingBlock: slots!.renderThinkingBlock,
        children: mainContent,
      })
    : mainContent;

  const sidebar = showSidebar
    ? createElement(ThreadListComponent, {
        sessions,
        activeSessionId: runtime.activeSessionId ?? undefined,
        onSelect: handleSelect,
        onCreate: handleCreate,
        onDelete: handleDelete,
        searchQuery,
        onSearchChange: setSearchQuery,
      })
    : undefined;

  const settingsOverlay = createElement(ChatSettingsOverlay, {
    open: settingsOpen,
    onClose: () => setSettingsOpen(false),
    providers,
    authBaseUrl,
    onProviderCreated: (p) => createProvider({ backend: p.backend, model: p.model, label: p.label ?? "" }),
    onProviderDeleted: (id) => deleteProvider(id),
    onProviderUpdated: (id, changes) => updateProvider(id, changes),
    onAuthCompleted: () => refresh(),
    ProviderSettingsComponent: slots?.providerSettings,
  });

  return createElement(ChatLayout, {
    className,
    sidebar,
    overlay: [slots?.authDialog ?? null, settingsOverlay],
    children: wrappedMain,
  });
}

/**
 * Composite chat component — complete AI chat interface in one import.
 *
 * ```tsx
 * import { ChatUI } from "@witqq/agent-sdk/chat/react";
 *
 * function App() {
 *   return <ChatUI runtime={myRuntime} />;
 * }
 * ```
 */
export function ChatUI({ runtime, ...rest }: ChatUIProps): ReactNode {
  return createElement(ChatProvider, {
    runtime,
    children: createElement(ChatUIInner, rest),
  });
}
