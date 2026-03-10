---
title: "API Reference"
description: "Auto-generated API reference for all public exports"
sidebar:
  order: 0
---

Auto-generated from TypeScript source using [TypeDoc](https://typedoc.org/). Every public type, function, class, and interface is documented with signatures, parameters, and return types.

## Entry Points

### Core

| Module | Import Path | Description |
|--------|-------------|-------------|
| [Core Exports](/api-reference/core/) | `@witqq/agent-sdk` | Types, errors, registry, `createAgentService` |
| [Auth](/api-reference/auth/) | `@witqq/agent-sdk/auth` | Authentication tokens, providers, OAuth |
| [Testing](/api-reference/testing/) | `@witqq/agent-sdk/testing` | `createMockAgentService`, test helpers |

### Backends

| Module | Import Path | Description |
|--------|-------------|-------------|
| [Copilot](/api-reference/backends/copilot/) | `@witqq/agent-sdk/copilot` | GitHub Copilot CLI backend |
| [Claude](/api-reference/backends/claude/) | `@witqq/agent-sdk/claude` | Claude CLI backend |
| [Vercel AI](/api-reference/backends/vercel-ai/) | `@witqq/agent-sdk/vercel-ai` | Vercel AI SDK backend |
| [Mock LLM](/api-reference/backends/mock-llm/) | `@witqq/agent-sdk/mock-llm` | Mock backend for testing |

### Chat SDK

| Module | Import Path | Description |
|--------|-------------|-------------|
| [Chat Exports](/api-reference/chat/index-exports/) | `@witqq/agent-sdk/chat` | All re-exports |
| [Runtime](/api-reference/chat/runtime/) | `@witqq/agent-sdk/chat/runtime` | `createChatRuntime`, adapter factories |
| [Server](/api-reference/chat/server/) | `@witqq/agent-sdk/chat/server` | HTTP handler, auth middleware |
| [React](/api-reference/chat/react/) | `@witqq/agent-sdk/chat/react` | Components, hooks, client |
| [Core Types](/api-reference/chat/core/) | `@witqq/agent-sdk/chat/core` | Messages, sessions, options |
| [Events](/api-reference/chat/events/) | `@witqq/agent-sdk/chat/events` | Streaming event types |
| [Sessions](/api-reference/chat/sessions/) | `@witqq/agent-sdk/chat/sessions` | Session store interfaces |
| [Storage](/api-reference/chat/storage/) | `@witqq/agent-sdk/chat/storage` | Persistent storage interfaces |
| [SQLite](/api-reference/chat/sqlite/) | `@witqq/agent-sdk/chat/sqlite` | SQLite storage implementation |
| [Backends](/api-reference/chat/backends/) | `@witqq/agent-sdk/chat/backends` | Backend adapter interfaces |
| [Errors](/api-reference/chat/errors/) | `@witqq/agent-sdk/chat/errors` | Chat-specific error types |
| [State](/api-reference/chat/state/) | `@witqq/agent-sdk/chat/state` | Reactive state management |
| [Context](/api-reference/chat/context/) | `@witqq/agent-sdk/chat/context` | Context accumulation |
| [Accumulator](/api-reference/chat/accumulator/) | `@witqq/agent-sdk/chat/accumulator` | Event accumulator |

## Regenerating

```bash
npm run docs:api                                      # Generate markdown to packages/sdk/docs/api/
node packages/docs-site/scripts/sync-api-docs.mjs     # Sync into Starlight
npm run docs:site                                      # Rebuild site
```
