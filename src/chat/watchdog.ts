/**
 * @witqq/agent-sdk - Stream Watchdog
 *
 * Activity-based timeout wrapper for async event streams.
 * Aborts the stream if no events arrive within a configurable inactivity window.
 * Timer resets on each received event.
 */

import { ChatError, ChatErrorCode } from "./errors.js";

// ─── Configuration ─────────────────────────────────────────────

/** Stream watchdog configuration */
export interface StreamWatchdogConfig {
  /** Maximum inactivity time in milliseconds before aborting the stream */
  timeoutMs: number;
  /** AbortSignal to link with (watchdog aborts when this signal fires) */
  signal?: AbortSignal;
}

// ─── Watchdog Implementation ───────────────────────────────────

/**
 * Wraps an async iterable with an activity timeout.
 * If no event arrives within `timeoutMs`, the stream is aborted with a ChatError.
 * The timer resets after each received event.
 *
 * Uses Promise.race() so even if the source iterator is stuck on an
 * unresolvable promise, the timeout fires and aborts iteration.
 *
 * @example
 * ```ts
 * const watched = withStreamWatchdog(adapter.streamMessage(session, msg), {
 *   timeoutMs: 30000,
 *   signal: abortController.signal,
 * });
 *
 * for await (const event of watched) {
 *   // Each event resets the 30s inactivity timer
 * }
 * ```
 */
export async function* withStreamWatchdog<T>(
  source: AsyncIterable<T>,
  config: StreamWatchdogConfig,
): AsyncGenerator<T> {
  const { timeoutMs, signal } = config;

  const iterator = source[Symbol.asyncIterator]();
  let aborted = false;

  // Link external abort signal
  if (signal?.aborted) {
    iterator.return?.();
    return;
  }

  const onAbort = (): void => {
    aborted = true;
    iterator.return?.();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      if (aborted) break;

      // Race iterator.next() against a cancellable inactivity timeout.
      // The timeout is cleared when iterator.next() wins, preventing
      // unhandled promise rejections from orphaned setTimeout callbacks.
      const timeout = new CancellableTimeout<T>(timeoutMs);
      try {
        const result = await Promise.race([
          iterator.next(),
          timeout.promise,
        ]);
        timeout.cancel();

        if (result.done) break;
        yield result.value;
      } catch (err) {
        timeout.cancel();
        throw err;
      }
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    iterator.return?.();
  }
}

/** Timeout that can be cancelled to prevent unhandled rejections */
class CancellableTimeout<T> {
  readonly promise: Promise<IteratorResult<T>>;
  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _cancelled = false;

  constructor(ms: number) {
    this.promise = new Promise<IteratorResult<T>>((_, reject) => {
      this._timer = setTimeout(() => {
        if (!this._cancelled) {
          reject(
            new ChatError(
              `Stream timed out after ${ms}ms of inactivity`,
              { code: ChatErrorCode.TIMEOUT },
            ),
          );
        }
      }, ms);
    });
    // Prevent unhandled rejection when cancelled
    this.promise.catch(() => {});
  }

  cancel(): void {
    this._cancelled = true;
    if (this._timer !== undefined) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }
}
