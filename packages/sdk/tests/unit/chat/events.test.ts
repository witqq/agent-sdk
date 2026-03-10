import { describe, it, expect, vi } from "vitest";
import {
  TypedEventEmitter,
  ChatEventBus,
  eventFilter,
  filterEvents,
  mapEvents,
  collectText,
  type EventMiddleware,
  type ChatEventMap,
} from "../../../src/chat/events.js";
import type { ChatEvent, ChatId } from "../../../src/chat/core.js";

// ─── Helpers ──────────────────────────────────────────────────

const id = "test-id" as ChatId;

function makeDeltaEvent(text: string): ChatEvent {
  return { type: "message:delta", messageId: id, text };
}

function makeStartEvent(): ChatEvent {
  return { type: "message:start", messageId: id, role: "assistant" };
}

function makeHeartbeatEvent(): ChatEvent {
  return { type: "heartbeat" };
}

async function* asyncFrom<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of source) {
    result.push(item);
  }
  return result;
}

// ─── TypedEventEmitter ────────────────────────────────────────

describe("TypedEventEmitter", () => {
  type TestEvents = {
    message: string;
    count: number;
    done: void;
  };

  it("calls listener on emit", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.on("message", fn);
    emitter.emit("message", "hello");
    expect(fn).toHaveBeenCalledWith("hello");
  });

  it("supports multiple listeners for same event", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on("message", fn1);
    emitter.on("message", fn2);
    emitter.emit("message", "hi");
    expect(fn1).toHaveBeenCalledWith("hi");
    expect(fn2).toHaveBeenCalledWith("hi");
  });

  it("does not call listeners for different events", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.on("count", fn);
    emitter.emit("message", "hello");
    expect(fn).not.toHaveBeenCalled();
  });

  it("unsubscribe removes listener", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn = vi.fn();
    const unsub = emitter.on("message", fn);
    unsub();
    emitter.emit("message", "hello");
    expect(fn).not.toHaveBeenCalled();
  });

  it("off removes specific listener", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on("message", fn1);
    emitter.on("message", fn2);
    emitter.off("message", fn1);
    emitter.emit("message", "hello");
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledWith("hello");
  });

  it("off is safe for non-existent listener", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    expect(() => emitter.off("message", vi.fn())).not.toThrow();
  });

  it("off is safe for non-existent event", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    expect(() => emitter.off("count", vi.fn())).not.toThrow();
  });

  it("once fires listener only once", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.once("message", fn);
    emitter.emit("message", "first");
    emitter.emit("message", "second");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("first");
  });

  it("once unsubscribe works before fire", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn = vi.fn();
    const unsub = emitter.once("message", fn);
    unsub();
    emitter.emit("message", "hello");
    expect(fn).not.toHaveBeenCalled();
  });

  it("removeAllListeners for specific event", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on("message", fn1);
    emitter.on("count", fn2);
    emitter.removeAllListeners("message");
    emitter.emit("message", "hello");
    emitter.emit("count", 42);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledWith(42);
  });

  it("removeAllListeners with no argument removes all", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on("message", fn1);
    emitter.on("count", fn2);
    emitter.removeAllListeners();
    emitter.emit("message", "hello");
    emitter.emit("count", 42);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it("listenerCount returns correct count", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    expect(emitter.listenerCount("message")).toBe(0);
    const unsub = emitter.on("message", vi.fn());
    expect(emitter.listenerCount("message")).toBe(1);
    emitter.on("message", vi.fn());
    expect(emitter.listenerCount("message")).toBe(2);
    unsub();
    expect(emitter.listenerCount("message")).toBe(1);
  });

  it("eventNames returns events with listeners", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    expect(emitter.eventNames()).toEqual([]);
    emitter.on("message", vi.fn());
    emitter.on("count", vi.fn());
    expect(emitter.eventNames()).toEqual(
      expect.arrayContaining(["message", "count"]),
    );
  });

  it("emit with no listeners does not throw", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    expect(() => emitter.emit("message", "hello")).not.toThrow();
  });

  it("void event type works", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn = vi.fn();
    emitter.on("done", fn);
    emitter.emit("done", undefined as unknown as void);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("listener added during emit does not fire for current emit", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const late = vi.fn();
    emitter.on("message", () => {
      emitter.on("message", late);
    });
    emitter.emit("message", "trigger");
    // The listener was added during iteration of the spread copy,
    // so it should not fire for the current emit
    expect(late).not.toHaveBeenCalled();
    // But fires on next emit
    emitter.emit("message", "next");
    expect(late).toHaveBeenCalledWith("next");
  });

  it("listener removed during emit still fires for current emit", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const fn2 = vi.fn();
    emitter.on("message", () => {
      emitter.off("message", fn2);
    });
    emitter.on("message", fn2);
    emitter.emit("message", "test");
    // fn2 is in the spread copy, so it fires even though removed mid-emit
    expect(fn2).toHaveBeenCalledWith("test");
  });
});

// ─── ChatEventBus ─────────────────────────────────────────────

describe("ChatEventBus", () => {
  it("emits ChatEvent to typed listeners", () => {
    const bus = new ChatEventBus();
    const fn = vi.fn();
    bus.on("message:delta", fn);
    const event = makeDeltaEvent("hello");
    bus.emit("message:delta", event as ChatEventMap["message:delta"]);
    expect(fn).toHaveBeenCalledWith(event);
  });

  it("runs middleware in registration order", () => {
    const bus = new ChatEventBus();
    const order: number[] = [];
    bus.use((ctx) => {
      order.push(1);
      ctx.next();
    });
    bus.use((ctx) => {
      order.push(2);
      ctx.next();
    });
    bus.use((ctx) => {
      order.push(3);
      ctx.next();
    });
    bus.on("heartbeat", vi.fn());
    bus.emit("heartbeat", makeHeartbeatEvent() as ChatEventMap["heartbeat"]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("middleware can suppress events", () => {
    const bus = new ChatEventBus();
    const fn = vi.fn();
    bus.use((ctx) => {
      if (ctx.event.type === "heartbeat") {
        ctx.suppress();
      } else {
        ctx.next();
      }
    });
    bus.on("heartbeat", fn);
    bus.emit("heartbeat", makeHeartbeatEvent() as ChatEventMap["heartbeat"]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("middleware suppression stops subsequent middleware", () => {
    const bus = new ChatEventBus();
    const secondMw = vi.fn();
    bus.use((ctx) => {
      ctx.suppress();
    });
    bus.use((ctx) => {
      secondMw();
      ctx.next();
    });
    bus.on("heartbeat", vi.fn());
    bus.emit("heartbeat", makeHeartbeatEvent() as ChatEventMap["heartbeat"]);
    expect(secondMw).not.toHaveBeenCalled();
  });

  it("middleware can transform events", () => {
    const bus = new ChatEventBus();
    const fn = vi.fn();
    bus.use((ctx) => {
      if (ctx.event.type === "message:delta") {
        ctx.event = {
          ...ctx.event,
          text: (ctx.event as Extract<ChatEvent, { type: "message:delta" }>)
            .text + "!",
        } as ChatEvent;
      }
      ctx.next();
    });
    bus.on("message:delta", fn);
    bus.emit("message:delta", makeDeltaEvent("hi") as ChatEventMap["message:delta"]);
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ type: "message:delta", text: "hi!" }),
    );
  });

  it("without middleware, events reach listeners directly", () => {
    const bus = new ChatEventBus();
    const fn = vi.fn();
    bus.on("message:start", fn);
    bus.emit("message:start", makeStartEvent() as ChatEventMap["message:start"]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("use() returns unsubscribe that removes middleware", () => {
    const bus = new ChatEventBus();
    const fn = vi.fn();
    const mwFn = vi.fn((ctx: { next: () => void }) => ctx.next());
    const unsub = bus.use(mwFn as unknown as EventMiddleware);
    bus.on("heartbeat", fn);
    bus.emit("heartbeat", makeHeartbeatEvent() as ChatEventMap["heartbeat"]);
    expect(mwFn).toHaveBeenCalledTimes(1);

    unsub();
    bus.emit("heartbeat", makeHeartbeatEvent() as ChatEventMap["heartbeat"]);
    // After unsub, middleware should not be called again
    expect(mwFn).toHaveBeenCalledTimes(1);
  });

  it("clearMiddleware removes all middleware", () => {
    const bus = new ChatEventBus();
    bus.use((ctx) => ctx.suppress());
    bus.clearMiddleware();
    expect(bus.middlewareCount()).toBe(0);

    const fn = vi.fn();
    bus.on("heartbeat", fn);
    bus.emit("heartbeat", makeHeartbeatEvent() as ChatEventMap["heartbeat"]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("middlewareCount returns correct count", () => {
    const bus = new ChatEventBus();
    expect(bus.middlewareCount()).toBe(0);
    const unsub = bus.use((ctx) => ctx.next());
    expect(bus.middlewareCount()).toBe(1);
    bus.use((ctx) => ctx.next());
    expect(bus.middlewareCount()).toBe(2);
    unsub();
    expect(bus.middlewareCount()).toBe(1);
  });

  it("middleware without calling next or suppress does not deliver", () => {
    const bus = new ChatEventBus();
    const fn = vi.fn();
    bus.use((_ctx) => {
      // intentionally do nothing
    });
    bus.on("heartbeat", fn);
    bus.emit("heartbeat", makeHeartbeatEvent() as ChatEventMap["heartbeat"]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("handles all ChatEvent types", () => {
    const bus = new ChatEventBus();
    const events: ChatEvent[] = [
      { type: "message:start", messageId: id, role: "assistant" },
      { type: "message:delta", messageId: id, text: "x" },
      {
        type: "message:complete",
        messageId: id,
        message: {
          id,
          role: "assistant",
          content: "x",
          createdAt: new Date(),
        },
      },
      {
        type: "tool:start",
        messageId: id,
        toolCallId: "tc1",
        toolName: "search",
        args: {},
      },
      {
        type: "tool:complete",
        messageId: id,
        toolCallId: "tc1",
        toolName: "search",
        result: "ok",
      },
      { type: "thinking:start", messageId: id },
      { type: "thinking:delta", messageId: id, text: "hmm" },
      { type: "thinking:end", messageId: id },
      {
        type: "permission:request",
        messageId: id,
        toolName: "fs",
        toolArgs: {},
      },
      {
        type: "permission:response",
        messageId: id,
        toolName: "fs",
        allowed: true,
      },
      {
        type: "usage",
        promptTokens: 10,
        completionTokens: 5,
      },
      { type: "session:created", sessionId: id },
      { type: "session:updated", sessionId: id },
      { type: "error", error: "fail", recoverable: true },
      { type: "typing:start" },
      { type: "typing:end" },
      { type: "heartbeat" },
    ];

    const received: ChatEvent[] = [];
    for (const event of events) {
      bus.on(event.type, (e) => received.push(e));
    }

    for (const event of events) {
      bus.emit(
        event.type,
        event as ChatEventMap[typeof event.type],
      );
    }

    expect(received).toHaveLength(events.length);
    expect(received.map((e) => e.type)).toEqual(events.map((e) => e.type));
  });
});

// ─── eventFilter ──────────────────────────────────────────────

describe("eventFilter", () => {
  it("returns true for matching event types", () => {
    const filter = eventFilter("message:delta", "message:complete");
    expect(filter(makeDeltaEvent("hi"))).toBe(true);
  });

  it("returns false for non-matching event types", () => {
    const filter = eventFilter("message:delta");
    expect(filter(makeHeartbeatEvent())).toBe(false);
  });

  it("works with single type", () => {
    const filter = eventFilter("heartbeat");
    expect(filter(makeHeartbeatEvent())).toBe(true);
    expect(filter(makeDeltaEvent("hi"))).toBe(false);
  });
});

// ─── filterEvents ─────────────────────────────────────────────

describe("filterEvents", () => {
  it("filters async iterable to specified types", async () => {
    const events: ChatEvent[] = [
      makeStartEvent(),
      makeDeltaEvent("hi"),
      makeHeartbeatEvent(),
      makeDeltaEvent("there"),
    ];
    const filtered = await collect(
      filterEvents(asyncFrom(events), "message:delta"),
    );
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.type === "message:delta")).toBe(true);
  });

  it("returns empty for no matches", async () => {
    const events: ChatEvent[] = [makeHeartbeatEvent()];
    const filtered = await collect(
      filterEvents(asyncFrom(events), "message:delta"),
    );
    expect(filtered).toHaveLength(0);
  });

  it("passes all when types match all", async () => {
    const events: ChatEvent[] = [
      makeDeltaEvent("a"),
      makeDeltaEvent("b"),
    ];
    const filtered = await collect(
      filterEvents(asyncFrom(events), "message:delta"),
    );
    expect(filtered).toHaveLength(2);
  });
});

describe("mapEvents", () => {
  it("transforms events and skips null results", async () => {
    const events: ChatEvent[] = [
      makeStartEvent(),
      makeDeltaEvent("hello"),
      makeHeartbeatEvent(),
      makeDeltaEvent("world"),
    ];
    const texts = await collect(
      mapEvents(asyncFrom(events), (e) =>
        e.type === "message:delta" ? e.text : null,
      ),
    );
    expect(texts).toEqual(["hello", "world"]);
  });

  it("returns empty when all transform to null", async () => {
    const events: ChatEvent[] = [makeHeartbeatEvent()];
    const result = await collect(
      mapEvents(asyncFrom(events), () => null),
    );
    expect(result).toHaveLength(0);
  });
});

// ─── collectText ──────────────────────────────────────────────

describe("collectText", () => {
  it("collects text from message:delta events", async () => {
    const events: ChatEvent[] = [
      makeStartEvent(),
      makeDeltaEvent("Hello"),
      makeDeltaEvent(", "),
      makeDeltaEvent("world!"),
      makeHeartbeatEvent(),
    ];
    const text = await collectText(asyncFrom(events));
    expect(text).toBe("Hello, world!");
  });

  it("returns empty string when no message:delta events", async () => {
    const events: ChatEvent[] = [
      makeStartEvent(),
      makeHeartbeatEvent(),
    ];
    const text = await collectText(asyncFrom(events));
    expect(text).toBe("");
  });

  it("returns empty string for empty stream", async () => {
    const text = await collectText(asyncFrom([]));
    expect(text).toBe("");
  });
});
