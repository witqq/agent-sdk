/**
 * Hono Adapter for agent-sdk Chat Server
 *
 * Wraps SDK handlers into Hono-compatible route handlers. Hono uses a
 * web-standard Request/Response API, so this adapter bridges between
 * Hono's `Context` and the SDK's node:http-style interfaces.
 *
 * Dependencies: hono
 *
 * @example
 * ```typescript
 * import { Hono } from "hono";
 * import { honoHandler } from "./hono-adapter";
 *
 * const app = new Hono();
 * app.all("/api/chat/*", honoHandler(chatHandler));
 * ```
 */

import type { ReadableRequest, WritableResponse, RequestHandler } from "@witqq/agent-sdk/chat/server";

// ─── Hono Context subset (zero-dependency typing) ──────────────

export interface HonoContext {
  req: {
    method: string;
    url: string;
    path: string;
    raw: Request;
  };
}

export type HonoHandler = (c: HonoContext) => Promise<Response>;

// ─── Node-style shims for SDK handler ──────────────────────────

/**
 * Adapt a Hono request to the SDK's ReadableRequest interface.
 *
 * Reads the web-standard Request body as text and exposes it
 * through node:http-style data/end events.
 */
function toReadableRequest(c: HonoContext): ReadableRequest {
  let endListener: (() => void) | null = null;

  const req: ReadableRequest = {
    method: c.req.method,
    url: c.req.path,
    on(event: string, listener: (...args: unknown[]) => void): void {
      if (event === "data") {
        c.req.raw.text().then((body) => {
          if (body.length > 0) listener(body);
          endListener?.();
        }).catch(() => {
          endListener?.();
        });
      } else if (event === "end") {
        endListener = listener as () => void;
      }
    },
  };
  return req;
}

/**
 * Create a WritableResponse that collects output into a web Response.
 *
 * For streaming (SSE), collects chunks into a ReadableStream.
 * For JSON responses, buffers the body.
 */
function createWritableResponse(): { res: WritableResponse; getResponse: () => Response } {
  let statusCode = 200;
  const headers = new Map<string, string>();
  const chunks: string[] = [];
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let isStreaming = false;
  let endCalled = false;
  const encoder = new TextEncoder();

  const res: WritableResponse = {
    writeHead(code: number, hdrs?: Record<string, string>) {
      statusCode = code;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) {
          headers.set(k, v);
        }
      }
      if (headers.get("content-type")?.includes("text/event-stream")) {
        isStreaming = true;
      }
      return res;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    write(data: string) {
      if (isStreaming && streamController) {
        streamController.enqueue(encoder.encode(data));
      } else {
        chunks.push(data);
      }
      return true;
    },
    end(body?: string) {
      if (body) chunks.push(body);
      endCalled = true;
      if (isStreaming && streamController) {
        if (body) streamController.enqueue(encoder.encode(body));
        streamController.close();
      }
    },
    get writableEnded() {
      return endCalled;
    },
  };

  function getResponse(): Response {
    const headerObj: Record<string, string> = {};
    headers.forEach((v, k) => { headerObj[k] = v; });

    if (isStreaming) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          if (endCalled) controller.close();
        },
      });
      return new Response(stream, { status: statusCode, headers: headerObj });
    }

    return new Response(chunks.join(""), {
      status: statusCode,
      headers: headerObj,
    });
  }

  return { res, getResponse };
}

// ─── Adapter ───────────────────────────────────────────────────

/**
 * Wrap an SDK RequestHandler as a Hono route handler.
 *
 * Bridges Hono's web-standard Context to the SDK's node:http-style
 * ReadableRequest/WritableResponse interfaces.
 *
 * @param handler - SDK handler from createChatHandler, createAuthHandler, or createChatServer
 * @returns Hono handler function
 */
export function honoHandler(handler: RequestHandler): HonoHandler {
  return async (c: HonoContext): Promise<Response> => {
    const req = toReadableRequest(c);
    const { res, getResponse } = createWritableResponse();
    await handler(req, res);
    return getResponse();
  };
}
