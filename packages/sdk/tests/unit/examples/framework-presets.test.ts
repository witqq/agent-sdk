/**
 * Tests for framework preset adapters.
 *
 * Verifies that Express, Hono, and Fastify adapters correctly bridge
 * between framework-specific request/response objects and the SDK's
 * ReadableRequest/WritableResponse interfaces.
 */

import { describe, it, expect, vi } from "vitest";
import type { RequestHandler } from "../../../src/chat/server/index.js";
import { toExpressMiddleware, toExpressRoute } from "../../../examples/framework-presets/express-adapter.js";
import { honoHandler } from "../../../examples/framework-presets/hono-adapter.js";
import { toFastifyHandler, registerRoutes } from "../../../examples/framework-presets/fastify-adapter.js";

// ─── Mock SDK handler ──────────────────────────────────────────

function createMockHandler(): RequestHandler & { calls: Array<{ method?: string; url?: string; body: string }> } {
  const calls: Array<{ method?: string; url?: string; body: string }> = [];
  const handler = (async (req, res) => {
    // Read request body
    let body = "";
    await new Promise<void>((resolve) => {
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => resolve());
    });
    calls.push({ method: req.method, url: req.url, body });

    // Respond with JSON
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  }) as RequestHandler & { calls: Array<{ method?: string; url?: string; body: string }> };
  handler.calls = calls;
  return handler;
}

function createStreamingHandler(): RequestHandler {
  return async (_req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write("data: hello\n\n");
    res.write("data: world\n\n");
    res.end();
  };
}

// ─── Express Adapter ───────────────────────────────────────────

describe("Express Adapter", () => {
  it("should forward request to SDK handler", async () => {
    const handler = createMockHandler();
    const middleware = toExpressMiddleware(handler);
    const next = vi.fn();

    const req = {
      method: "POST",
      url: "/sessions/create",
      on: vi.fn((event: string, listener: (arg?: unknown) => void) => {
        if (event === "data") listener(JSON.stringify({ title: "test" }));
        if (event === "end") listener();
      }),
    };

    const res = {
      writeHead: vi.fn().mockReturnThis(),
      write: vi.fn().mockReturnValue(true),
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    middleware(req, res, next);
    await vi.waitFor(() => expect(handler.calls).toHaveLength(1));

    expect(handler.calls[0].method).toBe("POST");
    expect(handler.calls[0].url).toBe("/sessions/create");
    expect(handler.calls[0].body).toBe(JSON.stringify({ title: "test" }));
    expect(res.writeHead).toHaveBeenCalledWith(200, { "content-type": "application/json" });
  });

  it("should call next with error on handler failure", async () => {
    const failHandler: RequestHandler = async () => {
      throw new Error("handler failed");
    };
    const middleware = toExpressMiddleware(failHandler);
    const next = vi.fn();

    const req = { method: "GET", url: "/", on: vi.fn() };
    const res = { writeHead: vi.fn(), write: vi.fn(), setHeader: vi.fn(), end: vi.fn() };

    middleware(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("toExpressRoute returns same middleware type", () => {
    const handler = createMockHandler();
    const route = toExpressRoute(handler);
    expect(typeof route).toBe("function");
  });
});

// ─── Hono Adapter ──────────────────────────────────────────────

describe("Hono Adapter", () => {
  it("should forward request to SDK handler and return Response", async () => {
    const handler = createMockHandler();
    const honoH = honoHandler(handler);

    const c = {
      req: {
        method: "POST",
        url: "http://localhost/api/chat/send",
        path: "/api/chat/send",
        raw: new Request("http://localhost/api/chat/send", {
          method: "POST",
          body: JSON.stringify({ sessionId: "s1", message: "hi" }),
        }),
      },
    };

    const response = await honoH(c);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ ok: true });

    expect(handler.calls).toHaveLength(1);
    expect(handler.calls[0].method).toBe("POST");
    expect(handler.calls[0].url).toBe("/api/chat/send");
  });

  it("should handle GET requests with empty body", async () => {
    const handler = createMockHandler();
    const honoH = honoHandler(handler);

    const c = {
      req: {
        method: "GET",
        url: "http://localhost/api/chat/models",
        path: "/api/chat/models",
        raw: new Request("http://localhost/api/chat/models"),
      },
    };

    const response = await honoH(c);
    expect(response.status).toBe(200);
    expect(handler.calls[0].method).toBe("GET");
    expect(handler.calls[0].body).toBe("");
  });

  it("should handle streaming SSE response", async () => {
    const streamHandler = createStreamingHandler();
    const honoH = honoHandler(streamHandler);

    const c = {
      req: {
        method: "POST",
        url: "http://localhost/api/chat/send",
        path: "/api/chat/send",
        raw: new Request("http://localhost/api/chat/send", {
          method: "POST",
          body: "{}",
        }),
      },
    };

    const response = await honoH(c);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
  });

  it("should produce a closable SSE stream", async () => {
    const streamHandler = createStreamingHandler();
    const honoH = honoHandler(streamHandler);

    const c = {
      req: {
        method: "POST",
        url: "http://localhost/send",
        path: "/send",
        raw: new Request("http://localhost/send", { method: "POST", body: "{}" }),
      },
    };

    const response = await honoH(c);
    const text = await response.text();
    expect(text).toContain("data: hello");
    expect(text).toContain("data: world");
  });
});

// ─── Fastify Adapter ───────────────────────────────────────────

describe("Fastify Adapter", () => {
  it("should forward request through raw node:http objects", async () => {
    const handler = createMockHandler();
    const fastifyH = toFastifyHandler(handler);

    const dataListeners: Array<(chunk: string) => void> = [];
    const endListeners: Array<() => void> = [];

    const req = {
      method: "POST",
      url: "/sessions/create",
      raw: {
        on(event: string, listener: (arg?: unknown) => void) {
          if (event === "data") dataListeners.push(listener as (chunk: string) => void);
          if (event === "end") endListeners.push(listener as () => void);
        },
      },
    };

    const rawRes = {
      writeHead: vi.fn(),
      write: vi.fn().mockReturnValue(true),
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const reply = { raw: rawRes, hijack: vi.fn(), sent: false };

    // Start handler (will await body)
    const promise = fastifyH(req, reply);

    // Simulate data arriving
    for (const listener of dataListeners) listener('{"title":"test"}');
    for (const listener of endListeners) listener();

    await promise;

    expect(reply.hijack).toHaveBeenCalled();
    expect(handler.calls).toHaveLength(1);
    expect(handler.calls[0].method).toBe("POST");
    expect(handler.calls[0].body).toBe('{"title":"test"}');
    expect(rawRes.writeHead).toHaveBeenCalledWith(200, { "content-type": "application/json" });
  });

  it("should register catch-all route via registerRoutes", () => {
    const handler = createMockHandler();
    const app = { all: vi.fn() };

    registerRoutes(app, handler, "/api/chat");

    expect(app.all).toHaveBeenCalledWith("/api/chat/*", expect.any(Function));
  });

  it("should handle empty body (GET request)", async () => {
    const handler = createMockHandler();
    const fastifyH = toFastifyHandler(handler);

    const endListeners: Array<() => void> = [];
    const req = {
      method: "GET",
      url: "/models",
      raw: {
        on(event: string, listener: () => void) {
          if (event === "end") endListeners.push(listener);
        },
      },
    };

    const rawRes = {
      writeHead: vi.fn(),
      write: vi.fn().mockReturnValue(true),
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const reply = { raw: rawRes, hijack: vi.fn(), sent: false };

    const promise = fastifyH(req, reply);
    for (const listener of endListeners) listener();
    await promise;

    expect(handler.calls[0].method).toBe("GET");
    expect(handler.calls[0].body).toBe("");
  });
});

describe("WritableResponse framework compatibility", () => {
  it("accepts Express-like response without casts", () => {
    // Express.Response shape — writeHead returns `this`, end has overloads
    const expressRes = {
      writeHead(statusCode: number, headers?: Record<string, string>) { return this; },
      setHeader(name: string, value: string) { /* express returns this */ },
      write(chunk: string) { return true; },
      end(body?: string) {},
      writableEnded: false,
    };

    // Should be assignable to WritableResponse without 'as unknown as'
    const sdkRes: import("../../../src/chat/backends/transport.js").WritableResponse = expressRes;
    expect(sdkRes.writableEnded).toBe(false);
    sdkRes.writeHead(200, { "Content-Type": "application/json" });
    sdkRes.setHeader("X-Custom", "value");
    sdkRes.write("data");
    sdkRes.end('{"ok":true}');
  });

  it("accepts Node http.ServerResponse-like object", () => {
    const nodeRes = {
      writeHead(statusCode: number, headers?: Record<string, string>) {},
      setHeader(name: string, value: string) {},
      write(chunk: string) { return true; },
      end(body?: string) {},
      writableEnded: false,
    };

    const sdkRes: import("../../../src/chat/backends/transport.js").WritableResponse = nodeRes;
    expect(sdkRes).toBeDefined();
  });
});
