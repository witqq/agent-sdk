import { ErrorCode } from "./types/errors.js";

/** Options for constructing an AgentSDKError */
export interface AgentSDKErrorOptions extends ErrorOptions {
  /** Machine-readable error code */
  code?: string;
  /** Whether this error is retryable (default: false) */
  retryable?: boolean;
  /** HTTP status code hint (e.g. 401, 429, 500) */
  httpStatus?: number;
}

/** Base error class for agent-sdk.
 *
 * Use `AgentSDKError.is(err)` for reliable cross-module `instanceof` checks
 * (works across separately bundled entry points where `instanceof` may fail). */
export class AgentSDKError extends Error {
  /** @internal Marker for cross-bundle identity checks */
  readonly _agentSDKError = true as const;
  /** Machine-readable error code. Prefer values from the ErrorCode enum. */
  readonly code?: string;
  /** Whether this error is safe to retry */
  readonly retryable: boolean;
  /** HTTP status code hint for error classification */
  readonly httpStatus?: number;

  constructor(message: string, options?: AgentSDKErrorOptions) {
    super(message, options);
    this.name = "AgentSDKError";
    this.code = options?.code;
    this.retryable = options?.retryable ?? false;
    this.httpStatus = options?.httpStatus;
  }

  /** Check if an error is an AgentSDKError (works across bundled copies) */
  static is(error: unknown): error is AgentSDKError {
    return (
      error instanceof Error &&
      "_agentSDKError" in error &&
      (error as AgentSDKError)._agentSDKError === true
    );
  }
}

/** Thrown when agent.run() is called while already running (M8 re-entrancy guard) */
export class ReentrancyError extends AgentSDKError {
  constructor() {
    super("Agent is already running. Await the current run before starting another.", {
      code: ErrorCode.REENTRANCY,
    });
    this.name = "ReentrancyError";
  }
}

/** Thrown when an operation is attempted on a disposed agent/service */
export class DisposedError extends AgentSDKError {
  constructor(entity: string) {
    super(`${entity} has been disposed and cannot be used.`, {
      code: ErrorCode.DISPOSED,
    });
    this.name = "DisposedError";
  }
}

/** Thrown when a backend is not found in the registry */
export class BackendNotFoundError extends AgentSDKError {
  constructor(backend: string) {
    super(
      `Unknown backend: "${backend}". ` +
      `Built-in: copilot, claude, vercel-ai. ` +
      `Custom: use registerBackend() first.`,
      { code: ErrorCode.BACKEND_NOT_INSTALLED },
    );
    this.name = "BackendNotFoundError";
  }
}

/** Thrown when a backend is already registered */
export class BackendAlreadyRegisteredError extends AgentSDKError {
  constructor(backend: string) {
    super(`Backend "${backend}" is already registered. Use a different name or unregister first.`);
    this.name = "BackendAlreadyRegisteredError";
  }
}

/** Thrown when subprocess management fails */
export class SubprocessError extends AgentSDKError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, { ...options, code: ErrorCode.DEPENDENCY_MISSING });
    this.name = "SubprocessError";
  }
}

/** Thrown when a required peer dependency is not installed */
export class DependencyError extends AgentSDKError {
  public readonly packageName: string;

  constructor(packageName: string) {
    super(`${packageName} is not installed. Install it: npm install ${packageName}`, {
      code: ErrorCode.DEPENDENCY_MISSING,
    });
    this.name = "DependencyError";
    this.packageName = packageName;
  }
}

/** Thrown when an agent run is aborted */
export class AbortError extends AgentSDKError {
  constructor() {
    super("Agent run was aborted.", { code: ErrorCode.ABORTED });
    this.name = "AbortError";
  }
}

/** Thrown when a tool execution fails */
export class ToolExecutionError extends AgentSDKError {
  public readonly toolName: string;

  constructor(toolName: string, message: string, options?: ErrorOptions) {
    super(`Tool "${toolName}" failed: ${message}`, { ...options, code: ErrorCode.TOOL_EXECUTION });
    this.name = "ToolExecutionError";
    this.toolName = toolName;
  }
}

/** Thrown when a stream has no activity within the configured timeout */
export class ActivityTimeoutError extends AgentSDKError {
  constructor(timeoutMs: number) {
    super(`Stream activity timeout: no event received within ${timeoutMs}ms.`, {
      code: ErrorCode.TIMEOUT,
      retryable: true,
    });
    this.name = "ActivityTimeoutError";
  }
}

/** Thrown when structured output parsing fails */
export class StructuredOutputError extends AgentSDKError {
  constructor(message: string, options?: ErrorOptions) {
    super(`Structured output error: ${message}`, { ...options, code: ErrorCode.INVALID_RESPONSE });
    this.name = "StructuredOutputError";
  }
}
