# Streaming and Events

The SDK uses `AsyncIterable<AgentEvent>` for streaming. Every agent interaction produces a sequence of typed events.

## AgentEvent

Discriminated union on the `type` field. 15 event types.

```typescript
import type { AgentEvent } from "@witqq/agent-sdk";
```

### Event Reference

| Type | Key Fields | Description |
|------|-----------|-------------|
| `text_delta` | `text: string` | Incremental text token |
| `thinking_delta` | `text: string` | Model reasoning token |
| `thinking_start` | -- | Reasoning block started |
| `thinking_end` | -- | Reasoning block ended |
| `tool_call_start` | `toolCallId`, `toolName`, `args` | Tool invocation begins |
| `tool_call_end` | `toolCallId`, `toolName`, `result` | Tool invocation completed |
| `permission_request` | `request: PermissionRequest` | Tool needs approval |
| `permission_response` | `toolName`, `decision: PermissionDecision` | Approval decision |
| `ask_user` | `request: UserInputRequest` | Agent asks user a question |
| `ask_user_response` | `answer: string` | User answered |
| `usage_update` | `promptTokens`, `completionTokens`, `model?`, `backend?` | Token usage report |
| `session_info` | `sessionId`, `transcriptPath?`, `backend` | Session metadata |
| `heartbeat` | -- | Keep-alive signal |
| `error` | `error: string`, `recoverable: boolean`, `code?: ErrorCode` | Error occurred |
| `done` | `finalOutput`, `structuredOutput?`, `streamed?`, `finishReason?` | Stream completed |

### Event Type Definitions

```typescript
type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "thinking_start" }
  | { type: "thinking_end" }
  | { type: "tool_call_start"; toolCallId: string; toolName: string; args: JSONValue }
  | { type: "tool_call_end"; toolCallId: string; toolName: string; result: JSONValue }
  | { type: "permission_request"; request: PermissionRequest }
  | { type: "permission_response"; toolName: string; decision: PermissionDecision }
  | { type: "ask_user"; request: UserInputRequest }
  | { type: "ask_user_response"; answer: string }
  | { type: "usage_update"; promptTokens: number; completionTokens: number; model?: string; backend?: string }
  | { type: "session_info"; sessionId: string; transcriptPath?: string; backend: string }
  | { type: "heartbeat" }
  | { type: "error"; error: string; recoverable: boolean; code?: ErrorCode }
  | { type: "done"; finalOutput: string | null; structuredOutput?: unknown; streamed?: boolean; finishReason?: string };
```

## Basic Streaming

```typescript
const stream = agent.stream("Explain closures", { model: "gpt-4.1" });

for await (const event of stream) {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.text);
      break;
    case "done":
      console.log("\n--- Finished ---");
      break;
    case "error":
      console.error(`Error: ${event.error} (recoverable: ${event.recoverable})`);
      break;
  }
}
```

## Collecting Events by Type

```typescript
async function collectToolCalls(stream: AsyncIterable<AgentEvent>) {
  const toolCalls: Array<{ name: string; args: JSONValue; result: JSONValue }> = [];
  let pending: Map<string, { name: string; args: JSONValue }> = new Map();

  for await (const event of stream) {
    if (event.type === "tool_call_start") {
      pending.set(event.toolCallId, { name: event.toolName, args: event.args });
    }
    if (event.type === "tool_call_end") {
      const start = pending.get(event.toolCallId);
      if (start) {
        toolCalls.push({ name: start.name, args: start.args, result: event.result });
        pending.delete(event.toolCallId);
      }
    }
  }
  return toolCalls;
}
```

## Event Lifecycle

Typical event sequence for a streaming response with tool calls:

```text
session_info
  |
thinking_start
  |
thinking_delta (0..n)
  |
thinking_end
  |
text_delta (0..n)
  |
tool_call_start
  |
permission_request  (if needsApproval)
  |
permission_response (if needsApproval)
  |
tool_call_end
  |
text_delta (0..n)    (agent continues after tool result)
  |
usage_update
  |
done
```

`heartbeat` events can appear at any point. `error` events can interrupt the sequence; check `recoverable` to decide whether to continue.

## Stream Middleware

Middleware transforms the event stream. Type signature:

```typescript
type StreamMiddleware = (
  source: AsyncIterable<AgentEvent>,
  context: StreamContext,
) => AsyncIterable<AgentEvent>;

interface StreamContext {
  model: string;
  backend: string;
  abortController: AbortController;
  config: Readonly<Record<string, unknown>>;
}
```

### Logging Middleware

```typescript
const loggingMiddleware: StreamMiddleware = async function* (source, context) {
  console.log(`Stream started: model=${context.model}, backend=${context.backend}`);
  let eventCount = 0;

  for await (const event of source) {
    eventCount++;
    if (event.type === "error") {
      console.error(`Stream error: ${event.error}`);
    }
    yield event;
  }

  console.log(`Stream ended: ${eventCount} events`);
};
```

### Token Counting Middleware

```typescript
const tokenCounter: StreamMiddleware = async function* (source, context) {
  let totalPrompt = 0;
  let totalCompletion = 0;

  for await (const event of source) {
    if (event.type === "usage_update") {
      totalPrompt += event.promptTokens;
      totalCompletion += event.completionTokens;
      console.log(`Tokens: ${totalPrompt} in / ${totalCompletion} out`);
    }
    yield event;
  }
};
```

### Event Filtering Middleware

```typescript
const noThinking: StreamMiddleware = async function* (source, context) {
  for await (const event of source) {
    if (event.type === "thinking_start" || event.type === "thinking_end" || event.type === "thinking_delta") {
      continue; // suppress thinking events
    }
    yield event;
  }
};
```

### Applying Middleware

Add middleware to an agent instance via `BaseAgent.addStreamMiddleware()`. This method is on `BaseAgent`, not on the `IAgent` interface — use a type assertion if working with the interface type.

```typescript
import { BaseAgent } from "@witqq/agent-sdk";

const agent = service.createAgent({ systemPrompt: "Assistant" });

// addStreamMiddleware is on BaseAgent, not IAgent
(agent as BaseAgent).addStreamMiddleware(loggingMiddleware);
(agent as BaseAgent).addStreamMiddleware(tokenCounter);
(agent as BaseAgent).addStreamMiddleware(noThinking);
```

Middleware executes in order. Each wraps the previous source.

## Abort and Cancel

Use `AbortController` to cancel a stream:

```typescript
const controller = new AbortController();

const stream = agent.stream("Long task", {
  model: "gpt-4.1",
  signal: controller.signal,
});

setTimeout(() => controller.abort(), 5000); // cancel after 5s

try {
  for await (const event of stream) {
    process.stdout.write(event.type === "text_delta" ? event.text : "");
  }
} catch (err) {
  if (err instanceof Error && err.name === "AbortError") {
    console.log("Stream cancelled");
  }
}
```

The `agent.abort()` method cancels the current operation directly:

```typescript
// From another context (e.g., signal handler)
process.on("SIGINT", () => {
  agent.abort();
});
```

`agent.interrupt()` requests a graceful stop. The agent finishes the current tool call, then stops:

```typescript
await agent.interrupt();
```

## Usage Tracking

Subscribe to usage data via config callback or events:

```typescript
// Via config
const config: FullAgentConfig = {
  systemPrompt: "Assistant",
  onUsage: (usage) => {
    console.log(`${usage.model}: ${usage.promptTokens}+${usage.completionTokens} tokens`);
  },
};

// Via stream events
for await (const event of stream) {
  if (event.type === "usage_update") {
    recordUsage(event.promptTokens, event.completionTokens, event.model);
  }
}
```

## Heartbeat

Configure heartbeat interval to detect stalled streams:

```typescript
const config: FullAgentConfig = {
  systemPrompt: "Assistant",
  heartbeatInterval: 10000, // emit heartbeat every 10s of inactivity
};
```

Heartbeat events are useful for keeping connections alive in proxy scenarios.
