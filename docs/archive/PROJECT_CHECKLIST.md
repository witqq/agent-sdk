# Project Checklist — agent-sdk

## Code Quality
- [x] TypeScript strict mode enabled
- [x] No `any` types (use `unknown` + type guards)
- [x] All public APIs have JSDoc comments
- [x] No unused imports/variables (noUnusedLocals)
- [x] Error classes extend AgentSDKError base

## Testing
- [x] Unit tests for all core types and type guards
- [x] Unit tests for registry and factory
- [x] Unit tests for base agent state machine
- [x] Unit tests for permission store (3-store architecture)
- [x] Unit tests for each backend (copilot, claude, vercel-ai)
- [x] Cross-backend streaming event consistency tests
- [x] Integration tests for each backend (with cheap models) — written, require real CLI auth to run

## Build & Package
- [x] tsup produces ESM + CJS + DTS
- [x] Separate entry points per backend
- [x] Tree-shaking works (importing one backend doesn't bundle others)
- [x] npm pack produces valid package
- [x] package.json exports are correct
- [x] MIT LICENSE file present

## Documentation
- [x] CLAUDE.md with project overview and all backends
- [x] README.md with usage examples for all features
- [x] DOCUMENTATION-STYLE-GUIDE.md
- [x] All public types have descriptions
- [x] CHANGELOG.md updated before each release

## Architecture
- [x] ToolDeclaration/ToolDefinition split (B1)
- [x] Generic AgentResult<T> (B4)
- [x] Backend registry pattern (B5)
- [x] Type-safe factory with overloads (B6)
- [x] Re-entrancy guard (M8)
- [x] Permission scopes v3.1 (once/session/project/always)
- [x] Permission store (InMemory + File + Composite)
- [x] User input with freeform support
- [x] Streaming event consistency across backends

## Chat SDK — Phase 2 (Core Extensions)

### M1: Core Types & Events
- [x] ChatMessage, ChatSession, ChatEvent core types (chat/core)
- [x] Event emitter with typed ChatEventMap (chat/events)
- [x] Structured error hierarchy with ChatErrorCode (chat/errors)
- [x] MessageAccumulator: AgentEvent → ChatMessage stream (chat/accumulator)

### M2: State Management
- [x] StateMachine<S> with typed transition maps (chat/state)
- [x] ChatReentrancyGuard for concurrent-run protection (chat/state)
- [x] ChatAbortController with linked abort signals (chat/state)
- [x] Pre-configured factories: runtime, message, tool-call state machines

### M3: Storage Layer
- [x] Generic storage adapter layer (InMemory + File)
- [x] Session store (InMemory + File, wraps storage adapters)
- [x] Archive/unarchive sessions (status toggle)
- [x] Bulk saveMessages and method renaming (appendMessage/loadMessages)
- [x] Deprecated aliases for addMessage/getMessages
- [x] Context window manager (3 overflow strategies)
- [x] Integration tests for storage → sessions → context pipeline
- [x] Demo server wired with session management endpoints
- [x] Subpath exports: chat/storage, chat/sessions, chat/context

### M4: Backend Adapters & Transport
- [x] IBackendAdapter interface extending IChatProvider (chat/backends)
- [x] BaseBackendAdapter with service ownership semantics (_ownsService)
- [x] CopilotChatAdapter with persistent session and resume support
- [x] ClaudeChatAdapter with persistent session and resume support
- [x] VercelAIChatAdapter (stateless, no resume)
- [x] IChatTransport and SSEChatTransport for event delivery
- [x] streamToTransport() helper for adapter → transport pipeline
- [x] Demo server migrated to adapter pattern

### M5: Chat Runtime
- [x] IChatRuntime interface with full lifecycle API (chat/runtime)
- [x] ChatRuntime class: state machine, reentrancy guard, abort controller
- [x] createChatRuntime() factory function
- [x] Session delegation (create/get/list/delete/archive/switch)
- [x] send() flow: persist → middleware → stream → accumulate → persist
- [x] Backend/model switching with lazy adapter creation
- [x] Tool registration persisting across backend switches
- [x] Middleware pipeline (onBeforeSend, onEvent, onAfterReceive, onError)
- [x] Context trimming via ContextWindowManager before send
- [x] Error auto-recovery and dispose-during-send handling
- [x] Package export: @witqq/agent-sdk/chat/runtime subpath
- [x] Demo migration to createChatRuntime()
- [x] ChatEvent `done` variant with finalOutput
- [x] streamToTransport() text accumulation and done event emission
- [x] IChatRuntime<TMetadata> generic for typed session metadata
- [x] RetryConfig with pre-stream retry and exponential backoff
- [x] isChatEvent() type guard updated for done event


### M6: Context Manager Integration
- [x] getContextStats(sessionId) on IChatRuntime — per-session context usage stats
- [x] onContextTrimmed callback in ChatRuntimeOptions — archive/logging hook for removed messages
- [x] Callback exception safety (try/catch around user-provided callback)
- [x] Stats cleanup on deleteSession (no memory leaks)
- [x] ContextSummarizer type — async function for summarize-placeholder strategy
- [x] fitMessagesAsync() on ContextWindowManager — async variant with summarizer support
- [x] Summarizer error fallback to static placeholder
- [x] Demo stats display (token count, trimmed message count in frontend)
- [x] ROADMAP M6 checkboxes all checked

### M7: React Bindings
- [x] React hooks: useChat, useMessages, useToolApproval, useAuth, useModels
- [x] Headless components: Message, ThinkingBlock, ToolCallView, MarkdownRenderer
- [x] Composition components: Thread, Composer, ThreadSlots
- [x] Session/Model components: ThreadList, ModelSelector, useSSE
- [x] Auth components: useAuth, AuthDialog
- [x] Demo app rewrite with SDK integration
- [x] chat/react package entry point with all exports
- [x] Unit tests for all React bindings (100+ tests)

### M8: Server Utilities
- [x] createChatHandler(runtime) — 10 RemoteChatRuntime contract routes
- [x] createAuthHandler(options) — 8 auth routes (device flow, OAuth, API key, token CRUD)
- [x] ITokenStore interface with InMemoryTokenStore and FileTokenStore
- [x] corsMiddleware() — configurable CORS with multi-origin support
- [x] SSEChatTransport heartbeat and connection close detection
- [x] createChatServer(options) — combined handler factory (chat + auth + CORS + static)
- [x] Demo server rewrite using SDK handlers (853→352 lines)
- [x] Frontend auth paths updated to match SDK handler conventions
- [x] Unit tests for all server utilities (70+ tests)

### M9: DX & Streaming
- [x] useChat progressive streaming via MessageAccumulator integration
- [x] RemoteChatRuntime.send() event-driven message building (SSE → ChatEvent → AgentEvent)
- [x] toChatId() helper function (eliminates `as ChatId` casts)
- [x] ThreadList accepts ChatSession[] directly (SessionItem union type)
- [x] createSession() uses runtime defaults for config.model/config.backend
- [x] IChatRuntime.onSessionChange(callback) subscription pattern
- [x] useSessions() reactive hook (replaces setInterval polling in demo)
- [x] useAuth @deprecated with migration guide to useRemoteAuth
- [x] useRemoteAuth() server-delegated auth hook (zero node:crypto in browser)
- [x] Demo SessionSidebar rewritten with useSessions (no polling)
- [x] Demo AuthDialog rewritten with useRemoteAuth (no manual fetch)
- [x] Unit tests for all M9 features (80+ tests)

### M10: Consumer DX
- [x] ChatId string acceptance — runtime methods accept `string` where `ChatId` required
- [x] `@witqq/agent-sdk/chat` barrel export for common consumer types
- [x] `useRemoteAuth.start()` auto-dispatch (no manual branching by provider)
- [x] `useRemoteChat()` lifecycle hook (auth → runtime → session orchestration)
- [x] Demo migrated to useRemoteChat (removed manual endpoint management)
- [x] Demo server auto-creates runtime in onAuth (removed /api/agent/create)
- [x] Unit tests for useRemoteChat (11 tests)

### M11: Custom Transport & Storage
- [x] WebSocket transport (WsChatTransport implementing IChatTransport)
- [x] In-process transport (InProcessChatTransport for zero-network usage)
- [x] NATS transport example (NatsChatRouter, NatsChatClient, NatsPublishTransport)
- [x] Enhanced NATS transport with subject-based routing and request-reply
- [x] SQLite storage adapter example (better-sqlite3 IChatSessionStore)
- [x] Drizzle ORM storage adapter example (Drizzle IChatSessionStore)
- [x] Stream timeout/watchdog (StreamWatchdog with CancellableTimeout)
- [x] IChatTransport documentation with custom transport guide
- [x] Unit tests for all M11 features

### M12: Extensibility & Integration Patterns
- [x] Transport interceptors (composable hook chain with InterceptorPipeline)
- [x] Tool context injection (ToolContext interface with runtime injection)
- [x] Framework presets (Express, Hono, Fastify adapter examples)
- [x] Multi-user runtime manager (LRU cache, idle timeout, BYOK pattern)
- [x] Custom renderer guide (CSS theming, slot overrides, per-tool dispatch)
- [x] Custom renderer examples (dark theme CSS, slot overrides, per-tool renderers)
- [x] Token auto-refresh manager (background scheduling with retry)
- [x] Usage tracking middleware (ChatMiddleware for token counting)
- [x] Demo: ThreadProvider with custom tool call renderer
- [x] Unit tests for all M12 features
