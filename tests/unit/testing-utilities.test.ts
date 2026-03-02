import { describe, it, expect } from "vitest";
import { createMockAgentService } from "../../src/testing/mock-agent-service.js";
import { createMockRuntime } from "../../src/testing/mock-runtime.js";
import { createMockChatClient } from "../../src/testing/mock-chat-client.js";
import { createMockSession, createMockMessage } from "../../src/testing/mock-data.js";

describe("testing utilities", () => {
  describe("createMockSession", () => {
    it("creates session with defaults", () => {
      const session = createMockSession();
      expect(session.id).toBeTruthy();
      expect(session.title).toBe("Test Session");
      expect(session.config.model).toBe("test-model");
      expect(session.config.backend).toBe("test-backend");
      expect(session.status).toBe("active");
      expect(session.messages).toEqual([]);
    });

    it("creates session with custom values", () => {
      const session = createMockSession({
        title: "My Chat",
        config: { model: "gpt-5-mini", backend: "copilot" },
      });
      expect(session.title).toBe("My Chat");
      expect(session.config.model).toBe("gpt-5-mini");
      expect(session.config.backend).toBe("copilot");
    });
  });

  describe("createMockMessage", () => {
    it("creates message with defaults", () => {
      const msg = createMockMessage();
      expect(msg.id).toBeTruthy();
      expect(msg.role).toBe("user");
      expect(msg.status).toBe("complete");
      expect(msg.parts).toHaveLength(1);
      expect(msg.parts[0]).toMatchObject({ type: "text", text: "Test message" });
    });

    it("creates message with custom text and role", () => {
      const msg = createMockMessage({ role: "assistant", text: "Hello!" });
      expect(msg.role).toBe("assistant");
      expect(msg.parts[0]).toMatchObject({ type: "text", text: "Hello!" });
    });
  });

  describe("createMockAgentService", () => {
    it("creates a service with default name", () => {
      const service = createMockAgentService();
      expect(service.name).toBe("mock");
    });

    it("creates agents that return mock responses", async () => {
      const service = createMockAgentService();
      const agent = service.createAgent({ model: "test-model" });
      const result = await agent.run("Hello");
      expect(result.output).toBe("Mock response");
    });

    it("streams text deltas", async () => {
      const service = createMockAgentService();
      const agent = service.createAgent({ model: "test-model" });
      const events = [];
      for await (const event of agent.stream("Hello")) {
        events.push(event);
      }
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0]).toMatchObject({ type: "text_delta", text: "Mock " });
    });

    it("lists models", async () => {
      const service = createMockAgentService({ models: [{ id: "m1", name: "Model 1" }] });
      const models = await service.listModels();
      expect(models).toEqual([{ id: "m1", name: "Model 1" }]);
    });

    it("validates successfully by default", async () => {
      const service = createMockAgentService();
      const result = await service.validate();
      expect(result.valid).toBe(true);
    });

    it("accepts custom run handler", async () => {
      const service = createMockAgentService({
        onRun: async () => ({ output: "Custom", structuredOutput: undefined, toolCalls: [], messages: [] }),
      });
      const agent = service.createAgent({ model: "test" });
      const result = await agent.run("prompt");
      expect(result.output).toBe("Custom");
    });
  });

  describe("createMockRuntime", () => {
    it("creates runtime with idle status", () => {
      const runtime = createMockRuntime();
      expect(runtime.status).toBe("idle");
    });

    it("creates and retrieves sessions", async () => {
      const runtime = createMockRuntime();
      const session = await runtime.createSession({ title: "Test" });
      expect(session.title).toBe("Test");
      const fetched = await runtime.getSession(session.id);
      expect(fetched).toBeTruthy();
      expect(fetched!.id).toBe(session.id);
    });

    it("lists sessions", async () => {
      const runtime = createMockRuntime();
      await runtime.createSession({ title: "A" });
      await runtime.createSession({ title: "B" });
      const sessions = await runtime.listSessions();
      expect(sessions).toHaveLength(2);
    });

    it("deletes sessions", async () => {
      const runtime = createMockRuntime();
      const session = await runtime.createSession({});
      await runtime.deleteSession(session.id);
      const fetched = await runtime.getSession(session.id);
      expect(fetched).toBeNull();
    });

    it("creates multiple sessions", async () => {
      const runtime = createMockRuntime();
      const s1 = await runtime.createSession({ title: "First" });
      const s2 = await runtime.createSession({ title: "Second" });
      const sessions = await runtime.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toContain(s1.id);
      expect(sessions.map(s => s.id)).toContain(s2.id);
    });

    it("sends messages with default stream", async () => {
      const runtime = createMockRuntime();
      const session = await runtime.createSession({});
      const events = [];
      for await (const event of runtime.send(session.id, "Hello")) {
        events.push(event);
      }
      expect(events.length).toBeGreaterThanOrEqual(3);
      expect(events.some(e => e.type === "message:delta")).toBe(true);
      expect(events.some(e => e.type === "done")).toBe(true);
    });

    it("lists backends without active field", async () => {
      const runtime = createMockRuntime({ defaultBackend: "a" });
      const backends = await runtime.listBackends();
      expect(Array.isArray(backends)).toBe(true);
      expect(backends[0]).toHaveProperty("name");
    });

    it("registers and removes tools", () => {
      const runtime = createMockRuntime();
      const tool = { name: "test_tool", description: "A test tool", parameters: {} as any, execute: async () => "ok" };
      runtime.registerTool(tool);
      expect(runtime.registeredTools.has("test_tool")).toBe(true);
      runtime.removeTool("test_tool");
      expect(runtime.registeredTools.has("test_tool")).toBe(false);
    });

    it("notifies session listeners", async () => {
      const runtime = createMockRuntime();
      let callCount = 0;
      runtime.onSessionChange(() => { callCount++; });
      await runtime.createSession({});
      expect(callCount).toBe(1);
      await runtime.createSession({});
      expect(callCount).toBe(2);
    });

    it("disposes cleanly", async () => {
      const runtime = createMockRuntime();
      await runtime.createSession({});
      await runtime.dispose();
      expect(runtime.status).toBe("disposed");
    });
  });

  describe("createMockChatClient", () => {
    it("creates client with idle status", () => {
      const client = createMockChatClient();
      expect(client.status).toBe("idle");
    });

    it("manages sessions like runtime", async () => {
      const client = createMockChatClient();
      const session = await client.createSession({ title: "Client test" });
      expect(session.title).toBe("Client test");
      const sessions = await client.listSessions();
      expect(sessions).toHaveLength(1);
    });

    it("selects provider and notifies listeners", () => {
      const client = createMockChatClient({
        providers: [{ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "GPT Mini", createdAt: Date.now() }],
      });
      const cb = vi.fn();
      client.onSelectionChange(cb);
      client.selectProvider("p1");
      expect(client.selectedProviderId).toBe("p1");
      expect(cb).toHaveBeenCalledWith("p1");
    });

    it("lists providers", async () => {
      const client = createMockChatClient({
        providers: [{ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "GPT Mini", createdAt: Date.now() }],
      });
      const providers = await client.listProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].label).toBe("GPT Mini");
    });

    it("creates providers", async () => {
      const client = createMockChatClient();
      const provider = await client.createProvider({ backend: "claude", model: "claude-haiku", label: "Haiku" });
      expect(provider.id).toBeTruthy();
      expect(provider.backend).toBe("claude");
      const all = await client.listProviders();
      expect(all).toHaveLength(1);
    });

    it("updates providers", async () => {
      const client = createMockChatClient({
        providers: [{ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "Old", createdAt: Date.now() }],
      });
      await client.updateProvider("p1", { label: "New Label" });
      const providers = await client.listProviders();
      expect(providers[0].label).toBe("New Label");
    });

    it("deletes providers", async () => {
      const client = createMockChatClient({
        providers: [{ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "Test", createdAt: Date.now() }],
      });
      await client.deleteProvider("p1");
      const providers = await client.listProviders();
      expect(providers).toHaveLength(0);
    });

    it("selectProvider updates selectedProviderId", () => {
      const client = createMockChatClient({
        providers: [{ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "GPT Mini", createdAt: Date.now() }],
      });
      client.selectProvider("p1");
      expect(client.selectedProviderId).toBe("p1");
    });

    it("disposes cleanly", async () => {
      const client = createMockChatClient();
      await client.dispose();
      expect(client.status).toBe("disposed");
    });
  });
});
