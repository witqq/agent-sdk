/**
 * createAuthHandler — server-mediated authentication for all three backends.
 *
 * Routes:
 * - POST /auth/start            → Start auth flow (copilot device flow, claude OAuth, vercel-ai passthrough)
 * - POST /auth/copilot/poll     → Poll for Copilot device flow completion
 * - POST /auth/claude/complete  → Exchange Claude OAuth code for token
 * - POST /auth/vercel/complete  → Submit Vercel AI API key
 * - GET  /tokens/saved          → List providers with saved tokens
 * - POST /tokens/use            → Load and activate a saved token
 * - POST /tokens/clear          → Clear all saved tokens and invoke onLogout
 * - POST /auth/dispose          → Clear pending flows and invoke onLogout
 */

import type { ReadableRequest, WritableResponse } from "./handler.js";
import type { ITokenStore } from "./token-store.js";
import type { AuthToken, CopilotAuthToken, ClaudeAuthToken } from "../../auth/types.js";

// Re-use readBody and json helpers via a local copy (handler.ts keeps them unexported).
// We define local equivalents to avoid coupling internal handler helpers.

// ─── Types ─────────────────────────────────────────────────────

/** Auth provider names recognized by the handler */
export type AuthProvider = "copilot" | "claude" | "vercel-ai";

/** Copilot auth class interface (matches CopilotAuth public API) */
export interface ICopilotAuth {
  startDeviceFlow(options?: {
    scopes?: string;
    signal?: AbortSignal;
  }): Promise<{
    userCode: string;
    verificationUrl: string;
    waitForToken: (signal?: AbortSignal) => Promise<CopilotAuthToken>;
  }>;
}

/** Claude auth class interface (matches ClaudeAuth public API) */
export interface IClaudeAuth {
  startOAuthFlow(options?: {
    redirectUri?: string;
    scopes?: string;
  }): {
    authorizeUrl: string;
    completeAuth: (codeOrUrl: string) => Promise<ClaudeAuthToken>;
  };
}

/** Callback invoked after successful authentication */
export type OnAuthCallback = (
  provider: AuthProvider,
  token: AuthToken,
) => void | Promise<void>;

/** Configuration for createAuthHandler */
export interface AuthHandlerOptions {
  /** Token storage implementation */
  tokenStore: ITokenStore;
  /** Factory for creating CopilotAuth instances */
  createCopilotAuth?: () => ICopilotAuth;
  /** Factory for creating ClaudeAuth instances */
  createClaudeAuth?: () => IClaudeAuth;
  /** Called after successful authentication for any provider */
  onAuth?: OnAuthCallback;
  /** Called when dispose/logout is requested */
  onLogout?: () => void | Promise<void>;
  /** Route prefix to strip from URL before matching. Default: "" */
  prefix?: string;
  /** Maximum request body size in bytes. Default: 1MB */
  maxBodySize?: number;
}

// ─── Internal State ────────────────────────────────────────────

interface PendingCopilotFlow {
  waitForToken: (signal?: AbortSignal) => Promise<CopilotAuthToken>;
}

interface PendingClaudeFlow {
  completeAuth: (codeOrUrl: string) => Promise<ClaudeAuthToken>;
}

// ─── Handler Factory ───────────────────────────────────────────

/**
 * Create an HTTP request handler for server-mediated authentication.
 *
 * @param options - Auth handler configuration (token store, auth factories, callbacks)
 * @returns Async request handler `(req, res) => Promise<void>`
 *
 * @example
 * ```ts
 * import { CopilotAuth, ClaudeAuth } from "@witqq/agent-sdk/auth";
 *
 * const authHandler = createAuthHandler({
 *   tokenStore: new FileTokenStore({ directory: ".tokens" }),
 *   createCopilotAuth: () => new CopilotAuth(),
 *   createClaudeAuth: () => new ClaudeAuth(),
 *   onAuth: (provider, token) => {
 *     // Rebuild runtime with new credentials
 *   },
 * });
 * ```
 */
export function createAuthHandler(
  options: AuthHandlerOptions,
): (req: ReadableRequest, res: WritableResponse) => Promise<void> {
  const { tokenStore, onAuth } = options;
  const prefix = options.prefix ?? "";
  const maxBodySize = options.maxBodySize ?? 1_048_576;

  // In-flight auth state (single-user pattern, same as demo)
  let pendingCopilot: PendingCopilotFlow | null = null;
  let pendingClaude: PendingClaudeFlow | null = null;

  return async (req: ReadableRequest, res: WritableResponse): Promise<void> => {
    const url = req.url || "";
    const method = req.method || "GET";
    const rawPath = prefix ? url.slice(prefix.length) : url;
    const path = rawPath.split("?")[0];

    try {
      // POST /auth/start
      if (method === "POST" && path === "/auth/start") {
        const body = await readBody(req, maxBodySize);
        const provider = body.provider as string;

        if (!provider || !isValidProvider(provider)) {
          json(res, { error: "provider is required (copilot, claude, vercel-ai)" }, 400);
          return;
        }

        // Clear pending flows
        pendingCopilot = null;
        pendingClaude = null;

        if (provider === "copilot") {
          if (!options.createCopilotAuth) {
            json(res, { error: "Copilot auth not configured" }, 400);
            return;
          }
          const auth = options.createCopilotAuth();
          const flow = await auth.startDeviceFlow();
          pendingCopilot = { waitForToken: flow.waitForToken };
          json(res, { userCode: flow.userCode, verificationUrl: flow.verificationUrl });
          return;
        }

        if (provider === "claude") {
          if (!options.createClaudeAuth) {
            json(res, { error: "Claude auth not configured" }, 400);
            return;
          }
          const auth = options.createClaudeAuth();
          const flow = auth.startOAuthFlow();
          pendingClaude = { completeAuth: flow.completeAuth };
          json(res, { authorizeUrl: flow.authorizeUrl });
          return;
        }

        // vercel-ai: no server-side flow needed
        json(res, { ready: true });
        return;
      }

      // POST /auth/copilot/poll
      if (method === "POST" && path === "/auth/copilot/poll") {
        if (!pendingCopilot) {
          json(res, { error: "No active Copilot flow" }, 400);
          return;
        }
        const token = await pendingCopilot.waitForToken();
        pendingCopilot = null;
        await tokenStore.save("copilot", token);
        if (onAuth) await onAuth("copilot", token);
        json(res, { ok: true, login: token.login });
        return;
      }

      // POST /auth/claude/complete
      if (method === "POST" && path === "/auth/claude/complete") {
        if (!pendingClaude) {
          json(res, { error: "No active Claude flow" }, 400);
          return;
        }
        const body = await readBody(req, maxBodySize);
        const code = body.code as string;
        if (!code || typeof code !== "string") {
          json(res, { error: "code is required" }, 400);
          return;
        }
        const token = await pendingClaude.completeAuth(code);
        pendingClaude = null;
        await tokenStore.save("claude", token);
        if (onAuth) await onAuth("claude", token);
        json(res, { ok: true });
        return;
      }

      // POST /auth/vercel/complete
      if (method === "POST" && path === "/auth/vercel/complete") {
        const body = await readBody(req, maxBodySize);
        const apiKey = body.apiKey as string;
        if (!apiKey || typeof apiKey !== "string") {
          json(res, { error: "apiKey is required" }, 400);
          return;
        }
        const token: AuthToken = {
          accessToken: apiKey,
          tokenType: "bearer",
          obtainedAt: Date.now(),
        };
        // Preserve baseUrl in token for later restoration
        const storeToken = body.baseUrl
          ? { ...token, baseUrl: body.baseUrl as string }
          : token;
        await tokenStore.save("vercel-ai", storeToken as AuthToken);
        if (onAuth) await onAuth("vercel-ai", storeToken as AuthToken);
        json(res, { ok: true });
        return;
      }

      // GET /tokens/saved
      if (method === "GET" && path === "/tokens/saved") {
        const saved = await tokenStore.list();
        json(res, { saved });
        return;
      }

      // POST /tokens/use
      if (method === "POST" && path === "/tokens/use") {
        const body = await readBody(req, maxBodySize);
        const provider = body.provider as string;
        if (!provider || !isValidProvider(provider)) {
          json(res, { error: "provider is required (copilot, claude, vercel-ai)" }, 400);
          return;
        }
        const token = await tokenStore.load(provider);
        if (!token) {
          json(res, { error: `No saved token for ${provider}` }, 404);
          return;
        }
        if (onAuth) await onAuth(provider, token);
        json(res, { ok: true, provider });
        return;
      }

      // POST /tokens/clear
      if (method === "POST" && path === "/tokens/clear") {
        await tokenStore.clearAll();
        if (options.onLogout) await options.onLogout();
        json(res, { ok: true });
        return;
      }

      // POST /auth/dispose
      if (method === "POST" && path === "/auth/dispose") {
        pendingCopilot = null;
        pendingClaude = null;
        if (options.onLogout) await options.onLogout();
        json(res, { ok: true });
        return;
      }

      // No route matched
      json(res, { error: "Not found" }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      json(res, { error: message }, 500);
    }
  };
}

// ─── Internal Helpers ──────────────────────────────────────────

function isValidProvider(p: string): p is AuthProvider {
  return p === "copilot" || p === "claude" || p === "vercel-ai";
}

function readBody(req: ReadableRequest, maxSize: number): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = "";
    let size = 0;
    let exceeded = false;
    req.on("data", (chunk: Buffer | string) => {
      if (exceeded) return;
      const str = chunk.toString();
      size += Buffer.byteLength(str);
      if (size > maxSize) {
        exceeded = true;
        resolve({});
        return;
      }
      body += str;
    });
    req.on("end", () => {
      if (exceeded) return;
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
    if ("once" in req && typeof (req as { once: unknown }).once === "function") {
      (req as { once(event: string, listener: () => void): void }).once("error", () => resolve({}));
    }
  });
}

function json(res: WritableResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
