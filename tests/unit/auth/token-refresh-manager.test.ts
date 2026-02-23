import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TokenRefreshManager } from "../../../src/auth/refresh-manager.js";
import type { AuthToken } from "../../../src/auth/types.js";

function makeToken(overrides: Partial<AuthToken> = {}): AuthToken {
  return {
    accessToken: "test-access-token",
    tokenType: "bearer",
    expiresIn: 3600, // 1 hour
    obtainedAt: Date.now(),
    ...overrides,
  };
}

describe("TokenRefreshManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should not schedule for tokens without expiresIn", () => {
    const refresh = vi.fn();
    const manager = new TokenRefreshManager({
      token: makeToken({ expiresIn: undefined }),
      refresh,
    });
    manager.start();
    vi.advanceTimersByTime(100_000);
    expect(refresh).not.toHaveBeenCalled();
    expect(manager.isRunning).toBe(true);
    manager.dispose();
  });

  it("should schedule refresh at threshold of token lifetime", async () => {
    const now = Date.now();
    const newToken = makeToken({ accessToken: "refreshed", obtainedAt: now + 2880_000 });
    const refresh = vi.fn().mockResolvedValue(newToken);
    const refreshedSpy = vi.fn();

    const manager = new TokenRefreshManager({
      token: makeToken({ expiresIn: 3600, obtainedAt: now }),
      refresh,
      refreshThreshold: 0.8, // refresh at 80% = 2880s = 2880000ms
    });
    manager.on("refreshed", refreshedSpy);
    manager.start();

    // Before threshold: no refresh
    vi.advanceTimersByTime(2_879_000);
    expect(refresh).not.toHaveBeenCalled();

    // At threshold (with minDelayMs padding): refresh should fire
    vi.advanceTimersByTime(2_000);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(refreshedSpy).toHaveBeenCalledWith(newToken);
    expect(manager.token.accessToken).toBe("refreshed");
    manager.dispose();
  });

  it("should emit expired for already-expired tokens when refresh fails", async () => {
    const expiredSpy = vi.fn();
    const refresh = vi.fn().mockRejectedValue(new Error("fail"));
    const manager = new TokenRefreshManager({
      token: makeToken({
        expiresIn: 3600,
        obtainedAt: Date.now() - 4_000_000, // expired 400s ago
      }),
      refresh,
      maxRetries: 1,
    });
    manager.on("expired", expiredSpy);
    manager.start();

    // Advance to trigger setTimeout(0) and let async refresh settle
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    expect(expiredSpy).toHaveBeenCalledTimes(1);
    expect(manager.isRunning).toBe(false);
    manager.dispose();
  });

  it("should retry on refresh failure with exponential backoff", async () => {
    const now = Date.now();
    const error = new Error("network failure");
    const refreshed = makeToken({ accessToken: "retry-success", obtainedAt: now });
    const refresh = vi.fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue(refreshed);
    const errorSpy = vi.fn();
    const refreshedSpy = vi.fn();

    const manager = new TokenRefreshManager({
      token: makeToken({
        expiresIn: 3600,
        obtainedAt: now - 3_000_000, // past threshold, needs immediate refresh
      }),
      refresh,
      maxRetries: 3,
      retryDelayMs: 100,
    });
    manager.on("error", errorSpy);
    manager.on("refreshed", refreshedSpy);
    manager.start();

    // First attempt via setTimeout(0)
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(error, 1);

    // Retry 1 after 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(error, 2);

    // Retry 2 after 200ms (exponential: 100 * 2^1)
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(3);

    expect(refreshedSpy).toHaveBeenCalledWith(refreshed);
    manager.dispose();
  });

  it("should emit expired after all retries exhausted when token is expired", async () => {
    const now = Date.now();
    const error = new Error("always fails");
    const refresh = vi.fn().mockRejectedValue(error);
    const expiredSpy = vi.fn();
    const errorSpy = vi.fn();

    const manager = new TokenRefreshManager({
      token: makeToken({
        expiresIn: 10, // 10 seconds
        obtainedAt: now - 15_000, // already expired
      }),
      refresh,
      maxRetries: 2,
      retryDelayMs: 50,
    });
    manager.on("expired", expiredSpy);
    manager.on("error", errorSpy);
    manager.start();

    // First attempt via setTimeout(0)
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(error, 1);

    // Retry after 50ms
    await vi.advanceTimersByTimeAsync(50);
    expect(refresh).toHaveBeenCalledTimes(2);

    expect(expiredSpy).toHaveBeenCalledTimes(1);
    expect(manager.isRunning).toBe(false);
    manager.dispose();
  });

  it("should stop cleanly and not fire after stop()", () => {
    const refresh = vi.fn();
    const manager = new TokenRefreshManager({
      token: makeToken({ expiresIn: 100, obtainedAt: Date.now() }),
      refresh,
    });
    manager.start();
    expect(manager.isRunning).toBe(true);

    manager.stop();
    expect(manager.isRunning).toBe(false);

    vi.advanceTimersByTime(200_000);
    expect(refresh).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("should restart after stop()/start() cycle", async () => {
    const now = Date.now();
    const newToken = makeToken({ accessToken: "new", obtainedAt: now });
    const refresh = vi.fn().mockResolvedValue(newToken);

    const manager = new TokenRefreshManager({
      token: makeToken({
        expiresIn: 100,
        obtainedAt: now - 85_000, // past 80% threshold
      }),
      refresh,
    });

    manager.start();
    manager.stop();
    manager.start();

    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    manager.dispose();
  });

  it("should update token and reschedule", async () => {
    const now = Date.now();
    const refresh = vi.fn().mockResolvedValue(makeToken({ accessToken: "auto-refreshed" }));

    const manager = new TokenRefreshManager({
      token: makeToken({ expiresIn: 3600, obtainedAt: now }),
      refresh,
      refreshThreshold: 0.8,
    });
    manager.start();

    // Update with a fresh token
    const freshToken = makeToken({ expiresIn: 7200, obtainedAt: now, accessToken: "manual-refresh" });
    manager.updateToken(freshToken);

    expect(manager.token.accessToken).toBe("manual-refresh");

    // Old schedule should be cancelled; new one at 80% of 7200s = 5760s
    vi.advanceTimersByTime(3_000_000); // 3000s — before new threshold
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3_000_000); // 6000s total — past threshold
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    manager.dispose();
  });

  it("should dispose and clear all listeners", () => {
    const disposedSpy = vi.fn();
    const refreshedSpy = vi.fn();
    const manager = new TokenRefreshManager({
      token: makeToken(),
      refresh: vi.fn(),
    });
    manager.on("disposed", disposedSpy);
    manager.on("refreshed", refreshedSpy);
    manager.start();
    manager.dispose();

    expect(disposedSpy).toHaveBeenCalledTimes(1);
    expect(manager.isDisposed).toBe(true);
    expect(manager.isRunning).toBe(false);
  });

  it("should not crash on listener errors", async () => {
    const now = Date.now();
    const refresh = vi.fn().mockResolvedValue(makeToken({ obtainedAt: now }));

    const manager = new TokenRefreshManager({
      token: makeToken({
        expiresIn: 100,
        obtainedAt: now - 85_000,
      }),
      refresh,
    });

    manager.on("refreshed", () => {
      throw new Error("listener explosion");
    });

    manager.start();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    // Manager should still be running despite listener error
    expect(manager.isRunning).toBe(true);
    manager.dispose();
  });

  it("should ignore start() when disposed", () => {
    const manager = new TokenRefreshManager({
      token: makeToken(),
      refresh: vi.fn(),
    });
    manager.dispose();
    manager.start();
    expect(manager.isRunning).toBe(false);
  });

  it("should ignore duplicate start() calls", () => {
    const manager = new TokenRefreshManager({
      token: makeToken(),
      refresh: vi.fn(),
    });
    manager.start();
    manager.start(); // second call should be no-op
    expect(manager.isRunning).toBe(true);
    manager.dispose();
  });

  it("should support off() to remove listeners", () => {
    const spy = vi.fn();
    const manager = new TokenRefreshManager({
      token: makeToken({ expiresIn: 10, obtainedAt: Date.now() - 20_000 }),
      refresh: vi.fn(),
    });
    manager.on("expired", spy);
    manager.off("expired", spy);
    manager.start();

    expect(spy).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("should handle non-Error refresh rejections", async () => {
    const now = Date.now();
    const refresh = vi.fn().mockRejectedValue("string error");
    const errorSpy = vi.fn();

    const manager = new TokenRefreshManager({
      token: makeToken({
        expiresIn: 100,
        obtainedAt: now - 85_000,
      }),
      refresh,
      maxRetries: 1,
    });
    manager.on("error", errorSpy);
    manager.start();

    await vi.advanceTimersByTimeAsync(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const [err] = errorSpy.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("string error");
    manager.dispose();
  });

  it("should reschedule after retries exhausted when token not yet expired", async () => {
    const now = Date.now();
    const refresh = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))  // attempt 1
      .mockRejectedValueOnce(new Error("fail"))  // attempt 2 (maxRetries)
      .mockResolvedValue(makeToken({ accessToken: "recovered", obtainedAt: now }));
    const refreshedSpy = vi.fn();
    const errorSpy = vi.fn();

    const manager = new TokenRefreshManager({
      token: makeToken({
        expiresIn: 300, // 5 min — NOT expired
        obtainedAt: now - 250_000, // past 80% threshold (threshold at 240s)
      }),
      refresh,
      maxRetries: 2,
      retryDelayMs: 50,
      minDelayMs: 100,
    });
    manager.on("refreshed", refreshedSpy);
    manager.on("error", errorSpy);
    manager.start();

    // First attempt via setTimeout(0)
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    // Retry after 50ms
    await vi.advanceTimersByTimeAsync(50);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(2);

    // Retries exhausted, token not expired — waits until expiry (300s - 250s = 50s = 50000ms)
    // minDelayMs is 100, and remaining time is 50000ms, so waits 50000ms
    await vi.advanceTimersByTimeAsync(50_000);
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(refreshedSpy).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "recovered" }));
    manager.dispose();
  });

  it("should ignore updateToken() when disposed", () => {
    const manager = new TokenRefreshManager({
      token: makeToken({ accessToken: "original" }),
      refresh: vi.fn(),
    });
    manager.dispose();
    manager.updateToken(makeToken({ accessToken: "updated" }));
    expect(manager.token.accessToken).toBe("original");
  });

  it("should return a defensive copy from token getter", () => {
    const manager = new TokenRefreshManager({
      token: makeToken({ accessToken: "immutable" }),
      refresh: vi.fn(),
    });
    const copy = manager.token;
    copy.accessToken = "mutated";
    expect(manager.token.accessToken).toBe("immutable");
    manager.dispose();
  });

  it("should not call refresh after dispose during async refresh", async () => {
    const now = Date.now();
    let resolveRefresh: (t: AuthToken) => void;
    const refresh = vi.fn().mockImplementation(() => new Promise<AuthToken>((r) => {
      resolveRefresh = r;
    }));
    const refreshedSpy = vi.fn();

    const manager = new TokenRefreshManager({
      token: makeToken({
        expiresIn: 100,
        obtainedAt: now - 85_000,
      }),
      refresh,
    });
    manager.on("refreshed", refreshedSpy);
    manager.start();

    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    // Dispose while refresh is in-flight
    manager.dispose();

    // Resolve the pending refresh
    resolveRefresh!(makeToken({ accessToken: "late" }));
    await Promise.resolve();

    // Should NOT emit refreshed since disposed
    expect(refreshedSpy).not.toHaveBeenCalled();
  });
});
