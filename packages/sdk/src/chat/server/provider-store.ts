/**
 * Provider storage default implementations.
 *
 * Types (ProviderConfig, IProviderStore) are defined in ../provider-types.ts
 * and re-exported here for backward compatibility.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ProviderConfig, IProviderStore } from "../provider-types.js";

// Re-export types for backward compatibility
export type { ProviderConfig, IProviderStore } from "../provider-types.js";

// ─── In-Memory Implementation ──────────────────────────────────

/** In-memory provider store for testing and ephemeral use */
export class InMemoryProviderStore implements IProviderStore {
  private readonly providers = new Map<string, ProviderConfig>();

  async create(config: ProviderConfig): Promise<void> {
    const id = config.id || randomUUID();
    this.providers.set(id, { ...config, id });
  }

  async get(id: string): Promise<ProviderConfig | null> {
    const p = this.providers.get(id);
    return p ? { ...p } : null;
  }

  async update(id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>): Promise<void> {
    const existing = this.providers.get(id);
    if (!existing) {
      throw new Error(`Provider "${id}" not found`);
    }
    this.providers.set(id, { ...existing, ...changes, id: existing.id, createdAt: existing.createdAt });
  }

  async delete(id: string): Promise<void> {
    this.providers.delete(id);
  }

  async list(): Promise<ProviderConfig[]> {
    return [...this.providers.values()].map(p => ({ ...p }));
  }
}

// ─── File System Implementation ────────────────────────────────

/** Options for FileProviderStore */
export interface FileProviderStoreOptions {
  /** Directory to store provider JSON files */
  directory: string;
}

/** Filesystem-based provider store using JSON files (one per provider) */
export class FileProviderStore implements IProviderStore {
  private readonly dir: string;

  constructor(options: FileProviderStoreOptions) {
    this.dir = options.directory;
  }

  async create(config: ProviderConfig): Promise<void> {
    const id = config.id || randomUUID();
    const data = { ...config, id };
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.filePath(id), JSON.stringify(data));
  }

  async get(id: string): Promise<ProviderConfig | null> {
    try {
      const data = readFileSync(this.filePath(id), "utf-8");
      return JSON.parse(data) as ProviderConfig;
    } catch {
      return null;
    }
  }

  async update(id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Provider "${id}" not found`);
    }
    const updated = { ...existing, ...changes, id: existing.id, createdAt: existing.createdAt };
    writeFileSync(this.filePath(id), JSON.stringify(updated));
  }

  async delete(id: string): Promise<void> {
    try {
      unlinkSync(this.filePath(id));
    } catch {
      // File may not exist
    }
  }

  async list(): Promise<ProviderConfig[]> {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter(f => f.endsWith("-provider.json"))
      .map(f => {
        try {
          const data = readFileSync(join(this.dir, f), "utf-8");
          return JSON.parse(data) as ProviderConfig;
        } catch {
          return null;
        }
      })
      .filter((p): p is ProviderConfig => p !== null);
  }

  private filePath(id: string): string {
    return join(this.dir, `${id}-provider.json`);
  }
}
