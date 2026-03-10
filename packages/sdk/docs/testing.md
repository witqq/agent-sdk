# Testing

The SDK provides testing utilities at two levels: lightweight mocks for unit tests, and the Mock LLM backend for integration tests.

## Import Paths

| Import | Purpose |
|--------|---------|
| `@witqq/agent-sdk/testing` | Mock factories for services, runtimes, clients, sessions, messages |
| `@witqq/agent-sdk/mock-llm` | Full Mock LLM backend with BaseAgent lifecycle |

## Mock Factories

All factories are in `@witqq/agent-sdk/testing`. They return objects that implement SDK interfaces without requiring a real backend.

### createMockAgentService

Creates a mock `IAgentService`. Use for testing code that depends on agent services.

```typescript
import { createMockAgentService } from "@witqq/agent-sdk/testing";
import type { MockAgentServiceOptions } from "@witqq/agent-sdk/testing";

const service = createMockAgentService({
  name: "test-service",
  models: [
    { id: "test-model", name: "Test Model", provider: "test" },
  ],
  validationResult: { valid: true, errors: [] },
  onRun: async (prompt, options) => ({
    output: `Echo: ${typeof prompt === "string" ? prompt : "complex"}`,
    structuredOutput: undefined,
    toolCalls: [],
    messages: [],
  }),
});

const models = await service.listModels();
const validation = await service.validate();
const agent = service.createAgent({ systemPrompt: "Test" });
```

Options:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | `string` | `"mock"` | Service name |
| `models` | `ModelInfo[]` | `[]` | Available models |
| `validationResult` | `ValidationResult` | `{ valid: true }` | `validate()` return |
| `onRun` | `(prompt, options) => Promise<AgentResult>` | echo | Custom run handler |
| `onStream` | `(prompt, options) => AsyncIterable<AgentEvent>` | echo stream | Custom stream handler |
| `mockLLMBackend` | `MockLLMBackendOptions` | -- | Delegate to full Mock LLM |

### createMockRuntime

Creates a mock `IChatRuntime`. Use for testing chat runtime consumers.

```typescript
import { createMockRuntime, createMockSession } from "@witqq/agent-sdk/testing";

const session = createMockSession({ title: "Test chat" });

const runtime = createMockRuntime({
  defaultBackend: "mock",
  defaultModel: "test-model",
  sessions: [session],
  models: [{ id: "test-model", name: "Test" }],
  onSend: async function* (sessionId, message) {
    yield { type: "message:start", messageId: "msg-1", role: "assistant" };
    yield { type: "message:delta", messageId: "msg-1", text: "Response" };
    yield { type: "done" };
  },
});
```

Options:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultBackend` | `string` | `"mock"` | Default backend name |
| `defaultModel` | `string` | -- | Default model ID |
| `sessions` | `ChatSession[]` | `[]` | Pre-populated sessions |
| `models` | `ModelInfo[]` | `[]` | Available models |
| `onSend` | `(sessionId, message, options?) => AsyncIterable<ChatEvent>` | -- | Custom send handler |

### createMockChatClient

Creates a mock `IChatClient`. Use for React component tests.

```typescript
import { createMockChatClient, createMockSession } from "@witqq/agent-sdk/testing";

const client = createMockChatClient({
  sessions: [createMockSession({ title: "Chat 1" })],
  models: [{ id: "gpt-4.1", name: "GPT-4.1" }],
  providers: [{ id: "openai", backend: "vercel-ai", model: "gpt-4.1", label: "OpenAI GPT-4.1", createdAt: Date.now() }],
  onSend: async function* (sessionId, message) {
    yield { type: "message:start", messageId: "msg-1", role: "assistant" };
    yield { type: "done" };
  },
});
```

Options:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sessions` | `ChatSession[]` | `[]` | Pre-populated sessions |
| `models` | `ModelInfo[]` | `[]` | Available models |
| `providers` | `ProviderConfig[]` | `[]` | Provider configurations |
| `onSend` | `(sessionId, message, options?) => AsyncIterable<ChatEvent>` | -- | Custom send handler |

### createMockSession

Factory for `ChatSession` test instances. All fields have sensible defaults.

```typescript
import { createMockSession } from "@witqq/agent-sdk/testing";

const session = createMockSession({
  id: "session-123",
  title: "Test session",
  config: { model: "gpt-4.1", backend: "copilot" },
  messages: [],
  status: "active",
});
```

### createMockMessage

Factory for `ChatMessage` test instances.

```typescript
import { createMockMessage } from "@witqq/agent-sdk/testing";

const userMsg = createMockMessage({
  role: "user",
  text: "Hello",
  status: "complete",
});

const assistantMsg = createMockMessage({
  role: "assistant",
  parts: [
    { type: "text", text: "Hi there", status: "complete" },
    { type: "reasoning", text: "User greeted me", status: "complete" },
  ],
  status: "complete",
});
```

Options:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | generated | Message ID |
| `role` | `"user" \| "assistant" \| "system"` | `"user"` | Message role |
| `text` | `string` | -- | Shorthand: creates a single `TextPart` |
| `parts` | `MessagePart[]` | -- | Full parts array (overrides `text`) |
| `status` | `"pending" \| "streaming" \| "complete" \| "error"` | `"complete"` | Message status |
| `metadata` | `Record<string, unknown>` | -- | Custom metadata |

## Mock LLM Backend

For integration tests that need the full agent lifecycle (tool calls, permissions, streaming), use the Mock LLM backend. See [Mock LLM Guide](mock-llm.md) for complete documentation.

```typescript
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

const service = createMockLLMService({
  mode: { type: "static", response: "Test response" },
});
```

Mock LLM response modes:

| Mode | Description |
|------|-------------|
| `{ type: "echo" }` | Returns the user prompt |
| `{ type: "static", response: string }` | Fixed response |
| `{ type: "scripted", responses: string[], loop?: boolean }` | Sequence of responses |
| `{ type: "error", error: string, code?, recoverable? }` | Simulates errors |

## Testing Patterns

### Unit Testing a Tool

```typescript
import { describe, it, expect } from "vitest";
import { z } from "zod";
import type { ToolDefinition, ToolContext } from "@witqq/agent-sdk";

const calculator: ToolDefinition<{ a: number; b: number; op: string }> = {
  name: "calc",
  description: "Calculate",
  parameters: z.object({ a: z.number(), b: z.number(), op: z.string() }),
  execute: async ({ a, b, op }) => {
    if (op === "add") return a + b;
    if (op === "mul") return a * b;
    throw new Error(`Unknown op: ${op}`);
  },
};

describe("calculator tool", () => {
  it("adds numbers", async () => {
    const result = await calculator.execute({ a: 2, b: 3, op: "add" });
    expect(result).toBe(5);
  });

  it("rejects unknown ops", async () => {
    await expect(calculator.execute({ a: 1, b: 1, op: "div" })).rejects.toThrow("Unknown op");
  });
});
```

### Testing Chat UI Components

```typescript
import { render, screen } from "@testing-library/react";
import { createMockChatClient, createMockSession, createMockMessage } from "@witqq/agent-sdk/testing";

const session = createMockSession({
  title: "Test",
  messages: [
    createMockMessage({ role: "user", text: "Hello" }),
    createMockMessage({ role: "assistant", text: "Hi" }),
  ],
});

const client = createMockChatClient({
  sessions: [session],
});

// Pass client to your component under test
render(<ChatView client={client} sessionId={session.id} />);
```

### Testing Stream Consumers

```typescript
import { createMockAgentService } from "@witqq/agent-sdk/testing";
import type { AgentEvent } from "@witqq/agent-sdk";

const service = createMockAgentService({
  onStream: async function* (): AsyncIterable<AgentEvent> {
    yield { type: "session_info", sessionId: "s1", backend: "mock" };
    yield { type: "text_delta", text: "Hello " };
    yield { type: "text_delta", text: "world" };
    yield { type: "usage_update", promptTokens: 10, completionTokens: 5 };
    yield { type: "done", finalOutput: "Hello world" };
  },
});

const agent = service.createAgent({ systemPrompt: "Test" });
const events: AgentEvent[] = [];

for await (const event of agent.stream("Hi", { model: "test" })) {
  events.push(event);
}

expect(events.filter((e) => e.type === "text_delta")).toHaveLength(2);
```

### Integration Testing with Mock LLM

```typescript
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
import { z } from "zod";

it("executes tool calls", async () => {
  const service = createMockLLMService({
    mode: { type: "static", response: "Done" },
    toolCalls: [{ name: "greet", args: { name: "Alice" } }],
  });

  const agent = service.createAgent({
    systemPrompt: "Greeter",
    tools: [{
      name: "greet",
      description: "Greet someone",
      parameters: z.object({ name: z.string() }),
      execute: async ({ name }) => `Hello, ${name}!`,
    }],
  });

  const result = await agent.run("Greet Alice", { model: "mock-model" });
  expect(result.toolCalls).toHaveLength(1);
  expect(result.toolCalls[0].result).toBe("Hello, Alice!");
});
```

## Choosing the Right Mock

| Need | Use | Import |
|------|-----|--------|
| Test tool `execute()` in isolation | Direct function call | `@witqq/agent-sdk` |
| Test code that takes `IAgentService` | `createMockAgentService` | `@witqq/agent-sdk/testing` |
| Test chat runtime consumers | `createMockRuntime` | `@witqq/agent-sdk/testing` |
| Test React chat components | `createMockChatClient` | `@witqq/agent-sdk/testing` |
| Generate test `ChatSession` data | `createMockSession` | `@witqq/agent-sdk/testing` |
| Generate test `ChatMessage` data | `createMockMessage` | `@witqq/agent-sdk/testing` |
| Full agent lifecycle (tools, permissions, streaming) | Mock LLM Backend | `@witqq/agent-sdk/mock-llm` |
| E2E chat server tests (zero-auth) | `MockLLMChatAdapter` + mock demo server | `@witqq/agent-sdk/chat/backends` |

## E2E Testing with MockLLMChatAdapter

`MockLLMChatAdapter` extends `BaseBackendAdapter` with the mock-llm engine. Combined with the mock demo server (`packages/demo/server-mock.ts`), it provides a zero-auth HTTP chat server for E2E tests.

```typescript
import { MockLLMChatAdapter } from "@witqq/agent-sdk/chat/backends";
import { createChatRuntime, createChatServer } from "@witqq/agent-sdk/chat/server";

const adapter = new MockLLMChatAdapter({
  agentConfig: { tools: [], systemMessage: "You are a test assistant" },
  mockOptions: { defaultMode: { type: "echo" } },
});

const runtime = createChatRuntime({ adapters: { "mock-llm": adapter } });
const server = createChatServer({ runtime });
```

Run E2E tests against the mock server:

```bash
# Start mock demo server (port 3457)
npx tsx packages/demo/server-mock.ts

# Run mock-demo E2E tests
npx vitest run tests/e2e/mock-demo.test.ts

# Run comprehensive E2E suite (42 tests, 9 categories)
npx vitest run tests/e2e/mock-demo-comprehensive.test.ts --config vitest.e2e.config.ts

# Run all E2E tests
npx vitest run tests/e2e/ --config vitest.e2e.config.ts
```

### Comprehensive Test Categories

The `mock-demo-comprehensive.test.ts` suite covers:

| Category | Tests | What it validates |
|----------|-------|-------------------|
| Echo mode | 3 | Basic request-response, SSE event structure |
| Streaming | 4 | Chunk-by-chunk delivery, event ordering |
| Error handling | 4 | Error modes, invalid provider, malformed input |
| Tool calls | 3 | Tool call events in stream, tool metadata |
| finishReason | 3 | Stop reason propagation through SSE |
| Structured output | 3 | JSON schema responses via mock |
| Scripted mode | 3 | Sequential responses, loop behavior |
| Sessions | 4 | CRUD, conversation history |
| Permissions | 3 | Auto-approve, deny, supervisor delegation |

The test helper `startMockDemoServer()` in `tests/e2e/helpers/server-manager.ts` handles server lifecycle with temp DB isolation.
