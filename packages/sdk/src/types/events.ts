import type { JSONValue } from "./json.js";
import type { ErrorCode } from "./errors.js";
import type { PermissionRequest, PermissionDecision, UserInputRequest } from "./permissions.js";

/** Usage data from LLM execution — tokens consumed plus optional metadata */
export interface UsageData {
  promptTokens: number;
  completionTokens: number;
  model?: string;
  backend?: string;
  /** Best-effort normalized request cost in USD, when the provider reports it.
   *  Populated by backends that can extract a numeric cost from provider metadata
   *  (e.g. OpenRouter via the Vercel AI backend). Undefined when unavailable. */
  cost?: number;
  /** Number of prompt tokens served from the provider's cache, when reported. */
  cachedTokens?: number;
  /** Raw, provider-specific response metadata passed through untouched.
   *  Provider-agnostic escape hatch for fields the SDK does not normalize. */
  providerMetadata?: Record<string, JSONValue>;
}

/** Events emitted during streaming agent execution */
export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "tool_call_start"; toolCallId: string; toolName: string; args: JSONValue }
  | { type: "tool_call_end"; toolCallId: string; toolName: string; result: JSONValue }
  | { type: "permission_request"; request: PermissionRequest }
  | {
      type: "permission_response";
      toolName: string;
      decision: PermissionDecision;
    }
  | { type: "ask_user"; request: UserInputRequest }
  | { type: "ask_user_response"; answer: string }
  | { type: "thinking_start" }
  | { type: "thinking_end" }
  | {
      type: "usage_update";
      promptTokens: number;
      completionTokens: number;
      model?: string;
      backend?: string;
      cost?: number;
      cachedTokens?: number;
      providerMetadata?: Record<string, JSONValue>;
    }
  | { type: "session_info"; sessionId: string; transcriptPath?: string; backend: string }
  | { type: "heartbeat" }
  | { type: "error"; error: string; recoverable: boolean; code?: ErrorCode }
  | { type: "done"; finalOutput: string | null; structuredOutput?: unknown; streamed?: boolean; finishReason?: string };

// ─── Stream Middleware ────────────────────────────────────────

/** Context passed to stream middleware — immutable per stream invocation */
export interface StreamContext {
  model: string;
  backend: string;
  abortController: AbortController;
  /** Agent config snapshot. Loosely typed to avoid leaking internal FullAgentConfig to external middleware consumers. */
  config: Readonly<Record<string, unknown>>;
}

/** A composable transform over the agent event stream.
 *  Receives the upstream source and context, returns a transformed stream. */
export type StreamMiddleware = (
  source: AsyncIterable<AgentEvent>,
  context: StreamContext,
) => AsyncIterable<AgentEvent>;
