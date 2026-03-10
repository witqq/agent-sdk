---
title: "ADR-0003: Use CLI subprocess backends for Copilot and Claude"
status: accepted
---

# ADR-0003: Use CLI subprocess backends for Copilot and Claude

## Status
Accepted

## Context
- GitHub Copilot and Anthropic Claude provide CLI tools with built-in tool-calling loops
- CLI SDKs handle authentication, conversation management, and tool execution autonomously
- Direct API access requires separate API keys and doesn't provide the same tool-calling capabilities
- Quality attributes affected: Feature completeness, Authentication simplicity, Dependency management

## Decision
Copilot and Claude backends wrap their CLI SDKs as optional peer dependencies. The CLI SDKs spawn subprocesses and ARE the agent runtime. The SDK bridges CLI events to the unified AgentEvent/ChatEvent stream. Vercel AI backend uses direct HTTP API calls.

## Options Considered

### Option 1: Direct API calls for all backends
- Pros: Uniform architecture; no subprocess management; simpler deployment
- Cons: Copilot has no public API (CLI only); Claude API lacks CLI-level tool orchestration; must reimplement tool-calling loop; separate API key management

### Option 2: CLI subprocess delegation (CHOSEN)
- Pros: Full feature parity with native CLIs; authentication handled by CLI; tool-calling loop managed by CLI; immediate access to new CLI features
- Cons: Subprocess overhead; CLI must be installed; error handling more complex; testing requires mock SDKs

### Option 3: Hybrid — CLI for auth, API for messaging
- Pros: Best of both worlds theoretically
- Cons: Complex dual-path architecture; auth token extraction from CLI is fragile; maintaining two paths per backend doubles maintenance

## Consequences
- Positive: Copilot backend works with existing GitHub auth (no separate API key)
- Positive: Claude backend gets full MCP tool support from CLI
- Positive: New CLI features (reasoning, artifacts) available immediately via event bridging
- Negative: CLI SDKs are optional peer deps — installation errors if missing
- Negative: Testing requires mock injection pattern (_injectSDK/_resetSDK)
- Risk: CLI SDK breaking changes require SDK updates

## Related
- [ADR-0002](./0002-stateless-runtime.md) — Per-call resolution aligns with subprocess lifecycle
- [ADR-0004](./0004-server-mediated-auth.md) — Server-mediated auth avoids exposing CLI auth to browser
