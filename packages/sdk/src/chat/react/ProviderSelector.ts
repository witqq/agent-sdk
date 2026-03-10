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

/** Props for the ProviderSelector component. */
export interface ProviderSelectorProps {
  providers: ProviderConfig[];
  activeProviderId?: string;
  onSelect: (id: string) => void;
  onSettingsClick?: () => void;
  className?: string;
}

/**
 * Headless dropdown for selecting a configured provider.
 * Uses data attributes for styling hooks. Follows ModelSelector pattern.
 */
export function ProviderSelector({
  providers,
  activeProviderId,
  onSelect,
  onSettingsClick,
  className,
}: ProviderSelectorProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeProvider = useMemo(
    () => providers.find((p) => p.id === activeProviderId),
    [providers, activeProviderId],
  );

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

  useEffect(() => {
    setHighlightIndex(0);
  }, [providers.length]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) setHighlightIndex(0);
      return !prev;
    });
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      setOpen(false);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, providers.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (providers[highlightIndex]) {
          handleSelect(providers[highlightIndex].id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    },
    [providers, highlightIndex, handleSelect],
  );

  const children: ReactNode[] = [];

  // Trigger button
  children.push(
    createElement(
      "button",
      {
        key: "trigger",
        type: "button",
        "data-provider-trigger": "true",
        onClick: handleToggle,
        onKeyDown: handleKeyDown,
      },
      activeProvider ? activeProvider.label : "Select provider",
    ),
  );

  // Dropdown panel
  if (open) {
    const dropdownChildren: ReactNode[] = [];

    providers.forEach((provider, idx) => {
      const isActive = provider.id === activeProviderId;
      const isHighlighted = idx === highlightIndex;
      const attrs: Record<string, unknown> = {
        key: provider.id,
        "data-provider-item": "true",
        onClick: () => handleSelect(provider.id),
      };
      if (isActive) attrs["data-provider-active"] = "true";
      if (isHighlighted) attrs["data-provider-highlighted"] = "true";

      dropdownChildren.push(
        createElement(
          "div",
          attrs,
          createElement("span", { "data-provider-label": "true" }, provider.label),
          createElement("span", { "data-provider-model": "true" }, provider.model),
        ),
      );
    });

    // Settings button
    if (onSettingsClick) {
      dropdownChildren.push(
        createElement(
          "button",
          {
            key: "settings",
            type: "button",
            "data-provider-settings-btn": "true",
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
        { key: "dropdown", "data-provider-dropdown": "true", onKeyDown: handleKeyDown },
        ...dropdownChildren,
      ),
    );
  }

  return createElement(
    "div",
    {
      "data-provider-selector": "true",
      className,
      ref: containerRef,
    },
    ...children,
  );
}
