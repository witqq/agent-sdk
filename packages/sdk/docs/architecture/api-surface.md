---
title: API Surface
project: "@witqq/agent-sdk"
---

# API Surface

Public exports inventory grouped by entry point.

## Stability Levels

- **Stable**: Production-ready. Breaking changes only in major versions.
- **Experimental**: API may change in minor versions. Marked with `@experimental` JSDoc.
- **Deprecated**: Scheduled for removal. Marked with `@deprecated` JSDoc. Use alternative.

## Entry Points

### `@witqq/agent-sdk` (Core)

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `IAgentService` | interface | Stable | Agent abstraction: run, stream, runStructured, listModels, validate, dispose |
| `BaseAgent` | abstract class | Stable | State machine base: idle→running/streaming→idle→disposed, retry, abort |
| `ToolDefinition` | interface | Stable | Tool with execute function, inputSchema, description |
| `ToolDeclaration` | interface | Stable | Tool schema without execute (for declaration-only contexts) |
| `ToolContext` | interface | Stable | Request-scoped session data passed to tool execute |
| `Message` | interface | Stable | Conversation message: role, content (string or ContentPart[]) |
| `AgentEvent` | union type | Stable | 18-type discriminated union for agent stream events |
| `RunOptions` | interface | Stable | Per-call options: model (required), tools, systemMessage, retry |
| `AgentConfig` | interface | Stable | Construction-time config: tools, systemMessage, providerOptions |
| `registerBackend` | function | Stable | Register custom backend factory |
| `createAgentService` | function | Stable | Create agent service by backend name |
| `AgentSDKError` | class | Stable | Base error with cross-bundle `is()` static method |
| `IPermissionStore` | interface | Stable | Tool permission storage: check, grant, revoke |
| `InMemoryPermissionStore` | class | Stable | In-memory permission store |
| `FilePermissionStore` | class | Stable | File-based permission store |
| `CompositePermissionStore` | class | Stable | Multi-source permission store |
| `zodToJsonSchema` | function | Stable | Zod schema → JSON Schema conversion (v3+v4) |

### `@witqq/agent-sdk/copilot`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `CopilotAgentService` | class | Stable | Wraps @github/copilot-sdk subprocess |

### `@witqq/agent-sdk/claude`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `ClaudeAgentService` | class | Stable | Wraps @anthropic-ai/claude-agent-sdk subprocess |

### `@witqq/agent-sdk/vercel-ai`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `VercelAIAgentService` | class | Stable | Wraps ai + @ai-sdk/openai-compatible HTTP API |

### `@witqq/agent-sdk/auth`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `CopilotAuth` | class | Stable | GitHub Device Flow: startDeviceFlow → waitForToken |
| `ClaudeAuth` | class | Stable | OAuth PKCE: startOAuthFlow → completeAuth |
| `TokenRefreshManager` | class | Stable | Background refresh with threshold, backoff, events |
| `AuthToken` | interface | Stable | Token with accessToken, expiresAt, refreshToken? |
| `AuthError` | class | Stable | Auth-specific error (extends AgentSDKError) |

### `@witqq/agent-sdk/chat`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| (barrel) | re-exports | Stable | Convenience re-export of common consumer types from core, runtime, sessions, errors, backends, context, accumulator, events, state, watchdog |

### `@witqq/agent-sdk/chat/core`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `ChatMessage<TMetadata>` | interface | Stable | Message with parts array, metadata, status |
| `ChatSession<TCustom>` | interface | Stable | Session container with messages, config, metadata |
| `ChatEvent` | union type | Stable | 18-type discriminated union (colon-separated names) |
| `ChatId` | branded type | Stable | UUID-validated session identifier |
| `MessagePart` | union type | Stable | 5 variants: Text, Reasoning, ToolCall, Source, File |
| `IChatProvider` | interface | Stable | Abstract provider: sendMessage, streamMessage, listModels |
| `ChatMiddleware` | interface | Stable | 4 lifecycle hooks: beforeSend, onEvent, afterReceive, onError |

### `@witqq/agent-sdk/chat/runtime`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `IChatRuntime<TMetadata>` | interface | Stable | Server-side runtime: send, sessions, tools, middleware |
| `IChatClient<TMetadata>` | interface | Stable | Client-side: send, sessions, provider CRUD |
| `createChatRuntime` | function | Stable | Factory for ChatRuntime |
| `ChatRuntimeOptions` | interface | Stable | Options: defaultBackend, backends, sessionStore, contextConfig |

### `@witqq/agent-sdk/chat/backends`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `IChatBackend` | interface | Stable | Backend adapter: streamMessage, sendMessage, resume, listModels |
| `IResumableBackend` | interface | Stable | Extends IChatBackend with session resume support |
| `BaseBackendAdapter` | abstract class | Stable | Base adapter with service lifecycle |
| `CopilotChatAdapter` | class | Stable | Copilot adapter (persistent session) |
| `ClaudeChatAdapter` | class | Stable | Claude adapter (persistent session) |
| `VercelAIChatAdapter` | class | Stable | Vercel AI adapter (stateless) |
| `MockLLMChatAdapter` | class | Stable | Mock LLM adapter (zero-auth, in-process) |
| `IChatTransport` | interface | Stable | Transport: send, error, close |
| `SSEChatTransport` | class | Stable | Server-Sent Events transport |
| `WsChatTransport` | class | Stable | WebSocket transport |
| `InProcessChatTransport` | class | Stable | Zero-network transport (testing/CLI) |
| `withInterceptors` | function | Stable | Composable transport interceptors |

### `@witqq/agent-sdk/chat/server`

Representative exports (see `src/chat/server/index.ts` for complete list):

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `createChatHandler` | function | Stable | HTTP handler for chat runtime (10 routes) |
| `createAuthHandler` | function | Stable | HTTP handler for auth (8 routes) |
| `createChatServer` | function | Stable | One-call server factory combining all handlers |
| `createProviderHandler` | function | Stable | CRUD handler for provider configurations |
| `corsMiddleware` | function | Stable | Standalone CORS middleware |
| `ServiceManager` | class | Stable | IAgentService lifecycle management (create, cache, dispose) |
| `AdapterPool` | class | Stable | Adapter pool with credential-based keying |
| `resolveRequestContext` | function | Stable | Resolves providerId → { backend, credentials, model } per-request |
| `ITokenStore` | interface | Stable | Token persistence: save, load, clear, list |
| `IProviderStore` | interface | Stable | Provider CRUD: create, get, update, delete, list |

### `@witqq/agent-sdk/chat/accumulator`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `MessageAccumulator` | class | Stable | Stream-to-message converter: AgentEvent → ChatMessage with parts |

### `@witqq/agent-sdk/chat/context`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `ContextWindowManager` | class | Stable | Stateless context trimmer: fitMessages, fitMessagesAsync |
| `estimateTokens` | function | Stable | Character-based token estimation (4 chars/token default) |
| `OverflowStrategy` | type | Stable | `truncate-oldest` / `sliding-window` / `summarize-placeholder` |
| `ContextSummarizer` | type | Stable | Async function for generating summary of removed messages |
| `ContextWindowConfig` | interface | Stable | Config: maxTokens, reservedTokens, strategy, estimation |
| `ContextWindowResult` | interface | Stable | Result: messages, totalTokens, removedCount, wasTruncated |
| `ContextStats` | interface | Stable | Per-session stats: totalTokens, availableBudget, removedCount |

### `@witqq/agent-sdk/chat/errors`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `ChatError` | class | Stable | Error with ChatErrorCode, retryable flag, timestamp |
| `ErrorCode` | enum | Stable | 28 error codes (NETWORK, TIMEOUT, AUTH_EXPIRED, TOOL_EXECUTION, PROVIDER_NOT_FOUND, etc.) |
| `classifyError` | function | Stable | Maps unknown error → ChatError via pattern matching |
| `ExponentialBackoffStrategy` | class | Stable | Retry with jitter, rate-limit respect |
| `withRetry` | function | Stable | Async retry wrapper with AbortSignal support |
| `isRetryable` | function | Stable | Check if error is retryable |

### `@witqq/agent-sdk/chat/events`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `TypedEventEmitter<T>` | class | Stable | Generic emitter with on/off/once/emit |
| `ChatEventBus` | class | Stable | ChatEvent-specialized emitter with middleware pipeline |
| `EventMiddleware` | type | Stable | Middleware: ctx.event, ctx.next(), ctx.suppress() |
| `ChatEventMap` | type | Stable | Event type → payload mapping for TypedEventEmitter |
| `eventFilter` | function | Stable | Predicate factory for ChatEvent type filtering |
| `filterEvents` | function | Stable | Async iterable filter by event type |
| `mapEvents` | function | Stable | Async iterable map (null = skip) |
| `collectText` | function | Stable | Collect message_delta text into single string |

### `@witqq/agent-sdk/chat/sessions`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `IChatSessionStore` | interface | Stable | Session CRUD: create, get, list, update, delete, addMessage |
| `ISessionReader` | interface | Stable | Read-only session operations |
| `ISessionWriter` | interface | Stable | Write session operations |
| `InMemorySessionStore` | class | Stable | In-memory session store for dev/testing |
| `FileSessionStore` | class | Stable | File-based session store with JSON persistence |
| `PaginatedMessages` | interface | Stable | Paginated message retrieval result |

### `@witqq/agent-sdk/chat/state`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `StateMachine<S>` | class | Stable | Generic state machine with TransitionMap, transition(), canTransition() |
| `RUNTIME_TRANSITIONS` | const | Stable | idle→streaming/disposed, streaming→idle/error/disposed |
| `MESSAGE_TRANSITIONS` | const | Stable | pending→streaming/error/cancelled, streaming→complete/error/cancelled |
| `TOOL_CALL_TRANSITIONS` | const | Stable | pending→running/requires_approval/error, etc. |
| `createRuntimeStateMachine` | function | Stable | Factory for runtime state machine |
| `createMessageStateMachine` | function | Stable | Factory for message state machine |
| `createToolCallStateMachine` | function | Stable | Factory for tool call state machine |
| `ChatReentrancyGuard` | class | Stable | acquire()/release() with REENTRANCY error |
| `ChatAbortController` | class | Stable | AbortController with external signal linking |

### `@witqq/agent-sdk/chat/storage`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `IStorageAdapter<T>` | interface | Stable | Generic CRUD: create, get, update, delete, has, list, query |
| `InMemoryStorage<T>` | class | Stable | In-memory with structuredClone isolation |
| `FileStorage<T>` | class | Stable | JSON-file-per-item with percent-encoding keys |
| `StorageError` | class | Stable | Typed error: NOT_FOUND, ALREADY_EXISTS, STORAGE_ERROR, etc. |

### `@witqq/agent-sdk/chat/react`

Representative exports (see `src/chat/react/index.ts` for complete list):

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `ChatProvider` | component | Stable | React context provider for IChatClient |
| `useChat` | hook | Stable | Send/stop/status with progressive streaming |
| `useMessages` | hook | Stable | Reactive message list via useSyncExternalStore |
| `useSessions` | hook | Stable | Reactive session list with auto-refresh |
| `ChatUI` | component | Stable | Composite: Thread+Composer+ThreadList+Selectors |
| `Thread` | component | Stable | Message list with auto-scroll |
| `Composer` | component | Stable | Input with auto-resize, send/stop buttons |
| `ThreadList` | component | Stable | Session sidebar with search and CRUD |
| `Message` | component | Stable | Renders ChatMessage.parts with render props |
| `ModelSelector` | component | Stable | Dropdown with keyboard nav, search, tier badges |
| `ProviderSelector` | component | Stable | Provider dropdown with settings gear |
| `ProviderSettings` | component | Stable | CRUD panel for provider configurations |
| `ProviderModelSelector` | component | Stable | Unified provider/model selector (auto-detects mode) |
| `useRemoteAuth` | hook | Stable | Server-delegated auth (Copilot Device Flow, Claude OAuth, API key) |
| `useRemoteChat` | hook | Stable | Lifecycle orchestrator: auth→runtime→session |
| `BackendSelector` | component | Stable | Backend selection dropdown |
| `useBackends` | hook | Stable | Backend list hook |
| `useProviders` | hook | Stable | Provider list hook with CRUD |
| `ChatLayout` | component | Stable | Layout container with sidebar + main column |
| `ChatHeader` | component | Stable | Header with backend/model selectors |
| `ChatInputArea` | component | Stable | Input area with provider selector + composer |
| `ChatSettingsOverlay` | component | Stable | Modal overlay for provider settings |
| `UsageBadge` | component | Stable | Token usage display badge |
| `ContextStatsDisplay` | component | Stable | Context window stats display |
| `CopilotAuthForm` | component | Stable | Copilot Device Flow auth form |
| `ClaudeAuthForm` | component | Stable | Claude OAuth auth form |
| `VercelAIAuthForm` | component | Stable | API key auth form |
| `useCopilotAuth` | hook | Stable | Copilot-specific auth hook |
| `useClaudeAuth` | hook | Stable | Claude-specific auth hook |
| `useApiKeyAuth` | hook | Stable | API key auth hook |
| `RemoteChatClient` | class | Stable | HTTP/SSE proxy implementing IChatClient |

### `@witqq/agent-sdk/chat/react/theme.css`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| (CSS file) | stylesheet | Stable | Default theme via CSS custom properties + data-* selectors |

### `@witqq/agent-sdk/chat/sqlite`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `createSQLiteStorage` | function | Stable | Factory: single DB → sessionStore + providerStore + tokenStore |
| `SQLiteSessionStore` | class | Stable | IChatSessionStore on better-sqlite3 |
| `SQLiteProviderStore` | class | Stable | IProviderStore on better-sqlite3 |
| `SQLiteTokenStore` | class | Stable | ITokenStore on better-sqlite3 |

### `@witqq/agent-sdk/mock-llm`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `createMockLLMService` | function | Experimental | Factory returning `IAgentService` — full-lifecycle mock with latency, streaming, permissions, tool calls, structured output |
| `MockLLMBackendOptions` | type | Experimental | Configuration options for the mock service |
| `MockLLMResponseMode` | type | Experimental | Discriminated union: `{ type: "echo" } \| { type: "static"; response } \| { type: "scripted"; responses } \| { type: "error"; error }` |
| `MockLLMLatency` | type | Experimental | Latency config: `{ type: "fixed"; ms } \| { type: "random"; minMs; maxMs }` |
| `MockLLMStreamingOptions` | type | Experimental | Streaming chunk control: `chunkSize`, `chunkDelayMs` |
| `MockLLMPermissionOptions` | type | Experimental | Permission simulation: `toolNames`, `autoApprove`, `denyTools` |
| `MockLLMToolCall` | type | Experimental | Tool call simulation: `toolName`, `args`, `result`, `toolCallId` |

### `@witqq/agent-sdk/testing`

| Export | Kind | Stability | Description |
|--------|------|-----------|-------------|
| `createMockSession` | function | Stable | Mock ChatSession with valid defaults |
| `createMockMessage` | function | Stable | Mock ChatMessage with text part |
| `createMockAgentService` | function | Stable | Mock IAgentService with configurable handlers. Accepts `mockLLMBackend` option for full MockLLMAgent delegation |
| `createMockRuntime` | function | Stable | Mock IChatRuntime with in-memory sessions |
| `createMockChatClient` | function | Stable | Mock IChatClient with provider CRUD |

## Deprecated Exports

| Export | Entry Point | Alternative | Since |
|--------|-------------|-------------|-------|
| `currentModel` | chat/runtime (IChatRuntime) | Returns undefined, model is per-call | 0.x |
