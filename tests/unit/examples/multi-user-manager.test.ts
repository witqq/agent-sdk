/**
 * Tests for MultiUserRuntimeManager.
 *
 * Verifies LRU cache eviction, concurrent access safety,
 * idle timeout disposal, and per-user isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IChatRuntime } from "../../../src/chat/runtime.js";
import {
  MultiUserRuntimeManager,
  type RuntimeFactory,
  type UserRuntimeConfig,
} from "../../../examples/multi-user-runtime/multi-user-manager.js";

// ─── Mock Runtime ──────────────────────────────────────────────

function createMockRuntime(userId?: string): IChatRuntime & { disposed: boolean; userId?: string } {
  const runtime = {
    disposed: false,
    userId,
    status: "idle" as const,
    dispose: vi.fn(async () => { runtime.disposed = true; }),
    send: vi.fn(),
    abort: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    listSessions: vi.fn(),
    deleteSession: vi.fn(),
    switchSession: vi.fn(),
    switchModel: vi.fn(),
    listModels: vi.fn(),
    listBackends: vi.fn(() => [{ name: "test" }]),
    registerTool: vi.fn(),
    removeTool: vi.fn(),
    use: vi.fn(),
    removeMiddleware: vi.fn(),
    onSessionChange: vi.fn(() => () => {}),
    getContextStats: vi.fn(),
    activeSessionId: null,
    currentModel: undefined,
  } as unknown as IChatRuntime & { disposed: boolean; userId?: string };
  return runtime;
}

function createFactory(): RuntimeFactory & { calls: Array<{ userId: string; config?: UserRuntimeConfig }>; runtimes: Map<string, IChatRuntime> } {
  const calls: Array<{ userId: string; config?: UserRuntimeConfig }> = [];
  const runtimes = new Map<string, IChatRuntime>();

  const factory = (async (userId: string, config?: UserRuntimeConfig) => {
    calls.push({ userId, config });
    const rt = createMockRuntime(userId);
    runtimes.set(userId, rt);
    return rt;
  }) as RuntimeFactory & { calls: Array<{ userId: string; config?: UserRuntimeConfig }>; runtimes: Map<string, IChatRuntime> };

  factory.calls = calls;
  factory.runtimes = runtimes;
  return factory;
}

// ─── Tests ─────────────────────────────────────────────────────

describe("MultiUserRuntimeManager", () => {
  let manager: MultiUserRuntimeManager;
  let factory: ReturnType<typeof createFactory>;

  beforeEach(() => {
    vi.useFakeTimers();
    factory = createFactory();
    manager = new MultiUserRuntimeManager({
      createRuntime: factory,
      maxUsers: 3,
    });
  });

  afterEach(async () => {
    if (!manager.isDisposed) await manager.dispose();
    vi.useRealTimers();
  });

  // ─── Basic Operations ────────────────────────────────────

  it("should create runtime on first access", async () => {
    const runtime = await manager.getRuntime("user-1");
    expect(runtime).toBeDefined();
    expect(factory.calls).toHaveLength(1);
    expect(factory.calls[0].userId).toBe("user-1");
    expect(manager.size).toBe(1);
  });

  it("should return cached runtime on subsequent access", async () => {
    const rt1 = await manager.getRuntime("user-1");
    const rt2 = await manager.getRuntime("user-1");
    expect(rt1).toBe(rt2);
    expect(factory.calls).toHaveLength(1);
  });

  it("should create separate runtimes per user", async () => {
    const rt1 = await manager.getRuntime("user-1");
    const rt2 = await manager.getRuntime("user-2");
    expect(rt1).not.toBe(rt2);
    expect(factory.calls).toHaveLength(2);
    expect(manager.size).toBe(2);
  });

  it("should pass config to factory", async () => {
    await manager.getRuntime("user-1", { apiKey: "sk-test", defaultModel: "gpt-4" });
    expect(factory.calls[0].config).toEqual({ apiKey: "sk-test", defaultModel: "gpt-4" });
  });

  it("should check user existence with has()", async () => {
    expect(manager.has("user-1")).toBe(false);
    await manager.getRuntime("user-1");
    expect(manager.has("user-1")).toBe(true);
  });

  // ─── LRU Eviction ───────────────────────────────────────

  it("should evict LRU when at capacity", async () => {
    await manager.getRuntime("user-1");
    await manager.getRuntime("user-2");
    await manager.getRuntime("user-3");
    expect(manager.size).toBe(3);

    // Adding 4th user should evict user-1 (LRU)
    await manager.getRuntime("user-4");
    expect(manager.size).toBe(3);
    expect(manager.has("user-1")).toBe(false);
    expect(manager.has("user-4")).toBe(true);

    const evicted = factory.runtimes.get("user-1") as IChatRuntime & { disposed: boolean };
    expect(evicted.disposed).toBe(true);
  });

  it("should promote accessed user in LRU order", async () => {
    await manager.getRuntime("user-1");
    await manager.getRuntime("user-2");
    await manager.getRuntime("user-3");

    // Access user-1 to promote it
    await manager.getRuntime("user-1");

    // Adding 4th should evict user-2 (now LRU), not user-1
    await manager.getRuntime("user-4");
    expect(manager.has("user-1")).toBe(true);
    expect(manager.has("user-2")).toBe(false);
  });

  it("should list active users in most-recently-used order", async () => {
    await manager.getRuntime("user-1");
    await manager.getRuntime("user-2");
    await manager.getRuntime("user-3");

    const users = manager.activeUsers();
    expect(users).toEqual(["user-3", "user-2", "user-1"]);

    // Access user-1 to promote
    await manager.getRuntime("user-1");
    const usersAfter = manager.activeUsers();
    expect(usersAfter[0]).toBe("user-1");
  });

  // ─── Explicit Eviction ──────────────────────────────────

  it("should evict a specific user", async () => {
    await manager.getRuntime("user-1");
    await manager.getRuntime("user-2");

    await manager.evict("user-1");
    expect(manager.has("user-1")).toBe(false);
    expect(manager.size).toBe(1);

    const evicted = factory.runtimes.get("user-1") as IChatRuntime & { disposed: boolean };
    expect(evicted.disposed).toBe(true);
  });

  it("should call onEvict callback on eviction", async () => {
    const onEvict = vi.fn();
    const m = new MultiUserRuntimeManager({ createRuntime: factory, maxUsers: 3, onEvict });

    await m.getRuntime("user-1");
    await m.evict("user-1");

    expect(onEvict).toHaveBeenCalledWith("user-1");
    await m.dispose();
  });

  it("should be no-op when evicting non-existent user", async () => {
    await expect(manager.evict("non-existent")).resolves.toBeUndefined();
  });

  // ─── Concurrent Access ──────────────────────────────────

  it("should share creation promise for concurrent getRuntime calls", async () => {
    const [rt1, rt2, rt3] = await Promise.all([
      manager.getRuntime("user-1"),
      manager.getRuntime("user-1"),
      manager.getRuntime("user-1"),
    ]);

    // All should be the same instance
    expect(rt1).toBe(rt2);
    expect(rt2).toBe(rt3);
    // Factory called only once
    expect(factory.calls).toHaveLength(1);
  });

  it("should handle concurrent access for different users", async () => {
    const [rt1, rt2] = await Promise.all([
      manager.getRuntime("user-1"),
      manager.getRuntime("user-2"),
    ]);

    expect(rt1).not.toBe(rt2);
    expect(factory.calls).toHaveLength(2);
  });

  // ─── Idle Timeout ───────────────────────────────────────

  it("should dispose runtime after idle timeout", async () => {
    const m = new MultiUserRuntimeManager({
      createRuntime: factory,
      maxUsers: 10,
      idleTimeoutMs: 5000,
    });

    await m.getRuntime("user-1");
    expect(m.has("user-1")).toBe(true);

    // Advance past idle timeout
    vi.advanceTimersByTime(5001);
    // Allow microtask (evict is async)
    await vi.runAllTimersAsync();

    expect(m.has("user-1")).toBe(false);
    const evicted = factory.runtimes.get("user-1") as IChatRuntime & { disposed: boolean };
    expect(evicted.disposed).toBe(true);

    await m.dispose();
  });

  it("should reset idle timer on access", async () => {
    const m = new MultiUserRuntimeManager({
      createRuntime: factory,
      maxUsers: 10,
      idleTimeoutMs: 5000,
    });

    await m.getRuntime("user-1");

    // Advance partway
    vi.advanceTimersByTime(3000);
    // Re-access to reset timer
    await m.getRuntime("user-1");
    // Advance past original timeout
    vi.advanceTimersByTime(3000);
    // Should still be cached (timer was reset)
    expect(m.has("user-1")).toBe(true);

    // Now advance past new timeout
    vi.advanceTimersByTime(2001);
    await vi.runAllTimersAsync();
    expect(m.has("user-1")).toBe(false);

    await m.dispose();
  });

  // ─── Disposal ───────────────────────────────────────────

  it("should dispose all runtimes on manager dispose", async () => {
    await manager.getRuntime("user-1");
    await manager.getRuntime("user-2");

    await manager.dispose();

    expect(manager.size).toBe(0);
    expect(manager.isDisposed).toBe(true);

    const rt1 = factory.runtimes.get("user-1") as IChatRuntime & { disposed: boolean };
    const rt2 = factory.runtimes.get("user-2") as IChatRuntime & { disposed: boolean };
    expect(rt1.disposed).toBe(true);
    expect(rt2.disposed).toBe(true);
  });

  it("should throw on getRuntime after dispose", async () => {
    await manager.dispose();
    await expect(manager.getRuntime("user-1")).rejects.toThrow("Manager is disposed");
  });

  it("should be idempotent on multiple dispose calls", async () => {
    await manager.dispose();
    await expect(manager.dispose()).resolves.toBeUndefined();
  });
});
