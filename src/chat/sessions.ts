/**
 * @witqq/agent-sdk/chat/sessions
 *
 * Session store layer wrapping generic storage adapters.
 * Provides session-specific operations: message management,
 * paginated retrieval, search, and session lifecycle.
 */

import type {
  ChatSession,
  ChatMessage,
  ChatId,
  ChatSessionConfig,
} from "./core.js";
import { createChatId } from "./core.js";
import type { IStorageAdapter, ListOptions } from "./storage.js";
import { InMemoryStorage, FileStorage, StorageError } from "./storage.js";
import { ErrorCode } from "../types/errors.js";

// ─── Session Store Interface ───────────────────────────────────

/** Options for creating a new session */
export interface CreateSessionOptions<TCustom extends Record<string, unknown> = Record<string, unknown>> {
  /** Session title (defaults to "Untitled") */
  title?: string;
  /** Session configuration (optional — runtime defaults used when omitted) */
  config?: Partial<ChatSessionConfig>;
  /** Initial tags */
  tags?: string[];
  /** Custom metadata */
  custom?: TCustom;
}

/** Paginated result of messages */
export interface PaginatedMessages {
  /** Messages in this page */
  messages: ChatMessage[];
  /** Total number of messages in session */
  total: number;
  /** Whether there are more messages after this page */
  hasMore: boolean;
}

/** Options for listing sessions */
export interface SessionListOptions {
  /** Filter predicate */
  filter?: (session: ChatSession) => boolean;
  /** Sort comparator */
  sort?: (a: ChatSession, b: ChatSession) => number;
  /** Maximum number of sessions to return */
  limit?: number;
  /** Number of sessions to skip */
  offset?: number;
}

/** Search options for finding sessions */
export interface SessionSearchOptions {
  /** Text query to match against title and message content */
  query: string;
  /** Maximum results (default: 20) */
  limit?: number;
}

/**
 * Read-only session operations.
 * Consumers needing read-only access (dashboards, analytics) implement only this.
 */
export interface ISessionReader {
  getSession(id: ChatId): Promise<ChatSession | null>;
  listSessions(options?: SessionListOptions): Promise<ChatSession[]>;
  loadMessages(
    sessionId: ChatId,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedMessages>;
  searchSessions(options: SessionSearchOptions): Promise<ChatSession[]>;
  count(): Promise<number>;
}

/**
 * Write/mutate session operations.
 * Consumers needing full access implement both ISessionReader & ISessionWriter.
 */
export interface ISessionWriter {
  createSession(options: CreateSessionOptions): Promise<ChatSession>;
  updateTitle(id: ChatId, title: string): Promise<void>;
  updateConfig(id: ChatId, config: Partial<ChatSessionConfig>): Promise<void>;
  deleteSession(id: ChatId): Promise<void>;
  appendMessage(sessionId: ChatId, message: ChatMessage): Promise<void>;
  saveMessages(sessionId: ChatId, messages: ChatMessage[]): Promise<void>;
  clear(): Promise<void>;
  /** Release any resources held by this store (optional). */
  dispose?(): Promise<void>;
}

/**
 * Full session store interface — union of reader and writer.
 * Backward-compatible: all existing implementations continue to work.
 *
 * @example
 * ```typescript
 * const store = new InMemorySessionStore();
 * const session = await store.createSession({ config: { model: "gpt-4", backend: "vercel-ai" } });
 * await store.appendMessage(session.id, message);
 * const page = await store.loadMessages(session.id, { limit: 20, offset: 0 });
 * ```
 */
export interface IChatSessionStore extends ISessionReader, ISessionWriter {}

// ─── Base Session Store ────────────────────────────────────────

/**
 * Base session store implementation backed by any `IStorageAdapter<ChatSession>`.
 * Handles all session-specific logic; subclasses only need to provide the adapter.
 */
class BaseSessionStore implements IChatSessionStore {
  constructor(protected readonly adapter: IStorageAdapter<ChatSession>) {}

  async createSession(options: CreateSessionOptions): Promise<ChatSession> {
    const now = new Date().toISOString();
    const id = createChatId();
    const session: ChatSession = {
      id,
      title: options.title ?? "Untitled",
      messages: [],
      config: {
        model: options.config?.model ?? "",
        backend: options.config?.backend ?? "",
        ...options.config,
      },
      metadata: {
        messageCount: 0,
        totalTokens: 0,
        tags: options.tags ? [...options.tags] : undefined,
        custom: options.custom ? { ...options.custom } : undefined,
      },
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    };
    await this.adapter.create(id, session);
    return structuredClone(session);
  }

  async getSession(id: ChatId): Promise<ChatSession | null> {
    return this.adapter.get(id);
  }

  async listSessions(options?: SessionListOptions): Promise<ChatSession[]> {
    return this.adapter.list(options as ListOptions<ChatSession>);
  }

  async updateTitle(id: ChatId, title: string): Promise<void> {
    const session = await this.adapter.get(id);
    if (!session) {
      throw new StorageError(`Session "${id}" not found`, ErrorCode.STORAGE_NOT_FOUND);
    }
    session.title = title;
    session.updatedAt = new Date().toISOString();
    await this.adapter.update(id, session);
  }

  async updateConfig(
    id: ChatId,
    config: Partial<ChatSessionConfig>,
  ): Promise<void> {
    const session = await this.adapter.get(id);
    if (!session) {
      throw new StorageError(`Session "${id}" not found`, ErrorCode.STORAGE_NOT_FOUND);
    }
    session.config = { ...session.config, ...config };
    session.updatedAt = new Date().toISOString();
    await this.adapter.update(id, session);
  }

  async deleteSession(id: ChatId): Promise<void> {
    await this.adapter.delete(id);
  }

  async appendMessage(sessionId: ChatId, message: ChatMessage): Promise<void> {
    const session = await this.adapter.get(sessionId);
    if (!session) {
      throw new StorageError(`Session "${sessionId}" not found`, ErrorCode.STORAGE_NOT_FOUND);
    }
    session.messages.push(structuredClone(message));
    session.metadata.messageCount = session.messages.length;
    session.updatedAt = new Date().toISOString();
    await this.adapter.update(sessionId, session);
  }

  async saveMessages(sessionId: ChatId, messages: ChatMessage[]): Promise<void> {
    if (messages.length === 0) return;
    const session = await this.adapter.get(sessionId);
    if (!session) {
      throw new StorageError(`Session "${sessionId}" not found`, ErrorCode.STORAGE_NOT_FOUND);
    }
    for (const msg of messages) {
      session.messages.push(structuredClone(msg));
    }
    session.metadata.messageCount = session.messages.length;
    session.updatedAt = new Date().toISOString();
    await this.adapter.update(sessionId, session);
  }

  async loadMessages(
    sessionId: ChatId,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedMessages> {
    const session = await this.adapter.get(sessionId);
    if (!session) {
      throw new StorageError(`Session "${sessionId}" not found`, ErrorCode.STORAGE_NOT_FOUND);
    }
    const total = session.messages.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? total;
    const messages = session.messages.slice(offset, offset + limit);
    return {
      messages: structuredClone(messages),
      total,
      hasMore: offset + limit < total,
    };
  }

  async searchSessions(
    options: SessionSearchOptions,
  ): Promise<ChatSession[]> {
    const query = options.query.toLowerCase();
    const limit = options.limit ?? 20;
    return this.adapter.list({
      filter: (session) => {
        if (session.title?.toLowerCase().includes(query)) return true;
        return session.messages.some((msg) => {
          return msg.parts.some(
            (part) =>
              part.type === "text" &&
              part.text.toLowerCase().includes(query),
          );
        });
      },
      limit,
    });
  }

  async count(): Promise<number> {
    return this.adapter.count();
  }

  async clear(): Promise<void> {
    return this.adapter.clear();
  }
}

// ─── InMemorySessionStore ──────────────────────────────────────

/**
 * In-memory session store. Data is lost when the process exits.
 * Uses `InMemoryStorage` internally.
 *
 * @example
 * ```typescript
 * const store = new InMemorySessionStore();
 * const session = await store.createSession({
 *   config: { model: "gpt-4", backend: "vercel-ai" },
 * });
 * ```
 */
export class InMemorySessionStore extends BaseSessionStore {
  constructor() {
    super(new InMemoryStorage<ChatSession>());
  }
}

// ─── FileSessionStore ──────────────────────────────────────────

/** Configuration for FileSessionStore */
export interface FileSessionStoreOptions {
  /** Directory to store session JSON files */
  directory: string;
}

/**
 * File-based session store. Each session is a JSON file on disk.
 * Uses `FileStorage` internally.
 *
 * @example
 * ```typescript
 * const store = new FileSessionStore({ directory: "./data/sessions" });
 * const session = await store.createSession({
 *   config: { model: "claude-3", backend: "claude" },
 * });
 * ```
 */
export class FileSessionStore extends BaseSessionStore {
  constructor(options: FileSessionStoreOptions) {
    super(new FileStorage<ChatSession>({ directory: options.directory }));
  }
}

// Re-export StorageError for consumers that only import from chat/sessions
export { StorageError } from "./storage.js";
