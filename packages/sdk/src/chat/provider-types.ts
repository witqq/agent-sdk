/**
 * Provider type definitions and storage interface.
 *
 * A "Provider" is a user-configured entity combining backend + model + label.
 * Example: "Copilot GPT-5 mini" or "Claude Sonnet".
 *
 * Types live in the chat core layer (not server) because they are consumed
 * across all layers: runtime, react, sqlite, testing, and server.
 */

// ─── Types ─────────────────────────────────────────────────────

/** A user-configured provider combining backend + model + label */
export interface ProviderConfig {
  /** Unique identifier (UUID or slug) */
  id: string;
  /** Backend name (copilot, claude, vercel-ai) */
  backend: string;
  /** Model identifier */
  model: string;
  /** User-facing display name */
  label: string;
  /** Creation timestamp (Date.now()) */
  createdAt: number;
}

// ─── Interface ─────────────────────────────────────────────────

/** Provider storage interface for server-side provider management */
export interface IProviderStore {
  /** Create a new provider. Generates UUID if id not set on config. */
  create(config: ProviderConfig): Promise<void>;
  /** Get a provider by id. Returns null if not found. */
  get(id: string): Promise<ProviderConfig | null>;
  /** Update an existing provider. Throws if not found. */
  update(id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>): Promise<void>;
  /** Delete a provider by id. */
  delete(id: string): Promise<void>;
  /** List all providers. */
  list(): Promise<ProviderConfig[]>;
  /** Release any resources held by this store (optional). */
  dispose?(): Promise<void>;
}
