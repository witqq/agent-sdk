/**
 * Configuration route handlers (model/backend/provider switching, listing).
 *
 * Routes:
 * - GET  /models          → List available models
 * - GET  /backends        → List available backends
 * - POST /model/switch    → Switch active model (handler state)
 * - POST /provider/switch → Switch provider (resolves backend + model)
 */

import type { RouteHandler } from "./types.js";
import { readBody, json } from "../utils.js";

export const configRoutes: RouteHandler = async (method, path, req, res, ctx) => {
  const { runtime, maxBodySize, hooks, providerStore } = ctx;

  // GET /models
  if (method === "GET" && path === "/models") {
    // Try pool-based listing first; if empty, bootstrap from first provider's credentials
    let models = await runtime.listModels();
    if (models.length === 0 && providerStore && ctx.tokenStore) {
      const providers = await providerStore.list();
      for (const p of providers) {
        const token = await ctx.tokenStore.load(p.backend);
        if (token) {
          models = await runtime.listModels({ backend: p.backend, credentials: token });
          break;
        }
      }
    }
    if (hooks?.filterModels) models = hooks.filterModels(models);
    json(res, models);
    return true;
  }

  // GET /backends
  if (method === "GET" && path === "/backends") {
    const backends = await runtime.listBackends();
    json(res, backends);
    return true;
  }

  // POST /model/switch (validation only — model is resolved per-request, not stored)
  if (method === "POST" && path === "/model/switch") {
    const body = await readBody(req, maxBodySize);
    if (!body.model || typeof body.model !== "string") {
      json(res, { error: "model is required" }, 400);
      return true;
    }
    if (hooks?.onModelSwitch) {
      try { await hooks.onModelSwitch(body.model as string); }
      catch (err) {
        json(res, { error: err instanceof Error ? err.message : String(err) }, 403);
        return true;
      }
    }
    json(res, { ok: true });
    return true;
  }

  // POST /provider/switch (validation only — provider is resolved per-request via providerId in /send)
  if (method === "POST" && path === "/provider/switch") {
    const body = await readBody(req, maxBodySize);
    if (!body.providerId || typeof body.providerId !== "string") {
      json(res, { error: "providerId is required" }, 400);
      return true;
    }
    if (!providerStore) {
      json(res, { error: "No provider store configured" }, 400);
      return true;
    }
    const provider = await providerStore.get(body.providerId as string);
    if (!provider) {
      json(res, { error: `Provider "${body.providerId}" not found` }, 404);
      return true;
    }
    if (hooks?.onProviderSwitch) {
      try {
        await hooks.onProviderSwitch({ providerId: body.providerId as string, backend: provider.backend });
      } catch (err) {
        json(res, { error: err instanceof Error ? err.message : String(err) }, 400);
        return true;
      }
    }
    json(res, { ok: true });
    return true;
  }

  return false;
};
