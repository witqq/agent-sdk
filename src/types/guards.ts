import type { ToolDeclaration, ToolDefinition } from "./tools.js";
import type { MessageContent, ContentPart } from "./messages.js";

/** Type guard: checks if a ToolDeclaration has an execute function (i.e., is a ToolDefinition) */
export function isToolDefinition(
  tool: ToolDeclaration,
): tool is ToolDefinition {
  return "execute" in tool && typeof (tool as ToolDefinition).execute === "function";
}

/** Type guard: checks if MessageContent is plain string */
export function isTextContent(content: MessageContent): content is string {
  return typeof content === "string";
}

/** Type guard: checks if MessageContent is multi-part array */
export function isMultiPartContent(
  content: MessageContent,
): content is ContentPart[] {
  return Array.isArray(content);
}

/** Extract text from MessageContent regardless of format */
export function getTextContent(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}
