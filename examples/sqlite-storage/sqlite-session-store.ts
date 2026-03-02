/**
 * SQLite Storage Adapter Example
 *
 * Implements IStorageAdapter<ChatSession> and IChatSessionStore using
 * better-sqlite3 for synchronous SQLite access. Stores sessions and
 * messages in separate tables with JSON serialization for parts/metadata.
 *
 * Dependencies: better-sqlite3
 *
 * @example
 * ```typescript
 * import Database from "better-sqlite3";
 * import { SQLiteSessionStore } from "./sqlite-storage";
 *
 * const db = new Database(":memory:");
 * const store = new SQLiteSessionStore(db);
 *
 * const session = await store.createSession({ title: "My Chat" });
 * await store.appendMessage(session.id, message);
 * ```
 */

import type Database from "better-sqlite3";
import type { ChatSession, ChatMessage, ChatId, ChatSessionConfig } from "@witqq/agent-sdk/chat/core";
import { createChatId } from "@witqq/agent-sdk/chat/core";
import type {
  IChatSessionStore,
  CreateSessionOptions,
  PaginatedMessages,
  SessionListOptions,
  SessionSearchOptions,
} from "@witqq/agent-sdk/chat/sessions";
import { StorageError } from "@witqq/agent-sdk/chat/storage";
import { ErrorCode } from "../../src/types/errors.js";

// ─── Schema ────────────────────────────────────────────────────

const CREATE_SESSIONS_TABLE = `
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
`;

const CREATE_MESSAGES_TABLE = `
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
`;

const CREATE_MESSAGES_SESSION_IDX = `
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, position)
`;

// ─── SQLiteSessionStore ────────────────────────────────────────

/**
 * SQLite-backed session store implementing IChatSessionStore.
 *
 * Uses better-sqlite3 for synchronous database access wrapped in
 * async interface. Messages are stored with position ordering for
 * deterministic retrieval. Parts and metadata are JSON-serialized.
 */
export class SQLiteSessionStore implements IChatSessionStore {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(CREATE_SESSIONS_TABLE);
    this.db.exec(CREATE_MESSAGES_TABLE);
    this.db.exec(CREATE_MESSAGES_SESSION_IDX);
  }

  async createSession(options: CreateSessionOptions = {}): Promise<ChatSession> {
    const id = createChatId();
    const now = new Date().toISOString();
    const config: ChatSessionConfig = {
      model: "default",
      backend: "default",
      ...options.config,
    };
    const metadata = {
      messageCount: 0,
      totalTokens: 0,
      tags: options.tags,
      custom: options.custom,
    };

    this.db.prepare(`
      INSERT INTO sessions (id, title, config, metadata, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(id, options.title ?? null, JSON.stringify(config), JSON.stringify(metadata), now, now);

    return this.buildSession(id, options.title, config, metadata, "active", now, now, []);
  }

  async getSession(id: ChatId): Promise<ChatSession | null> {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
    if (!row) return null;

    const messages = this.loadAllMessages(row.id);
    return this.rowToSession(row, messages);
  }

  async listSessions(options?: SessionListOptions): Promise<ChatSession[]> {
    let rows = this.db.prepare("SELECT * FROM sessions ORDER BY updated_at DESC").all() as SessionRow[];

    let sessions = rows.map((r) => this.rowToSession(r, []));

    if (options?.filter) sessions = sessions.filter(options.filter);
    if (options?.sort) sessions.sort(options.sort);
    if (options?.offset) sessions = sessions.slice(options.offset);
    if (options?.limit) sessions = sessions.slice(0, options.limit);

    return sessions;
  }

  async updateTitle(id: ChatId, title: string): Promise<void> {
    const result = this.db.prepare(
      "UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?",
    ).run(title, new Date().toISOString(), id);
    if (result.changes === 0) throw new StorageError(`Session not found: ${id}`, ErrorCode.STORAGE_NOT_FOUND);
  }

  async updateConfig(id: ChatId, config: Partial<ChatSessionConfig>): Promise<void> {
    const row = this.db.prepare("SELECT config FROM sessions WHERE id = ?").get(id) as { config: string } | undefined;
    if (!row) throw new StorageError(`Session not found: ${id}`, ErrorCode.STORAGE_NOT_FOUND);

    const merged = { ...JSON.parse(row.config), ...config };
    this.db.prepare(
      "UPDATE sessions SET config = ?, updated_at = ? WHERE id = ?",
    ).run(JSON.stringify(merged), new Date().toISOString(), id);
  }

  async deleteSession(id: ChatId): Promise<void> {
    const result = this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    if (result.changes === 0) throw new StorageError(`Session not found: ${id}`, ErrorCode.STORAGE_NOT_FOUND);
  }

  async appendMessage(sessionId: ChatId, message: ChatMessage): Promise<void> {
    const session = this.db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId) as { id: string } | undefined;
    if (!session) throw new StorageError(`Session not found: ${sessionId}`, ErrorCode.STORAGE_NOT_FOUND);

    const position = this.getNextPosition(sessionId);

    this.db.prepare(`
      INSERT INTO messages (id, session_id, role, parts, metadata, status, created_at, updated_at, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.id,
      sessionId,
      message.role,
      JSON.stringify(message.parts),
      message.metadata ? JSON.stringify(message.metadata) : null,
      message.status,
      message.createdAt,
      message.updatedAt ?? null,
      position,
    );

    this.incrementMessageCount(sessionId);
  }

  async saveMessages(sessionId: ChatId, messages: ChatMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const session = this.db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId) as { id: string } | undefined;
    if (!session) throw new StorageError(`Session not found: ${sessionId}`, ErrorCode.STORAGE_NOT_FOUND);

    const insertMsg = this.db.prepare(`
      INSERT INTO messages (id, session_id, role, parts, metadata, status, created_at, updated_at, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      let pos = this.getNextPosition(sessionId);
      for (const msg of messages) {
        insertMsg.run(
          msg.id, sessionId, msg.role,
          JSON.stringify(msg.parts),
          msg.metadata ? JSON.stringify(msg.metadata) : null,
          msg.status, msg.createdAt, msg.updatedAt ?? null, pos++,
        );
      }
      this.updateSessionMeta(sessionId, messages.length);
    });
    tx();
  }

  async loadMessages(
    sessionId: ChatId,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedMessages> {
    const session = this.db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId) as { id: string } | undefined;
    if (!session) throw new StorageError(`Session not found: ${sessionId}`, ErrorCode.STORAGE_NOT_FOUND);

    const total = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?",
    ).get(sessionId) as { cnt: number }).cnt;

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const rows = this.db.prepare(
      "SELECT * FROM messages WHERE session_id = ? ORDER BY position ASC LIMIT ? OFFSET ?",
    ).all(sessionId, limit, offset) as MessageRow[];

    return {
      messages: rows.map(rowToMessage),
      total,
      hasMore: offset + limit < total,
    };
  }

  async searchSessions(options: SessionSearchOptions): Promise<ChatSession[]> {
    const pattern = `%${options.query}%`;
    const limit = options.limit ?? 20;

    // Search in session titles
    const titleMatches = this.db.prepare(
      "SELECT * FROM sessions WHERE title LIKE ? COLLATE NOCASE LIMIT ?",
    ).all(pattern, limit) as SessionRow[];

    // Search in message content
    const contentMatches = this.db.prepare(`
      SELECT DISTINCT s.* FROM sessions s
      JOIN messages m ON m.session_id = s.id
      WHERE m.parts LIKE ? COLLATE NOCASE
      LIMIT ?
    `).all(pattern, limit) as SessionRow[];

    // Deduplicate
    const seen = new Set<string>();
    const results: ChatSession[] = [];
    for (const row of [...titleMatches, ...contentMatches]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        results.push(this.rowToSession(row, []));
      }
    }

    return results.slice(0, limit);
  }

  async count(): Promise<number> {
    return (this.db.prepare("SELECT COUNT(*) as cnt FROM sessions").get() as { cnt: number }).cnt;
  }

  async clear(): Promise<void> {
    this.db.exec("DELETE FROM messages");
    this.db.exec("DELETE FROM sessions");
  }

  async getMessages(
    sessionId: ChatId,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedMessages> {
    return this.loadMessages(sessionId, options);
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private getNextPosition(sessionId: string): number {
    const result = this.db.prepare(
      "SELECT MAX(position) as maxPos FROM messages WHERE session_id = ?",
    ).get(sessionId) as { maxPos: number | null };
    return (result.maxPos ?? -1) + 1;
  }

  private incrementMessageCount(sessionId: string): void {
    this.db.prepare(`
      UPDATE sessions
      SET metadata = json_set(metadata, '$.messageCount', json_extract(metadata, '$.messageCount') + 1),
          updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), sessionId);
  }

  private updateSessionMeta(sessionId: string, addedCount: number): void {
    this.db.prepare(`
      UPDATE sessions
      SET metadata = json_set(metadata, '$.messageCount', json_extract(metadata, '$.messageCount') + ?),
          updated_at = ?
      WHERE id = ?
    `).run(addedCount, new Date().toISOString(), sessionId);
  }

  private loadAllMessages(sessionId: string): ChatMessage[] {
    const rows = this.db.prepare(
      "SELECT * FROM messages WHERE session_id = ? ORDER BY position ASC",
    ).all(sessionId) as MessageRow[];
    return rows.map(rowToMessage);
  }

  private rowToSession(row: SessionRow, messages: ChatMessage[]): ChatSession {
    return this.buildSession(
      row.id as ChatId,
      row.title,
      JSON.parse(row.config),
      JSON.parse(row.metadata),
      row.status as "active",
      row.created_at,
      row.updated_at,
      messages,
    );
  }

  private buildSession(
    id: ChatId,
    title: string | undefined | null,
    config: ChatSessionConfig,
    metadata: ChatSession["metadata"],
    status: "active",
    createdAt: string,
    updatedAt: string,
    messages: ChatMessage[],
  ): ChatSession {
    return {
      id,
      title: title ?? undefined,
      messages,
      config,
      metadata,
      status,
      createdAt,
      updatedAt,
    };
  }
}

// ─── Row Types ─────────────────────────────────────────────────

interface SessionRow {
  id: string;
  title: string | null;
  config: string;
  metadata: string;
  status: string;
  backend_session_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  parts: string;
  metadata: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  position: number;
}

function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id as ChatId,
    role: row.role as ChatMessage["role"],
    parts: JSON.parse(row.parts),
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    status: row.status as ChatMessage["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}
