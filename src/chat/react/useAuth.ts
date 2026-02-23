import { useState, useCallback, useRef } from "react";
import type { AuthToken, DeviceFlowResult, OAuthFlowResult } from "../../auth/index.js";

// Lazy-load auth classes to avoid bundling node:crypto into browser builds.
// Exported as mutable refs for testability (vi.mock on dynamic imports is unreliable in threads).
export const _authLoaders = {
  async loadCopilotAuth() {
    const { CopilotAuth } = await import("../../auth/index.js");
    return CopilotAuth;
  },
  async loadClaudeAuth() {
    const { ClaudeAuth } = await import("../../auth/index.js");
    return ClaudeAuth;
  },
};

/** Supported auth backends. */
export type AuthBackend = "copilot" | "claude" | "api-key";

/** Auth status state machine: idle → pending → authenticated | error. */
export type AuthStatus = "idle" | "pending" | "authenticated" | "error";

/** Options for the useAuth hook. */
export interface UseAuthOptions {
  backend: AuthBackend;
  onAuthenticated?: (token: AuthToken) => void;
}

/** Return value from useAuth. */
export interface UseAuthReturn {
  status: AuthStatus;
  error: Error | null;
  // Copilot Device Flow
  startDeviceFlow: () => Promise<void>;
  deviceCode: string | null;
  verificationUrl: string | null;
  // Claude OAuth
  startOAuthFlow: () => Promise<void>;
  authorizeUrl: string | null;
  completeOAuth: (codeOrUrl: string) => Promise<void>;
  // API key
  submitApiKey: (key: string) => void;
  // Common
  token: AuthToken | null;
  reset: () => void;
}

/**
 * Hook for multi-backend authentication.
 *
 * Wraps CopilotAuth (Device Flow), ClaudeAuth (OAuth+PKCE),
 * and plain API key validation into a unified React state machine.
 *
 * @deprecated Use `useRemoteAuth` instead for browser contexts.
 * `useAuth` directly instantiates auth classes which require `node:crypto`
 * (via ClaudeAuth). The `useRemoteAuth` hook delegates authentication to
 * server endpoints (createAuthHandler), avoiding browser crypto dependencies.
 *
 * Migration: replace `useAuth({ backend })` with
 * `useRemoteAuth({ backend, baseUrl: "/api/auth" })`.
 * Note: the `"api-key"` backend is renamed to `"vercel-ai"` in useRemoteAuth,
 * and `submitApiKey` is now async (returns Promise<void>).
 * The return interface is otherwise compatible — `startDeviceFlow`, `startOAuthFlow`,
 * `completeOAuth`, `submitApiKey`, `token`, `status`, `error`, `reset`
 * all work the same way.
 */
export function useAuth(options: UseAuthOptions): UseAuthReturn {
  const { backend, onAuthenticated } = options;
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [token, setToken] = useState<AuthToken | null>(null);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);

  const onAuthenticatedRef = useRef(onAuthenticated);
  onAuthenticatedRef.current = onAuthenticated;

  // Store completeAuth callback from Claude OAuth flow
  const completeAuthRef = useRef<OAuthFlowResult["completeAuth"] | null>(null);

  const startDeviceFlow = useCallback(async () => {
    if (backend !== "copilot") return;
    setStatus("pending");
    setError(null);
    try {
      const CopilotAuth = await _authLoaders.loadCopilotAuth();
      const auth = new CopilotAuth();
      const result: DeviceFlowResult = await auth.startDeviceFlow();
      setDeviceCode(result.userCode);
      setVerificationUrl(result.verificationUrl);
      const authToken = await result.waitForToken();
      setToken(authToken);
      setStatus("authenticated");
      onAuthenticatedRef.current?.(authToken);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
    }
  }, [backend]);

  const startOAuthFlow = useCallback(async () => {
    if (backend !== "claude") return;
    setStatus("pending");
    setError(null);
    try {
      const ClaudeAuth = await _authLoaders.loadClaudeAuth();
      const auth = new ClaudeAuth();
      const result: OAuthFlowResult = auth.startOAuthFlow();
      setAuthorizeUrl(result.authorizeUrl);
      completeAuthRef.current = result.completeAuth;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
    }
  }, [backend]);

  const completeOAuth = useCallback(async (codeOrUrl: string) => {
    if (!completeAuthRef.current) return;
    try {
      const authToken = await completeAuthRef.current(codeOrUrl);
      setToken(authToken);
      setStatus("authenticated");
      onAuthenticatedRef.current?.(authToken);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus("error");
    }
  }, []);

  const submitApiKey = useCallback((key: string) => {
    if (backend !== "api-key") return;
    if (!key || !key.trim()) {
      setError(new Error("API key cannot be empty"));
      setStatus("error");
      return;
    }
    const authToken: AuthToken = {
      accessToken: key.trim(),
      tokenType: "bearer",
      obtainedAt: Date.now(),
    };
    setToken(authToken);
    setStatus("authenticated");
    onAuthenticatedRef.current?.(authToken);
  }, [backend]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setToken(null);
    setDeviceCode(null);
    setVerificationUrl(null);
    setAuthorizeUrl(null);
    completeAuthRef.current = null;
  }, []);

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
    token,
    reset,
  };
}
