import { createElement, type ReactNode } from "react";
import type {
  ChatMessage,
  MessagePart,
  TextPart,
  ReasoningPart,
  ToolCallPart,
  SourcePart,
  FilePart,
} from "../core.js";

/** Props for the Message component. */
export interface MessageProps {
  message: ChatMessage;
  renderText?: (part: TextPart, index: number) => ReactNode;
  renderReasoning?: (part: ReasoningPart, index: number) => ReactNode;
  renderToolCall?: (part: ToolCallPart, index: number) => ReactNode;
  renderSource?: (part: SourcePart, index: number) => ReactNode;
  renderFile?: (part: FilePart, index: number) => ReactNode;
}

function defaultRenderText(part: TextPart, index: number): ReactNode {
  return createElement("span", { key: index, "data-part": "text" }, part.text);
}

function defaultRenderReasoning(part: ReasoningPart, index: number): ReactNode {
  return createElement("span", { key: index, "data-part": "reasoning" }, part.text);
}

function defaultRenderToolCall(part: ToolCallPart, index: number): ReactNode {
  return createElement("span", { key: index, "data-part": "tool_call", "data-tool-name": part.name }, part.name);
}

function defaultRenderSource(part: SourcePart, index: number): ReactNode {
  return createElement("a", { key: index, href: part.url, "data-part": "source" }, part.title ?? part.url);
}

function defaultRenderFile(part: FilePart, index: number): ReactNode {
  return createElement("span", { key: index, "data-part": "file" }, part.name);
}

function renderPart(props: MessageProps, part: MessagePart, index: number): ReactNode {
  switch (part.type) {
    case "text":
      return (props.renderText ?? defaultRenderText)(part, index);
    case "reasoning":
      return (props.renderReasoning ?? defaultRenderReasoning)(part, index);
    case "tool_call":
      return (props.renderToolCall ?? defaultRenderToolCall)(part, index);
    case "source":
      return (props.renderSource ?? defaultRenderSource)(part, index);
    case "file":
      return (props.renderFile ?? defaultRenderFile)(part, index);
  }
}

/**
 * Headless message component rendering ChatMessage parts.
 * Wraps parts in a div with data-role and data-status attributes.
 */
export function Message(props: MessageProps): ReactNode {
  const { message } = props;
  const children = message.parts.map((part, i) => renderPart(props, part, i));
  return createElement(
    "div",
    {
      "data-role": message.role,
      "data-status": message.status,
    },
    ...children,
  );
}
