# CLAUDE.md — agent-sdk

## Project

AI agent abstraction layer (npm package).
3 backends: Copilot CLI SDK, Claude CLI SDK, Vercel AI SDK v6.
Shared interfaces for tools, permissions, streaming, structured output.

## Build

```bash
npm run build     # tsup → ESM + CJS + DTS
npm run test      # vitest (1765+ tests)
npm run typecheck # tsc --noEmit
```

## Architecture

CLI SDKs (Copilot, Claude) ARE the agent runtime — they decide tool calls.
API SDKs (Vercel AI) — WE drive the tool loop via generateText().

Key types: `ToolDeclaration` (schema only) / `ToolDefinition` (with execute) / `ToolContext` (request-scoped session data for tools).
Permission v3.1: scopes `once | session | project | always`.
Zod compatibility: v3.23+ and v4.x (peer dep `^3.23.0 || ^4.0.0`).
Permission store: `IPermissionStore` with `InMemoryPermissionStore`, `FilePermissionStore`, `CompositePermissionStore`.
Error hierarchy: `AgentSDKError` base class with `_agentSDKError` marker and `AgentSDKError.is()` static method for cross-bundle instanceof checks (tsup bundles duplicate classes). `StorageError`, `AuthError`, `ChatError` all extend `AgentSDKError`.

### Package Exports

```
@witqq/agent-sdk           → src/index.ts (types, registry, factory, permission store)
@witqq/agent-sdk/copilot   → src/backends/copilot.ts
@witqq/agent-sdk/claude    → src/backends/claude.ts
@witqq/agent-sdk/vercel-ai → src/backends/vercel-ai.ts
@witqq/agent-sdk/auth      → src/auth/index.ts (CopilotAuth, ClaudeAuth, TokenRefreshManager, token types)
@witqq/agent-sdk/chat         → src/chat/index.ts (barrel re-export of common consumer types from core, runtime, sessions, errors, backends, context, accumulator, events)
@witqq/agent-sdk/chat/core    → src/chat/core.ts (ChatMessage, ChatSession, ChatEvent, IChatProvider, bridge functions)
@witqq/agent-sdk/chat/errors   → src/chat/errors.ts (ChatSDKError hierarchy, classifyError, retry strategies)
@witqq/agent-sdk/chat/events   → src/chat/events.ts (TypedEventEmitter, ChatEventBus, middleware, filter/map utilities)
@witqq/agent-sdk/chat/storage  → src/chat/storage.ts (IStorageAdapter, InMemoryStorage, FileStorage, StorageError)
@witqq/agent-sdk/chat/sessions → src/chat/sessions.ts (IChatSessionStore, InMemorySessionStore, FileSessionStore)
@witqq/agent-sdk/chat/context  → src/chat/context.ts (ContextWindowManager, estimateTokens, overflow strategies)
@witqq/agent-sdk/chat/accumulator → src/chat/accumulator.ts (MessageAccumulator)
@witqq/agent-sdk/chat/state     → src/chat/state.ts (StateMachine, transition maps, factory functions)
@witqq/agent-sdk/chat/backends  → src/chat/backends/index.ts (IBackendAdapter, BaseBackendAdapter, CopilotChatAdapter, ClaudeChatAdapter, VercelAIChatAdapter, SSEChatTransport, WsChatTransport, InProcessChatTransport, IChatTransport, CloseDetectable, SSETransportOptions, WebSocketLike, WsTransportOptions, TransportInterceptor, withInterceptors)
@witqq/agent-sdk/chat/runtime   → src/chat/runtime.ts (IChatRuntime, ChatRuntime, createChatRuntime)
@witqq/agent-sdk/chat/react     → src/chat/react/index.ts (ChatProvider, useChatRuntime, useChat, useMessages, useSessions, useToolApproval, useSSE, useModels, useAuth, useRemoteAuth, useRemoteChat, Message, ThinkingBlock, ToolCallView, MarkdownRenderer, Thread, Composer, ThreadSlots, ThreadList, ModelSelector, AuthDialog, RemoteChatRuntime)
@witqq/agent-sdk/chat/server   → src/chat/server/index.ts (createChatHandler, createAuthHandler, createChatServer, corsMiddleware, ITokenStore, InMemoryTokenStore, FileTokenStore, AuthHandlerOptions, OnAuthCallback, ChatHandlerOptions, ChatServerOptions, RequestHandler, CorsOptions, ReadableRequest, WritableResponse)
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

### Copilot Backend (`src/backends/copilot.ts`)

`CopilotAgentService` wraps `@github/copilot-sdk` (optional peer dep).
- `ensureClient()`: lazy init, explicit `start()`, auth check, caches via promise
- Session modes: `per-call` (default) creates fresh session per call; `persistent` reuses session across calls
- `getOrCreateSession()`: session lifecycle — reuse persistent or create new; persistent always streaming=true
- `clearPersistentSession()`: error recovery — clears broken session so next call creates fresh one
- `sessionId` getter: exposes CLI session ID for persistent mode tracking
- `ToolCallTracker`: maps `toolCallId` → `toolName` (SDK's `tool.execution_complete` lacks name)
- Tool event parsing: `tool.execution_start` args parsed from JSON string; `tool.execution_complete` result unwrapped from `{ content: ... }` wrapper
- `ThinkingTracker`: tracks reasoning state, emits `thinking_start`/`thinking_delta`/`thinking_end` from `assistant.reasoning_delta` events
- `mapToolsToSDK()`: `ToolDefinition[]` → SDK `Tool[]` with `convertParameters` (Zod→JSON Schema or passthrough)
- `mapToolsToSDKAsync()`: async version for pre-session Zod conversion
- `_initToolsAsync()`: async init remaps tools before first session; `_toolsReady` promise awaited in `getOrCreateSession()`
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
- Test injection: `_injectSDK()` / `_resetSDK()`

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
- `ChatSession<TCustom>`: conversation container with messages, config, metadata (`TCustom` defaults to `Record<string, unknown>` for `metadata.custom` field); optional reactive API (`subscribe`, `getSnapshot`, `lastMessage`)
- `SessionInfo`: lightweight session listing type (id, title, updatedAt, messageCount, status)
- `ChatEvent`: 18-type discriminated union with colon-separated names (e.g. `message:start`, `tool:complete`, `done`)
- `IChatProvider`: abstract provider interface (sendMessage, streamMessage, listModels, validate, dispose)
- `ChatMiddleware`: runtime middleware with 4 lifecycle hooks (beforeSend, onEvent, afterReceive, onError)
- `SendMessageOptions`: optional overrides per send call — `model`, `systemMessage`, `signal` (AbortSignal), `tools` (ToolDefinition[])
- Type guards: `isChatMessage()`, `isChatSession()`, `isMessagePart()`, `isTextPart()`, `isReasoningPart()`, `isToolCallPart()`, `isSourcePart()`, `isFilePart()`, `isChatEvent()`
- Utilities: `getMessageText()`, `getMessageToolCalls()`, `getMessageReasoning()`
- Bridge: `agentEventToChatEvent()` maps AgentEvent→ChatEvent, `chatEventToAgentEvent()` maps ChatEvent→AgentEvent (returns null for non-accumulator events), `adaptAgentEvents()` async generator
- Conversion: `toAgentMessage()` / `fromAgentMessage()` for ChatMessage↔Message

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
- `ChatError` extends `AgentSDKError`: single error class with `code: ChatErrorCode`, `retryable`, `timestamp`
- `ChatErrorCode`: 20-code enum (NETWORK, TIMEOUT, AUTH_EXPIRED, AUTH_INVALID, RATE_LIMIT, PROVIDER_ERROR, MODEL_NOT_FOUND, MODEL_OVERLOADED, CONTEXT_OVERFLOW, INVALID_INPUT, INVALID_RESPONSE, PERMISSION_DENIED, BACKEND_NOT_INSTALLED, SESSION_NOT_FOUND, SESSION_EXPIRED, STORAGE_ERROR, DISPOSED, ABORTED, INVALID_TRANSITION, REENTRANCY)
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
- `StorageError` (extends `AgentSDKError`): typed error with codes `NOT_FOUND`, `ALREADY_EXISTS`, `STORAGE_ERROR`, `SERIALIZATION_ERROR`, `VALIDATION_ERROR`
- `query()` supports `filter`, `sort`, `limit`, `offset` for flexible retrieval

### Chat Sessions (`src/chat/sessions.ts`)

Session store layer wrapping storage adapters with session-specific operations.
- `IChatSessionStore`: `createSession`, `getSession`, `listSessions`, `updateTitle`, `updateConfig`, `deleteSession`, `addMessage`, `getMessages`, `searchSessions`, `count`, `clear`
- `InMemorySessionStore`: in-memory session store for dev/testing
- `FileSessionStore`: file-based session store with JSON persistence
- `PaginatedMessages`: `{ messages, total, hasMore }` for paginated retrieval
- `searchSessions()`: case-insensitive substring match on title + message content
- `addMessage()` deep-clones messages, updates `messageCount` and `updatedAt`
- `CreateSessionOptions`: `config` is `Partial<ChatSessionConfig>` (optional). Store provides fallback empty strings for model/backend; runtime fills defaults from `_currentModel`/`_currentBackend`.

### Context Window Manager (`src/chat/context.ts`)

Stateless context window manager — messages in, trimmed messages out.
- `estimateTokens(message, options?)`: character-based heuristic (default 4 chars/token), handles text, tool calls, multimodal content
- `ContextWindowManager`: configurable via `maxTokens`, `reservedTokens`, `strategy`, `estimation`, `summarizer`
- `fitMessages(messages)` → `ContextWindowResult { messages, totalTokens, removedCount, wasTruncated }`
- `fitMessagesAsync(messages)` → `Promise<ContextWindowResult>` — async variant that calls `ContextSummarizer` for `summarize-placeholder` strategy, falls back to static placeholder on error
- `ContextSummarizer`: `(removedMessages: readonly ChatMessage[]) => Promise<string>` — optional async function for generating summary text
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

### Chat Backend Adapters (`src/chat/backends/`)

High-level backend adapters bridging IAgentService → ChatEvent stream.
- `IBackendAdapter`: interface — `streamMessage()`, `sendMessage()`, `resume()`, `listModels()`, `validate()`, `dispose()`
- `BackendAdapterOptions`: `agentConfig` + optional `agentService` (injected or self-created)
- `BaseBackendAdapter`: abstract base with lifecycle, event bridge via `adaptAgentEvents()`, tool forwarding
  - Service ownership: `_ownsService` flag — `true` when self-created via `createService()`, `false` when injected. `dispose()` only disposes service if owned.
  - `getOrCreateAgent()`: per-call or persistent mode, applies model override
  - `streamAgentEvents()`: shared streaming helper — agent events → `message:start` + `adaptAgentEvents()` + `message:complete`
- `CopilotChatAdapter`: wraps CopilotAgentService, auto-sets `sessionMode: "persistent"`, captures `sessionId` for resume
- `ClaudeChatAdapter`: wraps ClaudeAgentService, auto-sets `sessionMode: "persistent"`, captures `sessionId` for resume
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
- `IChatRuntime<TMetadata>`: generic interface — `TMetadata` defaults to `Record<string, unknown>`, flows through `createSession()` and `getSession()` for typed `metadata.custom` field. Methods: `send()`, `abort()`, `dispose()`, session CRUD (`createSession`, `getSession`, `listSessions`, `deleteSession`, `archiveSession`, `switchSession`), `registerTool()`, `removeTool()`, `switchBackend()`, `switchModel()`, `listModels()`, `use()` middleware, `onSessionChange()` subscription, `status` getter
- `ChatRuntime<TMetadata>`: implements `IChatRuntime<TMetadata>` with `StateMachine`, `ChatReentrancyGuard`, `ChatAbortController`
  - Lazy adapter creation: factory map `Record<string, () => IBackendAdapter>`, adapters cached per backend name
  - `send(sessionId, content, options?)`: persist user msg → onBeforeSend middleware → stream adapter → `feedAccumulator()` → onEvent middleware → persist assistant msg → onAfterReceive middleware; handles abort, error, dispose-during-send
  - Error auto-recovery: if state is `error`, transitions to `idle` at start of `send()` for transient failure recovery
  - Dispose-during-send: graceful exit after streaming loop if disposed mid-stream
  - `feedAccumulator()`: maps `ChatEvent` → `AgentEvent` via `chatEventToAgentEvent()` for `MessageAccumulator`
  - Tool registry: runtime-level `Map<string, ToolDefinition>`, persists across backend switches, passed to adapters via `SendMessageOptions.tools`
  - Tool context injection: `injectToolContext()` wraps each tool's execute with `ToolContext { sessionId, custom? }` built from current session before passing to adapter
  - Context trimming: `ContextWindowManager.fitMessagesAsync()` applied to session messages before send (supports async summarizer)
  - Context stats: `getContextStats(sessionId)` returns `ContextStats | null` (totalTokens, removedCount, wasTruncated, availableBudget) per session, updated on each send
  - Archive callback: `onContextTrimmed(sessionId, removedMessages)` in options, fires when trimming removes messages, wrapped in try/catch for safety
  - Middleware pipeline: `onBeforeSend` → `onEvent` → `onAfterReceive` → `onError`, sequential in registration order
  - Empty/whitespace message validation at start of `send()`
  - Pre-stream retry: `RetryConfig` (`maxRetries`, `initialDelayMs`, `backoffMultiplier`) retries adapter creation and first event; once first event received, stream committed (no mid-stream retry); failed adapters disposed before retry
  - Stream watchdog: `streamTimeoutMs` option wraps event stream with `withStreamWatchdog()` — aborts with `ChatError(TIMEOUT)` if no events arrive within the configured inactivity window
  - Session subscription: `onSessionChange(callback: () => void): () => void` — fires on createSession, deleteSession, archiveSession, and after send completes. `_sessionListeners` Set with try/catch error isolation per listener
  - Session creation defaults: `createSession()` fills `config.model` from `_currentModel` and `config.backend` from `_currentBackend` when not provided
- `createChatRuntime<TMetadata>(options)`: factory function creating `ChatRuntime<TMetadata>` instance
- `ChatRuntimeOptions`: `defaultBackend`, `defaultModel`, `backends` (factory map), `sessionStore`, `contextConfig?`, `middleware?`, `retry?`, `streamTimeoutMs?`, `onContextTrimmed?`

### React Bindings (`src/chat/react/`)

Headless React hooks and components wrapping IChatRuntime. React 18+ as optional peer dependency.
- `ChatProvider`: React context provider wrapping IChatRuntime, createElement-based (no JSX required)
- `useChatRuntime()`: Context accessor hook, throws if used outside ChatProvider
- `useChat(options?)`: Convenience hook — `sendMessage`, `stop`, `isGenerating`, `status`, `error`, `clearError`, `newSession`, auto-creates session on first send, concurrent send protection via ref guard, progressive streaming via local `MessageAccumulator` (tokens display progressively), abort finalizes accumulator with error status preserving partial message
- `useMessages({ sessionId })`: Reactive message list via `useSyncExternalStore`, supports `ChatSession.subscribe/getSnapshot` or falls back to 500ms polling
- `useSessions()`: Reactive session list hook — subscribes via `runtime.onSessionChange()`, auto-refreshes on create/delete/archive/send. Returns `UseSessionsReturn { sessions: SessionInfo[], loading, error, refresh }`. `toSessionInfo()` mapper converts ChatSession → SessionInfo.
- `useToolApproval(messages, onApprove?, onDeny?)`: Scans messages for ToolCallParts with `requires_approval` status, returns `pendingRequests`, `approve()`, `deny()` with useCallback memoization
- `Message(props)`: Headless message component rendering `ChatMessage.parts` array with `data-role`/`data-status` attributes, render props for all 5 part types (`renderText`, `renderReasoning`, `renderToolCall`, `renderSource`, `renderFile`)
- `ThinkingBlock({ text, isStreaming, defaultOpen })`: Native `details/summary` collapse, `data-thinking`/`data-streaming` attributes, summary text changes based on streaming state
- `ToolCallView({ part, onApprove?, onDeny?, renderArgs?, renderResult? })`: Tool call display with `data-tool-status`/`data-tool-name`, approve/deny buttons when `requires_approval`, render props for args/result
- `MarkdownRenderer({ content, renderCode?, renderLink? })`: Regex-based markdown→HTML parser, supports headings, paragraphs, bold/italic, inline code, fenced code blocks with language class, links, blockquotes, ordered/unordered lists, `data-md-*` attributes on all block elements
- `Thread({ messages, isGenerating?, autoScroll?, className? })`: Headless message list wrapper with `data-thread`/`data-thread-message`/`data-thread-loading` attributes, auto-scroll via sentinel ref + scrollIntoView, scroll-to-bottom detection via container scroll events, integrates with `ThreadSlots` context for render overrides
- `Composer({ onSend, onStop?, isGenerating?, disabled?, placeholder?, maxRows?, className? })`: Input component with auto-resizing textarea (capped at maxRows), Enter to submit / Shift+Enter for newline, send button `[data-action="send"]` disabled when empty, stop button `[data-action="stop"]` shown during generation, `aria-label="Message input"`
- `ThreadProvider`: Slot-based customization context providing `renderMessage`, `renderToolCall`, `renderThinkingBlock` overrides to Thread
- `useThreadSlots()`: Access slot overrides from ThreadProvider (throws outside provider)
- `useOptionalThreadSlots()`: Safe variant returning null when no ThreadProvider ancestor
- `ThreadList({ sessions, activeSessionId?, onSelect, onDelete?, onCreate?, searchQuery?, className? })`: Session sidebar with `data-session-item`/`data-session-active` attributes, search filter by title (case-insensitive), create button `[data-action="create-session"]`, delete button `[data-action="delete-session"]` with stopPropagation. Accepts `ChatSession[] | SessionInfo[]` via `SessionItem` union type with `isFullSession()` guard and `normalizeSession()` mapper memoized via useMemo.
- `useSSE(url, options?)`: Fetch-based SSE client hook (not EventSource), parses `text/event-stream` format with multi-line data support, yields `ChatEvent` objects via `onEvent` callback, `status` reactive state (`idle | connecting | open | closed | error`), `connect()`/`disconnect()` controls, automatic reconnection with configurable `reconnect`/`reconnectInterval` options, timer cleanup on connect/disconnect/unmount
- `useModels()`: Model list hook fetching from `runtime.listModels()`, returns `{ models, loading, error, search, setSearch, refresh }`, case-insensitive name filtering, caches results
- `ModelSelector({ models, selected?, onSelect, placeholder?, className? })`: Dropdown component with `data-model-selector-trigger`/`data-model-selector-dropdown`/`data-model-selector-item`, keyboard navigation (ArrowUp/Down/Enter/Escape), inline search input `[data-model-selector-search]`, tier badges via `data-tier` attribute
- `useAuth({ backend, onAuthenticated? })`: **@deprecated** — use `useRemoteAuth` instead. Multi-backend auth hook with state machine (idle→pending→authenticated|error). Copilot Device Flow: `startDeviceFlow()` → `deviceCode`/`verificationUrl` → `waitForToken()`. Claude OAuth+PKCE: `startOAuthFlow()` (sync) → `authorizeUrl` → `completeOAuth(codeOrUrl)`. API key: `submitApiKey(key)` with validation. Common: `token`, `status`, `error`, `reset()`
- `useRemoteAuth({ backend, baseUrl, fetch? })`: Server-delegated auth hook. Communicates with `createAuthHandler` endpoints instead of instantiating auth classes directly. Avoids `node:crypto` in browser bundles. Backends: `"copilot"`, `"claude"`, `"vercel-ai"` (note: `"api-key"` renamed to `"vercel-ai"`). Same interface shape: `startDeviceFlow`, `startOAuthFlow`, `completeOAuth`, `submitApiKey` (async, accepts optional `baseUrl`), `token` (server-managed marker), `status`, `error`, `reset`. Additional: `loadSavedTokens()`, `useSavedToken(provider)`, `clearTokens()`. Unified: `start(provider?)` auto-dispatches to correct auth flow (copilot→device flow, claude→OAuth; vercel-ai throws — requires `submitApiKey`)
- `useRemoteChat({ baseUrl, authBaseUrl?, fetch?, autoRestore?, onReady? })`: Lifecycle orchestrator hook composing auth → runtime → session. Phase state machine: `initializing` → `unauthenticated` → `authenticating` → `creating` → `ready` → `error`. On mount: loads saved tokens via `useRemoteAuth.loadSavedTokens()`, auto-restores first saved provider (unless `autoRestore: false`). On auth success: creates `RemoteChatRuntime`, creates initial session, transitions to `ready`, calls `onReady(runtime)`. Returns: `phase` (RemoteChatPhase), `runtime` (RemoteChatRuntime | null), `sessionId` (string | null), `error` (Error | null), `auth` (UseRemoteAuthReturn for manual control), `newSession()` (creates new session), `logout()` (disposes runtime, clears tokens, resets to unauthenticated). Ref guards: `mountedRef` (prevents post-unmount setState), `creatingRef` (prevents double runtime creation), `restoredRef` (prevents double auto-restore). `tokensLoaded` state gates the savedProviders check to avoid race conditions.
- `AuthDialog({ backends, selectedBackend?, onBackendChange?, onAuthenticated?, renderCopilotFlow?, renderClaudeFlow?, renderApiKeyFlow?, className? })`: Headless multi-backend auth dialog with `data-auth-dialog`/`data-auth-selector`/`data-auth-content`/`data-auth-status` attributes. Backend selector buttons with `data-auth-backend`/`data-auth-selected`. Per-backend default rendering with `data-auth-flow` attribute. Render props for custom UI per backend. Error display via `data-auth-error-display`
- Types: `UseChatOptions`, `UseChatReturn`, `UseMessagesOptions`, `UseMessagesReturn`, `UseSessionsReturn`, `ChatProviderProps`, `MessageProps`, `ThinkingBlockProps`, `ToolCallViewProps`, `MarkdownRendererProps`, `UseToolApprovalReturn`, `PendingToolRequest`, `ThreadProps`, `ComposerProps`, `ThreadSlotOverrides`, `ThreadProviderProps`, `ThreadListProps`, `SSEStatus`, `UseSSEOptions`, `UseSSEReturn`, `ModelOption` (was `ModelInfo`, deprecated alias kept), `UseModelsReturn`, `ModelSelectorProps`, `AuthBackend`, `AuthStatus`, `UseAuthOptions`, `UseAuthReturn`, `AuthDialogProps`, `RemoteAuthBackend`, `RemoteAuthStatus`, `UseRemoteAuthOptions`, `UseRemoteAuthReturn`, `RemoteChatPhase`, `UseRemoteChatOptions`, `UseRemoteChatReturn`
- `RemoteChatRuntime`: client-side `IChatRuntime` adapter that delegates every operation over HTTP/SSE to a remote server. Bridges React hooks (which require in-process runtime) with server-side `ChatRuntime`.
  - Constructor: `RemoteChatRuntimeOptions` — `baseUrl`, optional `headers`, optional `fetch` override (testability)
  - `send()`: POST to `{baseUrl}/send` with SSE stream response, parsed via `ReadableStream` reader. AbortSignal races with `reader.read()` for clean cancellation.
  - Session CRUD: REST calls to `{baseUrl}/sessions/{create|list|get|delete|archive}`
  - `abort()`: cancels in-flight SSE stream via AbortController + server notification POST
  - `switchBackend()`/`switchModel()`/`listModels()`: REST delegation
  - Tools/middleware: client-side registries (server handles actual execution)
  - `onSessionChange()`: local `_sessionListeners` Set with `_notifySessionChange()`, fires on createSession/deleteSession/archiveSession/send completion. Same error isolation as `ChatRuntime`.
  - `getContextStats()`: returns null (server-side concern)
  - Server endpoint contract defined in JSDoc: POST /sessions/create, GET /sessions/{id}, GET /sessions, DELETE /sessions/{id}, POST /send, POST /abort, GET /models, POST /backend/switch, POST /model/switch

### Server Utilities (`src/chat/server/`)

Framework-agnostic HTTP handler and CORS middleware for serving `IChatRuntime` over HTTP.
- `createChatHandler(runtime, options?)`: factory returning `(req, res) => Promise<void>` handler mapping all 10 `RemoteChatRuntime` contract endpoints to `IChatRuntime` method calls
- `ReadableRequest`: minimal readable interface (`method`, `url`, `on("data"|"end")`) — node:http `IncomingMessage` subset
- `WritableResponse`: extends transport's `WritableResponse` with `setHeader()` and `end(body?)` — node:http `ServerResponse` subset
- `ChatHandlerOptions`: `prefix?` (route prefix to strip), `maxBodySize?` (default 1MB), `heartbeatMs?` (SSE heartbeat interval)
- 10 routes: POST `/sessions/create`, GET `/sessions/{id}`, GET `/sessions`, DELETE `/sessions/{id}`, POST `/sessions/{id}/archive`, POST `/send` (SSE via `SSEChatTransport` with heartbeat + close detection), POST `/abort`, GET `/models`, POST `/backend/switch`, POST `/model/switch`
- Input validation: `/send` requires `sessionId` + `message`, `/backend/switch` requires `backend`, `/model/switch` requires `model` — all return 400 on missing fields
- `readBody()`: internal JSON parser with configurable size limit, rejects with `BodyParseError` (status 413/400/500) on oversized/malformed/error input
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

### Chat Server (`src/chat/server/chat-server.ts`)

One-call server factory combining all server utilities.
- `createChatServer(options)`: factory returning `(req, res) => Promise<void>` handler that routes to chat handler, auth handler, static files, or 404
- `ChatServerOptions`: `runtime` (IChatRuntime), `auth?` (AuthHandlerOptions), `chatPrefix?` (default "/api/chat"), `authPrefix?` (default "/api/auth"), `staticDir?` (absolute path), `cors?` (boolean | CorsOptions, default true), `heartbeatMs?` (SSE keepalive interval)
- Routing order: chatPrefix → authPrefix → staticDir → 404
- Static serving: MIME type detection, index.html fallback, directory traversal protection (CWE-22 with `path.sep` boundary check)
- `RequestHandler`: type alias for `(req: ReadableRequest, res: WritableResponse) => Promise<void>`

### SQLite Storage Example (`examples/sqlite-storage/`)

IChatSessionStore implementation using better-sqlite3.
- `SQLiteSessionStore`: full contract — CRUD, pagination, search, archive
- Schema: `sessions` + `messages` tables, JSON TEXT for parts/metadata
- WAL journal mode, foreign keys, position-based message ordering
- 30 tests in `tests/unit/examples/storage-adapters.test.ts`

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

Single-screen chat UI with inline provider/model selection, built with SDK React components and server utilities.
- `server.ts`: node:http backend using SDK server utilities (`createChatHandler`, `createAuthHandler`, `FileTokenStore`, `corsMiddleware`). Runtime auto-created in `onAuth` callback. App-specific code: tool definitions, runtime factory, model allowlist enforcement.
- `model-allowlist.ts`: Model filtering utilities — `createAllowlist()`, `isModelAllowed()`, `filterModels()`. Default: only `gpt-5-mini` allowed. Override via `DEMO_ALLOWED_MODELS` env var (comma-separated).
- `frontend/`: React app using SDK headless components (`ChatProvider`, `useChat`, `Thread`, `Composer`, `ThreadList`, `useChatRuntime`, `useSessions`, `useRemoteChat`)
- Auth: Copilot Device Flow, Claude OAuth+PKCE, Vercel AI API key — via `useRemoteChat` hook (shared auth state with `AuthDialog`)
- Chat: `useRemoteChat` orchestrates auth → `RemoteChatRuntime` → session lifecycle automatically
- Runtime: `createChatRuntime()` with backend factory map, delegates session/context/adapter management
- Sessions: reactive via `useSessions` hook (no polling) — auto-updates on create/delete/archive/send
- Context: trimming handled internally by runtime (8192 tokens, 500 reserved)
- Model safety: Server intercepts `/models`, `/model/switch`, `/send` before SDK handler — filters `listModels` response, rejects disallowed models with 403, blocks model overrides in send
- CSS: headless components styled via `[data-*]` attribute selectors in `globals.css`

```bash
npm run demo              # Build & start in Docker (port 3456) — единственная команда
npm run demo -- stop      # Stop Docker container
npm run demo -- logs      # Follow Docker logs
npm run demo -- restart   # Rebuild & restart
npm run demo -- dev       # Local dev without Docker
```

### Utilities

- `zodToJsonSchema()` — Zod schema → JSON Schema (v4 toJSONSchema → v3.24 jsonSchema → v3 _def fallback)
- `messagesToPrompt()` — Message[] → flat string
- `contentToText()` — MessageContent → plain text

## Code Style

- TypeScript strict mode
- ESM-first, CJS via tsup
- zod as peer dependency
- Backend SDKs as optional peer deps
- Separate entry points per backend (tree-shaking)

## Testing

- Unit: vitest (`tests/unit/`), 1765+ tests
- Integration: vitest (`tests/integration/`) — requires real CLI authentication
- E2E: vitest (`tests/e2e/`) — tests against running demo server, requires authenticated backend
- Chat SDK integration: `tests/unit/chat/integration-phase2.test.ts` — storage → sessions → context pipeline

```bash
npm run test      # unit tests only (excludes integration + e2e)
npm run test:e2e  # demo server E2E tests (requires running demo)
```

### E2E Test Infrastructure (`tests/e2e/`)

Tests against a running demo server (`npm run demo` or `npm run demo -- dev`).
Requires authenticated backend (Copilot device flow, Vercel AI key, etc.).
Set `DEMO_URL` env var to override default `http://localhost:3456`.

- `helpers/api-client.ts`: typed HTTP client for all demo routes (auth, sessions, chat, models)
- `helpers/sse-parser.ts`: SSE stream parser (text/event-stream → typed `SSEEvent` objects)
- `helpers/server-manager.ts`: child process lifecycle utilities (optional, for programmatic server control)
- `demo.test.ts`: 11 scenarios — health, session CRUD, full SSE chat stream, model allowlist enforcement
- `vitest.e2e.config.ts`: separate config with 120s timeout

Prerequisite: `npm run demo -- dev` and authenticate in browser before running tests.

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
- `docs/archive/` — superseded documents (roadmap, architecture review, design-phase docs, research)
