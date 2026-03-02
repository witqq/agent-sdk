# agent-sdk

Multi-backend AI agent abstraction layer for Node.js. Switch between Copilot CLI, Claude CLI, and Vercel AI SDK backends with a unified API.

## Install

```bash
npm install @witqq/agent-sdk zod
```

## Backends

`zod` is the only required peer dependency. Backend SDKs are **optional** — install only what you use:

| Backend | Peer dependency | Required | Type |
|---|---|---|---|
| `copilot` | `@github/copilot-sdk` ^0.1.22 | optional | CLI subprocess |
| `claude` | `@anthropic-ai/claude-agent-sdk` >=0.2.0 | optional | CLI subprocess |
| `vercel-ai` | `ai` >=4.0.0 + `@ai-sdk/openai-compatible` >=2.0.0 | optional | API-based |

Install only the backend you need:

```bash
npm install @github/copilot-sdk            # copilot
npm install @anthropic-ai/claude-agent-sdk  # claude
npm install ai @ai-sdk/openai-compatible   # vercel-ai
```

## Quick Start

```typescript
import { createAgentService } from "@witqq/agent-sdk";
import { z } from "zod";

const service = await createAgentService("copilot", { useLoggedInUser: true });

const agent = service.createAgent({
  systemPrompt: "You are a helpful assistant.",
  tools: [
    {
      name: "search",
      description: "Search the web",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ results: [`Result for: ${query}`] }),
    },
  ],
});

const result = await agent.run("Find news about AI");
console.log(result.output);

agent.dispose();
await service.dispose();
```

### Retry on Transient Errors

`BaseAgent` supports automatic retry for transient failures:

```typescript
const agent = service.createAgent({ systemPrompt: "..." });
const result = await agent.run("prompt", {
  model: "gpt-5-mini",
  retry: {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  },
});
```

Retries on transient error codes: `TIMEOUT`, `RATE_LIMIT`, `NETWORK`, `MODEL_OVERLOADED`. Never retries `AbortError`, `ReentrancyError`, or `DisposedError`.

## Tool Definition

Tools are defined with a Zod schema for parameters and an `execute` function:

```typescript
import { z } from "zod";
import type { ToolDefinition } from "@witqq/agent-sdk";

// Basic tool
const searchTool: ToolDefinition = {
  name: "search",
  description: "Search the web",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => ({ results: [`Result for: ${query}`] }),
};

// Tool requiring user approval before execution
const writeFileTool: ToolDefinition = {
  name: "write_file",
  description: "Write content to a file",
  parameters: z.object({ path: z.string(), content: z.string() }),
  needsApproval: true,
  execute: async ({ path, content }) => ({ written: true, path }),
};
```

When `needsApproval: true`, the `supervisor.onPermission` callback is invoked before execution. Without a supervisor, approval-required tools are denied by default.

Runtime-registered tools receive an optional `ToolContext` as their second parameter:

```typescript
import type { ToolContext } from "@witqq/agent-sdk";

const dbTool: ToolDefinition = {
  name: "query_db",
  description: "Query the database",
  parameters: z.object({ sql: z.string() }),
  execute: async (params, context?: ToolContext) => {
    // context.sessionId — current chat session
    // context.custom — session metadata
    return db.query(params.sql);
  },
};
```

## Permission Handling

The `supervisor` hooks intercept permission requests and user-facing questions:

```typescript
const agent = service.createAgent({
  systemPrompt: "File assistant",
  tools: [writeFileTool],
  supervisor: {
    onPermission: async (req, signal) => {
      // req.toolName, req.toolArgs, req.suggestedScope
      console.log(`${req.toolName} wants to run with`, req.toolArgs);
      return {
        allowed: true,
        scope: "session",          // "once" | "session" | "project" | "always"
        // modifiedInput: { ... }, // optionally modify args before execution
        // reason: "...",          // denial reason (if allowed: false)
      };
    },
    onAskUser: async (req, signal) => {
      // req.question, req.choices, req.allowFreeform
      return { answer: "yes", wasFreeform: false };
    },
  },
});
```

## Permission Store

Persist permission decisions across runs so approved tools don't re-prompt:

```typescript
import { createDefaultPermissionStore } from "@witqq/agent-sdk";

const store = createDefaultPermissionStore("./my-project");
const agent = service.createAgent({
  systemPrompt: "File assistant",
  permissionStore: store,
  tools: [writeFileTool],
  supervisor: {
    onPermission: async (req) => ({ allowed: true, scope: "project" }),
  },
});
```

Scopes control persistence:
- `"once"` — not stored, one-time approval
- `"session"` — in-memory, cleared on dispose
- `"project"` — persisted to `<projectDir>/.agent-sdk/permissions.json`
- `"always"` — persisted to `~/.agent-sdk/permissions.json`

Custom stores implement `IPermissionStore`:

```typescript
interface IPermissionStore {
  isApproved(toolName: string): Promise<boolean>;
  approve(toolName: string, scope: PermissionScope): Promise<void>;
  revoke(toolName: string): Promise<void>;
  clear(): Promise<void>;
  dispose(): Promise<void>;
}
```

Built-in stores: `InMemoryPermissionStore` (session-scoped), `FilePermissionStore` (persists to JSON file), `CompositePermissionStore` (chains multiple stores — first match wins, writes to the store matching the scope). `createDefaultPermissionStore(projectDir)` returns a `CompositePermissionStore` combining project-level and global `FilePermissionStore` instances.

## Structured Output

Extract typed data from LLM responses using `runStructured`:

```typescript
import { z } from "zod";

const result = await agent.runStructured(
  "What is the capital of France?",
  {
    schema: z.object({
      city: z.string(),
      country: z.string(),
      population: z.number(),
    }),
    name: "city_info",           // optional, helps the LLM
    description: "City details", // optional
  },
);

console.log(result.structuredOutput);
// { city: "Paris", country: "France", population: 2161000 }
```

The Vercel AI backend uses `generateObject()` for structured output. Copilot and Claude backends extract structured data from the LLM text response.

## Streaming Events

All backends emit the same event types:

```typescript
for await (const event of agent.stream("Tell me a story")) {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.text);
      break;
    case "tool_call_start":
      console.log(`Calling ${event.toolName}`, event.args);
      break;
    case "tool_call_end":
      console.log(`${event.toolName} returned`, event.result);
      break;
    case "error":
      console.error(event.error, "recoverable:", event.recoverable);
      break;
    case "done":
      console.log("Final:", event.finalOutput);
      break;
  }
}
```

### Streaming with Conversation History

Use `streamWithContext` to stream with full conversation history:

```typescript
const messages = [
  { role: "system" as const, content: "You are helpful." },
  { role: "user" as const, content: "Hello" },
  { role: "assistant" as const, content: "Hi! How can I help?" },
  { role: "user" as const, content: "What is 2+2?" },
];

for await (const event of agent.streamWithContext(messages)) {
  if (event.type === "text_delta") process.stdout.write(event.text);
}
```

| Event | Fields | Description |
|-------|--------|-------------|
| `text_delta` | `text` | Incremental text output |
| `thinking_delta` | `text` | Incremental reasoning/thinking text |
| `thinking_start` | — | Model started reasoning |
| `thinking_end` | — | Model finished reasoning |
| `tool_call_start` | `toolCallId`, `toolName`, `args` | Tool invocation began |
| `tool_call_end` | `toolCallId`, `toolName`, `result` | Tool invocation completed |
| `permission_request` | `request` | Permission check initiated |
| `permission_response` | `toolName`, `decision` | Permission decision made |
| `ask_user` | `request` | User input requested |
| `ask_user_response` | `answer` | User response received |
| `session_info` | `sessionId`, `transcriptPath?`, `backend` | CLI session metadata (streaming only) |
| `usage_update` | `promptTokens`, `completionTokens`, `model?`, `backend?` | Token usage with metadata |
| `heartbeat` | — | Keepalive signal during long operations |
| `error` | `error`, `recoverable` | Error during execution |
| `done` | `finalOutput`, `structuredOutput?` | Execution completed |

## Usage Tracking

Track token usage with the `onUsage` callback. Called after each `run()`/`runWithContext()`/`runStructured()` completion and during `stream()`/`streamWithContext()` when usage data arrives:

```typescript
const agent = service.createAgent({
  systemPrompt: "You are a helpful assistant.",
  onUsage: (usage) => {
    console.log(`${usage.backend}/${usage.model}: ${usage.promptTokens}+${usage.completionTokens} tokens`);
  },
});
```

Usage data includes `promptTokens`, `completionTokens`, and optional `model` and `backend` fields. Callback errors are logged but not propagated (fire-and-forget).

## Heartbeat

Keep HTTP streams alive during long tool executions by emitting periodic heartbeat events:

```typescript
const agent = service.createAgent({
  systemPrompt: "You are a helpful assistant.",
  heartbeatInterval: 15000, // emit heartbeat every 15s during gaps
});

for await (const event of agent.stream("Run a long analysis")) {
  if (event.type === "heartbeat") continue; // ignore keepalive
  // handle other events...
}
```

When `heartbeatInterval` is set, heartbeat events are emitted during streaming gaps (e.g., while a tool executes). No heartbeats are emitted when backend events flow continuously. The timer is cleaned up when the stream completes, errors, or is aborted.

## Persistent Sessions (CLI Backends)

CLI backends (Copilot, Claude) create a fresh subprocess session per `run()`/`stream()` call by default. Set `sessionMode: "persistent"` to reuse the same CLI session across calls — the CLI backend maintains conversation history natively:

```typescript
const agent = service.createAgent({
  systemPrompt: "You are a helpful assistant.",
  sessionMode: "persistent", // reuse CLI session across calls
});

await agent.run("My name is Alice");
const result = await agent.run("What is my name?");
// result.output contains "Alice" — history maintained by CLI

console.log(agent.sessionId); // CLI session ID for external tracking
agent.dispose(); // destroys the persistent session
```

In persistent mode, if a session encounters an error, it is automatically cleared and recreated on the next call. The `sessionId` property exposes the CLI session ID for logging or external storage.

### Interrupting Running Operations

Call `interrupt()` to gracefully stop a running operation. For CLI backends, this calls the SDK's interrupt/abort method on the active session:

```typescript
// In another context (e.g., timeout handler)
await agent.interrupt();
```

Default (`"per-call"`): each call creates and destroys a fresh session. Multi-message context is passed via prompt augmentation through `runWithContext()`/`streamWithContext()`.

API-based backends (Vercel AI) ignore `sessionMode` — they are stateless by design.

## Backend-Specific Options

### Copilot

```typescript
import { createCopilotService } from "@witqq/agent-sdk/copilot";

const service = createCopilotService({
  useLoggedInUser: true,          // use GitHub CLI auth
  cliPath: "/path/to/copilot",   // optional custom CLI path
  workingDirectory: process.cwd(),
  githubToken: "ghp_...",        // optional, alternative to useLoggedInUser
  cliArgs: ["--allow-all"],      // extra CLI flags for the subprocess
  env: { PATH: "/custom/bin" },  // custom env vars for subprocess
});
```

**System requirements:** `@github/copilot-sdk` includes a native binary that requires glibc. Alpine Linux (musl) is not supported — use `node:20-bookworm-slim` or similar glibc-based images.

**Headless defaults:** When `supervisor.onPermission` or `supervisor.onAskUser` are not provided, the Copilot backend auto-approves permission requests and auto-answers user questions to prevent the SDK from hanging in headless mode.

**System prompt mode:** By default, `systemPrompt` is appended to the Copilot CLI's built-in prompt (`mode: "append"`). Set `systemMessageMode: "replace"` in `AgentConfig` to fully replace it (note: this removes built-in tool instructions).

**Available tools filter:** Use `availableTools` in `AgentConfig` to restrict which Copilot built-in tools are available:

```typescript
const agent = service.createAgent({
  systemPrompt: "Research assistant",
  tools: [],
  availableTools: ["web_search", "web_fetch"], // only these built-in tools
});
```

### Claude

```typescript
import { createClaudeService } from "@witqq/agent-sdk/claude";

const service = createClaudeService({
  cliPath: "/path/to/claude",    // optional custom CLI path
  workingDirectory: process.cwd(),
  maxTurns: 10,
  env: { CLAUDE_CONFIG_DIR: "/custom/config" }, // custom env vars for subprocess
});
```

`supervisor.onAskUser` is not supported by the Claude backend; a warning is emitted if set.

When `supervisor.onPermission` is set, the Claude backend automatically sets `permissionMode: "default"` so the CLI invokes the callback instead of using built-in rules.

### Vercel AI (OpenRouter / OpenAI-compatible)

```typescript
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";

const service = createVercelAIService({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseUrl: "https://openrouter.ai/api/v1", // default
  provider: "openrouter",                   // default
});

const agent = service.createAgent({
  model: "anthropic/claude-sonnet-4-5",
  systemPrompt: "You are a helpful assistant.",
  tools: [searchTool],
});
```

Uses `generateText()` for runs, `generateObject()` for structured output, `streamText()` for streaming. Supports `supervisor.onAskUser` via an injected `ask_user` tool.

Pass model-specific options via `providerOptions`:

```typescript
const agent = service.createAgent({
  model: "google/gemini-2.0-flash",
  systemPrompt: "Think step by step.",
  providerOptions: {
    google: { thinkingConfig: { thinkingBudget: 1024 } },
  },
});
```

## Switching Backends

All backends share the same `AgentConfig` and return the same `AgentResult`. To switch backends, change only the service creation:

```typescript
import { createAgentService } from "@witqq/agent-sdk";
import { z } from "zod";

const tools = [
  {
    name: "greet",
    description: "Greet a user",
    parameters: z.object({ name: z.string() }),
    execute: async ({ name }) => ({ message: `Hello, ${name}!` }),
  },
];

const config = {
  systemPrompt: "You are a helpful assistant.",
  tools,
};

// Switch backend by changing the first argument:
const service = await createAgentService("copilot", { useLoggedInUser: true });
// const service = await createAgentService("claude", { workingDirectory: "." });
// const service = await createAgentService("vercel-ai", { apiKey: "..." });

const agent = service.createAgent(config);
const result = await agent.run("Greet Alice");
```

Or use direct backend imports to avoid lazy loading:

```typescript
import { createCopilotService } from "@witqq/agent-sdk/copilot";
import { createClaudeService } from "@witqq/agent-sdk/claude";
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";
```

## Model Names

`AgentConfig.model` accepts both full model IDs and short names:

| Backend | Full ID example | Short name |
|---|---|---|
| Copilot | `gpt-4o` | (same) |
| Claude | `claude-sonnet-4-5-20250514` | `sonnet` |
| Vercel AI | `anthropic/claude-sonnet-4-5` | (provider-specific) |

Use `service.listModels()` to get available model IDs for each backend. Copilot lists models from GitHub API. Claude queries the Anthropic `/v1/models` endpoint when `oauthToken` is provided (returns empty list without token). Vercel AI queries the provider's `/models` endpoint (returns empty list on failure).

## Build

```bash
npm run build     # tsup → ESM + CJS
npm run test      # vitest
npm run typecheck  # tsc --noEmit
```

## Authentication

Programmatic OAuth flows for obtaining tokens without manual terminal interaction.

```typescript
import { CopilotAuth, ClaudeAuth } from "@witqq/agent-sdk/auth";
```

### Copilot (GitHub Device Flow)

```typescript
const auth = new CopilotAuth();
const { verificationUrl, userCode, waitForToken } = await auth.startDeviceFlow();

// Show the user: open verificationUrl and enter userCode
console.log(`Open ${verificationUrl} and enter code: ${userCode}`);

const token = await waitForToken(); // polls until authorized
// token.accessToken = "gho_..." (long-lived, no expiration)

// Use with Copilot backend:
const service = createCopilotService({ githubToken: token.accessToken });
```

### Claude (OAuth + PKCE)

```typescript
const auth = new ClaudeAuth();
const { authorizeUrl, completeAuth } = auth.startOAuthFlow();

// Open authorizeUrl in browser — user authorizes, gets redirected
// completeAuth accepts raw code, full redirect URL, or code#state format
console.log(`Open: ${authorizeUrl}`);

const token = await completeAuth(codeOrUrl);
// token.accessToken = "sk-ant-oat01-..." (expires in 8h, has refreshToken)

// Refresh before expiry:
const refreshed = await auth.refreshToken(token.refreshToken);

// Use with Claude backend:
const service = createClaudeService({ oauthToken: token.accessToken });
```

### Token Types

```typescript
interface AuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;   // seconds until expiry (undefined = long-lived)
  obtainedAt: number;   // Date.now() when token was obtained
}

interface ClaudeAuthToken extends AuthToken {
  refreshToken: string; // for refreshing expired tokens
  scopes: string[];
}

interface CopilotAuthToken extends AuthToken {
  login?: string;       // GitHub username
}
```

### Token Auto-Refresh

`TokenRefreshManager` schedules background token refresh before expiry:

```typescript
import { TokenRefreshManager } from "@witqq/agent-sdk/auth";

const manager = new TokenRefreshManager({
  token: authToken,
  refreshFn: async (token) => claudeAuth.refreshToken(token.refreshToken!),
  refreshThreshold: 0.8, // refresh at 80% of token lifetime
});

manager.on("refreshed", (newToken) => { /* update stored token */ });
manager.on("expired", () => { /* re-authenticate */ });
manager.start();
```

## Chat SDK (experimental)

Higher-level primitives for building AI chat applications on top of agent-sdk.

### Composable Architecture

The SDK is layered — use only what you need:

**Standalone agent** (no server, no UI):

```typescript
import { createAgentService } from "@witqq/agent-sdk";
const service = await createAgentService("copilot", { useLoggedInUser: true });
const agent = service.createAgent({ systemPrompt: "You are helpful." });
const result = await agent.run("Hello");
```

**Server with runtime** (add HTTP layer):

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
      const svc = await createAgentService("copilot", { githubToken: credentials.accessToken });
      return new CopilotChatAdapter({ agentConfig: { systemPrompt: "Hello" }, agentService: svc });
    },
  },
  defaultBackend: "copilot", sessionStore,
});

const handler = createChatServer({
  runtime,
  auth: { tokenStore, createCopilotAuth: () => new CopilotAuth() },
  providers: { providerStore },
});
http.createServer(handler).listen(3000);
```

**Full-stack with React** (add frontend):

```typescript
// frontend — 4 lines
import { ChatUI, RemoteChatClient } from "@witqq/agent-sdk/chat/react";

const runtime = new RemoteChatClient({ baseUrl: "/api/chat" });
<ChatUI runtime={runtime} authBaseUrl="/api" />
```

### Barrel Import

For most consumer apps, import common types from the barrel:

```typescript
// Core types and runtime (barrel export)
import {
  ChatMessage, ChatSession, ChatEvent, IChatRuntime,
  createChatRuntime, ChatError, classifyError,
  MessageAccumulator, SSEChatTransport,
} from "@witqq/agent-sdk/chat";

// React hooks and components (separate import — not in barrel)
import {
  useChat, useRemoteChat, useRemoteAuth,
  ChatProvider, Thread, Composer,
} from "@witqq/agent-sdk/chat/react";
```

### Individual Module Imports

```typescript
import { ChatMessage, ChatSession, isChatMessage } from "@witqq/agent-sdk/chat/core";
import type { IChatBackend } from "@witqq/agent-sdk/chat/backends";
import {
  classifyError, withRetry, isRetryable,
  ChatError, ErrorCode,
  ExponentialBackoffStrategy
} from "@witqq/agent-sdk/chat/errors";
import { ChatEventBus } from "@witqq/agent-sdk/chat/events";
import { filterEvents, collectText } from "@witqq/agent-sdk/chat/events";
import {
  InMemoryStorage, FileStorage,
  type IStorageAdapter, StorageError
} from "@witqq/agent-sdk/chat/storage";
import {
  InMemorySessionStore, FileSessionStore,
  type IChatSessionStore
} from "@witqq/agent-sdk/chat/sessions";
import {
  ContextWindowManager, estimateTokens
} from "@witqq/agent-sdk/chat/context";
import {
  CopilotChatAdapter, VercelAIChatAdapter, BaseBackendAdapter,
  SSEChatTransport, WsChatTransport, InProcessChatTransport,
  streamToTransport, withInterceptors,
  type IResumableBackend, type BackendAdapterOptions, type IChatTransport
} from "@witqq/agent-sdk/chat/backends";
```

### Error Classification

```typescript
try {
  await provider.send(message);
} catch (err) {
  const classified = classifyError(err);
  if (classified.code === ErrorCode.RATE_LIMIT) {
    console.log(`Rate limited, retry after ${classified.retryAfter}ms`);
  }
}
```

### Retry with Backoff

```typescript
const result = await withRetry(
  () => provider.send(message),
  new ExponentialBackoffStrategy({ maxAttempts: 3 }),
  { signal: AbortSignal.timeout(30_000) },
);
```

### Event Bus with Middleware

```typescript
const bus = new ChatEventBus();

// Logging middleware
bus.use((ctx) => {
  console.log(`[${ctx.event.type}]`);
  ctx.next();
});

// Filter out heartbeat events
bus.use((ctx) => {
  if (ctx.event.type === "heartbeat") ctx.suppress();
  else ctx.next();
});

bus.on("message:delta", (event) => console.log(event.text));
```

### Storage Adapters

```typescript
// In-memory (dev/testing)
const mem = new InMemoryStorage<ChatSession>();
await mem.create("s1", session);
const s = await mem.get("s1"); // deep copy, mutation-safe

// File-based (persistence)
const fs = new FileStorage<ChatSession>({ directory: "./data/sessions" });
await fs.create("s1", session);
const items = await fs.query({
  filter: (s) => s.metadata.tags.includes("important"),
  sort: (a, b) => b.updatedAt - a.updatedAt,
  limit: 10,
});
```

### Session Store

```typescript
const store = new InMemorySessionStore();
// or: new FileSessionStore({ directory: "./data/sessions" })

const session = await store.createSession({
  config: { model: "gpt-4", backend: "vercel-ai" },
  title: "Code Review",
  tags: ["work"],
});

await store.appendMessage(session.id, message);
const page = await store.loadMessages(session.id, { limit: 20, offset: 0 });
// page.messages, page.total, page.hasMore

const results = await store.searchSessions({ query: "typescript" });
```

### Context Window Manager

```typescript
const manager = new ContextWindowManager({
  maxTokens: 4096,
  reservedTokens: 500,
  strategy: "truncate-oldest", // or "sliding-window", "summarize-placeholder"
});

const result = manager.fitMessages(messages);
// result.messages — trimmed to fit budget
// result.wasTruncated — whether messages were removed
// result.totalTokens — estimated token usage
// result.removedCount — how many messages were dropped

// Async variant with optional summarizer (summarize-placeholder strategy)
const asyncManager = new ContextWindowManager({
  maxTokens: 4096,
  strategy: "summarize-placeholder",
  summarizer: async (removed) => {
    // Call LLM or custom logic to summarize removed messages
    return `Summary of ${removed.length} messages: ...`;
  },
});
const asyncResult = await asyncManager.fitMessagesAsync(messages);

// Per-message estimation
const tokens = estimateTokens(message); // ~chars/4
```

### Backend Adapters

Backend adapters bridge `IAgentService` to `IChatBackend`, adding session management and resume support:

```typescript
import { CopilotChatAdapter } from "@witqq/agent-sdk/chat/backends";

const adapter = new CopilotChatAdapter({
  agentConfig: {
    systemPrompt: "You are a helpful assistant.",
    model: "gpt-4.1",
  },
});

// Stream a message (creates persistent session automatically)
for await (const event of adapter.streamMessage(session, "Hello")) {
  // ChatEvent: text_delta, message_start, message_complete, tool_call_start, etc.
}

// Resume a previous session
if (adapter.canResume()) {
  for await (const event of adapter.resume(session, adapter.backendSessionId!)) {
    // Continues the existing conversation
  }
}

adapter.dispose();
```

`IResumableBackend` extends `IChatBackend` with `canResume()`, `resume()`, and `backendSessionId`. Built-in adapters: `CopilotChatAdapter`, `ClaudeChatAdapter`, `VercelAIChatAdapter` (stateless, no resume). Create custom adapters by extending `BaseBackendAdapter`.

Service ownership: when `agentService` is passed via options, the adapter does **not** dispose it — the caller retains ownership. When omitted, the adapter creates and owns its service internally.

### Chat Transport

`IChatTransport` abstracts event delivery to clients. Three built-in implementations:

| Transport | Use case |
|---|---|
| `SSEChatTransport` | Server-Sent Events over HTTP |
| `WsChatTransport` | WebSocket via `WebSocketLike` abstraction |
| `InProcessChatTransport` | Zero-network async iterable for testing/embedded |

`streamToTransport()` pipes adapter events to any transport:

```typescript
import { SSEChatTransport, WsChatTransport, streamToTransport } from "@witqq/agent-sdk/chat/backends";

const transport = new SSEChatTransport(res);
await streamToTransport(adapter.streamMessage(session, message), transport);
```

**Interceptors** wrap any transport with composable hooks (logging, metrics, rate limiting):

```typescript
import { withInterceptors, type TransportInterceptor } from "@witqq/agent-sdk/chat/backends";

const logger: TransportInterceptor = {
  beforeSend(event) { console.log("send:", event.type); return event; },
  onError(err) { console.error(err); },
};
const wrapped = withInterceptors(transport, [logger]);
```

**Stream watchdog** — set `streamTimeoutMs` in runtime options to abort hanging streams:

```typescript
const runtime = createChatRuntime({
  streamTimeoutMs: 30_000, // abort after 30s of inactivity
  // ...
});
```

See [Custom Transports](docs/chat-sdk/custom-transports.md) for the implementation guide.

### Chat Runtime

`IChatRuntime<TMetadata>` is the unified facade that orchestrates backend adapters, sessions, context trimming, streaming, and middleware. `createChatRuntime()` builds one from a config:

```typescript
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";

const runtime = createChatRuntime({
  backends: {
    copilot: async (credentials) => new CopilotChatAdapter({
      agentConfig: { systemPrompt: "Hello" },
      agentService: await createAgentService("copilot", { githubToken: credentials.accessToken }),
    }),
  },
  defaultBackend: "copilot",
  sessionStore: new InMemorySessionStore(),
  context: { maxTokens: 8000 },
});

// Create session, send message, stream events
const session = await runtime.createSession();
for await (const event of runtime.send(session.id, "Hello")) {
  console.log(event.type, event);
}
```

Key capabilities: session delegation (create/get/list/delete), tool registration via `registerTool(def)` / `removeTool(name)` / `registeredTools` (readonly Map, persists across switches), middleware pipeline (`use(middleware)`), state machine (`status` property), abort support (`abort()`), pre-stream retry with `StreamRetryConfig`, session lifecycle events via `onSessionChange(callback)`, generic `<TMetadata>` for typed session metadata, context stats via `getContextStats(sessionId)`, and `dispose()`. Model and backend are passed per-call via `send(sessionId, msg, { model, backend, credentials })`.

Context monitoring:

```typescript
// Query context usage after send
const stats = runtime.getContextStats(session.id);
// stats: { totalTokens, removedCount, wasTruncated, availableBudget, realPromptTokens?, realCompletionTokens?, modelContextWindow? } | null

// Handle trimmed messages via callback
const runtime = createChatRuntime({
  // ...backends, sessionStore, context
  onContextTrimmed: (sessionId, removedMessages) => {
    db.saveRemovedMessages(sessionId, removedMessages);
  },
});
```

### Server Utilities

Framework-agnostic HTTP handlers for serving `IChatRuntime` over HTTP. Import from `@witqq/agent-sdk/chat/server`.

```typescript
import {
  createChatHandler,
  createAuthHandler,
  FileTokenStore,
  corsMiddleware,
  createChatServer,
} from "@witqq/agent-sdk/chat/server";
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";

const runtime = createChatRuntime({ /* ... */ });

// Option 1: Compose handlers manually
const chatHandler = createChatHandler(runtime, { prefix: "/api/chat" });
const authHandler = createAuthHandler({
  tokenStore: new FileTokenStore({ directory: "./tokens" }),
  onAuth: (backend, token) => { /* handle auth */ },
});

// Option 2: One-call server factory
const handler = createChatServer({
  runtime,
  cors: true,
  staticDir: "./public",
});
```

`createChatHandler` maps all 10 `RemoteChatClient` endpoints (session CRUD, send via SSE, abort, models, backend/model switch). `createAuthHandler` handles Copilot Device Flow, Claude OAuth+PKCE, and API key auth with persistent token storage via `ITokenStore`. `corsMiddleware` supports multi-origin configuration.

## Interactive Demo

Complete chat app showcasing the full SDK.

```bash
npm run demo              # Build & start in Docker (http://localhost:3456)
npm run demo -- stop      # Stop
npm run demo -- logs      # Follow logs
npm run demo -- restart   # Rebuild & restart
npm run demo -- dev       # Local dev without Docker
```

Features: multi-backend auth (Copilot Device Flow, Claude OAuth+PKCE, Vercel AI API key), provider management, model selection, SSE streaming with thinking blocks, tool calls with approval, token usage display, error handling, session management, SQLite persistence.

Server uses `createChatServer` for zero custom routing with stateless backend factories (credentials per-request). Frontend uses `ChatUI` for zero custom components. See [demo README](examples/demo/README.md) for details.

## React Bindings

Headless React hooks and components for building chat UIs:

```typescript
import { useChat, Thread, Composer, ChatProvider } from "@witqq/agent-sdk/chat/react";

function App() {
  return (
    <ChatProvider runtime={runtime}>
      <Thread />
      <Composer />
    </ChatProvider>
  );
}
```

For client-server architectures, `useRemoteChat` manages the full auth → runtime → session lifecycle:

```typescript
import { useRemoteChat, ChatProvider, Thread, Composer } from "@witqq/agent-sdk/chat/react";

function App() {
  const chat = useRemoteChat({
    chatBaseUrl: "/api/chat",
    authBaseUrl: "/api",
    backend: "copilot",
  });

  if (chat.phase !== "ready" || !chat.runtime) return <div>Loading...</div>;

  return (
    <ChatProvider runtime={chat.runtime}>
      <Thread />
      <Composer />
    </ChatProvider>
  );
}
```

Or use `RemoteChatClient` directly for lower-level control:

```typescript
import { RemoteChatClient } from "@witqq/agent-sdk/chat/react";

const runtime = new RemoteChatClient({ baseUrl: "/api/chat" });
```

Reactive session list (replaces manual polling):

```typescript
import { useSessions } from "@witqq/agent-sdk/chat/react";

function SessionList() {
  const { sessions, loading } = useSessions();
  // Auto-updates on create, delete, and message send
  return sessions.map(s => <div key={s.id}>{s.title}</div>);
}
```

Server-delegated authentication (no `node:crypto` in browser):

```typescript
import { useRemoteAuth } from "@witqq/agent-sdk/chat/react";

const auth = useRemoteAuth({ backend: "copilot", baseUrl: "/api" });
// auth.startDeviceFlow(), auth.startOAuthFlow(), auth.submitApiKey()
```

`ContextStatsDisplay` renders context window usage:

```typescript
import { ContextStatsDisplay } from "@witqq/agent-sdk/chat/react";

// Headless component rendering context window stats
// Props: { stats: ContextStats | null }
// Data attributes: data-context-stats, data-context-tokens, data-context-budget,
//   data-context-usage, data-context-removed, data-context-truncated
<ContextStatsDisplay stats={runtime.getContextStats(sessionId)} />
```

`ThreadList` supports search:

```typescript
<ThreadList
  sessions={sessions}
  onSelect={handleSelect}
  onDelete={handleDelete}
  searchQuery={query}                // controlled search input
  onSearchChange={setQuery}          // search input change handler
/>
```

See [Chat SDK docs](docs/chat-sdk/README.md) for the full React API reference.

## Documentation

| Document | Description |
|----------|-------------|
| [Chat SDK Modules](docs/chat-sdk/README.md) | Module-by-module API docs for chat primitives |
| [Custom Transports](docs/chat-sdk/custom-transports.md) | Guide to building custom IChatTransport implementations |
| [Custom Renderers](docs/chat-sdk/custom-renderers.md) | Three approaches to customizing React UI components |
| [Demo App](examples/demo/README.md) | Full-stack demo with architecture and API reference |
| [Changelog](CHANGELOG.md) | Release history and breaking changes |

## License

MIT
