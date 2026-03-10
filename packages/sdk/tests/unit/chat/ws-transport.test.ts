import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WsChatTransport, WS_READY_STATE } from "../../../src/chat/backends/ws-transport.js";
import type { WebSocketLike } from "../../../src/chat/backends/ws-transport.js";
import type { ChatEvent } from "../../../src/chat/core.js";

// ─── Mock WebSocket ────────────────────────────────────────────

function mockWs(readyState = WS_READY_STATE.OPEN): WebSocketLike & {
  _sent: string[];
  _closeCode?: number;
  _closeReason?: string;
  _triggerClose: () => void;
  _triggerError: (err: unknown) => void;
} {
  const closeListeners: (() => void)[] = [];
  const errorListeners: ((err: unknown) => void)[] = [];
  const sent: string[] = [];
  let state = readyState;

  return {
    get readyState() { return state; },
    _sent: sent,
    _closeCode: undefined,
    _closeReason: undefined,
    send(data: string) { sent.push(data); },
    close(code?: number, reason?: string) {
      (this as any)._closeCode = code;
      (this as any)._closeReason = reason;
      state = WS_READY_STATE.CLOSED;
    },
    addEventListener(type: string, listener: any) {
      if (type === "close") closeListeners.push(listener);
      if (type === "error") errorListeners.push(listener);
    },
    _triggerClose() {
      state = WS_READY_STATE.CLOSED;
      for (const l of closeListeners) l();
    },
    _triggerError(err: unknown) {
      for (const l of errorListeners) l(err);
    },
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe("WsChatTransport", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe("construction", () => {
    it("is open when WebSocket readyState is OPEN", () => {
      const ws = mockWs(WS_READY_STATE.OPEN);
      const transport = new WsChatTransport(ws);
      expect(transport.isOpen).toBe(true);
    });

    it("is not open when WebSocket is CONNECTING", () => {
      const ws = mockWs(WS_READY_STATE.CONNECTING);
      const transport = new WsChatTransport(ws);
      expect(transport.isOpen).toBe(false);
    });

    it("is not open when WebSocket is CLOSED", () => {
      const ws = mockWs(WS_READY_STATE.CLOSED);
      const transport = new WsChatTransport(ws);
      expect(transport.isOpen).toBe(false);
    });
  });

  describe("send", () => {
    it("sends events as JSON strings", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws);
      const event: ChatEvent = { type: "message:start" } as any;
      transport.send(event);
      expect(ws._sent).toHaveLength(1);
      expect(JSON.parse(ws._sent[0])).toEqual(event);
    });

    it("silently drops events when not open", () => {
      const ws = mockWs(WS_READY_STATE.CLOSED);
      const transport = new WsChatTransport(ws);
      transport.send({ type: "message:start" } as any);
      expect(ws._sent).toHaveLength(0);
    });

    it("supports custom serializer", () => {
      const ws = mockWs();
      const serialize = vi.fn(() => "custom-data");
      const transport = new WsChatTransport(ws, { serialize });
      const event: ChatEvent = { type: "message:start" } as any;
      transport.send(event);
      expect(serialize).toHaveBeenCalledWith(event);
      expect(ws._sent[0]).toBe("custom-data");
    });
  });

  describe("close", () => {
    it("sends done signal and closes WebSocket", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws);
      transport.close();
      expect(ws._sent).toContainEqual(JSON.stringify({ type: "done" }));
      expect(ws._closeCode).toBe(1000);
      expect(ws._closeReason).toBe("stream complete");
    });

    it("marks transport as not open after close", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws);
      transport.close();
      expect(transport.isOpen).toBe(false);
    });

    it("is safe to call close twice", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws);
      transport.close();
      transport.close();
      // Only one done signal sent
      const doneMessages = ws._sent.filter(s => JSON.parse(s).type === "done");
      expect(doneMessages).toHaveLength(1);
    });

    it("does not send after close", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws);
      transport.close();
      transport.send({ type: "message:start" } as any);
      // Only the done signal, no message:start
      expect(ws._sent).toHaveLength(1);
    });
  });

  describe("error", () => {
    it("sends error event and closes with 1011", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws);
      transport.error(new Error("test error"));

      expect(ws._sent).toHaveLength(1);
      const parsed = JSON.parse(ws._sent[0]);
      expect(parsed.type).toBe("error");
      expect(parsed.error).toBe("test error");
      expect(parsed.recoverable).toBe(false);
      expect(ws._closeCode).toBe(1011);
    });

    it("marks transport as not open after error", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws);
      transport.error(new Error("fail"));
      expect(transport.isOpen).toBe(false);
    });

    it("is safe to call error when already closed", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws);
      transport.close();
      transport.error(new Error("late error"));
      // No error sent (already closed)
      expect(ws._sent).toHaveLength(1);
    });
  });

  describe("remote close detection", () => {
    it("marks transport as closed when WebSocket fires close event", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws);
      expect(transport.isOpen).toBe(true);
      ws._triggerClose();
      expect(transport.isOpen).toBe(false);
    });

    it("marks transport as closed when WebSocket fires error event", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws);
      ws._triggerError(new Error("connection lost"));
      expect(transport.isOpen).toBe(false);
    });
  });

  describe("heartbeat", () => {
    it("sends periodic heartbeat messages", () => {
      const ws = mockWs();
      new WsChatTransport(ws, { heartbeatMs: 5000 });
      vi.advanceTimersByTime(5000);
      expect(ws._sent).toHaveLength(1);
      expect(JSON.parse(ws._sent[0])).toEqual({ type: "heartbeat" });
      vi.advanceTimersByTime(5000);
      expect(ws._sent).toHaveLength(2);
    });

    it("stops heartbeat on close", () => {
      const ws = mockWs();
      const transport = new WsChatTransport(ws, { heartbeatMs: 5000 });
      transport.close();
      vi.advanceTimersByTime(15000);
      // Only done signal, no heartbeats after close
      expect(ws._sent).toHaveLength(1);
    });

    it("stops heartbeat when WebSocket closes remotely", () => {
      const ws = mockWs();
      new WsChatTransport(ws, { heartbeatMs: 5000 });
      ws._triggerClose();
      vi.advanceTimersByTime(15000);
      // No heartbeats sent
      expect(ws._sent).toHaveLength(0);
    });

    it("does not start heartbeat with 0 interval", () => {
      const ws = mockWs();
      new WsChatTransport(ws, { heartbeatMs: 0 });
      vi.advanceTimersByTime(30000);
      expect(ws._sent).toHaveLength(0);
    });
  });
});
