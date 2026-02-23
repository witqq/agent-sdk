/**
 * @witqq/agent-sdk/chat/react — useSessions
 *
 * Reactive session list hook that subscribes to runtime session changes.
 * Auto-updates without manual polling via `onSessionChange` subscription.
 */

import { useState, useEffect, useCallback } from "react";
import type { SessionInfo, ChatSession } from "../core.js";
import type { IChatRuntime } from "../runtime.js";
import { useChatRuntime } from "./ChatProvider.js";

/** Return type of useSessions hook. */
export interface UseSessionsReturn {
  /** Current session list (lightweight SessionInfo format) */
  sessions: SessionInfo[];
  /** Whether initial load or refresh is in progress */
  loading: boolean;
  /** Last error from session fetch */
  error: Error | null;
  /** Manually trigger a refresh */
  refresh: () => void;
}

/** Map a full ChatSession to lightweight SessionInfo. */
function toSessionInfo(s: ChatSession): SessionInfo {
  return {
    id: s.id,
    title: s.title,
    status: s.status,
    messageCount: s.metadata.messageCount,
    lastMessage: s.messages[s.messages.length - 1],
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/**
 * Reactive session list hook.
 * Subscribes to `runtime.onSessionChange()` and refreshes the list automatically
 * on create, delete, archive, and message send completion.
 */
export function useSessions(): UseSessionsReturn {
  const runtime: IChatRuntime = useChatRuntime();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const list = await runtime.listSessions();
      setSessions(list.map(toSessionInfo));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [runtime]);

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Subscribe to session changes
  useEffect(() => {
    return runtime.onSessionChange(() => {
      fetchSessions();
    });
  }, [runtime, fetchSessions]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, refresh };
}
