---
title: Crosscutting Concerns
project: "@witqq/agent-sdk"
---

# Crosscutting Concerns

## State Management (ARCHITECTURAL PRIORITY)

**Principle**: Client is the state keeper. Server (handler + runtime + adapter) is stateless. Every request carries all context needed to process it.

### Per-Request Data Passing

All mutable routing data flows through the call chain, never stored in server-side fields:

```
Client sends:     { sessionId, message, providerId }
Handler resolves: resolveRequestContext(providerId) → { backend, credentials, model }
Runtime receives: RuntimeSendOptions { model: string, backend: string, credentials: AuthToken }
Adapter receives: SendMessageOptions { model: string }
Agent receives:   RunOptions { model: string }
```

**Key type**: `RuntimeSendOptions` (`src/chat/types.ts:263-276`) — requires `model`, `backend`, `credentials`. Runtime validates all three at `runtime.ts:412-438`.

**Key function**: `resolveRequestContext()` (`src/chat/server/request-context.ts:56`) — resolves `providerId → { backend, credentials, model }` from stores on every request.

### Client State (acceptable)

| State | Location | Purpose |
|-------|----------|---------|
| `activeSessionId` | `RemoteChatClient._activeSessionId` | Which session UI is displaying |
| `selectedProviderId` | `RemoteChatClient._selectedProviderId` | Which provider user chose |
| React hooks state | `useChat`, `useSessions`, `useModels` | Component-local UI state |

### Server State (resolved — violations from pre-v0.7 architecture)

All server-side state violations identified pre-v0.7 have been resolved:

| Former Violation | Resolution |
|-----------|------|
| `session.config.model` writeback | Removed — model is per-request via `RuntimeSendOptions` |
| `session.config.backend` writeback | Removed — backend is per-request |
| `_cachedModel` in adapter | Removed — model flows through `RunOptions` per-call |
| `_toolsOverride` in adapter | Removed — tools flow via `SendMessageOptions.tools` |
| `_activeSessionId` in runtime | Removed — client-only concern in `RemoteChatClient` |

`HandlerState.currentModel` remains in the server handler as single-user convenience (demo scope). Multi-user deployments resolve model from `providerId` per-request.

## Authentication

**Approach**: Three-provider OAuth via CopilotAuth (Device Flow), ClaudeAuth (PKCE), and API key (Vercel AI). Auth runs server-side only ([ADR-0004](./adr/0004-server-mediated-auth.md)). Browser uses `useRemoteAuth` → `createAuthHandler` endpoints.

**State**: Tokens are persisted in `ITokenStore`. Credentials are resolved per-request via `resolveRequestContext()` — the handler never caches them.

**Affected**: auth, chat/server, chat/react

**Libraries**: `node:crypto` (server-side only). No auth framework dependency.

## Authorization

**Approach**: Two-level system. (1) Tool permissions via `IPermissionStore` with scopes: once, session, project, always. (2) Server hooks (`ChatServerHooks`) for model/backend/provider switching guards — throw to reject.

**Affected**: Core (PermissionStore), chat/server (hooks)

**Libraries**: None. Consumer-delegated policy.

## Error Handling

**Approach**: `AgentSDKError` base with `_agentSDKError` marker for cross-bundle instanceof. `ChatError` with 20-code `ChatErrorCode` enum. `classifyError(unknown)` maps any error to ChatError. `ExponentialBackoffStrategy` for retry with jitter. `withRetry()` respects AbortSignal and rate-limit headers.

**Affected**: All containers

**Libraries**: None. Built-in error hierarchy.

## Data Validation

**Approach**: Tool input via Zod schemas in `ToolDefinition.inputSchema`. Message validation at `runtime.send()`: whitespace check (current), maxLength planned. HTTP body via `readBody()` with configurable maxBodySize (default 1MB). `RuntimeSendOptions` requires `model`, `backend`, `credentials` — validated in `validateSendInput()` at `runtime.ts:412`.

**Affected**: Core (Zod), chat, chat/server

**Libraries**: `zod` (peer dep ^3.23.0 || ^4.0.0)

## Configuration

**Approach**: Three levels matching three lifecycles. (1) `AgentConfig` — frozen via `Object.freeze` at construction. (2) `ChatRuntimeOptions` — runtime-level (tools, middleware, session store). (3) `RuntimeSendOptions` — per-call routing (model, backend, credentials). Model is always per-call ([ADR-0002](./adr/0002-stateless-runtime.md)).

**Affected**: Core, chat, chat/server

**Libraries**: None. TypeScript interfaces + Object.freeze.

## Communication & Transport

**Approach**: `IChatTransport` interface with three implementations: `SSEChatTransport` (node:http), `WsChatTransport` (WebSocketLike abstraction), `InProcessChatTransport` (zero-network). `TransportInterceptor` pattern via `withInterceptors()`.

**Affected**: chat/backends, chat/server

**Libraries**: None. Minimal interfaces (WritableResponse, WebSocketLike).

## Data Persistence

**Approach**: Three-layer storage. `IStorageAdapter<T>` generic CRUD → domain stores (`IChatSessionStore`, `IProviderStore`, `ITokenStore`) → implementations (InMemory, File, SQLite). `createSQLiteStorage()` factory for single WAL-mode database. Persistence is the ONLY server-side state — and it's explicit, designed for it.

**Affected**: chat, chat/sqlite

**Libraries**: `better-sqlite3` (optional peer dep). No ORM.

## Context Window Management

**Approach**: `ContextWindowManager` trims messages before each `send()` call. Stateless — instantiated per-send at `runtime.ts:482`, configured via `ChatRuntimeOptions.context`. Stats stored per-session in `_contextStats` Map (acceptable: it's a read-only cache, not routing state).

**Strategies**: `truncate-oldest`, `sliding-window`, `summarize-placeholder` (async summarizer).

**Affected**: chat/runtime, chat/context

## Logging & Observability

**Current**: `console.warn` for deprecation warnings only. 20 `ChatErrorCode` values with `classifyError()`.

**Target**: `ILogger` interface injectable via options. Correlation IDs per `send()`. Replace `console.*` calls.

**Affected**: All containers (currently none structured)

**Libraries**: None planned — ILogger allows consumer to inject any logger.
