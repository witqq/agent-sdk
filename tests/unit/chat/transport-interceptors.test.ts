/**
 * Tests for transport interceptors.
 *
 * Covers: event interception, modification, suppression, chaining,
 * error handling, close lifecycle, and compatibility with all transport types.
 */

import { describe, it, expect, vi } from "vitest";
import type { ChatEvent } from "../../../src/chat/core.js";
import type { IChatTransport } from "../../../src/chat/backends/transport.js";
import type { TransportInterceptor } from "../../../src/chat/backends/interceptors.js";
import { withInterceptors } from "../../../src/chat/backends/interceptors.js";

// ─── Mock Transport ────────────────────────────────────────────

function createMockTransport(): IChatTransport & {
  sentEvents: ChatEvent[];
  closed: boolean;
  lastError: Error | null;
} {
  const state = {
    sentEvents: [] as ChatEvent[],
    closed: false,
    lastError: null as Error | null,
    _open: true,
  };

  return {
    get sentEvents() { return state.sentEvents; },
    get closed() { return state.closed; },
    get lastError() { return state.lastError; },
    get isOpen() { return state._open; },
    send(event: ChatEvent) { state.sentEvents.push(event); },
    close() { state.closed = true; state._open = false; },
    error(err: Error) { state.lastError = err; state._open = false; },
  };
}

function makeEvent(type: string, text?: string): ChatEvent {
  if (type === "message:delta") {
    return { type: "message:delta", messageId: "m1", text: text ?? "hello" } as ChatEvent;
  }
  if (type === "message:start") {
    return { type: "message:start", messageId: "m1", role: "assistant" } as ChatEvent;
  }
  if (type === "message:complete") {
    return {
      type: "message:complete",
      messageId: "m1",
      message: { id: "m1", role: "assistant", parts: [], createdAt: "", status: "complete" },
    } as ChatEvent;
  }
  if (type === "done") {
    return { type: "done" } as ChatEvent;
  }
  return { type } as ChatEvent;
}

// ─── Tests ─────────────────────────────────────────────────────

describe("withInterceptors", () => {
  it("returns original transport when no interceptors", () => {
    const inner = createMockTransport();
    const wrapped = withInterceptors(inner, []);
    expect(wrapped).toBe(inner);
  });

  it("delegates isOpen to inner transport", () => {
    const inner = createMockTransport();
    const wrapped = withInterceptors(inner, [{}]);
    expect(wrapped.isOpen).toBe(true);
    inner.close();
    expect(wrapped.isOpen).toBe(false);
  });
});

describe("interceptor beforeSend", () => {
  it("receives all events sent through transport", () => {
    const inner = createMockTransport();
    const seen: ChatEvent[] = [];
    const interceptor: TransportInterceptor = {
      beforeSend(event) { seen.push(event); return event; },
    };

    const wrapped = withInterceptors(inner, [interceptor]);
    const e1 = makeEvent("message:start");
    const e2 = makeEvent("message:delta", "hi");
    wrapped.send(e1);
    wrapped.send(e2);

    expect(seen).toEqual([e1, e2]);
    expect(inner.sentEvents).toEqual([e1, e2]);
  });

  it("can modify events before they reach the transport", () => {
    const inner = createMockTransport();
    const interceptor: TransportInterceptor = {
      beforeSend(event) {
        if (event.type === "message:delta") {
          return { ...event, text: (event as any).text.toUpperCase() } as ChatEvent;
        }
        return event;
      },
    };

    const wrapped = withInterceptors(inner, [interceptor]);
    wrapped.send(makeEvent("message:delta", "hello"));

    expect(inner.sentEvents).toHaveLength(1);
    expect((inner.sentEvents[0] as any).text).toBe("HELLO");
  });

  it("can suppress events by returning null", () => {
    const inner = createMockTransport();
    const interceptor: TransportInterceptor = {
      beforeSend(event) {
        // Suppress done events
        if (event.type === "done") return null;
        return event;
      },
    };

    const wrapped = withInterceptors(inner, [interceptor]);
    wrapped.send(makeEvent("message:start"));
    wrapped.send(makeEvent("done"));

    expect(inner.sentEvents).toHaveLength(1);
    expect(inner.sentEvents[0].type).toBe("message:start");
  });

  it("does not send when transport is closed", () => {
    const inner = createMockTransport();
    const beforeSend = vi.fn((e: ChatEvent) => e);
    const wrapped = withInterceptors(inner, [{ beforeSend }]);

    inner.close();
    wrapped.send(makeEvent("message:delta"));

    expect(beforeSend).not.toHaveBeenCalled();
    expect(inner.sentEvents).toHaveLength(0);
  });
});

describe("interceptor afterSend", () => {
  it("receives the final event after send", () => {
    const inner = createMockTransport();
    const afterEvents: ChatEvent[] = [];
    const interceptor: TransportInterceptor = {
      beforeSend(event) {
        if (event.type === "message:delta") {
          return { ...event, text: "modified" } as ChatEvent;
        }
        return event;
      },
      afterSend(event) { afterEvents.push(event); },
    };

    const wrapped = withInterceptors(inner, [interceptor]);
    wrapped.send(makeEvent("message:delta", "original"));

    // afterSend receives the modified event
    expect(afterEvents).toHaveLength(1);
    expect((afterEvents[0] as any).text).toBe("modified");
  });

  it("is not called when event is suppressed", () => {
    const inner = createMockTransport();
    const afterSend = vi.fn();
    const wrapped = withInterceptors(inner, [{
      beforeSend: () => null,
      afterSend,
    }]);

    wrapped.send(makeEvent("message:delta"));
    expect(afterSend).not.toHaveBeenCalled();
  });
});

describe("interceptor chaining", () => {
  it("chains multiple interceptors in order", () => {
    const inner = createMockTransport();
    const order: string[] = [];

    const first: TransportInterceptor = {
      name: "first",
      beforeSend(event) { order.push("first:before"); return event; },
      afterSend() { order.push("first:after"); },
    };
    const second: TransportInterceptor = {
      name: "second",
      beforeSend(event) { order.push("second:before"); return event; },
      afterSend() { order.push("second:after"); },
    };

    const wrapped = withInterceptors(inner, [first, second]);
    wrapped.send(makeEvent("message:start"));

    expect(order).toEqual([
      "first:before", "second:before",
      "first:after", "second:after",
    ]);
  });

  it("second interceptor sees modifications from first", () => {
    const inner = createMockTransport();
    const first: TransportInterceptor = {
      beforeSend(event) {
        if (event.type === "message:delta") {
          return { ...event, text: "step1" } as ChatEvent;
        }
        return event;
      },
    };
    const second: TransportInterceptor = {
      beforeSend(event) {
        if (event.type === "message:delta") {
          return { ...event, text: (event as any).text + "+step2" } as ChatEvent;
        }
        return event;
      },
    };

    const wrapped = withInterceptors(inner, [first, second]);
    wrapped.send(makeEvent("message:delta", "original"));

    expect((inner.sentEvents[0] as any).text).toBe("step1+step2");
  });

  it("first interceptor suppression stops the chain", () => {
    const inner = createMockTransport();
    const secondBeforeSend = vi.fn((e: ChatEvent) => e);

    const wrapped = withInterceptors(inner, [
      { beforeSend: () => null },
      { beforeSend: secondBeforeSend },
    ]);

    wrapped.send(makeEvent("message:delta"));
    expect(secondBeforeSend).not.toHaveBeenCalled();
    expect(inner.sentEvents).toHaveLength(0);
  });
});

describe("interceptor close lifecycle", () => {
  it("calls beforeClose on all interceptors before closing", () => {
    const inner = createMockTransport();
    const order: string[] = [];

    const wrapped = withInterceptors(inner, [
      { beforeClose: () => order.push("a") },
      { beforeClose: () => order.push("b") },
    ]);

    wrapped.close();
    expect(order).toEqual(["a", "b"]);
    expect(inner.closed).toBe(true);
  });
});

describe("interceptor error handling", () => {
  it("calls onError on all interceptors before signaling error", () => {
    const inner = createMockTransport();
    const errors: Error[] = [];

    const wrapped = withInterceptors(inner, [
      { onError: (err) => errors.push(err) },
      { onError: (err) => errors.push(err) },
    ]);

    const err = new Error("test error");
    wrapped.error(err);

    expect(errors).toEqual([err, err]);
    expect(inner.lastError).toBe(err);
  });
});

describe("interceptor with streamToTransport", () => {
  it("intercepts events from async stream", async () => {
    const { streamToTransport } = await import("../../../src/chat/backends/transport.js");
    const inner = createMockTransport();
    const seen: string[] = [];

    const wrapped = withInterceptors(inner, [{
      beforeSend(event) {
        seen.push(event.type);
        return event;
      },
    }]);

    async function* events(): AsyncGenerator<ChatEvent> {
      yield makeEvent("message:start");
      yield makeEvent("message:delta", "hi");
      yield makeEvent("message:complete");
    }

    await streamToTransport(events(), wrapped);

    // streamToTransport sends events + done, then closes
    expect(seen).toEqual(["message:start", "message:delta", "message:complete", "done"]);
    expect(inner.closed).toBe(true);
  });
});
