/**
 * ServiceManager — manages IAgentService lifecycle (create, cache, dispose).
 *
 * Reduces boilerplate in apps that need to create/dispose services on auth events.
 * Pass to createChatServer to auto-wire onAuth/onLogout callbacks.
 *
 * @example
 * ```ts
 * const sm = new ServiceManager({
 *   createService: (backend, token) =>
 *     createAgentService(backend, { apiKey: token.accessToken }),
 * });
 *
 * // Manual usage:
 * await sm.handleAuth("copilot", token);
 * const service = sm.getService("copilot");
 *
 * // Or auto-wired via createChatServer:
 * createChatServer({ serviceManager: sm, auth: { tokenStore }, ... });
 * ```
 */

import type { AuthToken } from "../../auth/types.js";
import { TokenRefreshManager } from "../../auth/refresh-manager.js";
import type { TokenRefreshOptions } from "../../auth/refresh-manager.js";

/** Minimal IAgentService interface (avoids importing from main package) */
export interface ManagedService {
  dispose(): Promise<void> | void;
}

/** Callback for building a token refresh function per backend */
export type RefreshFactory = (backend: string) => ((token: AuthToken) => Promise<AuthToken>) | undefined;

/** Configuration for ServiceManager */
export interface ServiceManagerOptions {
  /**
   * Factory to create a service for a backend.
   * Called on every auth event (old service is disposed first).
   */
  createService: (backend: string, token: AuthToken) => ManagedService | Promise<ManagedService>;
  /**
   * Optional factory returning a refresh function per backend.
   * If provided and the token has expiresIn, a TokenRefreshManager is started.
   * On refresh → the stored token is updated and the service is recreated.
   * On expiry → handleLogout() for that backend is called.
   */
  refreshFactory?: RefreshFactory;
  /** Override TokenRefreshManager options (threshold, retries, etc.) */
  refreshOptions?: Partial<Pick<TokenRefreshOptions, "refreshThreshold" | "maxRetries" | "retryDelayMs">>;
  /** Called when a token expires (before logout). */
  onTokenExpired?: (backend: string) => void;
}

/**
 * Manages IAgentService lifecycle: create, cache, and dispose on re-auth or logout.
 * Optionally starts background token refresh when `refreshFactory` is configured.
 */
export class ServiceManager {
  private readonly _services = new Map<string, ManagedService>();
  private readonly _refreshManagers = new Map<string, TokenRefreshManager>();
  private readonly _options: ServiceManagerOptions;

  constructor(options: ServiceManagerOptions) {
    this._options = options;
  }

  /**
   * Handle auth event: dispose old service (if any) and create new one.
   * If the token is refreshable and refreshFactory is configured, starts a
   * TokenRefreshManager that auto-refreshes and recreates the service.
   */
  async handleAuth(backend: string, token: AuthToken): Promise<ManagedService> {
    // Stop any existing refresh manager for this backend
    this._stopRefreshManager(backend);

    // Dispose existing service for this backend
    const old = this._services.get(backend);
    if (old) {
      try { await old.dispose(); } catch { /* best-effort */ }
    }

    // Create and cache new service
    const service = await this._options.createService(backend, token);
    this._services.set(backend, service);

    // Start token refresh if applicable
    this._startRefreshManager(backend, token);

    return service;
  }

  /**
   * Handle logout: dispose all services, stop all refresh managers, clear cache.
   */
  async handleLogout(): Promise<void> {
    // Stop all refresh managers first (collect keys to avoid mutation during iteration)
    for (const backend of [...this._refreshManagers.keys()]) {
      this._stopRefreshManager(backend);
    }

    for (const [, service] of this._services) {
      try { await service.dispose(); } catch { /* best-effort */ }
    }
    this._services.clear();
  }

  /**
   * Dispose the ServiceManager — stops all refresh managers and disposes all services.
   */
  async dispose(): Promise<void> {
    await this.handleLogout();
  }

  /** Get cached service for a backend (undefined if not authenticated). */
  getService(backend: string): ManagedService | undefined {
    return this._services.get(backend);
  }

  /** Check if a service exists for the given backend. */
  hasService(backend: string): boolean {
    return this._services.has(backend);
  }

  /** Get all backend names with active services. */
  get activeBackends(): string[] {
    return [...this._services.keys()];
  }

  /** Get active refresh manager for a backend (for testing/introspection). */
  getRefreshManager(backend: string): TokenRefreshManager | undefined {
    return this._refreshManagers.get(backend);
  }

  // ── Private ─────────────────────────────────────────────────

  private _startRefreshManager(backend: string, token: AuthToken): void {
    if (!this._options.refreshFactory) return;
    if (token.expiresIn == null) return; // long-lived token, no refresh needed

    const refreshFn = this._options.refreshFactory(backend);
    if (!refreshFn) return;

    const manager = new TokenRefreshManager({
      token,
      refresh: refreshFn,
      refreshThreshold: this._options.refreshOptions?.refreshThreshold,
      maxRetries: this._options.refreshOptions?.maxRetries,
      retryDelayMs: this._options.refreshOptions?.retryDelayMs,
    });

    manager.on("refreshed", (newToken: AuthToken) => {
      // Recreate service with fresh token (fire-and-forget)
      void this._recreateService(backend, newToken);
    });

    manager.on("expired", () => {
      this._options.onTokenExpired?.(backend);
      // Dispose the expired backend's service
      void this._logoutBackend(backend);
    });

    this._refreshManagers.set(backend, manager);
    manager.start();
  }

  private _stopRefreshManager(backend: string): void {
    const manager = this._refreshManagers.get(backend);
    if (manager) {
      manager.dispose();
      this._refreshManagers.delete(backend);
    }
  }

  private async _recreateService(backend: string, token: AuthToken): Promise<void> {
    const old = this._services.get(backend);
    if (old) {
      try { await old.dispose(); } catch { /* best-effort */ }
    }

    try {
      const service = await this._options.createService(backend, token);
      this._services.set(backend, service);
    } catch {
      // Service creation failed after refresh — leave backend without service
      this._services.delete(backend);
    }
  }

  private async _logoutBackend(backend: string): Promise<void> {
    this._stopRefreshManager(backend);
    const service = this._services.get(backend);
    if (service) {
      try { await service.dispose(); } catch { /* best-effort */ }
      this._services.delete(backend);
    }
  }
}
