/**
 * @witqq/agent-sdk/chat/react — ChatHeader
 *
 * Selector composition for the chat header area. Renders backend selector,
 * model selector, or nothing based on configuration.
 */

import { createElement, type ReactNode, type ComponentType } from "react";
import { BackendSelector, type BackendSelectorProps } from "./BackendSelector.js";
import { ModelSelector, type ModelSelectorProps } from "./ModelSelector.js";
import type { ModelOption } from "./useModels.js";
import type { BackendInfo } from "../runtime.js";

/** Props for the ChatHeader component. */
export interface ChatHeaderProps {
  /** Whether to show backend selector. Default: false. */
  showBackendSelector?: boolean;
  /** Whether to show model selector. Default: true. */
  showModelSelector?: boolean;
  /** Whether providers are configured (hides model selector when true). */
  hasProviders?: boolean;
  /** Available backends list. */
  backends?: BackendInfo[];
  /** Available models list. */
  models?: ModelOption[];
  /** Currently selected model. */
  selectedModel?: string;
  /** Backend selection handler. */
  onBackendSelect?: (name: string) => void;
  /** Model selection handler. */
  onModelSelect?: (modelId: string) => void;
  /** Slot override for BackendSelector. */
  BackendSelectorComponent?: ComponentType<BackendSelectorProps>;
  /** Slot override for ModelSelector. */
  ModelSelectorComponent?: ComponentType<ModelSelectorProps>;
}

/**
 * Header area with backend and model selectors.
 * Returns null when no selectors need to be shown.
 */
export function ChatHeader({
  showBackendSelector = false,
  showModelSelector = true,
  hasProviders = false,
  backends = [],
  models = [],
  selectedModel,
  onBackendSelect,
  onModelSelect,
  BackendSelectorComponent: BSC = BackendSelector,
  ModelSelectorComponent: MSC = ModelSelector,
}: ChatHeaderProps): ReactNode {
  const children: ReactNode[] = [];

  if (showBackendSelector) {
    children.push(
      createElement(BSC, {
        key: "backend-selector",
        backends,
        onSelect: onBackendSelect ?? (() => {}),
      }),
    );
  }

  // Standalone model selector: shown when no providers and models available
  if (showModelSelector && !hasProviders && models.length > 0) {
    children.push(
      createElement(MSC, {
        key: "model-selector",
        models,
        selectedModel,
        onSelect: onModelSelect ?? (() => {}),
      }),
    );
  }

  if (children.length === 0) return null;
  return createElement("div", { "data-chat-header": "" }, ...children);
}
