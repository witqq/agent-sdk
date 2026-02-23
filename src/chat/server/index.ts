/**
 * @witqq/agent-sdk/chat/server
 *
 * Server-side utilities for wiring IChatRuntime to HTTP endpoints.
 * Framework-agnostic: works with node:http, Express, Hono, etc.
 *
 * @example
 * ```ts
 * import http from "node:http";
 * import { createChatHandler, corsMiddleware } from "@witqq/agent-sdk/chat/server";
 * import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
 *
 * const runtime = createChatRuntime({ ... });
 * const chatHandler = createChatHandler(runtime);
 * const cors = corsMiddleware();
 *
 * http.createServer((req, res) => {
 *   if (cors(req, res)) return;           // handles OPTIONS preflight
 *   if (req.url?.startsWith("/api/chat")) {
 *     chatHandler(req, res);
 *     return;
 *   }
 *   res.writeHead(404).end();
 * }).listen(3000);
 * ```
 */

export { createChatHandler } from "./handler.js";
export type { ChatHandlerOptions, ReadableRequest, WritableResponse } from "./handler.js";
export { createAuthHandler } from "./auth-handler.js";
export type {
  AuthHandlerOptions,
  AuthProvider,
  ICopilotAuth,
  IClaudeAuth,
  OnAuthCallback,
} from "./auth-handler.js";
export { createChatServer } from "./chat-server.js";
export type { ChatServerOptions, RequestHandler } from "./chat-server.js";
export { corsMiddleware } from "./cors.js";
export type { CorsOptions } from "./cors.js";
export type { ITokenStore, FileTokenStoreOptions } from "./token-store.js";
export { InMemoryTokenStore, FileTokenStore } from "./token-store.js";
