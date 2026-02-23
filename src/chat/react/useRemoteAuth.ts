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

  const [status, setStatus] = useState<RemoteAuthStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [token, setToken] = useState<AuthToken | null>(null);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [savedProviders, setSavedProviders] = useState<string[]>([]);

  const onAuthenticatedRef = useRef(onAuthenticated);
  onAuthenticatedRef.current = onAuthenticated;

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

  const startDeviceFlow = useCallback(async () => {
    if (backend !== "copilot") return;
    setStatus("pending");
    setError(null);
    try {
      // Start the flow on server
      const result = await post("/auth/start", { provider: "copilot" });
      setDeviceCode(result.userCode);
      setVerificationUrl(result.verificationUrl);
      // Poll for completion (server blocks until device flow completes)
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
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
    }
  }, [backend, post]);

  const startOAuthFlow = useCallback(async () => {
    if (backend !== "claude") return;
    setStatus("pending");
    setError(null);
    try {
      const result = await post("/auth/start", { provider: "claude" });
      setAuthorizeUrl(result.authorizeUrl);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
    }
  }, [backend, post]);

  const completeOAuth = useCallback(
    async (codeOrUrl: string) => {
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
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      }
    },
    [post],
  );

  const submitApiKey = useCallback(
    async (key: string, apiBaseUrl?: string) => {
      if (backend !== "vercel-ai") return;
      if (!key || !key.trim()) {
        setError(new Error("API key cannot be empty"));
        setStatus("error");
        return;
      }
      try {
        await post("/auth/vercel/complete", {
          apiKey: key.trim(),
          ...(apiBaseUrl ? { baseUrl: apiBaseUrl } : {}),
        });
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
    [backend, post],
  );

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
    setDeviceCode(null);
    setVerificationUrl(null);
    setAuthorizeUrl(null);
    setSavedProviders([]);
  }, []);

  const start = useCallback(async (provider?: RemoteAuthBackend) => {
    const target = provider ?? backend;
    setStatus("pending");
    setError(null);
    try {
      switch (target) {
        case "copilot": {
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
          break;
        }
        case "claude": {
          const result = await post("/auth/start", { provider: "claude" });
          setAuthorizeUrl(result.authorizeUrl);
          // OAuth is two-step: start sets authorizeUrl, user must call completeOAuth after redirect
          break;
        }
        case "vercel-ai":
          throw new Error("vercel-ai requires submitApiKey(key, baseUrl) — cannot auto-start");
        default:
          throw new Error(`Unknown auth provider: ${target as string}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
    }
  }, [backend, post]);

  return {
    status,
    error,
    startDeviceFlow,
    deviceCode,
    verificationUrl,
    startOAuthFlow,
    authorizeUrl,
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
