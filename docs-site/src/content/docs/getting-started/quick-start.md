---
title: "Quick Start"
sidebar:
  order: 2
description: "Install and create your first AI agent"
---

Install `@witqq/agent-sdk` and create your first AI agent.

## Prerequisites

- Node.js 18+
- npm or pnpm

## Installation

```bash
npm install @witqq/agent-sdk zod
```

`zod` is the only required peer dependency (v3.23+ or v4.x). Backend SDKs are optional — install only what you use:

```bash
# Pick one (or more):
npm install @github/copilot-sdk            # Copilot backend
npm install @anthropic-ai/claude-agent-sdk  # Claude backend
npm install ai @ai-sdk/openai-compatible   # Vercel AI backend
# Mock LLM backend — built-in, no extra install needed
```

## Core Concepts

**Service → Agent → Run/Stream** is the fundamental pattern:

1. **Service** (`IAgentService`) — factory for agents. One per backend.
2. **Agent** (`IAgent`) — configured instance with system prompt, tools, callbacks. Reusable.
3. **Run/Stream** — per-call execution. Pass model and options each time.

```text
createAgentService("copilot", opts)  →  service.createAgent(config)  →  agent.run(prompt, { model })
```

## First Agent

```typescript
import { createAgentService } from "@witqq/agent-sdk";

// 1. Create a service (one per backend)
const service = await createAgentService("copilot", { useLoggedInUser: true });

// 2. Create an agent with system prompt and tools
const agent = service.createAgent({
  systemPrompt: "You are a helpful assistant.",
});

// 3. Run a prompt
const result = await agent.run("What is TypeScript?", { model: "gpt-5-mini" });
console.log(result.output);

// 4. Cleanup
agent.dispose();
await service.dispose();
```

## Streaming

Stream responses token-by-token:

```typescript
for await (const event of agent.stream("Tell me a story", { model: "gpt-5-mini" })) {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.text);
      break;
    case "tool_call_start":
      console.log(`Calling ${event.toolName}`);
      break;
    case "done":
      console.log("\nDone:", event.finalOutput);
      break;
  }
}
```

All backends emit the same `AgentEvent` discriminated union — 15 event types covering text, tools, permissions, usage, errors, and completion.

## Adding Tools

Define tools with Zod schemas:

```typescript
import { z } from "zod";

const agent = service.createAgent({
  systemPrompt: "You are a research assistant.",
  tools: [
    {
      name: "search",
      description: "Search the web",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ results: [`Result for: ${query}`] }),
    },
  ],
});
```

## Structured Output

Extract typed data:

```typescript
const result = await agent.runStructured(
  "What is the capital of France?",
  {
    schema: z.object({
      city: z.string(),
      country: z.string(),
      population: z.number(),
    }),
    name: "city_info",
  },
  { model: "gpt-5-mini" },
);

console.log(result.structuredOutput);
// { city: "Paris", country: "France", population: 2161000 }
```

## Switching Backends

Same code, different backend — change only the service creation:

```typescript
// Copilot
const service = await createAgentService("copilot", { useLoggedInUser: true });

// Claude
const service = await createAgentService("claude", { workingDirectory: "." });

// Vercel AI (OpenRouter)
const service = await createAgentService("vercel-ai", {
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// Mock LLM (testing — no external dependencies)
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
const service = createMockLLMService({ mode: { type: "echo" } });
```

All backends share `AgentConfig`, `RunOptions`, `AgentResult`, and `AgentEvent` types.

## Testing with Mock LLM

The Mock LLM backend requires no API keys or CLI tools — ideal for CI:

```typescript
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

const service = createMockLLMService({
  mode: { type: "static", response: "Test response" },
});
const agent = service.createAgent({ systemPrompt: "Test" });
const result = await agent.run("anything", { model: "mock" });
// result.output === "Test response"
```

See [Mock LLM Guide](mock-llm.md) for advanced testing patterns.

## Next Steps

- [Backends Guide](backends.md) — detailed setup per backend, feature comparison
- [Mock LLM Guide](mock-llm.md) — automated testing with the mock backend
- [Chat SDK Guide](chat-sdk/README.md) — higher-level chat applications
- [Server Quickstart](chat-sdk/server-quickstart.md) — HTTP server setup
- [API Surface](architecture/api-surface.md) — complete export inventory
