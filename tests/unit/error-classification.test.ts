import { describe, it, expect } from "vitest";
import {
  ErrorCode,
  classifyAgentError,
  isRecoverableErrorCode,
} from "../../src/types.js";
import {
  AgentSDKError,
  ReentrancyError,
  DependencyError,
  ToolExecutionError,
} from "../../src/errors.js";

describe("ErrorCode", () => {
  describe("classifyAgentError", () => {
    it("classifies timeout errors", () => {
      expect(classifyAgentError("Request timeout")).toBe(ErrorCode.TIMEOUT);
      expect(classifyAgentError("Connection timed out")).toBe(ErrorCode.TIMEOUT);
      expect(classifyAgentError("ETIMEDOUT")).toBe(ErrorCode.TIMEOUT);
    });

    it("classifies rate limit errors", () => {
      expect(classifyAgentError("Rate limit exceeded")).toBe(ErrorCode.RATE_LIMIT);
      expect(classifyAgentError("429 Too Many Requests")).toBe(ErrorCode.RATE_LIMIT);
      expect(classifyAgentError("rate_limit_exceeded")).toBe(ErrorCode.RATE_LIMIT);
      expect(classifyAgentError("Too many requests")).toBe(ErrorCode.RATE_LIMIT);
    });

    it("classifies auth errors", () => {
      expect(classifyAgentError("401 Unauthorized")).toBe(ErrorCode.AUTH_EXPIRED);
      expect(classifyAgentError("Authentication expired")).toBe(ErrorCode.AUTH_EXPIRED);
      expect(classifyAgentError("Auth failed")).toBe(ErrorCode.AUTH_EXPIRED);
      expect(classifyAgentError("Auth invalid token")).toBe(ErrorCode.AUTH_EXPIRED);
    });

    it("classifies network errors", () => {
      expect(classifyAgentError("ECONNREFUSED")).toBe(ErrorCode.NETWORK);
      expect(classifyAgentError("ECONNRESET")).toBe(ErrorCode.NETWORK);
      expect(classifyAgentError("ENOTFOUND")).toBe(ErrorCode.NETWORK);
      expect(classifyAgentError("fetch failed")).toBe(ErrorCode.NETWORK);
      expect(classifyAgentError("socket hang up")).toBe(ErrorCode.NETWORK);
    });

    it("classifies subprocess errors", () => {
      expect(classifyAgentError("subprocess exited with code 1")).toBe(ErrorCode.DEPENDENCY_MISSING);
      expect(classifyAgentError("process exited unexpectedly")).toBe(ErrorCode.DEPENDENCY_MISSING);
      expect(classifyAgentError("spawn ENOENT")).toBe(ErrorCode.DEPENDENCY_MISSING);
      expect(classifyAgentError("process killed")).toBe(ErrorCode.DEPENDENCY_MISSING);
    });

    it("classifies abort errors", () => {
      expect(classifyAgentError("operation aborted")).toBe(ErrorCode.ABORTED);
      expect(classifyAgentError("Request cancelled")).toBe(ErrorCode.ABORTED);
    });

    it("classifies provider errors", () => {
      expect(classifyAgentError("500 Internal Server Error")).toBe(ErrorCode.PROVIDER_ERROR);
      expect(classifyAgentError("502 Bad Gateway")).toBe(ErrorCode.PROVIDER_ERROR);
      expect(classifyAgentError("503 Service Unavailable")).toBe(ErrorCode.PROVIDER_ERROR);
      expect(classifyAgentError("Model overloaded")).toBe(ErrorCode.PROVIDER_ERROR);
    });

    it("returns PROVIDER_ERROR for unrecognized errors", () => {
      expect(classifyAgentError("Something went wrong")).toBe(ErrorCode.PROVIDER_ERROR);
      expect(classifyAgentError("unexpected token")).toBe(ErrorCode.PROVIDER_ERROR);
    });

    it("accepts Error objects", () => {
      expect(classifyAgentError(new Error("Request timeout"))).toBe(ErrorCode.TIMEOUT);
      expect(classifyAgentError(new Error("ECONNREFUSED"))).toBe(ErrorCode.NETWORK);
    });

    it("is case insensitive", () => {
      expect(classifyAgentError("TIMEOUT")).toBe(ErrorCode.TIMEOUT);
      expect(classifyAgentError("Timeout")).toBe(ErrorCode.TIMEOUT);
      expect(classifyAgentError("econnrefused")).toBe(ErrorCode.NETWORK);
    });
  });

  describe("isRecoverableErrorCode", () => {
    it("marks timeout as recoverable", () => {
      expect(isRecoverableErrorCode(ErrorCode.TIMEOUT)).toBe(true);
    });

    it("marks rate limit as recoverable", () => {
      expect(isRecoverableErrorCode(ErrorCode.RATE_LIMIT)).toBe(true);
    });

    it("marks network as recoverable", () => {
      expect(isRecoverableErrorCode(ErrorCode.NETWORK)).toBe(true);
    });

    it("marks tool error as recoverable", () => {
      expect(isRecoverableErrorCode(ErrorCode.TOOL_EXECUTION)).toBe(true);
    });

    it("marks auth expired as not recoverable", () => {
      expect(isRecoverableErrorCode(ErrorCode.AUTH_EXPIRED)).toBe(false);
    });

    it("marks subprocess as not recoverable", () => {
      expect(isRecoverableErrorCode(ErrorCode.DEPENDENCY_MISSING)).toBe(false);
    });

    it("marks aborted as not recoverable", () => {
      expect(isRecoverableErrorCode(ErrorCode.ABORTED)).toBe(false);
    });

    it("marks provider error as recoverable", () => {
      expect(isRecoverableErrorCode(ErrorCode.PROVIDER_ERROR)).toBe(true);
    });

    it("marks invalid input as not recoverable", () => {
      expect(isRecoverableErrorCode(ErrorCode.INVALID_INPUT)).toBe(false);
    });
  });
});

// ─── AgentSDKError structured fields ───────────────────────────

describe("AgentSDKError structured fields", () => {
  it("carries code, retryable, and httpStatus", () => {
    const err = new AgentSDKError("test", {
      code: ErrorCode.NETWORK,
      retryable: true,
      httpStatus: 503,
    });
    expect(err.code).toBe("NETWORK");
    expect(err.retryable).toBe(true);
    expect(err.httpStatus).toBe(503);
  });

  it("defaults retryable to false", () => {
    const err = new AgentSDKError("test");
    expect(err.retryable).toBe(false);
    expect(err.code).toBeUndefined();
    expect(err.httpStatus).toBeUndefined();
  });

  it("preserves cause via ErrorOptions", () => {
    const cause = new Error("root cause");
    const err = new AgentSDKError("wrapped", { code: ErrorCode.PROVIDER_ERROR, cause });
    expect(err.cause).toBe(cause);
    expect(err.code).toBe("PROVIDER_ERROR");
  });
});

// ─── Error subclass ErrorCode tagging ──────────────────────────

describe("Error subclass ErrorCode tagging", () => {
  it("ReentrancyError has REENTRANCY code", () => {
    const err = new ReentrancyError();
    expect(err.code).toBe(ErrorCode.REENTRANCY);
    expect(err.name).toBe("ReentrancyError");
  });

  it("DependencyError has DEPENDENCY_MISSING code", () => {
    const err = new DependencyError("@some/package", "some-package");
    expect(err.code).toBe(ErrorCode.DEPENDENCY_MISSING);
    expect(err.name).toBe("DependencyError");
  });

  it("ToolExecutionError has TOOL_EXECUTION code", () => {
    const err = new ToolExecutionError("failed", "my-tool");
    expect(err.code).toBe(ErrorCode.TOOL_EXECUTION);
    expect(err.name).toBe("ToolExecutionError");
  });
});
