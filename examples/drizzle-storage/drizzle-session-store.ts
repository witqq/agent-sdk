/**
 * Drizzle ORM Storage Adapter Example
 *
 * Implements IChatSessionStore using Drizzle ORM with better-sqlite3.
 * Type-safe schema definitions, migration-friendly, demonstrates
 * ORM-based approach vs raw SQL in the SQLite example.
 *
 * Dependencies: drizzle-orm, better-sqlite3
 *
 * @example
 * ```typescript
 * import Database from "better-sqlite3";
 * import { drizzle } from "drizzle-orm/better-sqlite3";
 * import { DrizzleSessionStore } from "./drizzle-session-store";
 *
 * const sqlite = new Database(":memory:");
 * const db = drizzle(sqlite);
 * const store = new DrizzleSessionStore(db);
 *
 * const session = await store.createSession({ title: "My Chat" });
 * ```
 */

import { sql, eq, like, desc, and, or, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
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

// ─── Drizzle Schema ────────────────────────────────────────────

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title"),
  config: text("config").notNull(),
  metadata: text("metadata").notNull(),
  status: text("status").notNull().default("active"),
  backendSessionId: text("backend_session_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  parts: text("parts").notNull(),
  metadata: text("metadata"),
  status: text("status").notNull().default("complete"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
  position: integer("position").notNull(),
});

type SessionRow = InferSelectModel<typeof sessions>;
type MessageRow = InferSelectModel<typeof messages>;

// ─── DrizzleSessionStore ───────────────────────────────────────

/**
 * Drizzle ORM-backed session store implementing IChatSessionStore.
 *
 * Uses type-safe schema with Drizzle's query builder.
 * Stores parts and metadata as JSON text columns.
 */
export class DrizzleSessionStore implements IChatSessionStore {
  private readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
    // Create tables if they don't exist
    this.db.run(sql`
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
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        parts TEXT NOT NULL,
        metadata TEXT,
        status TEXT NOT NULL DEFAULT 'complete',
        created_at TEXT NOT NULL,
        updated_at TEXT,
        position INTEGER NOT NULL
      )
    `);
    this.db.run(sql`
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, position)
    `);
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

    this.db.insert(sessions).values({
      id,
      title: options.title ?? null,
      config: JSON.stringify(config),
      metadata: JSON.stringify(metadata),
      status: "active",
      createdAt: now,
      updatedAt: now,
    }).run();

    return buildSession(id as ChatId, options.title, config, metadata, "active", now, now, []);
  }

  async getSession(id: ChatId): Promise<ChatSession | null> {
    const rows = this.db.select().from(sessions).where(eq(sessions.id, id)).all();
    if (rows.length === 0) return null;

    const row = rows[0];
    const msgs = this.loadAllMessages(row.id);
    return rowToSession(row, msgs);
  }

  async listSessions(options?: SessionListOptions): Promise<ChatSession[]> {
    const rows = this.db.select().from(sessions).orderBy(desc(sessions.updatedAt)).all();

    let result = rows.map((r) => rowToSession(r, []));

    if (options?.filter) result = result.filter(options.filter);
    if (options?.sort) result.sort(options.sort);
    if (options?.offset) result = result.slice(options.offset);
    if (options?.limit) result = result.slice(0, options.limit);

    return result;
  }

  async updateTitle(id: ChatId, title: string): Promise<void> {
    const result = this.db.update(sessions)
      .set({ title, updatedAt: new Date().toISOString() })
      .where(eq(sessions.id, id))
      .run();
    if (result.changes === 0) throw new StorageError(`Session not found: ${id}`, ErrorCode.STORAGE_NOT_FOUND);
  }

  async updateConfig(id: ChatId, config: Partial<ChatSessionConfig>): Promise<void> {
    const rows = this.db.select({ config: sessions.config }).from(sessions).where(eq(sessions.id, id)).all();
    if (rows.length === 0) throw new StorageError(`Session not found: ${id}`, ErrorCode.STORAGE_NOT_FOUND);

    const merged = { ...JSON.parse(rows[0].config), ...config };
    this.db.update(sessions)
      .set({ config: JSON.stringify(merged), updatedAt: new Date().toISOString() })
      .where(eq(sessions.id, id))
      .run();
  }

  async deleteSession(id: ChatId): Promise<void> {
    // Delete messages first (foreign key may not cascade in all SQLite configs)
    this.db.delete(messages).where(eq(messages.sessionId, id)).run();
    const result = this.db.delete(sessions).where(eq(sessions.id, id)).run();
    if (result.changes === 0) throw new StorageError(`Session not found: ${id}`, ErrorCode.STORAGE_NOT_FOUND);
  }

  async appendMessage(sessionId: ChatId, message: ChatMessage): Promise<void> {
    const sessionExists = this.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId)).all();
    if (sessionExists.length === 0) throw new StorageError(`Session not found: ${sessionId}`, ErrorCode.STORAGE_NOT_FOUND);

    const position = this.getNextPosition(sessionId);

    this.db.insert(messages).values({
      id: message.id,
      sessionId,
      role: message.role,
      parts: JSON.stringify(message.parts),
      metadata: message.metadata ? JSON.stringify(message.metadata) : null,
      status: message.status,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt ?? null,
      position,
    }).run();

    this.incrementMessageCount(sessionId);
  }

  async saveMessages(sessionId: ChatId, msgs: ChatMessage[]): Promise<void> {
    if (msgs.length === 0) return;

    const sessionExists = this.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId)).all();
    if (sessionExists.length === 0) throw new StorageError(`Session not found: ${sessionId}`, ErrorCode.STORAGE_NOT_FOUND);

    this.db.transaction((tx) => {
      let pos = this.getNextPosition(sessionId);
      for (const msg of msgs) {
        tx.insert(messages).values({
          id: msg.id,
          sessionId,
          role: msg.role,
          parts: JSON.stringify(msg.parts),
          metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
          status: msg.status,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt ?? null,
          position: pos++,
        }).run();
      }
      // Update session metadata
      const rows = tx.select({ metadata: sessions.metadata }).from(sessions).where(eq(sessions.id, sessionId)).all();
      if (rows.length > 0) {
        const meta = JSON.parse(rows[0].metadata);
        meta.messageCount += msgs.length;
        tx.update(sessions)
          .set({ metadata: JSON.stringify(meta), updatedAt: new Date().toISOString() })
          .where(eq(sessions.id, sessionId))
          .run();
      }
    });
  }

  async loadMessages(
    sessionId: ChatId,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedMessages> {
    const sessionExists = this.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId)).all();
    if (sessionExists.length === 0) throw new StorageError(`Session not found: ${sessionId}`, ErrorCode.STORAGE_NOT_FOUND);

    const countResult = this.db.select({ cnt: sql<number>`COUNT(*)` })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .all();
    const total = countResult[0].cnt;

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const rows = this.db.select().from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.position)
      .limit(limit)
      .offset(offset)
      .all();

    return {
      messages: rows.map(rowToMessage),
      total,
      hasMore: offset + limit < total,
    };
  }

  async searchSessions(options: SessionSearchOptions): Promise<ChatSession[]> {
    const pattern = `%${options.query}%`;
    const limit = options.limit ?? 20;

    // Title matches
    const titleRows = this.db.select().from(sessions)
      .where(like(sessions.title, pattern))
      .limit(limit)
      .all();

    // Content matches via JOIN
    const contentRows = this.db.select({ session: sessions }).from(sessions)
      .innerJoin(messages, eq(messages.sessionId, sessions.id))
      .where(like(messages.parts, pattern))
      .limit(limit)
      .all();

    const seen = new Set<string>();
    const results: ChatSession[] = [];
    for (const row of titleRows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        results.push(rowToSession(row, []));
      }
    }
    for (const { session: row } of contentRows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        results.push(rowToSession(row, []));
      }
    }

    return results.slice(0, limit);
  }

  async count(): Promise<number> {
    const result = this.db.select({ cnt: sql<number>`COUNT(*)` }).from(sessions).all();
    return result[0].cnt;
  }

  async clear(): Promise<void> {
    this.db.delete(messages).run();
    this.db.delete(sessions).run();
  }

  async getMessages(
    sessionId: ChatId,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedMessages> {
    return this.loadMessages(sessionId, options);
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private getNextPosition(sessionId: string): number {
    const result = this.db.select({ maxPos: sql<number | null>`MAX(position)` })
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .all();
    return (result[0].maxPos ?? -1) + 1;
  }

  private incrementMessageCount(sessionId: string): void {
    const rows = this.db.select({ metadata: sessions.metadata }).from(sessions).where(eq(sessions.id, sessionId)).all();
    if (rows.length > 0) {
      const meta = JSON.parse(rows[0].metadata);
      meta.messageCount += 1;
      this.db.update(sessions)
        .set({ metadata: JSON.stringify(meta), updatedAt: new Date().toISOString() })
        .where(eq(sessions.id, sessionId))
        .run();
    }
  }

  private loadAllMessages(sessionId: string): ChatMessage[] {
    const rows = this.db.select().from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.position)
      .all();
    return rows.map(rowToMessage);
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function rowToSession(row: SessionRow, msgs: ChatMessage[]): ChatSession {
  return buildSession(
    row.id as ChatId,
    row.title,
    JSON.parse(row.config),
    JSON.parse(row.metadata),
    row.status as "active",
    row.createdAt,
    row.updatedAt,
    msgs,
  );
}

function buildSession(
  id: ChatId,
  title: string | undefined | null,
  config: ChatSessionConfig,
  metadata: ChatSession["metadata"],
  status: "active",
  createdAt: string,
  updatedAt: string,
  msgs: ChatMessage[],
): ChatSession {
  return { id, title: title ?? undefined, messages: msgs, config, metadata, status, createdAt, updatedAt };
}

function rowToMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id as ChatId,
    role: row.role as ChatMessage["role"],
    parts: JSON.parse(row.parts),
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    status: row.status as ChatMessage["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? undefined,
  };
}
