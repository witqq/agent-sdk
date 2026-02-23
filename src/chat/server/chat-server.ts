/**
 * createChatServer — one-call setup combining runtime, chat handler, auth handler, CORS,
 * and static file serving into a single HTTP request handler.
 *
 * Routes:
 * - CORS preflight (OPTIONS) on all paths
 * - {chatPrefix}/*   → createChatHandler routes
 * - {authPrefix}/*   → createAuthHandler routes (if tokenStore provided)
 * - {staticPrefix}/* → static file serving (if staticDir provided)
 * - Everything else  → 404
 */

import { createChatHandler } from "./handler.js";
import type { ReadableRequest, WritableResponse, ChatHandlerOptions } from "./handler.js";
import { createAuthHandler } from "./auth-handler.js";
import type { AuthHandlerOptions } from "./auth-handler.js";
import { corsMiddleware } from "./cors.js";
import type { CorsOptions } from "./cors.js";
import type { IChatRuntime } from "../runtime.js";

import * as fs from "node:fs";
import * as path from "node:path";

// ─── Options ───────────────────────────────────────────────────

/** Configuration for createChatServer */
export interface ChatServerOptions {
  /** The chat runtime instance to serve */
  runtime: IChatRuntime;

  /** Prefix for chat API routes. Default: "/api/chat" */
  chatPrefix?: string;

  /** Auth handler options. If provided, auth routes are mounted. */
  auth?: AuthHandlerOptions;

  /** Prefix for auth routes. Default: "/api/auth" */
  authPrefix?: string;

  /** CORS options. Pass false to disable CORS. Default: enabled with permissive settings */
  cors?: CorsOptions | false;

  /** Directory to serve static files from. Omit to disable static serving. */
  staticDir?: string;

  /** Prefix for static file routes. Default: "/" */
  staticPrefix?: string;

  /** Chat handler options (maxBodySize, etc.) */
  chatHandlerOptions?: Omit<ChatHandlerOptions, "prefix">;
}

// ─── MIME Types ────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".map": "application/json",
};

// ─── Handler Factory ───────────────────────────────────────────

/** Request handler type returned by createChatServer */
export type RequestHandler = (req: ReadableRequest, res: WritableResponse) => Promise<void>;

/**
 * Create a combined HTTP request handler that routes to chat, auth, static, or 404.
 *
 * @param options - Server configuration
 * @returns Async request handler
 *
 * @example
 * ```ts
 * import http from "node:http";
 * import { createChatServer } from "@witqq/agent-sdk/chat/server";
 *
 * const handler = createChatServer({
 *   runtime,
 *   auth: { tokenStore },
 *   staticDir: "./public",
 * });
 *
 * http.createServer(handler).listen(3000);
 * ```
 */
export function createChatServer(options: ChatServerOptions): RequestHandler {
  const chatPrefix = options.chatPrefix ?? "/api/chat";
  const authPrefix = options.authPrefix ?? "/api/auth";
  const staticPrefix = options.staticPrefix ?? "/";
  const staticDir = options.staticDir ? path.resolve(options.staticDir) : undefined;

  // Create sub-handlers
  const chatHandler = createChatHandler(options.runtime, {
    prefix: chatPrefix,
    ...options.chatHandlerOptions,
  });

  const authHandler = options.auth ? createAuthHandler(options.auth) : undefined;

  const cors = options.cors !== false
    ? corsMiddleware(options.cors)
    : undefined;

  return async (req: ReadableRequest, res: WritableResponse): Promise<void> => {
    const url = req.url || "/";
    const urlPath = url.split("?")[0];

    // CORS preflight
    if (cors) {
      const corsReq = { method: req.method, headers: (req as unknown as Record<string, unknown>).headers as Record<string, string | string[] | undefined> };
      const corsRes = {
        setHeader: (name: string, value: string) => res.setHeader(name, value),
        writeHead: (statusCode: number) => res.writeHead(statusCode, {}),
        end: () => res.end(),
      };
      if (cors(corsReq, corsRes)) {
        return;
      }
    }

    // Chat routes
    if (urlPath.startsWith(chatPrefix + "/") || urlPath === chatPrefix) {
      await chatHandler(req, res);
      return;
    }

    // Auth routes
    if (authHandler && (urlPath.startsWith(authPrefix + "/") || urlPath === authPrefix)) {
      const authReq = Object.create(req, {
        url: { value: url.replace(authPrefix, ""), enumerable: true },
      });
      await authHandler(authReq, res);
      return;
    }

    // Static file serving
    if (staticDir && req.method === "GET" && urlPath.startsWith(staticPrefix)) {
      const relativePath = urlPath === staticPrefix || urlPath === staticPrefix + "/"
        ? "/index.html"
        : urlPath.slice(staticPrefix.length) || "/index.html";

      // Prevent directory traversal (include path.sep to block sibling-prefix attacks)
      const filePath = path.join(staticDir, relativePath);
      if (!filePath.startsWith(staticDir + path.sep) && filePath !== staticDir) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden" }));
        return;
      }

      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || "application/octet-stream";
          const content = fs.readFileSync(filePath);
          res.writeHead(200, {
            "Content-Type": contentType,
            "Content-Length": String(content.length),
          });
          res.write(content.toString());
          res.end();
          return;
        }
      } catch {
        // File not found — fall through to 404
      }
    }

    // 404
    json(res, 404, { error: "Not found" });
  };
}

function json(res: WritableResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(data);
}
