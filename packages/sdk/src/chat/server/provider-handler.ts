/**
 * createProviderHandler — CRUD handler for provider configurations.
 *
 * Routes (prefix already stripped by chat-server):
 * - GET    /providers           → List all providers
 * - GET    /providers/{id}      → Get single provider
 * - POST   /providers           → Create provider
 * - PUT    /providers/{id}      → Update provider
 * - DELETE /providers/{id}      → Delete provider
 */

import type { ReadableRequest, WritableResponse } from "./handler.js";
import type { IProviderStore, ProviderConfig } from "./provider-store.js";
import { randomUUID } from "node:crypto";
import { readBody, json } from "./utils.js";

// ─── Types ─────────────────────────────────────────────────────

/** Configuration for createProviderHandler */
export interface ProviderHandlerOptions {
  /** Provider storage implementation */
  providerStore: IProviderStore;
}

// ─── Handler Factory ───────────────────────────────────────────

/**
 * Create an HTTP request handler for provider CRUD operations.
 *
 * @param options - Provider handler configuration
 * @returns Async request handler `(req, res) => Promise<void>`
 */
export function createProviderHandler(
  options: ProviderHandlerOptions,
): (req: ReadableRequest, res: WritableResponse) => Promise<void> {
  const { providerStore } = options;

  return async (req: ReadableRequest, res: WritableResponse): Promise<void> => {
    const url = req.url || "";
    const method = req.method || "GET";
    const path = url.split("?")[0];

    const idMatch = path.match(/^\/providers\/([^/]+)$/);

    try {
      // GET /providers
      if (method === "GET" && path === "/providers") {
        const providers = await providerStore.list();
        json(res, providers);
        return;
      }

      // GET /providers/:id
      if (method === "GET" && idMatch) {
        const id = decodeURIComponent(idMatch[1]);
        const provider = await providerStore.get(id);
        if (!provider) {
          json(res, { error: "Provider not found" }, 404);
          return;
        }
        json(res, provider);
        return;
      }

      // POST /providers
      if (method === "POST" && path === "/providers") {
        const body = await readBody(req);
        const backend = body.backend as string;
        const model = body.model as string;
        const label = body.label as string;

        if (!backend || typeof backend !== "string") {
          json(res, { error: "backend is required" }, 400);
          return;
        }
        if (!model || typeof model !== "string") {
          json(res, { error: "model is required" }, 400);
          return;
        }
        if (!label || typeof label !== "string") {
          json(res, { error: "label is required" }, 400);
          return;
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
        return;
      }

      // PUT /providers/:id
      if (method === "PUT" && idMatch) {
        const id = decodeURIComponent(idMatch[1]);
        const existing = await providerStore.get(id);
        if (!existing) {
          json(res, { error: "Provider not found" }, 404);
          return;
        }

        const body = await readBody(req);
        const changes: Partial<Omit<ProviderConfig, "id" | "createdAt">> = {};
        if (body.backend && typeof body.backend === "string") changes.backend = body.backend;
        if (body.model && typeof body.model === "string") changes.model = body.model;
        if (body.label && typeof body.label === "string") changes.label = body.label;

        await providerStore.update(id, changes);
        const updated = await providerStore.get(id);
        json(res, updated);
        return;
      }

      // DELETE /providers/:id
      if (method === "DELETE" && idMatch) {
        const id = decodeURIComponent(idMatch[1]);
        await providerStore.delete(id);
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
