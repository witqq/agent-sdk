/**
 * createChatHandler — maps RemoteChatClient contract endpoints to IChatRuntime calls.
 *
 * Routes are delegated to composable route modules in ./routes/.
 * This file is a thin router (~90 lines) that assembles modules and handles errors.
 */

import type { IChatRuntime } from "../runtime.js";
import type { IChatTransport, WritableResponse } from "../backends/transport.js";
import type { IProviderStore } from "./provider-store.js";
import type { ITokenStore } from "./token-store.js";
import type { ModelInfo } from "../../types.js";
import { json, BodyParseError } from "./utils.js";
import { sessionRoutes, messageRoutes, configRoutes, providerRoutes } from "./routes/index.js";
import type { RouteContext, RouteHandler, HandlerState } from "./routes/types.js";

// ─── Minimal HTTP interfaces (framework-agnostic) ──────────────

/** Minimal readable request interface (node:http IncomingMessage subset) */
export interface ReadableRequest {
  readonly method?: string;
  readonly url?: string;
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  on(event: "end", listener: () => void): unknown;
}

// Re-export WritableResponse from transport
export type { WritableResponse } from "../backends/transport.js";

// ─── Options ───────────────────────────────────────────────────

/**
 * Server-side hooks for customizing chat handler behavior.
 * Consolidates filter, guard, and lifecycle callbacks into a single interface.
 */
export interface ChatServerHooks {
  /** Filter the model list before returning to client. */
  filterModels?(models: ModelInfo[]): ModelInfo[];
  /** Validate model selection on /model/switch and /send model override. Throw to reject. */
  onModelSwitch?(model: string): void | Promise<void>;
  /** Called before provider switch. Receives providerId and resolved backend name. Throw to reject. */
  onProviderSwitch?(info: { providerId: string; backend: string }): void | Promise<void>;
  /** Called before backend switch. Throw to reject. */
  onBackendSwitch?(backend: string): void | Promise<void>;
  /** Called before sending a message. Throw to reject. */
  onBeforeSend?(sessionId: string, message: string): void | Promise<void>;
  /** Global error handler for unhandled route errors. */
  onError?(error: Error, context: { route: string; method: string }): void;
}

/**
 * Factory for creating a chat transport for a /send request.
 * Return an IChatTransport instance that will receive the event stream.
 * Default: SSEChatTransport.
 */
export type TransportFactory = (req: ReadableRequest, res: WritableResponse) => IChatTransport;

/** Configuration for createChatHandler */
export interface ChatHandlerOptions {
  /** Route prefix to strip from URL before matching. Default: "" (no prefix) */
  prefix?: string;
  /** Maximum request body size in bytes. Default: 1MB (1048576) */
  maxBodySize?: number;
  /** SSE heartbeat interval in milliseconds. 0 or undefined disables heartbeat. */
  heartbeatMs?: number;
  /** Optional provider store for provider CRUD routes. */
  providerStore?: IProviderStore;
  /** Optional token store for resolveRequestContext in /send. */
  tokenStore?: ITokenStore;
  /** Consolidated server hooks. */
  hooks?: ChatServerHooks;
  /** Custom transport factory for /send endpoint. Default: SSEChatTransport. */
  transportFactory?: TransportFactory;
}

// ─── Route pipeline ────────────────────────────────────────────

const ROUTE_PIPELINE: readonly RouteHandler[] = [
  sessionRoutes,
  messageRoutes,
  configRoutes,
  providerRoutes,
];

// ─── Handler Factory ───────────────────────────────────────────

/**
 * Create an HTTP request handler that maps RemoteChatClient contract
 * endpoints to IChatRuntime method calls.
 *
 * Routes are handled by composable route modules (sessions, messages, config, providers).
 * Model state is managed in a shared HandlerState object.
 */
export function createChatHandler(
  runtime: IChatRuntime,
  options?: ChatHandlerOptions,
): (req: ReadableRequest, res: WritableResponse) => Promise<void> {
  const prefix = options?.prefix ?? "";

  const state: HandlerState = {};

  const ctx: RouteContext = {
    runtime,
    maxBodySize: options?.maxBodySize ?? 1_048_576,
    heartbeatMs: options?.heartbeatMs,
    hooks: options?.hooks,
    providerStore: options?.providerStore,
    tokenStore: options?.tokenStore,
    transportFactory: options?.transportFactory,
    state,
  };

  return async (req: ReadableRequest, res: WritableResponse): Promise<void> => {
    const url = req.url || "";
    const method = req.method || "GET";
    const rawPath = prefix ? url.slice(prefix.length) : url;
    const path = rawPath.split("?")[0];

    try {
      for (const route of ROUTE_PIPELINE) {
        if (await route(method, path, req, res, ctx)) return;
      }
      json(res, { error: "Not found" }, 404);
    } catch (err) {
      if (err instanceof BodyParseError) {
        json(res, { error: err.message }, err.statusCode);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        if (ctx.hooks?.onError) {
          ctx.hooks.onError(err instanceof Error ? err : new Error(message), { route: path, method });
        }
        json(res, { error: message }, 500);
      }
    }
  };
}

// Re-export route types for consumers who build custom route modules
export type { RouteContext, RouteHandler, HandlerState } from "./routes/types.js";
