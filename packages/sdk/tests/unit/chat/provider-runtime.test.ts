/**
 * Tests for RemoteChatClient provider methods and selectProvider.
 *
 * Provider resolution has moved to the server handler (createChatHandler).
 * IChatClient uses selectProvider() for client-side provider selection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChatRuntime } from "../../../src/chat/runtime.js";
import type { IChatSessionStore } from "../../../src/chat/sessions.js";
import type { IResumableBackend } from "../../../src/chat/backends/types.js";
import type { ChatSession } from "../../../src/chat/core.js";
import { createChatId } from "../../../src/chat/core.js";
import { RemoteChatClient } from "../../../src/chat/react/RemoteChatClient.js";

// ─── Mock Helpers ──────────────────────────────────────────────

function createMockSession(overrides?: Partial<ChatSession>): ChatSession {
  return {
    id: createChatId(),
    title: "Test Session",
    messages: [],
    config: { model: "gpt-4", backend: "mock" },
    metadata: { messageCount: 0, totalTokens: 0 },
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockSessionStore(): IChatSessionStore {
  const sessions = new Map<string, ChatSession>();
  return {
    createSession: vi.fn(async (opts) => {
      const session = createMockSession({ config: opts.config, title: opts.title });
      sessions.set(session.id, session);
      return session;
    }),
    getSession: vi.fn(async (id) => sessions.get(id) ?? null),
    listSessions: vi.fn(async () => [...sessions.values()]),
    updateTitle: vi.fn(async () => {}),
    updateConfig: vi.fn(async () => {}),
    deleteSession: vi.fn(async () => {}),
    appendMessage: vi.fn(async () => {}),
    saveMessages: vi.fn(async () => {}),
    loadMessages: vi.fn(async () => ({ messages: [], total: 0, hasMore: false })),

    searchSessions: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    clear: vi.fn(async () => {}),
    appendMessage: vi.fn(async () => {}),
    loadMessages: vi.fn(async () => ({ messages: [], total: 0, hasMore: false })),
  };
}

function createMockAdapter(): IResumableBackend {
  return {
    streamMessage: vi.fn(async function* () {}),
    sendMessage: vi.fn(async () => ({ text: "ok" })),
    resume: vi.fn(async function* () {}),
    listModels: vi.fn(async () => []),
    validate: vi.fn(async () => ({ valid: true })),
    dispose: vi.fn(async () => {}),
    currentModel: undefined,
  } as unknown as IResumableBackend;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── RemoteChatClient provider methods ────────────────────────

describe("RemoteChatClient provider methods", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let runtime: RemoteChatClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    runtime = new RemoteChatClient({
      baseUrl: "https://api.test",
      fetch: fetchMock,
    });
  });

  it("selectProvider stores provider locally and notifies listeners", () => {
    const cb = vi.fn();
    runtime.onSelectionChange(cb);
    runtime.selectProvider("p1");
    expect(runtime.selectedProviderId).toBe("p1");
    expect(cb).toHaveBeenCalledWith("p1");
  });

  it("listProviders sends GET /providers", async () => {
    const providers = [{ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "Test", createdAt: 1000 }];
    fetchMock.mockResolvedValue(jsonResponse(providers));
    const result = await runtime.listProviders();
    expect(result).toEqual(providers);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/providers",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("createProvider sends POST /providers", async () => {
    const created = { id: "new-id", backend: "claude", model: "sonnet", label: "Claude", createdAt: 2000 };
    fetchMock.mockResolvedValue(jsonResponse(created));
    const result = await runtime.createProvider({ backend: "claude", model: "sonnet", label: "Claude" });
    expect(result).toEqual(created);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/providers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ backend: "claude", model: "sonnet", label: "Claude" }),
      }),
    );
  });

  it("updateProvider sends PUT /providers/:id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await runtime.updateProvider("p1", { label: "Updated" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/providers/p1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ label: "Updated" }),
      }),
    );
  });

  it("deleteProvider sends DELETE /providers/:id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await runtime.deleteProvider("p1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/providers/p1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws on disposed runtime", async () => {
    await runtime.dispose();
    await expect(runtime.listProviders()).rejects.toThrow("disposed");
  });
});

// ─── useProviders hook ─────────────────────────────────────────

describe("useProviders hook", () => {
  it("exports useProviders function", async () => {
    const mod = await import("../../../src/chat/react/useProviders.js");
    expect(typeof mod.useProviders).toBe("function");
  });
});
