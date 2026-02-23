/**
 * Token storage abstraction and default filesystem implementation.
 */

import type { AuthToken } from "../../auth/types.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

// ─── Interface ─────────────────────────────────────────────────

/** Token storage interface for server-side token management */
export interface ITokenStore {
  /** Save a token for a provider. Overwrites if exists. */
  save(provider: string, token: AuthToken): Promise<void>;
  /** Load a previously saved token. Returns null if not found. */
  load(provider: string): Promise<AuthToken | null>;
  /** Remove a specific provider's token. */
  clear(provider: string): Promise<void>;
  /** Remove all stored tokens. */
  clearAll(): Promise<void>;
  /** List provider names that have saved tokens. */
  list(): Promise<string[]>;
}

// ─── In-Memory Implementation ──────────────────────────────────

/** In-memory token store for testing and ephemeral use */
export class InMemoryTokenStore implements ITokenStore {
  private readonly tokens = new Map<string, AuthToken>();

  async save(provider: string, token: AuthToken): Promise<void> {
    this.tokens.set(provider, { ...token });
  }

  async load(provider: string): Promise<AuthToken | null> {
    const t = this.tokens.get(provider);
    return t ? { ...t } : null;
  }

  async clear(provider: string): Promise<void> {
    this.tokens.delete(provider);
  }

  async clearAll(): Promise<void> {
    this.tokens.clear();
  }

  async list(): Promise<string[]> {
    return [...this.tokens.keys()];
  }
}

// ─── File System Implementation ────────────────────────────────

/** Options for FileTokenStore */
export interface FileTokenStoreOptions {
  /** Directory to store token JSON files. Default: ".tokens" in cwd */
  directory: string;
}

/** Filesystem-based token store using JSON files (one per provider) */
export class FileTokenStore implements ITokenStore {
  private readonly dir: string;

  constructor(options: FileTokenStoreOptions) {
    this.dir = options.directory;
  }

  async save(provider: string, token: AuthToken): Promise<void> {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.filePath(provider), JSON.stringify(token));
  }

  async load(provider: string): Promise<AuthToken | null> {
    try {
      const data = readFileSync(this.filePath(provider), "utf-8");
      return JSON.parse(data) as AuthToken;
    } catch {
      return null;
    }
  }

  async clear(provider: string): Promise<void> {
    try {
      unlinkSync(this.filePath(provider));
    } catch {
      // File may not exist
    }
  }

  async clearAll(): Promise<void> {
    if (!existsSync(this.dir)) return;
    for (const f of readdirSync(this.dir)) {
      if (f.endsWith("-token.json")) {
        try {
          unlinkSync(join(this.dir, f));
        } catch {
          // Ignore individual file errors
        }
      }
    }
  }

  async list(): Promise<string[]> {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter(f => f.endsWith("-token.json"))
      .map(f => f.replace(/-token\.json$/, ""));
  }

  private filePath(provider: string): string {
    return join(this.dir, `${provider}-token.json`);
  }
}
