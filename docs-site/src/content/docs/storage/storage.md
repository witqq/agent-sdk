---
title: "Storage"
description: "SQLite-based chat storage and provider configuration"
---

The SDK provides a layered storage system for chat sessions, messages, and provider configuration.

## Architecture

```text
IStorageAdapter<T>          Generic CRUD interface
    |
    +-- InMemoryStorage     Map-backed, testing/dev
    +-- FileStorage         JSON file per record
    |
IChatSessionStore           Session-specific operations
    |
    +-- InMemorySessionStore
    +-- FileSessionStore
    +-- SQLiteSessionStore  (via createSQLiteStorage)
```

## IStorageAdapter

Generic CRUD interface for any data type.

```typescript
import type { IStorageAdapter, ListOptions } from "@witqq/agent-sdk/chat/storage";

interface IStorageAdapter<T> {
  get(key: string): Promise<T | null>;
  list(options?: ListOptions<T>): Promise<T[]>;
  create(key: string, item: T): Promise<void>;
  update(key: string, item: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  count(): Promise<number>;
  clear(): Promise<void>;
  dispose?(): Promise<void>;
}

interface ListOptions<T> {
  filter?: (item: T) => boolean;
  sort?: (a: T, b: T) => number;
  limit?: number;
  offset?: number;
}
```

### InMemoryStorage

```typescript
import { InMemoryStorage } from "@witqq/agent-sdk/chat/storage";

interface Config { model: string; temperature: number }

const store = new InMemoryStorage<Config>();

await store.create("default", { model: "gpt-4.1", temperature: 0.7 });
const config = await store.get("default");  // { model: "gpt-4.1", temperature: 0.7 }
await store.update("default", { model: "gpt-4.1", temperature: 0.3 });
await store.delete("default");
```

`InMemoryStorage` uses `structuredClone` on reads and writes. Mutations to returned objects do not affect stored data.

### FileStorage

One JSON file per record. Directory created on first write.

```typescript
import { FileStorage } from "@witqq/agent-sdk/chat/storage";

interface UserProfile { name: string; email: string }

const store = new FileStorage<UserProfile>({
  directory: "./data/profiles",
  extension: ".json",  // default
});

await store.create("user-1", { name: "Alice", email: "alice@example.com" });
const profiles = await store.list({
  filter: (p) => p.email.endsWith("@example.com"),
  sort: (a, b) => a.name.localeCompare(b.name),
  limit: 10,
});
```

Keys are percent-encoded to produce safe filenames.

## IChatSessionStore

Session-specific storage with reader/writer split.

```typescript
import type {
  IChatSessionStore,
  ISessionReader,
  ISessionWriter,
  CreateSessionOptions,
  PaginatedMessages,
  SessionListOptions,
  SessionSearchOptions,
} from "@witqq/agent-sdk/chat/sessions";
```

### Reader Interface

```typescript
interface ISessionReader {
  getSession(id: ChatId): Promise<ChatSession | null>;
  listSessions(options?: SessionListOptions): Promise<ChatSession[]>;
  loadMessages(sessionId: ChatId, options?: { limit?: number; offset?: number }): Promise<PaginatedMessages>;
  searchSessions(options: SessionSearchOptions): Promise<ChatSession[]>;
  count(): Promise<number>;
}
```

### Writer Interface

```typescript
interface ISessionWriter {
  createSession(options: CreateSessionOptions): Promise<ChatSession>;
  updateTitle(id: ChatId, title: string): Promise<void>;
  updateConfig(id: ChatId, config: Partial<ChatSessionConfig>): Promise<void>;
  deleteSession(id: ChatId): Promise<void>;
  appendMessage(sessionId: ChatId, message: ChatMessage): Promise<void>;
  saveMessages(sessionId: ChatId, messages: ChatMessage[]): Promise<void>;
  clear(): Promise<void>;
  dispose?(): Promise<void>;
}
```

`IChatSessionStore` extends both `ISessionReader` and `ISessionWriter`.

### Creating Sessions

```typescript
const session = await store.createSession({
  title: "Debug helper",
  config: {
    model: "gpt-4.1",
    backend: "copilot",
    systemPrompt: "You are a debugging assistant.",
    temperature: 0.2,
  },
  tags: ["debug", "tooling"],
  custom: { project: "agent-sdk" },
});
```

### Storing Messages

```typescript
import { toChatId, createChatId } from "@witqq/agent-sdk/chat/core";
import type { ChatMessage, TextPart } from "@witqq/agent-sdk/chat/core";

const messageId = createChatId();
const message: ChatMessage = {
  id: messageId,
  role: "user",
  parts: [{ type: "text", text: "What does this error mean?", status: "complete" }],
  createdAt: new Date().toISOString(),
  status: "complete",
};

await store.appendMessage(session.id, message);
```

### Loading Messages with Pagination

```typescript
const result = await store.loadMessages(session.id, {
  limit: 20,
  offset: 0,
});
// result: { messages: ChatMessage[], total: number, hasMore: boolean }
```

### Searching Sessions

```typescript
const sessions = await store.searchSessions({
  query: "debug",
  limit: 5,
});
```

### Listing with Filters

```typescript
const recent = await store.listSessions({
  sort: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  limit: 10,
  filter: (s) => s.metadata.tags?.includes("debug") ?? false,
});
```

## Data Types

### ChatSession

```typescript
interface ChatSession<TCustom extends Record<string, unknown> = Record<string, unknown>> {
  id: ChatId;
  title?: string;
  messages: ChatMessage[];
  config: ChatSessionConfig;
  metadata: ChatSessionMetadata<TCustom>;
  status: SessionStatus;  // "active"
  createdAt: string;
  updatedAt: string;
  backendSessionId?: string;
}

interface ChatSessionConfig {
  model: string;
  backend: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ChatSessionMetadata<TCustom extends Record<string, unknown> = Record<string, unknown>> {
  messageCount: number;
  totalTokens: number;
  tags?: string[];
  custom?: TCustom;
}
```

### ChatMessage

```typescript
interface ChatMessage<TMetadata = unknown> {
  id: ChatId;
  role: "user" | "assistant" | "system";
  parts: MessagePart[];
  metadata?: TMetadata;
  createdAt: string;
  updatedAt?: string;
  status: MessageStatus;  // "pending" | "streaming" | "complete" | "error" | "cancelled"
}
```

### MessagePart

Discriminated union on `type`:

| Type | Fields | Description |
|------|--------|-------------|
| `text` | `text: string`, `status` | Plain text content |
| `reasoning` | `text: string`, `status` | Model reasoning/thinking |
| `tool_call` | `toolCallId`, `name`, `args`, `result?`, `status`, `error?` | Tool invocation |
| `source` | `url: string`, `title?`, `status` | Reference URL |
| `file` | `name`, `mimeType`, `data: string`, `status` | Attached file (base64) |

## SQLite Storage

Production-ready storage using better-sqlite3. Creates session, provider, and token stores backed by a single database.

```typescript
import { createSQLiteStorage } from "@witqq/agent-sdk/chat/sqlite";

const storage = createSQLiteStorage("./data/chat.db");
// or
const storage = createSQLiteStorage({
  dbPath: "./data/chat.db",
});
```

Returns:

```typescript
interface SQLiteStorage {
  db: Database.Database;            // raw better-sqlite3 instance
  sessionStore: IChatSessionStore;  // session + message CRUD
  providerStore: IProviderStore;    // backend provider configs
  tokenStore: ITokenStore;          // auth token storage
}
```

The database uses WAL mode and foreign keys. Migrations run automatically on creation.

### Usage

```typescript
const { sessionStore } = createSQLiteStorage("./data/chat.db");

const session = await sessionStore.createSession({
  title: "Code review",
  config: { model: "gpt-4.1", backend: "copilot" },
});

await sessionStore.appendMessage(session.id, {
  id: createChatId(),
  role: "user",
  parts: [{ type: "text", text: "Review this PR", status: "complete" }],
  createdAt: new Date().toISOString(),
  status: "complete",
});

const messages = await sessionStore.loadMessages(session.id);
```

## Choosing a Store

| Store | Persistence | Concurrency | Use case |
|-------|------------|-------------|----------|
| `InMemorySessionStore` | None | Single process | Tests, prototyping |
| `FileSessionStore` | Disk (JSON) | Single process | Simple apps, dev |
| `SQLiteSessionStore` | Disk (SQLite) | Single process, multiple reads | Production |

`InMemoryStorage` and `FileStorage` (the generic adapters) are useful for non-session data like user preferences, provider configs, or custom application state.

## Cleanup

Stores with `dispose()` should be cleaned up on shutdown:

```typescript
process.on("SIGTERM", async () => {
  await sessionStore.dispose?.();
  process.exit(0);
});
```

---

**API Reference:** [Chat Storage](/api-reference/chat/storage/) · [Chat Sessions](/api-reference/chat/sessions/) · [Chat SQLite](/api-reference/chat/sqlite/)
