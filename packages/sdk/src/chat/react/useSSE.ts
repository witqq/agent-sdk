import { useState, useRef, useCallback, useEffect } from "react";
import type { ChatEvent } from "../core.js";

/** Connection status of the SSE hook. */
export type SSEStatus = "idle" | "connecting" | "open" | "closed" | "error";

/** Options for the useSSE hook. */
export interface UseSSEOptions {
  /** HTTP method (default: "GET") */
  method?: "GET" | "POST";
  /** Request body for POST requests (JSON-serialized automatically) */
  body?: unknown;
  headers?: Record<string, string>;
  onEvent?: (event: ChatEvent) => void;
  onError?: (error: Error) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

/** Return type for the useSSE hook. */
export interface UseSSEReturn {
  status: SSEStatus;
  connect: () => void;
  disconnect: () => void;
  lastEvent: ChatEvent | null;
}

/**
 * SSE transport hook using fetch (not EventSource).
 * Parses text/event-stream format with support for multi-line data and event types.
 */
export function useSSE(
  url: string | null,
  options: UseSSEOptions = {},
): UseSSEReturn {
  const [status, setStatus] = useState<SSEStatus>(url === null ? "idle" : "idle");
  const [lastEvent, setLastEvent] = useState<ChatEvent | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatus("closed");
  }, []);

  const connect = useCallback(() => {
    if (!url) return;

    // Clear any pending reconnect timer
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // Abort previous connection
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("connecting");

    (async () => {
      try {
        const fetchInit: RequestInit = {
          method: optionsRef.current.method ?? "GET",
          headers: {
            Accept: "text/event-stream",
            ...optionsRef.current.headers,
          },
          signal: controller.signal,
        };

        if (fetchInit.method === "POST" && optionsRef.current.body !== undefined) {
          (fetchInit.headers as Record<string, string>)["Content-Type"] = "application/json";
          fetchInit.body = JSON.stringify(optionsRef.current.body);
        }

        const response = await fetch(url, fetchInit);

        if (!response.ok) {
          throw new Error(`SSE request failed: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("SSE response has no body");
        }

        setStatus("open");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let dataLines: string[] = [];

        const dispatchEvent = () => {
          if (dataLines.length === 0) return;
          const data = dataLines.join("\n");
          dataLines = [];

          try {
            const parsed = JSON.parse(data) as ChatEvent;
            setLastEvent(parsed);
            optionsRef.current.onEvent?.(parsed);
          } catch {
            // Non-JSON data, ignore
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!; // Keep incomplete last line in buffer

          for (const line of lines) {
            if (line === "") {
              // Empty line = dispatch event
              dispatchEvent();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trimStart());
            } else if (line.startsWith("event:")) {
              // Event type field — parsed but not used separately
              // since ChatEvent carries its own type in the JSON data
            }
            // Ignore comments (lines starting with :) and other fields
          }
        }

        // Dispatch any remaining data
        if (dataLines.length > 0) {
          dispatchEvent();
        }

        if (!controller.signal.aborted) {
          setStatus("closed");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const error =
          err instanceof Error ? err : new Error(String(err));
        setStatus("error");
        optionsRef.current.onError?.(error);

        // Reconnect on error if enabled
        if (optionsRef.current.reconnect && !controller.signal.aborted) {
          const delay = optionsRef.current.reconnectInterval ?? 3000;
          reconnectTimerRef.current = setTimeout(() => {
            if (abortRef.current && !abortRef.current.signal.aborted) {
              connect();
            }
          }, delay) as unknown as number;
        }
      }
    })();
  }, [url]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  return { status, connect, disconnect, lastEvent };
}
