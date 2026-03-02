/**
 * @witqq/agent-sdk/chat/react — useApiKeyAuth
 *
 * Server-delegated API key authentication hook (for Vercel AI / OpenRouter / etc.).
 * Independently usable — does not require useRemoteAuth orchestrator.
 */

import { useState, useCallback, useRef } from "react";
import type { AuthToken } from "../../../auth/types.js";

/** Options for useApiKeyAuth. */
export interface UseApiKeyAuthOptions {
  /** Base URL of the auth server (e.g. "/api/auth") */
  baseUrl: string;
  /** Called after successful authentication */
  onAuthenticated?: (token: AuthToken) => void;
  /** Called on authentication error */
  onError?: (error: Error) => void;
  /** Optional fetch override (for testing) */
  fetch?: typeof globalThis.fetch;
  /** Optional headers for all requests */
  headers?: Record<string, string>;
}

/** Return value from useApiKeyAuth. */
export interface UseApiKeyAuthReturn {
  status: "idle" | "pending" | "authenticated" | "error";
  error: Error | null;
  token: AuthToken | null;
  /** Submit an API key (and optional provider base URL). */
  submit: (key: string, apiBaseUrl?: string) => Promise<void>;
  reset: () => void;
}

/**
 * API key authentication.
 * Sends key to server for validation and storage.
 */
export function useApiKeyAuth(options: UseApiKeyAuthOptions): UseApiKeyAuthReturn {
  const { baseUrl, headers } = options;
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);

  const [status, setStatus] = useState<"idle" | "pending" | "authenticated" | "error">("idle");
  const [error, setError] = useState<Error | null>(null);
  const [token, setToken] = useState<AuthToken | null>(null);

  const onAuthenticatedRef = useRef(options.onAuthenticated);
  onAuthenticatedRef.current = options.onAuthenticated;
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;

  const submit = useCallback(async (key: string, apiBaseUrl?: string) => {
    if (!key || !key.trim()) {
      const e = new Error("API key cannot be empty");
      setError(e);
      setStatus("error");
      onErrorRef.current?.(e);
      return;
    }
    setStatus("pending");
    setError(null);
    try {
      const res = await fetchFn(`${baseUrl}/auth/vercel/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          apiKey: key.trim(),
          ...(apiBaseUrl ? { baseUrl: apiBaseUrl } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const authToken: AuthToken = {
        accessToken: "server-managed",
        tokenType: "bearer",
        obtainedAt: Date.now(),
      };
      setToken(authToken);
      setStatus("authenticated");
      onAuthenticatedRef.current?.(authToken);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setStatus("error");
      onErrorRef.current?.(e);
    }
  }, [baseUrl, fetchFn, headers]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setToken(null);
  }, []);

  return { status, error, token, submit, reset };
}
