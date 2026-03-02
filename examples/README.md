# Examples

## Demo App

[`examples/demo/`](demo/) — Full working chat UI application with multi-backend auth, provider management, SSE streaming, and tool execution.

```bash
npm run demo              # Build & start in Docker (port 3456)
npm run demo -- stop      # Stop container
npm run demo -- restart   # Rebuild & restart
```

Uses: React frontend (`RemoteChatClient` + `ChatUI`), node:http server (`createChatServer`), SQLite storage (`createSQLiteStorage`), `TokenRefreshManager` for automatic token refresh. Server is ~130 lines; frontend is 16 lines.

Files: `server.ts`, `tools.ts`, `model-allowlist.ts`, `frontend/`, `Dockerfile`, `docker-compose.yml`.

See [`demo/README.md`](demo/README.md) for endpoints, configuration, and architecture details.

## Code Patterns

Standalone examples demonstrating specific SDK features. Each has its own README, tests, and no runtime dependencies on each other.

| Directory | What it demonstrates |
|---|---|
| [`sqlite-storage/`](sqlite-storage/) | `IChatSessionStore` implementation using better-sqlite3 with WAL mode and auto-created schema |
| [`drizzle-storage/`](drizzle-storage/) | `IChatSessionStore` implementation using Drizzle ORM with SQLite, adaptable to PostgreSQL/MySQL |
| [`framework-presets/`](framework-presets/) | Express, Hono, and Fastify adapter wrappers around SDK server handlers (`createChatHandler`, `createAuthHandler`) |
| [`usage-tracking/`](usage-tracking/) | `ChatMiddleware` that counts tokens from usage events and persists cumulative statistics per session |
| [`multi-user-runtime/`](multi-user-runtime/) | Per-user `IChatRuntime` instances with LRU cache eviction and idle timeout disposal |
| [`custom-transport/`](custom-transport/) | `IChatTransport` implementations for WebSocket, in-process, and NATS (with subject-based routing) |
| [`custom-renderers/`](custom-renderers/) | CSS theming via `data-*` selectors, `ThreadProvider` slot overrides, and per-tool custom renderers |

All code patterns have unit tests in `tests/unit/examples/`.
