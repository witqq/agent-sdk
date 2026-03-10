/**
 * Message route handlers (send + abort).
 *
 * Routes:
 * - POST /send   → Stream response via transport (SSE by default)
 * - POST /abort  → Cancel in-flight stream
 */

import type { RuntimeSendOptions } from "../../core.js";
import type { RouteHandler } from "./types.js";
import { SSEChatTransport, streamToTransport } from "../../backends/transport.js";
import type { CloseDetectable } from "../../backends/transport.js";
import { readBody, json } from "../utils.js";
import { resolveRequestContext } from "../request-context.js";
import { ChatError } from "../../errors.js";
import { ErrorCode } from "../../../types/errors.js";

export const messageRoutes: RouteHandler = async (method, path, req, res, ctx) => {
  const { runtime, maxBodySize, heartbeatMs, hooks, transportFactory } = ctx;

  // POST /send (SSE stream)
  if (method === "POST" && path === "/send") {
    const body = await readBody(req, maxBodySize);
    const sessionId = body.sessionId as string;
    const message = (body.message || body.content) as string;

    if (!sessionId || !message) {
      json(res, { error: "sessionId and message are required" }, 400);
      return true;
    }

    // ── Provider-centric path ──
    // When providerStore + tokenStore configured, providerId is REQUIRED.
    let model: string | undefined;
    let reqBackend: string | undefined;
    let reqCredentials: import("../../../auth/types.js").AuthToken | undefined;
    const hasProviderInfra = !!(ctx.providerStore && ctx.tokenStore);

    if (hasProviderInfra) {
      const providerId = body.providerId as string | undefined;
      if (!providerId || typeof providerId !== "string") {
        json(res, { error: "providerId is required" }, 400);
        return true;
      }
      try {
        const reqCtx = await resolveRequestContext(providerId, {
          providerStore: ctx.providerStore!,
          tokenStore: ctx.tokenStore!,
        });
        model = reqCtx.model;
        reqBackend = reqCtx.backend;
        reqCredentials = reqCtx.credentials;
      } catch (err) {
        if (err instanceof ChatError && err.code === ErrorCode.PROVIDER_NOT_FOUND) {
          json(res, { error: err.message }, 404);
          return true;
        }
        if (err instanceof ChatError && err.code === ErrorCode.AUTH_REQUIRED) {
          json(res, { error: err.message }, 401);
          return true;
        }
        throw err;
      }
    }

    // Model guard on send model override
    const bodyModel = body.model as string | undefined;
    if (hooks?.onModelSwitch && bodyModel && typeof bodyModel === "string") {
      try { await hooks.onModelSwitch(bodyModel); }
      catch (err) {
        json(res, { error: err instanceof Error ? err.message : String(err) }, 403);
        return true;
      }
    }

    // Before-send hook
    if (hooks?.onBeforeSend) {
      try { await hooks.onBeforeSend(sessionId, message); }
      catch (err) {
        json(res, { error: err instanceof Error ? err.message : String(err) }, 403);
        return true;
      }
    }

    // Resolve model: explicit from body → provider context → 400
    model = bodyModel || model;
    if (!model) {
      json(res, { error: "model is required (via body.model or providerId)" }, 400);
      return true;
    }

    const transport = transportFactory
      ? transportFactory(req, res)
      : new SSEChatTransport(res, {
          heartbeatMs,
          request: req as unknown as CloseDetectable,
        });
    try {
      if (!reqBackend || !reqCredentials) {
        json(res, { error: "backend and credentials are required (configure providerStore + tokenStore)" }, 400);
        return true;
      }
      const opts: RuntimeSendOptions = { model, backend: reqBackend, credentials: reqCredentials };
      const stream = runtime.send(sessionId, message, opts);
      await streamToTransport(stream, transport);
    } catch (err) {
      transport.error(err instanceof Error ? err : new Error(String(err)));
    }
    return true;
  }

  // POST /abort
  if (method === "POST" && path === "/abort") {
    runtime.abort();
    json(res, { ok: true });
    return true;
  }

  return false;
};
