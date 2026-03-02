/**
 * @witqq/agent-sdk/chat/storage
 *
 * Generic storage adapter layer with pluggable backends.
 * Provides CRUD operations for any data type via `IStorageAdapter<T>`.
 * Implementations: `InMemoryStorage` (Map-based) and `FileStorage` (JSON files).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgentSDKError } from "../errors.js";
import { ErrorCode } from "../types/errors.js";

// ─── Storage Errors ────────────────────────────────────────────

/**
 * Error thrown by storage operations.
 *
 * @example
 * ```typescript
 * try {
 *   await store.get("missing-id");
 * } catch (e) {
 *   if (e instanceof StorageError && e.code === ErrorCode.STORAGE_NOT_FOUND) {
 *     // handle missing item
 *   }
 * }
 * ```
 */
export class StorageError extends AgentSDKError {
  /** Machine-readable error code from the unified ErrorCode enum */
  readonly code: StorageErrorCode;

  constructor(message: string, code: StorageErrorCode) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

/** Storage-specific subset of ErrorCode */
export type StorageErrorCode =
  | ErrorCode.STORAGE_NOT_FOUND
  | ErrorCode.STORAGE_DUPLICATE_KEY
  | ErrorCode.STORAGE_IO_ERROR
  | ErrorCode.STORAGE_SERIALIZATION_ERROR;

// ─── Storage Adapter Interface ─────────────────────────────────

/**
 * Options for listing stored items.
 *
 * @typeParam T - The type of stored items
 */
export interface ListOptions<T> {
  /** Filter predicate — return `true` to include the item */
  filter?: (item: T) => boolean;
  /** Sort comparator — standard Array.sort semantics */
  sort?: (a: T, b: T) => number;
  /** Maximum number of items to return */
  limit?: number;
  /** Number of items to skip (for pagination) */
  offset?: number;
}

/**
 * Generic storage adapter for CRUD operations on any data type.
 * Items are identified by a string key.
 *
 * @typeParam T - The type of stored items
 *
 * @example
 * ```typescript
 * const store: IStorageAdapter<{ name: string }> = new InMemoryStorage();
 * await store.create("key1", { name: "Alice" });
 * const item = await store.get("key1"); // { name: "Alice" }
 * ```
 */
export interface IStorageAdapter<T> {
  /**
   * Retrieve an item by key.
   * @param key - Unique identifier
   * @returns The item, or `null` if not found
   */
  get(key: string): Promise<T | null>;

  /**
   * List items with optional filtering, sorting, and pagination.
   * @param options - Filter, sort, limit, offset options
   * @returns Array of matching items
   */
  list(options?: ListOptions<T>): Promise<T[]>;

  /**
   * Create a new item. Throws `StorageError` with code `DUPLICATE_KEY` if key exists.
   * @param key - Unique identifier
   * @param item - Data to store
   */
  create(key: string, item: T): Promise<void>;

  /**
   * Update an existing item. Throws `StorageError` with code `NOT_FOUND` if key missing.
   * @param key - Unique identifier
   * @param item - Updated data
   */
  update(key: string, item: T): Promise<void>;

  /**
   * Delete an item by key. Throws `StorageError` with code `NOT_FOUND` if key missing.
   * @param key - Unique identifier
   */
  delete(key: string): Promise<void>;

  /**
   * Check whether a key exists.
   * @param key - Unique identifier
   * @returns `true` if key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Return the number of stored items.
   * @returns Count of items
   */
  count(): Promise<number>;

  /**
   * Remove all items from storage.
   */
  clear(): Promise<void>;

  /**
   * Release any resources held by this adapter (DB connections, file handles).
   * Optional — adapters that don't hold resources need not implement this.
   */
  dispose?(): Promise<void>;
}

// ─── InMemoryStorage ───────────────────────────────────────────

/**
 * In-memory storage adapter backed by a `Map`.
 * Suitable for development, testing, and short-lived processes.
 * Data is lost when the process exits.
 *
 * @typeParam T - The type of stored items
 *
 * @example
 * ```typescript
 * const store = new InMemoryStorage<{ name: string }>();
 * await store.create("k1", { name: "Alice" });
 * await store.create("k2", { name: "Bob" });
 * const items = await store.list({ filter: i => i.name.startsWith("A") });
 * // [{ name: "Alice" }]
 * ```
 */
export class InMemoryStorage<T> implements IStorageAdapter<T> {
  private readonly data = new Map<string, T>();

  /** @inheritdoc */
  async get(key: string): Promise<T | null> {
    const item = this.data.get(key);
    return item !== undefined ? structuredClone(item) : null;
  }

  /** @inheritdoc */
  async list(options?: ListOptions<T>): Promise<T[]> {
    let items = Array.from(this.data.values()).map((item) => structuredClone(item));

    if (options?.filter) {
      items = items.filter(options.filter);
    }
    if (options?.sort) {
      items.sort(options.sort);
    }
    if (options?.offset !== undefined) {
      items = items.slice(options.offset);
    }
    if (options?.limit !== undefined) {
      items = items.slice(0, options.limit);
    }

    return items;
  }

  /** @inheritdoc */
  async create(key: string, item: T): Promise<void> {
    if (this.data.has(key)) {
      throw new StorageError(
        `Item with key "${key}" already exists`,
        ErrorCode.STORAGE_DUPLICATE_KEY,
      );
    }
    this.data.set(key, structuredClone(item));
  }

  /** @inheritdoc */
  async update(key: string, item: T): Promise<void> {
    if (!this.data.has(key)) {
      throw new StorageError(
        `Item with key "${key}" not found`,
        ErrorCode.STORAGE_NOT_FOUND,
      );
    }
    this.data.set(key, structuredClone(item));
  }

  /** @inheritdoc */
  async delete(key: string): Promise<void> {
    if (!this.data.has(key)) {
      throw new StorageError(
        `Item with key "${key}" not found`,
        ErrorCode.STORAGE_NOT_FOUND,
      );
    }
    this.data.delete(key);
  }

  /** @inheritdoc */
  async has(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  /** @inheritdoc */
  async count(): Promise<number> {
    return this.data.size;
  }

  /** @inheritdoc */
  async clear(): Promise<void> {
    this.data.clear();
  }
}

// ─── FileStorage ───────────────────────────────────────────────

/**
 * Options for configuring `FileStorage`.
 */
export interface FileStorageOptions {
  /** Directory path where JSON files are stored */
  directory: string;
  /** File extension (default: `.json`) */
  extension?: string;
}

/**
 * File-based storage adapter that persists each item as a JSON file.
 * Suitable for local applications, CLI tools, and development.
 * Creates the storage directory if it doesn't exist.
 *
 * @typeParam T - The type of stored items (must be JSON-serializable)
 *
 * @example
 * ```typescript
 * const store = new FileStorage<ChatSession>({
 *   directory: "./data/sessions",
 * });
 * await store.create("session-1", mySession);
 * ```
 */
export class FileStorage<T> implements IStorageAdapter<T> {
  private readonly directory: string;
  private readonly extension: string;

  constructor(options: FileStorageOptions) {
    this.directory = options.directory;
    this.extension = options.extension ?? ".json";
    this.ensureDirectory();
  }

  /** @inheritdoc */
  async get(key: string): Promise<T | null> {
    const filePath = this.keyToPath(key);
    if (!existsSync(filePath)) {
      return null;
    }
    return this.readFile(filePath);
  }

  /** @inheritdoc */
  async list(options?: ListOptions<T>): Promise<T[]> {
    this.ensureDirectory();
    const files = readdirSync(this.directory).filter((f) =>
      f.endsWith(this.extension),
    );

    let items: T[] = [];
    for (const file of files) {
      const item = this.readFile(join(this.directory, file));
      items.push(item);
    }

    if (options?.filter) {
      items = items.filter(options.filter);
    }
    if (options?.sort) {
      items.sort(options.sort);
    }
    if (options?.offset !== undefined) {
      items = items.slice(options.offset);
    }
    if (options?.limit !== undefined) {
      items = items.slice(0, options.limit);
    }

    return items;
  }

  /** @inheritdoc */
  async create(key: string, item: T): Promise<void> {
    const filePath = this.keyToPath(key);
    if (existsSync(filePath)) {
      throw new StorageError(
        `Item with key "${key}" already exists`,
        ErrorCode.STORAGE_DUPLICATE_KEY,
      );
    }
    this.writeFile(filePath, item);
  }

  /** @inheritdoc */
  async update(key: string, item: T): Promise<void> {
    const filePath = this.keyToPath(key);
    if (!existsSync(filePath)) {
      throw new StorageError(
        `Item with key "${key}" not found`,
        ErrorCode.STORAGE_NOT_FOUND,
      );
    }
    this.writeFile(filePath, item);
  }

  /** @inheritdoc */
  async delete(key: string): Promise<void> {
    const filePath = this.keyToPath(key);
    if (!existsSync(filePath)) {
      throw new StorageError(
        `Item with key "${key}" not found`,
        ErrorCode.STORAGE_NOT_FOUND,
      );
    }
    unlinkSync(filePath);
  }

  /** @inheritdoc */
  async has(key: string): Promise<boolean> {
    return existsSync(this.keyToPath(key));
  }

  /** @inheritdoc */
  async count(): Promise<number> {
    this.ensureDirectory();
    return readdirSync(this.directory).filter((f) =>
      f.endsWith(this.extension),
    ).length;
  }

  /** @inheritdoc */
  async clear(): Promise<void> {
    this.ensureDirectory();
    const files = readdirSync(this.directory).filter((f) =>
      f.endsWith(this.extension),
    );
    for (const file of files) {
      unlinkSync(join(this.directory, file));
    }
  }

  private keyToPath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, (c) =>
      "%" + c.charCodeAt(0).toString(16).padStart(2, "0"),
    );
    return join(this.directory, `${safeKey}${this.extension}`);
  }

  private ensureDirectory(): void {
    if (!existsSync(this.directory)) {
      mkdirSync(this.directory, { recursive: true });
    }
  }

  private readFile(filePath: string): T {
    try {
      const content = readFileSync(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new StorageError(
          `Failed to parse file: ${filePath}`,
          ErrorCode.STORAGE_SERIALIZATION_ERROR,
        );
      }
      throw new StorageError(
        `Failed to read file: ${filePath}`,
        ErrorCode.STORAGE_IO_ERROR,
      );
    }
  }

  private writeFile(filePath: string, item: T): void {
    try {
      const content = JSON.stringify(item, null, 2);
      writeFileSync(filePath, content, "utf-8");
    } catch {
      throw new StorageError(
        `Failed to write file: ${filePath}`,
        ErrorCode.STORAGE_IO_ERROR,
      );
    }
  }
}
