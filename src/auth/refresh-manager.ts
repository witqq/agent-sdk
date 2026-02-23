/**
 * Automatic background token refresh manager.
 *
 * Schedules token refresh at a configurable threshold before expiry
 * (default 80% of token lifetime). Emits events on refresh, failure,
 * and token expiry. Handles retry on failure and clean disposal.
 *
 * When all retries are exhausted but the token hasn't expired yet,
 * the manager waits until the token's expiry time and then starts
 * a fresh retry cycle. This continues until refresh succeeds or
 * the token expires.
 *
 * @example Basic usage
 * ```ts
 * import { TokenRefreshManager } from "@witqq/agent-sdk/auth";
 *
 * const manager = new TokenRefreshManager({
 *   token: claudeToken,
 *   refresh: (rt) => claudeAuth.refreshToken(rt),
 * });
 * manager.on("refreshed", (newToken) => { tokenStore.save("claude", newToken); });
 * manager.on("error", (err) => { console.error("Refresh failed:", err); });
 * manager.start();
 * // ...later
 * manager.dispose();
 * ```
 *
 * @example Integration with createAuthHandler
 * ```ts
 * import { TokenRefreshManager } from "@witqq/agent-sdk/auth";
 * import { createAuthHandler } from "@witqq/agent-sdk/chat/server";
 * import type { ClaudeAuthToken } from "@witqq/agent-sdk/auth";
 *
 * let refreshManager: TokenRefreshManager | undefined;
 *
 * const authHandler = createAuthHandler({
 *   tokenStore,
 *   onAuth: (provider, token) => {
 *     // Clean up previous manager
 *     refreshManager?.dispose();
 *     refreshManager = undefined;
 *
 *     if (provider === "claude" && token.expiresIn) {
 *       refreshManager = new TokenRefreshManager({
 *         token,
 *         refresh: (t) =>
 *           claudeAuth.refreshToken((t as ClaudeAuthToken).refreshToken),
 *       });
 *       refreshManager.on("refreshed", (newToken) => {
 *         tokenStore.save("claude", newToken);
 *       });
 *       refreshManager.on("expired", () => {
 *         console.warn("Claude token expired — re-authentication required");
 *       });
 *       refreshManager.start();
 *     }
 *   },
 * });
 * ```
 */

import type { AuthToken } from "./types.js";

// ─── Types ─────────────────────────────────────────────────────

/** Events emitted by TokenRefreshManager */
export interface TokenRefreshEvents {
  /** Emitted when token was successfully refreshed */
  refreshed: (token: AuthToken) => void;
  /** Emitted when refresh attempt failed (may retry) */
  error: (error: Error, attempt: number) => void;
  /** Emitted when token expired and could not be refreshed */
  expired: () => void;
  /** Emitted when manager is disposed */
  disposed: () => void;
}

/** Configuration for TokenRefreshManager */
export interface TokenRefreshOptions {
  /** Current token with expiresIn and obtainedAt */
  token: AuthToken;
  /**
   * Function that performs the actual token refresh.
   * Receives the current token and returns a new one.
   */
  refresh: (token: AuthToken) => Promise<AuthToken>;
  /**
   * Fraction of token lifetime at which to trigger refresh (0-1).
   * Default: 0.8 (refresh at 80% of lifetime, i.e. with 20% remaining)
   */
  refreshThreshold?: number;
  /**
   * Maximum retry attempts on refresh failure. Default: 3
   */
  maxRetries?: number;
  /**
   * Base delay between retries in ms. Exponential backoff applied. Default: 1000
   */
  retryDelayMs?: number;
  /**
   * Minimum schedule delay in ms (prevents scheduling in the past). Default: 1000
   */
  minDelayMs?: number;
}

type EventName = keyof TokenRefreshEvents;
type ListenerMap = { [K in EventName]: Set<TokenRefreshEvents[K]> };

// ─── Manager ───────────────────────────────────────────────────

/**
 * Background token refresh manager with event emission and retry logic.
 *
 * Lifecycle: `new` → `start()` → (auto-refreshes) → `stop()` or `dispose()`
 */
export class TokenRefreshManager {
  private currentToken: AuthToken;
  private readonly refreshFn: (token: AuthToken) => Promise<AuthToken>;
  private readonly threshold: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly minDelayMs: number;

  private timerId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private disposed = false;

  private readonly listeners: ListenerMap = {
    refreshed: new Set(),
    error: new Set(),
    expired: new Set(),
    disposed: new Set(),
  };

  constructor(options: TokenRefreshOptions) {
    this.currentToken = { ...options.token };
    this.refreshFn = options.refresh;
    this.threshold = options.refreshThreshold ?? 0.8;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.minDelayMs = options.minDelayMs ?? 1000;
  }

  /** Register an event listener */
  on<K extends EventName>(event: K, listener: TokenRefreshEvents[K]): this {
    // TypeScript can't narrow Set type from generic key — safe because ListenerMap enforces per-event types
    this.listeners[event].add(listener as never);
    return this;
  }

  /** Remove an event listener */
  off<K extends EventName>(event: K, listener: TokenRefreshEvents[K]): this {
    // TypeScript can't narrow Set type from generic key — safe because ListenerMap enforces per-event types
    this.listeners[event].delete(listener as never);
    return this;
  }

  /** Current token managed by this instance */
  get token(): AuthToken {
    return { ...this.currentToken };
  }

  /** Whether the manager is currently running */
  get isRunning(): boolean {
    return this.running;
  }

  /** Whether the manager has been disposed */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Start automatic refresh scheduling.
   * If the token is already expired, emits "expired" immediately.
   * If the token has no expiresIn, does nothing (long-lived token).
   */
  start(): void {
    if (this.disposed) return;
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  /** Stop automatic refresh (can be restarted with start()) */
  stop(): void {
    this.running = false;
    this.clearTimer();
  }

  /**
   * Update the managed token (e.g. after manual refresh).
   * Reschedules automatic refresh if running.
   */
  updateToken(token: AuthToken): void {
    if (this.disposed) return;
    this.currentToken = { ...token };
    if (this.running) {
      this.clearTimer();
      this.schedule();
    }
  }

  /** Stop and clean up all resources */
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.emit("disposed");
    // Clear all listeners
    for (const set of Object.values(this.listeners)) {
      (set as Set<unknown>).clear();
    }
  }

  // ─── Private ──────────────────────────────────────────────────

  private schedule(): void {
    if (!this.running || this.disposed) return;

    const delayMs = this.computeRefreshDelay();

    if (delayMs === null) {
      // No expiresIn → long-lived token, nothing to schedule
      return;
    }

    if (delayMs <= 0) {
      // Past refresh point (or expired) — attempt refresh via timer to keep async chain clean
      this.timerId = setTimeout(() => {
        this.timerId = null;
        if (!this.running || this.disposed) return;
        void this.performRefresh();
      }, 0);
      return;
    }

    this.timerId = setTimeout(() => {
      this.timerId = null;
      if (!this.running || this.disposed) return;
      void this.performRefresh();
    }, Math.max(delayMs, this.minDelayMs));
  }

  private async performRefresh(attempt = 1): Promise<void> {
    if (!this.running || this.disposed) return;

    try {
      const newToken = await this.refreshFn(this.currentToken);
      if (!this.running || this.disposed) return;
      this.currentToken = { ...newToken };
      this.emit("refreshed", newToken);
      this.schedule();
    } catch (err) {
      if (!this.running || this.disposed) return;
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit("error", error, attempt);

      if (attempt < this.maxRetries) {
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        this.timerId = setTimeout(() => {
          this.timerId = null;
          if (!this.running || this.disposed) return;
          void this.performRefresh(attempt + 1);
        }, delay);
      } else {
        // All retries exhausted
        if (this.isTokenExpired()) {
          this.running = false;
          this.emit("expired");
        } else {
          // Token not yet expired — wait until expiry time and start fresh retry cycle
          const expiresIn = this.currentToken.expiresIn;
          if (expiresIn == null) return; // invariant: unreachable from schedule() which checks expiresIn
          const expiresAt = this.currentToken.obtainedAt + expiresIn * 1000;
          const waitMs = Math.max(expiresAt - Date.now(), this.minDelayMs);
          this.timerId = setTimeout(() => {
            this.timerId = null;
            if (!this.running || this.disposed) return;
            void this.performRefresh();
          }, waitMs);
        }
      }
    }
  }

  private computeRefreshDelay(): number | null {
    if (this.currentToken.expiresIn == null) return null;

    const lifetimeMs = this.currentToken.expiresIn * 1000;
    const refreshAtMs = this.currentToken.obtainedAt + lifetimeMs * this.threshold;
    const now = Date.now();
    const delay = refreshAtMs - now;

    // Return raw delay — caller decides whether to clamp or treat as immediate
    return delay;
  }

  private isTokenExpired(): boolean {
    if (this.currentToken.expiresIn == null) return false;
    const expiresAt = this.currentToken.obtainedAt + this.currentToken.expiresIn * 1000;
    return Date.now() >= expiresAt;
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private emit<K extends EventName>(event: K, ...args: Parameters<TokenRefreshEvents[K]>): void {
    for (const listener of this.listeners[event]) {
      try {
        (listener as (...a: unknown[]) => void)(...args);
      } catch {
        // Listener errors should not crash the manager
      }
    }
  }
}
