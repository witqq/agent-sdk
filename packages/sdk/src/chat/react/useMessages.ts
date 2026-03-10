import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { ChatMessage, ChatSession } from "../core.js";
import { isObservableSession } from "../core.js";
import { useChatRuntime } from "./ChatProvider.js";

/** Options for the useMessages hook. */
export interface UseMessagesOptions {
  /** Session ID to observe. */
  sessionId: string;
}

/** Return value from useMessages. */
export interface UseMessagesReturn {
  /** Ordered messages in the session. */
  messages: ChatMessage[];
  /** Whether the session was found. */
  isLoaded: boolean;
}

const EMPTY_MESSAGES: ChatMessage[] = [];

/**
 * Reactive message list via useSyncExternalStore.
 *
 * If the session supports subscribe/getSnapshot (reactive session),
 * uses useSyncExternalStore for granular updates.
 * Otherwise, falls back to polling via getSession().
 */
export function useMessages(options: UseMessagesOptions): UseMessagesReturn {
  const runtime = useChatRuntime();
  const { sessionId } = options;

  // Track session object for subscribe/getSnapshot
  const sessionRef = useRef<ChatSession | null>(null);
  const messagesRef = useRef<ChatMessage[]>(EMPTY_MESSAGES);
  const isLoadedRef = useRef(false);
  const versionRef = useRef(0);
  const listenersRef = useRef(new Set<() => void>());

  // Emit change to external store subscribers
  const emitChange = useCallback(() => {
    versionRef.current++;
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback(
    (callback: () => void) => {
      listenersRef.current.add(callback);
      return () => {
        listenersRef.current.delete(callback);
      };
    },
    [],
  );

  // Snapshot function for useSyncExternalStore
  const getSnapshot = useCallback(() => {
    return messagesRef.current;
  }, []);

  // Load session and set up reactive subscription or polling
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let pollInterval: ReturnType<typeof setInterval> | undefined;

    async function load() {
      const session = await runtime.getSession(sessionId);
      if (cancelled) return;

      if (!session) {
        sessionRef.current = null;
        messagesRef.current = EMPTY_MESSAGES;
        isLoadedRef.current = false;
        emitChange();
        return;
      }

      sessionRef.current = session;
      messagesRef.current = session.messages;
      isLoadedRef.current = true;
      emitChange();

      // If session supports reactive API (ObservableSession), use it
      if (isObservableSession(session)) {
        unsubscribe = session.subscribe(() => {
          const snapshot = session.getSnapshot();
          messagesRef.current = snapshot.messages;
          emitChange();
        });
      } else {
        // Fallback: poll for changes
        pollInterval = setInterval(async () => {
          if (cancelled) return;
          const updated = await runtime.getSession(sessionId);
          if (cancelled || !updated) return;
          if (updated.messages.length !== messagesRef.current.length) {
            messagesRef.current = updated.messages;
            emitChange();
          }
        }, 500);
      }
    }

    load();

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sessionId, runtime, emitChange]);

  const messages = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    messages,
    isLoaded: isLoadedRef.current,
  };
}
