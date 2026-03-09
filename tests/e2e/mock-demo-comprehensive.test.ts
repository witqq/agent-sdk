/**
 * Comprehensive E2E tests for all SDK features through the mock-llm backend.
 *
 * Covers: multi-turn conversations, tool calls, error handling, streaming control,
 * finishReason propagation, structured output, provider management.
 *
 * All tests are deterministic and require zero API keys.
 *
 * Run: npx vitest run tests/e2e/mock-demo-comprehensive.test.ts --config vitest.e2e.config.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DemoApiClient } from "./helpers/api-client.js";
import { startMockDemoServer, type RunningServer } from "./helpers/server-manager.js";

// ─── Server Lifecycle ──────────────────────────────────────────

let server: RunningServer;
let api: DemoApiClient;

// Provider IDs resolved at runtime from seeded providers
const providerIds: Record<string, string> = {};

beforeAll(async () => {
  server = await startMockDemoServer({ healthTimeout: 45_000 });
  api = new DemoApiClient(server.baseUrl);

  // Resolve provider IDs by backend name
  const providers = await api.listProviders();
  for (const p of providers) {
    providerIds[p.backend] = p.id;
  }
}, 60_000);

afterAll(async () => {
  await server?.stop();
}, 15_000);

// ─── Helper ────────────────────────────────────────────────────

function findEvents(events: Array<{ data: unknown }>, type: string) {
  return events.filter(e => {
    const d = e.data as Record<string, unknown>;
    return d.type === type;
  });
}

function eventData(event: { data: unknown }): Record<string, unknown> {
  return event.data as Record<string, unknown>;
}

// ─── 1. Multi-turn conversations ───────────────────────────────

describe("Comprehensive E2E", () => {

  describe("multi-turn conversations", () => {
    let sessionId: string;

    it("echo backend returns different text per turn", async () => {
      const pid = providerIds["mock-llm"];
      expect(pid).toBeDefined();

      const session = await api.createSession("Multi-turn echo test");
      sessionId = session.id;

      // Turn 1
      const events1 = await api.sendMessage(sessionId, "Hello", { providerId: pid, timeoutMs: 15_000 });
      const text1 = findEvents(events1, "message:delta")
        .map(e => (e.data as Record<string, unknown>).text).join("");
      expect(text1).toBe("Hello");

      // Turn 2 — different input, different echo
      const events2 = await api.sendMessage(sessionId, "World", { providerId: pid, timeoutMs: 15_000 });
      const text2 = findEvents(events2, "message:delta")
        .map(e => (e.data as Record<string, unknown>).text).join("");
      expect(text2).toBe("World");

      expect(text1).not.toBe(text2);
    }, 20_000);

    it("scripted backend returns first scripted response consistently", async () => {
      // Agent is recreated per-request, so scripted index resets each turn
      const pid = providerIds["mock-scripted"];
      expect(pid).toBeDefined();

      const session = await api.createSession("Scripted consistency test");

      const events1 = await api.sendMessage(session.id, "First", { providerId: pid, timeoutMs: 15_000 });
      const text1 = findEvents(events1, "message:delta")
        .map(e => (e.data as Record<string, unknown>).text).join("");
      expect(text1).toBe("First reply");

      // Second request also gets "First reply" — fresh agent each time
      const events2 = await api.sendMessage(session.id, "Second", { providerId: pid, timeoutMs: 15_000 });
      const text2 = findEvents(events2, "message:delta")
        .map(e => (e.data as Record<string, unknown>).text).join("");
      expect(text2).toBe("First reply");
    }, 20_000);

    it("multi-turn preserves session context (messages accumulate)", async () => {
      const session = await api.getSession(sessionId);
      const messages = session.messages as Array<Record<string, unknown>> | undefined;
      expect(messages).toBeDefined();
      expect(messages!.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ─── 2. Tool call flow ─────────────────────────────────────

  describe("tool calls (mock-tools backend)", () => {
    let sessionId: string;

    it("streams tool:start and tool:complete events", async () => {
      const pid = providerIds["mock-tools"];
      expect(pid).toBeDefined();

      const session = await api.createSession("Tool call test");
      sessionId = session.id;

      const events = await api.sendMessage(sessionId, "Search for something", {
        providerId: pid, timeoutMs: 15_000,
      });

      const toolStarts = findEvents(events, "tool:start");
      const toolCompletes = findEvents(events, "tool:complete");

      expect(toolStarts.length).toBeGreaterThanOrEqual(1);
      expect(toolCompletes.length).toBeGreaterThanOrEqual(1);

      // Verify tool start has expected fields
      const start = eventData(toolStarts[0]);
      expect(start.toolName).toBe("web_search");
      expect(start.args).toEqual({ query: "test query" });

      // Verify tool complete has result
      const complete = eventData(toolCompletes[0]);
      expect(complete.toolName).toBe("web_search");
      expect(complete.result).toBeDefined();
    }, 15_000);

    it("tool events appear before message content in stream", async () => {
      const pid = providerIds["mock-tools"];
      const session = await api.createSession("Tool ordering test");

      const events = await api.sendMessage(session.id, "Test ordering", {
        providerId: pid, timeoutMs: 15_000,
      });

      // Find indices of first tool event and first delta
      const firstToolIdx = events.findIndex(e => {
        const d = eventData(e);
        return d.type === "tool:start" || d.type === "tool:complete";
      });
      const firstDeltaIdx = events.findIndex(e => eventData(e).type === "message:delta");

      // Tool events should exist
      expect(firstToolIdx).toBeGreaterThanOrEqual(0);
      // If there are deltas, they come after tool events
      if (firstDeltaIdx >= 0) {
        expect(firstToolIdx).toBeLessThan(firstDeltaIdx);
      }
    }, 15_000);
  });

  // ─── 3. Error scenarios ────────────────────────────────────

  describe("error scenarios (mock-error backend)", () => {
    it("error mode produces error event in SSE stream", async () => {
      const pid = providerIds["mock-error"];
      expect(pid).toBeDefined();

      const session = await api.createSession("Error test");

      const events = await api.sendMessage(session.id, "Trigger error", {
        providerId: pid, timeoutMs: 15_000,
      });

      const errorEvents = findEvents(events, "error");
      expect(errorEvents.length).toBeGreaterThanOrEqual(1);

      const errData = eventData(errorEvents[0]);
      expect(errData.error).toMatch(/simulated backend failure/i);
    }, 15_000);

    it("error events include recoverable flag", async () => {
      const pid = providerIds["mock-error"];
      const session = await api.createSession("Error recoverable test");

      const events = await api.sendMessage(session.id, "Check recoverable", {
        providerId: pid, timeoutMs: 15_000,
      });

      const errorEvents = findEvents(events, "error");
      expect(errorEvents.length).toBeGreaterThanOrEqual(1);

      const errData = eventData(errorEvents[0]);
      expect(typeof errData.recoverable).toBe("boolean");
    }, 15_000);
  });

  // ─── 4. Permission handling ─────────────────────────────────

  describe("permission handling (mock-permissions backend)", () => {
    it("emits permission:request events for configured tools", async () => {
      const pid = providerIds["mock-permissions"];
      expect(pid).toBeDefined();

      const session = await api.createSession("Permission request test");

      const events = await api.sendMessage(session.id, "Check permissions", {
        providerId: pid, timeoutMs: 15_000,
      });

      const permRequests = findEvents(events, "permission:request");
      expect(permRequests.length).toBeGreaterThanOrEqual(1);

      // Should have requests for configured tools (bash, file_write)
      const toolNames = permRequests.map(e => (eventData(e) as Record<string, unknown>).toolName);
      expect(toolNames).toContain("bash");
      expect(toolNames).toContain("file_write");
    }, 15_000);

    it("emits permission:response events with allowed/denied decisions", async () => {
      const pid = providerIds["mock-permissions"];
      const session = await api.createSession("Permission response test");

      const events = await api.sendMessage(session.id, "Check responses", {
        providerId: pid, timeoutMs: 15_000,
      });

      const permResponses = findEvents(events, "permission:response");
      expect(permResponses.length).toBeGreaterThanOrEqual(1);

      // bash is in denyTools → should be denied
      const bashResponse = permResponses.find(e =>
        (eventData(e) as Record<string, unknown>).toolName === "bash"
      );
      expect(bashResponse).toBeDefined();
      expect((eventData(bashResponse!) as Record<string, unknown>).allowed).toBe(false);

      // file_write is NOT in denyTools → should be allowed (via supervisor)
      const fileWriteResponse = permResponses.find(e =>
        (eventData(e) as Record<string, unknown>).toolName === "file_write"
      );
      expect(fileWriteResponse).toBeDefined();
      expect((eventData(fileWriteResponse!) as Record<string, unknown>).allowed).toBe(true);
    }, 15_000);

    it("permission events appear before message content", async () => {
      const pid = providerIds["mock-permissions"];
      const session = await api.createSession("Permission ordering test");

      const events = await api.sendMessage(session.id, "Check order", {
        providerId: pid, timeoutMs: 15_000,
      });

      const firstPermIdx = events.findIndex(e => {
        const d = eventData(e);
        return d.type === "permission:request" || d.type === "permission:response";
      });
      const firstDeltaIdx = events.findIndex(e => eventData(e).type === "message:delta");

      // Permission events should exist
      expect(firstPermIdx).toBeGreaterThanOrEqual(0);
      // Permission events come before message deltas
      if (firstDeltaIdx >= 0) {
        expect(firstPermIdx).toBeLessThan(firstDeltaIdx);
      }
    }, 15_000);
  });

  // ─── 5. Streaming control ─────────────────────────────────

  describe("streaming control", () => {
    it("events arrive in correct order: message:start → deltas → done", async () => {
      const pid = providerIds["mock-llm"];
      const session = await api.createSession("Stream order test");

      const events = await api.sendMessage(session.id, "Check order", {
        providerId: pid, timeoutMs: 15_000,
      });

      const types = events.map(e => eventData(e).type);

      const startIdx = types.indexOf("message:start");
      const firstDeltaIdx = types.indexOf("message:delta");
      const doneIdx = types.indexOf("done");

      expect(startIdx).toBeGreaterThanOrEqual(0);
      expect(firstDeltaIdx).toBeGreaterThan(startIdx);
      expect(doneIdx).toBeGreaterThan(firstDeltaIdx);
    }, 15_000);

    it("abort mid-stream terminates cleanly", async () => {
      const pid = providerIds["mock-llm"];
      const session = await api.createSession("Abort test");

      const { response, controller } = api.sendMessageRaw(session.id, "Long message for abort", {
        providerId: pid,
      });

      const res = await response;
      expect(res.ok).toBe(true);

      // Read first chunk then abort
      const reader = res.body!.getReader();
      const { value } = await reader.read();
      expect(value).toBeDefined();

      controller.abort();
      // After abort, reading should throw or return done
      try {
        await reader.read();
      } catch {
        // AbortError is expected
      }
    }, 15_000);

    it("stream includes message:complete event with full text", async () => {
      const pid = providerIds["mock-llm"];
      const session = await api.createSession("Complete event test");

      const events = await api.sendMessage(session.id, "Echo this text", {
        providerId: pid, timeoutMs: 15_000,
      });

      const completes = findEvents(events, "message:complete");
      expect(completes.length).toBeGreaterThanOrEqual(1);

      const completeData = eventData(completes[0]);
      expect(completeData.message).toBeDefined();
    }, 15_000);
  });

  // ─── 6. finishReason propagation ──────────────────────────

  describe("finishReason propagation (mock-finish backend)", () => {
    it("done event includes finishReason from mock backend", async () => {
      const pid = providerIds["mock-finish"];
      expect(pid).toBeDefined();

      const session = await api.createSession("FinishReason test");

      const events = await api.sendMessage(session.id, "Check finish reason", {
        providerId: pid, timeoutMs: 15_000,
      });

      const deltas = findEvents(events, "message:delta");
      const text = deltas.map(e => (e.data as Record<string, unknown>).text).join("");
      expect(text).toBe("Length-limited response");

      const doneEvents = findEvents(events, "done");
      expect(doneEvents.length).toBe(1);
      const doneData = eventData(doneEvents[0]);
      expect(doneData.finalOutput).toBe("Length-limited response");
      expect(doneData.finishReason).toBe("length");
    }, 15_000);

    it("default echo backend done event has finishReason 'stop'", async () => {
      const pid = providerIds["mock-llm"];
      const session = await api.createSession("Default finish test");

      const events = await api.sendMessage(session.id, "Echo back", {
        providerId: pid, timeoutMs: 15_000,
      });

      const doneEvents = findEvents(events, "done");
      expect(doneEvents.length).toBe(1);

      const doneData = eventData(doneEvents[0]);
      expect(doneData.finalOutput).toBe("Echo back");
      // Default finishReason is "stop"
      expect(doneData.finishReason).toBe("stop");
    }, 15_000);
  });

  // ─── 7. Structured output ─────────────────────────────────

  describe("structured output (mock-structured backend)", () => {
    it("response delivers structured JSON through SSE stream", async () => {
      const pid = providerIds["mock-structured"];
      expect(pid).toBeDefined();

      const session = await api.createSession("Structured output test");

      const events = await api.sendMessage(session.id, "Get structured data", {
        providerId: pid, timeoutMs: 15_000,
      });

      // The response text should be valid JSON matching the configured structured output
      const deltas = findEvents(events, "message:delta");
      const text = deltas.map(e => (e.data as Record<string, unknown>).text).join("");
      const parsed = JSON.parse(text);
      expect(parsed).toEqual({ name: "Alice", age: 30 });
    }, 15_000);
  });

  // ─── 8. Provider and model management ─────────────────────

  describe("provider and model management", () => {
    it("lists all seeded mock providers", async () => {
      const providers = await api.listProviders();
      const backends = providers.map(p => p.backend);

      expect(backends).toContain("mock-llm");
      expect(backends).toContain("mock-scripted");
      expect(backends).toContain("mock-error");
      expect(backends).toContain("mock-tools");
      expect(backends).toContain("mock-finish");
      expect(backends).toContain("mock-structured");
      expect(backends).toContain("mock-permissions");
    });

    it("creates a new provider with custom label", async () => {
      const created = await api.createProvider({
        backend: "mock-llm",
        model: "mock-echo",
        label: "Custom Echo Provider",
      });
      expect(created.id).toBeDefined();
      expect(created.label).toBe("Custom Echo Provider");

      // Clean up
      await api.deleteProvider(created.id);
    });

    it("switches provider and gets different behavior", async () => {
      const echoSession = await api.createSession("Provider switch - echo");
      const scriptedSession = await api.createSession("Provider switch - scripted");

      // Echo provider returns input
      const echoEvents = await api.sendMessage(echoSession.id, "Test message", {
        providerId: providerIds["mock-llm"], timeoutMs: 15_000,
      });
      const echoText = findEvents(echoEvents, "message:delta")
        .map(e => (e.data as Record<string, unknown>).text).join("");
      expect(echoText).toBe("Test message");

      // Scripted provider returns scripted response
      const scriptedEvents = await api.sendMessage(scriptedSession.id, "Test message", {
        providerId: providerIds["mock-scripted"], timeoutMs: 15_000,
      });
      const scriptedText = findEvents(scriptedEvents, "message:delta")
        .map(e => (e.data as Record<string, unknown>).text).join("");
      expect(scriptedText).toBe("First reply");

      // Different providers, different outputs — proves switching works
      expect(echoText).not.toBe(scriptedText);
    }, 20_000);

    it("model list includes mock models from each backend", async () => {
      const models = await api.listModels();
      const ids = models.map(m => m.id);

      // At least echo models should be present
      expect(ids.some(id => id?.startsWith("mock"))).toBe(true);
    });

    it("rejects request with non-existent provider", async () => {
      const session = await api.createSession("Invalid provider test");

      // Use raw fetch to avoid DemoApiClient throwing on non-200
      const { response } = api.sendMessageRaw(session.id, "Should fail", {
        providerId: "nonexistent-provider-id",
      });
      const res = await response;
      expect(res.ok).toBe(false);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }, 15_000);

    it("provider model persists across multiple requests", async () => {
      const pid = providerIds["mock-llm"];
      const session = await api.createSession("Model persistence test");

      // First request
      const events1 = await api.sendMessage(session.id, "First", { providerId: pid, timeoutMs: 15_000 });
      const text1 = findEvents(events1, "message:delta")
        .map(e => (e.data as Record<string, unknown>).text).join("");
      expect(text1).toBe("First");

      // Second request with same provider — should use same model consistently
      const events2 = await api.sendMessage(session.id, "Second", { providerId: pid, timeoutMs: 15_000 });
      const text2 = findEvents(events2, "message:delta")
        .map(e => (e.data as Record<string, unknown>).text).join("");
      expect(text2).toBe("Second");
    }, 20_000);
  });

  // ─── 9. Event completeness ────────────────────────────────

  describe("event completeness", () => {
    it("every stream has message:start and done events", async () => {
      const pid = providerIds["mock-llm"];
      const session = await api.createSession("Event completeness");

      const events = await api.sendMessage(session.id, "Completeness check", {
        providerId: pid, timeoutMs: 15_000,
      });

      const types = events.map(e => eventData(e).type);
      expect(types).toContain("message:start");
      expect(types).toContain("done");
    }, 15_000);

    it("done event includes finalOutput", async () => {
      const pid = providerIds["mock-llm"];
      const session = await api.createSession("Final output test");

      const events = await api.sendMessage(session.id, "Hello world", {
        providerId: pid, timeoutMs: 15_000,
      });

      const doneEvents = findEvents(events, "done");
      expect(doneEvents.length).toBe(1);

      const done = eventData(doneEvents[0]);
      expect(done.finalOutput).toBeDefined();
      expect(typeof done.finalOutput).toBe("string");
      expect((done.finalOutput as string).length).toBeGreaterThan(0);
    }, 15_000);

    it("usage event is emitted with token counts", async () => {
      const pid = providerIds["mock-llm"];
      const session = await api.createSession("Usage test");

      const events = await api.sendMessage(session.id, "Count tokens", {
        providerId: pid, timeoutMs: 15_000,
      });

      const usageEvents = findEvents(events, "usage");
      expect(usageEvents.length).toBeGreaterThanOrEqual(1);

      const usage = eventData(usageEvents[0]);
      expect(typeof usage.promptTokens).toBe("number");
      expect(typeof usage.completionTokens).toBe("number");
    }, 15_000);
  });

});
