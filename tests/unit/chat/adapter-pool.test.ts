import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdapterPool } from "../../../src/chat/server/adapter-pool.js";
import type { PooledAdapter } from "../../../src/chat/server/adapter-pool.js";

function createMockAdapter(): PooledAdapter & { disposed: boolean } {
  return {
    disposed: false,
    dispose: vi.fn(async function (this: { disposed: boolean }) {
      this.disposed = true;
    }),
  };
}

describe("AdapterPool", () => {
  let pool: AdapterPool;
  let factoryFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    factoryFn = vi.fn(async () => createMockAdapter());
    pool = new AdapterPool({ factory: factoryFn });
  });

  describe("getAdapter", () => {
    it("creates adapter via factory on first call", async () => {
      const adapter = await pool.getAdapter("copilot");
      expect(adapter).toBeDefined();
      expect(factoryFn).toHaveBeenCalledWith("copilot");
      expect(factoryFn).toHaveBeenCalledTimes(1);
    });

    it("returns cached adapter on subsequent calls", async () => {
      const a1 = await pool.getAdapter("copilot");
      const a2 = await pool.getAdapter("copilot");
      expect(a1).toBe(a2);
      expect(factoryFn).toHaveBeenCalledTimes(1);
    });

    it("creates separate adapters per backend", async () => {
      const a1 = await pool.getAdapter("copilot");
      const a2 = await pool.getAdapter("claude");
      expect(a1).not.toBe(a2);
      expect(factoryFn).toHaveBeenCalledTimes(2);
      expect(factoryFn).toHaveBeenCalledWith("copilot");
      expect(factoryFn).toHaveBeenCalledWith("claude");
    });

    it("deduplicates concurrent creation for same backend", async () => {
      const [a1, a2, a3] = await Promise.all([
        pool.getAdapter("copilot"),
        pool.getAdapter("copilot"),
        pool.getAdapter("copilot"),
      ]);
      expect(a1).toBe(a2);
      expect(a2).toBe(a3);
      expect(factoryFn).toHaveBeenCalledTimes(1);
    });

    it("does not cache failed creations", async () => {
      let callCount = 0;
      const flaky = new AdapterPool({
        factory: async () => {
          callCount++;
          if (callCount === 1) throw new Error("factory failed");
          return createMockAdapter();
        },
      });

      await expect(flaky.getAdapter("copilot")).rejects.toThrow("factory failed");
      // Second call should retry
      const adapter = await flaky.getAdapter("copilot");
      expect(adapter).toBeDefined();
    });

    it("allows concurrent calls to different backends", async () => {
      const [a1, a2] = await Promise.all([
        pool.getAdapter("copilot"),
        pool.getAdapter("claude"),
      ]);
      expect(a1).not.toBe(a2);
      expect(factoryFn).toHaveBeenCalledTimes(2);
    });

    it("throws if pool is disposed", async () => {
      await pool.dispose();
      await expect(pool.getAdapter("copilot")).rejects.toThrow("disposed");
    });
  });

  describe("evict", () => {
    it("disposes and removes cached adapter", async () => {
      const adapter = await pool.getAdapter("copilot") as ReturnType<typeof createMockAdapter>;
      expect(pool.has("copilot")).toBe(true);

      await pool.evict("copilot");
      expect(pool.has("copilot")).toBe(false);
      expect(adapter.dispose).toHaveBeenCalled();
    });

    it("re-creates adapter after eviction", async () => {
      const a1 = await pool.getAdapter("copilot");
      await pool.evict("copilot");
      const a2 = await pool.getAdapter("copilot");

      expect(a1).not.toBe(a2);
      expect(factoryFn).toHaveBeenCalledTimes(2);
    });

    it("is a no-op for non-cached backends", async () => {
      await expect(pool.evict("nonexistent")).resolves.toBeUndefined();
    });

    it("handles dispose errors gracefully", async () => {
      const errorAdapter: PooledAdapter = {
        dispose: vi.fn(async () => { throw new Error("dispose failed"); }),
      };
      const errorPool = new AdapterPool({
        factory: async () => errorAdapter,
      });
      await errorPool.getAdapter("copilot");
      // Should not throw
      await expect(errorPool.evict("copilot")).resolves.toBeUndefined();
      expect(errorPool.has("copilot")).toBe(false);
    });
  });

  describe("has", () => {
    it("returns false before creation", () => {
      expect(pool.has("copilot")).toBe(false);
    });

    it("returns true after creation", async () => {
      await pool.getAdapter("copilot");
      expect(pool.has("copilot")).toBe(true);
    });

    it("returns false after eviction", async () => {
      await pool.getAdapter("copilot");
      await pool.evict("copilot");
      expect(pool.has("copilot")).toBe(false);
    });
  });

  describe("activeBackends", () => {
    it("starts empty", () => {
      expect(pool.activeBackends).toEqual([]);
    });

    it("lists cached backends", async () => {
      await pool.getAdapter("copilot");
      await pool.getAdapter("claude");
      expect(pool.activeBackends).toContain("copilot");
      expect(pool.activeBackends).toContain("claude");
    });

    it("excludes evicted backends", async () => {
      await pool.getAdapter("copilot");
      await pool.getAdapter("claude");
      await pool.evict("copilot");
      expect(pool.activeBackends).toEqual(["claude"]);
    });
  });

  describe("dispose", () => {
    it("disposes all cached adapters", async () => {
      const a1 = await pool.getAdapter("copilot") as ReturnType<typeof createMockAdapter>;
      const a2 = await pool.getAdapter("claude") as ReturnType<typeof createMockAdapter>;

      await pool.dispose();

      expect(a1.dispose).toHaveBeenCalled();
      expect(a2.dispose).toHaveBeenCalled();
      expect(pool.activeBackends).toEqual([]);
    });

    it("prevents new adapter creation after dispose", async () => {
      await pool.dispose();
      await expect(pool.getAdapter("copilot")).rejects.toThrow("disposed");
    });
  });
});
