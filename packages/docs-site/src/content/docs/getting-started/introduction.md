---
title: "Introduction"
sidebar:
  order: 1
description: "What is @witqq/agent-sdk and why use it"
---

`@witqq/agent-sdk` is a TypeScript abstraction layer for building AI agent applications. It provides a unified interface across four AI backends:

- **Copilot CLI** — GitHub Copilot's CLI-based agent runtime
- **Claude CLI** — Anthropic's Claude CLI-based agent runtime
- **Vercel AI** — API-based backend via Vercel AI SDK
- **Mock LLM** — Deterministic backend for automated testing

## Key Concepts

**CLI backends** (Copilot, Claude) spawn a CLI subprocess that drives the tool loop. The CLI decides when to call tools and when to respond. You provide tool definitions and the SDK handles communication.

**API backends** (Vercel AI) make HTTP calls to model providers. The SDK drives the tool loop via `generateText()` / `streamText()`. You have more control but manage the conversation loop yourself.

**Mock LLM** extends `BaseAgent` like real backends. It participates in the full lifecycle — retry, heartbeat, activity timeout, middleware, and usage enrichment. No API keys needed.

## Architecture

```
Your App
  └── IAgentService (createAgentService / createMockLLMService)
        └── IAgent (run, stream, runStructured, abort, dispose, …)
              └── BaseAgent (shared logic)
                    └── Backend-specific execution
```

Every backend implements `IAgentService` — its `createAgent()` method produces `IAgent` instances. `IAgent` exposes `run()`, `stream()`, and `runStructured()`. The `BaseAgent` abstract class provides shared functionality — state management, usage tracking, middleware pipeline.

## What's in the SDK

| Area | What You Get |
|------|-------------|
| Backends | 4 backends with identical `IAgentService` / `IAgent` interfaces |
| Tools | Type-safe tool definitions with Zod schemas, permission scoping |
| Streaming | 15 typed event types via `AsyncIterable<AgentEvent>` |
| Auth | Backend-specific auth helpers, token refresh |
| Storage | SQLite-based chat storage, provider config management |
| Testing | Mock LLM backend, mock factories, test utilities |
| Chat UI | React components for chat interfaces (separate entry point) |
