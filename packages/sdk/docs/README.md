# Documentation

## Getting Started

New to the SDK? Start here.

→ [Getting Started Guide](getting-started.md)

## Backends

Setup, configuration, and feature comparison for all four backends.

→ [Backends Guide](backends.md)

## Feature Guides

- [Tools and Permissions](tools-and-permissions.md) — tool declarations, permission scopes, supervisor hooks
- [Streaming and Events](streaming-and-events.md) — 15 event types, middleware, abort handling
- [Authentication](auth.md) — Copilot device flow, Claude OAuth, Vercel API keys, token refresh
- [Storage](storage.md) — IStorageAdapter, session stores, InMemory/File/SQLite implementations
- [Testing](testing.md) — all mock factories, unit/integration/component patterns

## Mock LLM

Deterministic testing backend — response modes, tool simulation, structured output.

→ [Mock LLM Guide](mock-llm.md)

## API Reference

Auto-generated from source using TypeDoc. Regenerate with `npm run docs:api`.

→ [API Reference](api/README.md)

## Architecture

Detailed architecture reference including C4 diagrams, ADRs, API surface, and quality attributes.

→ [Architecture Index](architecture/INDEX.md)

Key documents:
- [API Surface & Exports](architecture/api-surface.md) — all package entry points
- [Architecture Overview](architecture/overview.md) — system layers and design

## Chat SDK

Complete guide to the higher-level Chat SDK module: runtime, sessions, backends, React bindings, server utilities.

→ [Chat SDK Guide](chat-sdk/README.md)

## Examples

Demo application and standalone code patterns.

→ [Examples Guide](../examples/README.md)
