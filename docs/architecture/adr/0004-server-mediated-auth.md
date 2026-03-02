---
title: "ADR-0004: Use server-mediated authentication instead of direct browser auth"
status: accepted
---

# ADR-0004: Use server-mediated authentication instead of direct browser auth

## Status
Accepted

## Context
- CopilotAuth uses `node:crypto` for Device Flow code generation
- ClaudeAuth uses `node:crypto` for PKCE challenge generation
- `node:crypto` is not available in browser environments
- React components need to trigger auth flows
- Quality attributes affected: Security (credential handling), Browser compatibility, Bundle size

## Decision
All authentication flows execute on the server. The browser uses `useRemoteAuth` hook which communicates with `createAuthHandler` endpoints via HTTP. Auth classes (CopilotAuth, ClaudeAuth) are never imported in browser bundles.

## Options Considered

### Option 1: Direct browser auth with Web Crypto API polyfill
- Pros: No server required; simpler architecture; works offline
- Cons: Exposes OAuth client secrets in browser bundle; Web Crypto API differences; larger bundle; CORS issues with provider endpoints

### Option 2: Server-mediated auth (CHOSEN)
- Pros: Credentials never leave server; `node:crypto` works natively; smaller browser bundle; server can validate/store tokens securely; single token store
- Cons: Requires running server; extra HTTP round-trips; server becomes auth bottleneck

## Consequences
- Positive: Zero `node:crypto` in browser bundle — no polyfill needed
- Positive: OAuth client secrets stay on server
- Positive: Unified token storage via ITokenStore on server
- Negative: Auth requires server — no standalone browser-only mode
- Negative: Extra latency for auth round-trips (acceptable — auth is infrequent)
- Risk: Server token store compromise exposes all user tokens (mitigated by per-provider isolation)

## Related
- [ADR-0003](./0003-cli-subprocess-backends.md) — CLI backends already require server
- [Gap #6](../risks-and-debt.md) — node:crypto in auth (this ADR documents the mitigation)
