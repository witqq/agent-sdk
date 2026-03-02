import {
  createElement,
  useRef,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import type { ChatMessage, ReasoningPart } from "../core.js";
import { Message } from "./Message.js";
import { useOptionalThreadSlots } from "./ThreadSlots.js";

/** Props for the Thread component. */
export interface ThreadProps {
  messages: ChatMessage[];
  isGenerating?: boolean;
  autoScroll?: boolean;
  className?: string;
}

/**
 * Headless thread component wrapping a scrollable message list.
 * Auto-scrolls to bottom when new messages arrive unless user has scrolled up.
 * Shows a scroll-to-bottom button when scrolled up and an empty state when no messages.
 */
export function Thread({
  messages,
  isGenerating,
  autoScroll = true,
  className,
}: ThreadProps): ReactNode {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const isScrollingProgrammatically = useRef(false);

  const handleScroll = useCallback(() => {
    if (isScrollingProgrammatically.current) return;
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 1;
    setUserScrolledUp(!atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    isScrollingProgrammatically.current = true;
    sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
    setUserScrolledUp(false);
    // Reset guard after smooth scroll completes
    setTimeout(() => { isScrollingProgrammatically.current = false; }, 500);
  }, []);

  useEffect(() => {
    if (!autoScroll || userScrolledUp) return;
    sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, autoScroll, userScrolledUp]);

  const slots = useOptionalThreadSlots();

  const attrs: Record<string, unknown> = { "data-thread": "true", className };
  if (isGenerating) {
    attrs["data-thread-loading"] = "true";
  }
  attrs.ref = containerRef;
  attrs.onScroll = handleScroll;

  const children: ReactNode[] = [];

  // Empty state when no messages
  if (messages.length === 0 && !isGenerating) {
    children.push(
      createElement("div", { key: "__empty", "data-thread-empty": "true" },
        "Start a conversation",
      ),
    );
  }

  // Message list
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const content = slots?.renderMessage
      ? slots.renderMessage(msg, i)
      : createElement(Message, {
          key: msg.id,
          message: msg,
          renderToolCall: slots?.renderToolCall,
          renderReasoning: slots?.renderThinkingBlock
            ? (part: ReasoningPart, idx: number) => slots!.renderThinkingBlock!(part, idx)
            : undefined,
        });

    children.push(
      createElement(
        "div",
        { key: msg.id, "data-thread-message": "true", "data-role": msg.role },
        content,
      ),
    );
  }

  // Loading indicator — bouncing dots shown during generation
  if (isGenerating) {
    children.push(
      createElement("div", { key: "__loading", "data-thread-loading-indicator": "true" },
        createElement("span", null),
        createElement("span", null),
        createElement("span", null),
      ),
    );
  }

  // Sentinel element for auto-scroll anchoring
  children.push(createElement("div", { key: "__sentinel", ref: sentinelRef }));

  // Scroll-to-bottom button — shown when user scrolled up
  if (userScrolledUp) {
    children.push(
      createElement("button", {
        key: "__scroll-to-bottom",
        "data-action": "scroll-to-bottom",
        type: "button",
        onClick: scrollToBottom,
        "aria-label": "Scroll to bottom",
      }),
    );
  }

  return createElement("div", attrs, ...children);
}
