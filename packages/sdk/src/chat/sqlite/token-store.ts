/**
 * SQLite-backed token store implementing ITokenStore.
 *
 * Stores auth tokens as JSON in a `tokens` table within
 * a shared SQLite database. Schema auto-created on construction.
 */

import type Database from "better-sqlite3";
import type { ITokenStore } from "../server/token-store.js";
import type { AuthToken } from "../../auth/types.js";

// ─── Schema ────────────────────────────────────────────────────

const CREATE_TOKENS_TABLE = `
  CREATE TABLE IF NOT EXISTS tokens (
    provider TEXT PRIMARY KEY,
    token_json TEXT NOT NULL,
    saved_at INTEGER NOT NULL
  )
`;

// ─── SQLiteTokenStore ──────────────────────────────────────────

export class SQLiteTokenStore implements ITokenStore {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(CREATE_TOKENS_TABLE);
  }

  async save(provider: string, token: AuthToken): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO tokens (provider, token_json, saved_at)
      VALUES (?, ?, ?)
    `).run(provider, JSON.stringify(token), Date.now());
  }

  async load(provider: string): Promise<AuthToken | null> {
    const row = this.db.prepare("SELECT token_json FROM tokens WHERE provider = ?").get(provider) as { token_json: string } | undefined;
    return row ? JSON.parse(row.token_json) as AuthToken : null;
  }

  async clear(provider: string): Promise<void> {
    this.db.prepare("DELETE FROM tokens WHERE provider = ?").run(provider);
  }

  async clearAll(): Promise<void> {
    this.db.exec("DELETE FROM tokens");
  }

  async list(): Promise<string[]> {
    const rows = this.db.prepare("SELECT provider FROM tokens ORDER BY saved_at ASC").all() as { provider: string }[];
    return rows.map(r => r.provider);
  }
}
