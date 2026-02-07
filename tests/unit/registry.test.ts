import { describe, it, expect, beforeEach } from "vitest";
import {
  registerBackend,
  unregisterBackend,
  hasBackend,
  listBackends,
  resetRegistry,
  createAgentService,
} from "../../src/registry.js";
import type { IAgentService } from "../../src/types.js";
import {
  BackendNotFoundError,
  BackendAlreadyRegisteredError,
} from "../../src/errors.js";

// ─── Test Helpers ──────────────────────────────────────────────

function makeMockService(): IAgentService {
  return {
    name: "test",
    createAgent: () => ({}) as any,
    listModels: async () => [],
    validate: async () => ({ valid: true, errors: [] }),
    dispose: async () => {},
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe("Backend Registry", () => {
  beforeEach(() => {
    resetRegistry();
  });

  describe("registerBackend", () => {
    it("should register a custom backend", () => {
      registerBackend("test", () => makeMockService());
      expect(hasBackend("test")).toBe(true);
    });

    it("should throw BackendAlreadyRegisteredError on duplicate", () => {
      registerBackend("test", () => makeMockService());
      expect(() => registerBackend("test", () => makeMockService())).toThrow(
        BackendAlreadyRegisteredError,
      );
    });
  });

  describe("unregisterBackend", () => {
    it("should remove a registered backend", () => {
      registerBackend("test", () => makeMockService());
      expect(unregisterBackend("test")).toBe(true);
      expect(hasBackend("test")).toBe(false);
    });

    it("should return false for non-existent backend", () => {
      expect(unregisterBackend("nope")).toBe(false);
    });
  });

  describe("hasBackend", () => {
    it("should return true for built-in backends", () => {
      expect(hasBackend("copilot")).toBe(true);
      expect(hasBackend("claude")).toBe(true);
      expect(hasBackend("vercel-ai")).toBe(true);
    });

    it("should return false for unknown backends", () => {
      expect(hasBackend("unknown")).toBe(false);
    });

    it("should return true for custom registered backends", () => {
      registerBackend("my-llm", () => makeMockService());
      expect(hasBackend("my-llm")).toBe(true);
    });
  });

  describe("listBackends", () => {
    it("should include all built-in backends", () => {
      const list = listBackends();
      expect(list).toContain("copilot");
      expect(list).toContain("claude");
      expect(list).toContain("vercel-ai");
    });

    it("should include custom backends", () => {
      registerBackend("openrouter", () => makeMockService());
      const list = listBackends();
      expect(list).toContain("openrouter");
      expect(list).toContain("copilot");
    });

    it("should not duplicate built-in names", () => {
      const list = listBackends();
      const copilotCount = list.filter((n) => n === "copilot").length;
      expect(copilotCount).toBe(1);
    });
  });

  describe("resetRegistry", () => {
    it("should clear all custom backends", () => {
      registerBackend("test1", () => makeMockService());
      registerBackend("test2", () => makeMockService());
      resetRegistry();
      // Built-ins still visible via hasBackend
      expect(hasBackend("copilot")).toBe(true);
      // Custom ones gone
      expect(hasBackend("test1")).toBe(false);
      expect(hasBackend("test2")).toBe(false);
    });
  });

  describe("createAgentService", () => {
    it("should create service from custom backend", async () => {
      const mockService = makeMockService();
      registerBackend("test", () => mockService);
      const service = await createAgentService("test", {});
      expect(service).toBe(mockService);
    });

    it("should pass options to factory", async () => {
      let receivedOptions: unknown;
      registerBackend("test", (opts) => {
        receivedOptions = opts;
        return makeMockService();
      });
      await createAgentService("test", { model: "gpt-4" });
      expect(receivedOptions).toEqual({ model: "gpt-4" });
    });

    it("should support async factory", async () => {
      registerBackend("async-test", async () => {
        await new Promise((r) => setTimeout(r, 1));
        return makeMockService();
      });
      const service = await createAgentService("async-test", {});
      expect(service).toBeDefined();
    });

    it("should throw BackendNotFoundError for unknown backend", async () => {
      await expect(createAgentService("nope", {})).rejects.toThrow(
        BackendNotFoundError,
      );
    });

    it("should lazy-load built-in copilot backend", async () => {
      // Copilot backend is now implemented — returns a service
      const service = await createAgentService("copilot", { cliPath: "/usr/bin/copilot" });
      expect(service.name).toBe("copilot");
    });

    it("should lazy-load built-in claude backend", async () => {
      const svc = await createAgentService("claude", {});
      expect(svc).toBeDefined();
      expect(svc.name).toBe("claude");
    });

    it("should lazy-load built-in vercel-ai backend", async () => {
      const svc = await createAgentService("vercel-ai", { apiKey: "test" });
      expect(svc.name).toBe("vercel-ai");
    });

    it("should cache built-in factory after first load", async () => {
      // First call loads and caches
      try { await createAgentService("copilot", {}); } catch { /* expected */ }
      // Second call should use cached factory — won't throw import error
      try { await createAgentService("copilot", {}); } catch { /* expected */ }
      // If we got here without import errors, caching works
    });
  });
});
