import { createElement, type ReactNode } from "react";
import type { PendingToolRequest } from "./useToolApproval.js";

/** Props for PermissionDialog. */
export interface PermissionDialogProps {
  /** List of pending tool requests awaiting approval. */
  requests: PendingToolRequest[];
  /** Called when user approves a tool call. */
  onApprove: (toolCallId: string) => void;
  /** Called when user denies a tool call. */
  onDeny: (toolCallId: string) => void;
  /** Optional: approve all pending at once. */
  onApproveAll?: () => void;
  /** Optional: deny all pending at once. */
  onDenyAll?: () => void;
  /** Custom renderer for tool arguments. */
  renderArgs?: (args: Record<string, unknown>, toolName: string) => ReactNode;
  className?: string;
}

/**
 * Headless permission dialog component for tool approval flows.
 *
 * Renders a list of pending tool calls with approve/deny buttons.
 * Uses `data-*` attributes for styling — no built-in styles.
 *
 * Returns `null` when there are no pending requests.
 */
export function PermissionDialog({
  requests,
  onApprove,
  onDeny,
  onApproveAll,
  onDenyAll,
  renderArgs,
  className,
}: PermissionDialogProps): ReactNode {
  if (requests.length === 0) return null;

  const items: ReactNode[] = requests.map((req) =>
    createElement(
      "div",
      {
        key: req.toolCallId,
        "data-permission-request": "true",
        "data-tool-name": req.toolName,
      },
      // Tool name
      createElement(
        "div",
        { "data-permission-tool-name": "true" },
        req.toolName,
      ),
      // Arguments display
      createElement(
        "div",
        { "data-permission-tool-args": "true" },
        renderArgs
          ? renderArgs(req.toolArgs, req.toolName)
          : createElement("pre", null, JSON.stringify(req.toolArgs, null, 2)),
      ),
      // Action buttons
      createElement(
        "div",
        { "data-permission-actions": "true" },
        createElement(
          "button",
          {
            type: "button",
            "data-action": "approve",
            onClick: () => onApprove(req.toolCallId),
            "aria-label": `Approve ${req.toolName}`,
          },
          "Allow",
        ),
        createElement(
          "button",
          {
            type: "button",
            "data-action": "deny",
            onClick: () => onDeny(req.toolCallId),
            "aria-label": `Deny ${req.toolName}`,
          },
          "Deny",
        ),
      ),
    ),
  );

  // Bulk actions when multiple requests
  const bulkActions =
    requests.length > 1 && (onApproveAll || onDenyAll)
      ? createElement(
          "div",
          { "data-permission-bulk-actions": "true" },
          onApproveAll
            ? createElement(
                "button",
                {
                  type: "button",
                  "data-action": "approve-all",
                  onClick: onApproveAll,
                  "aria-label": "Approve all tool calls",
                },
                "Allow All",
              )
            : null,
          onDenyAll
            ? createElement(
                "button",
                {
                  type: "button",
                  "data-action": "deny-all",
                  onClick: onDenyAll,
                  "aria-label": "Deny all tool calls",
                },
                "Deny All",
              )
            : null,
        )
      : null;

  return createElement(
    "div",
    {
      "data-permission-dialog": "true",
      role: "dialog",
      "aria-label": "Tool permission requests",
      className,
    },
    ...items,
    bulkActions,
  );
}
