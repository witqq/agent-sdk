/**
 * @witqq/agent-sdk/chat/react — ChatLayout
 *
 * Pure layout container for chat interfaces. Renders sidebar + main area
 * without any logic or state. ChatUI uses this internally.
 */

import { createElement, type ReactNode } from "react";

/** Props for the ChatLayout component. */
export interface ChatLayoutProps {
  /** Main chat content (thread, input area, etc.). */
  children: ReactNode;
  /** Sidebar content (thread list, session list, etc.). */
  sidebar?: ReactNode;
  /** Modal/overlay content. Accepts a single node or array of nodes. */
  overlay?: ReactNode | ReactNode[];
  /** CSS class on the root element. */
  className?: string;
}

/**
 * Pure layout container — flex row with optional sidebar and overlay.
 *
 * Renders `[data-chat-ui]` root with:
 * - overlay (rendered first for z-index stacking)
 * - sidebar (rendered before main content)
 * - children (main chat area)
 */
export function ChatLayout({ children, sidebar, overlay, className }: ChatLayoutProps): ReactNode {
  const overlayNodes = Array.isArray(overlay) ? overlay : [overlay ?? null];
  return createElement("div", { "data-chat-ui": "", className },
    ...overlayNodes,
    sidebar ?? null,
    children,
  );
}
