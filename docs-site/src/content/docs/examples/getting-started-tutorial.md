---
title: Getting Started Tutorial
description: Build your first AI agent from zero — installation, configuration, and first conversation.
sidebar:
  order: 1
---

Follow this tutorial to create a working AI agent in under 5 minutes. By the end you'll have a streaming conversation with tool support.

## Prerequisites

- Node.js 18+ and npm
- One of: GitHub Copilot subscription, Anthropic API key, or an OpenRouter API key

## Step 1: Project Setup

Create a new project and install the SDK with your chosen backend:

```bash
mkdir my-agent && cd my-agent
npm init -y
npm install @witqq/agent-sdk
```

Install a backend peer dependency — pick one:

```bash
# GitHub Copilot (CLI-based, needs `github-copilot` CLI installed)
# No extra install — included as subpath export @witqq/agent-sdk/copilot

# Anthropic Claude (CLI-based, needs `claude` CLI installed)
# No extra install — included as subpath export @witqq/agent-sdk/claude

# Vercel AI SDK (API-based, works with OpenRouter/OpenAI/Google)
npm install ai @ai-sdk/openai
```

Copilot and Claude backends are included in the main package as subpath exports. Vercel AI requires the `ai` and provider packages as peer dependencies.

Add TypeScript (optional but recommended):

```bash
npm install -D typescript tsx
npx tsc --init
```

## Step 2: Create Your First Agent

Create `agent.ts` — a complete, runnable program:

```typescript
import { createAgentService } from "@witqq/agent-sdk";

async function main() {
  // 1. Create a backend service
  //    Change "copilot" to "claude" or "vercel-ai" for other backends
  const service = await createAgentService("copilot", {});

  // 2. Create an agent with a system prompt
  const agent = service.createAgent({
    systemPrompt: "You are a helpful coding assistant. Be concise.",
  });

  // 3. Send a message and get a response
  const result = await agent.run("What is a closure in JavaScript?", {
    model: "gpt-4.1",
  });

  console.log(result.output);

  // 4. Clean up
  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

Run it:

```bash
npx tsx agent.ts
```

## Step 3: Add Streaming

Replace the `agent.run()` call with streaming to see tokens arrive in real-time:

```typescript
import { createAgentService, type AgentEvent } from "@witqq/agent-sdk";

async function main() {
  const service = await createAgentService("copilot", {});
  const agent = service.createAgent({
    systemPrompt: "You are a helpful assistant.",
  });

  // Stream the response
  const stream = agent.stream("Explain async/await in 3 sentences.", {
    model: "gpt-4.1",
  });

  for await (const event of stream) {
    switch (event.type) {
      case "text_delta":
        process.stdout.write(event.text);
        break;
      case "error":
        console.error("\nError:", event.error);
        break;
      case "done":
        console.log("\n\nDone! Finish reason:", event.finishReason);
        break;
    }
  }

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Step 4: Add a Tool

Give your agent the ability to call functions. Tools use [Zod](https://zod.dev) schemas for parameter validation:

```typescript
import { createAgentService, type ToolDefinition } from "@witqq/agent-sdk";
import { z } from "zod";

// Define a tool with typed parameters and an execute function
const weatherTool: ToolDefinition<{ city: string }> = {
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
  }),
  async execute(params) {
    // In a real app, call a weather API here
    return { city: params.city, temp: 22, condition: "sunny" };
  },
};

async function main() {
  const service = await createAgentService("copilot", {});
  const agent = service.createAgent({
    systemPrompt: "You help users check weather. Use the get_weather tool.",
    tools: [weatherTool],
  });

  const result = await agent.run("What's the weather in Tokyo?", {
    model: "gpt-4.1",
  });

  console.log("Response:", result.output);
  console.log("Tool calls:", result.toolCalls);

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Step 5: Structured Output

Extract typed data from LLM responses using `runStructured`:

```typescript
import { createAgentService } from "@witqq/agent-sdk";
import { z } from "zod";

const SentimentSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()),
});

async function main() {
  const service = await createAgentService("copilot", {});
  const agent = service.createAgent({
    systemPrompt: "Analyze text sentiment. Return structured data only.",
  });

  const result = await agent.runStructured(
    "The new product launch exceeded all expectations!",
    {
      schema: SentimentSchema,
      name: "sentiment_analysis",
      description: "Sentiment analysis result",
    },
    { model: "gpt-4.1" },
  );

  // result.structuredOutput is typed as { sentiment, confidence, keywords }
  console.log("Sentiment:", result.structuredOutput?.sentiment);
  console.log("Confidence:", result.structuredOutput?.confidence);
  console.log("Keywords:", result.structuredOutput?.keywords);

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Step 6: Multi-Turn Conversation

Use `runWithContext` to maintain conversation history:

```typescript
import { createAgentService, type Message } from "@witqq/agent-sdk";

async function main() {
  const service = await createAgentService("copilot", {});
  const agent = service.createAgent({
    systemPrompt: "You are a helpful math tutor.",
  });

  const history: Message[] = [];

  // Turn 1
  history.push({ role: "user", content: "What is the derivative of x^3?" });
  const r1 = await agent.runWithContext(history, { model: "gpt-4.1" });
  history.push({ role: "assistant", content: r1.output ?? "" });
  console.log("Turn 1:", r1.output);

  // Turn 2 — refers to previous answer
  history.push({ role: "user", content: "Now integrate that result." });
  const r2 = await agent.runWithContext(history, { model: "gpt-4.1" });
  history.push({ role: "assistant", content: r2.output ?? "" });
  console.log("Turn 2:", r2.output);

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Next Steps

- [Backend Examples](/examples/backend-examples/) — complete setup for every backend
- [Advanced Patterns](/examples/advanced-patterns/) — error handling, permissions, progress tracking
- [Testing Examples](/examples/testing-examples/) — test your agents with Mock LLM
