import { createElement, useRef, type ReactNode } from "react";
import type { AuthFormProps } from "./types.js";

/**
 * Claude auth form — OAuth Authorization Code + PKCE.
 *
 * Shows "Authenticate with Claude" button → authorize URL link +
 * paste-code input + "Submit" button.
 *
 * Co-located with the Claude backend.
 */
export function ClaudeAuthForm({ auth, onAuthComplete }: AuthFormProps): ReactNode {
  const codeRef = useRef<HTMLInputElement>(null);
  const children: ReactNode[] = [];

  if (auth.status === "idle") {
    children.push(
      createElement("button", {
        key: "start",
        type: "button",
        "data-action": "start-auth",
        onClick: () => auth.startOAuthFlow(),
      }, "Authenticate with Claude"),
    );
  }

  if (auth.authorizeUrl) {
    children.push(
      createElement("a", {
        key: "url",
        href: auth.authorizeUrl,
        target: "_blank",
        rel: "noreferrer",
      }, "Open authorization page →"),
    );
    children.push(
      createElement("div", { key: "complete", "data-auth-complete": "true" },
        createElement("input", {
          ref: codeRef,
          placeholder: "Paste code or redirect URL...",
        }),
        createElement("button", {
          type: "button",
          "data-action": "complete-auth",
          onClick: () => {
            const v = codeRef.current?.value?.trim();
            if (v) auth.completeOAuth(v).then(() => onAuthComplete());
          },
        }, "Submit"),
      ),
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

  return createElement("div", { "data-auth-flow": "claude" }, ...children);
}
