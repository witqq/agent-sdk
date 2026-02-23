# Multi-User Runtime Manager

Per-user `IChatRuntime` instance management with LRU cache eviction and idle timeout disposal.

## Problem

`IChatRuntime` is designed for single-user sessions. Multi-tenant deployments need:
- Per-user runtime isolation (separate sessions, backends, API keys)
- Bounded memory via cache eviction
- Idle resource cleanup

## Usage

```typescript
import { MultiUserRuntimeManager } from "./multi-user-manager";
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
import { InMemorySessionStore } from "@witqq/agent-sdk/chat/sessions";

const manager = new MultiUserRuntimeManager({
  maxUsers: 100,
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  createRuntime: async (userId, config) => {
    return createChatRuntime({
      defaultBackend: "vercel-ai",
      backends: {
        "vercel-ai": () => createVercelAdapter({
          apiKey: config?.apiKey ?? process.env.DEFAULT_API_KEY,
        }),
      },
      sessionStore: new InMemorySessionStore(),
    });
  },
  onEvict: (userId) => console.log(`Evicted runtime for ${userId}`),
});

// HTTP handler example
app.post("/chat/send", async (req, res) => {
  const userId = req.auth.userId;
  const runtime = await manager.getRuntime(userId, { apiKey: req.auth.apiKey });
  // Use runtime.send() ...
});

// Cleanup on shutdown
process.on("SIGTERM", () => manager.dispose());
```

## API

### `MultiUserRuntimeManager`

| Method | Description |
|---|---|
| `getRuntime(userId, config?)` | Get or create runtime. Concurrent calls share creation promise. |
| `has(userId)` | Check if runtime is cached |
| `evict(userId)` | Remove and dispose runtime |
| `activeUsers()` | List user IDs (most recent first) |
| `dispose()` | Dispose all runtimes |
| `size` | Number of cached runtimes |
| `isDisposed` | Whether manager is disposed |

### `MultiUserManagerOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `createRuntime` | `RuntimeFactory` | required | Factory for per-user runtimes |
| `maxUsers` | `number` | 100 | LRU cache capacity |
| `idleTimeoutMs` | `number` | 0 | Idle timeout (0 = disabled) |
| `onEvict` | `(userId) => void` | - | Eviction callback |

## Bring-Your-Own-Key Pattern

Pass user API credentials via `UserRuntimeConfig`:

```typescript
const runtime = await manager.getRuntime("user-123", {
  apiKey: "sk-user-provided-key",
  defaultModel: "gpt-4",
});
```

The `createRuntime` factory receives this config and wires it into the backend adapter.
