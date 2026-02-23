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
 * Session store interface for managing chat sessions.
 * Wraps a storage adapter with session-specific operations.
 *
 * @example
 * ```typescript
 * const store = new InMemorySessionStore();
 * const session = await store.createSession({ config: { model: "gpt-4", backend: "vercel-ai" } });
 * await store.appendMessage(session.id, message);
 * const page = await store.loadMessages(session.id, { limit: 20, offset: 0 });
 * ```
 */
export interface IChatSessionStore {
  /**
   * Create a new session with defaults.
   * @param options - Session creation options
   * @returns The created session
   */
  createSession(options: CreateSessionOptions): Promise<ChatSession>;

  /**
   * Retrieve a session by ID.
   * @param id - Session ID
   * @returns The session, or `null` if not found
   */
  getSession(id: ChatId): Promise<ChatSession | null>;

  /**
   * List sessions with optional filtering, sorting, and pagination.
   * @param options - List options
   * @returns Array of sessions
   */
  listSessions(options?: SessionListOptions): Promise<ChatSession[]>;

  /**
   * Update session title.
   * @param id - Session ID
   * @param title - New title
   * @throws {StorageError} with code `NOT_FOUND` if session doesn't exist
   */
  updateTitle(id: ChatId, title: string): Promise<void>;

  /**
   * Update session configuration.
   * @param id - Session ID
   * @param config - Partial config to merge
   * @throws {StorageError} with code `NOT_FOUND` if session doesn't exist
   */
  updateConfig(
    id: ChatId,
    config: Partial<ChatSessionConfig>,
  ): Promise<void>;

  /**
   * Delete a session by ID.
   * @param id - Session ID
   * @throws {StorageError} with code `NOT_FOUND` if session doesn't exist
   */
  deleteSession(id: ChatId): Promise<void>;

  /**
   * Append a single message to a session.
   * Updates session metadata (messageCount, updatedAt).
   * @param sessionId - Session ID
   * @param message - Message to append
   * @throws {StorageError} with code `NOT_FOUND` if session doesn't exist
   */
  appendMessage(sessionId: ChatId, message: ChatMessage): Promise<void>;

  /**
   * Append multiple messages to a session in bulk.
   * No-op if messages array is empty.
   * @param sessionId - Session ID
   * @param messages - Messages to append
   * @throws {StorageError} with code `NOT_FOUND` if session doesn't exist
   */
  saveMessages(sessionId: ChatId, messages: ChatMessage[]): Promise<void>;

  /**
   * Get paginated messages from a session.
   * @param sessionId - Session ID
   * @param options - Pagination options (limit, offset)
   * @returns Paginated messages result
   * @throws {StorageError} with code `NOT_FOUND` if session doesn't exist
   */
  loadMessages(
    sessionId: ChatId,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedMessages>;

  /**
   * Archive a session (set status to "archived").
   * @param id - Session ID
   * @throws {StorageError} with code `NOT_FOUND` if session doesn't exist
   */
  archiveSession(id: ChatId): Promise<void>;

  /**
   * Unarchive a session (set status back to "active").
   * @param id - Session ID
   * @throws {StorageError} with code `NOT_FOUND` if session doesn't exist
   */
  unarchiveSession(id: ChatId): Promise<void>;

  /**
   * Search sessions by title and message content.
   * Case-insensitive substring match.
   * @param options - Search query and limit
   * @returns Matching sessions (without full message content)
   */
  searchSessions(options: SessionSearchOptions): Promise<ChatSession[]>;

  /**
   * Return the number of stored sessions.
   */
  count(): Promise<number>;

  /**
   * Remove all sessions.
   */
  clear(): Promise<void>;

  // ── Deprecated Aliases ──────────────────────────────────────

  /**
   * @deprecated Use `appendMessage()` instead. Will be removed in next major.
   */
  addMessage(sessionId: ChatId, message: ChatMessage): Promise<void>;

  /**
   * @deprecated Use `loadMessages()` instead. Will be removed in next major.
   */
  getMessages(
    sessionId: ChatId,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedMessages>;
}

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
      throw new StorageError(`Session "${id}" not found`, "NOT_FOUND");
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
      throw new StorageError(`Session "${id}" not found`, "NOT_FOUND");
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
      throw new StorageError(`Session "${sessionId}" not found`, "NOT_FOUND");
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
      throw new StorageError(`Session "${sessionId}" not found`, "NOT_FOUND");
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
      throw new StorageError(`Session "${sessionId}" not found`, "NOT_FOUND");
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

  async archiveSession(id: ChatId): Promise<void> {
    const session = await this.adapter.get(id);
    if (!session) {
      throw new StorageError(`Session "${id}" not found`, "NOT_FOUND");
    }
    session.status = "archived";
    session.updatedAt = new Date().toISOString();
    await this.adapter.update(id, session);
  }

  async unarchiveSession(id: ChatId): Promise<void> {
    const session = await this.adapter.get(id);
    if (!session) {
      throw new StorageError(`Session "${id}" not found`, "NOT_FOUND");
    }
    session.status = "active";
    session.updatedAt = new Date().toISOString();
    await this.adapter.update(id, session);
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

  // ── Deprecated Aliases ──────────────────────────────────────

  /** @deprecated Use `appendMessage()` instead */
  async addMessage(sessionId: ChatId, message: ChatMessage): Promise<void> {
    return this.appendMessage(sessionId, message);
  }

  /** @deprecated Use `loadMessages()` instead */
  async getMessages(
    sessionId: ChatId,
    options?: { limit?: number; offset?: number },
  ): Promise<PaginatedMessages> {
    return this.loadMessages(sessionId, options);
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
