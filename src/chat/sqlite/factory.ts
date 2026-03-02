/**
 * Factory function for creating all three SQLite stores from a single database path.
 *
 * @example
 * ```ts
 * import { createSQLiteStorage } from "@witqq/agent-sdk/chat/sqlite";
 *
 * const storage = createSQLiteStorage("/data/chat.db");
 * // storage.sessionStore  — IChatSessionStore
 * // storage.providerStore — IProviderStore
 * // storage.tokenStore    — ITokenStore
 * // storage.db            — raw Database instance
 * ```
 */

import { createRequire } from "node:module";
import type Database from "better-sqlite3";
import { SQLiteSessionStore } from "./session-store.js";
import { SQLiteProviderStore } from "./provider-store.js";
import { SQLiteTokenStore } from "./token-store.js";
import type { IChatSessionStore } from "../sessions.js";
import type { IProviderStore } from "../provider-types.js";
import type { ITokenStore } from "../server/token-store.js";

// ─── Types ─────────────────────────────────────────────────────

export interface SQLiteStorageOptions {
  /** Path to SQLite database file. Use ":memory:" for in-memory database. */
  dbPath: string;
  /** Optional pre-created Database instance. If provided, dbPath is ignored. */
  db?: Database.Database;
}

export interface SQLiteStorage {
  /** The underlying better-sqlite3 Database instance */
  db: Database.Database;
  /** Session store for chat sessions and messages */
  sessionStore: IChatSessionStore;
  /** Provider store for provider configurations */
  providerStore: IProviderStore;
  /** Token store for auth tokens */
  tokenStore: ITokenStore;
}

// ─── Factory ───────────────────────────────────────────────────

/**
 * Create all three SQLite stores sharing a single database.
 *
 * Requires `better-sqlite3` as a peer dependency.
 * Schema tables are auto-created on first use.
 *
 * @param pathOrOptions - Database file path string, or options object
 * @returns Object with db, sessionStore, providerStore, tokenStore
 *
 * @throws If better-sqlite3 is not installed
 */
export function createSQLiteStorage(pathOrOptions: string | SQLiteStorageOptions): SQLiteStorage {
  let db: Database.Database;

  if (typeof pathOrOptions === "string") {
    db = createDatabase(pathOrOptions);
  } else if (pathOrOptions.db) {
    db = pathOrOptions.db;
  } else {
    db = createDatabase(pathOrOptions.dbPath);
  }

  // Enable WAL + foreign keys once for the shared connection
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return {
    db,
    sessionStore: new SQLiteSessionStore(db),
    providerStore: new SQLiteProviderStore(db),
    tokenStore: new SQLiteTokenStore(db),
  };
}

function createDatabase(dbPath: string): Database.Database {
  try {
    // createRequire for ESM compatibility — better-sqlite3 is a CJS native addon
    const esmRequire = createRequire(import.meta.url);
    const BetterSqlite3 = esmRequire("better-sqlite3") as typeof Database;
    return new BetterSqlite3(dbPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Cannot find module") || message.includes("MODULE_NOT_FOUND")) {
      throw new Error(
        "better-sqlite3 is required for SQLite storage. Install it: npm install better-sqlite3",
      );
    }
    throw err;
  }
}
