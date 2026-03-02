---
title: "ADR-0001: Use independent sibling interfaces for client and runtime"
status: accepted
---

# ADR-0001: Use independent sibling interfaces for client and runtime

## Status
Accepted

## Context
- The SDK serves two distinct consumers: browser-side React apps (via RemoteChatClient) and server-side orchestration (via ChatRuntime)
- Both need session CRUD, messaging, and lifecycle management
- `send()` has fundamentally different signatures: client sends optional `SendMessageOptions` (providerId for server resolution), runtime requires `RuntimeSendOptions` (backend, model, credentials — all mandatory)
- Server runtime needs tools, middleware, context trimming; client needs provider CRUD and selection
- Quality attributes affected: Type Safety, Developer Experience, Maintainability

## Decision
IChatClient and IChatRuntime are independent sibling interfaces with NO shared base type. They share structural similarities in session methods but diverge on messaging, discovery, and capabilities.

## Options Considered

### Option 1: Shared IChatBase + extension interfaces
- Pros: DRY — shared methods defined once; union type simplifies generic consumers
- Cons: Forces identical `send()` signature or requires overloads; couples client to server concerns via base; leaky abstraction (clients see server methods they can't use)

### Option 2: Independent sibling interfaces (CHOSEN)
- Pros: Each interface is self-contained with exact contract; `send()` signatures differ naturally; no coupling; consumers import only what they need
- Cons: ~15 lines of method signature duplication (session CRUD, lifecycle); changes to shared-concept methods require updating both interfaces

### Option 3: Single unified interface with optional methods
- Pros: One type to learn; simple
- Cons: Optional methods everywhere; runtime checks needed; no compile-time safety; "God interface" anti-pattern

## Consequences
- Positive: Perfect type safety — `send()` in client context requires different args than server context, caught at compile time
- Positive: React layer only sees IChatClient, cannot accidentally call server-only methods
- Negative: ~15 lines of duplicated method signatures across both interfaces
- Negative: Listener patterns (onSessionChange) implemented independently in both ChatRuntime and RemoteChatClient — mitigated by `ListenerSet<T>` utility extraction
- Risk: If shared methods diverge accidentally, no compiler warning (mitigated by test coverage)

## Related
- [ADR-0002](./0002-stateless-runtime.md) — Stateless runtime (different send signatures are a consequence)
- [Gap #3](../risks-and-debt.md) — Listener duplication (direct consequence of this decision)
