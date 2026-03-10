/**
 * @witqq/agent-sdk/chat/react — useRemoteAuth
 *
 * Server-delegated authentication hook. Delegates all auth flows to
 * the server auth handler (createAuthHandler) via HTTP, avoiding
 * browser crypto dependencies entirely.
 *
 * Replaces useAuth for browser contexts. Same interface shape for easy migration.
 */

import { useState, useCallback, useRef } from "react";
import type { AuthToken } from "../../auth/types.js";
import { useCopilotAuth } from "./auth/useCopilotAuth.js";
import { useClaudeAuth } from "./auth/useClaudeAuth.js";
import { useApiKeyAuth } from "./auth/useApiKeyAuth.js";

/** Supported remote auth backends. */
export type RemoteAuthBackend = "copilot" | "claude" | "vercel-ai";

/** Auth status state machine: idle → pending → authenticated | error. */
export type RemoteAuthStatus = "idle" | "pending" | "authenticated" | "error";

/** Options for the useRemoteAuth hook. */
export interface UseRemoteAuthOptions {
  /** Auth backend to use */
  backend: RemoteAuthBackend;
  /** Base URL of the auth server (e.g. "http://localhost:3456/api/auth") */
  baseUrl: string;
  /** Called after successful authentication */
  onAuthenticated?: (token: AuthToken) => void;
  /** Optional fetch override (for testing) */
  fetch?: typeof globalThis.fetch;
  /** Optional headers for all requests */
  headers?: Record<string, string>;
}

/** Return value from useRemoteAuth. */
export interface UseRemoteAuthReturn {
  status: RemoteAuthStatus;
  error: Error | null;
  // Copilot Device Flow (server-delegated)
  startDeviceFlow: () => Promise<void>;
  deviceCode: string | null;
  verificationUrl: string | null;
  // Claude OAuth (server-delegated)
  startOAuthFlow: () => Promise<void>;
  authorizeUrl: string | null;
  completeOAuth: (codeOrUrl: string) => Promise<void>;
  // API key (server-delegated)
  submitApiKey: (key: string, baseUrl?: string) => Promise<void>;
  // Unified start (auto-dispatches to correct flow by provider)
  start: (provider?: RemoteAuthBackend) => Promise<void>;
  // Common
  token: AuthToken | null;
  reset: () => void;
  // Server-specific
  savedProviders: string[];
  loadSavedTokens: () => Promise<void>;
  useSavedToken: (provider: RemoteAuthBackend) => Promise<void>;
  clearTokens: () => Promise<void>;
}

/**
 * Server-delegated authentication hook.
 *
 * Communicates with server auth handler endpoints (POST /auth/start,
 * POST /auth/copilot/poll, etc.) instead of running auth flows in the browser.
 * No node:crypto dependency since all crypto operations happen server-side.
 *
 * @param options - Hook configuration
 * @returns Auth state and action methods
 *
 * @example
 * ```ts
 * const auth = useRemoteAuth({
 *   backend: "copilot",
 *   baseUrl: "/api/auth",
 *   onAuthenticated: (token) => console.log("Authenticated:", token),
 * });
 * ```
 */
export function useRemoteAuth(options: UseRemoteAuthOptions): UseRemoteAuthReturn {
  const { backend, baseUrl, onAuthenticated, headers } = options;
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);

  // Orchestrator-level state (single source of truth for public interface)
  const [status, setStatus] = useState<RemoteAuthStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [token, setToken] = useState<AuthToken | null>(null);
  const [savedProviders, setSavedProviders] = useState<string[]>([]);

  const onAuthenticatedRef = useRef(onAuthenticated);
  onAuthenticatedRef.current = onAuthenticated;

  // Callbacks to sync per-backend hook outcomes → orchestrator state
  const handleSuccess = useCallback((authToken: AuthToken) => {
    setToken(authToken);
    setStatus("authenticated");
    onAuthenticatedRef.current?.(authToken);
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err);
    setStatus("error");
  }, []);

  const hookOpts = { baseUrl, headers, fetch: fetchFn, onAuthenticated: handleSuccess, onError: handleError };

  // Per-backend hooks for backend-specific state + auth HTTP calls
  const copilot = useCopilotAuth(hookOpts);
  const claude = useClaudeAuth(hookOpts);
  const apiKey = useApiKeyAuth(hookOpts);

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

  const get = useCallback(
    async (path: string) => {
      const res = await fetchFn(`${baseUrl}${path}`, {
        method: "GET",
        headers: { ...headers },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
    [baseUrl, fetchFn, headers],
  );

  // Wrap per-backend methods with backend guards and orchestrator status
  const startDeviceFlow = useCallback(async () => {
    if (backend !== "copilot") return;
    setStatus("pending");
    setError(null);
    await copilot.start();
  }, [backend, copilot]);

  const startOAuthFlow = useCallback(async () => {
    if (backend !== "claude") return;
    setStatus("pending");
    setError(null);
    await claude.start();
  }, [backend, claude]);

  const completeOAuth = useCallback(
    async (codeOrUrl: string) => {
      await claude.complete(codeOrUrl);
    },
    [claude],
  );

  const submitApiKey = useCallback(
    async (key: string, apiBaseUrl?: string) => {
      if (backend !== "vercel-ai") return;
      await apiKey.submit(key, apiBaseUrl);
    },
    [backend, apiKey],
  );

  // Cross-cutting operations managed at orchestrator level
  const loadSavedTokens = useCallback(async () => {
    try {
      const data = await get("/tokens/saved");
      setSavedProviders(data.saved || []);
    } catch {
      // Silently fail — saved tokens are optional
    }
  }, [get]);

  const useSavedToken = useCallback(
    async (provider: RemoteAuthBackend) => {
      try {
        await post("/tokens/use", { provider });
        const authToken: AuthToken = {
          accessToken: "server-managed",
          tokenType: "bearer",
          obtainedAt: Date.now(),
        };
        setToken(authToken);
        setStatus("authenticated");
        onAuthenticatedRef.current?.(authToken);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      }
    },
    [post],
  );

  const clearTokens = useCallback(async () => {
    try {
      await post("/tokens/clear");
      setSavedProviders([]);
    } catch {
      // Silently fail
    }
  }, [post]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setToken(null);
    copilot.reset();
    claude.reset();
    apiKey.reset();
    setSavedProviders([]);
  }, [copilot, claude, apiKey]);

  const start = useCallback(async (provider?: RemoteAuthBackend) => {
    const target = provider ?? backend;
    setStatus("pending");
    setError(null);
    switch (target) {
      case "copilot":
        await copilot.start();
        break;
      case "claude":
        await claude.start();
        break;
      case "vercel-ai": {
        const e = new Error("vercel-ai requires submitApiKey(key, baseUrl) — cannot auto-start");
        setError(e);
        setStatus("error");
        return;
      }
      default: {
        const e = new Error(`Unknown auth provider: ${target as string}`);
        setError(e);
        setStatus("error");
        return;
      }
    }
  }, [backend, copilot, claude]);

  return {
    status,
    error,
    startDeviceFlow,
    deviceCode: copilot.deviceCode,
    verificationUrl: copilot.verificationUrl,
    startOAuthFlow,
    authorizeUrl: claude.authorizeUrl,
    completeOAuth,
    submitApiKey,
    start,
    token,
    reset,
    savedProviders,
    loadSavedTokens,
    useSavedToken,
    clearTokens,
  };
}
