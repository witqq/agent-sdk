# Changelog

## [0.8.0]

### New Features

- **WebSocket transport** — `WsChatTransport` implementing `IChatTransport` with heartbeat, reconnection, and binary frame support
- **In-process transport** — `InProcessChatTransport` for zero-network same-process runtime (testing, CLI, embedded)
- **Stream watchdog** — `StreamWatchdog` with configurable activity timeout for hanging streams using `CancellableTimeout`
- **Tool context injection** — `ToolContext` interface for passing runtime context to tools beyond args
- **Transport interceptors** — composable hook chain (`withInterceptors`) for transport-level event interception
- **Token auto-refresh** — `TokenRefreshManager` with background scheduling, retry, and jitter
- **Framework presets** — Express, Hono, and Fastify adapter examples with zero-dependency typing
- **Usage tracking middleware** — `createUsageMiddleware` for per-session token counting via `ChatMiddleware`
- **Multi-user runtime manager** — `MultiUserRuntimeManager` with LRU cache, idle timeout, concurrent-safe access, and BYOK pattern
- **Enhanced NATS transport** — `NatsChatRouter` with subject-based routing, `NatsChatClient` with request-reply and pub/sub streaming
- **SQLite storage adapter** — `IChatSessionStore` over better-sqlite3 (example)
- **Drizzle ORM storage adapter** — `IChatSessionStore` over Drizzle (example)
- **Custom renderer guide** — documentation for CSS theming, ThreadProvider slot overrides, and per-tool dispatch

### Improvements

- Demo app uses `ThreadProvider` with custom tool call renderer (slot override pattern)
- Custom transport guide in `docs/chat-sdk/custom-transports.md`
- Custom renderer guide in `docs/chat-sdk/custom-renderers.md`
- Phase 5 roadmap items (M11 + M12) checked off
- Project checklist updated with M11 and M12 items

## [0.7.0]

### New Features

- **`useRemoteChat` hook** — one-call React integration for remote chat with built-in auth, session management, and streaming
- **`RemoteChatRuntime`** — client-side `IChatRuntime` adapter delegating over HTTP/SSE to server
- **`createChatHandler`** — framework-agnostic HTTP handler mapping all `RemoteChatRuntime` endpoints to `IChatRuntime`
- **`createAuthHandler`** — server-mediated authentication handler for Copilot, Claude, and Vercel AI
- **`createChatServer`** — one-call server factory combining chat, auth, static serving, and CORS
- **`SSEChatTransport`** — Server-Sent Events transport with heartbeat and close detection
- **Token store** — `ITokenStore` with `InMemoryTokenStore` and `FileTokenStore`
- **Auth hooks** — `useAuth` (multi-backend), `AuthDialog` (headless UI)
- **Thread components** — `Thread`, `Composer`, `ThreadList`, `ThreadProvider` with slot-based customization
- **Model selector** — `useModels`, `ModelSelector` with keyboard navigation and tier badges
- **SSE hook** — `useSSE` with fetch-based streaming, reconnection, and status tracking
- **Barrel import** — `@witqq/agent-sdk/chat` re-exports core chat types
- **Context stats** — `getContextStats()` per session, `onContextTrimmed` callback
- **Async summarizer** — `ContextWindowManager.fitMessagesAsync()` with `ContextSummarizer`

### Improvements

- `ChatId` accepts `string` in all runtime methods (no more `as ChatId` casts)
- `/tokens/clear` now invokes `onLogout` callback (auto-dispose on token clear)
- `MessageAccumulator.snapshot()` shallow-copies parts for React `useSyncExternalStore` compatibility
- Pre-stream retry in `ChatRuntime.send()` with configurable `RetryConfig`
- Error auto-recovery: `send()` transitions from `error` → `idle` automatically
- `corsMiddleware` with multi-origin support and `Vary: Origin`

### Bug Fixes

- `StorageError` and `AuthError` now extend `AgentSDKError`
- `ModelInfo` type collision between core and react resolved

## [0.6.0]

### ⚠️ Breaking Changes (Vercel AI Backend)

This release updates the Vercel AI backend to SDK v6. If you use the Vercel AI backend, your code may need changes.

**Vercel AI SDK v6 renamed these APIs:**

| Before (v5) | After (v6) | Where |
|---|---|---|
| `parameters` | `inputSchema` | Tool schema registration |
| `maxSteps` | `stopWhen` + `stepCountIs()` | Multi-step loop control |
| `args` | `input` | Tool call stream parts, `toolCalls[]` in result |
| `result` | `output` | Tool result stream parts, `toolResults[]` in result |

**If you access `AgentResult.toolCalls`:** the `args` and `result` fields are unchanged in our public API (`AgentResult` type). No action needed — the rename is internal to the SDK adapter.

**If you use `providerOptions`:** this is a new feature (see below).

**If you mock the SDK in tests:** update mock data to use `input`/`output` instead of `args`/`result`.

Before:
```typescript
const mockResult = {
  toolCalls: [{ toolCallId: "tc-1", toolName: "search", args: { query: "test" } }],
  toolResults: [{ toolCallId: "tc-1", toolName: "search", result: "found" }],
};
const mockStream = [
  { type: "tool-call", toolCallId: "tc-1", toolName: "search", args: { query: "test" } },
  { type: "tool-result", toolCallId: "tc-1", toolName: "search", result: "found" },
];
```

After:
```typescript
const mockResult = {
  toolCalls: [{ toolCallId: "tc-1", toolName: "search", input: { query: "test" } }],
  toolResults: [{ toolCallId: "tc-1", toolName: "search", output: "found" }],
};
const mockStream = [
  { type: "tool-call", toolCallId: "tc-1", toolName: "search", input: { query: "test" } },
  { type: "tool-result", toolCallId: "tc-1", toolName: "search", output: "found" },
];
```

### Vercel AI Backend — Type Safety

All internal SDK type definitions rewritten:
- `SDKStreamPart`: discriminated union with 11 typed variants (was `{ type: string; [key: string]: any }`)
- `SDKGenerateTextResult`: typed `input`/`output` fields (was `any`)
- `SDKToolDefinition`: typed `unknown` params (was `any`)
- `SDKLanguageModel`: `Record<string, unknown>` (was `any`)
- `mapStreamPart()`: `Extract<>` narrowing per case branch (was untyped property access)

### Vercel AI Backend — `providerOptions`

New `AgentConfig.providerOptions` field passes model-specific options to Vercel AI SDK calls (`generateText`, `streamText`, `generateObject`).

```typescript
const agent = service.createAgent({
  model: "google/gemini-2.0-flash",
  systemPrompt: "Think step by step.",
  providerOptions: {
    google: { thinkingConfig: { thinkingBudget: 1024 } },
  },
});
```

Type: `Record<string, Record<string, unknown>>`. Ignored by Copilot and Claude backends.

### Tool Event Normalization

All three backends now emit consistent `tool_call_start` and `tool_call_end` events:

**Copilot:**
- `tool.execution_start`: `data.arguments` parsed from JSON string when SDK sends string instead of object
- `tool.execution_complete`: `data.result` unwrapped from `{ content: ... }` wrapper when present

**Claude:**
- `stripMcpPrefix()`: removes `mcp__agent-sdk-tools__` prefix from tool names in all events (`tool_call_start`, `tool_call_end`, permission requests)
- `tool_progress`: no longer emits spurious `tool_call_start` with empty args (was a heartbeat, not a tool call)
- `tool_use_summary`: always emits `tool_call_end` even when summary text is empty (previously dropped the event)
- `buildMcpServer()`: passes Zod shape (`zodSchema.shape`) instead of JSON Schema to SDK `tool()` — fixes MCP tool handler registration

### Claude Backend — `allowedTools`

`buildMcpConfig()` auto-populates `allowedTools` with MCP-format tool names (`mcp__agent-sdk-tools__<name>`). Without this, Claude Code CLI blocked MCP tools from executing.

### Web Demo

- Filterable model dropdown (text input filters `<select>` options)
- Vercel AI token persistence includes `baseUrl` for OpenRouter
- Docker volume: `external: true` with named `agent-sdk-tokens` volume
- Tool display: shows args and results in UI (previously empty for Vercel AI)

## [0.5.0]

### Supervisor Migration Gaps
- `session_info` streaming event: emits `sessionId`, `transcriptPath`, `backend` during streaming
- Claude transcript path: `~/.claude/projects/.session/sessions/{id}/conversation.jsonl`
- Copilot transcript path: `~/.copilot/session-state/{id}/events.jsonl`
- `IAgent.interrupt()` method for graceful operation interruption
- Claude backend: calls `SDKQuery.interrupt()` on active query
- Copilot backend: calls `session.abort()` on active session
- `ClaudeBackendOptions.env` and `CopilotBackendOptions.env` for custom subprocess environment
- Claude env merge order: `process.env` → custom `env` → `oauthToken`
- Copilot env forwarded to `CopilotClient` constructor
- `permissionMode` auto-set to `"default"` when `canUseTool` callback is configured

## [0.4.0]

### Auth Providers
- `CopilotAuth` — programmatic GitHub Device Flow authentication (`startDeviceFlow()`)
- `ClaudeAuth` — OAuth Authorization Code + PKCE authentication (`startOAuthFlow()`, `refreshToken()`)
- `ClaudeAuth.extractCode()` — extracts authorization code from raw input, redirect URL, or `code#state` format
- Auth token types: `AuthToken`, `CopilotAuthToken`, `ClaudeAuthToken`
- Flow result types: `DeviceFlowResult`, `OAuthFlowResult`, `OAuthFlowOptions`
- Error classes: `AuthError`, `DeviceCodeExpiredError`, `AccessDeniedError`, `TokenExchangeError`
- `ClaudeBackendOptions.oauthToken` field for OAuth token passthrough
- New entry point: `@witqq/agent-sdk/auth`

### Persistent Sessions (CLI Backends)
- `AgentConfig.sessionMode`: `"per-call"` (default) or `"persistent"`
- Copilot: reuses `CopilotSession` across `run()`/`stream()` calls
- Claude: captures `session_id` from events, passes it on subsequent calls
- `agent.sessionId` getter for external session tracking
- Auto-recovery: session cleared and recreated on error

### Model Listing
- Claude `listModels()` queries Anthropic `/v1/models` API with OAuth Bearer token (no more hardcoded models)
- Vercel AI `listModels()` queries provider `/models` endpoint without hardcoded fallbacks
- All backends return `[]` when model listing is unavailable

### Interactive Demo
- Web-based demo app (`examples/auth-demo/server.ts`) with HTTP UI at port 3456
- CLI demo app (`examples/auth-demo/index.ts`) with interactive terminal prompts
- Docker support with `docker-compose.yml` and token persistence via volumes
- Provider selection, auth flows, model selection, streaming chat with conversation history
- Base URL input for Vercel AI (OpenRouter, etc.)

## [0.2.0] — 2026-02-07

### Core
- `heartbeat` event type in `AgentEvent` — keepalive for long-running streams during tool execution gaps
- `AgentConfig.heartbeatInterval` — interval in milliseconds for emitting heartbeat events during streaming (default: off)
- `IAgent.streamWithContext(messages)` — streaming with full conversation history, mirrors `runWithContext` pattern
- `thinking_delta` event type in `AgentEvent` — reasoning text separated from output
- `toolCallId` field in `tool_call_start` and `tool_call_end` events — propagated from all three backends
- `UsageData` type with optional `model` and `backend` fields — enriched in `AgentResult.usage` and `usage_update` events
- `AgentConfig.onUsage` callback — fire-and-forget usage notification after run completion and during streaming

### Vercel AI Backend
- `reasoning-delta` stream parts emit `thinking_delta` events instead of `text_delta`, preventing reasoning text from leaking into main output
- Tool call events propagate `toolCallId` from SDK stream parts

### Copilot Backend
- Tool call events propagate `toolCallId` from SDK event data

### Claude Backend
- `ClaudeToolCallTracker` correlates `tool_use` block IDs with `tool_use_summary` events for consistent `toolCallId` propagation

## [0.1.1] — 2026-02-07

### Copilot Backend
- Auth check on client startup — throws `SubprocessError` immediately if not authenticated
- Default auto-approve permission handler in headless mode (no `onPermission` callback)
- Default auto-answer user input handler in headless mode (no `onAskUser` callback)
- `CopilotBackendOptions.cliArgs` — pass CLI flags (e.g. `--allow-all`) to Copilot subprocess
- `AgentConfig.systemMessageMode` — control system prompt mode (`"append"` default, `"replace"` opt-in)
- `AgentConfig.availableTools` — filter built-in tools available to the model

### Documentation
- Backend peer dependency table with version constraints and optional markers
- glibc system requirement for Copilot native binary
- Model naming conventions (full IDs vs short names)
- `cliArgs`, `systemMessageMode`, `availableTools` usage examples

## [0.1.0] — 2026-02-07

Initial release. Multi-backend AI agent abstraction layer.

- 3 backends: Copilot CLI, Claude CLI, Vercel AI SDK
- Unified `IAgent` / `IAgentService` interfaces
- Tool system: `ToolDeclaration` / `ToolDefinition` split
- Permission system v3.1 with scopes and stores
- Streaming events (13 event types)
- Structured output via Zod schemas
- Backend registry with lazy loading
