// ─── Unified Error Code Enum ───────────────────────────────────

/** Unified error codes for all SDK errors — single source of truth. */
export enum ErrorCode {
  // Auth
  AUTH_EXPIRED = "AUTH_EXPIRED",
  AUTH_INVALID = "AUTH_INVALID",

  // Rate limiting
  RATE_LIMIT = "RATE_LIMIT",

  // Network
  NETWORK = "NETWORK",
  TIMEOUT = "TIMEOUT",

  // Provider
  PROVIDER_ERROR = "PROVIDER_ERROR",
  MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
  MODEL_OVERLOADED = "MODEL_OVERLOADED",
  CONTEXT_OVERFLOW = "CONTEXT_OVERFLOW",

  // Input / Response
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_RESPONSE = "INVALID_RESPONSE",

  // SDK internal
  REENTRANCY = "REENTRANCY",
  DISPOSED = "DISPOSED",
  ABORTED = "ABORTED",
  INVALID_TRANSITION = "INVALID_TRANSITION",
  DEPENDENCY_MISSING = "DEPENDENCY_MISSING",
  BACKEND_NOT_INSTALLED = "BACKEND_NOT_INSTALLED",

  // Tool
  TOOL_EXECUTION = "TOOL_EXECUTION",
  PERMISSION_DENIED = "PERMISSION_DENIED",

  // Session
  SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
  SESSION_EXPIRED = "SESSION_EXPIRED",

  // Provider resolution
  PROVIDER_NOT_FOUND = "PROVIDER_NOT_FOUND",
  AUTH_REQUIRED = "AUTH_REQUIRED",

  // Storage (generic)
  STORAGE_ERROR = "STORAGE_ERROR",
  // Storage (specific)
  STORAGE_NOT_FOUND = "STORAGE_NOT_FOUND",
  STORAGE_DUPLICATE_KEY = "STORAGE_DUPLICATE_KEY",
  STORAGE_IO_ERROR = "STORAGE_IO_ERROR",
  STORAGE_SERIALIZATION_ERROR = "STORAGE_SERIALIZATION_ERROR",
}

// ─── Classification ────────────────────────────────────────────

/** Error codes that are typically recoverable (retry-safe) */
const RECOVERABLE_CODES = new Set<ErrorCode>([
  ErrorCode.TIMEOUT,
  ErrorCode.RATE_LIMIT,
  ErrorCode.NETWORK,
  ErrorCode.TOOL_EXECUTION,
  ErrorCode.MODEL_OVERLOADED,
  ErrorCode.PROVIDER_ERROR,
]);

/** Check if an error code is recoverable */
export function isRecoverableErrorCode(code: ErrorCode): boolean {
  return RECOVERABLE_CODES.has(code);
}

/** Classify an error message string into an ErrorCode */
export function classifyAgentError(error: string | Error): ErrorCode {
  const msg = (error instanceof Error ? error.message : error).toLowerCase();

  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("timedout") || msg.includes("etimedout")) {
    return ErrorCode.TIMEOUT;
  }

  if (msg.includes("rate limit") || msg.includes("rate_limit") || msg.includes("429") || msg.includes("too many requests")) {
    return ErrorCode.RATE_LIMIT;
  }

  if (msg.includes("unauthorized") || msg.includes("401") || msg.includes("auth") && (msg.includes("expired") || msg.includes("invalid") || msg.includes("denied") || msg.includes("failed"))) {
    return ErrorCode.AUTH_EXPIRED;
  }

  if (msg.includes("econnrefused") || msg.includes("econnreset") || msg.includes("enotfound") || msg.includes("network") || msg.includes("fetch failed") || msg.includes("socket hang up")) {
    return ErrorCode.NETWORK;
  }

  if (msg.includes("subprocess") || msg.includes("process exited") || msg.includes("spawn") || msg.includes("enoent") || msg.includes("killed")) {
    return ErrorCode.DEPENDENCY_MISSING;
  }

  if (msg.includes("abort") || msg.includes("cancel")) {
    return ErrorCode.ABORTED;
  }

  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("internal server error") || msg.includes("service unavailable") || msg.includes("bad gateway") || msg.includes("overloaded")) {
    return ErrorCode.PROVIDER_ERROR;
  }

  return ErrorCode.PROVIDER_ERROR;
}
