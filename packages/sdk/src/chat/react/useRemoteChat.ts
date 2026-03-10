/**
 * @witqq/agent-sdk/chat/react — useRemoteChat
 *
 * Lifecycle hook that orchestrates auth → runtime → session.
 *
 * On mount, checks for saved auth tokens and auto-restores.
 * Once authenticated, creates a RemoteChatClient and initial session.
 * Exposes readiness phase, the client instance, and the auth sub-hook.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { IChatClient } from "../runtime.js";
import { RemoteChatClient } from "./RemoteChatClient.js";
import { useRemoteAuth } from "./useRemoteAuth.js";
import type { RemoteAuthBackend, UseRemoteAuthReturn } from "./useRemoteAuth.js";

/** Lifecycle phase for the useRemoteChat hook. */
export type RemoteChatPhase =
  | "initializing"
  | "unauthenticated"
  | "authenticating"
  | "creating"
  | "ready"
  | "error";

/** Options for useRemoteChat. */
export interface UseRemoteChatOptions {
  /** Base URL for chat API (e.g. "/api/chat"). */
  chatBaseUrl: string;
  /** Base URL for auth API (e.g. "/api/auth"). */
  authBaseUrl: string;
  /** Auth backend to use. */
  backend: RemoteAuthBackend;
  /** Called when lifecycle reaches "ready" phase. */
  onReady?: () => void;
  /** Custom fetch for testability. */
  fetch?: typeof globalThis.fetch;
  /** Optional headers for all requests. */
  headers?: Record<string, string>;
}

/** Return value from useRemoteChat. */
export interface UseRemoteChatReturn {
  /** Current lifecycle phase. */
  phase: RemoteChatPhase;
  /** Chat client (null until phase = "ready"). */
  runtime: IChatClient | null;
  /** Initial session ID (null until phase = "ready"). */
  sessionId: string | null;
  /** Auth sub-hook for manual auth control. */
  auth: UseRemoteAuthReturn;
  /** Current error (null when no error). */
  error: Error | null;
  /** Create a new chat session. Returns session ID. */
  newSession: () => Promise<string>;
  /** Logout: clear tokens, dispose runtime, reset to unauthenticated. */
  logout: () => Promise<void>;
}

/**
 * Lifecycle hook: auth → runtime → session.
 *
 * @example
 * ```tsx
 * const chat = useRemoteChat({
 *   chatBaseUrl: "/api/chat",
 *   authBaseUrl: "/api/auth",
 *   backend: "copilot",
 * });
 *
 * if (chat.phase === "unauthenticated") {
 *   return <button onClick={() => chat.auth.start()}>Login</button>;
 * }
 * if (chat.phase === "ready" && chat.runtime) {
 *   return <ChatProvider runtime={chat.runtime}>...</ChatProvider>;
 * }
 * ```
 */
export function useRemoteChat(options: UseRemoteChatOptions): UseRemoteChatReturn {
  const {
    chatBaseUrl,
    authBaseUrl,
    backend,
    onReady,
    headers,
  } = options;
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);

  const [phase, setPhase] = useState<RemoteChatPhase>("initializing");
  const [runtime, setRuntime] = useState<IChatClient | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // Track if component is still mounted
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Auth sub-hook
  const auth = useRemoteAuth({
    backend,
    baseUrl: authBaseUrl,
    fetch: fetchFn,
    headers,
  });

  // Load saved tokens on mount
  const restoredRef = useRef(false);
  const [tokensLoaded, setTokensLoaded] = useState(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    (async () => {
      try {
        await auth.loadSavedTokens();
      } catch {
        // No saved tokens — that's fine
      }
      if (mountedRef.current) setTokensLoaded(true);
    })();
  // auth.loadSavedTokens is stable (useCallback)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When saved tokens load, auto-use if backend matches
  useEffect(() => {
    if (!tokensLoaded) return;
    if (
      auth.status === "idle" &&
      auth.savedProviders.includes(backend) &&
      phase === "initializing"
    ) {
      auth.useSavedToken(backend).catch(() => {
        if (mountedRef.current) setPhase("unauthenticated");
      });
    } else if (
      auth.status === "idle" &&
      !auth.savedProviders.includes(backend) &&
      phase === "initializing"
    ) {
      setPhase("unauthenticated");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokensLoaded, auth.status, auth.savedProviders, backend, phase]);

  // Track auth status → phase transitions
  useEffect(() => {
    if (auth.status === "pending") {
      setPhase("authenticating");
    } else if (auth.status === "error" && auth.error) {
      setError(auth.error);
      setPhase("error");
    }
  }, [auth.status, auth.error]);

  // When authenticated → create runtime + session
  const creatingRef = useRef(false);
  useEffect(() => {
    if (auth.status !== "authenticated" || creatingRef.current || runtime !== null) return;
    creatingRef.current = true;
    setPhase("creating");
    setError(null);

    (async () => {
      try {
        const rt = new RemoteChatClient({
          baseUrl: chatBaseUrl,
          headers,
          fetch: fetchFn,
        });
        const session = await rt.createSession({});
        if (!mountedRef.current) return;
        setRuntime(rt);
        setSessionId(session.id);
        setPhase("ready");
        onReadyRef.current?.();
      } catch (err) {
        if (!mountedRef.current) return;
        creatingRef.current = false;
        setError(err instanceof Error ? err : new Error(String(err)));
        setPhase("error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, chatBaseUrl]);

  const newSession = useCallback(async () => {
    if (!runtime) throw new Error("Runtime not ready");
    const session = await runtime.createSession({});
    setSessionId(session.id);
    return session.id;
  }, [runtime]);

  const logout = useCallback(async () => {
    try { await auth.clearTokens(); } catch { /* best effort */ }
    if (runtime) {
      try { runtime.dispose(); } catch { /* best effort */ }
    }
    auth.reset();
    setRuntime(null);
    setSessionId(null);
    setError(null);
    setTokensLoaded(false);
    creatingRef.current = false;
    restoredRef.current = false;
    setPhase("unauthenticated");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.clearTokens, auth.reset, runtime]);

  return {
    phase,
    runtime,
    sessionId,
    auth,
    error,
    newSession,
    logout,
  };
}
