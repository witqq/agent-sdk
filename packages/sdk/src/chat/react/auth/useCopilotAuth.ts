/**
 * @witqq/agent-sdk/chat/react — useCopilotAuth
 *
 * Server-delegated Copilot Device Flow authentication hook.
 * Independently usable — does not require useRemoteAuth orchestrator.
 */

import { useState, useCallback, useRef } from "react";
import type { AuthToken } from "../../../auth/types.js";

/** Options for useCopilotAuth. */
export interface UseCopilotAuthOptions {
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

/** Return value from useCopilotAuth. */
export interface UseCopilotAuthReturn {
  status: "idle" | "pending" | "authenticated" | "error";
  error: Error | null;
  token: AuthToken | null;
  deviceCode: string | null;
  verificationUrl: string | null;
  /** Start the device flow. Shows deviceCode and verificationUrl, then polls for completion. */
  start: () => Promise<void>;
  reset: () => void;
}

/**
 * Copilot Device Flow authentication.
 * Starts device flow on server, provides code/URL for user, polls until complete.
 */
export function useCopilotAuth(options: UseCopilotAuthOptions): UseCopilotAuthReturn {
  const { baseUrl, headers } = options;
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);

  const [status, setStatus] = useState<"idle" | "pending" | "authenticated" | "error">("idle");
  const [error, setError] = useState<Error | null>(null);
  const [token, setToken] = useState<AuthToken | null>(null);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);

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
      const result = await post("/auth/start", { provider: "copilot" });
      setDeviceCode(result.userCode);
      setVerificationUrl(result.verificationUrl);
      await post("/auth/copilot/poll");
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
    setDeviceCode(null);
    setVerificationUrl(null);
  }, []);

  return { status, error, token, deviceCode, verificationUrl, start, reset };
}
