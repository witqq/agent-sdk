import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";
import type { ChatMessage, ReasoningPart, ToolCallPart } from "../core.js";

/** Slot override functions for Thread customization. */
export interface ThreadSlotOverrides {
  renderMessage?: (message: ChatMessage, index: number) => ReactNode;
  renderToolCall?: (part: ToolCallPart, index: number) => ReactNode;
  renderThinkingBlock?: (part: ReasoningPart, index: number) => ReactNode;
}

const ThreadSlotsContext = createContext<ThreadSlotOverrides | null>(null);

/** Props for ThreadProvider. */
export interface ThreadProviderProps extends ThreadSlotOverrides {
  children: ReactNode;
}

/**
 * Provides slot-based customization for Thread message rendering.
 * Wrap a Thread in ThreadProvider to override how messages, tool calls,
 * or thinking blocks are rendered.
 */
export function ThreadProvider({
  children,
  renderMessage,
  renderToolCall,
  renderThinkingBlock,
}: ThreadProviderProps): ReactNode {
  const value: ThreadSlotOverrides = { renderMessage, renderToolCall, renderThinkingBlock };
  return createElement(ThreadSlotsContext.Provider, { value }, children);
}

/**
 * Access slot overrides from ThreadProvider context.
 * @throws {Error} If used outside a ThreadProvider
 */
export function useThreadSlots(): ThreadSlotOverrides {
  const ctx = useContext(ThreadSlotsContext);
  if (!ctx) {
    throw new Error("useThreadSlots must be used within a ThreadProvider");
  }
  return ctx;
}

/**
 * Access slot overrides if inside a ThreadProvider, or null if not.
 * Safe to call without a ThreadProvider ancestor.
 */
export function useOptionalThreadSlots(): ThreadSlotOverrides | null {
  return useContext(ThreadSlotsContext);
}
