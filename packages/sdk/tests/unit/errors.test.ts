import { describe, it, expect } from "vitest";
import {
  AgentSDKError,
  ReentrancyError,
  DisposedError,
  BackendNotFoundError,
  BackendAlreadyRegisteredError,
  SubprocessError,
  DependencyError,
  AbortError,
  ToolExecutionError,
  StructuredOutputError,
} from "../../src/errors.js";

describe("Error Classes", () => {
  it("AgentSDKError has correct name and message", () => {
    const err = new AgentSDKError("something broke");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AgentSDKError");
    expect(err.message).toBe("something broke");
  });

  it("AgentSDKError supports cause chaining", () => {
    const cause = new Error("root cause");
    const err = new AgentSDKError("wrapper", { cause });
    expect(err.cause).toBe(cause);
  });

  it("ReentrancyError extends AgentSDKError", () => {
    const err = new ReentrancyError();
    expect(err).toBeInstanceOf(AgentSDKError);
    expect(err.name).toBe("ReentrancyError");
    expect(err.message).toContain("already running");
  });

  it("DisposedError includes entity name", () => {
    const err = new DisposedError("CopilotService");
    expect(err).toBeInstanceOf(AgentSDKError);
    expect(err.name).toBe("DisposedError");
    expect(err.message).toContain("CopilotService");
    expect(err.message).toContain("disposed");
  });

  it("BackendNotFoundError includes backend name and hints", () => {
    const err = new BackendNotFoundError("my-custom");
    expect(err).toBeInstanceOf(AgentSDKError);
    expect(err.name).toBe("BackendNotFoundError");
    expect(err.message).toContain("my-custom");
    expect(err.message).toContain("registerBackend");
  });

  it("BackendAlreadyRegisteredError includes backend name", () => {
    const err = new BackendAlreadyRegisteredError("copilot");
    expect(err).toBeInstanceOf(AgentSDKError);
    expect(err.name).toBe("BackendAlreadyRegisteredError");
    expect(err.message).toContain("copilot");
  });

  it("SubprocessError supports cause chaining", () => {
    const cause = new Error("ENOENT");
    const err = new SubprocessError("spawn failed", { cause });
    expect(err).toBeInstanceOf(AgentSDKError);
    expect(err.name).toBe("SubprocessError");
    expect(err.cause).toBe(cause);
  });

  it("DependencyError includes package name", () => {
    const err = new DependencyError("ai");
    expect(err).toBeInstanceOf(AgentSDKError);
    expect(err.name).toBe("DependencyError");
    expect(err.packageName).toBe("ai");
    expect(err.message).toContain("ai");
    expect(err.message).toContain("npm install");
  });

  it("AbortError has fixed message", () => {
    const err = new AbortError();
    expect(err).toBeInstanceOf(AgentSDKError);
    expect(err.name).toBe("AbortError");
    expect(err.message).toContain("aborted");
  });

  it("ToolExecutionError includes toolName", () => {
    const err = new ToolExecutionError("web_search", "timeout after 30s");
    expect(err).toBeInstanceOf(AgentSDKError);
    expect(err.name).toBe("ToolExecutionError");
    expect(err.toolName).toBe("web_search");
    expect(err.message).toContain("web_search");
    expect(err.message).toContain("timeout after 30s");
  });

  it("ToolExecutionError supports cause chaining", () => {
    const cause = new TypeError("invalid input");
    const err = new ToolExecutionError("parser", "parse error", { cause });
    expect(err.cause).toBe(cause);
    expect(err.toolName).toBe("parser");
  });

  it("StructuredOutputError includes context", () => {
    const err = new StructuredOutputError("schema validation failed");
    expect(err).toBeInstanceOf(AgentSDKError);
    expect(err.name).toBe("StructuredOutputError");
    expect(err.message).toContain("schema validation failed");
  });

  it("all error classes share AgentSDKError as base", () => {
    const errors = [
      new ReentrancyError(),
      new DisposedError("test"),
      new BackendNotFoundError("test"),
      new BackendAlreadyRegisteredError("test"),
      new SubprocessError("test"),
      new DependencyError("test-pkg"),
      new AbortError(),
      new ToolExecutionError("t", "m"),
      new StructuredOutputError("m"),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(AgentSDKError);
      expect(err).toBeInstanceOf(Error);
    }
  });

  describe("AgentSDKError.is()", () => {
    it("returns true for AgentSDKError instances", () => {
      expect(AgentSDKError.is(new AgentSDKError("test"))).toBe(true);
    });

    it("returns true for subclass instances", () => {
      expect(AgentSDKError.is(new ReentrancyError())).toBe(true);
      expect(AgentSDKError.is(new DisposedError("x"))).toBe(true);
      expect(AgentSDKError.is(new AbortError())).toBe(true);
      expect(AgentSDKError.is(new ToolExecutionError("t", "m"))).toBe(true);
    });

    it("returns false for plain Error", () => {
      expect(AgentSDKError.is(new Error("test"))).toBe(false);
    });

    it("returns false for non-error values", () => {
      expect(AgentSDKError.is(null)).toBe(false);
      expect(AgentSDKError.is(undefined)).toBe(false);
      expect(AgentSDKError.is("string")).toBe(false);
      expect(AgentSDKError.is(42)).toBe(false);
      expect(AgentSDKError.is({})).toBe(false);
    });

    it("returns false for Error with _agentSDKError set to non-true", () => {
      const fake = new Error("fake");
      (fake as unknown as Record<string, unknown>)._agentSDKError = "yes";
      expect(AgentSDKError.is(fake)).toBe(false);
    });
  });
});
