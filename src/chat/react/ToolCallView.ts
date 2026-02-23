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
 * Shows tool name, status, args, result, and approval buttons when needed.
 */
export function ToolCallView({ part, onApprove, onDeny, renderArgs, renderResult }: ToolCallViewProps): ReactNode {
  const children: ReactNode[] = [
    createElement("span", { key: "name", "data-tool-label": "name" }, part.name),
    createElement("span", { key: "status", "data-tool-label": "status" }, part.status),
  ];

  if (part.args !== undefined) {
    children.push(
      renderArgs
        ? renderArgs(part.args)
        : createElement("pre", { key: "args", "data-tool-label": "args" }, JSON.stringify(part.args, null, 2)),
    );
  }

  if (part.result !== undefined) {
    children.push(
      renderResult
        ? renderResult(part.result)
        : createElement("pre", { key: "result", "data-tool-label": "result" }, JSON.stringify(part.result, null, 2)),
    );
  }

  if (part.error) {
    children.push(
      createElement("span", { key: "error", "data-tool-label": "error", role: "alert" }, part.error),
    );
  }

  if (part.status === "requires_approval") {
    children.push(
      createElement("button", { key: "approve", onClick: onApprove, "data-action": "approve" }, "Approve"),
      createElement("button", { key: "deny", onClick: onDeny, "data-action": "deny" }, "Deny"),
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
