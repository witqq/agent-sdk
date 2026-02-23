import { describe, it, expect, vi } from "vitest";
import { InProcessChatTransport } from "../../../src/chat/backends/in-process-transport.js";
import { streamToTransport } from "../../../src/chat/backends/transport.js";
import type { ChatEvent } from "../../../src/chat/core.js";
import type { ChatId } from "../../../src/chat/core.js";

const msgId = "550e8400-e29b-41d4-a716-446655440000" as ChatId;

// ─── Tests ─────────────────────────────────────────────────────

describe("InProcessChatTransport", () => {
  describe("basic lifecycle", () => {
    it("starts open", () => {
      const transport = new InProcessChatTransport();
      expect(transport.isOpen).toBe(true);
    });

    it("closes after close()", () => {
      const transport = new InProcessChatTransport();
      transport.close();
      expect(transport.isOpen).toBe(false);
    });

    it("closes after error()", () => {
      const transport = new InProcessChatTransport();
      transport.error(new Error("fail"));
      expect(transport.isOpen).toBe(false);
    });

    it("silently drops events after close", () => {
      const transport = new InProcessChatTransport();
      transport.close();
      transport.send({ type: "message:start", messageId: msgId, role: "assistant" });
      // No error thrown, event just dropped
      expect(transport.isOpen).toBe(false);
    });

    it("is safe to close twice", () => {
      const transport = new InProcessChatTransport();
      transport.close();
      transport.close();
      expect(transport.isOpen).toBe(false);
    });
  });

  describe("producer-first (buffered)", () => {
    it("buffers events before consumer reads", async () => {
      const transport = new InProcessChatTransport();

      const event1: ChatEvent = { type: "message:start", messageId: msgId, role: "assistant" };
      const event2: ChatEvent = { type: "message:delta", messageId: msgId, text: "hello" };

      transport.send(event1);
      transport.send(event2);
      transport.close();

      const received: ChatEvent[] = [];
      for await (const event of transport) {
        received.push(event);
      }

      expect(received).toEqual([event1, event2]);
    });

    it("delivers all buffered events then completes", async () => {
      const transport = new InProcessChatTransport();

      for (let i = 0; i < 100; i++) {
        transport.send({ type: "message:delta", messageId: msgId, text: `chunk-${i}` });
      }
      transport.close();

      const received: ChatEvent[] = [];
      for await (const event of transport) {
        received.push(event);
      }

      expect(received).toHaveLength(100);
    });
  });

  describe("consumer-first (waiting)", () => {
    it("consumer waits until producer sends", async () => {
      const transport = new InProcessChatTransport();

      const collected: ChatEvent[] = [];
      const done = (async () => {
        for await (const event of transport) {
          collected.push(event);
        }
      })();

      // Let consumer start waiting
      await new Promise(r => setTimeout(r, 10));

      transport.send({ type: "message:start", messageId: msgId, role: "assistant" });
      transport.send({ type: "message:delta", messageId: msgId, text: "hi" });
      transport.close();

      await done;
      expect(collected).toHaveLength(2);
      expect(collected[0].type).toBe("message:start");
      expect(collected[1].type).toBe("message:delta");
    });

    it("consumer completes when close() called while waiting", async () => {
      const transport = new InProcessChatTransport();

      const done = (async () => {
        const events: ChatEvent[] = [];
        for await (const event of transport) {
          events.push(event);
        }
        return events;
      })();

      await new Promise(r => setTimeout(r, 10));
      transport.close();

      const events = await done;
      expect(events).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("delivers error event to consumer", async () => {
      const transport = new InProcessChatTransport();

      transport.send({ type: "message:start", messageId: msgId, role: "assistant" });
      transport.error(new Error("stream failed"));

      const events: ChatEvent[] = [];
      for await (const event of transport) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("message:start");
      expect(events[1].type).toBe("error");
      if (events[1].type === "error") {
        expect(events[1].error).toBe("stream failed");
      }
    });

    it("delivers error to waiting consumer", async () => {
      const transport = new InProcessChatTransport();

      const done = (async () => {
        const events: ChatEvent[] = [];
        for await (const event of transport) {
          events.push(event);
        }
        return events;
      })();

      await new Promise(r => setTimeout(r, 10));
      transport.error(new Error("connection lost"));

      const events = await done;
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("error");
    });
  });

  describe("integration with streamToTransport", () => {
    it("pipes async iterable through transport to consumer", async () => {
      const transport = new InProcessChatTransport();

      // Consumer
      const received: ChatEvent[] = [];
      const consumerDone = (async () => {
        for await (const event of transport) {
          received.push(event);
        }
      })();

      // Producer: simulate an async event source
      async function* generateEvents(): AsyncIterable<ChatEvent> {
        yield { type: "message:start", messageId: msgId, role: "assistant" };
        yield { type: "message:delta", messageId: msgId, text: "Hello " };
        yield { type: "message:delta", messageId: msgId, text: "world" };
        yield { type: "message:complete", messageId: msgId, message: {} as any };
      }

      await streamToTransport(generateEvents(), transport);
      await consumerDone;

      // streamToTransport sends all events + done event, then closes
      const types = received.map(e => e.type);
      expect(types).toContain("message:start");
      expect(types).toContain("message:delta");
      expect(types).toContain("message:complete");
      expect(types).toContain("done");
    });

    it("streamToTransport error is delivered to consumer", async () => {
      const transport = new InProcessChatTransport();

      const received: ChatEvent[] = [];
      const consumerDone = (async () => {
        for await (const event of transport) {
          received.push(event);
        }
      })();

      async function* failingEvents(): AsyncIterable<ChatEvent> {
        yield { type: "message:start", messageId: msgId, role: "assistant" };
        throw new Error("source failed");
      }

      await streamToTransport(failingEvents(), transport);
      await consumerDone;

      const types = received.map(e => e.type);
      expect(types).toContain("message:start");
      expect(types).toContain("error");
    });
  });

  describe("backpressure", () => {
    it("handles rapid send without consumer", () => {
      const transport = new InProcessChatTransport();

      // Rapid-fire 10000 events without consumer
      for (let i = 0; i < 10000; i++) {
        transport.send({ type: "message:delta", messageId: msgId, text: `${i}` });
      }
      transport.close();

      // No errors thrown — all buffered
      expect(transport.isOpen).toBe(false);
    });

    it("all rapid events are retrievable by consumer", async () => {
      const transport = new InProcessChatTransport();

      const count = 1000;
      for (let i = 0; i < count; i++) {
        transport.send({ type: "message:delta", messageId: msgId, text: `${i}` });
      }
      transport.close();

      const events: ChatEvent[] = [];
      for await (const event of transport) {
        events.push(event);
      }
      expect(events).toHaveLength(count);
    });
  });
});
