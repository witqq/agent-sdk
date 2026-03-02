# CLAUDE.md — agent-sdk

## Project

AI agent abstraction layer (npm package).
3 backends: Copilot CLI SDK, Claude CLI SDK, Vercel AI SDK v6.
Shared interfaces for tools, permissions, streaming, structured output.

## Build

```bash
npm run build     # tsup → ESM + CJS + DTS
npm run test      # vitest
npm run typecheck # tsc --noEmit
```

## Architecture

CLI SDKs (Copilot, Claude) ARE the agent runtime — they decide tool calls.
API SDKs (Vercel AI) — WE drive the tool loop via generateText().

Key types: `ToolDeclaration` (schema only) / `ToolDefinition` (with execute, returns `unknown`) / `ToolDefinitionLike` (union of either) / `ToolContext` (request-scoped session data for tools).
`ModelInfo`: `{ id, name?, description?, provider?, contextWindow?: number }` — `contextWindow` populated from backend APIs (Copilot: `max_context_window_tokens`, Claude: `max_input_tokens`, Vercel/OpenRouter: `context_length`).
`AgentServiceLike`: structural `Pick<IAgentService, ...>` for loose typing of agent service consumers.
Permission v3.1: scopes `once | session | project | always`.
Zod compatibility: v3.23+ and v4.x (peer dep `^3.23.0 || ^4.0.0`).
Permission store: `IPermissionStore` with `InMemoryPermissionStore`, `FilePermissionStore`, `CompositePermissionStore`.
Error hierarchy: `AgentSDKError` base class with `_agentSDKError` marker and `AgentSDKError.is()` static method for cross-bundle instanceof checks (tsup bundles duplicate classes). `StorageError` (uses `ErrorCode.STORAGE_*` codes), `AuthError`, `ChatError` all extend `AgentSDKError`.
`ErrorCode` enum: 28 codes across auth, network, provider, tool, session, storage, and SDK-internal categories. Includes 4 storage-specific codes (STORAGE_NOT_FOUND, STORAGE_DUPLICATE_KEY, STORAGE_IO_ERROR, STORAGE_SERIALIZATION_ERROR).

### Package Exports

```
@witqq/agent-sdk           → src/index.ts (types, registry, factory, permission store)
@witqq/agent-sdk/copilot   → src/backends/copilot.ts
@witqq/agent-sdk/claude    → src/backends/claude.ts
@witqq/agent-sdk/vercel-ai → src/backends/vercel-ai.ts
@witqq/agent-sdk/auth      → src/auth/index.ts (CopilotAuth, ClaudeAuth, TokenRefreshManager, token types)
@witqq/agent-sdk/chat         → src/chat/index.ts (barrel re-export of common consumer types from core, runtime, sessions, errors, backends, context, accumulator, events)
@witqq/agent-sdk/chat/core    → src/chat/core.ts (ChatMessage, ChatSession, ChatEvent, IChatProvider (deprecated alias → IChatBackend), bridge functions)
@witqq/agent-sdk/chat/errors   → src/chat/errors.ts (ChatSDKError hierarchy, classifyError, retry strategies)
@witqq/agent-sdk/chat/events   → src/chat/events.ts (TypedEventEmitter, ChatEventBus, middleware, filter/map utilities)
@witqq/agent-sdk/chat/storage  → src/chat/storage.ts (IStorageAdapter, InMemoryStorage, FileStorage, StorageError)
@witqq/agent-sdk/chat/sessions → src/chat/sessions.ts (IChatSessionStore, InMemorySessionStore, FileSessionStore)
@witqq/agent-sdk/chat/context  → src/chat/context.ts (ContextWindowManager, estimateTokens, overflow strategies)
@witqq/agent-sdk/chat/accumulator → src/chat/accumulator.ts (MessageAccumulator)
@witqq/agent-sdk/chat/state     → src/chat/state.ts (StateMachine, transition maps, factory functions)
@witqq/agent-sdk/chat/backends  → src/chat/backends/index.ts (IChatBackend, IResumableBackend, BaseBackendAdapter, ResumableChatAdapter, CopilotChatAdapter, ClaudeChatAdapter, VercelAIChatAdapter, SSEChatTransport, WsChatTransport, InProcessChatTransport, IChatTransport, CloseDetectable, SSETransportOptions, WebSocketLike, WsTransportOptions, TransportInterceptor, withInterceptors)
@witqq/agent-sdk/chat/runtime   → src/chat/runtime.ts (IChatClient, IChatRuntime, ChatRuntime, createChatRuntime, BackendAdapterFactory, ChatRuntimeOptions, StreamRetryConfig, RetryConfig (deprecated alias), BackendInfo, SelectionChangeCallback)
@witqq/agent-sdk/chat/react     → src/chat/react/index.ts (ChatProvider, useChatRuntime, useChat, useMessages, useSessions, useToolApproval, useSSE, useModels, useBackends, useProviders, useRemoteAuth, useRemoteChat, useVirtualMessages, Message, ThinkingBlock, ToolCallView, MarkdownRenderer, PermissionDialog, Thread, Composer, ThreadSlots, ThreadList, ModelSelector, BackendSelector, ProviderSelector, ProviderModelSelector, ProviderSettings, ChatUI, ChatLayout, ChatHeader, ChatInputArea, ChatSettingsOverlay, UsageBadge, RemoteChatClient, CopilotAuthForm, ClaudeAuthForm, VercelAIAuthForm, useCopilotAuth, useClaudeAuth, useApiKeyAuth)
@witqq/agent-sdk/chat/react/theme.css → src/chat/react/theme.css (default CSS theme with custom properties, light/dark mode)
@witqq/agent-sdk/chat/sqlite  → src/chat/sqlite/index.ts (SQLiteSessionStore, SQLiteProviderStore, SQLiteTokenStore, createSQLiteStorage factory — unified single-DB storage, better-sqlite3 optional peer dep)
@witqq/agent-sdk/chat/server   → src/chat/server/index.ts (createChatHandler, createAuthHandler, createChatServer, createProviderHandler, corsMiddleware, ServiceManager, ServiceManagerOptions, ManagedService, RefreshFactory, DEFAULT_PROVIDER_MODELS, ITokenStore, InMemoryTokenStore, FileTokenStore, FileTokenStoreOptions, IProviderStore, ProviderConfig, InMemoryProviderStore, FileProviderStore, FileProviderStoreOptions, ProviderHandlerOptions, AuthHandlerOptions, OnAuthCallback, ChatHandlerOptions, ChatServerHooks, ChatServerOptions, ChatRuntimeConfig, RequestHandler, TransportFactory, RouteContext, RouteHandler, HandlerState, CorsOptions, ReadableRequest, WritableResponse, readBody, json, BodyParseError, AdapterPool, AdapterPoolOptions, AdapterFactory, PooledAdapter, resolveRequestContext, RequestContext, RequestContextDeps, sessionRoutes, messageRoutes, configRoutes, providerRoutes)
@witqq/agent-sdk/testing       → src/testing/index.ts (createMockSession, createMockMessage, createMockAgentService, createMockRuntime, createMockChatClient — mock factories for testing SDK consumers)
```

### Registry

`registerBackend(name, factory)` + `createAgentService(name, options)`.
Built-in backends: `copilot`, `claude`, `vercel-ai` (lazy-loaded via dynamic import).
Custom backends registered at runtime.

### BaseAgent

Abstract class with state machine: `idle → running/streaming → idle → disposed`.
Re-entrancy guard: throws `ReentrancyError` on concurrent runs.
Abort controller: `abort()` + external `AbortSignal` linking + `cleanupRun()` for listener removal.
Backends extend and implement `executeRun`, `executeRunStructured`, `executeStream`.
Model is REQUIRED per-call: `RunOptions.model: string` — no model storage at agent level.
Config is frozen via `Object.freeze()` at construction.
`RunOptions` extends `CallOptions` with `model: string` (required) — per-call overrides for model, tools, systemMessage, providerOptions, maxTokens, timeout, retry.
`resolveTools(options?)`: returns `options.tools ?? config.tools ?? []` — per-call tool override.
Usage enrichment (`enrichAndNotifyUsage`, `enrichStream`) uses `options.model` directly for per-call model in usage data.
Built-in retry: `isRetryableError()` (private), `withRetry()` (wraps run/runWithContext/runStructured), `streamWithRetry()` (pre-stream retry for stream/streamWithContext). Uses `RetryConfig` from `CallOptions.retry`. Never retries AbortError, ReentrancyError, DisposedError. Exponential backoff with `initialDelayMs` × `backoffMultiplier`.

### Shared Backend Utilities (`src/backends/shared.ts`)

Common utilities extracted from copilot.ts and claude.ts to eliminate duplication.
- `extractLastUserPrompt(messages)`: finds last user message text
- `buildContextualPrompt(messages)`: builds prompt with conversation history for CLI backends with fresh sessions

### Copilot Backend (`src/backends/copilot.ts`)

`CopilotAgentService` wraps `@github/copilot-sdk` (optional peer dep).
- `ensureClient()`: lazy init, explicit `start()`, auth check, caches via promise
- Session modes: `per-call` (default) creates fresh session per call; `persistent` reuses session across calls
- `getOrCreateSession()`: session lifecycle — reuse persistent or create new; persistent always streaming=true; accepts required `RunOptions` (model is required); detects model mismatch on persistent sessions and recreates cleanly (destroys old session, creates new with updated model)
- `_persistentModel`: tracks the model of the current persistent session for mismatch detection
- `clearPersistentSession()`: error recovery — clears broken session so next call creates fresh one; also clears `_persistentModel`
- `sessionId` getter: exposes CLI session ID for persistent mode tracking
- `ToolCallTracker`: maps `toolCallId` → `toolName` (SDK's `tool.execution_complete` lacks name)
- Tool event parsing: `tool.execution_start` args parsed from JSON string; `tool.execution_complete` result unwrapped from `{ content: ... }` wrapper
- `ThinkingTracker`: tracks reasoning state, emits `thinking_start`/`thinking_delta`/`thinking_end` from `assistant.reasoning_delta` events
- `mapToolsToSDK()`: `ToolDefinition[]` → SDK `Tool[]` with `convertParameters` (Zod→JSON Schema or passthrough)
- `_initToolsAsync()`: calls `mapToolsToSDK()` to pre-convert tools before first session; `_toolsReady` promise awaited in `getOrCreateSession()`
- `buildPermissionHandler()`: `SupervisorHooks.onPermission` → SDK `onPermissionRequest` (auto-approve default)
- `buildUserInputHandler()`: `SupervisorHooks.onAskUser` → SDK `onUserInputRequest` (auto-answer default)
- `cliArgs` passthrough from `CopilotBackendOptions` to `CopilotClient`
- `systemMessageMode` (default "append") and `availableTools` from `AgentConfig`
- Structured output: prompt augmentation + JSON parsing from response text
- Test injection: `_injectSDK()` / `_resetSDK()` for mock SDK in unit tests

### Claude Backend (`src/backends/claude.ts`)

`ClaudeAgentService` wraps `@anthropic-ai/claude-agent-sdk` (optional peer dep).
- `query()` call with async iterator for streaming events
- `buildCanUseTool()`: `SupervisorHooks.onPermission` → SDK `canUseTool` callback
- `buildQueryOptions()`: maps `availableTools` to `opts.tools` (restricts tool availability); `opts.allowedTools` reserved for MCP auto-approval
- `buildMcpConfig()` / `buildMcpServer()`: converts ToolDefinitions to MCP tool format (Zod shape, not JSON Schema), auto-populates `allowedTools` with `mcp__agent-sdk-tools__<name>` entries
- `stripMcpPrefix()`: normalizes MCP tool names (removes `mcp__agent-sdk-tools__` prefix) in all tool events
- `tool_progress` handling: returns `null` (heartbeat, not a tool call start)
- `tool_use_summary`: always emits `tool_call_end` even with empty summary
- Structured output: prompt augmentation + JSON parsing from response text
- Persistent sessions: `sessionMode: "persistent"` → captures `session_id` from result, passes `resume: sessionId` on subsequent calls, `persistSession: true`
- Error recovery: `clearPersistentSession()` on errors, next call starts fresh
- `thinkingBlockIndices`: Set<number> tracks thinking content block indices for `thinking_start`/`thinking_delta`/`thinking_end` emission from stream events
- `onAskUser` not supported (warning emitted if set)
- `buildQueryOptions()` accepts required `RunOptions` for per-call model (uses `options.model` directly)
- Test injection: `_injectSDK()` / `_resetSDK()` (module-level mock, no caching)

### Vercel AI Backend (`src/backends/vercel-ai.ts`)

`VercelAIAgentService` wraps Vercel AI SDK v6 (`ai` + `@ai-sdk/openai-compatible`).
- Local SDK type definitions match v6 API: `input`/`output` (not v5 `args`/`result`), discriminated `SDKStreamPart` union
- `generateText()` for runs with multi-step tool loop (`stopWhen: stepCountIs(n)`)
- `generateObject()` for structured output with Zod schema validation
- `streamText()` with `fullStream` iteration for streaming
- `mapStreamPart()`: converts SDK stream parts to `AgentEvent` using `Extract<>` type narrowing
- `mapToolsToSDK()`: converts ToolDefinitions to Vercel AI tool format (`inputSchema` via `sdk.jsonSchema()`)
- `wrapToolExecute()`: permission checks before tool execution
- `providerOptions` passthrough from `AgentConfig` to all SDK calls (e.g. `{ google: { thinkingConfig: { thinkingBudget: 1024 } } }`)
- `onAskUser` supported via injected `ask_user` tool
- `listModels()`: tries `/models` endpoint via fetch, falls back to OpenAI presets for `openai.com` base URL, returns empty for unknown providers
- `getModel(options)`: uses `options.model` (required) — creates fresh model instance per call, no caching
- `getSDKTools(signal, options?)`: per-call tool override via `resolveTools(options)`
- No subprocess management — pure API calls

### Auth Providers (`src/auth/`)

Programmatic OAuth authentication for Copilot and Claude backends.
No token storage — returns tokens, app stores them.

- `CopilotAuth` — GitHub Device Flow: `startDeviceFlow()` → `{ userCode, verificationUrl, waitForToken() }`
- `ClaudeAuth` — OAuth Authorization Code + PKCE: `startOAuthFlow()` → `{ authorizeUrl, completeAuth(codeOrUrl) }`, `refreshToken()`
- Types: `AuthToken`, `CopilotAuthToken`, `ClaudeAuthToken`, `DeviceFlowResult`, `OAuthFlowResult`
- Errors: `AuthError` (extends `AgentSDKError`), `DeviceCodeExpiredError`, `AccessDeniedError`, `TokenExchangeError`
- Dependency injection: `fetch` via constructor for testability
- `TokenRefreshManager` — automatic background token refresh with configurable threshold (default 80%), exponential backoff retry, event emission (`refreshed`, `error`, `expired`, `disposed`), clean lifecycle (`start`/`stop`/`dispose`)
- Types: `TokenRefreshOptions` (token, refresh fn, threshold, retries, delays), `TokenRefreshEvents` (event signatures)

### Chat Core (`src/chat/core.ts`)

Higher-level chat abstractions extending the base agent types.
- `ChatId`: branded string type, `createChatId()` via `crypto.randomUUID()`, `toChatId(str)` for casting with UUID validation
- `ChatIdLike`: `string | ChatId` — accepted by all public `IChatRuntime` methods, validated via `toChatId()` at boundary
- `MessagePart`: 5-variant discriminated union (`TextPart`, `ReasoningPart`, `ToolCallPart`, `SourcePart`, `FilePart`), each with `status: PartStatus`
- `PartStatus`: `"pending" | "streaming" | "complete" | "error"` for per-part lifecycle tracking
- `ChatMessage<TMetadata>`: generic message with id, role, parts array, metadata, status, timestamps
- `ChatSession<TCustom>`: pure serializable data container with messages, config, metadata (`TCustom` defaults to `Record<string, unknown>` for `metadata.custom` field). No reactive API — see `ObservableSession`.
- `ObservableSession<TCustom>`: reactive wrapper extending `ChatSession` with `subscribe()`, `getSnapshot()` (for React `useSyncExternalStore`), `lastMessage`. Session stores may optionally return these.
- `SessionInfo`: lightweight session listing type (id, title, updatedAt, messageCount, status)
- `ChatEvent`: 18-type discriminated union with colon-separated names (e.g. `message:start`, `tool:complete`, `done`)
- `IChatProvider`: **@deprecated** — type alias for `IChatBackend`. Previously abstract provider interface; methods now inlined into `IChatBackend`.
- `ChatMiddleware`: runtime middleware with 4 lifecycle hooks (beforeSend, onEvent, afterReceive, onError)
- `SendMessageOptions`: per-send-call overrides — `model?` (string, required for server-side runtime.send()), `systemPrompt?` (per-call override), `signal?` (AbortSignal), `tools?` (ToolDefinition[])
- Type guards: `isChatMessage()`, `isChatSession()`, `isMessagePart()`, `isTextPart()`, `isReasoningPart()`, `isToolCallPart()`, `isSourcePart()`, `isFilePart()`, `isChatEvent()`
- Utilities: `getMessageText()`, `getMessageToolCalls()`, `getMessageReasoning()`, `createTextMessage(text, role?)`, `isObservableSession(session)`
- Bridge: `agentEventToChatEvent()` maps AgentEvent→ChatEvent, `chatEventToAgentEvent()` maps ChatEvent→AgentEvent (returns null for non-accumulator events), `adaptAgentEvents()` async generator
- Conversion: `toAgentMessages()` (plural, returns `Message[]` — handles tool results correctly) / `toAgentMessage()` (@deprecated alias, returns first message only) / `fromAgentMessage()` for ChatMessage↔Message

### Chat Accumulator (`src/chat/accumulator.ts`)

Stream-to-message converter for building chat UIs.
- `MessageAccumulator`: stateful converter from `AgentEvent` stream to `ChatMessage` with `MessagePart[]`
- Text accumulation with splitting on non-text events (tool calls, thinking blocks)
- Parallel tool call tracking via `toolCallId` Map
- Interleaved thinking block support (multiple reasoning parts)
- Per-part `PartStatus` transitions: pending → streaming → complete (or error)
- `snapshot()`: returns immutable `ChatMessage` copy (shallow-copies each part for React `useSyncExternalStore` compatibility)
- `finalize()`: completes all open parts; incomplete tool calls set to `status: "error"`; throws on double-finalize
- Guards: throws on `apply()` after finalize

### Stream Watchdog (`src/chat/watchdog.ts`)

Activity-based timeout wrapper for async event streams.
- `withStreamWatchdog<T>(source, config)`: async generator wrapping any `AsyncIterable<T>` with inactivity timeout
- `StreamWatchdogConfig`: `{ timeoutMs: number; signal?: AbortSignal }`
- Uses `Promise.race()` per iteration: `iterator.next()` vs `CancellableTimeout`
- Timer resets on each received event (fresh timeout per race)
- Throws `ChatError(TIMEOUT)` when inactivity exceeds `timeoutMs`
- Respects external `AbortSignal` (early exit without timeout error)
- `CancellableTimeout`: internal class preventing timer leaks and unhandled promise rejections

### Chat Errors (`src/chat/errors.ts`)

Error classification and retry system.
- `ChatError` extends `AgentSDKError`: single error class with `code: ErrorCode`, `retryable`, `timestamp`
- Uses unified `ErrorCode` enum (28 codes) from `src/types/errors.ts` — re-exported as `ErrorCode`
- `ChatSDKError`: backward compat alias for `ChatError`
- `classifyError(unknown)`: pattern-matching classifier (network patterns, HTTP status codes, Zod errors, timeouts, context overflow)
- `ExponentialBackoffStrategy`: configurable `baseMs`, `maxMs`, `maxAttempts`, `jitter`; respects rate limit retry-after
- `withRetry(fn, strategy, options?)`: async retry wrapper with `AbortSignal` and `onRetry` callback
- `isRetryable(error)`: checks if error is retryable

### Chat Events (`src/chat/events.ts`)

Type-safe event emitter with middleware pipeline.
- `TypedEventEmitter<T extends EventMap>`: generic emitter with `on`/`off`/`once`/`emit`/`removeAllListeners`/`listenerCount`/`eventNames`
- `ChatEventBus` extends `TypedEventEmitter<ChatEventMap>`: specialized for ChatEvent types
- Middleware pipeline: `use(middleware)` → events pass through middleware chain before reaching listeners
- `EventMiddleware`: `(ctx: MiddlewareContext) => void` with `ctx.event`, `ctx.next()`, `ctx.suppress()`
- `clearMiddleware()`, `middlewareCount()` for middleware management
- `eventFilter(...types)`: predicate factory for filtering ChatEvents by type
- `filterEvents(source, ...types)`: async iterable filter
- `mapEvents(source, transform)`: async iterable map (null = skip)
- `collectText(source)`: collect message_delta text into single string

### Chat Storage (`src/chat/storage.ts`)

Generic storage adapter layer with CRUD, query, and data isolation.
- `IStorageAdapter<T>`: generic interface — `create`, `get`, `update`, `delete`, `has`, `list`, `count`, `clear`, `query`
- `InMemoryStorage<T>`: in-memory map with `structuredClone` on read and write for mutation safety
- `FileStorage<T>`: JSON file per item, auto-creates directories, percent-encoding for key→filename mapping
- `StorageError` (extends `AgentSDKError`): typed error using `ErrorCode` enum values (`STORAGE_NOT_FOUND`, `STORAGE_DUPLICATE_KEY`, `STORAGE_IO_ERROR`, `STORAGE_SERIALIZATION_ERROR`). Constructor: `(message, code)`.
- `StorageErrorCode`: union of `ErrorCode.STORAGE_NOT_FOUND | STORAGE_DUPLICATE_KEY | STORAGE_IO_ERROR | STORAGE_SERIALIZATION_ERROR`
- `query()` supports `filter`, `sort`, `limit`, `offset` for flexible retrieval
- All store interfaces (`IStorageAdapter`, `IChatSessionStore`, `IProviderStore`, `ITokenStore`) have optional `dispose?()` method for lifecycle cleanup

### Chat Sessions (`src/chat/sessions.ts`)

Session store layer wrapping storage adapters with session-specific operations.
- `IChatSessionStore`: extends `ISessionReader` + `ISessionWriter`. Reader: `getSession`, `listSessions`, `loadMessages`, `searchSessions`, `count`. Writer: `createSession`, `updateTitle`, `updateConfig`, `deleteSession`, `appendMessage`, `saveMessages`, `clear`, optional `dispose`
- `InMemorySessionStore`: in-memory session store for dev/testing
- `FileSessionStore`: file-based session store with JSON persistence
- `PaginatedMessages`: `{ messages, total, hasMore }` for paginated retrieval
- `searchSessions()`: case-insensitive substring match on title + message content
- `appendMessage()` deep-clones messages, updates `messageCount` and `updatedAt`
- `CreateSessionOptions`: `config` is `Partial<ChatSessionConfig>` (optional). Store provides fallback empty strings for model/backend; runtime fills `config.backend` from `_currentBackend` when not provided.

### Context Window Manager (`src/chat/context.ts`)

Stateless context window manager — messages in, trimmed messages out.
- `estimateTokens(message, options?)`: character-based heuristic (default 4 chars/token), handles text, tool calls, multimodal content. Legacy — kept for backward compat.
- `ContextWindowManager`: configurable via `maxTokens`, `reservedTokens`, `strategy`, `estimation`, `summarizer`
- `fitMessages(messages)` → `ContextWindowResult { messages, totalTokens, removedCount, wasTruncated }`
- `fitMessagesAsync(messages)` → `Promise<ContextWindowResult>` — async variant that calls `ContextSummarizer` for `summarize-placeholder` strategy, falls back to static placeholder on error
- `fitMessagesWithUsage(messages, lastPromptTokens, modelContextWindow)` → `ContextWindowResult` — real-data trimming using average tokens per message. Algorithm: `avgTokensPerMessage = lastPromptTokens / messageCount`, removes oldest non-system messages until within budget. Used by runtime when real usage data available.
- `ContextSummarizer`: `(removedMessages: readonly ChatMessage[]) => Promise<string>` — optional async function for generating summary text
- `ContextStats`: extended with `realPromptTokens?`, `realCompletionTokens?`, `modelContextWindow?` — populated from backend usage events and model metadata
- Strategies: `truncate-oldest` (preserves system msgs, removes oldest non-system), `sliding-window` (keeps most recent contiguous block), `summarize-placeholder` (replaces removed with `isSummary` placeholder or async summary)
- Edge cases: empty arrays, single message over budget (kept), all fit (no truncation)

### Chat State (`src/chat/state.ts`)

Validated state machines for runtime, message, and tool-call lifecycles.
- `StateMachine<S>`: generic class with declarative `TransitionMap<S>`, `transition(to)`, `canTransition(to)`, `reset()`, `current` getter
- `RUNTIME_TRANSITIONS`: idle→{streaming,disposed}, streaming→{idle,error,disposed}, error→{idle,disposed}, disposed→terminal
- `MESSAGE_TRANSITIONS`: pending→{streaming,error,cancelled}, streaming→{complete,error,cancelled}, terminals: complete/error/cancelled
- `TOOL_CALL_TRANSITIONS`: pending→{running,requires_approval,error}, running→{complete,error}, requires_approval→{running,denied,error}, terminals: complete/error/denied
- Factory functions: `createRuntimeStateMachine()`, `createMessageStateMachine()`, `createToolCallStateMachine()`
- Throws `ChatError(INVALID_TRANSITION)` on illegal transitions
- `ChatReentrancyGuard`: `acquire()`/`release()` pattern, throws `ChatError(REENTRANCY)` on concurrent acquire, `isAcquired` getter
- `ChatAbortController`: wraps `AbortController`, links external `AbortSignal` (external abort propagates), `abort(reason?)`, `signal`, `isAborted`, `dispose()` for cleanup

### ListenerSet (`src/chat/listener-set.ts`)

Generic utility for subscribe/notify listener patterns. Replaces duplicated `Set<callback>` + try/catch boilerplate.
- `ListenerSet<T extends (...args) => void>`: generic class parameterized by callback signature
- `add(callback): () => void` — adds listener, returns unsubscribe function
- `notify(...args)` — calls all listeners with try/catch isolation per listener
- `clear()` — removes all listeners (used in disposal)
- `size` getter — current listener count
- Used by `ChatRuntime._sessionListeners`, `RemoteChatClient._sessionListeners`, `RemoteChatClient._selectionListeners`

### Chat Backend Adapters (`src/chat/backends/`)

High-level backend adapters bridging IAgentService → ChatEvent stream.
- `IChatBackend`: core backend interface — `name`, `sendMessage()`, `streamMessage()`, `listModels()`, `validate()`, `dispose()`, `currentModel`. Note: `agentService` is NOT on the interface (implementation detail on BaseBackendAdapter).
- `IResumableBackend`: extends IChatBackend — adds `resume()`, `canResume()`, `backendSessionId`
- `BackendAdapterOptions`: `agentConfig` + optional `agentService` (injected or self-created)
- `BaseBackendAdapter`: abstract base with lifecycle, event bridge via `adaptAgentEvents()`. Fully stateless for tools/model — no mutable fields. Exposes `agentService` as public getter (not part of IChatBackend interface — for advanced consumers).
  - Service ownership: `_ownsService` flag — `true` when self-created via `createService()`, `false` when injected. `dispose()` only disposes service if owned.
  - `setTools()`: **deprecated no-op** — tools are passed per-call via `SendMessageOptions.tools`. Kept for backward compat.
  - `currentModel`: returns `agentConfig.model` (config default, immutable)
  - `getOrCreateAgent()`: agent lifecycle — persistent mode reuses agent when model matches (tracked in `_currentAgent` tuple), non-persistent always creates fresh. No tool merging — tools flow per-call via RunOptions.
  - `streamAgentEvents()`: shared streaming helper — ensures model and tools are passed to agent via RunOptions
- `CopilotChatAdapter`: wraps CopilotAgentService, extends `ResumableChatAdapter`, auto-sets `sessionMode: "persistent"`, captures `sessionId` for resume
- `ClaudeChatAdapter`: wraps ClaudeAgentService, extends `ResumableChatAdapter`, auto-sets `sessionMode: "persistent"`, captures `sessionId` for resume
- `ResumableChatAdapter`: abstract base class for CLI-based adapters (extracted from CopilotChatAdapter/ClaudeChatAdapter duplication). Implements `IResumableBackend` with shared session capture, `createService()`, `createStreamOptions()`. ~80 lines eliminating ~140 lines of duplication.
- `VercelAIChatAdapter`: wraps VercelAIAgentService, `canResume()` returns false (stateless API)
- `IChatTransport`: interface for delivering ChatEvents to clients — `send()`, `error()`, `close()`
- `SSEChatTransport`: Server-Sent Events transport over `node:http` response — sets headers, JSON-encodes events, `[DONE]` sentinel. Optional `SSETransportOptions`: `heartbeatMs` (periodic keep-alive comments), `request: CloseDetectable` (connection close detection)
- `WsChatTransport`: WebSocket transport accepting `WebSocketLike` abstraction (compatible with `ws`, browser WebSocket, Deno, Bun). JSON-encodes events, sends `{ type: "done" }` on close, closes with code 1000/1011. Options: `heartbeatMs`, `serialize` (custom serializer)
- `InProcessChatTransport`: Zero-network transport implementing both `IChatTransport` (producer) and `AsyncIterable<ChatEvent>` (consumer). Internal buffer with promise-based waiting. Used for testing, CLI tools, embedded runtimes
- `CloseDetectable`: `{ on(event: "close", listener: () => void): void }` — minimal interface for request close events
- `SSETransportOptions`: `{ heartbeatMs?: number; request?: CloseDetectable }` — backward-compatible constructor options
- `streamToTransport()`: pipes `AsyncIterable<ChatEvent>` to `IChatTransport`, accumulates text from `message:delta` events and emits `done` event with `finalOutput` before closing
- `TransportInterceptor`: interface with 4 optional hooks — `beforeSend(event, transport)` (return event, modified event, or null to suppress), `afterSend(event, transport)`, `beforeClose(transport)`, `onError(error, transport)`
- `withInterceptors(transport, interceptors)`: wraps any `IChatTransport` with composable interceptor chain. Interceptors run left-to-right; beforeSend chain stops on null return

### Chat Runtime (`src/chat/runtime.ts`)

Unified facade orchestrating backend adapters, sessions, context trimming, streaming, and middleware.
- `IProviderClient`: provider CRUD interface (ISP) — `listProviders()`, `createProvider()`, `updateProvider()`, `deleteProvider()`. Implemented by IChatClient; not required on IChatRuntime.
- `IChatClient<TMetadata>`: client-facing interface, fully self-contained. Extends `IProviderClient` (ISP). Contains: lifecycle (`status`, `dispose()`), session CRUD, `switchSession()`, `activeSessionId`, `send(options? optional)`, `abort()`, `selectProvider()`, `selectedProviderId`, `onSelectionChange()`, `onSessionChange()`, `listModels()`, `listBackends()`, `getContextStats()`. Implemented by `RemoteChatClient`.
- `IChatRuntime<TMetadata>`: server-side interface, fully self-contained. No shared base with IChatClient — independent layers. Contains: lifecycle, session CRUD (no switchSession/activeSessionId — server is stateless), `send(options required)`, `abort()`, `onSessionChange()`, `listModels(options?)`, `listBackends()`, tools (`registerTool`, `removeTool`, `registeredTools`), middleware (`use`, `removeMiddleware`), `getContextStats()`. Implemented by `ChatRuntime`.
- **Note**: `send()` signature intentionally diverges: client's options are optional (server resolves model/backend), runtime's RuntimeSendOptions are required (caller must supply backend, model, credentials).
- `ChatRuntime<TMetadata>`: implements `IChatRuntime<TMetadata>` with `StateMachine`, `ChatReentrancyGuard`, `ChatAbortController`
  - Lazy adapter creation: `BackendAdapterFactory = (credentials: AuthToken) => IChatBackend | Promise<IChatBackend>` — backends created per-request with credentials from `RuntimeSendOptions`
  - `send(sessionId, content, options?)`: persist user msg → onBeforeSend middleware → stream adapter → `feedAccumulator()` → onEvent middleware → persist assistant msg → onAfterReceive middleware; handles abort, error, dispose-during-send
  - Error auto-recovery: if state is `error`, transitions to `idle` at start of `send()` for transient failure recovery
  - Dispose-during-send: graceful exit after streaming loop if disposed mid-stream
  - `feedAccumulator()`: maps `ChatEvent` → `AgentEvent` via `chatEventToAgentEvent()` for `MessageAccumulator`
  - Tool registry: runtime-level `Map<string, ToolDefinition>`, persists across backend switches, passed to adapters via `SendMessageOptions.tools`
  - Tool context injection: `injectToolContext()` wraps each tool's execute with `ToolContext { sessionId, custom? }` built from current session before passing to adapter
  - Model state: runtime does NOT store model. Model is passed per-call via `RuntimeSendOptions.model` (required). Server handler resolves model from provider.
  - Backend adapter management: `_defaultBackend` stores initial backend from options, adapters created lazily via factory map
  - Context trimming: `ContextWindowManager.fitMessagesAsync()` applied to session messages before send (supports async summarizer)
  - Context stats: `getContextStats(sessionId)` returns `ContextStats | null` per session. Extended with `realPromptTokens`, `realCompletionTokens`, `modelContextWindow` from backend usage events. Cleaned up on `deleteSession()`.
  - Usage tracking: `_sessionUsage` Map caches per-session real usage data from `usage` ChatEvent. `_modelContextWindows` Map caches model context windows from `listModels()`.
  - Real trimming: `trimSessionContext()` uses `fitMessagesWithUsage()` when real usage data available, falls back to heuristic `fitMessagesAsync()` for first message.
  - Context trimmed callback: `onContextTrimmed(sessionId, removedMessages)` in options, fires when trimming removes messages, wrapped in try/catch for safety
  - Middleware pipeline: `onBeforeSend` → `onEvent` → `onAfterReceive` → `onError`, sequential in registration order
  - Empty/whitespace message validation at start of `send()`
  - Pre-stream retry: `StreamRetryConfig` (`maxAttempts`, `delayMs`, `backoffMultiplier`) retries adapter creation and first event; once first event received, stream committed (no mid-stream retry); failed adapters disposed before retry. `RetryConfig` is a deprecated alias for `StreamRetryConfig` in the chat module (agent-level `RetryConfig` in `src/types/agent.ts` has different fields).
  - Stream watchdog: `streamTimeoutMs` option wraps event stream with `withStreamWatchdog()` — aborts with `ChatError(TIMEOUT)` if no events arrive within the configured inactivity window
  - Session subscription: `onSessionChange(callback: () => void): () => void` — fires on createSession, deleteSession, and after send completes. Uses `ListenerSet<() => void>` for error-isolated listener management.
  - Session creation defaults: `createSession()` fills `config.backend` from `_defaultBackend` when not provided. Model must be provided by caller or defaults to `""`.
- `createChatRuntime<TMetadata>(options)`: factory function creating `ChatRuntime<TMetadata>` instance
- `ChatRuntimeOptions`: `defaultBackend`, `defaultModel` (@deprecated, ignored), `backends` (factory map), `sessionStore`, `contextConfig?`, `middleware?`, `retry?`, `streamTimeoutMs?`, `onContextTrimmed?`

### React Bindings (`src/chat/react/`)

Headless React hooks and components wrapping IChatRuntime. React 18+ as optional peer dependency.
- `ChatProvider`: React context provider wrapping `IChatClient`, createElement-based (no JSX required)
- `useChatRuntime()`: Context accessor hook returning `IChatClient`, throws if used outside ChatProvider
- `useChat(options?)`: Convenience hook — `sendMessage`, `stop`, `isGenerating`, `status`, `error`, `clearError`, `newSession`, auto-creates session on first send, concurrent send protection via ref guard, progressive streaming via local `MessageAccumulator` (tokens display progressively), abort finalizes accumulator with error status preserving partial message
- `useMessages({ sessionId })`: Reactive message list via `useSyncExternalStore`, supports `ChatSession.subscribe/getSnapshot` or falls back to 500ms polling
- `useSessions()`: Reactive session list hook — subscribes via `runtime.onSessionChange()`, auto-refreshes on create/delete/send. Returns `UseSessionsReturn { sessions: SessionInfo[], loading, error, refresh }`. `toSessionInfo()` mapper converts ChatSession → SessionInfo.
- `useToolApproval(messages, onApprove?, onDeny?)`: Scans messages for ToolCallParts with `requires_approval` status, returns `pendingRequests`, `approve()`, `deny()` with useCallback memoization
- `Message(props)`: Headless message component rendering `ChatMessage.parts` array with `data-role`/`data-status` attributes, render props for all 5 part types (`renderText`, `renderReasoning`, `renderToolCall`, `renderSource`, `renderFile`)
- `ThinkingBlock({ text, isStreaming, defaultOpen })`: Native `details/summary` collapse, `data-thinking`/`data-streaming` attributes, summary text changes based on streaming state
- `ToolCallView({ part, onApprove?, onDeny?, renderArgs?, renderResult? })`: Tool call display with `data-tool-status`/`data-tool-name`, approve/deny buttons when `requires_approval`, render props for args/result
- `MarkdownRenderer({ content, renderCode?, renderLink? })`: Regex-based markdown→HTML parser, supports headings, paragraphs, bold/italic, inline code, fenced code blocks with language class, links, blockquotes, ordered/unordered lists, `data-md-*` attributes on all block elements
- `ContextStatsDisplay({ stats })`: Headless component rendering real context window stats (realPromptTokens, modelContextWindow, usage%, removedCount). Returns null when real data fields are absent. Data attributes: `data-context-stats`, `data-context-tokens`, `data-context-budget`, `data-context-usage`, `data-context-removed`, `data-context-truncated`.
- `Thread({ messages, isGenerating?, autoScroll?, virtualize?, className? })`: Headless message list wrapper with `data-thread`/`data-thread-message`/`data-thread-loading` attributes, auto-scroll via sentinel ref + scrollIntoView, scroll-to-bottom detection via container scroll events, integrates with `ThreadSlots` context for render overrides. Optional `virtualize` prop (boolean or `VirtualizeOptions`) enables windowed rendering via `useVirtualMessages` hook — backward compatible, default off.
- `useVirtualMessages<T>(items, containerRef, options?)`: Windowed rendering hook with ResizeObserver for container measurement. Returns `visibleItems`, `startOffset`, `topSpacerHeight`, `bottomSpacerHeight`, `onScroll`. Configurable `estimatedItemHeight` (default 80) and `overscan` (default 5). Falls back to rendering all items when containerHeight=0 (SSR/jsdom).
- `PermissionDialog({ pendingRequests, onApprove?, onDeny?, renderToolName?, className? })`: Headless tool approval dialog with `data-permission-dialog`/`data-permission-request`/`data-permission-actions` attributes. Per-request approve/deny buttons plus bulk approve/deny all. Reuses `PendingToolRequest` from `useToolApproval`. Returns null when no pending requests.
- `Composer({ onSend, onStop?, isGenerating?, disabled?, placeholder?, maxRows?, className? })`: Input component with auto-resizing textarea (capped at maxRows), Enter to submit / Shift+Enter for newline, send button `[data-action="send"]` disabled when empty, stop button `[data-action="stop"]` shown during generation, `aria-label="Message input"`
- `ThreadProvider`: Slot-based customization context providing `renderMessage`, `renderToolCall`, `renderThinkingBlock` overrides to Thread
- `useThreadSlots()`: Access slot overrides from ThreadProvider (throws outside provider)
- `useOptionalThreadSlots()`: Safe variant returning null when no ThreadProvider ancestor
- `ThreadList({ sessions, activeSessionId?, onSelect, onDelete?, onCreate?, searchQuery?, onSearchChange?, className? })`: Session sidebar with `data-session-item`/`data-session-active`/`data-session-status` attributes, search filter by title (case-insensitive), create button `[data-action="create-session"]`, delete button `[data-action="delete-session"]`. Accepts `ChatSession[] | SessionInfo[]` via `SessionItem` union type with `isFullSession()` guard and `normalizeSession()` mapper memoized via useMemo.
- `useSSE(url, options?)`: Fetch-based SSE client hook (not EventSource), parses `text/event-stream` format with multi-line data support, yields `ChatEvent` objects via `onEvent` callback, `status` reactive state (`idle | connecting | open | closed | error`), `connect()`/`disconnect()` controls, automatic reconnection with configurable `reconnect`/`reconnectInterval` options, timer cleanup on connect/disconnect/unmount
- `useModels()`: Model list hook fetching from `runtime.listModels()`, returns `{ models, loading, error, search, setSearch, refresh }`, case-insensitive name filtering, caches results
- `ModelSelector({ models, selected?, onSelect, placeholder?, className? })`: Dropdown component with `data-model-selector-trigger`/`data-model-selector-dropdown`/`data-model-selector-item`, keyboard navigation (ArrowUp/Down/Enter/Escape), inline search input `[data-model-selector-search]`, tier badges via `data-tier` attribute
- `ProviderSelector({ providers, activeProviderId?, onSelect, onSettingsClick?, className? })`: Headless provider dropdown with `data-provider-selector`/`data-provider-trigger`/`data-provider-dropdown`/`data-provider-item` attributes. Keyboard navigation, highlight tracking, settings gear button in dropdown footer. Shows provider label + model per item.
- `ProviderSettings({ providers, onClose?, onProviderCreated?, onProviderDeleted?, onProviderUpdated?, authBaseUrl?, className? })`: Headless CRUD panel for providers. Three views: list (shows all providers with edit/delete), add (backend select → auth → configure model/label), edit (update model/label). Uses `useRemoteAuth` for inline authentication during add flow. Data attributes: `data-provider-settings`, `data-provider-settings-item`, `data-provider-backend-option`, `data-provider-settings-form`.
- `ProviderModelSelector({ providers?, models?, activeProviderId?, selectedModel?, onSelectProvider?, onSelectModel?, onSettingsClick?, placeholder?, className? })`: Unified provider/model selector that auto-detects mode. When `providers` non-empty → provider mode (each item = backend+model combo); otherwise → model mode. Data attributes: `data-provider-model-selector`, `data-pms-mode` ("provider"|"model"), `data-pms-trigger`, `data-pms-dropdown`, `data-pms-item`, `data-pms-settings`. Search input shown when >3 items. Keyboard navigation (ArrowUp/Down/Enter/Escape), click-outside-to-close.
- `useRemoteAuth({ backend, baseUrl, fetch? })`: Server-delegated auth hook. Communicates with `createAuthHandler` endpoints instead of instantiating auth classes directly. Avoids `node:crypto` in browser bundles. Backends: `"copilot"`, `"claude"`, `"vercel-ai"` (note: `"api-key"` renamed to `"vercel-ai"`). Same interface shape: `startDeviceFlow`, `startOAuthFlow`, `completeOAuth`, `submitApiKey` (async, accepts optional `baseUrl`), `token` (server-managed marker), `status`, `error`, `reset`. Additional: `loadSavedTokens()`, `useSavedToken(provider)`, `clearTokens()`. Unified: `start(provider?)` auto-dispatches to correct auth flow (copilot→device flow, claude→OAuth; vercel-ai throws — requires `submitApiKey`)
- `useRemoteChat({ chatBaseUrl, authBaseUrl, backend, fetch?, headers?, onReady? })`: Lifecycle orchestrator hook composing auth → runtime → session. Phase state machine: `initializing` → `unauthenticated` → `authenticating` → `creating` → `ready` → `error`. On mount: loads saved tokens via `useRemoteAuth.loadSavedTokens()`, auto-restores first saved provider. On auth success: creates `RemoteChatClient`, creates initial session, transitions to `ready`, calls `onReady(runtime)`. Returns: `phase` (RemoteChatPhase), `runtime` (IChatClient | null), `sessionId` (string | null), `error` (Error | null), `auth` (UseRemoteAuthReturn for manual control), `newSession()` (creates new session), `logout()` (disposes runtime, clears tokens, resets to unauthenticated). Ref guards: `mountedRef` (prevents post-unmount setState), `creatingRef` (prevents double runtime creation), `restoredRef` (prevents double token load). `tokensLoaded` state gates the savedProviders check to avoid race conditions.
- `ChatUI({ runtime, slots?, className?, showSidebar?, showModelSelector?, showBackendSelector?, showProviderSelector?, authBaseUrl?, placeholder? })`: Composite component wiring Thread+Composer+ThreadList+ProviderModelSelector+ProviderSettings into a complete chat interface. Wraps `ChatProvider` internally. Uses unified `ProviderModelSelector` near composer (auto-detects provider vs model mode). Standalone `ModelSelector` shown in header only when no providers are configured. `ChatUISlots` for component-level replacement: `thread`, `composer`, `threadList`, `modelSelector` (header fallback), `backendSelector`, `providerModelSelector` (near composer), `providerSettings` (ComponentType overrides), `authDialog` (ReactNode slot), `renderMessage`, `renderToolCall`, `renderThinkingBlock` (forwarded to ThreadProvider). Layout: `[data-chat-ui]` flex container with sidebar + `[data-chat-main]` column. `[data-chat-header]` wraps BackendSelector/ModelSelector (when no providers). `[data-chat-input-area]` wraps ProviderModelSelector + Composer. `[data-provider-settings-overlay]` modal for provider management.
- `CopilotAuthForm`, `ClaudeAuthForm`, `VercelAIAuthForm`: Per-backend auth form components in `src/chat/react/auth/`. Each renders a self-contained auth flow UI.
- `useCopilotAuth`, `useClaudeAuth`, `useApiKeyAuth`: Per-backend auth hooks wrapping `useRemoteAuth` with backend-specific logic
- `ChatLayout`, `ChatHeader`, `ChatInputArea`, `ChatSettingsOverlay`: Layout sub-components extracted from ChatUI for composition
- `UsageBadge({ usage })`: Token usage display component
- Types: `UseChatOptions`, `UseChatReturn`, `UseMessagesOptions`, `UseMessagesReturn`, `UseSessionsReturn`, `ChatProviderProps`, `MessageProps`, `ThinkingBlockProps`, `ToolCallViewProps`, `MarkdownRendererProps`, `UseToolApprovalReturn`, `PendingToolRequest`, `ThreadProps`, `ComposerProps`, `ThreadSlotOverrides`, `ThreadProviderProps`, `ThreadListProps`, `ContextStatsDisplayProps`, `SSEStatus`, `UseSSEOptions`, `UseSSEReturn`, `ModelOption` (was `ModelInfo`, deprecated alias kept), `UseModelsReturn`, `ModelSelectorProps`, `ChatUIProps`, `ChatUISlots`, `RemoteAuthBackend`, `RemoteAuthStatus`, `UseRemoteAuthOptions`, `UseRemoteAuthReturn`, `RemoteChatPhase`, `UseRemoteChatOptions`, `UseRemoteChatReturn`, `UseProvidersReturn`, `ProviderSelectorProps`, `ProviderModelSelectorProps`, `ProviderSettingsProps`, `RemoteChatClientOptions`, `RemoteChatRuntimeOptions` (deprecated alias), `AuthFormProps`, `AuthFormComponent`, `VirtualizeOptions`, `VirtualMessagesResult`, `PermissionDialogProps`
- `RemoteChatClient`: client-side `IChatClient` adapter that delegates every operation over HTTP/SSE to a remote server. Bridges React hooks (which require in-process runtime) with server-side `ChatRuntime`. No tool/middleware/context stubs — only methods from IChatClient.
  - Constructor: `RemoteChatClientOptions` — `baseUrl`, optional `headers`, optional `fetch` override (testability)
  - `RemoteChatRuntime` is a deprecated alias for `RemoteChatClient`
  - `send()`: POST to `{baseUrl}/send` with SSE stream response, parsed via `ReadableStream` reader. AbortSignal races with `reader.read()` for clean cancellation.
  - Session CRUD: REST calls to `{baseUrl}/sessions/{create|list|get|delete}`
  - `abort()`: cancels in-flight SSE stream via AbortController + server notification POST
  - `listModels()`/`listBackends()`: REST delegation
  - `selectProvider(providerId)` / `selectedProviderId` / `onSelectionChange()`: local provider selection state
  - Provider CRUD: `listProviders()`, `createProvider()`, `updateProvider()`, `deleteProvider()` — delegate to server `/providers/*` endpoints
  - Tools/middleware: client-side registries (server handles actual execution)
  - `onSessionChange()`: uses `ListenerSet<() => void>`, fires on createSession/deleteSession/send completion.
  - `getContextStats()`: returns null (server-side concern)
  - Server endpoint contract defined in JSDoc: POST /sessions/create, GET /sessions/{id}, GET /sessions, DELETE /sessions/{id}, POST /send, POST /abort, GET /models, POST /backend/switch, POST /model/switch

### Server Utilities (`src/chat/server/`)

Framework-agnostic HTTP handler and CORS middleware for serving `IChatRuntime` over HTTP.
- `createChatHandler(runtime, options?)`: factory returning `(req, res) => Promise<void>` handler mapping all 10 `RemoteChatClient` contract endpoints to `IChatRuntime` method calls
- `ReadableRequest`: minimal readable interface (`method`, `url`, `on("data"|"end")`) — node:http `IncomingMessage` subset
- `WritableResponse`: unified interface in `src/chat/backends/transport.ts` — `writeHead(statusCode, headers?)`, `setHeader(name, value)`, `write(chunk)`, `end(body?)`, `writableEnded`. `writeHead` headers accept `Record<string, string | string[]>` to match Node.js http.ServerResponse (e.g., multi-value Set-Cookie). Minimal type satisfied by Express.Response, Fastify reply.raw, and node http.ServerResponse without casts. Re-exported from `@witqq/agent-sdk/chat/server` for backward compat.
- `ChatHandlerOptions`: `prefix?` (route prefix to strip), `maxBodySize?` (default 1MB), `heartbeatMs?` (SSE heartbeat interval), `hooks?` (ChatServerHooks — consolidated hook interface), `modelFilter?` (@deprecated, use hooks.filterModels), `modelGuard?` (@deprecated, use hooks.onModelSwitch), `onBeforeSwitch?` (@deprecated, use hooks.onBackendSwitch/onProviderSwitch)
- `ChatServerHooks`: consolidated server hook interface with 6 hooks: `filterModels` (filter GET /models), `onModelSwitch` (guard /model/switch — throw to reject), `onProviderSwitch` (guard /provider/switch — receives `{ providerId, backend }` object), `onBackendSwitch` (guard /backend/switch — throw to reject), `onBeforeSend` (intercept before send — throw to reject), `onError` (notification on handler errors)
- Stateless handler: no mutable `HandlerState` — model and backend resolved per-request from provider or request body. `/model/switch` and `/provider/switch` are validation-only endpoints.
- `/send`: resolves model from `body.model || provider.model || 400 error`, passes to `runtime.send(sessionId, msg, { model })`
- `/model/switch`: validates model name, calls `hooks.onModelSwitch` if configured. No state mutation.
- `/provider/switch`: validates provider exists, calls `hooks.onProviderSwitch` if configured. No state mutation.
- 9 routes: POST `/sessions/create`, GET `/sessions/{id}`, GET `/sessions`, DELETE `/sessions/{id}`, POST `/send` (SSE via `SSEChatTransport` with heartbeat + close detection), POST `/abort`, GET `/models`, POST `/backend/switch`, POST `/model/switch`
- Input validation: `/send` requires `sessionId` + `message` + model (from body or handler state), `/backend/switch` requires `backend`, `/model/switch` requires `model` — all return 400 on missing fields
- `readBody()`: shared JSON body parser (`src/chat/server/utils.ts`) with configurable size limit, rejects with `BodyParseError` (status 413/400/500) on oversized/malformed/error input. Used by both `createChatHandler` and `createProviderHandler`.
- `json()`: shared JSON response helper — `json(res, data, status?)`. Exported from utils.ts.
- `BodyParseError`: error class with `status` field for HTTP error responses
- Query string stripping: `rawPath.split("?")[0]` before route matching
- `corsMiddleware(options?)`: standalone CORS middleware returning `boolean` (true = preflight handled)
- `CorsOptions`: `origin` (string | string[]), `methods`, `headers`, `maxAge`
- Multi-origin: spec-compliant — checks request `Origin` header against allowed list, responds with matching single origin, sets `Vary: Origin`

### Auth Handler (`src/chat/server/auth-handler.ts`)

Server-mediated authentication handler for all three backends.
- `createAuthHandler(options)`: factory returning `(req, res) => Promise<void>` handler for 8 auth routes
- `AuthHandlerOptions`: `tokenStore` (ITokenStore), `copilotAuth?` (ICopilotAuth factory), `claudeAuth?` (IClaudeAuth factory), `onAuth?` (OnAuthCallback), `onLogout?` (() => void | Promise<void>)
- `OnAuthCallback`: `(backend: string, token: AuthToken) => void | Promise<void>` — app-level side effect after successful auth
- 8 routes: POST `/auth/start`, POST `/auth/copilot/poll`, POST `/auth/claude/complete`, POST `/auth/vercel/complete`, GET `/tokens/saved`, POST `/tokens/use`, POST `/tokens/clear`, POST `/auth/dispose`
- Auth factories: `ICopilotAuth` / `IClaudeAuth` interfaces abstract real auth classes for DI/testability
- Single-user pattern: closure-scoped `pendingCopilot`/`pendingClaude` state
- `/auth/dispose`: clears pending flows, calls `onLogout` callback

### Token Store (`src/chat/server/token-store.ts`)

Persistent token storage abstraction.
- `ITokenStore`: async interface — `save(provider, token)`, `load(provider)`, `clear(provider)`, `clearAll()`, `list()`
- `InMemoryTokenStore`: in-memory Map implementation
- `FileTokenStore`: JSON file per provider, auto-creates directories, percent-encoding for provider→filename

### Provider Store (`src/chat/server/provider-store.ts`)

Provider storage abstraction — a "Provider" is a user-configured entity combining backend + model + label.
- `ProviderConfig`: `{ id, backend, model, label, createdAt }`
- `IProviderStore`: async interface — `create(config)`, `get(id)`, `update(id, changes)`, `delete(id)`, `list()`
- `InMemoryProviderStore`: in-memory Map implementation with shallow clone on read/write
- `FileProviderStore`: JSON file per provider (`{id}-provider.json`), auto-creates directories

### Provider Handler (`src/chat/server/provider-handler.ts`)

CRUD handler for provider configurations.
- `createProviderHandler(options)`: factory returning `(req, res) => Promise<void>` handler for 5 routes
- `ProviderHandlerOptions`: `{ providerStore: IProviderStore }`
- Routes: GET `/providers`, GET `/providers/{id}`, POST `/providers`, PUT `/providers/{id}`, DELETE `/providers/{id}`

### Chat Server (`src/chat/server/chat-server.ts`)

One-call server factory combining all server utilities.
- `createChatServer(options)`: factory returning `(req, res) => Promise<void>` handler that routes to chat handler, auth handler, static files, or 404
- `ChatServerOptions`: `runtime?` (IChatRuntime — pre-built), `runtimeConfig?` (ChatRuntimeConfig — auto-create runtime), `hooks?` (ChatServerHooks), `auth?` (AuthHandlerOptions), `providers?` (ProviderHandlerOptions), `chatPrefix?` (default "/api/chat"), `authPrefix?` (default "/api/auth"), `providerPrefix?` (default "/api/providers"), `staticDir?` (absolute path), `cors?` (boolean | CorsOptions, default true), `heartbeatMs?` (SSE keepalive interval), `healthPath?` (default "/api/health", set `false` to disable)
- `ChatRuntimeConfig`: type alias for `ChatRuntimeOptions` — same shape used by `createChatRuntime()`, used by `createChatServer` to auto-create runtime when `runtime` option is not provided
- Routing order: healthPath → chatPrefix → authPrefix → providerPrefix → staticDir → 404
- Static serving: MIME type detection, index.html fallback, directory traversal protection (CWE-22 with `path.sep` boundary check)
- `RequestHandler`: type alias for `(req: ReadableRequest, res: WritableResponse) => Promise<void>`

### SQLite Storage Example (`examples/sqlite-storage/`)

Legacy IChatSessionStore-only example. For production use, prefer `@witqq/agent-sdk/chat/sqlite` which provides all three stores (sessions, providers, tokens) in a single database.
- `SQLiteSessionStore`: full contract — CRUD, pagination, search
- Schema: `sessions` + `messages` tables, JSON TEXT for parts/metadata
- WAL journal mode, foreign keys, position-based message ordering
- 30 tests in `tests/unit/examples/storage-adapters.test.ts`

### First-Class SQLite Module (`src/chat/sqlite/`)

Unified SQLite storage via `@witqq/agent-sdk/chat/sqlite`. Single database for all three stores.
- `createSQLiteStorage(dbPath)` → `{ db, sessionStore, providerStore, tokenStore }`
- `SQLiteSessionStore`: moved from examples, implements `IChatSessionStore`
- `SQLiteProviderStore`: implements `IProviderStore` (providers table)
- `SQLiteTokenStore`: implements `ITokenStore` (tokens table)
- Factory enables WAL + foreign keys on shared Database instance
- Schema versioning via `src/chat/sqlite/migrations.ts`: `Migration` type, `schema_version` table, `runMigrations()` called by factory
- `better-sqlite3` as optional peer dependency
- 54 tests in `tests/unit/chat/sqlite-storage.test.ts`

### Drizzle Storage Example (`examples/drizzle-storage/`)

IChatSessionStore implementation using drizzle-orm with SQLite.
- `DrizzleSessionStore`: same contract as SQLite adapter
- Exports Drizzle `sessions` and `messages` table definitions for schema introspection
- Adaptable to PostgreSQL/MySQL by swapping table definitions
- 30 tests in `tests/unit/examples/storage-adapters.test.ts`

### Framework Presets (`examples/framework-presets/`)

Adapter examples wrapping SDK handlers into framework-native middleware.
- `express-adapter.ts`: `toExpressMiddleware()`, `toExpressRoute()` — thin wrapper, Express req/res natively compatible
- `hono-adapter.ts`: `honoHandler()` — bridges web-standard Request/Response to SDK node:http interfaces, supports SSE streaming
- `fastify-adapter.ts`: `toFastifyHandler()`, `registerRoutes()` — uses `reply.hijack()` for raw response access
- Zero framework dependencies — types defined as minimal interface subsets
- 10 tests in `tests/unit/examples/framework-presets.test.ts`

### Usage Tracking (`examples/usage-tracking/`)

ChatMiddleware example tracking token usage per session.
- `createUsageMiddleware(store)`: listens for `usage` and `done` events, accumulates token counts
- `InMemoryUsageStore`: Map-based `IUsageStore` implementation
- `IUsageStore` interface: `getUsage`, `recordUsage`, `getTotalUsage`, `listSessions`, `clear`
- Fire-and-forget persistence to avoid blocking event pipeline
- 14 tests in `tests/unit/examples/usage-tracking.test.ts`

### Multi-User Runtime Manager (`examples/multi-user-runtime/`)

`MultiUserRuntimeManager` manages per-user `IChatRuntime` instances with LRU cache eviction.
- LRU via Map insertion-order: `delete` + `set` promotes to most-recent on access
- `maxUsers` capacity with automatic eviction of least-recently-used entry
- `idleTimeoutMs` for disposing runtimes after inactivity (0 = disabled)
- Concurrent-safe `getRuntime()`: concurrent calls for same userId share a single creation Promise
- BYOK pattern: `RuntimeFactory` receives `UserRuntimeConfig` with per-user API keys
- `onEvict` callback for cleanup notifications
- 18 tests in `tests/unit/examples/multi-user-manager.test.ts`

### Enhanced NATS Transport (`examples/custom-transport/nats-enhanced-transport.ts`)

Subject-based NATS routing with request-reply and pub/sub streaming patterns.
- `NatsChatRouter`: server-side router subscribing to wildcard subjects (`{prefix}.*.send`, `{prefix}.*.sessions.list`, etc.)
- `NatsChatClient`: client-side helper with typed `send()`, `listSessions()`, `createSession()`, `listModels()` methods
- `NatsPublishTransport`: `IChatTransport` implementation publishing events to a NATS subject
- Subject hierarchy: `{prefix}.{userId}.{action}` (send, events, sessions.list, sessions.create, models)
- Request-reply for synchronous CRUD, pub/sub streaming for send events
- Zero NATS dependencies: minimal interfaces (`NatsConnectionLike`, `NatsSubscriptionLike`, `NatsMessageLike`)
- 10 tests in `tests/unit/examples/nats-enhanced-transport.test.ts`

### Unified Demo (`examples/demo/`)

Single-screen chat UI with provider management, built with SDK React components and server utilities. ~130-line stateless server.ts with per-request backend creation.
- `server.ts`: node:http backend using `createChatServer` with stateless `BackendAdapterFactory` map (backends created per-request with credentials from `tokenStore`), SQLite storage (`createSQLiteStorage`), server hooks (`filterModels`, `onModelSwitch`), `autoCreateProviders`, and `TokenRefreshManager` for Copilot/Claude automatic token refresh. Tools registered via `createChatRuntime({ tools })`.
- `tools.ts`: Demo tool definitions (search_news, calculator, format_output) — extracted for server.ts brevity.
- `model-allowlist.ts`: Model filtering utilities — `createAllowlist()`, `isModelAllowed()`, `filterModels()`. Default: only `gpt-5-mini` allowed. Override via `DEMO_ALLOWED_MODELS` env var (comma-separated).
- `frontend/`: React app — `RemoteChatClient` created directly, wrapped in `ChatUI` with `authBaseUrl` for provider management
- Storage: Single SQLite DB (`/data/chat.db` in Docker, `.data/chat.db` locally) for sessions, providers, and tokens via `createSQLiteStorage()`
- Auth: handled inline via `ProviderSettings` component (uses `useRemoteAuth` → server auth handler). Single-user in-flight auth state (closure-scoped `pendingCopilot`/`pendingClaude`) — acceptable for demo scope.
- Providers: `autoCreateProviders` creates default provider on first auth; `ProviderSelector` near composer for switching
- Model safety: `filterModels` on GET /models, `onModelSwitch` on /model/switch and /send — via SDK server hooks
- Docker: App data in `./data:/data` bind mount. Copilot CLI config in `copilot-config:/root/.copilot` named volume. `DB_PATH=/data/chat.db` env var. SQLite WAL mode.
- CSS: SDK theme.css provides all styles via `[data-*]` attribute selectors

```bash
npm run demo              # Build & start in Docker (port 3456) — единственная команда
npm run demo -- stop      # Stop Docker container
npm run demo -- logs      # Follow Docker logs
npm run demo -- restart   # Rebuild & restart
```

### Utilities

- `zodToJsonSchema()` — Zod schema → JSON Schema (v4 toJSONSchema → v3.24 jsonSchema → v3 _def fallback)
- `messagesToPrompt()` — Message[] → flat string
- `contentToText()` — MessageContent → plain text

### Testing Utilities (`src/testing/`)

Mock factories for SDK consumers (`@witqq/agent-sdk/testing` entry point).
- `createMockSession(overrides?)`: creates `ChatSession` with valid defaults (ChatId, timestamps, empty messages)
- `createMockMessage(overrides?)`: creates `ChatMessage` with text part, defaults to assistant role
- `createMockAgentService(options?)`: creates `IAgentService` mock with configurable `onRun`/`onStream` handlers, default model list, validation
- `createMockRuntime(options?)`: creates full `IChatRuntime` mock with in-memory session management, tool registry, middleware pipeline, session change listeners
- `createMockChatClient(options?)`: creates full `IChatClient` mock extending runtime mock with provider CRUD operations (listProviders, createProvider, updateProvider, deleteProvider, selectProvider)

## Code Style

- TypeScript strict mode
- ESM-first, CJS via tsup
- zod as peer dependency
- Backend SDKs as optional peer deps
- Separate entry points per backend (tree-shaking)

## Testing

- Unit: vitest (`tests/unit/`)
- Integration: vitest (`tests/integration/`) — requires real CLI authentication
- E2E: vitest (`tests/e2e/`) — tests against running demo server, requires authenticated backend
- Chat SDK integration: `tests/unit/chat/integration-phase2.test.ts` — storage → sessions → context pipeline

```bash
npm run test      # unit tests only (excludes integration + e2e)
npm run test:e2e  # demo server E2E tests (requires running demo)
```

### E2E Test Infrastructure (`tests/e2e/`)

Tests against a running demo server (`npm run demo`).
Requires authenticated backend (Copilot device flow, Vercel AI key, etc.).
Set `DEMO_URL` env var to override default `http://localhost:3456`.

- `helpers/api-client.ts`: typed HTTP client for all demo routes (auth, sessions, chat, models)
- `helpers/sse-parser.ts`: SSE stream parser (text/event-stream → typed `SSEEvent` objects)
- `helpers/server-manager.ts`: child process lifecycle utilities (optional, for programmatic server control)
- `demo.test.ts`: 11 scenarios — health, session CRUD, full SSE chat stream, model allowlist enforcement
- `vitest.e2e.config.ts`: separate config with 120s timeout

Prerequisite: `npm run demo` and authenticate in browser before running tests.

### ⛔ CRITICAL: Model usage in tests

**NEVER use paid models in integration tests.** They consume the user's subscription.

Allowed models per backend:
- **Copilot**: `gpt-5-mini` ONLY
- **Claude**: `claude-haiku-4-5-*` ONLY (cheapest available)
- **Vercel AI / OpenRouter**: `openai/gpt-4.1-mini` or equivalent cheapest

**FORBIDDEN in tests**: `gpt-4.1`, `gpt-5`, `gpt-5.1`, `claude-sonnet-*`, `claude-opus-*`, any premium model.
If you add or modify integration tests — use ONLY the cheapest model for that backend.

## Documentation

- `README.md` — public API docs with usage examples
- `CLAUDE.md` — internal architecture reference (this file)
- `CHANGELOG.md` — release history
- `docs/chat-sdk/README.md` — chat SDK module documentation (consumer-facing)
- `docs/chat-sdk/custom-transports.md` — custom transport implementation guide
- `docs/chat-sdk/custom-renderers.md` — custom renderer guide (CSS theming, slot overrides, per-tool dispatch)

