# @witqq/agent-sdk

Universal AI agent abstraction layer for Node.js. Write agent code once — run on GitHub Copilot CLI, Claude CLI, Vercel AI SDK, or Mock LLM for testing.

[![npm](https://img.shields.io/npm/v/@witqq/agent-sdk.svg)](https://www.npmjs.com/package/@witqq/agent-sdk)
[![CI](https://github.com/witqq/agent-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/witqq/agent-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

```bash
npm install @witqq/agent-sdk
```

```typescript
import { createAgentService } from '@witqq/agent-sdk';
import { z } from 'zod';

const service = await createAgentService('copilot', {});
const agent = service.createAgent({
  systemPrompt: 'You are a helpful assistant.',
  tools: [{
    name: 'greet',
    description: 'Greet a user by name',
    parameters: z.object({ name: z.string() }),
    execute: async ({ name }) => `Hello, ${name}!`,
  }],
});

const response = await agent.run('Say hello to Alice', { model: 'gpt-4o' });
```

## Packages

| Package | Path | Description |
|---------|------|-------------|
| [`@witqq/agent-sdk`](packages/sdk/) | `packages/sdk/` | Core SDK — backends, tools, streaming, auth, storage, testing, chat. 22 entry points. |
| [`agent-sdk-demo`](packages/demo/) | `packages/demo/` | Full-stack demo: Express server + React chat UI. Docker-ready. |
| [`docs-site`](packages/docs-site/) | `packages/docs-site/` | Astro/Starlight documentation site. Deployed at [agent-sdk.witqq.dev](https://agent-sdk.witqq.dev). |

## Backend Decision Tree

```text
Which backend should I use?
├── Building a GitHub Copilot extension?  → CopilotBackend   (import from /copilot)
├── Building a Claude CLI tool?           → ClaudeBackend     (import from /claude)
├── Building an API-driven agent?         → VercelAIBackend   (import from /vercel-ai)
│   └── Works with any OpenAI-compatible provider via @ai-sdk/openai-compatible
└── Writing tests?                        → MockLLMBackend    (import from /mock-llm)
    └── Deterministic responses, tool simulation, no API calls
```

## Feature Matrix

| Feature | Copilot | Claude | Vercel AI | Mock LLM |
|---------|:-------:|:------:|:---------:|:--------:|
| Text generation | + | + | + | + |
| Tool calling | + | + | + | + |
| Streaming | + | + | + | + |
| Structured output (Zod) | + | + | + | + |
| Multi-turn conversations | + | + | + | + |
| Model selection | + | + | + | + |
| Permission system | + | — | — | + |
| Confirmations | + | + | — | + |
| References (files, URLs) | + | — | — | — |
| Token counting | — | + | + | + |
| Chat SDK (React UI) | + | + | + | + |

## Architecture

```text
┌─────────────────────────────────────────────────┐
│                  Your Agent Code                 │
│         (tools, prompts, business logic)         │
├─────────────────────────────────────────────────┤
│              @witqq/agent-sdk                    │
│  ┌──────────┬──────────┬──────────┬───────────┐ │
│  │ Copilot  │  Claude  │ Vercel   │ Mock LLM  │ │
│  │ Backend  │  Backend │ AI Back. │ Backend   │ │
│  └──────────┴──────────┴──────────┴───────────┘ │
│  ┌──────────┬──────────┬──────────┬───────────┐ │
│  │  Tools   │ Streaming│   Auth   │  Storage  │ │
│  │  System  │ & Events │  Layer   │  Layer    │ │
│  └──────────┴──────────┴──────────┴───────────┘ │
│  ┌────────────────────────────────────────────┐  │
│  │           Chat SDK (React UI)              │  │
│  │   Server · Transport · Sessions · State    │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**CLI Backends** (Copilot, Claude) — the CLI runtime drives the tool loop. Your code registers tools and the CLI decides when to call them.

**API Backends** (Vercel AI) — your code drives the tool loop via `generateText()`. Full control over model, provider, and request lifecycle.

**Mock LLM** — deterministic backend for testing. Simulates responses, tool calls, streaming, confirmations, and permissions without any API calls.

## Vercel AI Conversation Contract

The Vercel AI backend targets AI SDK 7. Supply public SDK `Message[]` to `runWithContext()` or `streamWithContext()`, retaining assistant `toolCalls` and matching `toolResults` with the same call ID and tool name. String, JSON and `isError` results are converted to native tool content parts without mutating caller history.

Set `modelParams.maxTokens` to cap generated output on blocking, structured and streaming calls. Token usage comes from native responses; provider-reported cost and cached tokens remain optional. Streaming usage snapshots are cumulative within a run.

Use `AgentSDKError.is(error)` to inspect errors across bundled entry points. A native prompt rejection before model dispatch has `code: "INVALID_INPUT"`, `retryable: false`, `providerRequestSent: false` and its native `cause`. An undefined `providerRequestSent` leaves provider effects unknown; provider errors after dispatch, network failures, timeouts and aborts provide no unsent proof. Catch streaming refusals around async iteration. See the [backend guide](https://agent-sdk.witqq.dev/backends/overview/) for a history example and error guidance.

The Vercel AI backend validates declared tool arguments before execution. Streaming tool errors can include `localToolRefusal` for a correlated native parse refusal; this proves only that tool call had no execution and does not make the paid model request unsent or authorize replay. `tool_call_start.args` is optional: retain missing input as missing and actual null as null. See the [streaming guide](https://agent-sdk.witqq.dev/streaming/streaming-and-events/#local-tool-refusals-and-argument-presence) for the `LocalToolRefusal` contract.


## Entry Points

| Import | Purpose |
|--------|---------|
| `@witqq/agent-sdk` | Core types, `createAgentService`, `AgentSDKError` hierarchy |
| `@witqq/agent-sdk/copilot` | `CopilotBackend` — GitHub Copilot CLI integration |
| `@witqq/agent-sdk/claude` | `ClaudeBackend` — Anthropic Claude CLI integration |
| `@witqq/agent-sdk/vercel-ai` | `VercelAIBackend` — Vercel AI SDK / OpenRouter |
| `@witqq/agent-sdk/mock-llm` | `MockLLMBackend` — deterministic testing backend |
| `@witqq/agent-sdk/testing` | Test utilities, mock factories, assertions |
| `@witqq/agent-sdk/auth` | Auth providers (GitHub OAuth, token-based) |
| `@witqq/agent-sdk/chat` | Chat SDK — full-stack React chat with sessions |
| `@witqq/agent-sdk/chat/server` | `ChatServer` — Express/HTTP server with SSE streaming |
| `@witqq/agent-sdk/chat/react` | `<ChatProvider>`, `<ChatWindow>`, hooks, theming |
| `@witqq/agent-sdk/chat/sessions` | Session management, history, persistence |
| `@witqq/agent-sdk/chat/sqlite` | SQLite storage adapter for chat sessions |
| `@witqq/agent-sdk/chat/storage` | Storage interface and in-memory adapter |

Additional chat sub-entry points: `chat/core`, `chat/errors`, `chat/events`, `chat/context`, `chat/accumulator`, `chat/state`, `chat/backends`, `chat/runtime`, `chat/react/theme.css`.

## Project Stats

| Metric | Value |
|--------|-------|
| npm package size | ~747 kB tarball / ~3.45 MB unpacked (254 files, ESM + CJS + DTS) |
| Entry points | 22 (tree-shakeable — import only what you need) |
| Unit tests | Default Vitest suite — `npm test` |
| Backends | 4 (Copilot, Claude, Vercel AI, Mock LLM) |
| Zod compatibility | v3.23+ and v4.x |
| Peer dependencies | `zod` required; backend, UI, and storage peers optional |

## Development

Node.js 24.20.0 or newer and npm 12.0.2 are required.

```bash
npm ci               # Install all workspace dependencies from the lockfile
npm run build        # Build SDK (tsdown → ESM + CJS + DTS)
npm run install:demo-frontend # Install the nested demo frontend from its lockfile
npm run build:demo-frontend   # Build the demo output required by its contract tests
npm run test         # Unit tests (Vitest)
npm run typecheck    # TypeScript strict mode (tsc --noEmit)
npm run verify       # Complete CI and exact-package release gate
npm run demo         # Build & start demo in Docker (port 3456)
npm run demo -- stop # Stop demo container
```

## Documentation

Full documentation at **[agent-sdk.witqq.dev](https://agent-sdk.witqq.dev)** — getting started, backend guides, tools & permissions, streaming, auth, storage, testing, Chat SDK, and API reference.

Release operators follow [`docs/RELEASE.md`](docs/RELEASE.md). npm publication uses one accepted GitHub Release tarball and GitHub Actions trusted publishing; it does not rebuild package bytes or require an `NPM_TOKEN` secret.

## License

[MIT](LICENSE)

## Links

- **npm**: [npmjs.com/package/@witqq/agent-sdk](https://www.npmjs.com/package/@witqq/agent-sdk)
- **Docs**: [agent-sdk.witqq.dev](https://agent-sdk.witqq.dev)
- **GitHub**: [github.com/witqq/agent-sdk](https://github.com/witqq/agent-sdk)
- **Issues**: [github.com/witqq/agent-sdk/issues](https://github.com/witqq/agent-sdk/issues)
