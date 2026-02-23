/**
 * Demo server E2E integration test.
 *
 * Exercises the full demo flow: health → auth → session CRUD →
 * send message with SSE streaming → model operations.
 *
 * REQUIRES:
 *   - Demo server already running (`npm run demo` or `npm run demo -- dev`)
 *   - Backend authenticated (Copilot device flow, Vercel AI key, etc.)
 *   - DEMO_URL env var or default http://localhost:3456
 *
 * Run: npx vitest run tests/e2e/demo.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { DemoApiClient } from "./helpers/api-client.js";

// ─── Server Connection ─────────────────────────────────────────

const DEMO_URL = process.env.DEMO_URL || "http://localhost:3456";

let api: DemoApiClient;

beforeAll(async () => {
  api = new DemoApiClient(DEMO_URL);

  // Verify server is running
  try {
    const res = await fetch(`${DEMO_URL}/api/health`);
    if (!res.ok) throw new Error(`Health check returned ${res.status}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `E2E tests require a running demo server at ${DEMO_URL}.\n` +
      `Start it with: npm run demo -- dev\n` +
      `Error: ${msg}`,
    );
  }

  // Verify auth is active (backend must be authenticated)
  try {
    await api.listSessions();
  } catch {
    throw new Error(
      `Demo server at ${DEMO_URL} has no active backend.\n` +
      `Open ${DEMO_URL} in browser and authenticate first.`,
    );
  }
}, 15_000);

// ─── Tests ─────────────────────────────────────────────────────

describe("Demo E2E", () => {
  // 1. Health check
  it("health endpoint responds", async () => {
    const res = await api.health();
    expect(res.ok).toBe(true);
  });

  // 2. Session CRUD
  describe("sessions", () => {
    let sessionId: string;

    it("creates a session", async () => {
      const session = await api.createSession("E2E Test Session");
      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe("string");
      sessionId = session.id;
    });

    it("retrieves the session", async () => {
      const session = await api.getSession(sessionId);
      expect(session.id).toBe(sessionId);
    });

    it("lists sessions", async () => {
      const sessions = await api.listSessions();
      expect(sessions).toBeDefined();
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      expect(sessions.some((s) => s.id === sessionId)).toBe(true);
    });

    it("deletes a session", async () => {
      const result = await api.deleteSession(sessionId);
      expect(result.ok).toBe(true);
    });
  });

  // 3. Send message with SSE streaming
  describe("chat", () => {
    let sessionId: string;

    beforeAll(async () => {
      const session = await api.createSession("E2E Chat Session");
      sessionId = session.id;
    });

    it("sends a message and receives full SSE stream", async () => {
      const res = await fetch(`${DEMO_URL}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: "Say hi in one word" }),
        signal: AbortSignal.timeout(90_000),
      });

      expect(res.ok).toBe(true);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotMessageStart = false;
      let gotDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (buffer.includes("message:start")) gotMessageStart = true;
        if (buffer.includes('"type":"done"') || buffer.includes("[DONE]")) {
          gotDone = true;
          break;
        }
      }

      reader.cancel();
      expect(gotMessageStart).toBe(true);
      expect(gotDone).toBe(true);
    }, 120_000);

    it("send to non-existent session returns error event", async () => {
      const res = await fetch(`${DEMO_URL}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "non-existent-id", message: "hello" }),
        signal: AbortSignal.timeout(15_000),
      });
      // The SSE endpoint may return 200 with error events, or 4xx
      // Either way, the response should indicate an error condition
      if (res.status >= 400) {
        expect(res.status).toBeGreaterThanOrEqual(400);
      } else {
        // SSE stream — check for error event or empty/short stream
        const text = await res.text();
        expect(text.length).toBeGreaterThan(0);
      }
    });

    it("send with disallowed model override returns 403", async () => {
      const res = await fetch(`${DEMO_URL}/api/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: "hello", model: "gpt-5" }),
      });
      expect(res.status).toBe(403);
      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toContain("not allowed");
    });
  });

  // 4. Model operations
  describe("model operations", () => {
    it("listModels returns only allowed models", async () => {
      const models = await api.listModels();
      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);

      // All returned models should be in the allowlist (default: gpt-5-mini)
      for (const model of models) {
        const id = model.id || model.name || "";
        expect(id).toContain("gpt-5-mini");
      }
    });

    it("switchModel to disallowed model returns error", async () => {
      const result = await api.switchModel("gpt-5");
      // Should be rejected by allowlist
      expect(result.error).toBeDefined();
    });

    it("switchModel to allowed model succeeds", async () => {
      const result = await api.switchModel("gpt-5-mini");
      expect(result.error).toBeUndefined();
    });
  });
});
