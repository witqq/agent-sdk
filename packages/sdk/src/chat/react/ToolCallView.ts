import { createElement, type ReactNode } from "react";
import type { ToolCallPart } from "../core.js";

/** Props for the ToolCallView component. */
export interface ToolCallViewProps {
  part: ToolCallPart;
  onApprove?: () => void;
  onDeny?: () => void;
  renderArgs?: (args: unknown) => ReactNode;
  renderResult?: (result: unknown) => ReactNode;
}

/**
 * Headless tool call display component.
 * Shows tool name, status, collapsible args/result, and approval buttons when needed.
 */
export function ToolCallView({ part, onApprove, onDeny, renderArgs, renderResult }: ToolCallViewProps): ReactNode {
  const children: ReactNode[] = [];

  // Header row: tool name + status badge
  children.push(
    createElement("div", { key: "header", "data-tool-header": "true" },
      createElement("span", { "data-tool-label": "name" }, part.name),
      createElement("span", { "data-tool-label": "status" }, part.status),
    ),
  );

  // Collapsible args section
  if (part.args !== undefined) {
    children.push(
      renderArgs
        ? renderArgs(part.args)
        : createElement("details", { key: "args", "data-tool-details": "args" },
            createElement("summary", null, "Arguments"),
            createElement("pre", { "data-tool-label": "args" }, JSON.stringify(part.args, null, 2)),
          ),
    );
  }

  // Collapsible result section
  if (part.result !== undefined) {
    children.push(
      renderResult
        ? renderResult(part.result)
        : createElement("details", { key: "result", "data-tool-details": "result", open: true },
            createElement("summary", null, "Result"),
            createElement("pre", { "data-tool-label": "result" }, JSON.stringify(part.result, null, 2)),
          ),
    );
  }

  if (part.error) {
    children.push(
      createElement("span", { key: "error", "data-tool-label": "error", role: "alert" }, part.error),
    );
  }

  if (part.status === "requires_approval") {
    children.push(
      createElement("div", { key: "actions", "data-tool-actions": "true" },
        createElement("button", { key: "approve", onClick: onApprove, "data-action": "approve" }, "Approve"),
        createElement("button", { key: "deny", onClick: onDeny, "data-action": "deny" }, "Deny"),
      ),
    );
  }

  return createElement(
    "div",
    {
      "data-tool-status": part.status,
      "data-tool-name": part.name,
    },
    ...children,
  );
}
