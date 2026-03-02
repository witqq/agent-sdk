import {
  createElement,
  useCallback,
  type ReactNode,
} from "react";
import type { BackendInfo } from "../runtime.js";

/** Props for the BackendSelector component. */
export interface BackendSelectorProps {
  backends: BackendInfo[];
  onSelect: (name: string) => void;
  className?: string;
}

/**
 * Headless backend selector showing registered backends with active indicator.
 * Uses data attributes for styling:
 * - `[data-backend-selector]` on root
 * - `[data-backend-item]` on each item
 * - `[data-backend-active="true"]` on the active backend
 * - `[data-backend-name]` with backend name value
 */
export function BackendSelector({
  backends,
  onSelect,
  className,
}: BackendSelectorProps): ReactNode {
  const handleClick = useCallback(
    (name: string) => () => onSelect(name),
    [onSelect],
  );

  const items = backends.map((backend) =>
    createElement(
      "button",
      {
        key: backend.name,
        type: "button",
        "data-backend-item": "true",
        "data-backend-name": backend.name,
        onClick: handleClick(backend.name),
      },
      backend.name,
    ),
  );

  return createElement(
    "div",
    { "data-backend-selector": "true", className },
    ...items,
  );
}
