---
title: Risks and Technical Debt
project: "@witqq/agent-sdk"
---

# Risks and Technical Debt

## Stateful Violations (RESOLVED in v0.7.0)

All 7 stateful violations (STAT-01 through STAT-07) identified in the pre-v0.7 architecture review have been resolved:

| ID | Issue | Resolution |
|----|-------|-----------|
| STAT-01 | `HandlerState.currentModel` shared mutable state | Kept as single-user convenience; multi-user resolves from `providerId` per-request |
| STAT-02 | `session.config.model` writeback in `send()` | Removed — model is per-request via `RuntimeSendOptions` |
| STAT-03 | `session.config.backend` writeback in `loadAndSyncSession()` | Removed — backend is per-request |
| STAT-04 | `_cachedModel` in `BaseBackendAdapter` | Removed — model flows through `RunOptions` per-call |
| STAT-05 | `_toolsOverride` in `BaseBackendAdapter` | Removed — tools flow via `SendMessageOptions.tools` |
| STAT-06 | `_activeSessionId` in `ChatRuntime` | Removed — client-only concern in `RemoteChatClient` |
| STAT-07 | `_defaultBackend` fallback in `createSession()` | Kept for convenience — `defaultBackend` used when caller doesn't specify |

---

## Resolved Gaps (Previous Version)

### Gap 1: Dead `onRuntimeChange` Infrastructure (CRITICAL)
**Status**: ✅ RESOLVED (commit a6cbde7) — `_notifyRuntimeChange()` now fires events.

### Gap 2: `getContextStats` Interface Violation (CRITICAL)
**Status**: ✅ RESOLVED (commit a6cbde7) — added to `IChatClient`, cast removed.

### Gap 3: Duplicated Listener Management (MAJOR)
**Status**: ✅ RESOLVED (commit a2ad205) — extracted `ListenerSet<T>`.

### Gap 4: CLAUDE.md Architecture Drift (MAJOR)
**Status**: ✅ RESOLVED — CLAUDE.md describes actual interfaces.

### Gap 5: Type Assertions (MINOR)
**Status**: 34 boundary casts remain — all benign. Potential reduction via upstream SDK type guard contributions.

### Gap 6: `node:crypto` in Auth (MINOR)
**Status**: ✅ MITIGATED — `useRemoteAuth` per [ADR-0004](./adr/0004-server-mediated-auth.md).

---

## Open Technical Debt (from SDK Feedback Audit)

Cross-referenced with [moira-ws/sdk-feedback-audit-20260227-2101/all-items.md](../../moira-ws/sdk-feedback-audit-20260227-2101/all-items.md) (78 items, 43 resolved, 35 open) and [action plan](../../moira-ws/sdk-feedback-audit-20250301-0700/step-4/action-plan.md) (27 findings).

### API Surface — Still Open

#### IMP-03: JSONValue Strictness for Tool Returns (F-009)

**Evidence**: `ToolDefinition.execute` returns `Promise<JSONValue> | JSONValue` (`src/types/tools.ts:23`). Every consumer tool returning typed objects must cast to `JSONValue`.

**Impact**: 34 `as any`/`as unknown` casts across consumer codebases.

**Remediation**: Widen execute return type to `Promise<unknown> | unknown`. Let backends serialize.

**Files**: `src/types/tools.ts`, `src/types/json.ts`

**Priority**: HIGH (Tier 1)

---

#### IMP-04: ToolDefinitionLike Type Missing (F-008)

**Evidence**: No `ToolDefinitionLike` type exists. Consumers using different Zod versions or returning non-JSONValue fail type checking.

**Remediation**: Export `ToolDefinitionLike` accepting `z.ZodType<any> | Record<string, unknown>` and `execute: (...) => Promise<unknown>`. Accept in `ChatRuntime.registerTool()`.

**Files**: `src/types/tools.ts`, `src/chat/runtime.ts`

**Priority**: HIGH — depends on IMP-03.

---

#### IMP-05: useSSE Doesn't Support POST (F-041)

**Evidence**: `UseSSEOptions` has no `method` or `body` fields. Uses GET-only `fetch()`.

**Remediation**: Add `method?: string` and `body?: string | Record<string, unknown>` to `UseSSEOptions`.

**Files**: `src/chat/react/useSSE.ts`

**Priority**: MEDIUM

---

### Documentation — Still Open

#### IMP-06: No Server Quickstart Guide (F-032)

**Evidence**: `docs/chat-sdk/server-quickstart.md` does not exist. Server-only consumers have no clear starting point.

**Remediation**: Create quickstart with minimal `createChatServer` setup (~20 lines), Express adapter example, auth handler setup.

**Files**: `docs/chat-sdk/server-quickstart.md` (new)

**Priority**: HIGH

---

#### IMP-07: WritableResponse Compatibility Underdocumented (F-033)

**Evidence**: One-line mention in docs. No dedicated framework compatibility section.

**Remediation**: Add "Framework Compatibility" section to `docs/chat-sdk/README.md`.

**Priority**: LOW

---

#### IMP-08: ChatSessionMetadata Required Fields Undocumented (F-035)

**Evidence**: No JSDoc on `ChatSessionMetadata` fields in types.ts.

**Remediation**: Add JSDoc documenting required fields and defaults.

**Files**: `src/chat/types.ts`

**Priority**: LOW

---

#### IMP-09: fromAgentMessage() Not Discoverable (F-034)

**Evidence**: No `ChatMessage.fromText()` convenience factory. Only standalone `fromAgentMessage()` in conversion.ts.

**Remediation**: Add `createTextMessage(role, text)` factory. Document message conversion in README.

**Files**: `src/chat/conversion.ts`, `docs/chat-sdk/README.md`

**Priority**: LOW

---

#### IMP-10: useAuth Removal (F-037) — ✅ RESOLVED

`useAuth` has been removed from the codebase. `useRemoteAuth` is the only auth hook.

---

### Infrastructure — Still Open

#### IMP-11: No SQLite Schema Versioning (F-036)

**Evidence**: No `SCHEMA_VERSION` constant in sqlite module. Tables use `CREATE TABLE IF NOT EXISTS` pattern — no incremental migration.

**Current approach**: Schema is auto-created on store construction. This works for initial deployments but provides no migration path when schema evolves.

**Remediation**: Document current approach. Add `SCHEMA_VERSION` and `migrate()` when schema changes are needed.

**Priority**: LOW (no schema changes planned)

---

### Strategic Concern

#### IMP-12: Chat SDK Adoption — Only Demo Uses It (ITEM-72)

**Evidence**: Only internal demo uses Chat SDK. Real consumer (claude-supervisor) uses agent abstraction layer only (1400+ lines of glue). Consumer satisfaction: Chat SDK 4/10 overall.

**Impact**: Chat SDK may not serve real consumer needs (multi-user NATS, permission supervision, custom event routing).

**Remediation**: Add extension points: pluggable session manager, optional middleware, custom transport factories. Document agent-layer-only usage as first-class pattern.

**Priority**: STRATEGIC — affects SDK direction.

---

## Summary

| Status | Count |
|--------|-------|
| Resolved stateful violations | 7 (STAT-01 through STAT-07) |
| Resolved gaps | 6 (Gap 1–6) |
| Resolved documentation | 1 (IMP-10) |
| Open — API Surface | 3 (IMP-03, IMP-04, IMP-05) |
| Open — Documentation | 4 (IMP-06 through IMP-09) |
| Open — Infrastructure | 1 (IMP-11, LOW) |
| Strategic | 1 (IMP-12) |
| **Total open** | **9** |

Source: [SDK Feedback Audit — All Items](../../moira-ws/sdk-feedback-audit-20260227-2101/all-items.md) (78 items), [Action Plan](../../moira-ws/sdk-feedback-audit-20250301-0700/step-4/action-plan.md) (27 findings, Tiers 1–4).
