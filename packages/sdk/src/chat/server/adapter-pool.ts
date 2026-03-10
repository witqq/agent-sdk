/**
 * AdapterPool — lazy adapter creation with concurrent dedup and eviction.
 *
 * Replaces the pattern where ServiceManager + backend factories create adapters
 * eagerly on auth. AdapterPool creates adapters on first use, keyed by backend name.
 *
 * Key properties:
 * - Lazy: adapters created on first getAdapter() call
 * - Concurrent dedup: multiple concurrent getAdapter() calls for same backend share one creation
 * - Never cache failures: if factory throws, next call retries
 * - Eviction: evict(backend) disposes cached adapter (e.g. on token rotation)
 *
 * @example
 * ```ts
 * const pool = new AdapterPool({
 *   factory: async (backend) => {
 *     const token = await tokenStore.load(backend);
 *     const service = createAgentService(backend, { apiKey: token.accessToken });
 *     return new VercelAIChatAdapter({ agentConfig: { ... }, agentService: service });
 *   },
 * });
 *
 * const adapter = await pool.getAdapter("vercel-ai");
 * // On token rotation:
 * await pool.evict("vercel-ai");
 * ```
 */

/** Minimal adapter interface (avoids importing full IChatBackend) */
export interface PooledAdapter {
  dispose(): Promise<void> | void;
}

/** Factory function to create an adapter for a given backend */
export type AdapterFactory<T extends PooledAdapter = PooledAdapter> =
  (backend: string) => Promise<T>;

/** Configuration for AdapterPool */
export interface AdapterPoolOptions<T extends PooledAdapter = PooledAdapter> {
  /** Factory to create an adapter for a backend. Called lazily on first getAdapter(). */
  factory: AdapterFactory<T>;
}

/**
 * Lazy adapter pool with concurrent dedup and eviction.
 * Thread-safe: concurrent getAdapter() calls for the same backend share a single creation promise.
 */
export class AdapterPool<T extends PooledAdapter = PooledAdapter> {
  private readonly _cached = new Map<string, T>();
  private readonly _pending = new Map<string, Promise<T>>();
  private readonly _factory: AdapterFactory<T>;
  private _disposed = false;

  constructor(options: AdapterPoolOptions<T>) {
    this._factory = options.factory;
  }

  /**
   * Get or create an adapter for the given backend.
   * Concurrent calls for the same backend share one creation promise.
   * Failed creations are NOT cached — next call retries.
   */
  async getAdapter(backend: string): Promise<T> {
    if (this._disposed) {
      throw new Error("AdapterPool is disposed");
    }

    // Return cached adapter if available
    const cached = this._cached.get(backend);
    if (cached) return cached;

    // Join pending creation if in flight
    const pending = this._pending.get(backend);
    if (pending) return pending;

    // Start new creation with dedup
    const promise = this._create(backend);
    this._pending.set(backend, promise);

    try {
      const adapter = await promise;
      this._cached.set(backend, adapter);
      return adapter;
    } finally {
      // Always clean up pending — whether success or failure
      this._pending.delete(backend);
    }
  }

  /**
   * Evict (dispose and remove) the cached adapter for a backend.
   * Use after token rotation to force re-creation on next getAdapter().
   */
  async evict(backend: string): Promise<void> {
    const cached = this._cached.get(backend);
    if (cached) {
      this._cached.delete(backend);
      try { await cached.dispose(); } catch { /* best-effort */ }
    }
  }

  /** Check if a backend has a cached adapter. */
  has(backend: string): boolean {
    return this._cached.has(backend);
  }

  /** Get all backend names with cached adapters. */
  get activeBackends(): string[] {
    return [...this._cached.keys()];
  }

  /** Dispose all cached adapters and mark pool as unusable. */
  async dispose(): Promise<void> {
    this._disposed = true;
    const backends = [...this._cached.keys()];
    for (const backend of backends) {
      await this.evict(backend);
    }
  }

  private async _create(backend: string): Promise<T> {
    return this._factory(backend);
  }
}
