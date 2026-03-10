/**
 * SQLite schema migration runner.
 *
 * Maintains a `schema_version` table and applies sequential migrations.
 * Each migration runs inside a transaction for atomicity.
 *
 * Individual stores keep `CREATE TABLE IF NOT EXISTS` for backward
 * compatibility when constructed directly. The migration runner is
 * responsible for schema evolution (ALTER TABLE, new indexes, etc.)
 * when used via `createSQLiteStorage()`.
 */

import type Database from "better-sqlite3";

// ─── Types ─────────────────────────────────────────────────────

export interface Migration {
  /** Sequential version number (1-based) */
  version: number;
  /** Human-readable description */
  description: string;
  /** DDL statements to apply. Runs inside a transaction. */
  up: (db: Database.Database) => void;
}

// ─── Schema Version Table ──────────────────────────────────────

const CREATE_VERSION_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL,
    description TEXT
  )
`;

// ─── Migrations ────────────────────────────────────────────────

/**
 * Migration registry. Append new migrations here.
 * Version numbers must be sequential (1, 2, 3, ...).
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    description: "Initial schema — sessions, messages, providers, tokens",
    up: (db) => {
      // Tables are created by store constructors via IF NOT EXISTS.
      // This migration records that the baseline schema is version 1.
      // Future migrations will ALTER these tables.
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          title TEXT,
          config TEXT NOT NULL,
          metadata TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          backend_session_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          parts TEXT NOT NULL,
          metadata TEXT,
          status TEXT NOT NULL DEFAULT 'complete',
          created_at TEXT NOT NULL,
          updated_at TEXT,
          position INTEGER NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
      `);
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, position)
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS providers (
          id TEXT PRIMARY KEY,
          backend TEXT NOT NULL,
          model TEXT NOT NULL,
          label TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS tokens (
          provider TEXT PRIMARY KEY,
          token_json TEXT NOT NULL,
          saved_at INTEGER NOT NULL
        )
      `);
    },
  },
];

// ─── Runner ────────────────────────────────────────────────────

/** Get current schema version (0 if no migrations applied). */
export function getSchemaVersion(db: Database.Database): number {
  db.exec(CREATE_VERSION_TABLE);
  const row = db.prepare("SELECT MAX(version) as v FROM schema_version").get() as
    | { v: number | null }
    | undefined;
  return row?.v ?? 0;
}

/**
 * Apply pending migrations sequentially. Each runs in a transaction.
 *
 * Safe to call multiple times — already-applied migrations are skipped.
 * For existing databases without schema_version table, detects current
 * tables and fast-forwards to the matching version.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(CREATE_VERSION_TABLE);

  let current = getSchemaVersion(db);

  // Detect pre-migration databases: if sessions table exists but no version recorded,
  // fast-forward to version 1 to avoid re-running initial schema.
  if (current === 0 && tableExists(db, "sessions")) {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)")
      .run(1, now, "Initial schema (pre-existing database)");
    current = 1;
  }

  const pending = migrations.filter((m) => m.version > current);
  if (pending.length === 0) return;

  for (const migration of pending) {
    const txn = db.transaction(() => {
      migration.up(db);
      const now = new Date().toISOString();
      db.prepare("INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)")
        .run(migration.version, now, migration.description);
    });
    txn();
  }
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(name) as { name: string } | undefined;
  return !!row;
}
