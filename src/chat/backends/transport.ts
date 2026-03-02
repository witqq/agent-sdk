/**
 * @witqq/agent-sdk/chat/backends/transport
 *
 * IChatTransport abstracts how ChatEvents are delivered to clients.
 * SSEChatTransport implements Server-Sent Events over HTTP.
 */

import type { ChatEvent } from "../core.js";

// ─── IChatTransport Interface ──────────────────────────────────

/**
 * Abstraction for delivering chat events to a client.
 * Implementations handle protocol details (SSE, WebSocket, etc.).
 */
export interface IChatTransport {
  /** Send a single chat event to the client */
  send(event: ChatEvent): void;

  /** Signal stream completion and close the connection */
  close(): void;

  /** Signal an error to the client */
  error(err: Error): void;

  /** Whether the transport is still open */
  readonly isOpen: boolean;
}

// ─── SSE Chat Transport ────────────────────────────────────────

/** Writable HTTP response interface — minimal type satisfied by Express, Fastify (raw), and Node http.ServerResponse without casts. */
export interface WritableResponse {
  writeHead(statusCode: number, headers?: Record<string, string | string[]>): unknown;
  setHeader(name: string, value: string): unknown;
  write(chunk: string): boolean;
  end(body?: string): unknown;
  readonly writableEnded: boolean;
}

/** Minimal interface for detecting client disconnection */
export interface CloseDetectable {
  on(event: "close", listener: () => void): void;
}

/** Configuration options for SSEChatTransport */
export interface SSETransportOptions {
  /** Heartbeat interval in milliseconds. 0 or undefined disables heartbeat. */
  heartbeatMs?: number;
  /** Request object for detecting client disconnection (listens for 'close' event) */
  request?: CloseDetectable;
}

/**
 * Server-Sent Events transport for ChatEvent streaming.
 * Sends events as `data: JSON\n\n` lines with SSE headers.
 */
export class SSEChatTransport implements IChatTransport {
  private readonly res: WritableResponse;
  private _open: boolean;
  private _heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  constructor(res: WritableResponse, options?: SSETransportOptions) {
    this.res = res;
    this._open = true;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Close detection via request 'close' event
    if (options?.request) {
      options.request.on("close", () => {
        this._cleanup();
      });
    }

    // Periodic heartbeat to keep connection alive
    const heartbeatMs = options?.heartbeatMs;
    if (heartbeatMs && heartbeatMs > 0) {
      this._heartbeatTimer = setInterval(() => {
        if (!this.isOpen) {
          this._clearHeartbeat();
          return;
        }
        this.res.write(": heartbeat\n\n");
      }, heartbeatMs);
    }
  }

  get isOpen(): boolean {
    return this._open && !this.res.writableEnded;
  }

  send(event: ChatEvent): void {
    if (!this.isOpen) return;
    this.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  close(): void {
    if (!this.isOpen) return;
    this._open = false;
    this._clearHeartbeat();
    this.res.write(`data: [DONE]\n\n`);
    this.res.end();
  }

  error(err: Error): void {
    if (!this.isOpen) return;
    this._open = false;
    this._clearHeartbeat();
    const errorEvent: ChatEvent = {
      type: "error",
      error: err.message,
      recoverable: false,
    };
    this.res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    this.res.end();
  }

  private _cleanup(): void {
    this._open = false;
    this._clearHeartbeat();
  }

  private _clearHeartbeat(): void {
    if (this._heartbeatTimer !== undefined) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = undefined;
    }
  }
}

// ─── Helper: Stream Adapter Events to Transport ────────────────

/**
 * Pipes an async iterable of ChatEvents into a transport.
 * Handles errors and ensures transport is closed on completion.
 *
 * @param events - Async iterable of ChatEvent (from adapter.streamMessage)
 * @param transport - Transport to send events through
 */
export async function streamToTransport(
  events: AsyncIterable<ChatEvent>,
  transport: IChatTransport,
): Promise<void> {
  try {
    const textChunks: string[] = [];

    for await (const event of events) {
      if (!transport.isOpen) break;
      transport.send(event);

      if (event.type === "message:delta") {
        textChunks.push(event.text);
      }
    }

    if (transport.isOpen) {
      const finalOutput = textChunks.length > 0 ? textChunks.join("") : undefined;
      transport.send({ type: "done", finalOutput });
    }
    transport.close();
  } catch (err) {
    transport.error(err instanceof Error ? err : new Error(String(err)));
  }
}
