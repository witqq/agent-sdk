import { createElement, useRef, type ReactNode } from "react";
import type { AuthFormProps } from "./types.js";

/**
 * Vercel AI auth form — API key + optional base URL.
 *
 * Shows base URL input + API key input + "Connect" button.
 *
 * Co-located with the Vercel AI backend.
 */
export function VercelAIAuthForm({ auth, onAuthComplete }: AuthFormProps): ReactNode {
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const baseUrlRef = useRef<HTMLInputElement>(null);
  const children: ReactNode[] = [];

  if (auth.status !== "authenticated") {
    children.push(
      createElement("div", { key: "apikey", "data-auth-apikey": "true" },
        createElement("input", {
          ref: baseUrlRef,
          placeholder: "Base URL (default: openai.com/v1)",
        }),
        createElement("input", {
          ref: apiKeyRef,
          type: "password",
          placeholder: "API Key (sk-...)",
        }),
        createElement("button", {
          type: "button",
          "data-action": "submit-apikey",
          onClick: () => {
            const k = apiKeyRef.current?.value?.trim();
            if (k) {
              auth.submitApiKey(k, baseUrlRef.current?.value?.trim() || undefined)
                .then(() => onAuthComplete());
            }
          },
        }, "Connect"),
      ),
    );
  }

  if (auth.status === "authenticated") {
    children.push(
      createElement("div", { key: "done", "data-auth-success": "true" },
        "✓ Connected",
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

  return createElement("div", { "data-auth-flow": "vercel-ai" }, ...children);
}
