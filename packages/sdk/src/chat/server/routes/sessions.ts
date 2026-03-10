/**
 * Session CRUD route handlers.
 *
 * Routes:
 * - POST   /sessions/create              → Create session
 * - GET    /sessions/:id                 → Get session
 * - GET    /sessions                     → List sessions
 * - DELETE /sessions/:id                 → Delete session
 * - GET    /sessions/:id/context-stats   → Get context window stats
 */

import type { RouteHandler } from "./types.js";
import { readBody, json } from "../utils.js";

export const sessionRoutes: RouteHandler = async (method, path, req, res, ctx) => {
  const { runtime, maxBodySize } = ctx;
  const sessionMatch = path.match(/^\/sessions\/([^/]+)$/);
  const contextStatsMatch = path.match(/^\/sessions\/([^/]+)\/context-stats$/);

  // POST /sessions/create
  if (method === "POST" && path === "/sessions/create") {
    const body = await readBody(req, maxBodySize);
    const session = await runtime.createSession({
      title: body.title as string || `Chat ${new Date().toLocaleTimeString()}`,
      config: body.config as { model: string; backend: string } || {
        model: "",
        backend: "",
      },
      ...(body.tags ? { tags: body.tags as string[] } : {}),
      ...(body.custom ? { custom: body.custom as Record<string, unknown> } : {}),
    });
    json(res, session);
    return true;
  }

  // GET /sessions/:id/context-stats (must be before GET /sessions/:id)
  if (method === "GET" && contextStatsMatch) {
    const id = decodeURIComponent(contextStatsMatch[1]);
    const stats = await runtime.getContextStats(id);
    json(res, stats ?? null);
    return true;
  }

  // GET /sessions/:id
  if (method === "GET" && sessionMatch) {
    const id = decodeURIComponent(sessionMatch[1]);
    const session = await runtime.getSession(id);
    if (!session) {
      json(res, { error: "Not found" }, 404);
      return true;
    }
    json(res, session);
    return true;
  }

  // DELETE /sessions/:id
  if (method === "DELETE" && sessionMatch) {
    const id = decodeURIComponent(sessionMatch[1]);
    await runtime.deleteSession(id);
    json(res, { ok: true });
    return true;
  }

  // GET /sessions
  if (method === "GET" && path === "/sessions") {
    const sessions = await runtime.listSessions();
    json(res, sessions);
    return true;
  }

  return false;
};
