---
title: "Mock LLM Backend"
sidebar:
  order: 2
description: "Deterministic testing backend with configurable response modes"
---

The Mock LLM backend provides a fully functional `IAgentService` implementation for automated testing. Unlike the lightweight `createMockAgentService` helper, Mock LLM extends `BaseAgent` and participates in the full agent lifecycle — retry, heartbeat, activity timeout, middleware pipeline, and usage enrichment.

## When to Use

| Scenario | Use Mock LLM | Use `createMockAgentService` |
|----------|-------------|------------------------------|
| Unit tests needing full BaseAgent lifecycle | ✓ | |
| Integration tests through chat runtime | ✓ | |
| Simple mock for handler/transport tests | | ✓ |
| Testing retry and error recovery | ✓ | |
| Testing streaming with timing control | ✓ | |
| Testing tool call flows | ✓ | |
| Quick stub with no configuration | | ✓ |

## Basic Usage

> Examples in this guide build on each other — imports shown once at first use.

```typescript
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

// Echo mode — returns the prompt as the response
const service = createMockLLMService({ mode: { type: "echo" } });
const agent = service.createAgent({ systemPrompt: "Test" });
const result = await agent.run("Hello world", { model: "mock" });
// result.output === "Hello world"

// Static mode — always returns the same response
const service = createMockLLMService({
  mode: { type: "static", response: "Fixed response" },
});

// Scripted mode — returns responses in sequence; with loop: true cycles back to start
const service = createMockLLMService({
  mode: { type: "scripted", responses: ["First", "Second", "Third"], loop: true },
});

// Error mode — throws AgentSDKError on every call
const service = createMockLLMService({
  mode: { type: "error", error: "Simulated timeout", code: "TIMEOUT", recoverable: true },
});
```

## Streaming

Mock LLM generates the same `AgentEvent` stream as real backends:

```typescript
import type { AgentEvent } from "@witqq/agent-sdk";

const service = createMockLLMService({
  mode: { type: "static", response: "Hello world" },
  streaming: { chunkSize: 5, chunkDelayMs: 10 },
});

const agent = service.createAgent({ systemPrompt: "Test" });
const events: AgentEvent[] = [];
for await (const event of agent.stream("prompt", { model: "mock" })) {
  events.push(event);
}
// text_delta events: "Hello", " worl", "d"
// done event with finalOutput: "Hello world"
```

Without `streaming` options, the response is split at word boundaries — one `text_delta` per word. Use `streaming: { chunkSize: N }` for fixed-size chunks.

## Latency Simulation

Simulate real-world response delays:

```typescript
// Fixed delay
const service = createMockLLMService({
  mode: { type: "static", response: "Delayed response" },
  latency: { type: "fixed", ms: 200 },
});

// Random delay (uniform distribution)
const service = createMockLLMService({
  mode: { type: "echo" },
  latency: { type: "random", minMs: 50, maxMs: 500 },
});
```

Latency is applied before the first response token — all modes and streaming compose with it.

## Tool Call Simulation

Mock agents emit tool call events during streaming:

```typescript
import type { MockLLMToolCall } from "@witqq/agent-sdk/mock-llm";

const toolCalls: MockLLMToolCall[] = [
  {
    toolName: "search",
    args: { query: "TypeScript" },
    result: { results: ["Found: TypeScript docs"] },
  },
  {
    toolName: "read_file",
    args: { path: "/src/index.ts" },
    result: { content: "export const VERSION = '1.0';" },
  },
];

const service = createMockLLMService({
  mode: { type: "static", response: "Here are the results" },
  toolCalls,
});

const agent = service.createAgent({ systemPrompt: "Test" });
for await (const event of agent.stream("Find info", { model: "mock" })) {
  switch (event.type) {
    case "tool_call_start":
      console.log(`Tool: ${event.toolName}`, event.args);
      break;
    case "tool_call_end":
      console.log(`Result:`, event.result);
      break;
    case "text_delta":
      console.log(`Text: ${event.text}`);
      break;
  }
}
// Output order: tool_call_start → tool_call_end → tool_call_start → tool_call_end → text_delta → usage_update → done
```

Tool calls also populate `AgentResult.toolCalls` in `run()`:

```typescript
const result = await agent.run("Find info", { model: "mock" });
console.log(result.toolCalls);
// [{ toolName: "search", args: {...}, result: {...}, approved: true },
//  { toolName: "read_file", args: {...}, result: {...}, approved: true }]
```

## Structured Output

Override the structured output result:

```typescript
const service = createMockLLMService({
  mode: { type: "static", response: "not used for structured" },
  structuredOutput: { city: "Paris", country: "France", population: 2161000 },
});

const result = await agent.runStructured(
  "What is the capital of France?",
  { schema: citySchema, name: "city" },
  { model: "mock" },
);
console.log(result.structuredOutput);
// { city: "Paris", country: "France", population: 2161000 }
```

Without `structuredOutput`, the mock falls back to `JSON.parse(response)`, then the raw string.

## Permission Simulation

Test permission flows without real backend interaction:

```typescript
// Auto-approve permissions for specific tools
const service = createMockLLMService({
  mode: { type: "echo" },
  permissions: { toolNames: ["bash", "file_write"], autoApprove: true },
});

// Deny specific tools (emits permission_request → permission_response with denied)
const service = createMockLLMService({
  mode: { type: "echo" },
  permissions: { toolNames: ["rm", "sudo"], denyTools: ["rm", "sudo"] },
});

// Delegate to supervisor callback (default when autoApprove is false)
const service = createMockLLMService({
  mode: { type: "echo" },
  permissions: { toolNames: ["bash"] },
});
const agent = service.createAgent({
  systemPrompt: "Test",
  supervisor: {
    onPermission: async (req) => ({
      allowed: req.toolName === "safe_tool",
      scope: "session",
    }),
  },
});
```

## Integration with createMockAgentService

The lightweight `createMockAgentService` helper supports opt-in delegation to Mock LLM for richer behavior:

```typescript
import { createMockAgentService } from "@witqq/agent-sdk/testing";

// Default — simple handler-based mock
const service = createMockAgentService({
  onRun: async () => ({
    output: "simple",
    structuredOutput: undefined,
    toolCalls: [],
    messages: [],
    usage: undefined,
  }),
});

// With mockLLMBackend — full BaseAgent lifecycle
const service = createMockAgentService({
  mockLLMBackend: {
    mode: { type: "static", response: "Full lifecycle response" },
    latency: { type: "fixed", ms: 50 },
  },
});
```

When `mockLLMBackend` is provided, `createMockAgentService` creates a full `MockLLMService` internally — the agent gets retry, heartbeat, middleware, and usage enrichment.

## Testing Patterns

### Verify Streaming Event Order

```typescript
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

const service = createMockLLMService({
  mode: { type: "static", response: "Hello" },
  toolCalls: [{ toolName: "greet", args: { name: "World" }, result: { ok: true } }],
});

const agent = service.createAgent({ systemPrompt: "Test" });
const types: string[] = [];
for await (const event of agent.stream("test", { model: "mock" })) {
  types.push(event.type);
}

expect(types).toEqual([
  "tool_call_start",
  "tool_call_end",
  "text_delta",
  "usage_update",
  "done",
]);
```

### Test Error Recovery with Retry

```typescript
const service = createMockLLMService({
  mode: { type: "error", error: "Timeout", code: "TIMEOUT", recoverable: true },
});

const agent = service.createAgent({ systemPrompt: "Test" });
await expect(
  agent.run("test", { model: "mock", retry: { maxRetries: 2 } }),
).rejects.toThrow();
// BaseAgent retries 2 times, then throws
```

### E2E Through Chat Runtime

```typescript
import { createMockRuntime } from "@witqq/agent-sdk/testing";

const runtime = createMockRuntime({ defaultModel: "mock" });
const session = await runtime.createSession({});

// Full pipeline: session → message → stream events
for await (const event of runtime.send(session.id, "Hello")) {
  console.log(event.type, event);
}
```

## Type Reference

```typescript
interface MockLLMBackendOptions {
  mode?: MockLLMResponseMode;           // defaults to { type: "echo" }
  models?: Array<{ id: string; name?: string; description?: string }>;
  latency?: MockLLMLatency;
  streaming?: MockLLMStreamingOptions;
  finishReason?: string;                // "stop" | "length" | "tool-calls" | custom
  permissions?: MockLLMPermissionOptions;
  toolCalls?: MockLLMToolCall[];
  structuredOutput?: unknown;
}

type MockLLMResponseMode =
  | { type: "echo" }
  | { type: "static"; response: string }
  | { type: "scripted"; responses: string[]; loop?: boolean }
  | { type: "error"; error: string; code?: string; recoverable?: boolean };

type MockLLMLatency =
  | { type: "fixed"; ms: number }
  | { type: "random"; minMs: number; maxMs: number };

interface MockLLMStreamingOptions {
  chunkSize?: number;     // characters per chunk
  chunkDelayMs?: number;  // delay between chunks in ms
}

interface MockLLMPermissionOptions {
  toolNames: string[];    // tools to simulate permission requests for
  autoApprove?: boolean;  // auto-approve all (default: false — uses supervisor)
  denyTools?: string[];   // tool names to always deny
}

interface MockLLMToolCall {
  toolName: string;
  args?: Record<string, unknown>;
  result?: unknown;
  toolCallId?: string;    // auto-generated if omitted
}
```

---

**API Reference:** [Mock LLM Backend](/api-reference/backends/mock-llm/) · [Testing Utilities](/api-reference/testing/)
