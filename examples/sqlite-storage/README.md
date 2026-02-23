# SQLite Session Store

IChatSessionStore implementation using [better-sqlite3](https://github.com/WiseLibs/better-sqlite3).

## When to Use

- **Single-server** deployments where SQLite is sufficient
- **Embedded** applications (Electron, CLI tools)
- **Local-first** apps with no external database dependency
- **Prototyping** — zero setup, in-memory or file-based

## Usage

```ts
import Database from "better-sqlite3";
import { SQLiteSessionStore } from "./sqlite-session-store.js";

// File-based persistence
const db = new Database("./chat.db");
const store = new SQLiteSessionStore(db);

// In-memory (testing / ephemeral)
const memDb = new Database(":memory:");
const memStore = new SQLiteSessionStore(memDb);
```

Plug into `ChatRuntime`:

```ts
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";

const runtime = createChatRuntime({
  sessionStore: store,
  // ...other options
});
```

## Schema

Two tables created automatically on construction:

| Table | Columns | Notes |
|-------|---------|-------|
| `sessions` | id, title, status, config, metadata, created_at, updated_at | config/metadata stored as JSON TEXT |
| `messages` | id, session_id, role, parts, metadata, status, position, created_at, updated_at | parts/metadata stored as JSON TEXT, position for ordering |

SQLite pragmas: WAL journal mode, foreign keys enabled.

## Adapting for Production

This example is a starting point. For production consider:

- **Migrations** — version the schema, use a migration tool
- **Indexes** — add indexes on `sessions.status`, `messages.session_id`
- **Connection pooling** — better-sqlite3 is synchronous; consider worker threads for heavy load
- **Full-text search** — use SQLite FTS5 for `searchSessions` instead of `LIKE`
