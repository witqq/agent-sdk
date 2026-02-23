import { createContext, createElement, useContext, type ReactNode } from "react";
import type { IChatRuntime } from "../runtime.js";

const ChatRuntimeContext = createContext<IChatRuntime | null>(null);

/** Props for ChatProvider. */
export interface ChatProviderProps {
  /** The chat runtime instance to provide to descendants. */
  runtime: IChatRuntime;
  children: ReactNode;
}

/**
 * React context provider wrapping IChatRuntime.
 * All chat hooks must be used within a ChatProvider.
 */
export function ChatProvider({ runtime, children }: ChatProviderProps) {
  return createElement(ChatRuntimeContext.Provider, { value: runtime }, children);
}

/**
 * Access the IChatRuntime from context.
 * Must be used within a ChatProvider.
 *
 * @throws {Error} If used outside ChatProvider
 */
export function useChatRuntime(): IChatRuntime {
  const runtime = useContext(ChatRuntimeContext);
  if (!runtime) {
    throw new Error("useChatRuntime must be used within a ChatProvider");
  }
  return runtime;
}
