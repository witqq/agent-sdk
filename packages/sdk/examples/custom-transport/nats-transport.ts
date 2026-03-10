/**
 * NATS Chat Transport
 *
 * Publishes ChatEvent objects to a NATS subject.
 * For microservice architectures where chat events go through a message bus.
 *
 * This is the pattern used by claude-supervisor (NATS-based architecture).
 *
 * Usage:
 *   import { connect } from 'nats';
 *   const nc = await connect({ servers: 'nats://localhost:4222' });
 *
 *   // Server: publish events to session-specific subject
 *   const transport = new NatsChatTransport(nc, `chat.session.${sessionId}.events`);
 *   const stream = runtime.send(sessionId, message);
 *   await streamToTransport(stream, transport);
 *
 *   // Client: subscribe to same subject
 *   const sub = nc.subscribe(`chat.session.${sessionId}.events`);
 *   for await (const msg of sub) {
 *     const event: ChatEvent = JSON.parse(new TextDecoder().decode(msg.data));
 *     if (event.type === 'done') break;
 *     handleEvent(event);
 *   }
 */

import type { IChatTransport } from '@witqq/agent-sdk/chat/backends';
import type { ChatEvent } from '@witqq/agent-sdk/chat/core';

/** Minimal NATS connection interface (works with nats, nats.ws) */
interface NatsConnectionLike {
  publish(subject: string, data?: Uint8Array): void;
  isClosed(): boolean;
}

export class NatsChatTransport implements IChatTransport {
  private _open = true;
  private encoder = new TextEncoder();

  constructor(
    private nc: NatsConnectionLike,
    private subject: string,
  ) {}

  get isOpen(): boolean {
    return this._open && !this.nc.isClosed();
  }

  send(event: ChatEvent): void {
    if (!this.isOpen) return;
    this.nc.publish(this.subject, this.encoder.encode(JSON.stringify(event)));
  }

  close(): void {
    if (!this._open) return;
    this._open = false;
    if (!this.nc.isClosed()) {
      this.nc.publish(this.subject, this.encoder.encode(JSON.stringify({ type: 'done' })));
    }
  }

  error(err: Error): void {
    if (!this._open) return;
    this._open = false;
    if (!this.nc.isClosed()) {
      this.nc.publish(this.subject, this.encoder.encode(JSON.stringify({
        type: 'error',
        error: { message: err.message, code: 'TRANSPORT_ERROR' },
      })));
    }
  }
}
