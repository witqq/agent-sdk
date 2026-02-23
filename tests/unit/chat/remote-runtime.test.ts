import { describe, it, expect, vi, beforeEach } from "vitest";
import { RemoteChatRuntime } from "../../../src/chat/react/RemoteChatRuntime.js";
import type { ChatSession, ChatId, ChatEvent } from "../../../src/chat/core.js";
import type { ModelInfo } from "../../../src/types.js";

// ─── Helpers ──────────────────────────────────────────────────

function mockSession(id = "sess-1"): ChatSession {
  return {
    id: id as unknown as ChatId,
    title: "Test Session",
    status: "active",
    config: { backend: "copilot", model: "gpt-4.1" },
    messages: [],
    metadata: { messageCount: 0, custom: {} },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ChatSession;
}

function sseResponse(events: ChatEvent[], status = 200): Response {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}`).join("\n") + "\ndata: [DONE]\n";
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Tests ────────────────────────────────────────────────────

describe("RemoteChatRuntime", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let runtime: RemoteChatRuntime;

  beforeEach(() => {
    fetchMock = vi.fn();
    runtime = new RemoteChatRuntime({
      baseUrl: "https://api.test",
      headers: { Authorization: "Bearer token" },
      fetch: fetchMock,
    });
  });

  // ─── Lifecycle ────────────────────────────────────────────

  describe("lifecycle", () => {
    it("starts with idle status", () => {
      expect(runtime.status).toBe("idle");
    });

    it("dispose sets status to disposed", async () => {
      await runtime.dispose();
      expect(runtime.status).toBe("disposed");
    });

    it("starts with no active session", () => {
      expect(runtime.activeSessionId).toBeNull();
    });

    it("throws on all methods after dispose", async () => {
      await runtime.dispose();

      await expect(runtime.createSession({ config: { backend: "copilot", model: "gpt-4.1" } }))
        .rejects.toThrow("Runtime is disposed");
      await expect(runtime.getSession("s1" as unknown as ChatId))
        .rejects.toThrow("Runtime is disposed");
      await expect(runtime.listSessions())
        .rejects.toThrow("Runtime is disposed");
      await expect(runtime.deleteSession("s1" as unknown as ChatId))
        .rejects.toThrow("Runtime is disposed");
      await expect(runtime.archiveSession("s1" as unknown as ChatId))
        .rejects.toThrow("Runtime is disposed");
      await expect(runtime.switchSession("s1" as unknown as ChatId))
        .rejects.toThrow("Runtime is disposed");
      await expect(runtime.switchBackend("claude"))
        .rejects.toThrow("Runtime is disposed");
      await expect(runtime.listModels())
        .rejects.toThrow("Runtime is disposed");

      // send also throws
      await expect(async () => {
        for await (const _e of runtime.send("s1" as unknown as ChatId, "Hi")) { /* drain */ }
      }).rejects.toThrow("Runtime is disposed");
    });
  });

  // ─── Sessions ─────────────────────────────────────────────

  describe("sessions", () => {
    it("createSession posts and returns session", async () => {
      const session = mockSession("new-1");
      fetchMock.mockResolvedValue(jsonResponse(session));

      const result = await runtime.createSession({
        config: { backend: "copilot", model: "gpt-4.1" },
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test/sessions/create",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ config: { backend: "copilot", model: "gpt-4.1" } }),
        }),
      );
      expect(result.id).toBe("new-1");
      expect(result.title).toBe("Test Session");
      expect(runtime.activeSessionId).toBe("new-1");
    });

    it("getSession returns session by id", async () => {
      const session = mockSession("sess-1");
      fetchMock.mockResolvedValue(jsonResponse(session));

      const result = await runtime.getSession("sess-1" as unknown as ChatId);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test/sessions/sess-1",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe("sess-1");
      expect(result!.title).toBe("Test Session");
    });

    it("getSession returns null for 404", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 404));
      const result = await runtime.getSession("miss" as unknown as ChatId);
      expect(result).toBeNull();
    });

    it("listSessions returns array", async () => {
      const sessions = [mockSession("a"), mockSession("b")];
      fetchMock.mockResolvedValue(jsonResponse(sessions));

      const result = await runtime.listSessions();
      expect(result).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test/sessions",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("deleteSession sends DELETE and clears active", async () => {
      const session = mockSession("del-1");
      fetchMock.mockResolvedValue(jsonResponse(session));
      await runtime.createSession({ config: { backend: "copilot", model: "gpt-4.1" } });
      expect(runtime.activeSessionId).toBe("del-1");

      fetchMock.mockResolvedValue(jsonResponse({}));
      await runtime.deleteSession("del-1" as unknown as ChatId);

      expect(fetchMock).toHaveBeenLastCalledWith(
        "https://api.test/sessions/del-1",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(runtime.activeSessionId).toBeNull();
    });

    it("deleteSession does not clear active for other sessions", async () => {
      const session = mockSession("keep-1");
      fetchMock.mockResolvedValue(jsonResponse(session));
      await runtime.createSession({ config: { backend: "copilot", model: "gpt-4.1" } });

      fetchMock.mockResolvedValue(jsonResponse({}));
      await runtime.deleteSession("other" as unknown as ChatId);
      expect(runtime.activeSessionId).toBe("keep-1");
    });

    it("archiveSession posts to archive endpoint", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      await runtime.archiveSession("arch-1" as unknown as ChatId);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test/sessions/arch-1/archive",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("switchSession sets active session", async () => {
      const session = mockSession("switch-1");
      fetchMock.mockResolvedValue(jsonResponse(session));

      const result = await runtime.switchSession("switch-1" as unknown as ChatId);
      expect(result.id).toBe("switch-1");
      expect(result.title).toBe("Test Session");
      expect(runtime.activeSessionId).toBe("switch-1");
    });

    it("switchSession throws for missing session", async () => {
      fetchMock.mockResolvedValue(jsonResponse(null, 404));
      await expect(
        runtime.switchSession("missing" as unknown as ChatId),
      ).rejects.toThrow("Session not found");
    });
  });

  // ─── Messaging ────────────────────────────────────────────

  describe("send", () => {
    it("sends message and yields SSE events", async () => {
      const events: ChatEvent[] = [
        { type: "message:start", messageId: "m1" } as ChatEvent,
        { type: "message:delta", content: "Hello" } as ChatEvent,
        { type: "message:complete", messageId: "m1" } as ChatEvent,
      ];
      fetchMock.mockResolvedValue(sseResponse(events));

      const received: ChatEvent[] = [];
      for await (const event of runtime.send("s1" as unknown as ChatId, "Hi")) {
        received.push(event);
      }

      expect(received).toHaveLength(3);
      expect(received[0].type).toBe("message:start");
      expect(received[1].type).toBe("message:delta");
      expect(received[2].type).toBe("message:complete");
    });

    it("sets status to streaming during send", async () => {
      const events: ChatEvent[] = [
        { type: "message:start", messageId: "m1" } as ChatEvent,
      ];
      fetchMock.mockResolvedValue(sseResponse(events));

      let statusDuring: string | undefined;
      for await (const _event of runtime.send("s1" as unknown as ChatId, "Hi")) {
        statusDuring = runtime.status;
      }

      expect(statusDuring).toBe("streaming");
      expect(runtime.status).toBe("idle");
    });

    it("passes model option in request body", async () => {
      fetchMock.mockResolvedValue(sseResponse([]));

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _e of runtime.send(
        "s1" as unknown as ChatId,
        "Hi",
        { model: "gpt-5" },
      )) { /* drain */ }

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test/send",
        expect.objectContaining({
          body: JSON.stringify({ sessionId: "s1", message: "Hi", model: "gpt-5" }),
        }),
      );
    });

    it("includes auth headers in send request", async () => {
      fetchMock.mockResolvedValue(sseResponse([]));

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _e of runtime.send("s1" as unknown as ChatId, "Hi")) { /* drain */ }

      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.headers).toMatchObject({ Authorization: "Bearer token" });
    });

    it("throws on non-OK response", async () => {
      fetchMock.mockResolvedValue(new Response("error", { status: 500, statusText: "Internal" }));

      const events: ChatEvent[] = [];
      await expect(async () => {
        for await (const e of runtime.send("s1" as unknown as ChatId, "Hi")) {
          events.push(e);
        }
      }).rejects.toThrow("Send failed: 500 Internal");
      expect(runtime.status).toBe("error");
    });

    it("throws on missing response body", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

      await expect(async () => {
        for await (const _e of runtime.send("s1" as unknown as ChatId, "Hi")) { /* drain */ }
      }).rejects.toThrow("No response body");
    });
  });

  // ─── Abort ────────────────────────────────────────────────

  describe("abort", () => {
    it("abort resets status to idle", () => {
      runtime.abort();
      expect(runtime.status).toBe("idle");
    });

    it("abort sends server notification", () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      runtime.abort();

      // Fire-and-forget POST to /abort
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test/abort",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("abort during streaming cancels the stream", async () => {
      // Mock fetch that respects abort signal
      fetchMock.mockImplementation((url: string, init: RequestInit) => {
        if (url.endsWith("/send")) {
          return new Promise<Response>((resolve, reject) => {
            // Simulate: signal abort → reject with AbortError
            if (init.signal) {
              init.signal.addEventListener("abort", () => {
                const err = new DOMException("The operation was aborted.", "AbortError");
                reject(err);
              });
            }
            // Send first event then hang (simulating slow stream)
            const encoder = new TextEncoder();
            const stream = new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(encoder.encode('data: {"type":"message:start","messageId":"m1"}\n'));
                // Don't close — hang here
              },
            });
            resolve(new Response(stream, { status: 200 }));
          });
        }
        return Promise.resolve(jsonResponse({}));
      });

      // Start sending (will hang after first event)
      const events: ChatEvent[] = [];
      const sendDone = (async () => {
        for await (const event of runtime.send("s1" as unknown as ChatId, "Hi")) {
          events.push(event);
          // After first event, abort
          if (events.length === 1) {
            runtime.abort();
          }
        }
      })();

      // Should complete quickly (abort breaks the loop)
      await Promise.race([
        sendDone,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ]);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(runtime.status).toBe("idle");
    });
  });

  // ─── Backend / Model ──────────────────────────────────────

  describe("backend and model", () => {
    it("switchBackend posts and updates local state", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      await runtime.switchBackend("claude");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test/backend/switch",
        expect.objectContaining({
          body: JSON.stringify({ backend: "claude" }),
        }),
      );
      expect(runtime.currentBackend).toBe("claude");
    });

    it("switchModel updates local state and notifies server", () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      runtime.switchModel("gpt-5");

      expect(runtime.currentModel).toBe("gpt-5");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test/model/switch",
        expect.objectContaining({
          body: JSON.stringify({ model: "gpt-5" }),
        }),
      );
    });

    it("listModels returns model list", async () => {
      const models: ModelInfo[] = [
        { id: "gpt-4.1", name: "GPT 4.1" },
        { id: "claude-3", name: "Claude 3" },
      ] as ModelInfo[];
      fetchMock.mockResolvedValue(jsonResponse(models));

      const result = await runtime.listModels();
      expect(result).toEqual(models);
    });

    it("currentBackend defaults to 'default'", () => {
      expect(runtime.currentBackend).toBe("default");
    });

    it("currentModel defaults to undefined", () => {
      expect(runtime.currentModel).toBeUndefined();
    });
  });

  // ─── Tools ────────────────────────────────────────────────

  describe("tools", () => {
    it("registerTool and removeTool manage local registry", () => {
      const tool = { name: "my-tool", description: "test", parameters: {} } as unknown as import("../../../src/types.js").ToolDefinition;
      runtime.registerTool(tool);

      expect(runtime.registeredTools.has("my-tool")).toBe(true);
      expect(runtime.registeredTools.get("my-tool")).toBe(tool);

      runtime.removeTool("my-tool");
      expect(runtime.registeredTools.has("my-tool")).toBe(false);
    });

    it("registeredTools starts empty", () => {
      expect(runtime.registeredTools.size).toBe(0);
    });
  });

  // ─── Middleware ────────────────────────────────────────────

  describe("middleware", () => {
    it("use and removeMiddleware manage middleware list", () => {
      const mw = { name: "test-mw" } as unknown as import("../../../src/chat/core.js").ChatMiddleware;
      runtime.use(mw);
      runtime.removeMiddleware(mw);
      // No throw = success (middleware list is internal)
    });
  });

  // ─── Context ──────────────────────────────────────────────

  describe("context", () => {
    it("getContextStats returns null (server-side concern)", () => {
      expect(runtime.getContextStats("s1" as unknown as ChatId)).toBeNull();
    });
  });

  // ─── HTTP error handling ──────────────────────────────────

  describe("HTTP error handling", () => {
    it("createSession throws on server error", async () => {
      fetchMock.mockResolvedValue(new Response("error", { status: 500, statusText: "Internal Server Error" }));
      await expect(
        runtime.createSession({ config: { backend: "copilot", model: "gpt-4.1" } }),
      ).rejects.toThrow("POST /sessions/create failed: 500");
    });

    it("listSessions throws on server error", async () => {
      fetchMock.mockResolvedValue(new Response("error", { status: 503, statusText: "Service Unavailable" }));
      await expect(runtime.listSessions()).rejects.toThrow("GET /sessions failed: 503");
    });

    it("deleteSession throws on server error", async () => {
      fetchMock.mockResolvedValue(new Response("error", { status: 500, statusText: "Internal" }));
      await expect(
        runtime.deleteSession("s1" as unknown as ChatId),
      ).rejects.toThrow("DELETE /sessions/s1 failed: 500");
    });

    it("switchBackend throws on server error", async () => {
      fetchMock.mockResolvedValue(new Response("error", { status: 400, statusText: "Bad Request" }));
      await expect(runtime.switchBackend("invalid")).rejects.toThrow("POST /backend/switch failed: 400");
    });

    it("listModels throws on server error", async () => {
      fetchMock.mockResolvedValue(new Response("error", { status: 502, statusText: "Bad Gateway" }));
      await expect(runtime.listModels()).rejects.toThrow("GET /models failed: 502");
    });

    it("getSession allows 404 (returns null)", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 404));
      const result = await runtime.getSession("miss" as unknown as ChatId);
      expect(result).toBeNull();
    });

    it("getSession throws on non-404 errors", async () => {
      fetchMock.mockResolvedValue(new Response("error", { status: 500, statusText: "Internal" }));
      await expect(
        runtime.getSession("s1" as unknown as ChatId),
      ).rejects.toThrow("GET /sessions/s1 failed: 500");
    });
  });

  // ─── URL handling ─────────────────────────────────────────

  describe("url handling", () => {
    it("strips trailing slash from baseUrl", async () => {
      const rt = new RemoteChatRuntime({
        baseUrl: "https://api.test/",
        fetch: fetchMock,
      });
      fetchMock.mockResolvedValue(jsonResponse([]));
      await rt.listSessions();

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.test/sessions",
        expect.anything(),
      );
    });
  });

  // ─── SSE parsing edge cases ───────────────────────────────

  describe("SSE parsing", () => {
    it("handles multi-chunk SSE delivery", async () => {
      const encoder = new TextEncoder();
      let push: ((chunk: Uint8Array) => void) | undefined;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          push = (chunk) => controller.enqueue(chunk);
          // Deliver in two chunks with a split mid-line
          push(encoder.encode('data: {"type":"message:start"}\nda'));
          push(encoder.encode('ta: {"type":"done"}\ndata: [DONE]\n'));
          controller.close();
        },
      });

      fetchMock.mockResolvedValue(new Response(stream, { status: 200 }));
      const events: ChatEvent[] = [];
      for await (const e of runtime.send("s1" as unknown as ChatId, "test")) {
        events.push(e);
      }

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("message:start");
      expect(events[1].type).toBe("done");
    });

    it("skips malformed JSON in SSE", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {bad json}\ndata: {"type":"done"}\ndata: [DONE]\n'));
          controller.close();
        },
      });

      fetchMock.mockResolvedValue(new Response(stream, { status: 200 }));
      const events: ChatEvent[] = [];
      for await (const e of runtime.send("s1" as unknown as ChatId, "test")) {
        events.push(e);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("done");
    });

    it("handles empty SSE stream (immediate DONE)", async () => {
      fetchMock.mockResolvedValue(sseResponse([]));
      const events: ChatEvent[] = [];
      for await (const e of runtime.send("s1" as unknown as ChatId, "test")) {
        events.push(e);
      }
      expect(events).toHaveLength(0);
    });
  });
});
