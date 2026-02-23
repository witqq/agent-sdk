/**
 * @witqq/agent-sdk - In-Process Chat Transport
 *
 * IChatTransport implementation for zero-network communication.
 * Events are pushed into an internal buffer and consumed via async iteration.
 * Useful for testing, embedded runtimes, CLI tools, and in-process communication.
 */

import type { ChatEvent } from "../core.js";
import type { IChatTransport } from "./transport.js";

// ─── InProcessChatTransport ────────────────────────────────────

/**
 * In-process transport for ChatEvent streaming.
 * Producer pushes events via IChatTransport.send(), consumer reads via async iteration.
 *
 * @example
 * ```ts
 * const transport = new InProcessChatTransport();
 *
 * // Consumer side (async iteration)
 * (async () => {
 *   for await (const event of transport) {
 *     console.log("Received:", event);
 *   }
 * })();
 *
 * // Producer side (via streamToTransport or manual)
 * transport.send({ type: "message:start", messageId, role: "assistant" });
 * transport.send({ type: "message:delta", messageId, text: "Hello" });
 * transport.close();
 * ```
 */
export class InProcessChatTransport implements IChatTransport {
  private _open: boolean = true;
  private _buffer: ChatEvent[] = [];
  private _resolve: ((value: IteratorResult<ChatEvent>) => void) | null = null;
  private _error: Error | null = null;

  get isOpen(): boolean {
    return this._open;
  }

  send(event: ChatEvent): void {
    if (!this._open) return;

    if (this._resolve) {
      // Consumer is waiting — deliver immediately
      const resolve = this._resolve;
      this._resolve = null;
      resolve({ value: event, done: false });
    } else {
      // Buffer for later consumption
      this._buffer.push(event);
    }
  }

  close(): void {
    if (!this._open) return;
    this._open = false;

    if (this._resolve) {
      // Consumer is waiting — signal completion
      const resolve = this._resolve;
      this._resolve = null;
      resolve({ value: undefined as unknown as ChatEvent, done: true });
    }
  }

  error(err: Error): void {
    if (!this._open) return;
    this._open = false;

    const errorEvent: ChatEvent = {
      type: "error",
      error: err.message,
      recoverable: false,
    };

    if (this._resolve) {
      // Consumer is waiting — deliver error event directly
      const resolve = this._resolve;
      this._resolve = null;
      resolve({ value: errorEvent, done: false });
    } else {
      // Buffer error event for later consumption
      this._error = err;
    }
  }

  // ─── AsyncIterable protocol ────────────────────────────────

  [Symbol.asyncIterator](): AsyncIterator<ChatEvent> {
    return {
      next: (): Promise<IteratorResult<ChatEvent>> => {
        // Deliver buffered events first
        if (this._buffer.length > 0) {
          return Promise.resolve({ value: this._buffer.shift()!, done: false });
        }

        // If there was an error, deliver error event then done
        if (this._error) {
          const err = this._error;
          this._error = null;
          const errorEvent: ChatEvent = {
            type: "error",
            error: err.message,
            recoverable: false,
          };
          return Promise.resolve({ value: errorEvent, done: false });
        }

        // If closed and buffer empty, we're done
        if (!this._open) {
          return Promise.resolve({ value: undefined as unknown as ChatEvent, done: true });
        }

        // Wait for next event
        return new Promise<IteratorResult<ChatEvent>>((resolve) => {
          this._resolve = resolve;
        });
      },
    };
  }
}
