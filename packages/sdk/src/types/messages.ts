import type { ToolCall, ToolResult } from "./tools.js";

/** Message content — plain string or array of text/image parts */
export type MessageContent = string | Array<ContentPart>;

/** Individual content part within a multi-part message */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

/** Conversation message — discriminated union on `role` */
export type Message =
  | { role: "user"; content: MessageContent }
  | { role: "assistant"; content: MessageContent; toolCalls?: ToolCall[]; thinking?: string }
  | { role: "tool"; content?: string; toolResults: ToolResult[] }
  | { role: "system"; content: string };
