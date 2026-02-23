/**
 * @witqq/agent-sdk - WebSocket Chat Transport
 *
 * IChatTransport implementation over WebSocket connections.
 * Accepts a WebSocket-like abstraction compatible with `ws`, native WebSocket, etc.
 */

import type { ChatEvent } from "../core.js";
import type { IChatTransport } from "./transport.js";

// ─── WebSocket Abstraction ─────────────────────────────────────

/** Ready states matching the WebSocket spec (ws, browser, Deno, Bun) */
export const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

/**
 * Minimal WebSocket interface compatible with `ws`, browser WebSocket, Deno, Bun.
 * Only the methods/properties used by WsChatTransport.
 */
export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "close", listener: () => void): void;
  addEventListener(type: "error", listener: (err: unknown) => void): void;
}

/** Configuration options for WsChatTransport */
export interface WsTransportOptions {
  /** Heartbeat interval in ms. 0 or undefined disables heartbeat. */
  heartbeatMs?: number;
  /** Custom JSON serializer (defaults to JSON.stringify) */
  serialize?: (event: ChatEvent) => string;
}

// ─── WsChatTransport ───────────────────────────────────────────

/**
 * WebSocket transport for ChatEvent streaming.
 * Sends events as JSON messages over a WebSocket connection.
 */
export class WsChatTransport implements IChatTransport {
  private readonly ws: WebSocketLike;
  private readonly serialize: (event: ChatEvent) => string;
  private _open: boolean;
  private _heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  constructor(ws: WebSocketLike, options?: WsTransportOptions) {
    this.ws = ws;
    this.serialize = options?.serialize ?? JSON.stringify;
    this._open = ws.readyState === WS_READY_STATE.OPEN;

    ws.addEventListener("close", () => {
      this._cleanup();
    });

    ws.addEventListener("error", () => {
      this._cleanup();
    });

    const heartbeatMs = options?.heartbeatMs;
    if (heartbeatMs && heartbeatMs > 0) {
      this._heartbeatTimer = setInterval(() => {
        if (!this.isOpen) {
          this._clearHeartbeat();
          return;
        }
        this.ws.send(this.serialize({ type: "heartbeat" } as ChatEvent));
      }, heartbeatMs);
    }
  }

  get isOpen(): boolean {
    return this._open && this.ws.readyState === WS_READY_STATE.OPEN;
  }

  send(event: ChatEvent): void {
    if (!this.isOpen) return;
    this.ws.send(this.serialize(event));
  }

  close(): void {
    if (!this.isOpen) return;
    this._open = false;
    this._clearHeartbeat();
    // Send done signal before closing
    this.ws.send(this.serialize({ type: "done" } as ChatEvent));
    this.ws.close(1000, "stream complete");
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
    this.ws.send(this.serialize(errorEvent));
    this.ws.close(1011, err.message);
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
