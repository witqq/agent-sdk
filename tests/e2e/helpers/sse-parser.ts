/**
 * SSE (Server-Sent Events) stream parser for E2E tests.
 *
 * Parses text/event-stream format into typed ChatEvent objects.
 * Handles multi-line data, event types, and [DONE] sentinel.
 */

export interface SSEEvent {
  /** Event type (from "event:" field, or empty for default) */
  type: string;
  /** Parsed JSON data (from "data:" field) */
  data: unknown;
}

/**
 * Parse a fetch Response as an SSE stream, yielding events.
 * Terminates on [DONE] sentinel or stream end.
 */
export async function* parseSSEStream(response: Response): AsyncGenerator<SSEEvent> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response has no body");

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let currentData = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete last line

      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
          continue;
        }
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          currentData += (currentData ? "\n" : "") + data;
          continue;
        }
        if (line === "" && currentData) {
          // Empty line = event boundary
          try {
            const parsed = JSON.parse(currentData);
            yield { type: currentEvent || "message", data: parsed };
          } catch {
            // Non-JSON data, yield as-is
            yield { type: currentEvent || "message", data: currentData };
          }
          currentEvent = "";
          currentData = "";
        }
        // Lines starting with ":" are comments (heartbeats) — skip
      }
    }

    // Process any remaining data
    if (currentData) {
      try {
        const parsed = JSON.parse(currentData);
        yield { type: currentEvent || "message", data: parsed };
      } catch {
        yield { type: currentEvent || "message", data: currentData };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Collect all SSE events from a response into an array.
 * Useful for assertions.
 */
export async function collectSSEEvents(response: Response): Promise<SSEEvent[]> {
  const events: SSEEvent[] = [];
  for await (const event of parseSSEStream(response)) {
    events.push(event);
  }
  return events;
}
