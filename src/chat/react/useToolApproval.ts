import { useMemo, useCallback } from "react";
import type { ChatMessage } from "../core.js";

/** A pending tool call requiring user approval. */
export interface PendingToolRequest {
  toolCallId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  messageId: string;
}

/** Return value from useToolApproval. */
export interface UseToolApprovalReturn {
  pendingRequests: PendingToolRequest[];
  approve: (toolCallId: string) => void;
  deny: (toolCallId: string) => void;
}

/**
 * Hook that tracks tool calls requiring approval from messages.
 *
 * Scans messages for ToolCallParts with status "requires_approval"
 * and provides approve/deny callbacks. Currently state-only
 * (no ChatEventBus integration).
 *
 * @param messages - Messages to scan for pending tool approvals
 * @param onApprove - Called when a tool call is approved
 * @param onDeny - Called when a tool call is denied
 */
export function useToolApproval(
  messages: ChatMessage[],
  onApprove?: (toolCallId: string) => void,
  onDeny?: (toolCallId: string) => void,
): UseToolApprovalReturn {
  const pendingRequests = useMemo(() => {
    const requests: PendingToolRequest[] = [];
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (part.type === "tool_call" && part.status === "requires_approval") {
          requests.push({
            toolCallId: part.toolCallId,
            toolName: part.name,
            toolArgs: (part.args ?? {}) as Record<string, unknown>,
            messageId: msg.id,
          });
        }
      }
    }
    return requests;
  }, [messages]);

  const approve = useCallback((toolCallId: string): void => {
    onApprove?.(toolCallId);
  }, [onApprove]);

  const deny = useCallback((toolCallId: string): void => {
    onDeny?.(toolCallId);
  }, [onDeny]);

  return { pendingRequests, approve, deny };
}
