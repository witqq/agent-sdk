import { describe, it, expect, vi, beforeEach } from "vitest";
import { ServiceManager } from "../../../src/chat/server/service-manager.js";
import type { ManagedService } from "../../../src/chat/server/service-manager.js";
import type { AuthToken } from "../../../src/auth/types.js";

function mockToken(backend = "copilot"): AuthToken {
  return {
    accessToken: `token-${backend}`,
    tokenType: "bearer",
    obtainedAt: Date.now(),
  };
}

function mockRefreshableToken(backend = "claude"): AuthToken {
  return {
    accessToken: `token-${backend}`,
    tokenType: "bearer",
    obtainedAt: Date.now(),
    expiresIn: 3600, // 1 hour
  };
}

function mockService(): ManagedService {
  return { dispose: vi.fn().mockResolvedValue(undefined) };
}

describe("ServiceManager", () => {
  let createService: ReturnType<typeof vi.fn>;
  let sm: ServiceManager;

  beforeEach(() => {
    createService = vi.fn().mockImplementation(() => mockService());
    sm = new ServiceManager({ createService });
  });

  it("creates and caches service on handleAuth", async () => {
    const token = mockToken();
    const service = await sm.handleAuth("copilot", token);
    expect(createService).toHaveBeenCalledWith("copilot", token);
    expect(sm.getService("copilot")).toBe(service);
    expect(sm.hasService("copilot")).toBe(true);
  });

  it("disposes old service on re-auth", async () => {
    const oldService = mockService();
    createService.mockResolvedValueOnce(oldService);
    await sm.handleAuth("copilot", mockToken());

    const newService = mockService();
    createService.mockResolvedValueOnce(newService);
    await sm.handleAuth("copilot", mockToken());

    expect(oldService.dispose).toHaveBeenCalledOnce();
    expect(sm.getService("copilot")).toBe(newService);
  });

  it("handles multiple backends independently", async () => {
    await sm.handleAuth("copilot", mockToken("copilot"));
    await sm.handleAuth("claude", mockToken("claude"));

    expect(sm.hasService("copilot")).toBe(true);
    expect(sm.hasService("claude")).toBe(true);
    expect(sm.activeBackends).toEqual(["copilot", "claude"]);
  });

  it("disposes all services on handleLogout", async () => {
    const s1 = mockService();
    const s2 = mockService();
    createService.mockResolvedValueOnce(s1).mockResolvedValueOnce(s2);

    await sm.handleAuth("copilot", mockToken("copilot"));
    await sm.handleAuth("claude", mockToken("claude"));
    await sm.handleLogout();

    expect(s1.dispose).toHaveBeenCalledOnce();
    expect(s2.dispose).toHaveBeenCalledOnce();
    expect(sm.hasService("copilot")).toBe(false);
    expect(sm.hasService("claude")).toBe(false);
    expect(sm.activeBackends).toEqual([]);
  });

  it("returns undefined for unknown backend", () => {
    expect(sm.getService("unknown")).toBeUndefined();
    expect(sm.hasService("unknown")).toBe(false);
  });

  it("swallows dispose errors on re-auth", async () => {
    const broken = { dispose: vi.fn().mockRejectedValue(new Error("fail")) };
    createService.mockResolvedValueOnce(broken);
    await sm.handleAuth("copilot", mockToken());

    // Should not throw
    await sm.handleAuth("copilot", mockToken());
    expect(broken.dispose).toHaveBeenCalled();
  });

  it("swallows dispose errors on logout", async () => {
    const broken = { dispose: vi.fn().mockRejectedValue(new Error("fail")) };
    createService.mockResolvedValueOnce(broken);
    await sm.handleAuth("copilot", mockToken());

    // Should not throw
    await sm.handleLogout();
    expect(broken.dispose).toHaveBeenCalled();
  });

  // ── Token Refresh Integration ──────────────────────────────

  describe("token refresh integration", () => {
    it("starts refresh manager for token with expiresIn", async () => {
      const refreshFn = vi.fn();
      sm = new ServiceManager({
        createService,
        refreshFactory: () => refreshFn,
      });

      const token = mockRefreshableToken();
      await sm.handleAuth("claude", token);

      const manager = sm.getRefreshManager("claude");
      expect(manager).toBeDefined();
      expect(manager!.isRunning).toBe(true);
    });

    it("does not start refresh for long-lived token (no expiresIn)", async () => {
      const refreshFn = vi.fn();
      sm = new ServiceManager({
        createService,
        refreshFactory: () => refreshFn,
      });

      await sm.handleAuth("copilot", mockToken()); // no expiresIn
      expect(sm.getRefreshManager("copilot")).toBeUndefined();
    });

    it("does not start refresh when refreshFactory returns undefined", async () => {
      sm = new ServiceManager({
        createService,
        refreshFactory: () => undefined,
      });

      await sm.handleAuth("claude", mockRefreshableToken());
      expect(sm.getRefreshManager("claude")).toBeUndefined();
    });

    it("stops old refresh manager on re-auth", async () => {
      const refreshFn = vi.fn();
      sm = new ServiceManager({
        createService,
        refreshFactory: () => refreshFn,
      });

      await sm.handleAuth("claude", mockRefreshableToken());
      const oldManager = sm.getRefreshManager("claude")!;
      expect(oldManager.isRunning).toBe(true);

      await sm.handleAuth("claude", mockRefreshableToken());
      expect(oldManager.isDisposed).toBe(true);

      const newManager = sm.getRefreshManager("claude")!;
      expect(newManager).not.toBe(oldManager);
      expect(newManager.isRunning).toBe(true);
    });

    it("stops all refresh managers on handleLogout", async () => {
      const refreshFn = vi.fn();
      sm = new ServiceManager({
        createService,
        refreshFactory: () => refreshFn,
      });

      await sm.handleAuth("claude", mockRefreshableToken("claude"));
      const manager = sm.getRefreshManager("claude")!;

      await sm.handleLogout();
      expect(manager.isDisposed).toBe(true);
      expect(sm.getRefreshManager("claude")).toBeUndefined();
    });

    it("stops all refresh managers on dispose", async () => {
      const refreshFn = vi.fn();
      sm = new ServiceManager({
        createService,
        refreshFactory: () => refreshFn,
      });

      await sm.handleAuth("claude", mockRefreshableToken());
      const manager = sm.getRefreshManager("claude")!;

      await sm.dispose();
      expect(manager.isDisposed).toBe(true);
    });

    it("recreates service on token refresh", async () => {
      vi.useFakeTimers();
      try {
        const newToken: AuthToken = {
          accessToken: "refreshed-token",
          tokenType: "bearer",
          obtainedAt: Date.now(),
          expiresIn: 3600,
        };
        const refreshFn = vi.fn().mockResolvedValue(newToken);
        sm = new ServiceManager({
          createService,
          refreshFactory: () => refreshFn,
        });

        // Token that expires very soon to trigger refresh quickly
        const token: AuthToken = {
          accessToken: "old-token",
          tokenType: "bearer",
          obtainedAt: Date.now() - 3500_000, // nearly expired (3500 of 3600 seconds elapsed)
          expiresIn: 3600,
        };
        await sm.handleAuth("claude", token);

        // Advance timers to trigger refresh
        await vi.advanceTimersByTimeAsync(2000);

        expect(refreshFn).toHaveBeenCalled();
        // createService called: once for initial auth, once for refresh
        expect(createService).toHaveBeenCalledTimes(2);
        expect(createService).toHaveBeenLastCalledWith("claude", newToken);
      } finally {
        vi.useRealTimers();
      }
    });

    it("calls onTokenExpired and removes service on expiry", async () => {
      vi.useFakeTimers();
      try {
        const onTokenExpired = vi.fn();
        const refreshFn = vi.fn().mockRejectedValue(new Error("fail"));
        sm = new ServiceManager({
          createService,
          refreshFactory: () => refreshFn,
          refreshOptions: { maxRetries: 1, retryDelayMs: 100 },
          onTokenExpired,
        });

        // Token that's already expired
        const token: AuthToken = {
          accessToken: "expired-token",
          tokenType: "bearer",
          obtainedAt: Date.now() - 7200_000, // 2 hours ago
          expiresIn: 3600, // lifetime was 1 hour
        };
        await sm.handleAuth("claude", token);

        // Advance to trigger refresh attempt + failure
        await vi.advanceTimersByTimeAsync(5000);

        expect(onTokenExpired).toHaveBeenCalledWith("claude");
        expect(sm.hasService("claude")).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("passes refreshFactory the backend name", async () => {
      const factory = vi.fn().mockReturnValue(vi.fn());
      sm = new ServiceManager({ createService, refreshFactory: factory });

      await sm.handleAuth("claude", mockRefreshableToken());
      expect(factory).toHaveBeenCalledWith("claude");
    });
  });
});
