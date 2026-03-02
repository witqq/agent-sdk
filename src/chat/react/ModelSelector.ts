import {
  createElement,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import type { ModelOption } from "./useModels.js";

/** Props for the ModelSelector component. */
export interface ModelSelectorProps {
  models: ModelOption[];
  selectedModel?: string;
  onSelect: (modelId: string) => void;
  placeholder?: string;
  className?: string;
  /** Allow free-text model input when models list is empty. Default: true. */
  allowFreeText?: boolean;
}

/**
 * Dropdown model selector with search and keyboard navigation.
 * Falls back to a free-text input when models list is empty.
 */
export function ModelSelector({
  models,
  selectedModel,
  onSelect,
  placeholder = "Select model",
  className,
  allowFreeText = true,
}: ModelSelectorProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [freeText, setFreeText] = useState(selectedModel ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search) return models;
    const q = search.toLowerCase();
    return models.filter((m) => m.name.toLowerCase().includes(q));
  }, [models, search]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [filtered.length]);

  const selectedInfo = useMemo(
    () => models.find((m) => m.id === selectedModel),
    [models, selectedModel],
  );

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
    (modelId: string) => {
      onSelect(modelId);
      setOpen(false);
      setSearch("");
    },
    [onSelect],
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
          handleSelect(filtered[highlightIndex].id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    },
    [filtered, highlightIndex, handleSelect],
  );

  // Free-text mode when no models available and allowFreeText is true
  if (models.length === 0 && allowFreeText) {
    return createElement(
      "div",
      {
        "data-model-selector": "true",
        "data-model-selector-freetext": "true",
        className,
        ref: containerRef,
      },
      createElement("input", {
        "data-model-input": "true",
        value: freeText,
        placeholder: "Enter model name...",
        onChange: (e: Event) => setFreeText((e.target as HTMLInputElement).value),
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const val = freeText.trim();
            if (val) onSelect(val);
          }
        },
      }),
      createElement(
        "button",
        {
          type: "button",
          "data-action": "apply-model",
          onClick: () => {
            const val = freeText.trim();
            if (val) onSelect(val);
          },
        },
        "Apply",
      ),
    );
  }

  const children: ReactNode[] = [];

  // Trigger button
  children.push(
    createElement(
      "button",
      {
        key: "trigger",
        "data-model-selector-trigger": "true",
        onClick: handleToggle,
        type: "button",
      },
      selectedInfo ? selectedInfo.name : placeholder,
    ),
  );

  // Dropdown panel
  if (open) {
    const dropdownChildren: ReactNode[] = [];

    // Search input
    dropdownChildren.push(
      createElement("input", {
        key: "search",
        "data-model-selector-search": "true",
        value: search,
        onChange: handleSearchChange,
        onKeyDown: handleKeyDown,
        placeholder: "Search models...",
        autoFocus: true,
      }),
    );

    // Model options
    const hasMultipleProviders = new Set(filtered.map((m) => m.provider).filter(Boolean)).size > 1;
    filtered.forEach((model, idx) => {
      const isSelected = model.id === selectedModel;
      const isHighlighted = idx === highlightIndex;
      const attrs: Record<string, unknown> = {
        key: model.id,
        "data-model-option": "true",
        onClick: () => handleSelect(model.id),
      };
      if (model.tier) {
        attrs["data-tier"] = model.tier;
      }
      if (model.provider && hasMultipleProviders) {
        attrs["data-model-provider"] = model.provider;
      }
      if (isSelected) {
        attrs["data-model-selected"] = "true";
      }
      if (isHighlighted) {
        attrs["data-model-highlighted"] = "true";
      }
      const label = model.provider && hasMultipleProviders
        ? `${model.name} (${model.provider})`
        : model.name;
      dropdownChildren.push(createElement("div", attrs, label));
    });

    children.push(
      createElement(
        "div",
        { key: "dropdown", "data-model-selector-dropdown": "true" },
        ...dropdownChildren,
      ),
    );
  }

  return createElement(
    "div",
    {
      "data-model-selector": "true",
      className,
      ref: containerRef,
    },
    ...children,
  );
}
