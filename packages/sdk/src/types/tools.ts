import type { z } from "zod";
import type { JSONValue } from "./json.js";

/** What the LLM sees — name, description, schema. Passed to all backends. */
export interface ToolDeclaration<TParams = unknown> {
  name: string;
  description: string;
  parameters: z.ZodType<TParams>;
  needsApproval?: boolean;
  metadata?: {
    category?: string;
    icon?: string;
    tags?: string[];
  };
}

/** Full tool with execute function. Required for API-based backends.
 *  CLI backends extract declaration; execute map held internally.
 *  The optional second parameter receives request-scoped context
 *  when invoked through ChatRuntime (session ID, user data, custom metadata). */
export interface ToolDefinition<TParams = unknown>
  extends ToolDeclaration<TParams> {
  execute: (params: TParams, context?: ToolContext) => Promise<unknown> | unknown;
}

/** Request-scoped context passed to tool execute functions via ChatRuntime.
 *  Contains session identity and user-defined metadata from the current session. */
export interface ToolContext {
  /** Active chat session ID */
  sessionId: string;
  /** Custom metadata from the session (e.g. user ID, tenant, permissions) */
  custom?: Record<string, unknown>;
}

/** A tool call made by the LLM during execution */
export interface ToolCall {
  id: string;
  name: string;
  args: JSONValue;
}

/** Result of executing a tool call */
export interface ToolResult {
  toolCallId: string;
  name: string;
  result: JSONValue;
  isError?: boolean;
}

/** Accepts either a declaration (schema-only) or a full definition (with execute).
 *  Use this in APIs that accept both. */
export type ToolDefinitionLike<TParams = unknown> = ToolDeclaration<TParams> | ToolDefinition<TParams>;
