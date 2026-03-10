import { createElement, type ReactNode } from "react";
import type { ChatUsage } from "./useChat.js";

/** Props for the UsageBadge component. */
export interface UsageBadgeProps {
  usage: ChatUsage | null;
  className?: string;
}

/** Compact token usage display. Shows prompt/completion/total tokens. */
export function UsageBadge({ usage, className }: UsageBadgeProps): ReactNode {
  if (!usage) return null;

  return createElement(
    "span",
    { "data-usage-badge": "true", className },
    createElement("span", { "data-usage-tokens": "prompt" }, `↑${usage.promptTokens}`),
    createElement("span", { "data-usage-tokens": "completion" }, `↓${usage.completionTokens}`),
    createElement("span", { "data-usage-tokens": "total" }, `Σ${usage.totalTokens}`),
  );
}
