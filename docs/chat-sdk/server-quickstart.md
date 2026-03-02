# Server Quickstart

Standalone guide for running a Chat SDK HTTP server. See [README.md](./README.md) for the full API reference.

## Minimal Server

```typescript
import * as http from "node:http";
import { createAgentService } from "@witqq/agent-sdk";
import type { AuthToken } from "@witqq/agent-sdk/auth";
import { CopilotAuth } from "@witqq/agent-sdk/auth";
import { CopilotChatAdapter } from "@witqq/agent-sdk/chat/backends";
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
import { createChatServer } from "@witqq/agent-sdk/chat/server";
import { createSQLiteStorage } from "@witqq/agent-sdk/chat/sqlite";

const { sessionStore, providerStore, tokenStore } = createSQLiteStorage("chat.db");

const runtime = createChatRuntime({
  backends: {
    copilot: async (credentials: AuthToken) => {
      const svc = await createAgentService("copilot", {
        githubToken: credentials.accessToken,
      });
      return new CopilotChatAdapter({
        agentConfig: { systemPrompt: "You are a helpful assistant." },
        agentService: svc,
      });
    },
  },
  defaultBackend: "copilot",
  sessionStore,
});

const handler = createChatServer({
  runtime,
  auth: { tokenStore, createCopilotAuth: () => new CopilotAuth() },
  providers: { providerStore },
});

http.createServer(handler).listen(3000);
```

```bash
npm install @witqq/agent-sdk zod better-sqlite3
npx tsx server.ts
```

## Endpoints

`createChatServer` mounts routes under configurable prefixes (defaults shown).

### Chat — `/api/chat`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions/create` | Create a new chat session |
| GET | `/sessions/{id}` | Get session by ID |
| GET | `/sessions` | List all sessions |
| DELETE | `/sessions/{id}` | Delete a session |
| POST | `/send` | Send message (SSE stream response) |
| POST | `/abort` | Abort in-flight stream |
| GET | `/models` | List available models |
| POST | `/model/switch` | Validate model selection |
| POST | `/provider/switch` | Validate provider selection |

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/start` | Start auth flow (device flow, OAuth, or API key) |
| POST | `/auth/copilot/poll` | Poll Copilot device flow completion |
| POST | `/auth/claude/complete` | Exchange Claude OAuth code for token |
| POST | `/auth/vercel/complete` | Submit Vercel AI API key |
| GET | `/tokens/saved` | List providers with saved tokens |
| POST | `/tokens/use` | Activate a saved token |
| POST | `/tokens/clear` | Clear all tokens (logout) |
| POST | `/auth/dispose` | Clear pending flows (logout) |

### Providers — `/api/chat/providers`

Provider CRUD is served under the chat prefix.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/providers` | List all providers |
| GET | `/providers/{id}` | Get provider by ID |
| POST | `/providers` | Create provider |
| PUT | `/providers/{id}` | Update provider |
| DELETE | `/providers/{id}` | Delete provider |

### Health — `/api/health`

Returns `{ ok: true }`. Disable with `healthPath: false`.

## Configuration

`ChatServerOptions` fields:

```typescript
createChatServer({
  runtime,                          // Pre-built IChatRuntime (required, or use runtimeConfig)
  runtimeConfig,                    // Alternative: auto-create runtime from ChatRuntimeOptions
  auth: { tokenStore, createCopilotAuth, createClaudeAuth, onAuth, onLogout },
  providers: { providerStore },
  hooks: { filterModels, onModelSwitch, onBeforeSend, onError },
  chatPrefix: "/api/chat",          // Default
  authPrefix: "/api/auth",          // Default
  providerPrefix: "/api/providers", // Default
  healthPath: "/api/health",        // Default, set false to disable
  cors: { origin: "*" },            // Default: permissive. Set false to disable
  staticDir: "./public",            // Serve static files (optional)
  autoCreateProviders: true,        // Auto-create provider on first auth per backend
});
```

## Multiple Backends

Register multiple backend factories to support Copilot, Claude, and Vercel AI simultaneously:

```typescript
import { ClaudeAuth } from "@witqq/agent-sdk/auth";
import { ClaudeChatAdapter, VercelAIChatAdapter } from "@witqq/agent-sdk/chat/backends";

const runtime = createChatRuntime({
  backends: {
    copilot: async (credentials) => {
      const svc = await createAgentService("copilot", {
        githubToken: credentials.accessToken,
      });
      return new CopilotChatAdapter({
        agentConfig: { systemPrompt: "Assistant" },
        agentService: svc,
      });
    },
    claude: async (credentials) => {
      const svc = await createAgentService("claude", {
        apiKey: credentials.accessToken,
      });
      return new ClaudeChatAdapter({
        agentConfig: { systemPrompt: "Assistant" },
        agentService: svc,
      });
    },
    "vercel-ai": async (credentials) => {
      const svc = await createAgentService("vercel-ai", {
        baseURL: credentials.baseUrl ?? "https://openrouter.ai/api/v1",
        apiKey: credentials.accessToken,
      });
      return new VercelAIChatAdapter({
        agentConfig: { systemPrompt: "Assistant" },
        agentService: svc,
      });
    },
  },
  defaultBackend: "copilot",
  sessionStore,
});

const handler = createChatServer({
  runtime,
  auth: {
    tokenStore,
    createCopilotAuth: () => new CopilotAuth(),
    createClaudeAuth: () => new ClaudeAuth(),
  },
  providers: { providerStore },
  autoCreateProviders: true,
});
```

## Storage Options

### SQLite (recommended)

Single file stores sessions, providers, and tokens. Requires `better-sqlite3` peer dependency.

```typescript
import { createSQLiteStorage } from "@witqq/agent-sdk/chat/sqlite";
const { sessionStore, providerStore, tokenStore } = createSQLiteStorage("chat.db");
```

### In-Memory

No dependencies. Data lost on restart.

```typescript
import { InMemorySessionStore } from "@witqq/agent-sdk/chat/sessions";
import { InMemoryProviderStore, InMemoryTokenStore } from "@witqq/agent-sdk/chat/server";

const sessionStore = new InMemorySessionStore();
const providerStore = new InMemoryProviderStore();
const tokenStore = new InMemoryTokenStore();
```

### File-Based

JSON files on disk. No extra dependencies.

```typescript
import { FileSessionStore } from "@witqq/agent-sdk/chat/sessions";
import { FileProviderStore, FileTokenStore } from "@witqq/agent-sdk/chat/server";

const sessionStore = new FileSessionStore(".data/sessions");
const providerStore = new FileProviderStore(".data/providers");
const tokenStore = new FileTokenStore(".data/tokens");
```

## Server Hooks

Control model access, validate requests, and handle errors:

```typescript
createChatServer({
  runtime,
  hooks: {
    filterModels(models) {
      return models.filter(m => ["gpt-5-mini", "gpt-4.1"].includes(m.id));
    },
    onModelSwitch(model) {
      if (model.startsWith("o1")) throw new Error("Model not allowed");
    },
    onBeforeSend(sessionId, message) {
      if (message.length > 10000) throw new Error("Message too long");
    },
    onError(error, ctx) {
      console.error(`[${ctx.route}] ${error.message}`);
    },
  },
});
```

## Framework Integration

The SDK handler signature `(req: ReadableRequest, res: WritableResponse) => Promise<void>` works with `node:http` directly. For frameworks, see `examples/framework-presets/` for complete adapters.

### ReadableRequest / WritableResponse

The SDK defines minimal interfaces (not tied to any framework):

```typescript
// from @witqq/agent-sdk/chat/server
interface ReadableRequest {
  method?: string;
  url?: string;
  on(event: "data", listener: (chunk: Buffer | string) => void): void;
  on(event: "end", listener: () => void): void;
}

interface WritableResponse {
  writeHead(statusCode: number, headers?: Record<string, string | string[]>): unknown;
  setHeader(name: string, value: string): unknown;
  write(chunk: string): boolean;
  end(body?: string): unknown;
  readonly writableEnded: boolean;
}
```

Framework compatibility:

| Framework | ReadableRequest | WritableResponse | Notes |
|-----------|----------------|-----------------|-------|
| `node:http` | `IncomingMessage` ✅ | `ServerResponse` ✅ | Native, zero adaptation |
| Express | `req` ✅ | `res` ✅ | Natively compatible |
| Fastify | `req.raw` | `reply.raw` | Requires `reply.hijack()` for SSE |
| Hono | Needs shim | Needs shim | Web-standard → node:http bridge |

### Express

```typescript
import express from "express";
import { toExpressMiddleware } from "./express-adapter"; // see examples/framework-presets/

const app = express();
app.use(toExpressMiddleware(handler));
app.listen(3000);
```

Express `req`/`res` objects are natively compatible with the SDK interfaces — the adapter is a one-line wrapper forwarding errors to `next()`.

### Fastify

```typescript
import Fastify from "fastify";
import { registerRoutes } from "./fastify-adapter"; // see examples/framework-presets/

const app = Fastify();
registerRoutes(app, handler, "/api");
app.listen({ port: 3000 });
```

Uses `reply.hijack()` for raw response access (required for SSE streaming).

### Hono

```typescript
import { Hono } from "hono";
import { honoHandler } from "./hono-adapter"; // see examples/framework-presets/

const app = new Hono();
app.all("/api/*", honoHandler(handler));
export default app;
```

Bridges Hono's web-standard `Request`/`Response` to the SDK's `node:http`-style interfaces.

## Tools

Register tools on the runtime for all backends:

```typescript
import type { ToolDefinition } from "@witqq/agent-sdk";
import { z } from "zod";

const searchTool: ToolDefinition = {
  name: "search",
  description: "Search the web",
  parameters: z.object({ query: z.string() }),
  execute: async (args) => {
    return { results: [`Result for: ${args.query}`] };
  },
};

const runtime = createChatRuntime({
  backends: { /* ... */ },
  sessionStore,
  tools: [searchTool],
});
```

## Further Reading

- [Chat SDK README](./README.md) — full module reference and type documentation
- [Custom Transports](./custom-transports.md) — WebSocket, NATS, and custom transport implementations
- [Custom Renderers](./custom-renderers.md) — CSS theming and component customization
- [`examples/demo/`](../../examples/demo/) — complete working demo with Docker support
