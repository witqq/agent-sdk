import { createElement, type ReactNode } from "react";
import type { AuthFormProps } from "./types.js";

/**
 * Copilot (GitHub) auth form — device flow.
 *
 * Shows "Authenticate with GitHub" button → device code + verification URL →
 * "Waiting..." → "✓ Authenticated" + "Continue →".
 *
 * Co-located with the Copilot backend.
 */
export function CopilotAuthForm({ auth, onAuthComplete }: AuthFormProps): ReactNode {
  const children: ReactNode[] = [];

  if (auth.status === "idle") {
    children.push(
      createElement("button", {
        key: "start",
        type: "button",
        "data-action": "start-auth",
        onClick: () => {
          auth.startDeviceFlow().then(() => onAuthComplete());
        },
      }, "Authenticate with GitHub"),
    );
  }

  if (auth.deviceCode) {
    children.push(
      createElement("div", { key: "code", "data-device-code": "true" }, auth.deviceCode),
    );
    if (auth.verificationUrl) {
      children.push(
        createElement("a", {
          key: "url",
          href: auth.verificationUrl,
          target: "_blank",
          rel: "noreferrer",
        }, "Open GitHub →"),
      );
    }
  }

  if (auth.status === "pending") {
    children.push(
      createElement("span", { key: "wait", "data-auth-loading": "true" }, "Waiting..."),
    );
  }

  if (auth.status === "authenticated") {
    children.push(
      createElement("div", { key: "done", "data-auth-success": "true" },
        "✓ Authenticated",
        createElement("button", {
          type: "button",
          "data-action": "continue",
          onClick: onAuthComplete,
        }, "Continue →"),
      ),
    );
  }

  if (auth.error) {
    children.push(
      createElement("div", { key: "error", "data-auth-error-display": "true" }, auth.error.message),
    );
  }

  return createElement("div", { "data-auth-flow": "copilot" }, ...children);
}
