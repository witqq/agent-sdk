/**
 * @witqq/agent-sdk/chat/react — useClaudeAuth
 *
 * Server-delegated Claude OAuth + PKCE authentication hook.
 * Independently usable — does not require useRemoteAuth orchestrator.
 */

import { useState, useCallback, useRef } from "react";
import type { AuthToken } from "../../../auth/types.js";

/** Options for useClaudeAuth. */
export interface UseClaudeAuthOptions {
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

/** Return value from useClaudeAuth. */
export interface UseClaudeAuthReturn {
  status: "idle" | "pending" | "authenticated" | "error";
  error: Error | null;
  token: AuthToken | null;
  authorizeUrl: string | null;
  /** Start OAuth flow. Sets authorizeUrl for user redirect. */
  start: () => Promise<void>;
  /** Complete OAuth after redirect. Pass the code or callback URL. */
  complete: (codeOrUrl: string) => Promise<void>;
  reset: () => void;
}

/**
 * Claude OAuth + PKCE authentication.
 * Two-step flow: start() gets authorizeUrl → user redirects → complete(code) finishes.
 */
export function useClaudeAuth(options: UseClaudeAuthOptions): UseClaudeAuthReturn {
  const { baseUrl, headers } = options;
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);

  const [status, setStatus] = useState<"idle" | "pending" | "authenticated" | "error">("idle");
  const [error, setError] = useState<Error | null>(null);
  const [token, setToken] = useState<AuthToken | null>(null);
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);

  const onAuthenticatedRef = useRef(options.onAuthenticated);
  onAuthenticatedRef.current = options.onAuthenticated;
  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;

  const post = useCallback(
    async (path: string, body?: Record<string, unknown>) => {
      const res = await fetchFn(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
    [baseUrl, fetchFn, headers],
  );

  const start = useCallback(async () => {
    setStatus("pending");
    setError(null);
    try {
      const result = await post("/auth/start", { provider: "claude" });
      setAuthorizeUrl(result.authorizeUrl);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setStatus("error");
      onErrorRef.current?.(e);
    }
  }, [post]);

  const complete = useCallback(async (codeOrUrl: string) => {
    try {
      await post("/auth/claude/complete", { code: codeOrUrl });
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
  }, [post]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setToken(null);
    setAuthorizeUrl(null);
  }, []);

  return { status, error, token, authorizeUrl, start, complete, reset };
}
