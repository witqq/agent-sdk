# Chat SDK Implementation Roadmap

## Module Decomposition

### Module Dependency Graph

```
                    ┌──────────────┐
                    │  @witqq/     │
                    │  chat-sdk    │  ← main entry point
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │   Core      │ │   React     │ │   Server    │
    │   Runtime   │ │   Bindings  │ │   Utilities │
    └──────┬──────┘ └──────┬──────┘ └─────────────┘
           │               │
    ┌──────┼──────────┐    │
    │      │          │    │
┌───▼──┐ ┌─▼────┐ ┌──▼────▼──┐
│Events│ │State │ │ Message  │
│System│ │Mgmt  │ │ Model    │
└──────┘ └──┬───┘ └──────────┘
            │
     ┌──────┼──────┐
     │      │      │
┌────▼─┐ ┌─▼────┐ ┌▼───────┐
│Store │ │Backend│ │Context │
│Layer │ │Adapter│ │Manager │
└──────┘ └──┬───┘ └────────┘
            │
     ┌──────┼──────┐
     │      │      │
┌────▼─┐ ┌─▼────┐ ┌▼───────┐
│Copilot│ │Claude│ │Vercel  │
│Adapter│ │Adapt.│ │AI Adpt.│
└───────┘ └──────┘ └────────┘
```

---

## Modules

### M1: Core Types & Events (`src/chat/types/`, `src/chat/events/`)
**Complexity:** S  
**Dependencies:** None  
**Description:** Foundation types, event system, error taxonomy.

Deliverables:
- [x] `ChatMessage<TMetadata>` interface + MessagePart union types
- [x] `ChatEvent` type + `ChatEventType` enum (colon-separated naming)
- [x] `ChatError` class + `ChatErrorCode` enum (19 codes)
- [x] `ChatRuntimeConfig<TMetadata>` interface
- [x] `ChatSession` interface
- [x] `SendOpts`, `CreateSessionOpts`, `ListOpts`, `ModelInfo`, `BackendOpts`
- [x] `MessageAccumulator` (stream events → ChatMessage)
- [x] `ChatMiddleware` interface (onBeforeSend, onEvent, onAfterReceive, onError)
- [x] Event emitter with typed listeners + middleware pipeline

### M2: State Management (`src/chat/state/`)
**Complexity:** M  
**Dependencies:** M1  
**Description:** Runtime state machine, session lifecycle, message status tracking.

Deliverables:
- [x] `RuntimeStatus` state machine (idle → streaming → idle/error → disposed)
- [x] `MessageStatus` transitions (pending → streaming → complete/error/cancelled)
- [x] `ToolCallStatus` transitions (pending → running/requires_approval → complete/error/denied)
- [x] Reentrancy guard (reject concurrent `send()` calls)
- [x] Abort controller management (external signal linking)

### M3: Storage Layer (`src/chat/storage/`)
**Complexity:** M  
**Dependencies:** M1  
**Description:** Session and message persistence with pluggable stores.

Deliverables:
- [x] `ISessionStore` interface (7 methods + pagination)
- [x] `InMemorySessionStore` (default, zero-config)
- [x] `appendMessage()` + `saveMessages()` bulk operations
- [x] `loadMessages()` with `ListOpts` pagination
- [x] Session CRUD: create, load, list, delete, archive/unarchive

### M4: Backend Adapters (`src/chat/backends/`)
**Complexity:** L  
**Dependencies:** M1, M2  
**Description:** Bridge between Chat SDK and agent-sdk backends.

Deliverables:
- [x] `IBackendAdapter` interface with `canResume()`
- [x] `CopilotChatAdapter` — wraps CopilotAgentService
- [x] `ClaudeChatAdapter` — wraps ClaudeAgentService
- [x] `VercelAIChatAdapter` — wraps VercelAIAgentService
- [x] Event normalization: 3 backend event formats → unified `ChatEvent`
- [x] Tool definition forwarding (Zod-based)
- [x] Permission delegation to agent-sdk permission system
- [x] `IChatTransport` interface (SSE transport for HTTP streaming)

### M5: Chat Runtime (`src/chat/runtime.ts`)
**Complexity:** L  
**Dependencies:** M1, M2, M3, M4  
**Description:** Main `IChatRuntime` facade — orchestrates all modules. Based on patterns extracted from `examples/demo/server.ts`.

Deliverables:
- [x] `IChatRuntime` interface
- [x] `createChatRuntime(config)` factory function
- [x] `ChatRuntimeConfig`: backend configs map, default backend, session store, context manager options
- [x] Session management: create, switch, list, delete, archive (delegates to `IChatSessionStore`)
- [x] `send(sessionId, message)` → `AsyncIterable<ChatEvent>` with streaming + middleware pipeline
- [x] Provider/model management:
  - [x] `switchBackend(name)` — creates/destroys adapters (Copilot→Claude is full recreation)
  - [x] `switchModel(model)` — updates config within current adapter
  - [x] `listModels()` — delegates to current adapter
  - [x] `ProviderConfig` type: backend name, service options, default model
- [x] Auto context trimming on send via `ContextWindowManager`
- [x] Message persistence: save user message + accumulate assistant response → save
- [x] Tool registration / removal at runtime
- [x] Error handling with retry strategies (delegates to `withRetry`)
- [x] `dispose()` lifecycle — disposes adapters, flushes stores
- [x] Adapter lifecycle: lazy creation, reuse per backend, cleanup on switch

### M6: Context Manager Integration
**Complexity:** S  
**Dependencies:** M1, M3, M5  
**Description:** Integrate existing `ContextWindowManager` into Chat Runtime.

Deliverables:
- [x] Sliding window strategy
- [x] Truncate strategy (simple oldest-first)
- [x] Token estimation heuristic (chars/4)
- [x] `summarize-placeholder` strategy with async LLM summarization (optional, via `ContextSummarizer`)
- [x] Auto-trim integration in M5 runtime `send()` flow (via `fitMessagesAsync()`)
- [x] Archive trimmed messages callback (`onContextTrimmed` in ChatRuntimeOptions)
- [x] Expose context usage stats via runtime API (`getContextStats()` on IChatRuntime)

### M7: React Bindings (`src/chat/react/`)
**Complexity:** L  
**Dependencies:** M1, M5  
**Description:** React hooks and headless components for chat UI. Based on patterns from `examples/demo/frontend/`.

Deliverables — Hooks:
- [x] `ChatProvider` — React context provider wrapping `IChatRuntime`
- [x] `useChatRuntime()` — access runtime from context
- [x] `useChat()` — convenience hook (send, stop, status, messages, error)
- [x] `useMessages(sessionId)` — reactive message list via `useSyncExternalStore`
- [x] `useToolApproval()` — tool approval UI state (pending requests, approve/deny)
- [x] `useAuth(backend)` — auth flow management (Device Flow, OAuth+PKCE, API key)
- [x] `useModels()` — model list with loading state, search/filter
- [x] `useSSE(url)` — client-side SSE transport (fetch-based, not EventSource for better error handling)

Deliverables — Headless Components:
- [x] `Thread` — message list with auto-scroll, loading states
- [x] `Composer` — input with send button, auto-resize, keyboard shortcuts
- [x] `ThreadList` — session sidebar (create, delete, switch, search)
- [x] `Message` — renders message parts with slot-based customization
- [x] `ThinkingBlock` — collapsible reasoning display
- [x] `ToolCallView` — tool call with args/result, approval buttons
- [x] `AuthDialog` — multi-backend auth flow (device code, OAuth redirect, API key input)
- [x] `ModelSelector` — dropdown with search, tier badges
- [x] `MarkdownRenderer` — code blocks, syntax highlighting, inline formatting
- [x] Slot-based customization API (`Thread.Message`, `Thread.ToolCall`, etc.)

### M8: Server Utilities (`src/chat/server/`)
**Complexity:** L  
**Dependencies:** M1, M4, M5  
**Description:** Server-side helpers for building chat API endpoints. Eliminates ~130 lines of boilerplate routes from `examples/demo/server.ts`. Includes server-mediated auth to solve browser CORS limitations of `useAuth`.

Deliverables — HTTP Handler:
- [x] `createChatHandler(runtime)` — framework-agnostic HTTP request handler (works with node:http, Express, Hono)
- [x] Standard route handlers: `/sessions/*` (CRUD + archive), `/send` (SSE), `/models` (list), `/backend/switch`, `/model/switch`, `/abort`
- [x] CORS and security headers helper (configurable origins, methods, headers)
- [ ] Request/response event interceptors (logging, metrics, rate limiting)

Deliverables — Auth:
- [x] Server-mediated auth endpoints: device flow start/poll, OAuth callback, token validation
- [x] `createAuthHandler(options)` — auth route handler that proxies OAuth to avoid browser CORS
- [x] Token storage interface for server-side token management (`ITokenStore`, `FileTokenStore`, `InMemoryTokenStore`)

Deliverables — Transport:
- [x] `SSEChatTransport` improvements: heartbeat, connection close detection
- [ ] WebSocket transport option (for bidirectional communication, session change push)
- [ ] Tool context injection: automatic `sessionId`, `userId`, `signal` in tool execute

Deliverables — Quick Start:
- [x] `createChatServer(options)` — one-call server setup (runtime + handler + auth + CORS + static)
- [ ] Preset configurations for node:http, Express, Hono

### M9: DX & Streaming Improvements ✅
**Complexity:** M  
**Dependencies:** M7, M8  
**Description:** Developer experience fixes and progressive streaming based on real demo integration findings. Addresses friction points discovered when building the demo app with SDK React components.

Deliverables — Progressive Streaming:
- [x] `useChat` progressive message updates — accumulate and display tokens as they arrive, not after stream completes
- [x] `MessageAccumulator` integration into `useChat` send loop — apply events → snapshot → setMessages
- [x] `RemoteChatRuntime.send()` event-driven message building on client side

Deliverables — Type Ergonomics:
- [x] `toChatId(s: string): ChatId` helper function (eliminate `as ChatId` casts throughout consumer code)
- [x] `ThreadList` accepts `ChatSession[]` directly (in addition to `SessionInfo[]`) — auto-maps internally
- [x] `createSession()` uses runtime defaults for `config.model` and `config.backend` when omitted (requires making `config` optional in `CreateSessionOptions`)
- [x] `IChatRuntime.activeSessionId` returns `string | null` (not `ChatId | null`) to reduce branded type leakage

Deliverables — Session Reactivity:
- [x] `IChatRuntime.onSessionChange(callback)` subscription — push updates instead of polling
- [x] `useSessions()` hook — reactive session list via subscription (replaces manual setInterval polling)

Deliverables — Auth Architecture:
- [x] Deprecate direct-call `useAuth` for browser contexts (document server-mediated pattern as primary)
- [x] `useRemoteAuth(options)` hook — delegates auth to server endpoints from M8
- [x] Isolate `node:crypto` dependency — auth classes should not require lazy import workaround

---

## Implementation Order

```
Phase 1 (Foundation):     M1 ✅ ──→ M2 ✅ ──→ M3 ✅
Phase 2 (Integration):    M4 ✅ ──→ M5 ✅
Phase 3 (UX):             M6 ✅ ──→ M7 ✅ ──→ M8 ✅ ──→ M9 ✅
Phase 4 (Consumer):       M10 ✅
```

### Phase 1: Foundation ✅
| Step | Module | Status | Description |
|------|--------|--------|-------------|
| 1.1 | M1: Core Types & Events | ✅ | All interfaces, types, error codes, event system |
| 1.2 | M2: State Management | ✅ | State machines, reentrancy guard |
| 1.3 | M3: Storage Layer | ✅ | ISessionStore + InMemorySessionStore + FileSessionStore |

### Phase 2: Backend Integration ✅
| Step | Module | Status | Description |
|------|--------|--------|-------------|
| 2.1 | M4: Copilot Adapter | ✅ | First adapter — validates IBackendAdapter interface |
| 2.2 | M4: Claude Adapter | ✅ | Second adapter — persistent session + resume |
| 2.3 | M4: Vercel AI Adapter | ✅ | Third adapter — SSE transport layer |
| 2.4 | M5: Chat Runtime | ✅ | Full runtime assembly with factory |

### Phase 3: User Experience ✅
| Step | Module | Status | Description |
|------|--------|--------|-------------|
| 3.1 | M6: Context Integration | ✅ | Integrate existing ContextWindowManager into runtime |
| 3.2 | M7: React Bindings | ✅ | Hooks + headless components + slots + demo rewrite |
| 3.3 | M8: Server Utilities | ✅ | HTTP handlers, auth proxy, transport, quick-start, demo rewrite |
| 3.4 | M9: DX & Streaming | ✅ | Progressive streaming, type ergonomics, session reactivity, auth architecture |

**Integration point:** After M8, full SDK is production-usable with zero boilerplate. After M9, DX matches competitor quality (Vercel AI SDK, assistant-ui).

### Phase 4: Consumer Polish
| Step | Module | Status | Description |
|------|--------|--------|-------------|
| 4.1 | M10: Consumer DX | ✅ | Type ergonomics, import simplification, auth auto-dispatch, lifecycle hooks, demo migration |

M10 deliverables:
- ✅ Accept `string` in runtime methods where `ChatId` is required (reduce casting)
- ✅ Add `@witqq/agent-sdk/chat` barrel export for common consumer types
- ✅ Auto-dispatch auth flow in `useRemoteAuth.start(provider)` — no manual branching
- ✅ `useRemoteChat(baseUrl)` lifecycle hook (auth → runtime → session management)
- ✅ Demo migrated to useRemoteChat (simplified ~200 LOC, removed manual endpoint management)

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| CLI backend event format changes | High | Pin agent-sdk version, adapter abstraction |
| Copilot SDK session management limitations | Medium | Emulation layer in adapter, documented gaps |
| React 19 breaking changes to useSyncExternalStore | Low | Already stable API, well-understood |
| Bundle size exceeds 50KB budget | Medium | Separate entry points, tree-shaking validation |
| Token estimation accuracy | Low | Heuristic sufficient, exact counting optional |
| useAuth CORS in browser contexts | High | Server-mediated auth pattern (M8), deprecate direct calls |
| Progressive streaming complexity in useChat | Medium | MessageAccumulator already handles accumulation, need UI integration |
| node:crypto in browser bundles | Medium | Isolate auth classes, dynamic import pattern |

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Quick Start lines of code | ≤ 10 (after M8) | ✅ ~5 lines with `createChatServer()` |
| Time to first message (DX) | < 5 min with docs | ✅ With M8 quick-start presets |
| Bundle size (core) | < 15KB gzipped | ✅ Verified |
| Bundle size (react) | < 25KB gzipped | ✅ Verified |
| Test coverage | > 90% (unit), > 70% (integration) | ✅ 1544+ tests |
| Backward compatibility | 100% agent-sdk public API preserved | ✅ |
| TypeScript strict mode | Enabled, zero `any` in public API | ✅ |
| Progressive streaming | Real-time token display | ✅ M9 |
| Server setup complexity | 1-3 lines of code | ✅ M8 `createChatServer()` |

---

## Package Exports (current + planned)

Current (implemented):
```
@witqq/agent-sdk                    → src/index.ts
@witqq/agent-sdk/copilot            → src/backends/copilot.ts
@witqq/agent-sdk/claude             → src/backends/claude.ts
@witqq/agent-sdk/vercel-ai          → src/backends/vercel-ai.ts
@witqq/agent-sdk/auth               → src/auth/index.ts
@witqq/agent-sdk/chat/core          → src/chat/core.ts
@witqq/agent-sdk/chat/errors        → src/chat/errors.ts
@witqq/agent-sdk/chat/events        → src/chat/events.ts
@witqq/agent-sdk/chat/storage       → src/chat/storage.ts
@witqq/agent-sdk/chat/sessions      → src/chat/sessions.ts
@witqq/agent-sdk/chat/context       → src/chat/context.ts
@witqq/agent-sdk/chat/accumulator   → src/chat/accumulator.ts
@witqq/agent-sdk/chat/state         → src/chat/state.ts
@witqq/agent-sdk/chat/backends      → src/chat/backends/index.ts
@witqq/agent-sdk/chat/runtime       → src/chat/runtime.ts
@witqq/agent-sdk/chat/react         → src/chat/react/index.ts
@witqq/agent-sdk/chat/server        → src/chat/server/index.ts (createChatHandler, corsMiddleware)
```

Planned (M8 complete):
```
@witqq/agent-sdk/chat/server        → (createChatHandler ✅, createAuthHandler ✅, ITokenStore ✅, createChatServer ✅, corsMiddleware ✅, FileTokenStore ✅)
```

---

## Demo Integration Findings

Issues discovered while building the demo app (`examples/demo/`) with SDK React components. Each finding maps to an M8 or M9 deliverable.

| Issue | Impact | Module | Fix |
|-------|--------|--------|-----|
| No progressive streaming — useChat waits for entire response | Critical | M9 | MessageAccumulator in useChat send loop |
| ~~useAuth CORS — direct GitHub/Anthropic calls blocked in browser~~ | ~~Critical~~ | ~~M8~~ | ✅ Server-mediated auth via createAuthHandler |
| ~~130 lines server route boilerplate~~ | ~~High~~ | ~~M8~~ | ✅ createChatHandler + createAuthHandler (853→352 lines) |
| ChatId branded type friction (as ChatId casts) | Medium | M9 | toChatId() helper, string-accepting APIs |
| ChatSession→SessionInfo manual mapping | Medium | M9 | ThreadList accepts ChatSession[] |
| createSession requires empty config defaults | Low | M9 | Runtime provides defaults |
| Session polling instead of push updates | Medium | M9 | onSessionChange subscription |
| node:crypto in browser bundle | Medium | M9 | Auth class isolation |
| ~~SDK ModelSelector/AuthDialog unused in demo~~ | ~~Low~~ | ~~M8/M9~~ | Deferred — demo uses custom UI |

---

## Completion Summary

**All 10 modules (M1-M10) are complete.** Phases 1-4 delivered the full SDK lifecycle:

- **Phase 1** (M1-M3): Core types, state machines, storage adapters
- **Phase 2** (M4-M5): 3 backend adapters, unified chat runtime
- **Phase 3** (M6-M9): Context management, React bindings, server utilities, DX polish
- **Phase 4** (M10): Consumer DX — barrel imports, `useRemoteChat`, auth auto-dispatch

**Final metrics**: 18 entry points, ~200 exports, 1544 tests, DX score 7.8/10.

**Deferred items** (previously stretch goals, now scheduled for Phase 5):
- ~~WebSocket transport option (M8)~~ → M11
- ~~Request/response event interceptors (M8)~~ → M12
- ~~Tool context injection (M8)~~ → M12
- ~~Preset configurations for Express/Hono (M8)~~ → M12

---

## Phase 5: Production Migration Support

Based on analysis of real projects (claude-supervisor, mcp-moira) that need to migrate to agent-sdk.

### M11: Custom Transport & Storage

**Goal**: Enable projects with non-HTTP transports and database storage to use the SDK.

Deliverables:
- [x] WebSocket transport (`WsChatTransport` implementing `IChatTransport`)
- [x] NATS transport example (documentation + example code for claude-supervisor migration)
- [x] In-process transport (`InProcessChatTransport` for same-process runtime, no HTTP)
- [x] SQLite storage adapter example (IStorageAdapter + IChatSessionStore over better-sqlite3)
- [x] Drizzle ORM storage adapter example (IStorageAdapter + IChatSessionStore over Drizzle)
- [x] Stream timeout/watchdog (configurable activity timeout for hanging streams)
- [x] `IChatTransport` documentation with custom transport guide
- [x] Demo: custom transport example (WebSocket or in-process)

### M12: Extensibility & Integration Patterns

**Goal**: Support real-world integration patterns discovered during migration planning.

Deliverables:
- [x] Request/response event interceptors (middleware for transport-level events)
- [x] Tool context injection (pass context to tools beyond args)
- [x] Framework preset configurations (Express, Hono, Fastify adapter examples)
- [x] Multi-user runtime pattern documentation + example (per-user ChatRuntime with LRU cache)
- [x] Custom renderer guide (plugging shadcn/ui, react-markdown, per-tool renderers via ThreadSlots)
- [x] Demo: custom renderer examples (shadcn/ui theme, react-markdown, per-tool renderers)
- [x] Token auto-refresh loop (background refresh for Claude OAuth tokens)
- [x] Usage tracking middleware example (ChatMiddleware.onAfterReceive for token counting)

### Phase 5 Summary

| Step | Module | Status | Description |
|------|--------|--------|-------------|
| 5.1 | M11: Custom Transport & Storage | ✅ | WebSocket, NATS example, SQLite/Drizzle adapters, stream watchdog |
| 5.2 | M12: Extensibility & Integration | ✅ | Interceptors, multi-user pattern, custom renderers, framework presets |

---

## Migration Roadmap

Projects planned for migration to agent-sdk:

| Project | Transport | Storage | Key Challenge | Migration Plan |
|---------|-----------|---------|---------------|----------------|
| claude-supervisor | NATS → NatsChatTransport | SQLite (better-sqlite3) | Non-HTTP transport | moira-ws/sdk-migration-analysis/migration-claude-supervisor.md |
| mcp-moira | HTTP + DSP → SSE | SQLite (Drizzle) | Multi-user, admin models | moira-ws/sdk-migration-analysis/migration-moira.md |

Feature comparison: moira-ws/sdk-migration-analysis/comparison-matrix.md
