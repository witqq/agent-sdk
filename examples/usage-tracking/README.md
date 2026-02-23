# Usage Tracking Middleware

ChatMiddleware example that counts tokens from usage events and persists
cumulative statistics per session.

## Usage

```ts
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
import { createUsageMiddleware, InMemoryUsageStore } from "./usage-middleware";

const usageStore = new InMemoryUsageStore();
const runtime = createChatRuntime({
  middleware: [createUsageMiddleware(usageStore)],
  defaultBackend: "copilot",
  backends: { copilot: () => adapter },
});

// After some conversations:
const stats = await usageStore.getUsage(sessionId);
// { promptTokens: 150, completionTokens: 80, totalTokens: 230, requestCount: 3 }

const total = await usageStore.getTotalUsage();
// Aggregated across all sessions
```

## How It Works

The middleware hooks into the runtime's event pipeline:

1. `onBeforeSend` — resets per-request tracking state
2. `onEvent` — captures `usage` events with token counts
3. `onEvent` (`done`) — persists accumulated usage to the store

## IUsageStore Interface

Implement `IUsageStore` for custom storage backends:

```ts
interface IUsageStore {
  getUsage(sessionId: ChatId): Promise<SessionUsage | null>;
  recordUsage(sessionId: ChatId, usage: UsageRecord): Promise<void>;
  getTotalUsage(): Promise<SessionUsage>;
  listSessions(): Promise<Array<{ sessionId: ChatId; usage: SessionUsage }>>;
  clear(): Promise<void>;
}
```

`InMemoryUsageStore` is provided for development. For production, implement
a persistent store (database, Redis, etc.).
