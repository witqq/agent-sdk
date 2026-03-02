import {
  createElement,
  useRef,
  useCallback,
  useState,
  useEffect,
  type ReactNode,
} from "react";

/** Props for the Composer component. */
export interface ComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxRows?: number;
  className?: string;
}

/**
 * Headless composer component for sending messages.
 * Includes auto-resizing textarea, send/stop buttons, and keyboard shortcuts.
 */
export function Composer({
  onSend,
  onStop,
  isGenerating,
  disabled,
  placeholder = "Type a message...",
  maxRows = 5,
  className,
}: ComposerProps): ReactNode {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
    const maxHeight = lineHeight * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [maxRows]);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setValue("");
  }, [value, isGenerating, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: Event) => {
      setValue((e.target as HTMLTextAreaElement).value);
    },
    [],
  );

  const children: ReactNode[] = [
    createElement("div", { key: "input-wrapper", "data-input": "" },
      createElement("textarea", {
        ref: textareaRef,
        value,
        onChange: handleChange,
        onKeyDown: handleKeyDown,
        placeholder,
        disabled: disabled || false,
        "aria-label": "Message input",
        rows: 1,
      }),
      isGenerating
        ? createElement(
            "button",
            {
              key: "stop",
              "data-action": "stop",
              onClick: onStop,
              type: "button",
            },
            "Stop",
          )
        : createElement(
            "button",
            {
              key: "send",
              "data-action": "send",
              onClick: handleSend,
              disabled: !value.trim() || isGenerating,
              type: "button",
            },
            "Send",
          ),
    ),
  ];

  return createElement(
    "div",
    { "data-composer": "true", className },
    ...children,
  );
}
