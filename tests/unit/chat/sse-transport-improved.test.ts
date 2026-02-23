import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SSEChatTransport, streamToTransport } from "../../../src/chat/backends/transport.js";
import type { WritableResponse, CloseDetectable, SSETransportOptions } from "../../../src/chat/backends/transport.js";
import type { ChatEvent } from "../../../src/chat/core.js";

// ─── Mock Helpers ──────────────────────────────────────────────

function mockRes(): WritableResponse & { _chunks: string[]; _ended: boolean; _status: number; _headers: Record<string, string> } {
  const chunks: string[] = [];
  return {
    _chunks: chunks,
    _ended: false,
    _status: 0,
    _headers: {},
    get writableEnded() { return this._ended; },
    writeHead(status: number, headers: Record<string, string>) {
      this._status = status;
      this._headers = headers;
    },
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end() {
      this._ended = true;
    },
  };
}

function mockRequest(): CloseDetectable & { _triggerClose: () => void } {
  const listeners: (() => void)[] = [];
  return {
    on(event: string, listener: () => void) {
      if (event === "close") listeners.push(listener);
    },
    _triggerClose() {
      for (const l of listeners) l();
    },
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe("SSEChatTransport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("basic behavior (backward compatibility)", () => {
    it("sets SSE headers on construction", () => {
      const res = mockRes();
      new SSEChatTransport(res);
      expect(res._status).toBe(200);
      expect(res._headers["Content-Type"]).toBe("text/event-stream");
    });

    it("sends events as JSON", () => {
      const res = mockRes();
      const transport = new SSEChatTransport(res);
      const event: ChatEvent = { type: "message:start" };
      transport.send(event);
      expect(res._chunks[0]).toBe(`data: ${JSON.stringify(event)}\n\n`);
    });

    it("sends [DONE] on close", () => {
      const res = mockRes();
      const transport = new SSEChatTransport(res);
      transport.close();
      expect(res._chunks).toContain("data: [DONE]\n\n");
      expect(res._ended).toBe(true);
    });

    it("marks isOpen false after close", () => {
      const res = mockRes();
      const transport = new SSEChatTransport(res);
      expect(transport.isOpen).toBe(true);
      transport.close();
      expect(transport.isOpen).toBe(false);
    });

    it("does not write after close", () => {
      const res = mockRes();
      const transport = new SSEChatTransport(res);
      transport.close();
      const before = res._chunks.length;
      transport.send({ type: "message:start" });
      expect(res._chunks.length).toBe(before);
    });
  });

  describe("heartbeat", () => {
    it("sends heartbeat comments at configured interval", () => {
      const res = mockRes();
      new SSEChatTransport(res, { heartbeatMs: 1000 });
      expect(res._chunks).toHaveLength(0);

      vi.advanceTimersByTime(1000);
      expect(res._chunks).toContain(": heartbeat\n\n");

      vi.advanceTimersByTime(1000);
      expect(res._chunks.filter(c => c === ": heartbeat\n\n")).toHaveLength(2);
    });

    it("does not send heartbeat when disabled (no option)", () => {
      const res = mockRes();
      new SSEChatTransport(res);
      vi.advanceTimersByTime(30000);
      expect(res._chunks.filter(c => c.includes("heartbeat"))).toHaveLength(0);
    });

    it("does not send heartbeat when set to 0", () => {
      const res = mockRes();
      new SSEChatTransport(res, { heartbeatMs: 0 });
      vi.advanceTimersByTime(30000);
      expect(res._chunks.filter(c => c.includes("heartbeat"))).toHaveLength(0);
    });

    it("stops heartbeat on close", () => {
      const res = mockRes();
      const transport = new SSEChatTransport(res, { heartbeatMs: 500 });
      vi.advanceTimersByTime(500);
      expect(res._chunks.filter(c => c === ": heartbeat\n\n")).toHaveLength(1);

      transport.close();
      vi.advanceTimersByTime(5000);
      expect(res._chunks.filter(c => c === ": heartbeat\n\n")).toHaveLength(1);
    });

    it("stops heartbeat on error", () => {
      const res = mockRes();
      const transport = new SSEChatTransport(res, { heartbeatMs: 500 });
      vi.advanceTimersByTime(500);
      transport.error(new Error("test"));
      vi.advanceTimersByTime(5000);
      expect(res._chunks.filter(c => c === ": heartbeat\n\n")).toHaveLength(1);
    });
  });

  describe("close detection", () => {
    it("sets isOpen to false when request closes", () => {
      const res = mockRes();
      const req = mockRequest();
      const transport = new SSEChatTransport(res, { request: req });
      expect(transport.isOpen).toBe(true);

      req._triggerClose();
      expect(transport.isOpen).toBe(false);
    });

    it("stops heartbeat when request closes", () => {
      const res = mockRes();
      const req = mockRequest();
      new SSEChatTransport(res, { heartbeatMs: 500, request: req });

      vi.advanceTimersByTime(500);
      expect(res._chunks.filter(c => c === ": heartbeat\n\n")).toHaveLength(1);

      req._triggerClose();
      vi.advanceTimersByTime(5000);
      expect(res._chunks.filter(c => c === ": heartbeat\n\n")).toHaveLength(1);
    });

    it("does not send events after request closes", () => {
      const res = mockRes();
      const req = mockRequest();
      const transport = new SSEChatTransport(res, { request: req });

      req._triggerClose();
      const before = res._chunks.length;
      transport.send({ type: "message:start" });
      expect(res._chunks.length).toBe(before);
    });
  });

  describe("streamToTransport with heartbeat", () => {
    it("heartbeat continues during streaming", async () => {
      vi.useRealTimers(); // streamToTransport needs real async

      const res = mockRes();
      let heartbeatCount = 0;
      const origWrite = res.write.bind(res);
      res.write = (chunk: string) => {
        if (chunk === ": heartbeat\n\n") heartbeatCount++;
        return origWrite(chunk);
      };

      // Use short heartbeat to test it fires during stream
      const transport = new SSEChatTransport(res, { heartbeatMs: 10 });

      async function* events(): AsyncGenerator<ChatEvent> {
        yield { type: "message:start" };
        await new Promise(r => setTimeout(r, 50));
        yield { type: "message:delta", text: "hello" };
      }

      await streamToTransport(events(), transport);
      // Heartbeat should have fired at least once during the 50ms delay
      expect(heartbeatCount).toBeGreaterThanOrEqual(1);
    });
  });
});
