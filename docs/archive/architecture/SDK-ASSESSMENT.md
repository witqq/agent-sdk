# SDK Architecture Assessment

Post-M7 quality assessment based on real integration experience (demo app).

**Date**: February 2025
**Scope**: All 18 modules of @witqq/agent-sdk
**Method**: Code review + demo app integration analysis
**Tests**: 1307 passing, 18 failing (38 test files, 2 test files with failures)

---

## Maturity Scale

| Level | Meaning |
|-------|---------|
| 🟢 Production | Stable API, well-tested, no known issues |
| 🟡 Beta | Working but has DX issues or missing features |
| 🔴 Alpha | Fundamental limitations, needs rework |

---

## Module Assessments

### 1. Core Types (`src/types.ts`, 418 LOC)
**Maturity:** 🟢 Production

Types are stable since v0.1. All public types have JSDoc. `AgentEvent` discriminated union (14 variants) is well-typed. `ToolDeclaration`/`ToolDefinition` split works cleanly.

No action items.

### 2. Base Agent (`src/base-agent.ts`, 337 LOC)
**Maturity:** 🟢 Production

State machine (idle→running/streaming→idle→disposed) is solid. Re-entrancy guard tested. Abort controller linking works. All 3 backends extend correctly.

No action items.

### 3. Registry (`src/registry.ts`, 140 LOC)
**Maturity:** 🟢 Production

`registerBackend` + `createAgentService` factory pattern. Built-in backends lazy-loaded. Custom backends supported. Simple and correct.

No action items.

### 4. Backend — Copilot (`src/backends/copilot.ts`, 1017 LOC)
**Maturity:** 🟡 Beta

Working well for chat. `ToolCallTracker` and `ThinkingTracker` solve SDK limitations. Session modes (per-call/persistent) work. Concern: tight coupling to `@github/copilot-sdk` event format — any SDK update may break parsing.

Action items:
- Monitor Copilot SDK updates for event format changes

### 5. Backend — Claude (`src/backends/claude.ts`, 1439 LOC)
**Maturity:** 🟡 Beta

Largest backend. MCP tool format conversion (Zod shape, not JSON Schema) is complex. `stripMcpPrefix()` is a workaround for naming convention mismatch. `thinkingBlockIndices` Set tracking is fragile.

Action items:
- Consider simplifying MCP integration if Claude SDK adds native tool support
- `onAskUser` not supported — document this limitation

### 6. Backend — Vercel AI (`src/backends/vercel-ai.ts`, 734 LOC)
**Maturity:** 🟢 Production

Cleanest backend. Pure API calls, no subprocess management. `providerOptions` passthrough enables model-specific features. `listModels()` with OpenAI preset fallback is pragmatic.

No action items.

### 7. Auth (`src/auth/`, 664 LOC)
**Maturity:** 🟡 Beta

`CopilotAuth` (Device Flow) and `ClaudeAuth` (OAuth+PKCE) work correctly in Node.js. **Browser CORS is the critical issue**: `useAuth` hook imports auth classes which make direct HTTP calls to GitHub/Anthropic — blocked by CORS in browser. Current workaround: lazy `import()` in `useAuth.ts` to avoid `node:crypto` in bundle.

Action items (M8/M9):
- Server-mediated auth pattern as primary for browser
- `useRemoteAuth` hook delegating to server endpoints
- Isolate `node:crypto` dependency properly
- Fix 18 failing tests in `useAuth`/`AuthDialog` (react-step5.test.ts) — likely environment mocking issues

### 8. Chat Core (`src/chat/core.ts`, 651 LOC)
**Maturity:** 🟢 Production

`ChatMessage` with `MessagePart[]` (5-variant union) is well-designed. Per-part `PartStatus` tracking enables fine-grained UI. Bridge functions (`agentEventToChatEvent`, `adaptAgentEvents`) work correctly. 18-type `ChatEvent` discriminated union is comprehensive.

Action items:
- `toChatId()` helper needed (M9) to reduce branded type friction

### 9. Chat Errors (`src/chat/errors.ts`, 388 LOC)
**Maturity:** 🟢 Production

19 error codes cover all observed scenarios. `classifyError()` pattern-matching works for network, HTTP, Zod, timeout, overflow. `ExponentialBackoffStrategy` and `withRetry()` are clean.

No action items.

### 10. Chat Events (`src/chat/events.ts`, 405 LOC)
**Maturity:** 🟢 Production

`TypedEventEmitter<T>` is correct and tested. `ChatEventBus` middleware pipeline works. `filterEvents`/`mapEvents`/`collectText` async utilities are useful.

No action items.

### 11. Chat Storage (`src/chat/storage.ts`, 404 LOC)
**Maturity:** 🟢 Production

`InMemoryStorage` uses `structuredClone` for mutation safety. `FileStorage` with percent-encoding for filenames is robust. Query support (filter, sort, limit, offset) covers all needs.

No action items.

### 12. Chat Sessions (`src/chat/sessions.ts`, 422 LOC)
**Maturity:** 🟡 Beta

Functional but missing reactivity. `listSessions()` returns `ChatSession[]` but `ThreadList` expects `SessionInfo[]` — consumer must map manually. No subscription mechanism for session changes (polling is the only option).

Action items (M9):
- `IChatRuntime.onSessionChange(callback)` subscription
- `useSessions()` reactive hook
- `toSessionInfo(session: ChatSession): SessionInfo` utility
- Or make `ThreadList` accept `ChatSession[]` directly

### 13. Chat Context (`src/chat/context.ts`, 458 LOC)
**Maturity:** 🟢 Production

3 strategies (truncate-oldest, sliding-window, summarize-placeholder) all work. `fitMessagesAsync()` with optional `ContextSummarizer` is elegant. `getContextStats()` provides visibility.

No action items.

### 14. Chat Accumulator (`src/chat/accumulator.ts`, 177 LOC)
**Maturity:** 🟢 Production

`MessageAccumulator` correctly converts `AgentEvent` stream to `ChatMessage` with parts. Parallel tool call tracking, interleaved thinking blocks, per-part status transitions all work. `snapshot()` for React compatibility is well-designed.

**Note**: This is the key component needed for progressive streaming in `useChat` (M9). Currently only used server-side in `ChatRuntime.send()`.

No action items (usage expansion is M9 scope).

### 15. Chat State (`src/chat/state.ts`, 201 LOC)
**Maturity:** 🟢 Production

`StateMachine<S>` with declarative transition maps is clean. Runtime, message, and tool-call state machines are well-defined. `ChatReentrancyGuard` and `ChatAbortController` work correctly.

No action items.

### 16. Chat Backends (`src/chat/backends/`, 708 LOC total)
**Maturity:** 🟢 Production

`BaseBackendAdapter` with service ownership flag (`_ownsService`) is correct. All 3 adapters (Copilot, Claude, VercelAI) work via `streamAgentEvents()`. `SSEChatTransport` and `streamToTransport()` handle SSE correctly.

Action items (M8):
- Heartbeat for long-running streams
- Connection close detection
- WebSocket transport option

### 17. Chat Runtime (`src/chat/runtime.ts`, 685 LOC)
**Maturity:** 🟡 Beta

Core orchestration works: `send()` flow (persist → middleware → stream → accumulate → persist), backend switching, tool registration, context trimming, retry. However:
- `createSession()` requires explicit `config: { model: '', backend: '' }` even when runtime has defaults
- No session change subscription (consumers must poll)
- Error auto-recovery (error→idle on next send) is smart but undocumented

Action items (M9):
- Default config from current backend/model
- Session change events
- Document error recovery behavior

### 18. Chat React (`src/chat/react/`, 2320 LOC total)
**Maturity:** 🟡 Beta

Most hooks and components work correctly. `ChatProvider`, `useChat`, `Thread`, `Composer`, `ThreadList` are the MVP. `RemoteChatRuntime` solves the server↔browser bridge well.

**Critical issue:** `useChat` has no progressive streaming. Lines 99-107 consume the entire SSE stream silently (`for await (const _event of runtime.send(...))`), then calls `getSession()` to refresh messages. User sees nothing during generation.

**Secondary issues:**
- `ChatId` branded type leaks through APIs — consumers need `as ChatId` casts
- `ThreadList` requires `SessionInfo[]` but runtime gives `ChatSession[]`
- `ModelSelector` and `AuthDialog` are unusable in browser (CORS, auth dependency)
- `useMessages` falls back to 500ms polling when session lacks subscribe/getSnapshot

Action items (M9):
- Progressive streaming: use `MessageAccumulator` in `useChat.sendMessage()` loop
- `toChatId()` or accept `string` in hook APIs
- `ThreadList` accept `ChatSession[]`
- `useSessions()` hook with reactivity
- `useRemoteAuth()` for server-mediated auth
- Fix `useAuth`/`AuthDialog` test failures (18 tests in react-step5.test.ts)

---

## Overall Assessment

### Strengths
1. **Modular architecture** — 18 subpath exports, tree-shakeable, zero coupling between modules
2. **Type safety** — strict TypeScript, discriminated unions, branded types
3. **Test coverage** — 1325 tests across 38 files, covering unit and integration scenarios
4. **Backend abstraction** — 3 backends (Copilot, Claude, Vercel AI) behind unified interface
5. **Headless components** — `data-*` attributes enable styling without framework lock-in

### Weaknesses
1. **No progressive streaming** — the single biggest DX gap vs competitors (Vercel AI, assistant-ui)
2. **Browser auth broken** — useAuth/AuthDialog unusable due to CORS, requires server proxy
3. **Server boilerplate** — 130+ lines of manual route handlers (M8 will fix)
4. **Type friction** — ChatId branded type, ChatSession↔SessionInfo mismatch
5. **No session reactivity** — polling instead of push updates

### Comparison with Competitors

| Feature | Our SDK | Vercel AI SDK | assistant-ui |
|---------|---------|--------------|-------------|
| Progressive streaming | ❌ (M9) | ✅ | ✅ |
| Server handler | ❌ (M8) | ✅ `streamText()` | N/A |
| Headless components | ✅ | ✅ Elements | ✅ |
| Multi-backend | ✅ 3 backends | ✅ providers | ✅ runtimes |
| Session persistence | ✅ | ❌ | ❌ |
| Context management | ✅ | ❌ | ❌ |
| Tool approval UI | ✅ | ❌ | ✅ |
| Auth flow | 🟡 (CORS) | N/A | N/A |

### Priority

1. **M8 Server Utilities** — removes boilerplate, enables server-mediated auth
2. **M9 Progressive Streaming** — the single most impactful DX improvement
3. **M9 Type Ergonomics** — ChatId, SessionInfo, defaults

After M8+M9, SDK reaches feature parity with competitors while offering unique advantages (session persistence, context management, multi-backend, tool approval).
