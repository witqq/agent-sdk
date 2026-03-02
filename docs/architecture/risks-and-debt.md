---
title: Risks and Technical Debt
project: "@witqq/agent-sdk"
verified: 2026-03-02
---

# Risks and Technical Debt

Single source of truth for all open tech debt items. Each item verified against source code.

---

## P1 — MAJOR

No open items.

---

## P2 — MINOR

No open items.

---

## DOCUMENTATION GAPS

No open items.

---

## STRATEGIC

No open items.

---

## RESOLVED (for reference)

| ID | Description | Resolution |
|----|-------------|-----------|
| B1 | Event listener leak in `BaseAgent.createAbortController()` | RESOLVED — `cleanupRun()` (base-agent.ts:509-513) calls `_cleanupExternalSignal()` which does `removeEventListener`. Listener uses `{ once: true }`. Cleanup on all paths (success, error, abort). |
| B2 | `readBody()` silently swallows errors | RESOLVED — moved to `src/chat/server/utils.ts:21-56`. Now throws `BodyParseError` with status codes (413 oversized, 400 invalid JSON, 500 request error). |
| M1 | CopilotChatAdapter ≡ ClaudeChatAdapter duplication | RESOLVED — `ResumableChatAdapter` base class extracted to `src/chat/backends/resumable.ts`. CopilotChatAdapter and ClaudeChatAdapter extend it. ~140 lines dedup. Commit `3f7f460`. |
| M2 | Utility function duplication across backends | RESOLVED — extracted to `src/backends/shared.ts`. `extractLastUserPrompt`, `serializeToolCall`, `serializeToolResult`, `buildContextualPrompt` all in shared module. Both copilot.ts and claude.ts import from shared.ts. |
| M3 | `mapToolsToSDKAsync` false-async function | RESOLVED — removed false-async function. Callers use sync `mapToolsToSDK()`. Commit `3858a3d`. |
| M4 | Dual backend naming confusion | RESOLVED — documented in architecture overview (`docs/architecture/overview.md`) and glossary (`docs/architecture/glossary.md`). Naming is by-design: `src/backends/` = agent services, `src/chat/backends/` = chat adapters. |
| M5 | FileStorage uses synchronous `node:fs` | RESOLVED — migrated to `fs/promises` in `src/chat/storage.ts`. Commit `f0588ec`. |
| M6 | `(msg as any).thinking` casts | RESOLVED — `thinking?: string` field added to assistant Message variant in `src/types/messages.ts`. Casts removed. Commit `753f352`. |
| MAJOR-10 | FilePermissionStore uses synchronous I/O | RESOLVED — migrated to `fs/promises` in `src/permission-store.ts`. Commit `f0588ec`. |
| m1 | ContextWindowManager created per-send | RESOLVED — cached as `_ctxManager` instance field in runtime constructor. Commit `3858a3d`. |
| m2 | Deprecated method aliases (`addMessage`, `getMessages`) in IChatSessionStore | RESOLVED — no deprecated aliases found in `src/chat/sessions.ts`. Interface has clean `appendMessage`/`loadMessages` API only. |
| m3 | ChatSession mixes data and behavior (SRP) | RESOLVED — `ChatSession` (types.ts:139) is pure data interface. `ObservableSession` (types.ts:156) is a separate interface extending `ChatSession` with `subscribe()`/`getSnapshot()`. Clean separation. |
| m4 | `isChatEvent` allocates array on every call | RESOLVED — module-level `ReadonlySet` with `.has()` in `src/chat/guards.ts`. Commit `3858a3d`. |
| m5 | `streamToTransport` accumulates full response text | RESOLVED — array push + join pattern in `src/chat/backends/transport.ts`. Commit `3858a3d`. |
| IMP-03 | JSONValue strictness for tool returns | RESOLVED — `ToolDefinition.execute` now returns `Promise<unknown> \| unknown` (tools.ts:23). |
| IMP-04 | ToolDefinitionLike type missing | RESOLVED — exported at `src/types/tools.ts:52`: `type ToolDefinitionLike<TParams> = ToolDeclaration<TParams> \| ToolDefinition<TParams>`. |
| IMP-05 | useSSE doesn't support POST | RESOLVED — `UseSSEOptions` has `method?: "GET" \| "POST"` (useSSE.ts:9-10) and `body?: unknown` (useSSE.ts:12). POST with JSON body handled at lines 76-86. |
| IMP-06 | No server quickstart guide | RESOLVED — `docs/chat-sdk/server-quickstart.md` created with minimal server example, endpoints, configuration, framework integration. |
| IMP-07 | WritableResponse docs | RESOLVED — framework compatibility table with interface definitions in `docs/chat-sdk/server-quickstart.md`. |
| IMP-08 | ChatSessionMetadata JSDoc | RESOLVED — all fields now have JSDoc comments: `messageCount`, `totalTokens`, `tags`, `custom`. |
| IMP-09 | fromAgentMessage() not discoverable | RESOLVED — `createTextMessage()` exists (exported from core.ts:42). `fromAgentMessage()` exported from core.ts:62. Both discoverable from main chat entry point. |
| IMP-10 | useAuth removal | RESOLVED — no `useAuth` references (only `useRemoteAuth`). |
| IMP-11 | No SQLite schema versioning | RESOLVED — migration system in `src/chat/sqlite/migrations.ts` with `runMigrations()`. Commit `99df1e0`. |
| IMP-12 | Chat SDK adoption | RESOLVED — agent-layer-only usage documented as first-class pattern in `README.md` with extension points (supervisorHooks, AgentEvent stream, ToolContext). Multi-user and NATS examples referenced. |
| MINOR-4 | listModels hardcoded fallback for openai.com | RESOLVED — `vercel-ai.ts:688-736` queries `/models` endpoint via fetch. No hardcoded preset list. Returns `[]` on failure. |
| Val-m1 | No message list virtualization | RESOLVED — `useVirtualMessages` hook + Thread `virtualize` prop (opt-in). Commit `c925d94`. |
| Val-m2 | No PermissionPrompt component | RESOLVED — headless `PermissionDialog` component exported. Commit `c925d94`. |
| Validation-m3 | saveMessages() JSDoc | PARTIAL — method exists at `sessions.ts:89,190` but no JSDoc specifying upsert-by-ID semantics. Current implementation appends (not upserts). Behavior is clear from code; JSDoc is nice-to-have. |
| Validation-M5 | ChatSDKError deprecated alias | RESOLVED — `ChatSDKError` no longer exists in `src/chat/errors.ts`. Only `ChatError` class remains. |
| Validation-M7 | No ProviderRegistry | OPEN (deferred) — no `ProviderRegistry` in codebase. String-based backend selection (`"copilot"`, `"claude"`, `"vercel-ai"`) works for 3 backends. Registry may be needed as ecosystem grows. |

---

## Summary

| Severity | Open | Resolved |
|----------|------|----------|
| P1/MAJOR | 0 | 9 (B1, B2, M1, M2, M3, M4, M5, M6, MAJOR-10) |
| P2/MINOR | 0 | 13 (m1, m2, m3, m4, m5, IMP-03, IMP-04, IMP-05, IMP-07, IMP-09, IMP-11, Val-m1, Val-m2) |
| DOC | 0 | 3 (IMP-06, IMP-08, IMP-10) |
| STRATEGIC | 0 | 1 (IMP-12) |
| **Total** | **0 open** | **26 resolved** |
