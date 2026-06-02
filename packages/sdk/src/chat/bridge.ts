/**
 * @witqq/agent-sdk — AgentEvent ↔ ChatEvent bridge
 */

import type { AgentEvent, JSONValue } from "../types.js";
import type { ChatId, ChatEvent } from "./types.js";

/**
 * Map a single AgentEvent to a ChatEvent (or null if no mapping)
 */
export function agentEventToChatEvent(
  event: AgentEvent,
  messageId: ChatId,
): ChatEvent | null {
  switch (event.type) {
    case "text_delta":
      return { type: "message:delta", messageId, text: event.text };
    case "thinking_start":
      return { type: "thinking:start", messageId };
    case "thinking_delta":
      return { type: "thinking:delta", messageId, text: event.text };
    case "thinking_end":
      return { type: "thinking:end", messageId };
    case "tool_call_start":
      return {
        type: "tool:start",
        messageId,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args as Record<string, unknown>,
      };
    case "tool_call_end":
      return {
        type: "tool:complete",
        messageId,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
      };
    case "permission_request":
      return {
        type: "permission:request",
        messageId,
        toolName: event.request.toolName,
        toolArgs: event.request.toolArgs,
      };
    case "permission_response":
      return {
        type: "permission:response",
        messageId,
        toolName: event.toolName,
        allowed: event.decision.allowed,
      };
    case "usage_update":
      return {
        type: "usage",
        promptTokens: event.promptTokens,
        completionTokens: event.completionTokens,
        model: event.model,
        ...(event.cost !== undefined && { cost: event.cost }),
        ...(event.cachedTokens !== undefined && { cachedTokens: event.cachedTokens }),
        ...(event.providerMetadata !== undefined && { providerMetadata: event.providerMetadata }),
      };
    case "error":
      return {
        type: "error",
        error: event.error,
        recoverable: event.recoverable,
        code: event.code,
        messageId,
      };
    case "heartbeat":
      return { type: "heartbeat" };
    case "ask_user":
    case "ask_user_response":
    case "session_info":
      return null;
    case "done":
      return { type: "done", finalOutput: event.finalOutput ?? undefined, finishReason: event.finishReason };
    default:
      return null;
  }
}

/**
 * Convert AgentEvent async iterable to ChatEvent async iterable
 */
export async function* adaptAgentEvents(
  events: AsyncIterable<AgentEvent>,
  messageId: ChatId,
): AsyncIterable<ChatEvent> {
  for await (const event of events) {
    const chatEvent = agentEventToChatEvent(event, messageId);
    if (chatEvent !== null) {
      yield chatEvent;
    }
  }
}

/**
 * Map a ChatEvent back to an AgentEvent for accumulator consumption.
 * Returns null for events that don't map to accumulator-relevant AgentEvents.
 */
export function chatEventToAgentEvent(event: ChatEvent): AgentEvent | null {
  switch (event.type) {
    case "message:delta":
      return { type: "text_delta", text: event.text };
    case "thinking:start":
      return { type: "thinking_start" };
    case "thinking:delta":
      return { type: "thinking_delta", text: event.text };
    case "thinking:end":
      return { type: "thinking_end" };
    case "tool:start":
      return {
        type: "tool_call_start",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args as JSONValue,
      };
    case "tool:complete":
      return {
        type: "tool_call_end",
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result as JSONValue,
      };
    case "error":
      return { type: "error", error: event.error, recoverable: event.recoverable, code: event.code };
    default:
      return null;
  }
}
