/**
 * Tests for enhanced NATS transport with subject-based routing.
 *
 * Uses mock NATS connection to verify message routing patterns,
 * request-reply flows, and client-side event consumption.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ChatEvent } from "../../../src/chat/core.js";
import {
  NatsChatRouter,
  NatsChatClient,
  type NatsConnectionLike,
  type NatsSubscriptionLike,
  type NatsMessageLike,
} from "../../../examples/custom-transport/nats-enhanced-transport.js";

// ─── Mock NATS ─────────────────────────────────────────────────

type MessageHandler = (msg: NatsMessageLike) => void;

function createMockNats(): NatsConnectionLike & {
  published: Array<{ subject: string; data: string }>;
  subscriptions: Map<string, MessageHandler>;
  deliver: (subject: string, msg: NatsMessageLike) => void;
} {
  const published: Array<{ subject: string; data: string }> = [];
  const subscriptions = new Map<string, MessageHandler>();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const nc: NatsConnectionLike & {
    published: Array<{ subject: string; data: string }>;
    subscriptions: Map<string, MessageHandler>;
    deliver: (subject: string, msg: NatsMessageLike) => void;
  } = {
    published,
    subscriptions,
    isClosed: () => false,

    publish(subject: string, data?: Uint8Array): void {
      published.push({ subject, data: data ? decoder.decode(data) : "" });
    },

    subscribe(subject: string): NatsSubscriptionLike {
      let handler: MessageHandler | null = null;
      let unsubscribed = false;
      const pending: NatsMessageLike[] = [];
      let resolver: ((value: IteratorResult<NatsMessageLike>) => void) | null = null;

      subscriptions.set(subject, (msg: NatsMessageLike) => {
        if (unsubscribed) return;
        if (resolver) {
          const r = resolver;
          resolver = null;
          r({ done: false, value: msg });
        } else {
          pending.push(msg);
        }
      });

      return {
        unsubscribe() {
          unsubscribed = true;
          subscriptions.delete(subject);
          if (resolver) {
            const r = resolver;
            resolver = null;
            r({ done: true, value: undefined as unknown as NatsMessageLike });
          }
        },
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<NatsMessageLike>> {
              if (pending.length > 0) {
                return Promise.resolve({ done: false, value: pending.shift()! });
              }
              if (unsubscribed) {
                return Promise.resolve({ done: true, value: undefined as unknown as NatsMessageLike });
              }
              return new Promise((resolve) => { resolver = resolve; });
            },
          };
        },
      };
    },

    async request(subject: string, data?: Uint8Array, opts?: { timeout?: number }): Promise<NatsMessageLike> {
      // Simulate request-reply via subscription handlers
      const replySubject = `_INBOX.${Date.now()}`;
      let replyData: Uint8Array | undefined;

      const msg: NatsMessageLike = {
        subject,
        data: data ?? new Uint8Array(),
        reply: replySubject,
        respond(d?: Uint8Array): boolean {
          replyData = d;
          return true;
        },
      };

      // Find matching subscription (support wildcards)
      for (const [pattern, handler] of subscriptions) {
        if (matchSubject(pattern, subject)) {
          handler(msg);
          // Allow async handler to complete
          await new Promise((r) => setTimeout(r, 10));
          break;
        }
      }

      if (replyData) {
        return { subject: replySubject, data: replyData, respond: () => true };
      }
      throw new Error("No reply received");
    },

    deliver(subject: string, msg: NatsMessageLike): void {
      for (const [pattern, handler] of subscriptions) {
        if (matchSubject(pattern, subject)) {
          handler(msg);
        }
      }
    },
  };

  return nc;
}

/** Simple NATS wildcard matching (supports * for single token) */
function matchSubject(pattern: string, subject: string): boolean {
  const patternParts = pattern.split(".");
  const subjectParts = subject.split(".");
  if (patternParts.length !== subjectParts.length) return false;
  return patternParts.every((p, i) => p === "*" || p === subjectParts[i]);
}

function makeMsg(subject: string, data: unknown): NatsMessageLike {
  const encoder = new TextEncoder();
  let replyData: Uint8Array | undefined;
  return {
    subject,
    data: encoder.encode(JSON.stringify(data)),
    respond(d?: Uint8Array): boolean {
      replyData = d;
      return true;
    },
  };
}

// ─── NatsChatRouter Tests ──────────────────────────────────────

describe("NatsChatRouter", () => {
  let nc: ReturnType<typeof createMockNats>;
  let router: NatsChatRouter;

  afterEach(() => {
    router?.stop();
  });

  it("should start and subscribe to route subjects", async () => {
    nc = createMockNats();
    router = new NatsChatRouter(nc, "chat", {
      onSend: vi.fn(async function* () {}),
      onListSessions: vi.fn(async () => []),
      onListModels: vi.fn(async () => []),
    });

    await router.start();
    expect(router.isRunning).toBe(true);
    // Should have subscriptions for *.send, *.sessions.list, *.models
    expect(nc.subscriptions.size).toBe(3);
    expect(nc.subscriptions.has("chat.*.send")).toBe(true);
    expect(nc.subscriptions.has("chat.*.sessions.list")).toBe(true);
    expect(nc.subscriptions.has("chat.*.models")).toBe(true);
  });

  it("should stop and unsubscribe", async () => {
    nc = createMockNats();
    router = new NatsChatRouter(nc, "chat", {
      onSend: vi.fn(async function* () {}),
    });

    await router.start();
    router.stop();
    expect(router.isRunning).toBe(false);
  });

  it("should handle send and stream events to subject", async () => {
    nc = createMockNats();
    const events: ChatEvent[] = [
      { type: "message:start" } as ChatEvent,
      { type: "message:delta", text: "hello" } as ChatEvent,
      { type: "message:complete" } as ChatEvent,
    ];

    router = new NatsChatRouter(nc, "chat", {
      onSend: vi.fn(async function* () {
        for (const e of events) yield e;
      }),
    });

    await router.start();

    // Simulate send request
    const msg = makeMsg("chat.user-1.send", { sessionId: "s1", message: "hi" });
    nc.deliver("chat.user-1.send", msg);

    // Allow async processing
    await new Promise((r) => setTimeout(r, 50));

    // Check events were published to events subject
    const eventMessages = nc.published.filter((p) => p.subject === "chat.user-1.events");
    expect(eventMessages.length).toBeGreaterThanOrEqual(3);
    // Last message should be done (close)
    const lastMsg = JSON.parse(eventMessages[eventMessages.length - 1].data);
    expect(lastMsg.type).toBe("done");
  });

  it("should handle request-reply for listSessions", async () => {
    nc = createMockNats();
    const sessions = [{ id: "s1", title: "Test" }];

    router = new NatsChatRouter(nc, "chat", {
      onSend: vi.fn(async function* () {}),
      onListSessions: vi.fn(async () => sessions),
    });

    await router.start();

    const result = await nc.request("chat.user-1.sessions.list");
    const parsed = JSON.parse(new TextDecoder().decode(result.data));
    expect(parsed.data).toEqual(sessions);
  });

  it("should handle request-reply error", async () => {
    nc = createMockNats();

    router = new NatsChatRouter(nc, "chat", {
      onSend: vi.fn(async function* () {}),
      onListSessions: vi.fn(async () => { throw new Error("DB error"); }),
    });

    await router.start();

    const result = await nc.request("chat.user-1.sessions.list");
    const parsed = JSON.parse(new TextDecoder().decode(result.data));
    expect(parsed.error).toBe("DB error");
  });

  it("should extract userId from subject correctly", async () => {
    nc = createMockNats();
    let capturedUserId = "";

    router = new NatsChatRouter(nc, "chat", {
      onSend: vi.fn(async function* (_userId: string) {
        capturedUserId = _userId;
      }),
    });

    await router.start();

    const msg = makeMsg("chat.user-42.send", { sessionId: "s1", message: "hi" });
    nc.deliver("chat.user-42.send", msg);
    await new Promise((r) => setTimeout(r, 50));

    expect(capturedUserId).toBe("user-42");
  });
});

// ─── NatsChatClient Tests ──────────────────────────────────────

describe("NatsChatClient", () => {
  it("should send message and receive events", async () => {
    const nc = createMockNats();

    // Setup: simulate server behavior
    nc.subscriptions.set = new Proxy(nc.subscriptions.set.bind(nc.subscriptions), {
      apply(target, thisArg, args) {
        return Reflect.apply(target, thisArg, args);
      },
    });

    const client = new NatsChatClient(nc, "chat", "user-1");

    // Start client send (subscribes to events)
    const iterablePromise = client.send("session-1", "Hello");

    // Wait for subscription to be set up
    await new Promise((r) => setTimeout(r, 10));

    // Simulate server publishing events
    const encoder = new TextEncoder();
    const eventsHandler = nc.subscriptions.get("chat.user-1.events");
    if (eventsHandler) {
      eventsHandler({
        subject: "chat.user-1.events",
        data: encoder.encode(JSON.stringify({ type: "message:delta", text: "Hi" })),
        respond: () => true,
      });
      eventsHandler({
        subject: "chat.user-1.events",
        data: encoder.encode(JSON.stringify({ type: "done" })),
        respond: () => true,
      });
    }

    const iterable = await iterablePromise;
    const collected: ChatEvent[] = [];
    for await (const event of iterable) {
      collected.push(event);
    }

    expect(collected).toHaveLength(1);
    expect((collected[0] as { type: string; text: string }).text).toBe("Hi");
  });

  it("should publish to correct send subject", async () => {
    const nc = createMockNats();
    const client = new NatsChatClient(nc, "chat", "user-5");

    // Subscribe to events to prevent hanging
    setTimeout(() => {
      const handler = nc.subscriptions.get("chat.user-5.events");
      if (handler) {
        handler({
          subject: "chat.user-5.events",
          data: new TextEncoder().encode(JSON.stringify({ type: "done" })),
          respond: () => true,
        });
      }
    }, 10);

    await client.send("s1", "test");

    const sendMsg = nc.published.find((p) => p.subject === "chat.user-5.send");
    expect(sendMsg).toBeDefined();
    const parsed = JSON.parse(sendMsg!.data);
    expect(parsed.sessionId).toBe("s1");
    expect(parsed.message).toBe("test");
  });

  it("should handle request-reply for listSessions", async () => {
    const nc = createMockNats();
    const sessions = [{ id: "s1" }];

    // Setup handler
    const router = new NatsChatRouter(nc, "chat", {
      onSend: vi.fn(async function* () {}),
      onListSessions: vi.fn(async () => sessions),
    });
    await router.start();

    const client = new NatsChatClient(nc, "chat", "user-1");
    const result = await client.listSessions();
    expect(result).toEqual(sessions);

    router.stop();
  });

  it("should throw on request-reply error", async () => {
    const nc = createMockNats();

    const router = new NatsChatRouter(nc, "chat", {
      onSend: vi.fn(async function* () {}),
      onListModels: vi.fn(async () => { throw new Error("not available"); }),
    });
    await router.start();

    const client = new NatsChatClient(nc, "chat", "user-1");
    await expect(client.listModels()).rejects.toThrow("not available");

    router.stop();
  });
});
