---
title: Architecture Overview
project: "@witqq/agent-sdk"
arc42_sections: "1-4, 8, 10"
---

# Architecture Overview

## Core Principle: STATELESS

The SDK follows a **stateless architecture**: all data required to handle a request (model, backend, credentials, tools) flows through the call chain per-request. No mutable routing state is stored inside runtime, handler, or adapter layers.

### Where State IS Acceptable

| Location | Kind | Why |
|----------|------|-----|
| **Client (RemoteChatClient, React hooks)** | UI state: `activeSessionId`, `selectedProviderId` | Client owns user intent — which session is open, which provider is selected |
| **CLI subprocess pool (adapter internals)** | Resource pool: `_agent`, `_agentService` | Process management, not routing. Pool key includes credentials hash. |
| **Session persistence store** | Data store: `IChatSessionStore`, `IProviderStore`, `ITokenStore` | Explicit database — designed for persistence |
| **Runtime tool registry** | Configuration: `_tools Map` | Immutable-in-spirit; tools are registered once at startup, rarely changed |

### Where State MUST NOT Live

| Location | What Must Not Be There | Why |
|----------|----------------------|-----|
| **Server handler closure** | `currentModel`, `currentBackend` | Race condition in multi-user; request A's model bleeds to request B |
| **Runtime fields** | `session.config.model` writeback, `session.config.backend` writeback | Creates feedback loop — send() writes state that later reads pick up |
| **Adapter fields** | `_cachedModel`, `_toolsOverride` | Model and tools are per-request, not per-adapter-instance |
| **Runtime** | `_activeSessionId` | Client-only concern; server has no "active session" |

## 1. Introduction and Goals

**@witqq/agent-sdk** is a TypeScript npm package providing a unified abstraction layer over three AI agent backends: GitHub Copilot CLI, Anthropic Claude CLI, and Vercel AI SDK v6.

### Key Goals

1. **Unified API** — Single interface for run/stream/structured output across all backends
2. **Chat SDK** — Higher-level chat abstractions with sessions, streaming, React components
3. **Type Safety** — TypeScript strict mode, branded types, discriminated unions
4. **Tree-Shaking** — Separate entry points per backend, optional peer dependencies
5. **Stateless Server** — Per-request data flow; no shared mutable state on server

### Stakeholders

| Role | Concern |
|------|---------|
| SDK Consumer (Developer) | API ergonomics, type safety, bundle size |
| End User (Browser) | Responsive streaming, provider switching |
| SDK Maintainer | Maintainability, test coverage, documentation accuracy |

## 2. Constraints

- **Runtime**: Node.js 22+ (server), Browser (client via RemoteChatClient)
- **Backends**: Copilot and Claude require CLI subprocess; Vercel AI uses HTTP API
- **Auth**: Copilot = GitHub Device Flow, Claude = OAuth+PKCE, Vercel AI = API key
- **Peer deps**: zod (^3.23 || ^4), backend SDKs optional, React optional, better-sqlite3 optional
- **Build**: tsup → ESM + CJS + DTS, 21 entry points

## 3. Three-Actor Data Flow

```
Client (state keeper)          Server Handler (stateless router)
┌──────────────────────┐       ┌──────────────────────────────┐
│ selectedProviderId   │──────>│ resolveRequestContext()      │
│ activeSessionId      │       │   providerId → {backend,     │
│ UI state (React)     │       │     credentials, model}      │
└──────────────────────┘       │                              │
                               │ No closure state.            │
                               │ Each request self-contained. │
                               └──────────────┬───────────────┘
                                              │
                               Runtime (stateless orchestrator)
                               ┌──────────────┴───────────────┐
                               │ send(sessionId, message, {   │
                               │   model, backend, credentials│
                               │ })                           │
                               │                              │
                               │ All 3 are REQUIRED.          │
                               │ Nothing read from fields.    │
                               └──────────────┬───────────────┘
                                              │
                               Adapter Pool (resource pool)
                               ┌──────────────┴───────────────┐
                               │ Key: backend + credential    │
                               │ hash                         │
                               │ Caches CLI subprocess only.  │
                               │ Model passed per-call via    │
                               │ RunOptions.                  │
                               └──────────────────────────────┘
```

### Per-Request Data Flow

Every `/send` request carries ALL necessary context. No server-side defaults, no fallbacks:

1. **Client** sends `{ sessionId, message, providerId }`
2. **Handler** calls `resolveRequestContext(providerId, { providerStore, tokenStore })` → `{ backend, credentials, model }`
3. **Handler** passes `RuntimeSendOptions { model, backend, credentials }` to `runtime.send()`
4. **Runtime** validates all 3 are present (throws `INVALID_INPUT` if missing)
5. **Runtime** calls `getOrCreateAdapter(backend, credentials)` — pool key is `backend:credentialHash`
6. **Adapter** passes `model` to agent via `RunOptions.model`

At no point does any layer read model/backend/credentials from its own fields.

## 4. Solution Strategy

### Architecture Style
Library with modular entry points. Not a deployed service — consumed as npm package.

### Key Decisions
- Independent sibling interfaces ([ADR-0001](./adr/0001-independent-sibling-interfaces.md))
- Stateless runtime ([ADR-0002](./adr/0002-stateless-runtime.md))
- CLI subprocess backends ([ADR-0003](./adr/0003-cli-subprocess-backends.md))
- Server-mediated auth ([ADR-0004](./adr/0004-server-mediated-auth.md))

### Module Structure
11 bounded contexts organized by dependency direction. See [Container Diagram](./container-diagram.md) and [Bounded Context Map](./bounded-context-map.md).

## 8. Crosscutting Concepts

| Concern | Approach |
|---------|----------|
| **State Management** | Client is state keeper; server is stateless. Per-request context resolution via `resolveRequestContext()`. See [Crosscutting Concerns](./crosscutting-concerns.md). |
| Authentication | Server-side OAuth via createAuthHandler; browser uses useRemoteAuth |
| Error Handling | AgentSDKError → ChatError (20 codes); classifyError(); ExponentialBackoff |
| Validation | Zod peer dep; zodToJsonSchema(); runtime state machine transitions |
| Configuration | Programmatic objects (no env vars in library) |
| Logging | N/A for library; consumers use ChatMiddleware hooks |
| Package Distribution | tsup ESM+CJS+DTS; 21 exports ([ADR-0005](./adr/0005-granular-package-exports.md)); tree-shaking; optional peer deps |
| Type System | strict:true; branded ChatId; discriminated unions; generics |
| API Evolution | Strict semver; @deprecated → removal in next major; CHANGELOG.md |
| Monitoring | Health endpoint only; consumers add metrics via middleware |

## 10. Quality Requirements

Top 3 priorities:
1. **Developer Experience (DX)** — API ergonomics, documentation accuracy, minimal boilerplate
2. **Reliability (API Stability)** — Zero breaking changes between minor versions; stateless design eliminates race conditions
3. **Portability** — Run on Node.js, browser, Deno, Bun without code changes

See [Quality Attributes](./quality-attributes.md) for 6 measurable scenarios.
