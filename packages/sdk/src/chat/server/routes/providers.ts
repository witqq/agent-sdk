/**
 * Provider CRUD route handlers.
 *
 * Routes:
 * - GET    /providers      → List all providers
 * - GET    /providers/:id  → Get single provider
 * - POST   /providers      → Create provider
 * - PUT    /providers/:id  → Update provider
 * - DELETE /providers/:id  → Delete provider
 */

import type { ProviderConfig } from "../provider-store.js";
import type { RouteHandler } from "./types.js";
import { readBody, json } from "../utils.js";
import { randomUUID } from "node:crypto";

export const providerRoutes: RouteHandler = async (method, path, req, res, ctx) => {
  const { providerStore, maxBodySize } = ctx;
  if (!providerStore) return false;

  const idMatch = path.match(/^\/providers\/([^/]+)$/);

  // GET /providers
  if (method === "GET" && path === "/providers") {
    const providers = await providerStore.list();
    json(res, providers);
    return true;
  }

  // GET /providers/:id
  if (method === "GET" && idMatch) {
    const id = decodeURIComponent(idMatch[1]);
    const provider = await providerStore.get(id);
    if (!provider) {
      json(res, { error: "Provider not found" }, 404);
      return true;
    }
    json(res, provider);
    return true;
  }

  // POST /providers
  if (method === "POST" && path === "/providers") {
    const body = await readBody(req, maxBodySize);
    const backend = body.backend as string;
    const model = body.model as string;
    const label = body.label as string;
    if (!backend || typeof backend !== "string") {
      json(res, { error: "backend is required" }, 400);
      return true;
    }
    if (!model || typeof model !== "string") {
      json(res, { error: "model is required" }, 400);
      return true;
    }
    if (!label || typeof label !== "string") {
      json(res, { error: "label is required" }, 400);
      return true;
    }
    const config: ProviderConfig = {
      id: randomUUID(),
      backend,
      model,
      label,
      createdAt: Date.now(),
    };
    await providerStore.create(config);
    json(res, config, 201);
    return true;
  }

  // PUT /providers/:id
  if (method === "PUT" && idMatch) {
    const id = decodeURIComponent(idMatch[1]);
    const existing = await providerStore.get(id);
    if (!existing) {
      json(res, { error: "Provider not found" }, 404);
      return true;
    }
    const body = await readBody(req, maxBodySize);
    const changes: Partial<Omit<ProviderConfig, "id" | "createdAt">> = {};
    if (body.backend && typeof body.backend === "string") changes.backend = body.backend;
    if (body.model && typeof body.model === "string") changes.model = body.model;
    if (body.label && typeof body.label === "string") changes.label = body.label;
    await providerStore.update(id, changes);
    const updated = await providerStore.get(id);
    json(res, updated);
    return true;
  }

  // DELETE /providers/:id
  if (method === "DELETE" && idMatch) {
    const id = decodeURIComponent(idMatch[1]);
    await providerStore.delete(id);
    json(res, { ok: true });
    return true;
  }

  return false;
};
