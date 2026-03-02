---
title: "ADR-0002: Use stateless runtime with per-call model resolution"
status: accepted
---

# ADR-0002: Use stateless runtime with per-call model resolution

## Status
Accepted

## Context
- Users can switch between multiple AI providers (Copilot, Claude, OpenRouter) mid-conversation
- Each provider requires different credentials and supports different models
- Server handler manages provider configuration and resolves credentials
- Quality attributes affected: Security (credential isolation), Flexibility (hot-switching), Testability

## Decision
ChatRuntime is stateless — it does NOT store current model, backend, or credentials. Every `send()` call receives all three as required parameters via `RuntimeSendOptions`. The server handler (createChatHandler) resolves provider → {backend, model, credentials} before calling runtime.

## Options Considered

### Option 1: Runtime stores active model/backend
- Pros: Simpler `send()` signature; switchModel()/switchBackend() methods feel natural
- Cons: Stale state bugs (model changed but runtime not notified); credential storage in runtime (security risk); concurrent requests may conflict; harder to test (stateful)

### Option 2: Stateless runtime with per-call resolution (CHOSEN)
- Pros: No stale state possible; credentials never stored in runtime; concurrent requests safe (each carries own context); trivially testable
- Cons: Verbose `send()` signature; server handler must resolve on every call; no "current model" concept at runtime level

### Option 3: Context object pattern (request-scoped container)
- Pros: Clean API; all resolution in one place
- Cons: Over-engineering for current needs; extra abstraction layer; same benefits as Option 2 with more complexity

## Consequences
- Positive: Zero stale-state bugs — impossible to send with wrong model/credentials
- Positive: Credentials are transient (exist only during call, never stored)
- Positive: Concurrent multi-provider usage is safe by design
- Negative: Server handler has more responsibility (resolves provider on every request)
- Negative: Handler-managed closure state for "current model" (not in runtime)
- Risk: If handler resolution fails, error messages may be confusing

## Related
- [ADR-0001](./0001-independent-sibling-interfaces.md) — Different send() signatures are consequence of this
- [ADR-0003](./0003-cli-subprocess-backends.md) — CLI backends are subprocess-based, making per-call resolution natural
