/**
 * @witqq/agent-sdk/chat/react — ChatInputArea
 *
 * Input area combining the unified provider/model selector with the composer.
 */

import { createElement, type ReactNode, type ComponentType } from "react";
import { Composer, type ComposerProps } from "./Composer.js";
import { ProviderModelSelector, type ProviderModelSelectorProps } from "./ProviderModelSelector.js";
import { UsageBadge } from "./UsageBadge.js";
import type { ChatUsage } from "./useChat.js";
import type { ProviderConfig } from "../provider-types.js";
import type { ModelOption } from "./useModels.js";

/** Props for the ChatInputArea component. */
export interface ChatInputAreaProps {
  /** Send message handler. */
  onSend: (message: string) => void;
  /** Stop generation handler. */
  onStop?: () => void;
  /** Whether generation is in progress. */
  isGenerating?: boolean;
  /** Placeholder text for the textarea. */
  placeholder?: string;
  /** Available providers. */
  providers?: ProviderConfig[];
  /** Available models. */
  models?: ModelOption[];
  /** Active provider ID. */
  activeProviderId?: string;
  /** Selected model. */
  selectedModel?: string;
  /** Provider selection handler. */
  onSelectProvider?: (id: string) => void;
  /** Model selection handler. */
  onSelectModel?: (modelId: string) => void;
  /** Settings button handler. */
  onSettingsClick?: () => void;
  /** Slot override for Composer. */
  ComposerComponent?: ComponentType<ComposerProps>;
  /** Slot override for ProviderModelSelector. */
  ProviderModelSelectorComponent?: ComponentType<ProviderModelSelectorProps>;
  /** Token usage data to display. */
  usage?: ChatUsage | null;
}

/**
 * Input area — unified selector + composer in a `[data-chat-input-area]` container.
 */
export function ChatInputArea({
  onSend,
  onStop,
  isGenerating,
  placeholder,
  providers = [],
  models = [],
  activeProviderId,
  selectedModel,
  onSelectProvider,
  onSelectModel,
  onSettingsClick,
  ComposerComponent: CC = Composer,
  ProviderModelSelectorComponent: PMSC = ProviderModelSelector,
  usage,
}: ChatInputAreaProps): ReactNode {
  const selectorRow = createElement("div", { "data-chat-input-controls": "" },
    createElement(PMSC, {
      providers,
      models,
      activeProviderId,
      selectedModel,
      onSelectProvider,
      onSelectModel,
      onSettingsClick,
    }),
    usage ? createElement(UsageBadge, { usage }) : null,
  );

  return createElement("div", { "data-chat-input-area": "" },
    createElement("div", { "data-chat-input-container": "" },
      selectorRow,
      createElement(CC, {
        onSend,
        onStop,
        isGenerating,
        placeholder,
      }),
    ),
  );
}
