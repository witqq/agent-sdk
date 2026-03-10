---
title: Testing Examples
description: Test your agents with Mock LLM — patterns, assertions, and integration test templates.
sidebar:
  order: 4
---

These examples use [Vitest](https://vitest.dev) but the patterns work with any test framework. All examples use the Mock LLM backend — no API keys or external services needed.

## Basic Test Setup

Install test dependencies and create your first agent test:

```bash
npm install -D vitest
```

A minimal test file:

```typescript
// tests/agent.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

describe("Agent basics", () => {
  const service = createMockLLMService({
    mode: { type: "static", response: "Hello from mock!" },
  });

  afterAll(async () => {
    await service.dispose();
  });

  it("returns a response", async () => {
    const agent = service.createAgent({ systemPrompt: "Test agent" });
    const result = await agent.run("Hi", { model: "mock" });
    expect(result.output).toBe("Hello from mock!");
    agent.dispose();
  });

  it("includes usage data", async () => {
    const agent = service.createAgent({ systemPrompt: "Test agent" });
    const result = await agent.run("Hi", { model: "mock" });
    expect(result.usage).toBeDefined();
    expect(result.usage).toMatchObject({
      promptTokens: expect.any(Number),
      completionTokens: expect.any(Number),
    });
    agent.dispose();
  });
});
```

Run with:

```bash
npx vitest run tests/agent.test.ts
```

## Testing Response Sequences

Use scripted mode to test multi-turn conversation logic:

```typescript
import { describe, it, expect } from "vitest";
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
import type { Message } from "@witqq/agent-sdk";

describe("Multi-turn conversation", () => {
  it("handles sequential responses correctly", async () => {
    const service = createMockLLMService({
      mode: {
        type: "scripted",
        responses: [
          "What language would you like to use?",
          "Great choice! Here's a TypeScript starter template...",
          "Project created successfully!",
        ],
      },
    });
    const agent = service.createAgent({ systemPrompt: "Project wizard" });
    const history: Message[] = [];

    // Turn 1
    history.push({ role: "user", content: "Create a new project" });
    const r1 = await agent.runWithContext(history, { model: "mock" });
    expect(r1.output).toContain("language");
    history.push({ role: "assistant", content: r1.output ?? "" });

    // Turn 2
    history.push({ role: "user", content: "TypeScript" });
    const r2 = await agent.runWithContext(history, { model: "mock" });
    expect(r2.output).toContain("TypeScript");
    history.push({ role: "assistant", content: r2.output ?? "" });

    // Turn 3
    history.push({ role: "user", content: "Yes, create it" });
    const r3 = await agent.runWithContext(history, { model: "mock" });
    expect(r3.output).toContain("successfully");

    agent.dispose();
  });

  it("loops scripted responses when loop is enabled", async () => {
    const service = createMockLLMService({
      mode: {
        type: "scripted",
        responses: ["A", "B"],
        loop: true,
      },
    });
    const agent = service.createAgent({ systemPrompt: "Test" });

    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await agent.run(`Message ${i}`, { model: "mock" });
      results.push(r.output ?? "");
    }

    expect(results).toEqual(["A", "B", "A", "B", "A"]);
    agent.dispose();
  });
});
```

## Testing Error Handling

Verify your error handling logic with the error response mode:

```typescript
import { describe, it, expect } from "vitest";
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

describe("Error handling", () => {
  it("catches and classifies errors", async () => {
    const service = createMockLLMService({
      mode: {
        type: "error",
        error: "Rate limit exceeded",
        code: "RATE_LIMIT",
        recoverable: true,
      },
    });
    const agent = service.createAgent({ systemPrompt: "Test" });

    await expect(agent.run("test", { model: "mock" })).rejects.toThrow(
      "Rate limit exceeded",
    );

    agent.dispose();
  });

  it("retries on recoverable errors", async () => {
    let attempts = 0;

    // Custom run handler that fails twice then succeeds
    const service = createMockLLMService({
      mode: { type: "static", response: "Success" },
    });

    const agent = service.createAgent({ systemPrompt: "Test" });

    // Simulate retry logic in your application code
    async function runWithRetry(prompt: string, maxRetries: number) {
      for (let i = 0; i < maxRetries; i++) {
        try {
          attempts++;
          if (attempts < 3) throw new Error("Transient failure");
          return await agent.run(prompt, { model: "mock" });
        } catch {
          if (i === maxRetries - 1) throw new Error("Max retries exceeded");
        }
      }
    }

    const result = await runWithRetry("test", 5);
    expect(result?.output).toBe("Success");
    expect(attempts).toBe(3);

    agent.dispose();
  });
});
```

## Testing Tool Execution

Verify tool calls are made with correct arguments:

```typescript
import { describe, it, expect } from "vitest";
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
import type { ToolDefinition } from "@witqq/agent-sdk";
import { z } from "zod";

describe("Tool execution", () => {
  it("simulates tool calls and verifies results", async () => {
    const toolCallLog: Array<{ name: string; args: unknown }> = [];

    const calculatorTool: ToolDefinition<{ expression: string }> = {
      name: "calculate",
      description: "Evaluate a math expression",
      parameters: z.object({ expression: z.string() }),
      async execute({ expression }) {
        toolCallLog.push({ name: "calculate", args: { expression } });
        return { result: eval(expression) }; // simplified for demo
      },
    };

    const service = createMockLLMService({
      mode: { type: "static", response: "The answer is 42." },
      toolCalls: [
        {
          toolName: "calculate",
          args: { expression: "6 * 7" },
          result: { result: 42 },
        },
      ],
    });

    const agent = service.createAgent({
      systemPrompt: "Use calculator for math.",
      tools: [calculatorTool],
    });

    const result = await agent.run("What is 6 times 7?", { model: "mock" });

    // Verify tool was called
    expect(result.toolCalls.length).toBeGreaterThan(0);
    expect(result.toolCalls[0].toolName).toBe("calculate");

    agent.dispose();
  });
});
```

## Testing Streaming Events

Collect and verify the event sequence from a stream:

```typescript
import { describe, it, expect } from "vitest";
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
import type { AgentEvent } from "@witqq/agent-sdk";

// Helper: collect all events from a stream
async function collectEvents(
  stream: AsyncIterable<AgentEvent>,
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

describe("Streaming", () => {
  it("emits text_delta events for each chunk", async () => {
    const service = createMockLLMService({
      mode: { type: "static", response: "Hello world" },
      streaming: { chunkSize: 5 },
    });
    const agent = service.createAgent({ systemPrompt: "Test" });

    const events = await collectEvents(
      agent.stream("test", { model: "mock" }),
    );

    const textDeltas = events.filter(
      (e): e is Extract<AgentEvent, { type: "text_delta" }> =>
        e.type === "text_delta",
    );
    expect(textDeltas.length).toBeGreaterThan(1);

    // Reconstruct full text from deltas
    const fullText = textDeltas.map((e) => e.text).join("");
    expect(fullText).toBe("Hello world");

    agent.dispose();
  });

  it("ends with a done event", async () => {
    const service = createMockLLMService({
      mode: { type: "static", response: "Test" },
    });
    const agent = service.createAgent({ systemPrompt: "Test" });

    const events = await collectEvents(
      agent.stream("test", { model: "mock" }),
    );

    const lastEvent = events[events.length - 1];
    expect(lastEvent.type).toBe("done");
    if (lastEvent.type === "done") {
      expect(lastEvent.finishReason).toBe("stop");
    }

    agent.dispose();
  });

  it("simulates latency between chunks", async () => {
    const service = createMockLLMService({
      mode: { type: "static", response: "Delayed response" },
      streaming: { chunkSize: 3, chunkDelayMs: 50 },
      latency: { type: "fixed", ms: 100 },
    });
    const agent = service.createAgent({ systemPrompt: "Test" });

    const start = Date.now();
    const events = await collectEvents(
      agent.stream("test", { model: "mock" }),
    );
    const elapsed = Date.now() - start;

    // Should take at least 100ms (latency) + some chunk delays
    expect(elapsed).toBeGreaterThan(100);
    expect(events.length).toBeGreaterThan(0);

    agent.dispose();
  });
});
```

## Testing Structured Output

Verify structured output extraction against Zod schemas:

```typescript
import { describe, it, expect } from "vitest";
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
import { z } from "zod";

describe("Structured output", () => {
  it("returns typed structured data", async () => {
    const TaskSchema = z.object({
      title: z.string(),
      priority: z.enum(["low", "medium", "high"]),
      tags: z.array(z.string()),
    });

    const service = createMockLLMService({
      mode: { type: "static", response: "Task created." },
      structuredOutput: {
        title: "Fix login bug",
        priority: "high",
        tags: ["bug", "auth"],
      },
    });
    const agent = service.createAgent({ systemPrompt: "Task manager" });

    const result = await agent.runStructured(
      "Create a task for the login bug",
      { schema: TaskSchema, name: "task" },
      { model: "mock" },
    );

    expect(result.structuredOutput).toEqual({
      title: "Fix login bug",
      priority: "high",
      tags: ["bug", "auth"],
    });

    agent.dispose();
  });
});
```

## Integration Test Template

A complete integration test that verifies the full agent lifecycle:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
import type {
  IAgentService,
  IAgent,
  ToolDefinition,
  AgentEvent,
} from "@witqq/agent-sdk";
import { z } from "zod";

describe("Agent integration test", () => {
  let service: IAgentService;
  let agent: IAgent;

  const noteTool: ToolDefinition<{ text: string }> = {
    name: "save_note",
    description: "Save a note",
    parameters: z.object({ text: z.string() }),
    async execute({ text }) {
      return { saved: true, id: "note-1", text };
    },
  };

  beforeAll(() => {
    service = createMockLLMService({
      mode: {
        type: "scripted",
        responses: [
          "I'll save that note for you.",
          "Note saved! Here's your summary.",
        ],
      },
      toolCalls: [
        {
          toolName: "save_note",
          args: { text: "Remember to review PR #42" },
          result: { saved: true, id: "note-1" },
        },
      ],
    });

    agent = service.createAgent({
      systemPrompt: "You are a note-taking assistant.",
      tools: [noteTool],
    });
  });

  afterAll(async () => {
    agent.dispose();
    await service.dispose();
  });

  it("validates the service", async () => {
    const validation = await service.validate();
    expect(validation.valid).toBe(true);
  });

  it("lists models", async () => {
    const models = await service.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty("id");
  });

  it("runs a basic prompt", async () => {
    const result = await agent.run("Save a note: review PR #42", {
      model: "mock",
    });
    expect(result.output).toBeTruthy();
  });

  it("streams events in correct order", async () => {
    const events: AgentEvent[] = [];
    for await (const event of agent.stream("Summarize my notes", {
      model: "mock",
    })) {
      events.push(event);
    }

    const types = events.map((e) => e.type);
    // Should have text deltas and end with done
    expect(types).toContain("text_delta");
    expect(types[types.length - 1]).toBe("done");
  });

  it("tracks agent state correctly", () => {
    expect(agent.getState()).toBe("idle");
  });
});
```

## Lightweight Mocks with createMockAgentService

For tests that need custom run/stream behavior without Mock LLM lifecycle:

```typescript
import { describe, it, expect } from "vitest";
import { createMockAgentService } from "@witqq/agent-sdk/testing";
import type { AgentEvent } from "@witqq/agent-sdk";

describe("Custom mock behavior", () => {
  it("uses onRun for custom response logic", async () => {
    const service = createMockAgentService({
      name: "custom-mock",
      onRun: async (prompt) => ({
        output: `Processed: ${typeof prompt === "string" ? prompt : "complex input"}`,
        structuredOutput: undefined,
        toolCalls: [],
        messages: [],
      }),
    });

    const agent = service.createAgent({ systemPrompt: "Test" });
    const result = await agent.run("Hello", { model: "any" });
    expect(result.output).toBe("Processed: Hello");

    agent.dispose();
  });

  it("uses onStream for custom event sequences", async () => {
    const service = createMockAgentService({
      onStream: async function* (): AsyncIterable<AgentEvent> {
        yield { type: "text_delta", text: "Token 1 " };
        yield { type: "text_delta", text: "Token 2 " };
        yield {
          type: "done",
          finalOutput: "Token 1 Token 2 ",
          streamed: true,
          finishReason: "stop",
        };
      },
    });

    const agent = service.createAgent({ systemPrompt: "Test" });
    const events: AgentEvent[] = [];

    for await (const event of agent.stream("test", { model: "any" })) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ type: "text_delta", text: "Token 1 " });
    expect(events[2]).toMatchObject({ type: "done", finishReason: "stop" });

    agent.dispose();
  });
});
```

## Next Steps

- [Getting Started Tutorial](/examples/getting-started-tutorial/) — build your first agent from scratch
- [Backend Examples](/examples/backend-examples/) — complete code for every backend
- [Mock LLM Reference](/testing/mock-llm/) — full Mock LLM backend documentation
