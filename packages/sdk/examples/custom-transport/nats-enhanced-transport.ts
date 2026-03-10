/**
 * Enhanced NATS Chat Transport with Subject-Based Routing
 *
 * Extends the basic NatsChatTransport with:
 * - Subject-based routing via NatsChatRouter
 * - Request-reply pattern for synchronous operations (list models, create session)
 * - Client-side subscription helper with AsyncIterable interface
 *
 * Designed for microservice architectures where multiple services handle
 * different aspects of chat (auth, sessions, streaming).
 *
 * Subject hierarchy:
 *   chat.{userId}.send          — request-reply: send message (streams events on sub-subject)
 *   chat.{userId}.events        — pub: streaming events
 *   chat.{userId}.sessions.list — request-reply: list sessions
 *   chat.{userId}.sessions.create — request-reply: create session
 *   chat.{userId}.models        — request-reply: list models
 *
 * @example
 * ```typescript
 * import { connect } from "nats";
 * import { NatsChatRouter, NatsChatClient } from "./nats-enhanced-transport";
 *
 * const nc = await connect({ servers: "nats://localhost:4222" });
 *
 * // Server side: router handles incoming requests
 * const router = new NatsChatRouter(nc, "chat", {
 *   onSend: async (userId, sessionId, message) => {
 *     const runtime = await manager.getRuntime(userId);
 *     return runtime.send(sessionId, message);
 *   },
 *   onListSessions: async (userId) => {
 *     const runtime = await manager.getRuntime(userId);
 *     return runtime.listSessions();
 *   },
 * });
 * await router.start();
 *
 * // Client side: send messages, subscribe to events
 * const client = new NatsChatClient(nc, "chat", "user-123");
 * const events = await client.send(sessionId, "Hello!");
 * for await (const event of events) {
 *   console.log(event);
 * }
 * ```
 */

import type { IChatTransport } from "@witqq/agent-sdk/chat/backends";
import type { ChatEvent, ChatId } from "@witqq/agent-sdk/chat/core";

// ─── NATS Interfaces (zero-dependency typing) ──────────────────

/** Minimal NATS connection interface (compatible with nats, nats.ws) */
export interface NatsConnectionLike {
  publish(subject: string, data?: Uint8Array): void;
  subscribe(subject: string): NatsSubscriptionLike;
  request(subject: string, data?: Uint8Array, opts?: { timeout?: number }): Promise<NatsMessageLike>;
  isClosed(): boolean;
}

export interface NatsSubscriptionLike extends AsyncIterable<NatsMessageLike> {
  unsubscribe(): void;
}

export interface NatsMessageLike {
  data: Uint8Array;
  subject: string;
  reply?: string;
  respond(data?: Uint8Array): boolean;
}

// ─── Server: Subject-Based Router ──────────────────────────────

/** Handler callbacks for the router */
export interface NatsRouterHandlers {
  /** Handle send message request. Returns async iterable of events. */
  onSend: (userId: string, sessionId: string, message: string) => AsyncIterable<ChatEvent> | Promise<AsyncIterable<ChatEvent>>;
  /** Handle list sessions request */
  onListSessions?: (userId: string) => Promise<unknown>;
  /** Handle create session request */
  onCreateSession?: (userId: string, title?: string) => Promise<unknown>;
  /** Handle list models request */
  onListModels?: (userId: string) => Promise<unknown>;
}

/**
 * NATS router that subscribes to subject patterns and dispatches
 * to handler callbacks. Handles request-reply for synchronous ops
 * and pub/sub streaming for send.
 */
export class NatsChatRouter {
  private subscriptions: NatsSubscriptionLike[] = [];
  private running = false;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  constructor(
    private nc: NatsConnectionLike,
    private prefix: string,
    private handlers: NatsRouterHandlers,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  /** Start subscribing to all route subjects */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Subscribe to wildcard: chat.*.send, chat.*.sessions.list, etc.
    this.subscriptions.push(this.subscribeRoute("*.send", this.handleSend.bind(this)));
    if (this.handlers.onListSessions) {
      this.subscriptions.push(this.subscribeRoute("*.sessions.list", this.handleListSessions.bind(this)));
    }
    if (this.handlers.onCreateSession) {
      this.subscriptions.push(this.subscribeRoute("*.sessions.create", this.handleCreateSession.bind(this)));
    }
    if (this.handlers.onListModels) {
      this.subscriptions.push(this.subscribeRoute("*.models", this.handleListModels.bind(this)));
    }
  }

  /** Stop all subscriptions */
  stop(): void {
    this.running = false;
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions = [];
  }

  // ─── Route handlers ──────────────────────────────────────

  private async handleSend(msg: NatsMessageLike, userId: string): Promise<void> {
    const payload = JSON.parse(this.decoder.decode(msg.data)) as { sessionId: string; message: string };
    const eventsSubject = `${this.prefix}.${userId}.events`;

    // Reply with the events subject so client knows where to subscribe
    if (msg.reply) {
      msg.respond(this.encoder.encode(JSON.stringify({ eventsSubject })));
    }

    // Stream events to the events subject
    const transport = new NatsPublishTransport(this.nc, eventsSubject);
    try {
      const stream = await this.handlers.onSend(userId, payload.sessionId, payload.message);
      for await (const event of stream) {
        transport.send(event);
      }
      transport.close();
    } catch (err) {
      transport.error(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private async handleListSessions(msg: NatsMessageLike, userId: string): Promise<void> {
    try {
      const result = await this.handlers.onListSessions!(userId);
      msg.respond(this.encoder.encode(JSON.stringify({ data: result })));
    } catch (err) {
      msg.respond(this.encoder.encode(JSON.stringify({ error: (err as Error).message })));
    }
  }

  private async handleCreateSession(msg: NatsMessageLike, userId: string): Promise<void> {
    try {
      const payload = JSON.parse(this.decoder.decode(msg.data)) as { title?: string };
      const result = await this.handlers.onCreateSession!(userId, payload.title);
      msg.respond(this.encoder.encode(JSON.stringify({ data: result })));
    } catch (err) {
      msg.respond(this.encoder.encode(JSON.stringify({ error: (err as Error).message })));
    }
  }

  private async handleListModels(msg: NatsMessageLike, userId: string): Promise<void> {
    try {
      const result = await this.handlers.onListModels!(userId);
      msg.respond(this.encoder.encode(JSON.stringify({ data: result })));
    } catch (err) {
      msg.respond(this.encoder.encode(JSON.stringify({ error: (err as Error).message })));
    }
  }

  // ─── Internal ────────────────────────────────────────────

  private subscribeRoute(
    pattern: string,
    handler: (msg: NatsMessageLike, userId: string) => Promise<void>,
  ): NatsSubscriptionLike {
    const subject = `${this.prefix}.${pattern}`;
    const sub = this.nc.subscribe(subject);

    // Process messages in background
    (async () => {
      for await (const msg of sub) {
        if (!this.running) break;
        // Extract userId from subject: prefix.{userId}.action
        const parts = msg.subject.split(".");
        const prefixParts = this.prefix.split(".");
        const userId = parts[prefixParts.length];
        if (userId) {
          handler(msg, userId).catch(() => { /* silent */ });
        }
      }
    })().catch(() => { /* silent */ });

    return sub;
  }
}

// ─── Transport: Publish-only ───────────────────────────────────

/** Transport that publishes events to a NATS subject */
class NatsPublishTransport implements IChatTransport {
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
      this.nc.publish(this.subject, this.encoder.encode(JSON.stringify({ type: "done" })));
    }
  }

  error(err: Error): void {
    if (!this._open) return;
    this._open = false;
    if (!this.nc.isClosed()) {
      this.nc.publish(this.subject, this.encoder.encode(JSON.stringify({
        type: "error",
        error: { message: err.message, code: "TRANSPORT_ERROR" },
      })));
    }
  }
}

// ─── Client ────────────────────────────────────────────────────

/**
 * Client-side helper for interacting with a NatsChatRouter.
 *
 * Provides typed methods for all route subjects and an async iterable
 * interface for consuming streaming events.
 */
export class NatsChatClient {
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  constructor(
    private nc: NatsConnectionLike,
    private prefix: string,
    private userId: string,
  ) {}

  /**
   * Send a message and return an async iterable of streaming events.
   *
   * Subscribes to the events subject first, then sends the request.
   * This ensures no events are missed.
   */
  async send(sessionId: ChatId | string, message: string): Promise<AsyncIterable<ChatEvent>> {
    const eventsSubject = `${this.prefix}.${this.userId}.events`;
    const sub = this.nc.subscribe(eventsSubject);

    // Send request
    const sendSubject = `${this.prefix}.${this.userId}.send`;
    this.nc.publish(sendSubject, this.encoder.encode(JSON.stringify({ sessionId, message })));

    return this.subscriptionToIterable(sub);
  }

  /** List sessions via request-reply */
  async listSessions(timeoutMs = 5000): Promise<unknown> {
    const subject = `${this.prefix}.${this.userId}.sessions.list`;
    const reply = await this.nc.request(subject, undefined, { timeout: timeoutMs });
    return this.parseReply(reply);
  }

  /** Create a session via request-reply */
  async createSession(title?: string, timeoutMs = 5000): Promise<unknown> {
    const subject = `${this.prefix}.${this.userId}.sessions.create`;
    const reply = await this.nc.request(subject, this.encoder.encode(JSON.stringify({ title })), { timeout: timeoutMs });
    return this.parseReply(reply);
  }

  /** List models via request-reply */
  async listModels(timeoutMs = 5000): Promise<unknown> {
    const subject = `${this.prefix}.${this.userId}.models`;
    const reply = await this.nc.request(subject, undefined, { timeout: timeoutMs });
    return this.parseReply(reply);
  }

  // ─── Internal ────────────────────────────────────────────

  private parseReply(msg: NatsMessageLike): unknown {
    const parsed = JSON.parse(this.decoder.decode(msg.data)) as { data?: unknown; error?: string };
    if (parsed.error) throw new Error(parsed.error);
    return parsed.data;
  }

  private subscriptionToIterable(sub: NatsSubscriptionLike): AsyncIterable<ChatEvent> {
    const decoder = this.decoder;
    return {
      [Symbol.asyncIterator]() {
        const iter = sub[Symbol.asyncIterator]();
        return {
          async next(): Promise<IteratorResult<ChatEvent>> {
            const result = await iter.next();
            if (result.done) return { done: true, value: undefined };

            const event = JSON.parse(decoder.decode(result.value.data)) as ChatEvent;
            if (event.type === "done" || event.type === "error") {
              sub.unsubscribe();
              if (event.type === "error") {
                return { done: true, value: undefined };
              }
              return { done: true, value: undefined };
            }
            return { done: false, value: event };
          },
        };
      },
    };
  }
}
