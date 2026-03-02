/**
 * @witqq/agent-sdk/chat/sqlite
 *
 * SQLite storage module providing unified database-backed implementations
 * of IChatSessionStore, IProviderStore, and ITokenStore.
 *
 * All three stores share a single SQLite database file. Schema tables
 * are auto-created on first use.
 *
 * Requires `better-sqlite3` as an optional peer dependency.
 *
 * @example
 * ```ts
 * import { createSQLiteStorage } from "@witqq/agent-sdk/chat/sqlite";
 *
 * const { sessionStore, providerStore, tokenStore } = createSQLiteStorage("/data/chat.db");
 *
 * // Use with createChatRuntime
 * const runtime = createChatRuntime({
 *   sessionStore,
 *   // ...
 * });
 *
 * // Use with createChatServer
 * const handler = createChatServer({
 *   runtime,
 *   auth: { tokenStore },
 *   providers: { providerStore },
 * });
 * ```
 */

export { createSQLiteStorage } from "./factory.js";
export type { SQLiteStorage, SQLiteStorageOptions } from "./factory.js";
export { SQLiteSessionStore } from "./session-store.js";
export { SQLiteProviderStore } from "./provider-store.js";
export { SQLiteTokenStore } from "./token-store.js";
export { runMigrations, getSchemaVersion, migrations } from "./migrations.js";
export type { Migration } from "./migrations.js";
