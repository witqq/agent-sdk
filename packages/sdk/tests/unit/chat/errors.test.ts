import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ChatError,
  ErrorCode,
  classifyError,
  ExponentialBackoffStrategy,
  withRetry,
  isRetryable,
} from "../../../src/chat/errors.js";
import { AgentSDKError } from "../../../src/errors.js";

// ─── ErrorCode Enum ────────────────────────────────────────────

describe("ErrorCode", () => {
  it("has all unified ErrorCode values (28 codes)", () => {
    const codes = Object.values(ErrorCode);
    expect(codes).toHaveLength(28);
    expect(codes).toContain("NETWORK");
    expect(codes).toContain("TIMEOUT");
    expect(codes).toContain("AUTH_EXPIRED");
    expect(codes).toContain("AUTH_INVALID");
    expect(codes).toContain("RATE_LIMIT");
    expect(codes).toContain("PROVIDER_ERROR");
    expect(codes).toContain("MODEL_NOT_FOUND");
    expect(codes).toContain("MODEL_OVERLOADED");
    expect(codes).toContain("CONTEXT_OVERFLOW");
    expect(codes).toContain("INVALID_INPUT");
    expect(codes).toContain("INVALID_RESPONSE");
    expect(codes).toContain("PERMISSION_DENIED");
    expect(codes).toContain("BACKEND_NOT_INSTALLED");
    expect(codes).toContain("SESSION_NOT_FOUND");
    expect(codes).toContain("STORAGE_ERROR");
    expect(codes).toContain("SESSION_EXPIRED");
    expect(codes).toContain("PROVIDER_NOT_FOUND");
    expect(codes).toContain("AUTH_REQUIRED");
    expect(codes).toContain("DISPOSED");
    expect(codes).toContain("ABORTED");
    expect(codes).toContain("INVALID_TRANSITION");
    expect(codes).toContain("REENTRANCY");
  });
});

// ─── ChatError ─────────────────────────────────────────────────

describe("ChatError", () => {
  it("extends AgentSDKError", () => {
    const err = new ChatError("test", { code: ErrorCode.NETWORK });
    expect(err).toBeInstanceOf(AgentSDKError);
    expect(err).toBeInstanceOf(Error);
  });

  it("sets code, retryable, and timestamp", () => {
    const err = new ChatError("msg", { code: ErrorCode.NETWORK, retryable: true });
    expect(err.code).toBe(ErrorCode.NETWORK);
    expect(err.retryable).toBe(true);
    expect(err.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(err.name).toBe("ChatError");
  });

  it("defaults retryable to false", () => {
    const err = new ChatError("msg", { code: ErrorCode.PROVIDER_ERROR });
    expect(err.retryable).toBe(false);
  });

  it("stores retryAfter in ms", () => {
    const err = new ChatError("slow", {
      code: ErrorCode.RATE_LIMIT,
      retryable: true,
      retryAfter: 60000,
    });
    expect(err.retryAfter).toBe(60000);
  });

  it("preserves cause", () => {
    const cause = new Error("original");
    const err = new ChatError("wrapped", { code: ErrorCode.NETWORK, cause });
    expect(err.cause).toBe(cause);
  });
});

// ─── classifyError ─────────────────────────────────────────────

describe("classifyError", () => {
  it("returns ChatError as-is", () => {
    const err = new ChatError("test", { code: ErrorCode.NETWORK, retryable: true });
    expect(classifyError(err)).toBe(err);
  });

  it("classifies ECONNREFUSED as NETWORK", () => {
    const err = classifyError(new Error("connect ECONNREFUSED 127.0.0.1:3000"));
    expect(err.code).toBe(ErrorCode.NETWORK);
    expect(err.retryable).toBe(true);
  });

  it("classifies ECONNRESET as NETWORK", () => {
    const err = classifyError(new Error("socket hang up ECONNRESET"));
    expect(err.code).toBe(ErrorCode.NETWORK);
  });

  it("classifies ETIMEDOUT as NETWORK", () => {
    const err = classifyError(new Error("connect ETIMEDOUT"));
    expect(err.code).toBe(ErrorCode.NETWORK);
  });

  it("classifies fetch failed as NETWORK", () => {
    const err = classifyError(new TypeError("fetch failed"));
    expect(err.code).toBe(ErrorCode.NETWORK);
  });

  it("classifies 'failed to fetch' as NETWORK", () => {
    const err = classifyError(new Error("Failed to fetch"));
    expect(err.code).toBe(ErrorCode.NETWORK);
  });

  it("classifies timeout messages as TIMEOUT", () => {
    const err = classifyError(new Error("Request timeout after 5000ms"));
    expect(err.code).toBe(ErrorCode.TIMEOUT);
    expect(err.retryable).toBe(true);
  });

  it("classifies 'timed out' as TIMEOUT", () => {
    const err = classifyError(new Error("Connection timed out"));
    expect(err.code).toBe(ErrorCode.TIMEOUT);
  });

  it("classifies 'deadline exceeded' as TIMEOUT", () => {
    const err = classifyError(new Error("deadline exceeded"));
    expect(err.code).toBe(ErrorCode.TIMEOUT);
  });

  it("classifies ZodError by name as INVALID_INPUT", () => {
    const zodErr = new Error("Validation failed");
    zodErr.name = "ZodError";
    (zodErr as any).issues = [
      { path: ["name"], message: "Required", code: "invalid_type" },
    ];
    const err = classifyError(zodErr);
    expect(err.code).toBe(ErrorCode.INVALID_INPUT);
    expect(err.retryable).toBe(false);
  });

  it("classifies ZodError by issues property as INVALID_INPUT", () => {
    const zodErr = new Error("Invalid");
    (zodErr as any).issues = [
      { path: ["age"], message: "Expected number", code: "invalid_type" },
    ];
    const err = classifyError(zodErr);
    expect(err.code).toBe(ErrorCode.INVALID_INPUT);
  });

  it("classifies HTTP 401 as AUTH_INVALID", () => {
    const httpErr = new Error("Unauthorized");
    (httpErr as any).status = 401;
    const err = classifyError(httpErr);
    expect(err.code).toBe(ErrorCode.AUTH_INVALID);
    expect(err.retryable).toBe(false);
  });

  it("classifies HTTP 403 as AUTH_INVALID", () => {
    const httpErr = new Error("Forbidden");
    (httpErr as any).statusCode = 403;
    const err = classifyError(httpErr);
    expect(err.code).toBe(ErrorCode.AUTH_INVALID);
  });

  it("classifies HTTP 429 as RATE_LIMIT with retryAfter in ms", () => {
    const httpErr = new Error("Too Many Requests");
    (httpErr as any).status = 429;
    (httpErr as any).retryAfter = 60;
    const err = classifyError(httpErr);
    expect(err.code).toBe(ErrorCode.RATE_LIMIT);
    expect(err.retryable).toBe(true);
    expect(err.retryAfter).toBe(60000);
  });

  it("classifies HTTP 500 as PROVIDER_ERROR", () => {
    const httpErr = new Error("Internal Server Error");
    (httpErr as any).status = 500;
    const err = classifyError(httpErr);
    expect(err.code).toBe(ErrorCode.PROVIDER_ERROR);
    expect(err.retryable).toBe(true);
  });

  it("classifies HTTP 503 as PROVIDER_ERROR", () => {
    const httpErr = new Error("Service Unavailable");
    (httpErr as any).status = 503;
    const err = classifyError(httpErr);
    expect(err.code).toBe(ErrorCode.PROVIDER_ERROR);
  });

  it("classifies HTTP 400 as INVALID_INPUT", () => {
    const httpErr = new Error("Bad Request");
    (httpErr as any).status = 400;
    const err = classifyError(httpErr);
    expect(err.code).toBe(ErrorCode.INVALID_INPUT);
  });

  it("extracts status code from message", () => {
    const err = classifyError(new Error("HTTP error 429: rate limited"));
    expect(err.code).toBe(ErrorCode.RATE_LIMIT);
  });

  it("classifies context overflow as CONTEXT_OVERFLOW", () => {
    const err = classifyError(
      new Error(
        "This model's maximum context length is 128000 tokens. You have 150000 tokens",
      ),
    );
    expect(err.code).toBe(ErrorCode.CONTEXT_OVERFLOW);
    expect(err.retryable).toBe(false);
  });

  it("classifies 'token limit' overflow as CONTEXT_OVERFLOW", () => {
    const err = classifyError(
      new Error("token limit exceeded"),
    );
    expect(err.code).toBe(ErrorCode.CONTEXT_OVERFLOW);
  });

  it("wraps unknown errors as PROVIDER_ERROR", () => {
    const err = classifyError(new Error("something weird happened"));
    expect(err).toBeInstanceOf(ChatError);
    expect(err.code).toBe(ErrorCode.PROVIDER_ERROR);
    expect(err.retryable).toBe(false);
  });

  it("handles non-Error values", () => {
    const err = classifyError("string error");
    expect(err).toBeInstanceOf(ChatError);
    expect(err.code).toBe(ErrorCode.PROVIDER_ERROR);
    expect(err.message).toBe("string error");
  });

  it("handles null/undefined", () => {
    expect(classifyError(null).code).toBe(ErrorCode.PROVIDER_ERROR);
    expect(classifyError(undefined).code).toBe(ErrorCode.PROVIDER_ERROR);
  });

  it("handles number thrown", () => {
    const err = classifyError(42);
    expect(err.message).toBe("42");
    expect(err.code).toBe(ErrorCode.PROVIDER_ERROR);
  });
});

// ─── ExponentialBackoffStrategy ────────────────────────────────

describe("ExponentialBackoffStrategy", () => {
  it("uses default options", () => {
    const strategy = new ExponentialBackoffStrategy();
    const err = new ChatError("test", { code: ErrorCode.NETWORK, retryable: true });
    const delay = strategy.nextDelay(0, err);
    expect(delay).toBeTypeOf("number");
    // base 1000 ± 10% jitter → 900..1100
    expect(delay!).toBeGreaterThanOrEqual(900);
    expect(delay!).toBeLessThanOrEqual(1100);
  });

  it("increases delay exponentially", () => {
    const strategy = new ExponentialBackoffStrategy({ jitter: 0 });
    const err = new ChatError("test", { code: ErrorCode.NETWORK, retryable: true });
    expect(strategy.nextDelay(0, err)).toBe(1000);
    expect(strategy.nextDelay(1, err)).toBe(2000);
    expect(strategy.nextDelay(2, err)).toBe(4000);
  });

  it("caps at maxMs", () => {
    const strategy = new ExponentialBackoffStrategy({
      baseMs: 1000,
      maxMs: 5000,
      maxAttempts: 10,
      jitter: 0,
    });
    const err = new ChatError("test", { code: ErrorCode.NETWORK, retryable: true });
    expect(strategy.nextDelay(5, err)).toBe(5000);
  });

  it("returns null when maxAttempts exceeded", () => {
    const strategy = new ExponentialBackoffStrategy({ maxAttempts: 2 });
    const err = new ChatError("test", { code: ErrorCode.NETWORK, retryable: true });
    expect(strategy.nextDelay(2, err)).toBeNull();
  });

  it("returns null for non-retryable errors", () => {
    const strategy = new ExponentialBackoffStrategy();
    const err = new ChatError("no", { code: ErrorCode.AUTH_INVALID, retryable: false });
    expect(strategy.nextDelay(0, err)).toBeNull();
  });

  it("uses retryAfter for RATE_LIMIT errors", () => {
    const strategy = new ExponentialBackoffStrategy({ jitter: 0 });
    const err = new ChatError("slow", {
      code: ErrorCode.RATE_LIMIT,
      retryable: true,
      retryAfter: 60000,
    });
    expect(strategy.nextDelay(0, err)).toBe(60000);
  });

  it("applies jitter within bounds", () => {
    const strategy = new ExponentialBackoffStrategy({
      baseMs: 1000,
      jitter: 0.5,
    });
    const err = new ChatError("test", { code: ErrorCode.NETWORK, retryable: true });
    const delays = Array.from({ length: 100 }, () =>
      strategy.nextDelay(0, err),
    );
    const min = Math.min(...(delays as number[]));
    const max = Math.max(...(delays as number[]));
    expect(min).toBeGreaterThanOrEqual(500);
    expect(max).toBeLessThanOrEqual(1500);
  });

  it("clamps jitter to 0-1", () => {
    const strategy = new ExponentialBackoffStrategy({ jitter: 5 });
    const err = new ChatError("test", { code: ErrorCode.NETWORK, retryable: true });
    const delay = strategy.nextDelay(0, err);
    // jitter clamped to 1.0, so delay in [0, 2000]
    expect(delay!).toBeGreaterThanOrEqual(0);
    expect(delay!).toBeLessThanOrEqual(2000);
  });
});

// ─── withRetry ─────────────────────────────────────────────────

describe("withRetry", () => {
  it("returns result on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, new ExponentialBackoffStrategy());
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("retries on retryable error", async () => {
    const networkErr = new ChatError("fail", { code: ErrorCode.NETWORK, retryable: true });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(networkErr)
      .mockResolvedValue("ok");

    const onRetry = vi.fn();
    const result = await withRetry(
      fn,
      new ExponentialBackoffStrategy({ baseMs: 1, jitter: 0, maxAttempts: 3 }),
      { onRetry },
    );

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledWith(expect.any(ChatError), 0, 1);
  });

  it("throws immediately on non-retryable error", async () => {
    const authErr = new ChatError("denied", { code: ErrorCode.AUTH_INVALID, retryable: false });
    const fn = vi.fn().mockRejectedValue(authErr);

    await expect(
      withRetry(
        fn,
        new ExponentialBackoffStrategy({ baseMs: 1, maxAttempts: 3 }),
      ),
    ).rejects.toThrow(ChatError);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("throws after max attempts", async () => {
    const networkErr = new ChatError("fail", { code: ErrorCode.NETWORK, retryable: true });
    const fn = vi.fn().mockRejectedValue(networkErr);

    await expect(
      withRetry(
        fn,
        new ExponentialBackoffStrategy({ baseMs: 1, jitter: 0, maxAttempts: 2 }),
      ),
    ).rejects.toThrow(ChatError);
    // 1 initial + 2 retries
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("classifies unknown errors before retry decision", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
      .mockResolvedValue("ok");

    const result = await withRetry(
      fn,
      new ExponentialBackoffStrategy({ baseMs: 1, jitter: 0 }),
    );
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("respects abort signal", async () => {
    const controller = new AbortController();
    const networkErr = new ChatError("fail", { code: ErrorCode.NETWORK, retryable: true });
    const fn = vi.fn().mockRejectedValue(networkErr);

    controller.abort();
    await expect(
      withRetry(
        fn,
        new ExponentialBackoffStrategy({ baseMs: 1, maxAttempts: 5 }),
        { signal: controller.signal },
      ),
    ).rejects.toThrow();
    // Only 1 call: fn fails, signal is checked before sleep
    expect(fn).toHaveBeenCalledOnce();
  });
});

// ─── isRetryable ───────────────────────────────────────────────

describe("isRetryable", () => {
  it("returns true for retryable ChatError", () => {
    expect(isRetryable(new ChatError("fail", { code: ErrorCode.NETWORK, retryable: true }))).toBe(true);
    expect(isRetryable(new ChatError("slow", { code: ErrorCode.RATE_LIMIT, retryable: true }))).toBe(true);
    expect(isRetryable(new ChatError("timeout", { code: ErrorCode.TIMEOUT, retryable: true }))).toBe(true);
    expect(isRetryable(new ChatError("500", { code: ErrorCode.PROVIDER_ERROR, retryable: true }))).toBe(true);
  });

  it("returns false for non-retryable ChatError", () => {
    expect(isRetryable(new ChatError("denied", { code: ErrorCode.AUTH_INVALID }))).toBe(false);
    expect(isRetryable(new ChatError("bad", { code: ErrorCode.INVALID_INPUT }))).toBe(false);
    expect(isRetryable(new ChatError("overflow", { code: ErrorCode.CONTEXT_OVERFLOW }))).toBe(false);
  });

  it("classifies unknown errors", () => {
    expect(isRetryable(new Error("connect ECONNREFUSED"))).toBe(true);
    expect(isRetryable(new Error("unknown problem"))).toBe(false);
  });
});
