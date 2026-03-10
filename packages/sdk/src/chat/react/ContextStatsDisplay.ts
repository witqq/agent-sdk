import { createElement, type ReactNode } from "react";
import type { ContextStats } from "../context.js";

/** Props for the ContextStatsDisplay component. */
export interface ContextStatsDisplayProps {
  /** Context stats from runtime.getContextStats(sessionId). Null = nothing to display. */
  stats: ContextStats | null;
  /** CSS class on the root element. */
  className?: string;
}

/** Format a token count for display (e.g. 1234 → "1.2k"). */
function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Headless component displaying context window statistics.
 *
 * When real usage data is available (realPromptTokens + modelContextWindow),
 * displays actual token usage and model context window size.
 * When real data is not yet available (before first API response), returns null.
 *
 * All elements use `data-*` attributes for CSS styling — no inline styles.
 */
export function ContextStatsDisplay({ stats, className }: ContextStatsDisplayProps): ReactNode {
  if (!stats) return null;

  // Prefer real data — if not available, show nothing (no heuristic fallback)
  const hasRealData = stats.realPromptTokens != null && stats.modelContextWindow != null;
  if (!hasRealData) return null;

  const promptTokens = stats.realPromptTokens!;
  const contextWindow = stats.modelContextWindow!;
  const availableBudget = Math.max(0, contextWindow - promptTokens);
  const usagePercent = contextWindow > 0
    ? Math.round((promptTokens / contextWindow) * 100)
    : 0;

  return createElement("div", {
    "data-context-stats": "",
    "data-context-truncated": stats.wasTruncated ? "true" : "false",
    className,
  },
    createElement("span", { "data-context-tokens": "" },
      `${formatTokens(promptTokens)} tokens`),
    createElement("span", { "data-context-budget": "" },
      `${formatTokens(availableBudget)} available`),
    createElement("span", { "data-context-usage": "", "data-usage-percent": String(usagePercent) },
      `${usagePercent}%`),
    stats.removedCount > 0
      ? createElement("span", { "data-context-removed": "" },
          `${stats.removedCount} trimmed`)
      : null,
  );
}
