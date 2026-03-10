/**
 * Mock LLM Demo Server E2E tests.
 *
 * Exercises the full chat server flow using MockLLMChatAdapter — zero auth,
 * fully deterministic. Proves mock-llm is a true drop-in backend replacement.
 *
 * Tests: health, session CRUD, SSE chat streaming, model list, provider CRUD.
 *
 * Run: npx vitest run tests/e2e/mock-demo.test.ts --config vitest.e2e.config.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DemoApiClient } from "./helpers/api-client.js";
import { startMockDemoServer, type RunningServer } from "./helpers/server-manager.js";

// ─── Server Lifecycle ──────────────────────────────────────────

let server: RunningServer;
let api: DemoApiClient;

beforeAll(async () => {
  server = await startMockDemoServer({ healthTimeout: 45_000 });
  api = new DemoApiClient(server.baseUrl);
}, 60_000);

afterAll(async () => {
  await server?.stop();
}, 15_000);

// ─── Tests ─────────────────────────────────────────────────────

describe("Mock LLM Demo E2E", () => {

  // ── 1. Health ──────────────────────────────────────────────
  it("health endpoint responds", async () => {
    const res = await api.health();
    expect(res.ok).toBe(true);
  });

  // ── 2. Session CRUD ────────────────────────────────────────
  describe("sessions", () => {
    let sessionId: string;

    it("creates a session", async () => {
      const session = await api.createSession("Mock E2E Session");
      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe("string");
      sessionId = session.id;
    });

    it("retrieves a session", async () => {
      const session = await api.getSession(sessionId);
      expect(session.id).toBe(sessionId);
    });

    it("lists sessions (includes created)", async () => {
      const sessions = await api.listSessions();
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.some(s => s.id === sessionId)).toBe(true);
    });

    it("deletes a session", async () => {
      const result = await api.deleteSession(sessionId);
      expect(result.ok).toBe(true);

      // Verify it's gone
      try {
        await api.getSession(sessionId);
        expect.fail("Expected 404");
      } catch (err) {
        expect((err as Error).message).toContain("404");
      }
    });
  });

  // ── 3. SSE Chat Streaming ─────────────────────────────────
  describe("chat streaming", () => {
    let sessionId: string;
    let providerId: string;

    beforeAll(async () => {
      // Get the auto-created mock-llm provider
      const providers = await api.listProviders();
      const mockProvider = providers.find(p => p.backend === "mock-llm");
      expect(mockProvider).toBeDefined();
      providerId = mockProvider!.id;

      // Create a session for chat tests
      const session = await api.createSession("Mock Chat Session");
      sessionId = session.id;
    });

    it("sends a message and receives SSE events", async () => {
      const events = await api.sendMessage(sessionId, "Hello mock!", {
        providerId,
        timeoutMs: 30_000,
      });

      expect(events.length).toBeGreaterThan(0);

      // Verify expected event sequence: message:start → message:delta → usage → done
      const types = events.map(e => (e.data as Record<string, unknown>)?.type);
      const startIdx = types.indexOf("message:start");
      const deltaIdx = types.indexOf("message:delta");
      const doneIdx = types.indexOf("done");

      expect(startIdx).toBeGreaterThanOrEqual(0);
      expect(doneIdx).toBeGreaterThan(startIdx);
      expect(deltaIdx).toBeGreaterThan(startIdx);
      expect(deltaIdx).toBeLessThan(doneIdx);

      // Verify usage event presence
      expect(types).toContain("usage");

      // Echo mode should echo the input via message:delta events
      const textEvents = events.filter(e => (e.data as Record<string, unknown>)?.type === "message:delta");
      const fullText = textEvents
        .map(e => (e.data as Record<string, string>)?.text ?? "")
        .join("");
      expect(fullText.length).toBeGreaterThan(0);
    }, 60_000);

    it("echoes user input in echo mode", async () => {
      const events = await api.sendMessage(sessionId, "Echo this exact text!", {
        providerId,
        timeoutMs: 30_000,
      });

      const textEvents = events.filter(e => (e.data as Record<string, unknown>)?.type === "message:delta");
      const fullText = textEvents
        .map(e => (e.data as Record<string, string>)?.text ?? "")
        .join("");

      // Mock echo mode echoes back the user prompt
      expect(fullText).toContain("Echo this exact text!");
    }, 60_000);

    it("streams events incrementally", async () => {
      const stream = await api.sendMessageStream(sessionId, "Stream test", {
        providerId,
        timeoutMs: 30_000,
      });

      const events: Array<{ type: string; data: unknown }> = [];
      for await (const event of stream) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThan(0);

      // Should have message:delta events (streamed text chunks)
      const textDeltas = events.filter(e => (e.data as Record<string, unknown>)?.type === "message:delta");
      expect(textDeltas.length).toBeGreaterThanOrEqual(1);
    }, 60_000);

    it("returns error for non-existent session", async () => {
      const res = await fetch(`${server.baseUrl}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "non-existent-session-id",
          message: "hello",
          providerId,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status >= 400) {
        // Direct HTTP error — expected for non-existent resources
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      } else {
        // Server returns 200 SSE with error event embedded in stream
        const text = await res.text();
        expect(text).toMatch(/error|not.found|session/i);
      }
    });

    it("returns 400 without providerId", async () => {
      const res = await fetch(`${server.baseUrl}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: "hello" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toContain("providerId");
    });
  });

  // ── 4. Model Operations ───────────────────────────────────
  describe("models", () => {
    it("lists mock models", async () => {
      const models = await api.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // Should include mock models
      const ids = models.map(m => m.id || m.name || "");
      expect(ids.some(id => id.includes("mock"))).toBe(true);
    });
  });

  // ── 5. Provider CRUD ──────────────────────────────────────
  describe("providers", () => {
    let newProviderId: string;

    it("lists providers (auto-created mock-llm exists)", async () => {
      const providers = await api.listProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.some(p => p.backend === "mock-llm")).toBe(true);
    });

    it("creates a new mock-llm provider", async () => {
      const provider = await api.createProvider({
        backend: "mock-llm",
        model: "mock-scripted",
        label: "E2E Mock Scripted",
      });
      expect(provider.id).toBeDefined();
      expect(provider.backend).toBe("mock-llm");
      expect(provider.model).toBe("mock-scripted");
      newProviderId = provider.id;
    });

    it("retrieves the created provider", async () => {
      const provider = await api.getProvider(newProviderId);
      expect(provider.id).toBe(newProviderId);
      expect(provider.label).toBe("E2E Mock Scripted");
    });

    it("updates provider", async () => {
      const updated = await api.updateProvider(newProviderId, { label: "Updated Mock" });
      expect(updated.label).toBe("Updated Mock");
    });

    it("deletes provider", async () => {
      const result = await api.deleteProvider(newProviderId);
      expect(result.ok).toBe(true);
    });

    it("get deleted provider returns 404", async () => {
      const res = await fetch(`${server.baseUrl}/api/chat/providers/${newProviderId}`);
      expect(res.status).toBe(404);
    });
  });
});
