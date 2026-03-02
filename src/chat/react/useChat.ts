import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, RuntimeStatus } from "../core.js";
import { chatEventToAgentEvent } from "../core.js";
import { MessageAccumulator } from "../accumulator.js";
import { useChatRuntime } from "./ChatProvider.js";

/** Options for the useChat hook. */
export interface UseChatOptions {
  /** Session ID. If omitted, a new session is created on first send. */
  sessionId?: string;
  /** Called on error during send. */
  onError?: (error: Error) => void;
  /** Auto-dismiss errors after this many ms (0 = disabled, default: 0). */
  autoDismissMs?: number;
}

/** Token usage data from the last completed response. */
export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model?: string;
}

/** Return value from useChat. */
export interface UseChatReturn {
  /** Current session ID (null until session created). */
  sessionId: string | null;
  /** Ordered messages in the current session. */
  messages: ChatMessage[];
  /** Send a user message and trigger assistant response. */
  sendMessage: (content: string) => Promise<void>;
  /** Abort the current generation. */
  stop: () => void;
  /** Whether the assistant is currently generating. */
  isGenerating: boolean;
  /** Current runtime status. */
  status: RuntimeStatus;
  /** Current error, if any. */
  error: Error | null;
  /** Clear the error state. */
  clearError: () => void;
  /** Retry the last failed message. No-op if no error or no last user message. */
  retryLastMessage: () => Promise<void>;
  /** Create a new session, resetting messages. */
  newSession: () => Promise<string>;
  /** Token usage from the last completed response. */
  usage: ChatUsage | null;
}

/**
 * Convenience hook for chat interaction.
 * Wraps IChatRuntime with React state management and progressive streaming.
 * Messages update in real-time as tokens arrive (not after full response).
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const runtime = useChatRuntime();
  const [sessionId, setSessionId] = useState<string | null>(
    options.sessionId ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<RuntimeStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const generatingRef = useRef(false);
  const lastUserMessageRef = useRef<string | null>(null);

  const onErrorRef = useRef(options.onError);
  onErrorRef.current = options.onError;

  // Auto-dismiss timer
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissMs = options.autoDismissMs ?? 0;
  useEffect(() => {
    if (!error || autoDismissMs <= 0) return;
    dismissTimerRef.current = setTimeout(() => {
      setError(null);
      dismissTimerRef.current = null;
    }, autoDismissMs);
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [error, autoDismissMs]);

  // Sync session messages when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    runtime.getSession(sessionId).then((session) => {
      if (session) {
        setMessages([...session.messages]);
      }
    });
  }, [sessionId, runtime]);

  // Sync with external session switches (e.g. sidebar click → runtime.switchSession)
  useEffect(() => {
    return runtime.onSessionChange(() => {
      const activeId = runtime.activeSessionId;
      if (activeId && activeId !== sessionId) {
        setSessionId(activeId);
        setError(null);
      }
    });
  }, [runtime, sessionId]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    const session = await runtime.createSession({
      config: { model: "", backend: "" },
    });
    setSessionId(session.id);
    return session.id;
  }, [sessionId, runtime]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (generatingRef.current) return;
      lastUserMessageRef.current = content;
      setError(null);
      generatingRef.current = true;
      setIsGenerating(true);
      setStatus("streaming");

      // Hoisted for catch block access
      const accumulator = new MessageAccumulator();
      let hasEvents = false;

      try {
        const sid = await ensureSession();

        // Optimistic user message
        const now = new Date().toISOString();
        const userMsg: ChatMessage = {
          id: crypto.randomUUID() as unknown as ChatMessage["id"],
          role: "user",
          parts: [{ type: "text", text: content, status: "complete" }],
          status: "complete",
          createdAt: now,
          updatedAt: now,
        };
        setMessages((prev) => [...prev, userMsg]);

        for await (const event of runtime.send(sid, content)) {
          // Track usage from usage events
          if (event.type === "usage") {
            setUsage({
              promptTokens: event.promptTokens,
              completionTokens: event.completionTokens,
              totalTokens: event.promptTokens + event.completionTokens,
              model: event.model,
            });
          }
          const agentEvent = chatEventToAgentEvent(event);
          if (agentEvent) {
            accumulator.apply(agentEvent);
            hasEvents = true;
            // Update messages with streaming snapshot
            const snapshot = accumulator.snapshot();
            setMessages((prev) => {
              // Replace the last message if it's the streaming assistant message,
              // otherwise append
              const last = prev[prev.length - 1];
              if (last && last.id === snapshot.id) {
                return [...prev.slice(0, -1), snapshot];
              }
              return [...prev, snapshot];
            });
          }
        }

        // Replace streaming message with final persisted message from session
        const session = await runtime.getSession(sid);
        if (session) {
          setMessages([...session.messages]);
        } else if (hasEvents) {
          // Fallback: finalize accumulator if session fetch fails
          const final = accumulator.finalize();
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === final.id) {
              return [...prev.slice(0, -1), final];
            }
            return [...prev, final];
          });
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        onErrorRef.current?.(e);

        // Finalize accumulator with error status so partial message shows correctly
        if (hasEvents && !accumulator.finalized) {
          accumulator.apply({ type: "error", error: e.message, recoverable: false });
          const errorSnapshot = accumulator.finalize();
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === errorSnapshot.id) {
              return [...prev.slice(0, -1), errorSnapshot];
            }
            return prev;
          });
        }
      } finally {
        generatingRef.current = false;
        setIsGenerating(false);
        setStatus(runtime.status);
      }
    },
    [ensureSession, runtime],
  );

  const stop = useCallback(() => {
    runtime.abort();
  }, [runtime]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const retryLastMessage = useCallback(async () => {
    if (!lastUserMessageRef.current || generatingRef.current) return;
    await sendMessage(lastUserMessageRef.current);
  }, [sendMessage]);

  const newSession = useCallback(async () => {
    const session = await runtime.createSession({
      config: { model: "", backend: "" },
    });
    setSessionId(session.id);
    setMessages([]);
    setError(null);
    lastUserMessageRef.current = null;
    return session.id;
  }, [runtime]);

  return {
    sessionId,
    messages,
    sendMessage,
    stop,
    isGenerating,
    status,
    error,
    clearError,
    retryLastMessage,
    newSession,
    usage,
  };
}
