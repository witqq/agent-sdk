/**
 * WebSocket Chat Transport
 *
 * Sends ChatEvent objects over a WebSocket connection.
 * Compatible with any WebSocket library that implements send() and readyState.
 *
 * Usage:
 *   const wss = new WebSocketServer({ port: 8080 });
 *   wss.on('connection', (ws) => {
 *     const transport = new WsChatTransport(ws);
 *     const stream = runtime.send(sessionId, message);
 *     await streamToTransport(stream, transport);
 *   });
 */

import type { IChatTransport } from '@witqq/agent-sdk/chat/backends';
import type { ChatEvent } from '@witqq/agent-sdk/chat/core';

/** Minimal WebSocket interface (works with ws, uWebSockets, browser WebSocket) */
interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
  on?(event: 'close', listener: () => void): void;
  addEventListener?(event: 'close', listener: () => void): void;
}

const WS_OPEN = 1;

export class WsChatTransport implements IChatTransport {
  private _open = true;

  constructor(private ws: WebSocketLike) {
    const onClose = () => { this._open = false; };
    if (ws.on) ws.on('close', onClose);
    else if (ws.addEventListener) ws.addEventListener('close', onClose);
  }

  get isOpen(): boolean {
    return this._open && this.ws.readyState === WS_OPEN;
  }

  send(event: ChatEvent): void {
    if (!this.isOpen) return;
    this.ws.send(JSON.stringify(event));
  }

  close(): void {
    if (!this._open) return;
    this._open = false;
    // Send done sentinel before closing
    if (this.ws.readyState === WS_OPEN) {
      this.ws.send(JSON.stringify({ type: 'done' }));
      this.ws.close(1000, 'Stream complete');
    }
  }

  error(err: Error): void {
    if (!this._open) return;
    this._open = false;
    if (this.ws.readyState === WS_OPEN) {
      this.ws.send(JSON.stringify({
        type: 'error',
        error: { message: err.message, code: 'TRANSPORT_ERROR' },
      }));
      this.ws.close(1011, err.message);
    }
  }
}
