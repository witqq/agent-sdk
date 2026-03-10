/**
 * In-Process Chat Transport
 *
 * Sends ChatEvent objects via an async iterator, no network involved.
 * Useful for Electron apps, CLI tools, or testing.
 *
 * Usage:
 *   const { transport, events } = createInProcessTransport();
 *   // Server side: pipe runtime to transport
 *   const stream = runtime.send(sessionId, message);
 *   streamToTransport(stream, transport);
 *   // Client side: consume events
 *   for await (const event of events) {
 *     console.log(event);
 *   }
 */

import type { IChatTransport } from '@witqq/agent-sdk/chat/backends';
import type { ChatEvent } from '@witqq/agent-sdk/chat/core';

export class InProcessChatTransport implements IChatTransport {
  private _open = true;
  private _resolve: ((value: IteratorResult<ChatEvent>) => void) | null = null;
  private _buffer: ChatEvent[] = [];

  get isOpen(): boolean {
    return this._open;
  }

  send(event: ChatEvent): void {
    if (!this._open) return;
    if (this._resolve) {
      const resolve = this._resolve;
      this._resolve = null;
      resolve({ value: event, done: false });
    } else {
      this._buffer.push(event);
    }
  }

  close(): void {
    if (!this._open) return;
    this._open = false;
    if (this._resolve) {
      const resolve = this._resolve;
      this._resolve = null;
      resolve({ value: undefined as unknown as ChatEvent, done: true });
    }
  }

  error(err: Error): void {
    if (!this._open) return;
    this.send({
      type: 'error',
      error: { message: err.message, code: 'TRANSPORT_ERROR' },
    } as ChatEvent);
    this.close();
  }

  /** Async iterator for consuming events on the client side */
  [Symbol.asyncIterator](): AsyncIterator<ChatEvent> {
    return {
      next: () => {
        if (this._buffer.length > 0) {
          return Promise.resolve({ value: this._buffer.shift()!, done: false });
        }
        if (!this._open) {
          return Promise.resolve({ value: undefined as unknown as ChatEvent, done: true });
        }
        return new Promise<IteratorResult<ChatEvent>>((resolve) => {
          this._resolve = resolve;
        });
      },
    };
  }
}

/** Factory: creates transport + events iterator pair */
export function createInProcessTransport() {
  const transport = new InProcessChatTransport();
  return {
    transport,
    events: transport as AsyncIterable<ChatEvent>,
  };
}
