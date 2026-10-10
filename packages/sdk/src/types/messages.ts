import type { ToolCall, ToolResult } from "./tools.js";
import type { JSONValue } from "./json.js";

/** Message content. Native reasoning is continuation data, not visible prose. */
export type MessageContent = string | Array<ContentPart>;

/** Individual content part within a multi-part message */
export type ContentPart =
  | { type: "text"; text: string; providerOptions?: Record<string, Record<string, JSONValue>> }
  | { type: "reasoning"; text: string; providerOptions?: Record<string, Record<string, JSONValue>> }
  | { type: "image"; data: string; mimeType: string };

/** Conversation message — discriminated union on `role` */
export type Message =
  | { role: "user"; content: MessageContent }
  | { role: "assistant"; content: MessageContent; toolCalls?: ToolCall[]; thinking?: string }
  | { role: "tool"; content?: string; toolResults: ToolResult[] }
  | { role: "system"; content: string };
