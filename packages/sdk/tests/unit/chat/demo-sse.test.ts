/**
 * SSE delivery tests for the chat demo stream endpoint.
 * Verifies that ChatEvents are delivered correctly via SSE using ChatEventBus.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as http from "node:http";
import {
  createChatId,
  type ChatEvent,
  type ChatRole,
  type ChatId,
} from "../../../src/chat/core.js";
import { ChatEventBus, type EventMiddleware } from "../../../src/chat/events.js";

// ─── SSE Parsing Helper ─────────────────────────────────────────

function parseSSEStream(
  res: http.IncomingMessage,
): Promise<ChatEvent[]> {
  return new Promise((resolve, reject) => {
    const events: ChatEvent[] = [];
    let buffer = "";

    res.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const parts = buffer.split("\n\n");
      buffer = parts.pop()!;
      for (const part of parts) {
        const dataLine = part
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (dataLine) {
          events.push(JSON.parse(dataLine.slice(6)));
        }
      }
    });

    res.on("end", () => {
      // Process remaining buffer
      if (buffer.trim()) {
        const dataLine = buffer
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (dataLine) {
          events.push(JSON.parse(dataLine.slice(6)));
        }
      }
      resolve(events);
    });

    res.on("error", reject);
  });
}

// ─── Test Server ────────────────────────────────────────────────

function createTestSSEServer(): http.Server {
  return http.createServer((_req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const bus = new ChatEventBus();

    // Logging middleware (counts events)
    const logged: string[] = [];
    const logMiddleware: EventMiddleware = (ctx) => {
      logged.push(ctx.event.type);
      ctx.next();
    };
    bus.use(logMiddleware);

    // Forward events to SSE
    const allTypes: ChatEvent["type"][] = [
      "thinking:start", "thinking:delta", "thinking:end",
      "message:start", "message:delta", "message:complete",
      "tool:start", "tool:complete", "error",
    ];
    for (const t of allTypes) {
      bus.on(t, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
    }

    const messageId = createChatId();
    const toolCallId = createChatId();

    // Emit all event types synchronously for testing
    bus.emit("thinking:start", { type: "thinking:start", messageId });
    bus.emit("thinking:delta", { type: "thinking:delta", messageId, text: "Analyzing..." });
    bus.emit("thinking:end", { type: "thinking:end", messageId });

    bus.emit("tool:start", {
      type: "tool:start", messageId, toolCallId,
      toolName: "search", args: { query: "test" },
    });
    bus.emit("tool:complete", {
      type: "tool:complete", messageId, toolCallId,
      toolName: "search", result: { found: true },
    });

    bus.emit("error", {
      type: "error", error: "Temporary issue", recoverable: true, messageId,
    });

    bus.emit("message:start", {
      type: "message:start", messageId, role: "assistant" as ChatRole,
    });
    bus.emit("message:delta", {
      type: "message:delta", messageId, text: "Hello",
    });
    bus.emit("message:delta", {
      type: "message:delta", messageId, text: " world",
    });
    bus.emit("message:complete", {
      type: "message:complete", messageId,
      message: {
        id: messageId,
        role: "assistant",
        content: "Hello world",
        metadata: { model: "test" },
        createdAt: new Date().toISOString(),
        status: "completed",
      },
    });

    res.end();
  });
}

// ─── Tests ──────────────────────────────────────────────────────

describe("Chat demo: SSE delivery", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = createTestSSEServer();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("delivers SSE events in correct order", async () => {
    const res = await new Promise<http.IncomingMessage>((resolve) => {
      http.get(`http://localhost:${port}/`, resolve);
    });
    const events = await parseSSEStream(res);
    const types = events.map((e) => e.type);

    // Verify order: thinking → tool_call → error → message
    const thinkingStartIdx = types.indexOf("thinking:start");
    const thinkingEndIdx = types.indexOf("thinking:end");
    const toolStartIdx = types.indexOf("tool:start");
    const toolEndIdx = types.indexOf("tool:complete");
    const errorIdx = types.indexOf("error");
    const msgStartIdx = types.indexOf("message:start");
    const msgCompleteIdx = types.indexOf("message:complete");

    expect(thinkingStartIdx).toBeLessThan(thinkingEndIdx);
    expect(thinkingEndIdx).toBeLessThan(toolStartIdx);
    expect(toolStartIdx).toBeLessThan(toolEndIdx);
    expect(toolEndIdx).toBeLessThan(errorIdx);
    expect(errorIdx).toBeLessThan(msgStartIdx);
    expect(msgStartIdx).toBeLessThan(msgCompleteIdx);
  });

  it("contains all required event types", async () => {
    const res = await new Promise<http.IncomingMessage>((resolve) => {
      http.get(`http://localhost:${port}/`, resolve);
    });
    const events = await parseSSEStream(res);
    const types = new Set(events.map((e) => e.type));

    expect(types.has("thinking:start")).toBe(true);
    expect(types.has("thinking:delta")).toBe(true);
    expect(types.has("thinking:end")).toBe(true);
    expect(types.has("tool:start")).toBe(true);
    expect(types.has("tool:complete")).toBe(true);
    expect(types.has("error")).toBe(true);
    expect(types.has("message:start")).toBe(true);
    expect(types.has("message:delta")).toBe(true);
    expect(types.has("message:complete")).toBe(true);
  });

  it("thinking events carry correct data", async () => {
    const res = await new Promise<http.IncomingMessage>((resolve) => {
      http.get(`http://localhost:${port}/`, resolve);
    });
    const events = await parseSSEStream(res);

    const thinkingStart = events.find((e) => e.type === "thinking:start");
    expect(thinkingStart).toBeDefined();
    expect((thinkingStart as { messageId: string }).messageId).toBeDefined();

    const thinkingDelta = events.find((e) => e.type === "thinking:delta");
    expect(thinkingDelta).toBeDefined();
    expect((thinkingDelta as { text: string }).text).toBe("Analyzing...");
  });

  it("tool call events carry name, args, and result", async () => {
    const res = await new Promise<http.IncomingMessage>((resolve) => {
      http.get(`http://localhost:${port}/`, resolve);
    });
    const events = await parseSSEStream(res);

    const toolStart = events.find((e) => e.type === "tool:start") as {
      toolName: string; args: Record<string, unknown>; toolCallId: string;
    };
    expect(toolStart.toolName).toBe("search");
    expect(toolStart.args).toEqual({ query: "test" });
    expect(toolStart.toolCallId).toBeDefined();

    const toolEnd = events.find((e) => e.type === "tool:complete") as {
      toolName: string; result: unknown; toolCallId: string;
    };
    expect(toolEnd.toolName).toBe("search");
    expect(toolEnd.result).toEqual({ found: true });
    expect(toolEnd.toolCallId).toBe(toolStart.toolCallId);
  });

  it("error event has recoverable flag and uses error classification", async () => {
    const res = await new Promise<http.IncomingMessage>((resolve) => {
      http.get(`http://localhost:${port}/`, resolve);
    });
    const events = await parseSSEStream(res);

    const errorEvt = events.find((e) => e.type === "error") as {
      error: string; recoverable: boolean; messageId?: string;
    };
    expect(errorEvt).toBeDefined();
    expect(errorEvt.error).toBe("Temporary issue");
    expect(errorEvt.recoverable).toBe(true);
    expect(errorEvt.messageId).toBeDefined();
  });

  it("message deltas concatenate to complete text", async () => {
    const res = await new Promise<http.IncomingMessage>((resolve) => {
      http.get(`http://localhost:${port}/`, resolve);
    });
    const events = await parseSSEStream(res);

    const deltas = events.filter((e) => e.type === "message:delta") as {
      text: string;
    }[];
    const assembled = deltas.map((d) => d.text).join("");
    expect(assembled).toBe("Hello world");

    const complete = events.find((e) => e.type === "message:complete") as {
      message: { content: string };
    };
    expect(complete.message.content).toBe("Hello world");
  });

  it("all events share the same messageId", async () => {
    const res = await new Promise<http.IncomingMessage>((resolve) => {
      http.get(`http://localhost:${port}/`, resolve);
    });
    const events = await parseSSEStream(res);

    const messageIds = events
      .filter((e) => "messageId" in e)
      .map((e) => (e as { messageId: string }).messageId);
    const unique = new Set(messageIds);
    expect(unique.size).toBe(1);
  });

  it("SSE format uses correct data: prefix and double newline", async () => {
    // Verify raw SSE format
    const raw = await new Promise<string>((resolve, reject) => {
      http.get(`http://localhost:${port}/`, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString()));
        res.on("error", reject);
      });
    });

    const lines = raw.split("\n\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(9);
    for (const line of lines) {
      expect(line).toMatch(/^data: \{/);
      const payload = JSON.parse(line.replace(/^data: /, ""));
      expect(payload.type).toBeDefined();
    }
  });
});

describe("Chat demo: ChatEventBus middleware in SSE", () => {
  it("middleware can transform events before SSE delivery", async () => {
    const bus = new ChatEventBus();
    const delivered: ChatEvent[] = [];

    // Middleware that uppercases thinking text
    bus.use((ctx) => {
      if (ctx.event.type === "thinking:delta") {
        ctx.event = {
          ...ctx.event,
          text: (ctx.event as { text: string }).text.toUpperCase(),
        } as ChatEvent;
      }
      ctx.next();
    });

    bus.on("thinking:delta", (event) => delivered.push(event));

    const messageId = createChatId();
    bus.emit("thinking:delta", { type: "thinking:delta", messageId, text: "hello" });

    expect(delivered).toHaveLength(1);
    expect((delivered[0] as { text: string }).text).toBe("HELLO");
  });

  it("middleware can suppress events", async () => {
    const bus = new ChatEventBus();
    const delivered: ChatEvent[] = [];

    // Suppress heartbeat-like errors
    bus.use((ctx) => {
      if (ctx.event.type === "error" && (ctx.event as { recoverable: boolean }).recoverable) {
        ctx.suppress();
      } else {
        ctx.next();
      }
    });

    bus.on("error", (event) => delivered.push(event));

    const messageId = createChatId();
    bus.emit("error", { type: "error", error: "recoverable", recoverable: true, messageId });
    bus.emit("error", { type: "error", error: "fatal", recoverable: false, messageId });

    expect(delivered).toHaveLength(1);
    expect((delivered[0] as { error: string }).error).toBe("fatal");
  });
});
