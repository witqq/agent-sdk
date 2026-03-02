/**
 * Tests for createProviderHandler — provider CRUD HTTP handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReadableRequest, WritableResponse } from "../../../src/chat/server/handler.js";
import { createProviderHandler } from "../../../src/chat/server/provider-handler.js";
import type { IProviderStore, ProviderConfig } from "../../../src/chat/provider-types.js";

// ─── Mock Helpers ──────────────────────────────────────────────

function mockReq(method: string, url: string, body?: Record<string, unknown>): ReadableRequest {
  const bodyStr = body ? JSON.stringify(body) : "";
  return {
    method,
    url,
    on(event: string, listener: (chunk?: Buffer | string) => void): void {
      if (event === "data" && bodyStr) {
        listener(Buffer.from(bodyStr));
      }
      if (event === "end") {
        listener();
      }
    },
  } as ReadableRequest;
}

function mockRes(): WritableResponse & {
  _status: number;
  _headers: Record<string, string>;
  _body: string;
  _ended: boolean;
} {
  const res = {
    _status: 200,
    _headers: {} as Record<string, string>,
    _body: "",
    _ended: false,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    setHeader(name: string, value: string) {
      res._headers[name] = value;
    },
    write(chunk: string) {
      res._body += chunk;
      return true;
    },
    end(body?: string) {
      if (body) res._body += body;
      res._ended = true;
    },
  };
  return res;
}

function parseBody(res: { _body: string }): Record<string, unknown> {
  return JSON.parse(res._body) as Record<string, unknown>;
}

const SAMPLE_PROVIDER: ProviderConfig = {
  id: "prov-1",
  backend: "copilot",
  model: "gpt-5-mini",
  label: "Copilot GPT-5 mini",
  createdAt: 1000,
};

function mockProviderStore(): IProviderStore {
  const providers = new Map<string, ProviderConfig>();
  return {
    create: vi.fn(async (config: ProviderConfig) => {
      providers.set(config.id, { ...config });
    }),
    get: vi.fn(async (id: string) => {
      const p = providers.get(id);
      return p ? { ...p } : null;
    }),
    update: vi.fn(async (id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>) => {
      const existing = providers.get(id);
      if (!existing) throw new Error(`Provider "${id}" not found`);
      providers.set(id, { ...existing, ...changes, id: existing.id, createdAt: existing.createdAt });
    }),
    delete: vi.fn(async (id: string) => {
      providers.delete(id);
    }),
    list: vi.fn(async () => [...providers.values()]),
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe("createProviderHandler", () => {
  let store: IProviderStore;
  let handler: (req: ReadableRequest, res: WritableResponse) => Promise<void>;

  beforeEach(() => {
    store = mockProviderStore();
    handler = createProviderHandler({ providerStore: store });
  });

  // ── GET /providers ────────────────────────────────────────

  it("GET /providers returns empty list", async () => {
    const req = mockReq("GET", "/providers");
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(parseBody(res)).toEqual([]);
  });

  it("GET /providers returns all providers", async () => {
    await store.create(SAMPLE_PROVIDER);
    const req = mockReq("GET", "/providers");
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    const body = JSON.parse(res._body) as ProviderConfig[];
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("prov-1");
  });

  // ── GET /providers/:id ────────────────────────────────────

  it("GET /providers/:id returns provider", async () => {
    await store.create(SAMPLE_PROVIDER);
    const req = mockReq("GET", "/providers/prov-1");
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(parseBody(res)).toMatchObject({ id: "prov-1", backend: "copilot" });
  });

  it("GET /providers/:id returns 404 for nonexistent", async () => {
    const req = mockReq("GET", "/providers/missing");
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(404);
  });

  // ── POST /providers ───────────────────────────────────────

  it("POST /providers creates provider", async () => {
    const req = mockReq("POST", "/providers", {
      backend: "claude",
      model: "claude-sonnet",
      label: "Claude Sonnet",
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(201);
    const body = parseBody(res);
    expect(body.backend).toBe("claude");
    expect(body.model).toBe("claude-sonnet");
    expect(body.label).toBe("Claude Sonnet");
    expect(body.id).toBeTruthy();
    expect(body.createdAt).toBeTruthy();
  });

  it("POST /providers returns 400 if backend missing", async () => {
    const req = mockReq("POST", "/providers", { model: "m", label: "L" });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(parseBody(res)).toMatchObject({ error: "backend is required" });
  });

  it("POST /providers returns 400 if model missing", async () => {
    const req = mockReq("POST", "/providers", { backend: "b", label: "L" });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(parseBody(res)).toMatchObject({ error: "model is required" });
  });

  it("POST /providers returns 400 if label missing", async () => {
    const req = mockReq("POST", "/providers", { backend: "b", model: "m" });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(parseBody(res)).toMatchObject({ error: "label is required" });
  });

  // ── PUT /providers/:id ────────────────────────────────────

  it("PUT /providers/:id updates provider", async () => {
    await store.create(SAMPLE_PROVIDER);
    const req = mockReq("PUT", "/providers/prov-1", { label: "Updated" });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    const body = parseBody(res) as ProviderConfig;
    expect(body.label).toBe("Updated");
    expect(body.id).toBe("prov-1");
  });

  it("PUT /providers/:id returns 404 for nonexistent", async () => {
    const req = mockReq("PUT", "/providers/missing", { label: "X" });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(404);
  });

  // ── DELETE /providers/:id ─────────────────────────────────

  it("DELETE /providers/:id deletes provider", async () => {
    await store.create(SAMPLE_PROVIDER);
    const req = mockReq("DELETE", "/providers/prov-1");
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(parseBody(res)).toEqual({ ok: true });
    expect(await store.get("prov-1")).toBeNull();
  });

  // ── 404 ───────────────────────────────────────────────────

  it("returns 404 for unmatched route", async () => {
    const req = mockReq("GET", "/unknown");
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(404);
  });
});
