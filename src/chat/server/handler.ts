/**
 * createChatHandler — maps RemoteChatRuntime contract endpoints to IChatRuntime calls.
 *
 * Implements all 10 routes from the RemoteChatRuntime server endpoint contract:
 * - POST   /sessions/create          → runtime.createSession()
 * - GET    /sessions/{id}            → runtime.getSession()
 * - GET    /sessions                 → runtime.listSessions()
 * - DELETE /sessions/{id}            → runtime.deleteSession()
 * - POST   /sessions/{id}/archive    → runtime.archiveSession()
 * - POST   /send                     → runtime.send() via SSE
 * - POST   /abort                    → runtime.abort()
 * - GET    /models                   → runtime.listModels()
 * - POST   /backend/switch           → runtime.switchBackend()
 * - POST   /model/switch             → runtime.switchModel()
 */

import type { IChatRuntime } from "../runtime.js";
import type { SendMessageOptions } from "../core.js";
import { SSEChatTransport, streamToTransport } from "../backends/transport.js";
import type { WritableResponse as TransportWritableResponse, CloseDetectable } from "../backends/transport.js";

// ─── Minimal HTTP interfaces (framework-agnostic) ──────────────

/** Minimal readable request interface (node:http IncomingMessage subset) */
export interface ReadableRequest {
  readonly method?: string;
  readonly url?: string;
  on(event: "data", listener: (chunk: Buffer | string) => void): void;
  on(event: "end", listener: () => void): void;
}

/**
 * Writable HTTP response interface for chat handler.
 * Extends the transport's WritableResponse with setHeader() and body-accepting end().
 */
export interface WritableResponse extends TransportWritableResponse {
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

// ─── Options ───────────────────────────────────────────────────

/** Configuration for createChatHandler */
export interface ChatHandlerOptions {
  /** Route prefix to strip from URL before matching. Default: "" (no prefix) */
  prefix?: string;
  /** Maximum request body size in bytes. Default: 1MB (1048576) */
  maxBodySize?: number;
  /** SSE heartbeat interval in milliseconds. 0 or undefined disables heartbeat. */
  heartbeatMs?: number;
}

// ─── Handler Factory ───────────────────────────────────────────

/**
 * Create an HTTP request handler that maps RemoteChatRuntime contract
 * endpoints to IChatRuntime method calls.
 *
 * @param runtime - The chat runtime instance to serve
 * @param options - Handler configuration
 * @returns Async request handler `(req, res) => Promise<void>`
 *
 * @example
 * ```ts
 * const handler = createChatHandler(runtime, { prefix: "/api/chat" });
 * http.createServer(async (req, res) => {
 *   if (req.url?.startsWith("/api/chat")) {
 *     await handler(req, res);
 *     return;
 *   }
 *   res.writeHead(404).end();
 * });
 * ```
 */
export function createChatHandler(
  runtime: IChatRuntime,
  options?: ChatHandlerOptions,
): (req: ReadableRequest, res: WritableResponse) => Promise<void> {
  const prefix = options?.prefix ?? "";
  const maxBodySize = options?.maxBodySize ?? 1_048_576; // 1MB default
  const heartbeatMs = options?.heartbeatMs;

  return async (req: ReadableRequest, res: WritableResponse): Promise<void> => {
    const url = req.url || "";
    const method = req.method || "GET";

    // Strip prefix to get the route path
    const rawPath = prefix ? url.slice(prefix.length) : url;
    const path = rawPath.split("?")[0];

    // Route matching patterns
    const sessionMatch = path.match(/^\/sessions\/([^/]+)$/);
    const archiveMatch = path.match(/^\/sessions\/([^/]+)\/archive$/);

    try {
      // POST /sessions/create
      if (method === "POST" && path === "/sessions/create") {
        const body = await readBody(req, maxBodySize);
        const session = await runtime.createSession({
          title: body.title as string || `Chat ${new Date().toLocaleTimeString()}`,
          config: body.config as { model: string; backend: string } || {
            model: runtime.currentModel || "",
            backend: runtime.currentBackend,
          },
          ...(body.tags ? { tags: body.tags as string[] } : {}),
          ...(body.custom ? { custom: body.custom as Record<string, unknown> } : {}),
        });
        json(res, session);
        return;
      }

      // POST /sessions/:id/archive (must be before GET/DELETE session match)
      if (method === "POST" && archiveMatch) {
        const id = decodeURIComponent(archiveMatch[1]);
        await runtime.archiveSession(id);
        json(res, { ok: true });
        return;
      }

      // GET /sessions/:id
      if (method === "GET" && sessionMatch) {
        const id = decodeURIComponent(sessionMatch[1]);
        const session = await runtime.getSession(id);
        if (!session) {
          json(res, { error: "Not found" }, 404);
          return;
        }
        json(res, session);
        return;
      }

      // DELETE /sessions/:id
      if (method === "DELETE" && sessionMatch) {
        const id = decodeURIComponent(sessionMatch[1]);
        await runtime.deleteSession(id);
        json(res, { ok: true });
        return;
      }

      // GET /sessions
      if (method === "GET" && path === "/sessions") {
        const sessions = await runtime.listSessions();
        json(res, sessions);
        return;
      }

      // POST /send (SSE stream)
      if (method === "POST" && path === "/send") {
        const body = await readBody(req, maxBodySize);
        const sessionId = body.sessionId as string;
        const message = (body.message || body.content) as string;

        if (!sessionId || !message) {
          json(res, { error: "sessionId and message are required" }, 400);
          return;
        }

        const transport = new SSEChatTransport(res, {
          heartbeatMs,
          request: req as unknown as CloseDetectable,
        });
        try {
          const opts: SendMessageOptions = {};
          if (body.model) opts.model = body.model as string;

          const stream = runtime.send(
            sessionId,
            message,
            Object.keys(opts).length > 0 ? opts : undefined,
          );
          await streamToTransport(stream, transport);
        } catch (err) {
          transport.error(err instanceof Error ? err : new Error(String(err)));
        }
        return;
      }

      // POST /abort
      if (method === "POST" && path === "/abort") {
        runtime.abort();
        json(res, { ok: true });
        return;
      }

      // GET /models
      if (method === "GET" && path === "/models") {
        const models = await runtime.listModels();
        json(res, models);
        return;
      }

      // POST /backend/switch
      if (method === "POST" && path === "/backend/switch") {
        const body = await readBody(req, maxBodySize);
        if (!body.backend || typeof body.backend !== "string") {
          json(res, { error: "backend is required" }, 400);
          return;
        }
        await runtime.switchBackend(body.backend as string);
        json(res, { ok: true });
        return;
      }

      // POST /model/switch
      if (method === "POST" && path === "/model/switch") {
        const body = await readBody(req, maxBodySize);
        if (!body.model || typeof body.model !== "string") {
          json(res, { error: "model is required" }, 400);
          return;
        }
        runtime.switchModel(body.model as string);
        json(res, { ok: true });
        return;
      }

      // No route matched
      json(res, { error: "Not found" }, 404);
    } catch (err) {
      if (err instanceof BodyParseError) {
        json(res, { error: err.message }, err.statusCode);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        json(res, { error: message }, 500);
      }
    }
  };
}

// ─── Internal Helpers ──────────────────────────────────────────

/** Error thrown by readBody with an HTTP status code */
class BodyParseError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "BodyParseError";
    this.statusCode = statusCode;
  }
}

function readBody(req: ReadableRequest, maxSize: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    let exceeded = false;
    req.on("data", (chunk: Buffer | string) => {
      if (exceeded) return;
      const str = chunk.toString();
      size += Buffer.byteLength(str);
      if (size > maxSize) {
        exceeded = true;
        reject(new BodyParseError("Request body too large", 413));
        return;
      }
      body += str;
    });
    req.on("end", () => {
      if (exceeded) return;
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new BodyParseError("Invalid JSON in request body", 400));
      }
    });
    if ("once" in req && typeof (req as { once: unknown }).once === "function") {
      (req as { once(event: string, listener: () => void): void }).once("error", () =>
        reject(new BodyParseError("Request error", 500)),
      );
    }
  });
}

function json(res: WritableResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
