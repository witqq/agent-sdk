# Backends

Four backends implement `IAgentService`. CLI backends (Copilot, Claude) spawn a subprocess — the CLI drives the tool loop. API backends (Vercel AI) make HTTP calls — the SDK drives the tool loop. Mock LLM is built-in for testing.

## Feature Matrix

| Feature | Copilot | Claude | Vercel AI | Mock LLM |
|---------|---------|--------|-----------|----------|
| `run()` | ✓ | ✓ | ✓ | ✓ |
| `stream()` | ✓ | ✓ | ✓ | ✓ |
| `runStructured()` | ✓ (text extraction) | ✓ (text extraction) | ✓ (`generateObject`) | ✓ (configurable) |
| Persistent sessions | ✓ | ✓ | — | — |
| Tool execution | External (CLI) | External (CLI) | Internal (SDK) | Simulated |
| Permission callbacks | ✓ | ✓ | — | ✓ (configurable) |
| Ask user | ✓ | — | ✓ (injected tool) | — |
| Auth | GitHub Device Flow | OAuth + PKCE | API key | — |
| `listModels()` | ✓ (GitHub API) | ✓ (Anthropic API) | ✓ (provider API) | ✓ (static list) |
| Retry on transient errors | ✓ | ✓ | ✓ | ✓ |
| Heartbeat | ✓ | ✓ | ✓ | ✓ |
| External dependency | `@github/copilot-sdk` | `@anthropic-ai/claude-agent-sdk` | `ai` + `@ai-sdk/openai-compatible` | None |

## Copilot

Wraps `@github/copilot-sdk` — spawns a Node.js subprocess running the Copilot CLI agent.

### Install

```bash
npm install @github/copilot-sdk
```

### Setup

```typescript
import { createCopilotService } from "@witqq/agent-sdk/copilot";

const service = createCopilotService({
  useLoggedInUser: true,           // use GitHub CLI auth (gh auth)
  // OR:
  // githubToken: "ghp_...",       // explicit token
  workingDirectory: process.cwd(), // optional
  cliPath: "/path/to/copilot",    // optional custom CLI path
  cliArgs: ["--allow-all"],        // optional extra CLI flags
  env: { PATH: "/custom/bin" },    // optional env vars for subprocess
});
```

### Notes

- **System requirements:** `@github/copilot-sdk` includes a native binary requiring glibc. Alpine Linux (musl) is not supported — use `node:20-bookworm-slim` or similar.
- **Headless mode:** Without `supervisor.onPermission` / `supervisor.onAskUser`, the backend auto-approves permissions and auto-answers user questions to prevent hanging.
- **System prompt mode:** Default `mode: "append"` adds your prompt to the Copilot built-in prompt. Use `systemMessageMode: "replace"` to fully replace it (removes built-in tool instructions).
- **Available tools filter:** Restrict Copilot built-in tools with `availableTools: ["web_search", "web_fetch"]` in `AgentConfig`.

## Claude

Wraps `@anthropic-ai/claude-agent-sdk` — spawns a subprocess running the Claude CLI agent.

### Install

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Setup

```typescript
import { createClaudeService } from "@witqq/agent-sdk/claude";

const service = createClaudeService({
  workingDirectory: process.cwd(),
  cliPath: "/path/to/claude",     // optional
  maxTurns: 10,                    // optional turn limit
  env: { CLAUDE_CONFIG_DIR: "/custom/config" },
});
```

### Notes

- `supervisor.onAskUser` is **not supported** — a warning is emitted if set.
- When `supervisor.onPermission` is set, the Claude backend automatically sets `permissionMode: "default"` so the CLI invokes the callback instead of using built-in rules.

## Vercel AI

Wraps `ai` SDK with `@ai-sdk/openai-compatible` for OpenRouter, OpenAI, and compatible providers.

### Install

```bash
npm install ai @ai-sdk/openai-compatible
```

### Setup

```typescript
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";

const service = createVercelAIService({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseUrl: "https://openrouter.ai/api/v1", // default
  provider: "openrouter",                   // default
});
```

### Model-Specific Options

Pass provider options via `providerOptions` on `AgentConfig`:

```typescript
const agent = service.createAgent({
  model: "google/gemini-2.0-flash",
  systemPrompt: "Think step by step.",
  providerOptions: {
    google: { thinkingConfig: { thinkingBudget: 1024 } },
  },
});
```

### Cost & Provider Metadata

`providerOptions` is also the supported path for per-provider request extras — e.g. opting into OpenRouter's per-request cost reporting. It reaches `generateText`, `generateObject`, and `streamText` on all paths.

```typescript
const agent = service.createAgent({
  model: "openai/gpt-4.1-mini",
  systemPrompt: "Answer concisely.",
  providerOptions: {
    // OpenRouter: include exact cost + cache details in the response usage
    openrouter: { usage: { include: true } },
  },
});
```

Provider response metadata is surfaced back on `UsageData` (and the `usage` / `usage_update` events). Cost and cached tokens are normalized best-effort when the provider reports them; the untouched raw blob is always available:

```typescript
const result = await agent.run("Hello", { model: "openai/gpt-4.1-mini" });
result.usage?.cost;             // number | undefined — normalized USD cost (e.g. OpenRouter)
result.usage?.cachedTokens;     // number | undefined — prompt tokens served from cache
result.usage?.providerMetadata; // raw provider metadata, untouched
```

Normalization is provider-agnostic and null-safe — providers that report no cost simply leave `cost`/`cachedTokens` undefined while still passing `providerMetadata` through.

### Notes

- Uses `generateText()` for runs, `generateObject()` for structured output, `streamText()` for streaming.
- Supports `supervisor.onAskUser` via an injected `ask_user` tool.
- `finishReason` from the stream `finish` part is propagated to the `done` event.

## Mock LLM

Built-in backend for automated testing. No external dependencies — no API keys, no CLI tools, no network calls. Extends `BaseAgent` for full lifecycle support (retry, heartbeat, middleware, usage enrichment).

### Setup

```typescript
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

const service = createMockLLMService({ mode: { type: "echo" } });
const agent = service.createAgent({ systemPrompt: "Test" });
```

### Response Modes

| Mode | Configuration | Behavior |
|------|--------------|----------|
| Echo | `{ type: "echo" }` | Returns the user's prompt as the response |
| Static | `{ type: "static", response: "text" }` | Always returns the specified response |
| Scripted | `{ type: "scripted", responses: [...], loop?: true }` | Returns responses in sequence. With `loop: true`, cycles back to start; without, repeats last response |
| Error | `{ type: "error", error: "msg", code?: "TIMEOUT", recoverable?: true }` | Throws `AgentSDKError`. Set `recoverable: true` for BaseAgent retry |

### Advanced Capabilities

- **Latency simulation** — `latency: { type: "fixed", ms: 100 }` or `latency: { type: "random", minMs, maxMs }`
- **Streaming control** — `streaming: { chunkSize: 5, chunkDelayMs: 10 }`
- **Permission simulation** — `permissions: { toolNames: ["bash"], autoApprove: true }` or `permissions: { toolNames: ["rm"], denyTools: ["rm"] }`
- **Tool call simulation** — `toolCalls: [{ toolName: "search", args: {...}, result: {...} }]`
- **Structured output** — `structuredOutput: { city: "Paris", country: "France" }`
- **Configurable finishReason** — `finishReason: "stop" | "length" | "tool-calls"`

See [Mock LLM Guide](mock-llm.md) for testing patterns and integration with `createMockAgentService`.

## Switching Backends

All backends share `AgentConfig` and return the same `AgentResult`. Switch by changing only the service creation:

```typescript
import { createAgentService } from "@witqq/agent-sdk";

const config = {
  systemPrompt: "You are a helpful assistant.",
  tools: [searchTool],
};

// Switch backend:
const service = await createAgentService("copilot", { useLoggedInUser: true });
// const service = await createAgentService("claude", { workingDirectory: "." });
// const service = await createAgentService("vercel-ai", { apiKey: "..." });

// Mock LLM — use direct import (not registered in createAgentService):
// import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
// const service = createMockLLMService({ mode: { type: "echo" } });

const agent = service.createAgent(config);
const result = await agent.run("Hello", { model: "gpt-5-mini" });
```

Or use direct backend imports:

```typescript
import { createCopilotService } from "@witqq/agent-sdk/copilot";
import { createClaudeService } from "@witqq/agent-sdk/claude";
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
```

## Model Names

| Backend | Model ID example | Short name |
|---------|-----------------|------------|
| Copilot | `gpt-4o` | (same) |
| Claude | `claude-sonnet-4-5-20250514` | `sonnet` |
| Vercel AI | `anthropic/claude-sonnet-4-5` | (provider-specific) |
| Mock LLM | `mock-model` | (any string) |

Use `service.listModels()` to get available models per backend.
