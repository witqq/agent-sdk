/**
 * Multi-User Runtime Manager
 *
 * Manages per-user IChatRuntime instances with LRU cache eviction and
 * idle disposal. Supports bring-your-own-key patterns where each user
 * provides their own API credentials.
 *
 * @example
 * ```typescript
 * import { MultiUserRuntimeManager } from "./multi-user-manager";
 * import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
 * import { InMemorySessionStore } from "@witqq/agent-sdk/chat/sessions";
 *
 * const manager = new MultiUserRuntimeManager({
 *   maxUsers: 100,
 *   idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
 *   createRuntime: async (userId, config) => {
 *     return createChatRuntime({
 *       defaultBackend: "vercel-ai",
 *       backends: {
 *         "vercel-ai": () => createVercelAdapter({ apiKey: config?.apiKey }),
 *       },
 *       sessionStore: new InMemorySessionStore(),
 *     });
 *   },
 * });
 *
 * // Get or create runtime for user
 * const runtime = await manager.getRuntime("user-123");
 * ```
 */

import type { IChatRuntime } from "@witqq/agent-sdk/chat/runtime";

// ─── Types ─────────────────────────────────────────────────────

/** Per-user configuration (e.g., API keys, model preferences) */
export interface UserRuntimeConfig {
  apiKey?: string;
  defaultModel?: string;
  defaultBackend?: string;
  [key: string]: unknown;
}

/** Factory function that creates a runtime for a specific user */
export type RuntimeFactory = (
  userId: string,
  config?: UserRuntimeConfig,
) => IChatRuntime | Promise<IChatRuntime>;

/** Manager configuration */
export interface MultiUserManagerOptions {
  /** Factory function to create per-user runtimes */
  createRuntime: RuntimeFactory;
  /** Maximum number of cached runtimes (LRU eviction). Default: 100 */
  maxUsers?: number;
  /** Dispose runtime after idle period (ms). 0 = no timeout. Default: 0 */
  idleTimeoutMs?: number;
  /** Called when a user runtime is evicted or disposed */
  onEvict?: (userId: string) => void;
}

/** Internal entry tracking a cached runtime */
interface CacheEntry {
  runtime: IChatRuntime;
  lastAccess: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

// ─── Manager ───────────────────────────────────────────────────

/**
 * Manages per-user IChatRuntime instances with LRU eviction and
 * optional idle timeout disposal.
 *
 * Thread-safe for concurrent access: concurrent `getRuntime()` calls
 * for the same userId share a single creation promise.
 */
export class MultiUserRuntimeManager {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<IChatRuntime>>();
  private readonly options: Required<Pick<MultiUserManagerOptions, "maxUsers" | "idleTimeoutMs">> & MultiUserManagerOptions;
  private disposed = false;

  constructor(options: MultiUserManagerOptions) {
    this.options = {
      ...options,
      maxUsers: options.maxUsers ?? 100,
      idleTimeoutMs: options.idleTimeoutMs ?? 0,
    };
  }

  /** Number of active cached runtimes */
  get size(): number {
    return this.cache.size;
  }

  /** Whether the manager has been disposed */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Get or create runtime for a user. Concurrent calls for the same
   * userId share a single creation promise.
   */
  async getRuntime(userId: string, config?: UserRuntimeConfig): Promise<IChatRuntime> {
    if (this.disposed) throw new Error("Manager is disposed");

    // Check cache (and promote in LRU order)
    const existing = this.cache.get(userId);
    if (existing) {
      this.touch(userId, existing);
      return existing.runtime;
    }

    // Check pending creation
    const pendingPromise = this.pending.get(userId);
    if (pendingPromise) return pendingPromise;

    // Create new runtime
    const createPromise = this.createAndCache(userId, config);
    this.pending.set(userId, createPromise);

    try {
      const runtime = await createPromise;
      return runtime;
    } finally {
      this.pending.delete(userId);
    }
  }

  /** Check if a runtime is cached for a user */
  has(userId: string): boolean {
    return this.cache.has(userId);
  }

  /** Explicitly remove and dispose a user's runtime */
  async evict(userId: string): Promise<void> {
    const entry = this.cache.get(userId);
    if (!entry) return;
    this.cache.delete(userId);
    this.clearIdleTimer(entry);
    this.options.onEvict?.(userId);
    await entry.runtime.dispose();
  }

  /** List all active user IDs (most recently used first) */
  activeUsers(): string[] {
    // Map preserves insertion order; we re-insert on access for LRU
    return Array.from(this.cache.keys()).reverse();
  }

  /** Dispose all runtimes and prevent new creations */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    const entries = Array.from(this.cache.entries());
    this.cache.clear();

    await Promise.allSettled(
      entries.map(async ([userId, entry]) => {
        this.clearIdleTimer(entry);
        this.options.onEvict?.(userId);
        await entry.runtime.dispose();
      }),
    );
  }

  // ─── Internal ──────────────────────────────────────────────

  private async createAndCache(userId: string, config?: UserRuntimeConfig): Promise<IChatRuntime> {
    // Evict LRU if at capacity
    if (this.cache.size >= this.options.maxUsers) {
      await this.evictLRU();
    }

    const runtime = await this.options.createRuntime(userId, config);
    const entry: CacheEntry = {
      runtime,
      lastAccess: Date.now(),
      idleTimer: null,
    };

    this.cache.set(userId, entry);
    this.resetIdleTimer(userId, entry);
    return runtime;
  }

  /** Promote userId to most-recently-used by re-inserting */
  private touch(userId: string, entry: CacheEntry): void {
    entry.lastAccess = Date.now();
    this.cache.delete(userId);
    this.cache.set(userId, entry);
    this.resetIdleTimer(userId, entry);
  }

  /** Evict the least recently used entry (first in Map) */
  private async evictLRU(): Promise<void> {
    const first = this.cache.keys().next();
    if (!first.done) {
      await this.evict(first.value);
    }
  }

  private resetIdleTimer(userId: string, entry: CacheEntry): void {
    this.clearIdleTimer(entry);
    if (this.options.idleTimeoutMs > 0) {
      entry.idleTimer = setTimeout(() => {
        this.evict(userId).catch(() => { /* silent */ });
      }, this.options.idleTimeoutMs);
    }
  }

  private clearIdleTimer(entry: CacheEntry): void {
    if (entry.idleTimer !== null) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }
  }
}
