/**
 * SQLite-backed provider store implementing IProviderStore.
 *
 * Stores provider configurations in a `providers` table within
 * a shared SQLite database. Schema auto-created on construction.
 */

import type Database from "better-sqlite3";
import type { IProviderStore, ProviderConfig } from "../provider-types.js";

// ─── Schema ────────────────────────────────────────────────────

const CREATE_PROVIDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    backend TEXT NOT NULL,
    model TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`;

// ─── SQLiteProviderStore ───────────────────────────────────────

export class SQLiteProviderStore implements IProviderStore {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(CREATE_PROVIDERS_TABLE);
  }

  async create(config: ProviderConfig): Promise<void> {
    this.db.prepare(`
      INSERT INTO providers (id, backend, model, label, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(config.id, config.backend, config.model, config.label, config.createdAt);
  }

  async get(id: string): Promise<ProviderConfig | null> {
    const row = this.db.prepare("SELECT * FROM providers WHERE id = ?").get(id) as ProviderRow | undefined;
    return row ? rowToProvider(row) : null;
  }

  async update(id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>): Promise<void> {
    const existing = this.db.prepare("SELECT id FROM providers WHERE id = ?").get(id) as { id: string } | undefined;
    if (!existing) throw new Error(`Provider "${id}" not found`);

    const sets: string[] = [];
    const values: unknown[] = [];
    if (changes.backend !== undefined) { sets.push("backend = ?"); values.push(changes.backend); }
    if (changes.model !== undefined) { sets.push("model = ?"); values.push(changes.model); }
    if (changes.label !== undefined) { sets.push("label = ?"); values.push(changes.label); }

    if (sets.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE providers SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    }
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM providers WHERE id = ?").run(id);
  }

  async list(): Promise<ProviderConfig[]> {
    const rows = this.db.prepare("SELECT * FROM providers ORDER BY created_at ASC").all() as ProviderRow[];
    return rows.map(rowToProvider);
  }
}

// ─── Row Types ─────────────────────────────────────────────────

interface ProviderRow {
  id: string;
  backend: string;
  model: string;
  label: string;
  created_at: number;
}

function rowToProvider(row: ProviderRow): ProviderConfig {
  return {
    id: row.id,
    backend: row.backend,
    model: row.model,
    label: row.label,
    createdAt: row.created_at,
  };
}
