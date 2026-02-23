/**
 * Fastify Adapter for agent-sdk Chat Server
 *
 * Wraps SDK handlers into Fastify-compatible route handlers. Fastify's
 * request/reply objects differ from node:http, requiring explicit
 * adaptation to the SDK's ReadableRequest/WritableResponse interfaces.
 *
 * Dependencies: fastify
 *
 * @example
 * ```typescript
 * import Fastify from "fastify";
 * import { registerChatRoutes } from "./fastify-adapter";
 *
 * const app = Fastify();
 * registerChatRoutes(app, chatHandler, "/api/chat");
 * ```
 */

import type { ReadableRequest, WritableResponse, RequestHandler } from "@witqq/agent-sdk/chat/server";

// ─── Fastify types (zero-dependency subset) ────────────────────

export interface FastifyRequest {
  method: string;
  url: string;
  raw: {
    on(event: "data", listener: (chunk: Buffer | string) => void): void;
    on(event: "end", listener: () => void): void;
  };
}

export interface FastifyReply {
  raw: {
    writeHead(statusCode: number, headers?: Record<string, string>): unknown;
    write(data: string): boolean;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
  };
  hijack(): void;
  sent: boolean;
}

export interface FastifyInstance {
  all(path: string, handler: (req: FastifyRequest, reply: FastifyReply) => Promise<void>): void;
}

// ─── Adapter ───────────────────────────────────────────────────

/**
 * Adapt Fastify request to SDK ReadableRequest.
 *
 * Fastify wraps the raw node:http request. We forward to `req.raw`
 * for body streaming, and use Fastify's parsed `url` property.
 */
function toReadableRequest(req: FastifyRequest): ReadableRequest {
  return {
    method: req.method,
    url: req.url,
    on(event: string, listener: (...args: unknown[]) => void): void {
      req.raw.on(event as "data" | "end", listener as (chunk: Buffer | string) => void);
    },
  };
}

/**
 * Adapt Fastify reply to SDK WritableResponse.
 *
 * Uses `reply.hijack()` to take over the response from Fastify's
 * serialization pipeline, then writes directly to `reply.raw`.
 */
function toWritableResponse(reply: FastifyReply): WritableResponse {
  reply.hijack();
  return {
    writeHead(statusCode: number, headers?: Record<string, string>) {
      reply.raw.writeHead(statusCode, headers);
      return this;
    },
    setHeader(name: string, value: string) {
      reply.raw.setHeader(name, value);
    },
    write(data: string) {
      return reply.raw.write(data);
    },
    end(body?: string) {
      reply.raw.end(body);
    },
  };
}

/**
 * Create a Fastify route handler from an SDK RequestHandler.
 *
 * @param handler - SDK handler from createChatHandler, createAuthHandler, or createChatServer
 * @returns Fastify route handler
 */
export function toFastifyHandler(
  handler: RequestHandler,
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const readableReq = toReadableRequest(req);
    const writableRes = toWritableResponse(reply);
    await handler(readableReq, writableRes);
  };
}

/**
 * Register SDK handler as catch-all route on a Fastify instance.
 *
 * @param app - Fastify instance
 * @param handler - SDK handler
 * @param prefix - Route prefix (e.g. "/api/chat")
 */
export function registerRoutes(
  app: FastifyInstance,
  handler: RequestHandler,
  prefix: string,
): void {
  const fastifyHandler = toFastifyHandler(handler);
  app.all(`${prefix}/*`, fastifyHandler);
}
