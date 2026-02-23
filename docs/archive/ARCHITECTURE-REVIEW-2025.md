# Architecture & Tech Debt Review Report

**Project**: @witqq/agent-sdk  
**Date**: 2025-07-13  
**Scope**: Full `src/` tree — architecture, tech debt, code smells  
**Verdict**: **NEEDS_FIXES**

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **P0 (BLOCKING)** | 2 | Must fix — correctness/resource leak issues |
| **P1 (MAJOR)** | 6 | Significant tech debt or design problems |
| **P2 (MINOR)** | 5 | Improvements worth tracking |

Overall the codebase is well-structured with good separation of concerns (runtime → adapters → backends), proper state machines, and clean interfaces. The issues below are focused and actionable.

---

## What's Good

- **Clean layered architecture**: `chat/runtime` → `chat/backends/base` → `backends/*` — proper abstraction ladder.
- **State machines** in `chat/state.ts` — validated transitions, reentrancy guard, abort controller with cleanup. Well-designed.
- **Storage abstraction** with pluggable adapters (`IStorageAdapter<T>` → InMemory / File). SOLID-compliant.
- **Transport abstraction** (`IChatTransport` → SSE) — ready for WebSocket without touching handler.
- **Middleware pipeline** in runtime — clean `onBeforeSend`/`onEvent`/`onAfterReceive`/`onError` lifecycle.
- **Heartbeat pattern** in `BaseAgent.heartbeatStream()` — elegant Promise.race between events and timer.
- **structuredClone** used consistently in storage layer to prevent mutation leaks.

---

## P0 — BLOCKING Issues

### [B1] Event listener leak in `BaseAgent.createAbortController()`

**Location**: `src/base-agent.ts:325-331`  
**Problem**: When an external `AbortSignal` is provided, an `"abort"` event listener is added but **never removed** if the operation completes before the signal fires. Unlike `ChatAbortController` in `chat/state.ts` (which has proper cleanup via `dispose()`), `BaseAgent` does not track or clean up the listener.

```typescript
// base-agent.ts:325-331
externalSignal.addEventListener("abort", () => ac.abort(), { once: true });
// ← This listener leaks if operation completes normally.
// The AbortController `ac` is nulled at line 53/74, but the external
// signal still holds a reference to the closure + `ac`.
```

**Impact**: In long-lived processes with many agent calls sharing a single external signal (e.g., a user session signal reused across requests), listeners accumulate on the external signal, causing memory growth. In practice `{once: true}` prevents repeated firing but the reference isn't released until the external signal fires or is GC'd.

**Fix**: Store the listener reference and remove it in the `finally` block, mirroring `ChatAbortController.dispose()`:
```typescript
private _externalCleanup?: () => void;

private createAbortController(externalSignal?: AbortSignal): AbortController {
  const ac = new AbortController();
  this.abortController = ac;
  if (externalSignal) {
    if (externalSignal.aborted) {
      ac.abort();
    } else {
      const handler = () => ac.abort();
      externalSignal.addEventListener("abort", handler, { once: true });
      this._externalCleanup = () => externalSignal.removeEventListener("abort", handler);
    }
  }
  return ac;
}
// In finally blocks: this._externalCleanup?.(); this._externalCleanup = undefined;
```

### [B2] `readBody()` silently swallows errors — no error response to client

**Location**: `src/chat/server/handler.ts:227-255`  
**Problem**: Three failure modes silently resolve to `{}` with **no error feedback** to the caller:
1. Body exceeds `maxSize` → resolves `{}`, handler proceeds with missing fields
2. JSON parse fails → resolves `{}`, handler proceeds with missing fields  
3. Request error → resolves `{}`

When body exceeds max size, the handler doesn't return a 413. When JSON is malformed, no 400. The handler continues and may produce confusing downstream errors (e.g., "sessionId and message are required" instead of "request body too large").

**Impact**: Production debugging nightmare — clients get misleading errors. Security concern: oversized payloads silently truncated rather than rejected.

**Fix**: Return structured errors with proper HTTP status codes:
```typescript
type BodyResult = { ok: true; data: Record<string, unknown> } 
                | { ok: false; status: number; message: string };

function readBody(req, maxSize): Promise<BodyResult> {
  // ... on size exceeded: resolve({ ok: false, status: 413, message: "Request body too large" })
  // ... on parse error: resolve({ ok: false, status: 400, message: "Invalid JSON" })
}
```

---

## P1 — MAJOR Issues

### [M1] Copy-paste duplication: `CopilotChatAdapter` ≡ `ClaudeChatAdapter` (97% identical)

**Location**: `src/chat/backends/copilot.ts` vs `src/chat/backends/claude.ts`  
**Problem**: These two files (108 lines each) differ only in:
- Class/type names (`Copilot` → `Claude`)
- Backend name string (`"copilot"` → `"claude"`)
- Options field name (`copilotOptions` → `claudeOptions`)
- Comment text

The `resume()` method, `captureSessionId()`, constructor pattern, and session validation logic are identical line-for-line.

**Impact**: Bug fixes must be applied twice. Adding a new backend requires copying 108 lines.

**Fix**: Extract a generic `PersistentSessionAdapter<TOptions>` class that both extend with just `createService()` and backend-specific config. The `VercelAIChatAdapter` (stateless, 75 lines) is already different enough to stay separate.

### [M2] Copy-paste duplication: utility functions across `backends/copilot.ts` and `backends/claude.ts`

**Location**: 
- `src/backends/copilot.ts:844-900` (`extractLastUserPrompt`, `serializeToolCall`, `serializeToolResult`, `flattenHistory`)
- `src/backends/claude.ts:1270-1326` (identical functions)

**Problem**: Verified via diff — these functions are byte-for-byte identical across 56+ lines. The `flattenHistory` function including the `(msg as any).thinking` cast pattern is duplicated across all three backends.

**Impact**: Same reasoning extraction hack `(msg as any).thinking` maintained in 3 places. Bug fixes must be applied in multiple files.

**Fix**: Extract to `src/backends/shared/message-utils.ts` and import.

### [M3] `mapToolsToSDK` and `mapToolsToSDKAsync` are functionally identical

**Location**: `src/backends/copilot.ts:191-227`  
**Problem**: `mapToolsToSDKAsync` is declared `async` but contains zero `await` calls. Its body is identical to `mapToolsToSDK`. The `async` keyword only wraps the return in a Promise — adding overhead with no benefit.

**Impact**: Dead code / confusion. Maintainers may expect async behavior that doesn't exist.

**Fix**: Remove `mapToolsToSDKAsync` and use `mapToolsToSDK` everywhere, or if async is actually needed for future Zod conversion, add a comment and the actual async logic.

### [M4] Dual backend architecture without clear boundaries

**Location**: `src/backends/` (low-level) vs `src/chat/backends/` (chat-level)  
**Problem**: The SDK has **two separate backend hierarchies**:
1. `src/backends/{copilot,claude,vercel-ai}.ts` — Raw agent services (800-1400 lines each), implementing `IAgent`/`IAgentService`
2. `src/chat/backends/{copilot,claude,vercel-ai}.ts` — Chat adapters (75-108 lines each), wrapping the raw services via `BaseBackendAdapter`

The chat adapters use `require("../../index.js")` to lazily load the raw backends, creating a hidden runtime dependency. The naming is confusing: both directories are called "backends" but serve different purposes.

**Impact**: New contributors can't tell which layer to modify. The `require()` calls bypass ESM module resolution and break tree-shaking. The circular-ish dependency pattern (`chat/backends/copilot` → `index.js` → `backends/copilot`) is fragile.

**Fix**: 
- Rename `src/chat/backends/` → `src/chat/adapters/` for clarity
- Consider passing the service factory as a constructor parameter instead of `require()` (dependency injection over service locator)

### [M5] `FileStorage` uses synchronous `node:fs` in async-declared methods

**Location**: `src/chat/storage.ts:254-404`  
**Problem**: All `FileStorage` methods are declared `async` (returning `Promise<T>`) but internally use `readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`, `unlinkSync`, `mkdirSync`. This blocks the event loop during file I/O.

```typescript
async get(key: string): Promise<T | null> {
  const filePath = this.keyToPath(key);
  if (!existsSync(filePath)) return null;     // ← sync, blocks event loop
  return this.readFile(filePath);              // ← readFileSync inside
}
```

**Impact**: Under load, a `FileSessionStore.list()` call with many sessions will block the event loop for the entire directory scan + file reads. The async interface is misleading — callers expect non-blocking behavior.

**Fix**: Migrate to `node:fs/promises` (`readFile`, `writeFile`, `mkdir`, `readdir`, `unlink`, `access`). The interface already returns Promises, so no API change needed.

### [M6] Seven `as any` casts and 4 `@ts-ignore` directives — type safety gaps

**Location**: Multiple files (see scan results)  
**Problem**: 
- `(msg as any).thinking` — repeated 3 times across backends (copilot:882, claude:1308, vercel-ai:281). The `Message` type doesn't include a `thinking` field, so it's accessed via unsafe cast.
- `tool.execute(args as any)` — 3 times. Tool parameter types are erased.
- `@ts-ignore` on dynamic imports — 4 occurrences for peer dependency loading.

**Impact**: The `thinking` field is a real concept (extended thinking / reasoning blocks) that should be part of the `Message` type. The `as any` casts hide type errors silently.

**Fix**:
- Add `thinking?: string` to the `Message` type in `src/types.ts`
- For tool execute: use proper generic constraint `tool.execute(args as TParams)` or validate args
- `@ts-ignore` on peer deps is acceptable — document pattern in CONTRIBUTING.md

---

## P2 — MINOR Issues

### [m1] `ContextWindowManager` created per-send — could be reused
**Location**: `src/chat/runtime.ts:303`  
`new ContextWindowManager(this._contextConfig)` is called on every `send()`. The manager is stateless after construction, so it could be created once in the constructor.

### [m2] Deprecated method aliases in `IChatSessionStore` with no removal timeline
**Location**: `src/chat/sessions.ts:186-198`  
`addMessage()` and `getMessages()` are marked `@deprecated` but the deprecation message says "next major" with no version number. Add concrete version (e.g., `@deprecated Since 1.x, will be removed in 2.0`).

### [m3] `ChatSession` interface mixes data and behavior (SRP tension)
**Location**: `src/chat/core.ts:160-176`  
`ChatSession` has both data properties (`id`, `messages`, `config`) and optional behavior (`subscribe()`, `getSnapshot()`). These React-specific methods leak into the core type. Consider a separate `ObservableChatSession extends ChatSession` for React use.

### [m4] `isChatEvent()` type guard uses linear array scan
**Location**: `src/chat/core.ts:420-441`  
The valid types array is allocated on every call and uses `.includes()` (O(n)). For a hot-path validation, use a `Set`:
```typescript
const VALID_EVENT_TYPES = new Set<string>(["message:start", ...]);
export function isChatEvent(value: unknown): value is ChatEvent {
  return typeof value === "object" && value !== null && VALID_EVENT_TYPES.has((value as any).type);
}
```

### [m5] `streamToTransport` accumulates full text in memory unnecessarily
**Location**: `src/chat/backends/transport.ts:150`  
`accumulatedText` builds the entire response text string just to include it in the final `done` event. For large responses, this doubles memory usage. Consider making `finalOutput` optional or streaming a token count instead.

---

## Remarks (Non-blocking observations)

1. **No circular dependencies detected.** Import graph is clean — `chat/backends/` → `chat/core` → `types`, all downward. The only upward reference is the `require("../../index.js")` in chat adapters (addressed in M4).

2. **Clean error hierarchy.** `ChatError`, `StorageError`, `DisposedError`, `AbortError` — each has a machine-readable code. Good for programmatic error handling.

3. **No TODO/FIXME/HACK markers found** in the codebase. Either tech debt is well-managed or not tracked inline.

4. **`_authLoaders` pattern in `useAuth.ts`** — the mutable export for testability is documented and well-understood. It's a pragmatic workaround for `vi.mock` limitations with dynamic imports. Acceptable for the test infrastructure benefit.

5. **Backend file sizes** (copilot: 1017, claude: 1439, vercel-ai: 734) are large but each file is a single cohesive backend. The internal structure (types → mapping functions → agent class → service class) is consistent. Consider splitting if they grow past 1500 lines.

---

## Recommendation

**Priority order for fixes:**

1. **B2** (readBody silent errors) — quickest fix, biggest debugging benefit
2. **B1** (event listener leak) — important for production stability  
3. **M2 + M6** (extract shared utils + fix Message type) — eliminates most `as any` casts
4. **M1** (deduplicate chat adapters) — reduces maintenance surface
5. **M5** (async FileStorage) — important before production FileStorage use
6. **M4** (naming clarity) — breaking change, plan for next major

Total estimated effort: ~2-3 days for B1+B2+M1+M2+M5+M6.
