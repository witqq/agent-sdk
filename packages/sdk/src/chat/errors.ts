/**
 * @witqq/agent-sdk/chat/errors
 *
 * Flat error taxonomy with unified ErrorCode enum, ChatError class,
 * pattern-matching classifier, retry strategies with exponential backoff.
 * Extends the existing AgentSDKError from @witqq/agent-sdk.
 */

import { AgentSDKError } from "../errors.js";
import { ErrorCode } from "../types/errors.js";

// ─── Re-export ErrorCode ───────────────────────────────────────

export { ErrorCode };

// ─── Error Options ─────────────────────────────────────────────

/** Options for constructing a ChatError */
export interface ChatErrorOptions {
  /** Machine-readable error code */
  code: ErrorCode;
  /** Whether this error is retryable (default: false) */
  retryable?: boolean;
  /** Retry delay hint in milliseconds */
  retryAfter?: number;
  /** Original cause, if wrapping another error */
  cause?: unknown;
}

// ─── Unified Error Class ───────────────────────────────────────

/** Unified error class for all chat SDK errors */
export class ChatError extends AgentSDKError {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly retryAfter?: number;
  readonly timestamp: string;

  constructor(message: string, options: ChatErrorOptions) {
    super(message, {
      cause: options.cause,
      code: options.code,
      retryable: options.retryable,
    });
    this.name = "ChatError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.retryAfter = options.retryAfter;
    this.timestamp = new Date().toISOString();
  }
}

// ─── Classification ────────────────────────────────────────────

/**
 * Classify an unknown thrown value into a ChatError with the appropriate code.
 * Pattern-matches against common error shapes:
 * - Already a ChatError → returned as-is
 * - Fetch/network errors (ECONNREFUSED, ETIMEDOUT, etc.)
 * - HTTP status codes (401→AUTH_INVALID, 429→RATE_LIMIT, 5xx→PROVIDER_ERROR)
 * - Timeout patterns
 * - Zod validation errors
 * - Context overflow patterns
 * - Unknown → wrapped as ChatError with PROVIDER_ERROR
 *
 * @param error - The thrown value to classify
 * @returns ChatError with appropriate error code and retryable flag
 */
export function classifyError(error: unknown): ChatError {
  if (error instanceof ChatError) {
    return error;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Network errors
    if (isNetworkError(msg)) {
      return new ChatError(error.message, {
        code: ErrorCode.NETWORK,
        retryable: true,
        cause: error,
      });
    }

    // Timeout errors
    if (isTimeoutPattern(msg)) {
      return new ChatError(error.message, {
        code: ErrorCode.TIMEOUT,
        retryable: true,
        cause: error,
      });
    }

    // Zod validation errors
    if (isZodError(error)) {
      return new ChatError(error.message, {
        code: ErrorCode.INVALID_INPUT,
        retryable: false,
        cause: error,
      });
    }

    // HTTP status code errors
    const statusCode = extractStatusCode(error);
    if (statusCode !== null) {
      return classifyByStatusCode(statusCode, error);
    }

    // Context overflow patterns
    if (isContextOverflow(msg)) {
      return new ChatError(error.message, {
        code: ErrorCode.CONTEXT_OVERFLOW,
        retryable: false,
        cause: error,
      });
    }
  }

  // Unknown errors
  const message =
    error instanceof Error ? error.message : String(error);
  return new ChatError(message, {
    code: ErrorCode.PROVIDER_ERROR,
    retryable: false,
    cause: error,
  });
}

// ─── Classification Helpers ────────────────────────────────────

const NETWORK_PATTERNS = [
  "econnrefused",
  "econnreset",
  "enotfound",
  "etimedout",
  "enetunreach",
  "epipe",
  "fetch failed",
  "network error",
  "network request failed",
  "failed to fetch",
  "dns lookup failed",
] as const;

function isNetworkError(msg: string): boolean {
  return NETWORK_PATTERNS.some((p) => msg.includes(p));
}

function isTimeoutPattern(msg: string): boolean {
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("deadline exceeded") ||
    msg.includes("aborted due to timeout")
  );
}

function isZodError(error: Error): boolean {
  return (
    error.name === "ZodError" ||
    ("issues" in error && Array.isArray((error as unknown as Record<string, unknown>).issues))
  );
}

function extractStatusCode(error: Error): number | null {
  const errRecord = error as unknown as Record<string, unknown>;
  if (typeof errRecord.status === "number") return errRecord.status;
  if (typeof errRecord.statusCode === "number") return errRecord.statusCode;

  // Check message for HTTP status codes
  const match = error.message.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

function classifyByStatusCode(status: number, error: Error): ChatError {
  if (status === 401 || status === 403) {
    return new ChatError(error.message, {
      code: ErrorCode.AUTH_INVALID,
      retryable: false,
      cause: error,
    });
  }
  if (status === 429) {
    const retryAfterSeconds = extractRetryAfter(error);
    return new ChatError(error.message, {
      code: ErrorCode.RATE_LIMIT,
      retryable: true,
      retryAfter: retryAfterSeconds != null ? retryAfterSeconds * 1000 : undefined,
      cause: error,
    });
  }
  if (status >= 500) {
    return new ChatError(error.message, {
      code: ErrorCode.PROVIDER_ERROR,
      retryable: true,
      cause: error,
    });
  }
  // 4xx other than auth/rate-limit → invalid input
  if (status >= 400 && status < 500) {
    return new ChatError(error.message, {
      code: ErrorCode.INVALID_INPUT,
      retryable: false,
      cause: error,
    });
  }
  return new ChatError(error.message, {
    code: ErrorCode.NETWORK,
    retryable: true,
    cause: error,
  });
}

function extractRetryAfter(error: Error): number | undefined {
  const errRecord = error as unknown as Record<string, unknown>;
  if (typeof errRecord.retryAfter === "number") return errRecord.retryAfter;
  const match = error.message.match(/retry.after[:\s]*(\d+)/i);
  return match ? parseInt(match[1], 10) : undefined;
}

function isContextOverflow(msg: string): boolean {
  return (
    msg.includes("context length exceeded") ||
    msg.includes("maximum context length") ||
    msg.includes("context window") ||
    msg.includes("token limit") ||
    msg.includes("too many tokens")
  );
}

// ─── Retry Strategy ────────────────────────────────────────────

/** Strategy for computing retry delays */
export interface RetryStrategy {
  /** Return delay in ms for the given attempt (0-based), or null to stop */
  nextDelay(attempt: number, error: ChatError): number | null;
}

/** Options for ExponentialBackoffStrategy */
export interface ExponentialBackoffOptions {
  /** Base delay in ms (default: 1000) */
  baseMs?: number;
  /** Maximum delay in ms (default: 30000) */
  maxMs?: number;
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Jitter factor 0–1 (default: 0.1) */
  jitter?: number;
}

/** Exponential backoff with optional jitter */
export class ExponentialBackoffStrategy implements RetryStrategy {
  private readonly baseMs: number;
  private readonly maxMs: number;
  private readonly maxAttempts: number;
  private readonly jitter: number;

  constructor(options?: ExponentialBackoffOptions) {
    this.baseMs = options?.baseMs ?? 1000;
    this.maxMs = options?.maxMs ?? 30000;
    this.maxAttempts = options?.maxAttempts ?? 3;
    this.jitter = Math.max(0, Math.min(1, options?.jitter ?? 0.1));
  }

  nextDelay(attempt: number, error: ChatError): number | null {
    if (attempt >= this.maxAttempts) return null;
    if (!error.retryable) return null;

    // Rate-limit errors with retryAfter (already in ms) take priority
    if (error.code === ErrorCode.RATE_LIMIT && error.retryAfter) {
      return error.retryAfter;
    }

    const delay = Math.min(this.baseMs * Math.pow(2, attempt), this.maxMs);
    const jitterAmount = delay * this.jitter * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(delay + jitterAmount));
  }
}

// ─── Retry Execution ───────────────────────────────────────────

/** Options for withRetry execution */
export interface RetryOptions {
  /** Abort signal to cancel retries */
  signal?: AbortSignal;
  /** Called before each retry with the error and delay */
  onRetry?: (error: ChatError, attempt: number, delayMs: number) => void;
}

/**
 * Execute an async function with automatic retries using the provided strategy.
 * Respects ChatError.retryable and ChatError.retryAfter.
 * Classifies non-ChatError errors before deciding on retry.
 *
 * @param fn - Async function to execute
 * @param strategy - Retry strategy providing delay calculations
 * @param options - Optional abort signal and retry callback
 * @returns Result of fn on success
 * @throws ChatError when all retries exhausted or error is non-retryable
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  strategy: RetryStrategy,
  options?: RetryOptions,
): Promise<T> {
  let attempt = 0;

  for (;;) {
    try {
      return await fn();
    } catch (raw) {
      const error = classifyError(raw);
      const delay = strategy.nextDelay(attempt, error);

      if (delay === null) {
        throw error;
      }

      if (options?.signal?.aborted) {
        throw error;
      }

      options?.onRetry?.(error, attempt, delay);

      await sleep(delay, options?.signal);
      attempt++;
    }
  }
}

/**
 * Type guard: check if an error is retryable
 * @param error - The error to check
 * @returns True if error is a retryable ChatError
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof ChatError) {
    return error.retryable;
  }
  const classified = classifyError(error);
  return classified.retryable;
}

// ─── Internal Helpers ──────────────────────────────────────────

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ChatError("Retry aborted", { code: ErrorCode.ABORTED }));
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new ChatError("Retry aborted", { code: ErrorCode.ABORTED }));
      },
      { once: true },
    );
  });
}
