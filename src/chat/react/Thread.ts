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

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 1;
    setUserScrolledUp(!atBottom);
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

  const children: ReactNode[] = messages.map((msg, i) => {
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

    return createElement(
      "div",
      { key: msg.id, "data-thread-message": "true", "data-role": msg.role },
      content,
    );
  });

  // Sentinel element for auto-scroll anchoring
  children.push(createElement("div", { key: "__sentinel", ref: sentinelRef }));

  return createElement("div", attrs, ...children);
}
