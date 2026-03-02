---
title: Risks and Technical Debt
project: "@witqq/agent-sdk"
verified: 2026-03-02
---

# Risks and Technical Debt

Single source of truth for all open tech debt items. Each item verified against source code.

---

## P1 — MAJOR

### M1: CopilotChatAdapter ≡ ClaudeChatAdapter Duplication

**Status**: OPEN
**Files**: `src/chat/backends/copilot.ts`, `src/chat/backends/claude.ts` (108 lines each, 97% identical)
**Description**: Both adapters extend `BaseBackendAdapter`, differ only in class name, backend name string (`"copilot"` vs `"claude"`), and options field name (`copilotOptions` vs `claudeOptions`). Bug fixes must be applied twice.
**Remediation**: Extract parameterized `CLIChatAdapter` base or factory function.

---

### M3: `mapToolsToSDKAsync` Declared Async With No Await

**Status**: OPEN
**File**: `src/backends/copilot.ts:224-235`
**Description**: Function is `async` but body is `return tools.map(...)` — no `await` anywhere. The async keyword wraps the return in a Promise for no benefit. Called at `copilot.ts:541`.
**Remediation**: Remove `async` keyword or document why it's needed for ESM environment handling.

---

### M5: FileStorage Uses Synchronous `node:fs`

**Status**: OPEN
**File**: `src/chat/storage.ts` (lines 275–404)
**Description**: `FileStorage` class uses `readFileSync`, `writeFileSync`, `mkdirSync`, `existsSync`, `readdirSync`, `unlinkSync` in methods declared `async`. Blocks the event loop under load.
**Remediation**: Replace with `fs/promises` equivalents.

---

### MAJOR-10: FilePermissionStore Uses Synchronous I/O

**Status**: OPEN
**File**: `src/permission-store.ts:66-117`
**Description**: Same class of issue as M5. `readFile()` uses `fs.readFileSync` (line 101), `writeFileAtomic()` uses `fs.writeFileSync` and `fs.mkdirSync` (lines 112-115). All wrapped in `async` interface methods.
**Remediation**: Replace with `fs/promises` equivalents.

---

### M6: `(msg as any).thinking` Casts

**Status**: PARTIAL — reduced from 7 to 2 locations after `shared.ts` extraction
**Files**:
- `src/backends/shared.ts:47` — `(msg as any).thinking`
- `src/backends/vercel-ai.ts:283` — `(msg as any).thinking`
**Description**: `Message` type lacks a `thinking` field. Two remaining casts in backend code. The `tool.execute(args as any)` casts (copilot.ts:206,231 and vercel-ai.ts:261) are separate — caused by generic `TParams`.
**Remediation**: Add optional `thinking?: string` to `Message` type.

---

### M4: Dual Backend Naming

**Status**: OPEN (by design, but underdocumented)
**Dirs**: `src/backends/` (raw agent services: copilot.ts, claude.ts, vercel-ai.ts, shared.ts) and `src/chat/backends/` (chat adapters: copilot.ts, claude.ts, vercel-ai.ts, base.ts, transport.ts, etc.)
**Description**: Both directories called "backends" with identically named files. Clear separation exists (agent services vs chat adapters) but naming causes confusion for new contributors.
**Remediation**: Document the distinction. Consider renaming in next major.

---

## P2 — MINOR

### m1: ContextWindowManager Created Per-Send

**Status**: OPEN
**File**: `src/chat/runtime.ts:494`
**Description**: `new ContextWindowManager(this._contextConfig)` on every `trimSessionContext()` call. The manager is stateless after construction — could be cached as instance field.
**Remediation**: Create once in constructor, reuse in `trimSessionContext()`.

---

### m4: `isChatEvent` Allocates Array on Every Call

**Status**: OPEN
**File**: `src/chat/guards.ts:93-104`
**Description**: `validTypes` array created on every invocation, searched with `.includes()`. On hot paths this is wasteful.
**Remediation**: Hoist to module-level `Set<string>` constant.

---

### m5: `streamToTransport` Accumulates Full Response Text

**Status**: OPEN
**File**: `src/chat/backends/transport.ts:151-163`
**Description**: `accumulatedText` string grows with every `message:delta` event, used only for `done` event's `finalOutput`. Doubles memory for large responses.
**Remediation**: Make `finalOutput` optional or stream it from the transport consumer.

---

### IMP-11: No SQLite Schema Versioning

**Status**: OPEN
**File**: `src/chat/sqlite/` (no `SCHEMA_VERSION` constant found)
**Description**: Tables use `CREATE TABLE IF NOT EXISTS` — no incremental migration. Works for initial deployments but no migration path when schema evolves.
**Remediation**: Add `SCHEMA_VERSION` and `migrate()` when schema changes needed.
**Priority**: LOW (no schema changes planned)

---

### Validation-m1: No Message List Virtualization

**Status**: OPEN (design gap)
**File**: `src/chat/react/` (no `@tanstack/react-virtual` or equivalent)
**Description**: `Thread` component renders all messages. Large conversations will cause performance issues.
**Remediation**: Add virtualization when performance becomes a concern.

---

### Validation-m2: No PermissionPrompt Component

**Status**: OPEN (design gap)
**Description**: `useToolApproval` hook exists but no standalone `PermissionPrompt`/`PermissionDialog` component exported. Consumers must build their own UI.
**Remediation**: Export a headless `PermissionDialog` component.

---

### IMP-07: WritableResponse Docs

**Status**: OPEN
**File**: `docs/chat-sdk/README.md:810` (one-line mention only)
**Description**: No dedicated framework compatibility section with examples.
**Remediation**: Add "Framework Compatibility" section showing Express/Fastify/Hono setup.

---

### IMP-08: ChatSessionMetadata JSDoc

**Status**: RESOLVED
**File**: `src/chat/types.ts:127-136`
**Description**: All fields now have JSDoc comments: `messageCount`, `totalTokens`, `tags`, `custom`.

---

## DOCUMENTATION GAPS

### IMP-06: No Server Quickstart Guide

**Status**: OPEN
**File**: `docs/chat-sdk/server-quickstart.md` does not exist
**Description**: Server-only consumers have no clear starting point. Demo exists but is not a quickstart guide.
**Remediation**: Create minimal guide (~20 lines `createChatServer` setup).

---

## STRATEGIC

### IMP-12: Chat SDK Adoption

**Status**: OPEN
**Description**: Only internal demo uses Chat SDK. Real consumer (claude-supervisor) uses agent abstraction layer only (1400+ lines of glue). Chat SDK may not serve real consumer needs (multi-user NATS, permission supervision, custom event routing).
**Remediation**: Add extension points. Document agent-layer-only usage as first-class pattern.

---

## RESOLVED (for reference)

| ID | Description | Resolution |
|----|-------------|-----------|
| B1 | Event listener leak in `BaseAgent.createAbortController()` | RESOLVED — `cleanupRun()` (base-agent.ts:509-513) calls `_cleanupExternalSignal()` which does `removeEventListener`. Listener uses `{ once: true }`. Cleanup on all paths (success, error, abort). |
| B2 | `readBody()` silently swallows errors | RESOLVED — moved to `src/chat/server/utils.ts:21-56`. Now throws `BodyParseError` with status codes (413 oversized, 400 invalid JSON, 500 request error). |
| M2 | Utility function duplication across backends | RESOLVED — extracted to `src/backends/shared.ts`. `extractLastUserPrompt`, `serializeToolCall`, `serializeToolResult`, `buildContextualPrompt` all in shared module. Both copilot.ts and claude.ts import from shared.ts. |
| m2 | Deprecated method aliases (`addMessage`, `getMessages`) in IChatSessionStore | RESOLVED — no deprecated aliases found in `src/chat/sessions.ts`. Interface has clean `appendMessage`/`loadMessages` API only. |
| m3 | ChatSession mixes data and behavior (SRP) | RESOLVED — `ChatSession` (types.ts:139) is pure data interface. `ObservableSession` (types.ts:156) is a separate interface extending `ChatSession` with `subscribe()`/`getSnapshot()`. Clean separation. |
| IMP-03 | JSONValue strictness for tool returns | RESOLVED — `ToolDefinition.execute` now returns `Promise<unknown> \| unknown` (tools.ts:23). |
| IMP-04 | ToolDefinitionLike type missing | RESOLVED — exported at `src/types/tools.ts:52`: `type ToolDefinitionLike<TParams> = ToolDeclaration<TParams> \| ToolDefinition<TParams>`. |
| IMP-05 | useSSE doesn't support POST | RESOLVED — `UseSSEOptions` has `method?: "GET" \| "POST"` (useSSE.ts:9-10) and `body?: unknown` (useSSE.ts:12). POST with JSON body handled at lines 76-86. |
| IMP-09 | fromAgentMessage() not discoverable | RESOLVED — `createTextMessage()` exists (exported from core.ts:42). `fromAgentMessage()` exported from core.ts:62. Both discoverable from main chat entry point. |
| IMP-10 | useAuth removal | RESOLVED — no `useAuth` references (only `useRemoteAuth`). |
| MINOR-4 | listModels hardcoded fallback for openai.com | RESOLVED — `vercel-ai.ts:688-736` queries `/models` endpoint via fetch. No hardcoded preset list. Returns `[]` on failure. |
| Validation-M5 | ChatSDKError deprecated alias | RESOLVED — `ChatSDKError` no longer exists in `src/chat/errors.ts`. Only `ChatError` class remains. |
| Validation-m3 | saveMessages() JSDoc | PARTIAL — method exists at `sessions.ts:89,190` but no JSDoc specifying upsert-by-ID semantics. Current implementation appends (not upserts). Behavior is clear from code; JSDoc is nice-to-have. |
| Validation-M7 | No ProviderRegistry | OPEN (deferred) — no `ProviderRegistry` in codebase. String-based backend selection (`"copilot"`, `"claude"`, `"vercel-ai"`) works for 3 backends. Registry may be needed as ecosystem grows. |

---

## Summary

| Severity | Open | Resolved |
|----------|------|----------|
| P1/MAJOR | 6 (M1, M3, M4, M5, M6, MAJOR-10) | 3 (B1, B2, M2) |
| P2/MINOR | 7 (m1, m4, m5, IMP-11, Val-m1, Val-m2, IMP-07) | 6 (m2, m3, IMP-03, IMP-04, IMP-05, IMP-09) |
| DOC | 1 (IMP-06) | 2 (IMP-08, IMP-10) |
| STRATEGIC | 1 (IMP-12) | — |
| **Total** | **15 open** | **11 resolved** |
