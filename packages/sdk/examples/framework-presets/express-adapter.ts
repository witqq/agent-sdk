/**
 * Express Adapter for agent-sdk Chat Server
 *
 * Wraps createChatHandler, createAuthHandler, and corsMiddleware into
 * Express-native middleware. Express req/res objects are compatible with
 * the SDK's ReadableRequest/WritableResponse interfaces, so the adapter
 * is a thin routing layer.
 *
 * Dependencies: express
 *
 * @example
 * ```typescript
 * import express from "express";
 * import { createChatMiddleware } from "./express-adapter";
 *
 * const app = express();
 * app.use("/api/chat", createChatMiddleware(runtime));
 * app.use("/api/auth", createAuthMiddleware(authOptions));
 * ```
 */

import type { RequestHandler } from "@witqq/agent-sdk/chat/server";

// ─── Types (Express subset for zero-dependency typing) ─────────

export interface ExpressRequest {
  readonly method?: string;
  readonly url?: string;
  readonly originalUrl?: string;
  on(event: "data", listener: (chunk: Buffer | string) => void): void;
  on(event: "end", listener: () => void): void;
}

export interface ExpressResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): this;
  write(data: string): boolean;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

export type ExpressNextFunction = (err?: unknown) => void;
export type ExpressMiddleware = (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => void;

// ─── Adapter ───────────────────────────────────────────────────

/**
 * Wrap an SDK RequestHandler as Express middleware.
 *
 * Express req/res satisfy the SDK's ReadableRequest/WritableResponse
 * interfaces natively. This adapter only forwards errors to next().
 *
 * @param handler - SDK handler from createChatHandler, createAuthHandler, or createChatServer
 * @returns Express middleware function
 */
export function toExpressMiddleware(handler: RequestHandler): ExpressMiddleware {
  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction): void => {
    handler(req, res).catch(next);
  };
}

/**
 * Create Express router-style middleware from an SDK handler with prefix stripping.
 *
 * When mounted at a sub-path (e.g. `app.use("/api/chat", middleware)`),
 * Express strips the mount path from `req.url`. The SDK handler sees
 * the remaining path, which is the correct behavior.
 *
 * @param handler - SDK handler from createChatHandler or createAuthHandler
 * @returns Express middleware
 */
export function toExpressRoute(handler: RequestHandler): ExpressMiddleware {
  return toExpressMiddleware(handler);
}
