import { createElement, type ReactNode } from "react";

/** Props for the ThinkingBlock component. */
export interface ThinkingBlockProps {
  text: string;
  isStreaming?: boolean;
  defaultOpen?: boolean;
}

/**
 * Headless thinking/reasoning block using native details/summary elements.
 * Displays "Thinking..." while streaming, "Reasoning" when complete.
 */
export function ThinkingBlock({ text, isStreaming, defaultOpen }: ThinkingBlockProps): ReactNode {
  const attrs: Record<string, unknown> = {
    "data-thinking": "true",
  };
  if (isStreaming) {
    attrs["data-streaming"] = "true";
  }
  if (defaultOpen) {
    attrs.open = true;
  }

  return createElement(
    "details",
    attrs,
    createElement("summary", null, isStreaming ? "Thinking..." : "Reasoning"),
    createElement("div", null, text),
  );
}
