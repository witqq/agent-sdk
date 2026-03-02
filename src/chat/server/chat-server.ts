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
import type { ReadableRequest, WritableResponse, ChatHandlerOptions, ChatServerHooks } from "./handler.js";
import { createAuthHandler } from "./auth-handler.js";
import type { AuthHandlerOptions } from "./auth-handler.js";
import type { ProviderHandlerOptions } from "./provider-handler.js";
import type { IProviderStore } from "./provider-store.js";
import { corsMiddleware } from "./cors.js";
import type { CorsOptions } from "./cors.js";
import type { IChatRuntime, ChatRuntimeOptions } from "../runtime.js";
import { createChatRuntime } from "../runtime.js";
import { json } from "./utils.js";
import type { ServiceManager } from "./service-manager.js";

import * as fs from "node:fs";
import * as path from "node:path";

// ─── Options ───────────────────────────────────────────────────

/**
 * Configuration for auto-creating a ChatRuntime from options.
 * Alternative to providing a pre-built IChatRuntime instance.
 * Uses the same shape as ChatRuntimeOptions from the runtime module.
 */
export type ChatRuntimeConfig = ChatRuntimeOptions;

/** Configuration for createChatServer */
export interface ChatServerOptions {
  /** Pre-built runtime instance. Either `runtime` or `runtimeConfig` must be provided. */
  runtime?: IChatRuntime;

  /** Config to auto-create a runtime. Used when `runtime` is not provided. */
  runtimeConfig?: ChatRuntimeConfig;

  /** Server-side hooks for customizing handler behavior. */
  hooks?: ChatServerHooks;

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

  /** Provider handler options. If provided, provider routes are mounted. */
  providers?: ProviderHandlerOptions;

  /** Prefix for provider routes. Default: "/api/providers" */
  providerPrefix?: string;

  /** Chat handler options (maxBodySize, etc.) */
  chatHandlerOptions?: Omit<ChatHandlerOptions, "prefix">;

  /**
   * Path for the health check endpoint. Default: "/api/health".
   * Set to `false` to disable. Returns `{ ok: true }`.
   */
  healthPath?: string | false;

  /**
   * Auto-create a default provider when a backend authenticates for the first time.
   *
   * - `true` — uses built-in default models per backend
   * - `Record<string, string>` — custom backend→model mapping (e.g. `{ copilot: "gpt-5-mini" }`)
   * - `false` / omitted — disabled
   *
   * Requires both `auth` and `providers` to be configured.
   */
  autoCreateProviders?: boolean | Record<string, string>;

  /**
   * Service lifecycle manager. When provided with `auth`, automatically wires:
   * - `onAuth` → `serviceManager.handleAuth(backend, token)` (creates/caches service)
   * - `onLogout` → `serviceManager.handleLogout()` (disposes all services)
   *
   * User's own `onAuth`/`onLogout` callbacks in `auth` are still called first.
   */
  serviceManager?: ServiceManager;
}

// ─── MIME Types ────────────────────────────────────────────────

/** Default model per backend for auto-created providers */
export const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  copilot: "gpt-5-mini",
  claude: "claude-sonnet-4-5-20250514",
  "vercel-ai": "gpt-4.1-mini",
};

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
  // Resolve runtime: use provided instance or create from config
  const runtime: IChatRuntime = options.runtime
    ?? (options.runtimeConfig ? createChatRuntime(options.runtimeConfig) : (() => {
      throw new Error("Either `runtime` or `runtimeConfig` must be provided to createChatServer");
    })());

  const chatPrefix = options.chatPrefix ?? "/api/chat";
  const authPrefix = options.authPrefix ?? "/api/auth";
  const staticPrefix = options.staticPrefix ?? "/";
  const staticDir = options.staticDir ? path.resolve(options.staticDir) : undefined;
  const healthPath = options.healthPath !== false ? (options.healthPath ?? "/api/health") : undefined;

  // Auto-create providers on auth + wire ServiceManager
  const authOptions = wrapAuthWithServiceManager(
    wrapAuthWithAutoProviders(options),
    options.serviceManager,
  );

  // Create sub-handlers
  const chatHandler = createChatHandler(runtime, {
    prefix: chatPrefix,
    providerStore: options.providers?.providerStore,
    hooks: options.hooks,
    ...options.chatHandlerOptions,
  });

  const authHandler = authOptions ? createAuthHandler(authOptions) : undefined;
  // Provider routes are served via chatHandler (at chatPrefix/providers/*).
  // The standalone providerHandler is available for direct use but not mounted here
  // to avoid duplicate CRUD routes.

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

    // Health check
    if (healthPath && urlPath === healthPath) {
      json(res, { ok: true }, 200);
      return;
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
    json(res, { error: "Not found" }, 404);
  };
}

/**
 * Wrap auth options to auto-create a default provider on first authentication.
 * Returns the (possibly-modified) auth options or undefined if auth is not configured.
 */
function wrapAuthWithAutoProviders(options: ChatServerOptions): AuthHandlerOptions | undefined {
  if (!options.auth) return undefined;
  if (!options.autoCreateProviders || !options.providers) return options.auth;

  const providerStore: IProviderStore = options.providers.providerStore;
  const modelMap = typeof options.autoCreateProviders === "object"
    ? options.autoCreateProviders
    : DEFAULT_PROVIDER_MODELS;

  const userOnAuth = options.auth.onAuth;

  const wrappedOnAuth: AuthHandlerOptions["onAuth"] = async (backend, token) => {
    // Call user's onAuth first
    if (userOnAuth) await userOnAuth(backend, token);

    // Auto-create default provider if none exists for this backend
    try {
      const existing = await providerStore.list();
      const hasBackend = existing.some(p => p.backend === backend);
      if (!hasBackend) {
        const model = modelMap[backend] ?? "default";
        const label = `${backend.charAt(0).toUpperCase() + backend.slice(1)} ${model}`;
        await providerStore.create({
          id: crypto.randomUUID(),
          backend,
          model,
          label,
          createdAt: Date.now(),
        });
      }
    } catch {
      // Silently ignore — provider auto-creation is best-effort
    }
  };

  return { ...options.auth, onAuth: wrappedOnAuth };
}

/**
 * Wrap auth options to auto-wire ServiceManager lifecycle callbacks.
 * ServiceManager.handleAuth() is called after user's onAuth.
 * ServiceManager.handleLogout() is called after user's onLogout.
 */
function wrapAuthWithServiceManager(
  authOptions: AuthHandlerOptions | undefined,
  serviceManager: ServiceManager | undefined,
): AuthHandlerOptions | undefined {
  if (!authOptions || !serviceManager) return authOptions;

  const userOnAuth = authOptions.onAuth;
  const userOnLogout = authOptions.onLogout;

  return {
    ...authOptions,
    onAuth: async (backend, token) => {
      if (userOnAuth) await userOnAuth(backend, token);
      await serviceManager.handleAuth(backend, token);
    },
    onLogout: async () => {
      if (userOnLogout) await userOnLogout();
      await serviceManager.handleLogout();
    },
  };
}
