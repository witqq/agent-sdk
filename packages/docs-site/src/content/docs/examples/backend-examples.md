---
title: Backend Examples
description: Complete, self-contained code for each backend — copy, paste, and run.
sidebar:
  order: 2
---

Each example below is a complete, runnable program. Copy the entire block into a `.ts` file and run with `npx tsx <file>.ts`.

## Copilot Backend

Uses the GitHub Copilot CLI as the underlying LLM. Requires `github-copilot` CLI installed and authenticated.

```typescript
import { createAgentService } from "@witqq/agent-sdk";

async function main() {
  const service = await createAgentService("copilot", {});

  // List available models
  const models = await service.listModels();
  console.log(
    "Available models:",
    models.map((m) => m.id),
  );

  // Create agent and chat
  const agent = service.createAgent({
    systemPrompt: "You are a senior TypeScript developer.",
  });

  const result = await agent.run(
    "Write a type-safe deepMerge function signature.",
    { model: "gpt-4.1" },
  );
  console.log(result.output);

  // Error handling
  try {
    await agent.run("test", { model: "nonexistent-model" });
  } catch (err) {
    console.error("Expected error:", (err as Error).message);
  }

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Claude Backend

Uses the Anthropic Claude CLI. Requires `claude` CLI installed and authenticated.

```typescript
import { createAgentService } from "@witqq/agent-sdk";

async function main() {
  const service = await createAgentService("claude", {});

  const agent = service.createAgent({
    systemPrompt: "You are a concise code reviewer.",
  });

  // Basic run
  const result = await agent.run("Review this: `if (x == null) return;`", {
    model: "claude-sonnet-4-20250514",
  });
  console.log(result.output);

  // Streaming with event details
  const stream = agent.stream("Explain the builder pattern in 2 sentences.", {
    model: "claude-sonnet-4-20250514",
  });

  for await (const event of stream) {
    if (event.type === "text_delta") {
      process.stdout.write(event.text);
    }
    if (event.type === "usage_update") {
      console.log(`\n[Tokens: ${event.promptTokens}+${event.completionTokens}]`);
    }
    if (event.type === "done") {
      console.log("\nFinish reason:", event.finishReason);
    }
  }

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Vercel AI Backend

API-based backend supporting OpenRouter, OpenAI, Google, and other providers. No CLI needed — just an API key.

```typescript
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";

async function main() {
  // OpenRouter — access 200+ models with one API key
  const service = createVercelAIService({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseUrl: "https://openrouter.ai/api/v1",
    provider: "openrouter",
  });

  const agent = service.createAgent({
    systemPrompt: "You are a helpful assistant.",
  });

  // Basic run
  const result = await agent.run("What is the capital of France?", {
    model: "openai/gpt-4.1-mini",
  });
  console.log(result.output);

  // Streaming
  const stream = agent.stream("Count from 1 to 5, one per line.", {
    model: "openai/gpt-4.1-mini",
  });

  for await (const event of stream) {
    if (event.type === "text_delta") process.stdout.write(event.text);
    if (event.type === "done") console.log();
  }

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

### Vercel AI with Provider Options

Pass provider-specific parameters for features like extended thinking:

```typescript
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";

async function main() {
  const service = createVercelAIService({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseUrl: "https://openrouter.ai/api/v1",
  });

  const agent = service.createAgent({
    systemPrompt: "Solve step by step.",
    // Provider options set at agent creation apply to all calls
    providerOptions: {
      openrouter: { transforms: ["middle-out"] },
    },
  });

  const result = await agent.run("What is 17 * 23 + 42?", {
    model: "openai/gpt-4.1-mini",
    // Per-call provider options override agent defaults
    providerOptions: {
      openrouter: { transforms: ["middle-out"] },
    },
  });

  console.log(result.output);

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Mock LLM Backend

No external services needed — perfect for development and testing. See [Testing Examples](/examples/testing-examples/) for comprehensive test patterns.

```typescript
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

async function main() {
  // Echo mode — returns whatever you send
  const echoService = createMockLLMService({ mode: { type: "echo" } });
  const echoAgent = echoService.createAgent({ systemPrompt: "Test agent" });
  const echoResult = await echoAgent.run("Hello!", { model: "mock" });
  console.log("Echo:", echoResult.output); // "Hello!"

  // Static mode — always returns the same response
  const staticService = createMockLLMService({
    mode: { type: "static", response: "I'm a mock agent." },
  });
  const staticAgent = staticService.createAgent({ systemPrompt: "Test" });
  const staticResult = await staticAgent.run("Anything", { model: "mock" });
  console.log("Static:", staticResult.output); // "I'm a mock agent."

  // Scripted mode — sequential responses
  const scriptedService = createMockLLMService({
    mode: {
      type: "scripted",
      responses: ["First response", "Second response", "Third response"],
      loop: true,
    },
  });
  const scriptedAgent = scriptedService.createAgent({ systemPrompt: "Test" });
  for (let i = 0; i < 4; i++) {
    const r = await scriptedAgent.run(`Message ${i}`, { model: "mock" });
    console.log(`Scripted ${i}:`, r.output);
  }
  // Output: First, Second, Third, First (loops)

  // Error mode — simulates failures
  const errorService = createMockLLMService({
    mode: { type: "error", error: "Rate limit exceeded", code: "RATE_LIMIT" },
  });
  const errorAgent = errorService.createAgent({ systemPrompt: "Test" });
  try {
    await errorAgent.run("test", { model: "mock" });
  } catch (err) {
    console.log("Error caught:", (err as Error).message);
  }

  // Clean up
  echoAgent.dispose();
  staticAgent.dispose();
  scriptedAgent.dispose();
  errorAgent.dispose();
}

main().catch(console.error);
```

## Backend Switching at Runtime

Use the registry to write backend-agnostic code:

```typescript
import { createAgentService, type IAgentService } from "@witqq/agent-sdk";

async function createService(): Promise<IAgentService> {
  const backend = process.env.AGENT_BACKEND ?? "copilot";
  // Second argument depends on backend — empty options work for copilot/claude
  return createAgentService(backend, {});
}

async function main() {
  const service = await createService();
  console.log(`Using backend: ${service.name}`);

  const agent = service.createAgent({
    systemPrompt: "You are a helpful assistant.",
  });

  const result = await agent.run("Hello!", {
    model: process.env.AGENT_MODEL ?? "gpt-4.1",
  });
  console.log(result.output);

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

Run with different backends:

```bash
AGENT_BACKEND=copilot AGENT_MODEL=gpt-4.1 npx tsx agent.ts
AGENT_BACKEND=claude AGENT_MODEL=claude-sonnet-4-20250514 npx tsx agent.ts
AGENT_BACKEND=vercel-ai AGENT_MODEL=openai/gpt-4.1-mini npx tsx agent.ts
```
