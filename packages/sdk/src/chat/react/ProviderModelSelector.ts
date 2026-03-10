import {
  createElement,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import type { ProviderConfig } from "../provider-types.js";
import type { ModelOption } from "./useModels.js";

/** A unified item rendered in the ProviderModelSelector dropdown. */
export interface ProviderModelItem {
  id: string;
  label: string;
  sublabel?: string;
  tier?: string;
  type: "provider" | "model";
}

/** Props for the ProviderModelSelector component. */
export interface ProviderModelSelectorProps {
  /** Configured providers (backend + model combos). When non-empty, provider mode is used. */
  providers?: ProviderConfig[];
  /** Available models. Used when providers is empty or undefined. */
  models?: ModelOption[];
  /** Currently selected provider ID. */
  activeProviderId?: string;
  /** Currently selected model ID (fallback mode). */
  selectedModel?: string;
  /** Called when a provider is selected. */
  onSelectProvider?: (id: string) => void;
  /** Called when a model is selected (fallback mode). */
  onSelectModel?: (modelId: string) => void;
  /** Called when settings gear is clicked. */
  onSettingsClick?: () => void;
  /** Placeholder text for the trigger button. */
  placeholder?: string;
  className?: string;
}

/**
 * Unified selector that shows providers when available, falls back to model list.
 * Replaces the need for separate ProviderSelector + ModelSelector in ChatUI.
 */
export function ProviderModelSelector({
  providers = [],
  models = [],
  activeProviderId,
  selectedModel,
  onSelectProvider,
  onSelectModel,
  onSettingsClick,
  placeholder = "Select model",
  className,
}: ProviderModelSelectorProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isProviderMode = providers.length > 0;

  // Build unified items list
  const items: ProviderModelItem[] = useMemo(() => {
    if (isProviderMode) {
      return providers.map((p) => ({
        id: p.id,
        label: p.label,
        sublabel: p.model,
        type: "provider" as const,
      }));
    }
    return models.map((m) => ({
      id: m.id,
      label: m.name,
      sublabel: m.provider,
      tier: m.tier,
      type: "model" as const,
    }));
  }, [isProviderMode, providers, models]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.sublabel && item.sublabel.toLowerCase().includes(q)),
    );
  }, [items, search]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered.length]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Resolve trigger label
  const triggerLabel = useMemo(() => {
    if (isProviderMode && activeProviderId) {
      const p = providers.find((prov) => prov.id === activeProviderId);
      return p ? p.label : placeholder;
    }
    if (!isProviderMode && selectedModel) {
      const m = models.find((mod) => mod.id === selectedModel);
      return m ? m.name : selectedModel;
    }
    return placeholder;
  }, [isProviderMode, activeProviderId, providers, selectedModel, models, placeholder]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        setSearch("");
        setHighlightIndex(0);
      }
      return !prev;
    });
  }, []);

  const handleSelect = useCallback(
    (item: ProviderModelItem) => {
      if (item.type === "provider" && onSelectProvider) {
        onSelectProvider(item.id);
      } else if (item.type === "model" && onSelectModel) {
        onSelectModel(item.id);
      }
      setOpen(false);
      setSearch("");
    },
    [onSelectProvider, onSelectModel],
  );

  const handleSearchChange = useCallback((e: Event) => {
    setSearch((e.target as HTMLInputElement).value);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[highlightIndex]) {
          handleSelect(filtered[highlightIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    },
    [filtered, highlightIndex, handleSelect],
  );

  const children: ReactNode[] = [];

  // Trigger button
  children.push(
    createElement(
      "button",
      {
        key: "trigger",
        type: "button",
        "data-pms-trigger": "true",
        onClick: handleToggle,
      },
      triggerLabel,
    ),
  );

  // Dropdown panel
  if (open) {
    const dropdownChildren: ReactNode[] = [];

    // Search input (only if more than a few items)
    if (items.length > 3) {
      dropdownChildren.push(
        createElement("input", {
          key: "search",
          "data-pms-search": "true",
          value: search,
          onChange: handleSearchChange,
          onKeyDown: handleKeyDown,
          placeholder: isProviderMode ? "Search providers..." : "Search models...",
          autoFocus: true,
        }),
      );
    }

    // Items
    filtered.forEach((item, idx) => {
      const isActive = isProviderMode
        ? item.id === activeProviderId
        : item.id === selectedModel;
      const isHighlighted = idx === highlightIndex;
      const attrs: Record<string, unknown> = {
        key: item.id,
        "data-pms-item": "true",
        "data-pms-type": item.type,
        onClick: () => handleSelect(item),
      };
      if (item.tier) attrs["data-tier"] = item.tier;
      if (isActive) attrs["data-pms-active"] = "true";
      if (isHighlighted) attrs["data-pms-highlighted"] = "true";

      const itemChildren: ReactNode[] = [
        createElement("span", { key: "label", "data-pms-label": "true" }, item.label),
      ];
      if (item.sublabel) {
        itemChildren.push(
          createElement("span", { key: "sub", "data-pms-sublabel": "true" }, item.sublabel),
        );
      }
      dropdownChildren.push(createElement("div", attrs, ...itemChildren));
    });

    // Settings button
    if (onSettingsClick) {
      dropdownChildren.push(
        createElement(
          "button",
          {
            key: "settings",
            type: "button",
            "data-pms-settings": "true",
            onClick: (e: Event) => {
              (e as Event).stopPropagation();
              setOpen(false);
              onSettingsClick();
            },
          },
          "⚙ Settings",
        ),
      );
    }

    children.push(
      createElement(
        "div",
        { key: "dropdown", "data-pms-dropdown": "true", onKeyDown: handleKeyDown },
        ...dropdownChildren,
      ),
    );
  }

  return createElement(
    "div",
    {
      "data-provider-model-selector": "true",
      "data-pms-mode": isProviderMode ? "provider" : "model",
      className,
      ref: containerRef,
    },
    ...children,
  );
}
