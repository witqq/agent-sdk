import { createContext, createElement, useContext, type ReactNode } from "react";
import type { IChatClient } from "../runtime.js";

const ChatRuntimeContext = createContext<IChatClient | null>(null);

/** Props for ChatProvider. */
export interface ChatProviderProps {
  /** The chat runtime or client instance to provide to descendants. Accepts IChatClient (or any structurally compatible type). */
  runtime: IChatClient;
  children: ReactNode;
}

/**
 * React context provider wrapping IChatClient.
 * All chat hooks must be used within a ChatProvider.
 */
export function ChatProvider({ runtime, children }: ChatProviderProps) {
  return createElement(ChatRuntimeContext.Provider, { value: runtime }, children);
}

/**
 * Access the IChatClient from context.
 * Must be used within a ChatProvider.
 *
 * @throws {Error} If used outside ChatProvider
 */
export function useChatRuntime(): IChatClient {
  const runtime = useContext(ChatRuntimeContext);
  if (!runtime) {
    throw new Error("useChatRuntime must be used within a ChatProvider");
  }
  return runtime;
}
