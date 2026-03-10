# @witqq/agent-sdk

Universal AI agent abstraction layer for Node.js. Write agent code once — run on GitHub Copilot CLI, Claude CLI, Vercel AI SDK, or Mock LLM for testing.

[![npm](https://img.shields.io/npm/v/@witqq/agent-sdk.svg)](https://www.npmjs.com/package/@witqq/agent-sdk)
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
| npm package size | 7.4 MB unpacked (151 files, ESM + CJS + DTS) |
| Entry points | 22 (tree-shakeable — import only what you need) |
| Unit tests | 2,498 (77 files) |
| Backends | 4 (Copilot, Claude, Vercel AI, Mock LLM) |
| Zod compatibility | v3.23+ and v4.x |
| Peer dependencies | All optional — install only what you use |

## Development

```bash
npm install          # Install all workspace dependencies
npm run build        # Build SDK (tsup → ESM + CJS + DTS)
npm run test         # Unit tests (Vitest)
npm run typecheck    # TypeScript strict mode (tsc --noEmit)
npm run demo         # Build & start demo in Docker (port 3456)
npm run demo -- stop # Stop demo container
```

## Documentation

Full documentation at **[agent-sdk.witqq.dev](https://agent-sdk.witqq.dev)** — getting started, backend guides, tools & permissions, streaming, auth, storage, testing, Chat SDK, and API reference.

## License

[MIT](https://github.com/witqq/agent-sdk/blob/master/LICENSE)

## Links

- **npm**: [npmjs.com/package/@witqq/agent-sdk](https://www.npmjs.com/package/@witqq/agent-sdk)
- **Docs**: [agent-sdk.witqq.dev](https://agent-sdk.witqq.dev)
- **GitHub**: [github.com/witqq/agent-sdk](https://github.com/witqq/agent-sdk)
- **Issues**: [github.com/witqq/agent-sdk/issues](https://github.com/witqq/agent-sdk/issues)
