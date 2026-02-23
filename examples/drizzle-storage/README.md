# Drizzle ORM Session Store

IChatSessionStore implementation using [Drizzle ORM](https://orm.drizzle.team/) with SQLite.

## When to Use

- **Type-safe** database access with schema-as-code
- **Multi-database** — Drizzle supports SQLite, PostgreSQL, MySQL; adapt the schema for your target
- **Migration-ready** — Drizzle Kit generates migrations from schema definitions
- **Existing Drizzle projects** — integrate chat storage alongside your app's data layer

## Usage

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { DrizzleSessionStore } from "./drizzle-session-store.js";

const sqlite = new Database("./chat.db");
const db = drizzle(sqlite);
const store = new DrizzleSessionStore(db);
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

Drizzle table definitions are exported for use with Drizzle Kit:

```ts
import { sessions, messages } from "./drizzle-session-store.js";
```

| Table | Columns | Notes |
|-------|---------|-------|
| `sessions` | id, title, status, config, metadata, createdAt, updatedAt | config/metadata as JSON TEXT |
| `messages` | id, sessionId, role, parts, metadata, status, position, createdAt, updatedAt | parts/metadata as JSON TEXT |

## Adapting for PostgreSQL

Replace `sqliteTable` with `pgTable`, adjust column types:

```ts
import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  config: jsonb("config").$type<ChatSessionConfig>(),
  // ...
});
```

## Adapting for Production

- **Migrations** — use `drizzle-kit generate` + `drizzle-kit migrate`
- **Indexes** — add `.index()` on frequently queried columns
- **Connection pooling** — use `drizzle-orm/node-postgres` with a pool
- **Full-text search** — PostgreSQL `tsvector` or SQLite FTS5 for `searchSessions`
