# Entity Map — @witqq/agent-sdk

Total: 21 source files, 7257 LOC, 11 package exports

---

## Module 1: Core Types (`src/types.ts`, 412 LOC)

| # | Entity | Type | Line | Responsibility | Dependencies |
|---|--------|------|------|----------------|-------------|
| 1 | `JSONValue` | type | 7 | JSON-serializable value | — |
| 2 | `MessageContent` | type | 18 | Message content (string or parts) | ContentPart |
| 3 | `ContentPart` | type | 21 | Text/image message part | — |
| 4 | `ToolDeclaration` | interface | 28 | Tool schema (LLM sees) | zod |
| 5 | `ToolDefinition` | interface | 42 | Tool with execute fn | ToolDeclaration |
| 6 | `ToolCall` | interface | 49 | LLM-made tool call | JSONValue |
| 7 | `ToolResult` | interface | 56 | Tool execution result | JSONValue |
| 8 | `Message` | type | 67 | Conversation message (discriminated union) | MessageContent, ToolCall, ToolResult |
| 9 | `PermissionScope` | type | 76 | once/session/project/always | — |
| 10 | `PermissionRequest` | interface | 79 | Permission callback input | PermissionScope |
| 11 | `PermissionDecision` | interface | 89 | Permission callback output | PermissionScope |
| 12 | `PermissionCallback` | type | 100 | Permission fn signature | PermissionRequest, PermissionDecision |
| 13 | `UserInputRequest` | interface | 108 | Ask-user request | — |
| 14 | `UserInputResponse` | interface | 116 | Ask-user response | — |
| 15 | `SupervisorHooks` | interface | 127 | Permission + ask-user hooks | PermissionCallback, UserInputRequest |
| 16 | `StructuredOutputConfig` | interface | 138 | Typed output config | zod |
| 17 | `UsageData` | interface | 147 | Token usage | — |
| 18 | `AgentEvent` | type | 157 | Streaming event union (14 variants) | PermissionRequest, PermissionDecision, UserInputRequest |
| 19 | `RunOptions` | interface | 187 | Options for run/stream | AbortSignal |
| 20 | `ModelParams` | interface | 197 | LLM temperature/tokens | — |
| 21 | `TimeoutConfig` | interface | 205 | Timeout settings | — |
| 22 | `ErrorHandlingConfig` | interface | 215 | Error strategy | — |
| 23 | `AgentConfig` | interface | 228 | Agent creation config | ModelParams, TimeoutConfig, ErrorHandlingConfig, SupervisorHooks, ToolDefinition, IPermissionStore |
| 24 | `AgentResult` | interface | 266 | Run result | Message, UsageData, JSONValue |
| 25 | `AgentState` | type | 282 | idle/running/streaming/disposed | — |
| 26 | `IAgent` | interface | 287 | Core agent interface | AgentResult, AgentEvent, Message, RunOptions, StructuredOutputConfig |
| 27 | `ModelInfo` | interface | 329 | Model metadata | — |
| 28 | `ValidationResult` | interface | 336 | Backend validation | — |
| 29 | `IAgentService` | interface | 342 | Backend service interface | IAgent, AgentConfig, ModelInfo, ValidationResult |
| 30 | `CopilotBackendOptions` | interface | 353 | Copilot config | — |
| 31 | `ClaudeBackendOptions` | interface | 367 | Claude config | — |
| 32 | `VercelAIBackendOptions` | interface | 378 | Vercel AI config | — |
| 33 | `isToolDefinition` | fn | 387 | Type guard | ToolDeclaration, ToolDefinition |
| 34 | `isTextContent` | fn | 394 | Type guard | MessageContent |
| 35 | `isMultiPartContent` | fn | 399 | Type guard | MessageContent, ContentPart |
| 36 | `getTextContent` | fn | 406 | Extract text from content | MessageContent |

## Module 2: Errors (`src/errors.ts`, 89 LOC)

| # | Entity | Type | Line | Responsibility |
|---|--------|------|------|----------------|
| 37 | `AgentSDKError` | class | 2 | Base error class |
| 38 | `ReentrancyError` | class | 10 | Concurrent run guard |
| 39 | `DisposedError` | class | 18 | Disposed entity guard |
| 40 | `BackendNotFoundError` | class | 26 | Unknown backend |
| 41 | `BackendAlreadyRegisteredError` | class | 38 | Duplicate registration |
| 42 | `SubprocessError` | class | 46 | CLI subprocess failure |
| 43 | `DependencyError` | class | 53 | Missing peer dep |
| 44 | `AbortError` | class | 64 | Aborted run |
| 45 | `ToolExecutionError` | class | 72 | Tool execution failure |
| 46 | `StructuredOutputError` | class | 84 | JSON parse failure |

## Module 3: Base Agent (`src/base-agent.ts`, 337 LOC)

| # | Entity | Type | Line | Responsibility |
|---|--------|------|------|----------------|
| 47 | `BaseAgent` | abstract class | 17 | State machine, lifecycle, heartbeat, usage enrichment |

## Module 4: Registry (`src/registry.ts`, 140 LOC)

| # | Entity | Type | Line | Responsibility |
|---|--------|------|------|----------------|
| 48 | `BackendFactory` | type | 15 | Factory fn signature |
| 49 | `BackendOptionsMap` | interface | 20 | Backend→options mapping |
| 50 | `BuiltinBackendName` | type | 27 | copilot/claude/vercel-ai |
| 51 | `registerBackend` | fn | 40 | Add custom backend |
| 52 | `unregisterBackend` | fn | 51 | Remove backend |
| 53 | `hasBackend` | fn | 56 | Check existence |
| 54 | `listBackends` | fn | 61 | List all names |
| 55 | `resetRegistry` | fn | 70 | Clear (testing) |
| 56 | `createAgentService` | fn | 113 | Type-safe factory |

## Module 5: Permission Store (`src/permission-store.ts`, 198 LOC)

| # | Entity | Type | Line | Responsibility |
|---|--------|------|------|----------------|
| 57 | `IPermissionStore` | interface | 9 | Permission persistence |
| 58 | `InMemoryPermissionStore` | class | 29 | In-memory store |
| 59 | `FilePermissionStore` | class | 66 | File-based store (sync I/O) |
| 60 | `CompositePermissionStore` | class | 128 | Multi-scope routing |
| 61 | `createDefaultPermissionStore` | fn | 187 | Default composite factory |

## Module 6: Utilities (`src/utils/`, 105 LOC)

| # | Entity | Type | Line | File | Responsibility |
|---|--------|------|------|------|----------------|
| 62 | `zodToJsonSchema` | fn | 5 | schema.ts | Zod→JSON Schema (v3/v3.24/v4) |
| 63 | `messagesToPrompt` | fn | 5 | messages.ts | Message[]→flat string |
| 64 | `contentToText` | fn | 24 | messages.ts | Content→text |
| 65 | `buildSystemPrompt` | fn | 29 | messages.ts | System prompt builder |

## Module 7: Auth (`src/auth/`, 664 LOC)

| # | Entity | Type | Line | File | Responsibility |
|---|--------|------|------|------|----------------|
| 66 | `AuthToken` | interface | 17 | types.ts | Base token |
| 67 | `CopilotAuthToken` | interface | 43 | types.ts | GitHub token |
| 68 | `ClaudeAuthToken` | interface | 65 | types.ts | Claude OAuth token |
| 69 | `DeviceFlowResult` | interface | 87 | types.ts | Device flow result |
| 70 | `OAuthFlowOptions` | interface | 99 | types.ts | OAuth options |
| 71 | `OAuthFlowResult` | interface | 121 | types.ts | OAuth result |
| 72 | `AuthError` | class | 134 | types.ts | Base auth error (**extends Error, not AgentSDKError**) |
| 73 | `DeviceCodeExpiredError` | class | 142 | types.ts | Device code expired |
| 74 | `AccessDeniedError` | class | 150 | types.ts | User denied |
| 75 | `TokenExchangeError` | class | 158 | types.ts | Token exchange failed |
| 76 | `CopilotAuth` | class | — | copilot-auth.ts (220 LOC) | GitHub device flow |
| 77 | `ClaudeAuth` | class | — | claude-auth.ts (258 LOC) | OAuth+PKCE flow |

## Module 8: Chat Core (`src/chat/core.ts`, 434 LOC)

| # | Entity | Type | Line | Responsibility |
|---|--------|------|------|----------------|
| 78 | `ChatId` | type | 20 | Branded ID type |
| 79 | `createChatId` | fn | 23 | UUID generator |
| 80 | `ChatContentPart` | type | 30 | Rich content part (6 variants) |
| 81 | `ChatRole` | type | 58 | user/assistant/system/tool |
| 82 | `ChatMessageMetadata` | interface | 61 | Message metadata |
| 83 | `ChatMessageStatus` | type | 72 | pending/streaming/completed/error |
| 84 | `ChatMessage` | interface | 79 | Full chat message |
| 85 | `ChatSessionConfig` | interface | 96 | Session config snapshot |
| 86 | `ChatSessionMetadata` | interface | 105 | Session metadata |
| 87 | `ChatSession` | interface | 113 | Full chat session (messages embedded) |
| 88 | `ChatEvent` | type | 127 | Chat-specific event union (17 variants) |
| 89 | `ChatEventType` | type | 180 | Event type string union |
| 90 | `SendMessageOptions` | interface | 185 | Message send options |
| 91 | `IChatProvider` | interface | 192 | Chat provider abstraction |
| 92 | `isChatMessage` | fn | 212 | Type guard |
| 93 | `isChatSession` | fn | 229 | Type guard |
| 94 | `isChatContentPart` | fn | 243 | Type guard |
| 95 | `isChatEvent` | fn | 258 | Type guard |
| 96 | `agentEventToChatEvent` | fn | 286 | AgentEvent→ChatEvent adapter |
| 97 | `adaptAgentEvents` | fn | 356 | Async iterable adapter |
| 98 | `toAgentMessage` | fn | 370 | ChatMessage→Message |
| 99 | `fromAgentMessage` | fn | 404 | Message→ChatMessage |

## Module 9: Chat Sessions (`src/chat/sessions.ts`, 337 LOC)

| # | Entity | Type | Line | Responsibility |
|---|--------|------|------|----------------|
| 100 | `CreateSessionOptions` | interface | 22 | Session creation opts |
| 101 | `PaginatedMessages` | interface | 34 | Pagination result |
| 102 | `SessionListOptions` | interface | 44 | List filter/sort |
| 103 | `SessionSearchOptions` | interface | 56 | Text search opts |
| 104 | `IChatSessionStore` | interface | 75 | Session store interface |
| 105 | `BaseSessionStore` | class | 169 | Abstract store impl |
| 106 | `InMemorySessionStore` | class | 304 | In-memory store |
| 107 | `FileSessionStore` | class | 330 | File-based store |

## Module 10: Chat Storage (`src/chat/storage.ts`, 404 LOC)

| # | Entity | Type | Line | Responsibility |
|---|--------|------|------|----------------|
| 108 | `StorageError` | class | 28 | Storage error (**extends Error, not AgentSDKError**) |
| 109 | `StorageErrorCode` | type | 40 | NOT_FOUND/DUPLICATE_KEY/IO_ERROR/SERIALIZATION_ERROR |
| 110 | `ListOptions` | interface | 53 | Generic list options |
| 111 | `IStorageAdapter` | interface | 77 | Generic CRUD adapter |
| 112 | `InMemoryStorage` | class | 149 | Map-based storage |
| 113 | `FileStorage` | class | 254 | JSON file storage (sync I/O) |

## Module 11: Chat Errors (`src/chat/errors.ts`, 487 LOC)

| # | Entity | Type | Line | Responsibility |
|---|--------|------|------|----------------|
| 114 | `ChatSDKError` | class | 26 | Base chat error (extends AgentSDKError) |
| 115 | `NetworkError` | class | 43 | Connection failures |
| 116 | `AuthError` | class | 61 | Auth failures (**name collision with auth/types.ts**) |
| 117 | `RateLimitError` | class | 79 | HTTP 429 |
| 118 | `ProviderError` | class | 97 | Provider 5xx |
| 119 | `ValidationError` | class | 117 | Input validation |
| 120 | `TimeoutError` | class | 135 | Timeout |
| 121 | `ContextOverflowError` | class | 153 | Context window exceeded |
| 122 | `classifyError` | fn | 184 | Error classifier |
| 123 | `ExponentialBackoffStrategy` | class | 385 | Retry with backoff |
| 124 | `withRetry` | fn | 428 | Retry execution wrapper |
| 125 | `isRetryable` | fn | 459 | Retryable check |

## Module 12: Chat Events (`src/chat/events.ts`, 405 LOC)

| # | Entity | Type | Line | Responsibility |
|---|--------|------|------|----------------|
| 126 | `TypedEventEmitter` | class | 46 | Generic typed emitter |
| 127 | `ChatEventBus` | class | 221 | Chat events + middleware pipeline |
| 128 | `EventMiddleware` | type | 191 | Middleware fn |
| 129 | `MiddlewareContext` | interface | 159 | Middleware context |
| 130 | `eventFilter` | fn | 322 | Event filter factory |
| 131 | `filterEvents` | fn | 343 | Async filter |
| 132 | `mapEvents` | fn | 372 | Async map |
| 133 | `collectText` | fn | 395 | Collect text deltas |

## Module 13: Chat Context (`src/chat/context.ts`, 404 LOC)

| # | Entity | Type | Line | Responsibility |
|---|--------|------|------|----------------|
| 134 | `estimateTokens` | fn | 45 | Token estimation (chars/4) |
| 135 | `OverflowStrategy` | type | 106 | truncate-oldest/sliding-window/summarize-placeholder |
| 136 | `ContextWindowConfig` | interface | 116 | Config |
| 137 | `ContextWindowResult` | interface | 141 | Trim result |
| 138 | `ContextWindowManager` | class | 175 | Stateless context trimmer |

## Module 14: Backends (not fully enumerated — 2757 LOC total)

| # | Entity | Type | File | LOC |
|---|--------|------|------|-----|
| 139 | `CopilotAgentService` | class | copilot.ts | 923 |
| 140 | `ClaudeAgentService` | class | claude.ts | 1127 |
| 141 | `VercelAIAgentService` | class | vercel-ai.ts | 707 |

---

## Package Exports (11 entry points)

| Entry | Path | Entities Exported |
|-------|------|-------------------|
| `.` | src/index.ts | 36 types + 12 errors + 6 registry + BaseAgent + 3 utils + 4 permission stores |
| `./copilot` | src/backends/copilot.ts | CopilotAgentService, createCopilotService |
| `./claude` | src/backends/claude.ts | ClaudeAgentService, createClaudeService |
| `./vercel-ai` | src/backends/vercel-ai.ts | VercelAIAgentService, createVercelAIService |
| `./auth` | src/auth/index.ts | 6 types + 4 errors + CopilotAuth + ClaudeAuth |
| `./chat/core` | src/chat/core.ts | 12 types + 4 type guards + 4 converters |
| `./chat/errors` | src/chat/errors.ts | 7 errors + classifyError + retry |
| `./chat/events` | src/chat/events.ts | EventEmitter + EventBus + middleware + utils |
| `./chat/storage` | src/chat/storage.ts | IStorageAdapter + 2 impls + StorageError |
| `./chat/sessions` | src/chat/sessions.ts | IChatSessionStore + 2 impls |
| `./chat/context` | src/chat/context.ts | ContextWindowManager + estimateTokens |

---

## Issues Summary

### CRITICAL (8)

| ID | Issue | File:Line |
|----|-------|-----------|
| C1 | No session abstraction — IAgent has no session management | types.ts:287 |
| C2 | buildContextualPrompt destroys message structure | utils/messages.ts:5 |
| C3 | Persistent session 1:1 mapping — can't switch sessions | base-agent.ts:26 |
| C4 | AuthError naming collision (auth/types.ts vs chat/errors.ts) | auth/types.ts:134, chat/errors.ts:61 |
| C5 | AuthError & StorageError bypass AgentSDKError hierarchy | auth/types.ts:134, chat/storage.ts:28 |
| C6 | O(n) addMessage — entire session read/written per message | chat/sessions.ts:228 |
| C7 | Messages embedded in ChatSession — no separate storage | chat/core.ts:116 |
| C8 | No integration between chat sessions and agent runs | chat/sessions.ts, types.ts |

### MAJOR (14)

| ID | Issue | File:Line |
|----|-------|-----------|
| M1 | run() vs runWithContext() — confusing dual API | types.ts:292,296 |
| M2 | No getMessages/clearMessages on IAgent | types.ts:287 |
| M3 | AgentConfig.tools requires ToolDefinition[] (not Declaration) | types.ts:232 |
| M4 | Session lifecycle fragile — clearPersistentSession destroys | backends/copilot.ts |
| M5 | ensureClient promise caching — concurrent retry race | backends/copilot.ts |
| M6 | onAskUser unsupported by Claude backend (silent ignore) | backends/claude.ts |
| M7 | Vercel AI stateless — consumer doesn't know they must maintain messages | backends/vercel-ai.ts |
| M8 | Registry global mutable singleton | registry.ts:37 |
| M9 | Cannot override built-in backends | registry.ts:44 |
| M10 | FilePermissionStore uses sync I/O | permission-store.ts:101 |
| M11 | Missing core error types (chat reinvents them) | errors.ts, chat/errors.ts |
| M12 | FileStorage uses sync I/O | chat/storage.ts:10 |
| M13 | zodToJsonSchema returns {} for unsupported types | utils/schema.ts:67 |
| M14 | Chat-sdk has no barrel export | chat/ (no index.ts) |

### MINOR (9)

| ID | Issue | File:Line |
|----|-------|-----------|
| m1 | AgentState "streaming" vs "running" distinction | types.ts:282 |
| m2 | Tool event parsing uses fragile JSON.parse | backends/copilot.ts |
| m3 | ClaudeToolCallTracker FIFO assumption | backends/claude.ts |
| m4 | listModels hardcoded OpenAI fallback | backends/vercel-ai.ts |
| m5 | resetRegistry exported publicly | registry.ts:70 |
| m6 | FileStoreEntry.timestamp dead code | permission-store.ts:58 |
| m7 | CompositePermissionStore silent alias | permission-store.ts:140 |
| m8 | No concurrency control in FileStorage | chat/storage.ts |
| m9 | contentToText duplicates getTextContent | utils/messages.ts, types.ts |

---

## Consumer Analysis Summary

### Moira (mcp-moira-dev2)
- **Uses**: createAgentService, ClaudeAuth.refreshToken, agent.streamWithContext, agent.dispose
- **Workarounds**: 8+ local type copies, SDK patch for Claude bug, manual auth refresh, full custom streaming adapter (327 LOC), custom context manager, custom tool registry with DI
- **Not using SDK**: permission system, context management, event bus, session store

### Supervisor (claude-supervisor-dev)
- **Uses**: IAgentService pool, agent streaming, permissions (canUseTool), askUser, session resume, auth flows, model listing, abort, structured output, 12 tool definitions
- **Workarounds**: extracting toolCallId from rawSDKRequest, custom model tier inference, direct /models HTTP for Vercel AI, custom error classifier (65 LOC), local message types
- **Transport**: NATS WebSocket (not SSE)

### Podcast (news-podcast)
- **Uses**: createAgentService (3 backends), agent.run/stream, tools, auth flows (device + OAuth)
- **Workarounds**: local error hierarchy (6 classes), string-based error classification, custom retry logic, manual auth refresh, hardcoded model fallbacks, custom service cache
- **Usage**: Pipeline (not chat) — 4 sequential services with agent

### Planeta (planeta-analysis-worktree)
- **Uses**: Vercel AI SDK v5 directly — **does NOT use @witqq/agent-sdk at all**
- **Custom**: Full chat system with SQLite, SSE via better-sse, custom tool registry (server/browser/frontend), RAG with LanceDB, ARIA browser automation, context window management with emergency trim
- **Pain points**: duplicate SSE types, manual tool format conversion, token estimation heuristic
