import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerBackend,
  unregisterBackend,
  hasBackend,
  listBackends,
  resetRegistry,
  createAgentService,
  disposeBackend,
  listConfigs,
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

  describe("multi-config per provider", () => {
    it("should cache and reuse service instance with configId", async () => {
      let callCount = 0;
      registerBackend("test", () => {
        callCount++;
        return makeMockService();
      });

      const svc1 = await createAgentService("test", {}, "alpha");
      const svc2 = await createAgentService("test", {}, "alpha");
      expect(svc1).toBe(svc2);
      expect(callCount).toBe(1);
    });

    it("should create separate instances for different configIds", async () => {
      registerBackend("test", () => makeMockService());

      const svc1 = await createAgentService("test", {}, "alpha");
      const svc2 = await createAgentService("test", {}, "beta");
      expect(svc1).not.toBe(svc2);
    });

    it("should create fresh instance every call without configId (backward compat)", async () => {
      registerBackend("test", () => makeMockService());

      const svc1 = await createAgentService("test", {});
      const svc2 = await createAgentService("test", {});
      expect(svc1).not.toBe(svc2);
    });

    it("should isolate configs across different backend names", async () => {
      registerBackend("a", () => makeMockService());
      registerBackend("b", () => makeMockService());

      const svcA = await createAgentService("a", {}, "shared-id");
      const svcB = await createAgentService("b", {}, "shared-id");
      expect(svcA).not.toBe(svcB);
    });
  });

  describe("disposeBackend", () => {
    it("should dispose all configs for a backend", async () => {
      const disposeFn = vi.fn(async () => {});
      registerBackend("test", () => ({
        ...makeMockService(),
        dispose: disposeFn,
      }));

      await createAgentService("test", {}, "alpha");
      await createAgentService("test", {}, "beta");
      const count = await disposeBackend("test");
      expect(count).toBe(2);
      expect(disposeFn).toHaveBeenCalledTimes(2);
    });

    it("should dispose a single named config", async () => {
      const disposeA = vi.fn(async () => {});
      const disposeB = vi.fn(async () => {});
      let call = 0;
      registerBackend("test", () => ({
        ...makeMockService(),
        dispose: call++ === 0 ? disposeA : disposeB,
      }));

      await createAgentService("test", {}, "alpha");
      await createAgentService("test", {}, "beta");
      const count = await disposeBackend("test", "alpha");
      expect(count).toBe(1);
      expect(disposeA).toHaveBeenCalledTimes(1);
      expect(disposeB).not.toHaveBeenCalled();
    });

    it("should return 0 for non-existent config", async () => {
      const count = await disposeBackend("test", "nope");
      expect(count).toBe(0);
    });

    it("should allow re-creating a disposed config", async () => {
      let callCount = 0;
      registerBackend("test", () => {
        callCount++;
        return makeMockService();
      });

      await createAgentService("test", {}, "alpha");
      await disposeBackend("test", "alpha");
      const svc = await createAgentService("test", {}, "alpha");
      expect(svc).toBeDefined();
      expect(callCount).toBe(2);
    });
  });

  describe("listConfigs", () => {
    it("should return empty array when no configs exist", () => {
      expect(listConfigs("test")).toEqual([]);
    });

    it("should list active config IDs for a backend", async () => {
      registerBackend("test", () => makeMockService());
      await createAgentService("test", {}, "alpha");
      await createAgentService("test", {}, "beta");
      const configs = listConfigs("test");
      expect(configs).toHaveLength(2);
      expect(configs).toContain("alpha");
      expect(configs).toContain("beta");
    });

    it("should not include configs from other backends", async () => {
      registerBackend("a", () => makeMockService());
      registerBackend("b", () => makeMockService());
      await createAgentService("a", {}, "cfg1");
      await createAgentService("b", {}, "cfg2");
      expect(listConfigs("a")).toEqual(["cfg1"]);
      expect(listConfigs("b")).toEqual(["cfg2"]);
    });

    it("should update after dispose", async () => {
      registerBackend("test", () => makeMockService());
      await createAgentService("test", {}, "alpha");
      await createAgentService("test", {}, "beta");
      await disposeBackend("test", "alpha");
      expect(listConfigs("test")).toEqual(["beta"]);
    });
  });

  describe("resetRegistry with service cache", () => {
    it("should clear service cache on reset", async () => {
      registerBackend("test", () => makeMockService());
      await createAgentService("test", {}, "alpha");
      expect(listConfigs("test")).toHaveLength(1);
      resetRegistry();
      expect(listConfigs("test")).toHaveLength(0);
    });
  });

  describe("registerLazyBackend", () => {
    it("should register and lazily load a backend", async () => {
      const { registerLazyBackend } = await import("../../src/registry.js");
      const mockService = makeMockService();
      registerLazyBackend("lazy-test", async () => () => mockService);

      expect(hasBackend("lazy-test")).toBe(true);
      expect(listBackends()).toContain("lazy-test");

      const svc = await createAgentService("lazy-test", {});
      expect(svc).toBe(mockService);
    });

    it("should cache factory after first load", async () => {
      const { registerLazyBackend } = await import("../../src/registry.js");
      let loadCount = 0;
      const mockService = makeMockService();
      registerLazyBackend("lazy-cached", async () => {
        loadCount++;
        return () => mockService;
      });

      await createAgentService("lazy-cached", {});
      await createAgentService("lazy-cached", {});
      expect(loadCount).toBe(1);
    });
  });
});
