# Chat SDK

Modular chat modules for building AI chat applications on top of `@witqq/agent-sdk`, with each module as a separate entry point.

## Install

```bash
npm install @witqq/agent-sdk zod
```

No additional dependencies required. The chat modules are included in the main package.

## Quick Start

```typescript
import { MessageAccumulator } from "@witqq/agent-sdk/chat/accumulator";
import { ChatEventBus } from "@witqq/agent-sdk/chat/events";
import { agentEventToChatEvent, createChatId } from "@witqq/agent-sdk/chat/core";
import type { AgentEvent } from "@witqq/agent-sdk";

// Convert agent events into a ChatMessage
const acc = new MessageAccumulator();
const bus = new ChatEventBus();
const messageId = createChatId();
bus.on("message:delta", (e) => console.log(e.text));

for await (const event of agentStream) {
  acc.apply(event);
  const chatEvent = agentEventToChatEvent(event, messageId);
  if (chatEvent) bus.emit(chatEvent.type, chatEvent);
}
const message = acc.finalize();
```

## Modules

| Module | Import | Description |
|---|---|---|
| Core | `@witqq/agent-sdk/chat/core` | Types, type guards, agent↔chat event bridge |
| Events | `@witqq/agent-sdk/chat/events` | Typed event emitter, middleware pipeline |
| Errors | `@witqq/agent-sdk/chat/errors` | Error classification, retry strategies |
| Storage | `@witqq/agent-sdk/chat/storage` | Generic key-value storage adapters |
| Sessions | `@witqq/agent-sdk/chat/sessions` | Session store with message pagination |
| Context | `@witqq/agent-sdk/chat/context` | Token estimation, context window management |
| Accumulator | `@witqq/agent-sdk/chat/accumulator` | Stream-to-message converter |
| State | `@witqq/agent-sdk/chat/state` | State machines, reentrancy guard, abort controller |
| Backends | `@witqq/agent-sdk/chat/backends` | Backend adapters, SSE transport, streaming pipeline |
| Runtime | `@witqq/agent-sdk/chat/runtime` | Unified facade: session, streaming, middleware orchestration |

## Core Types (`chat/core`)

Defines the foundational types for messages, sessions, events, and the provider interface.

```typescript
import {
  createChatId,
  getMessageText,
  agentEventToChatEvent,
  adaptAgentEvents,
} from "@witqq/agent-sdk/chat/core";
import type {
  ChatMessage,
  ChatSession,
  ChatEvent,
  ChatId,
  IChatProvider,
  MessagePart,
} from "@witqq/agent-sdk/chat/core";
```

**Key types:**
- `ChatMessage<TMetadata>` — message with `id`, `role`, `parts`, `status`, `metadata`
- `ChatSession<TCustom>` — session with messages, config, metadata, and status. `TCustom` defaults to `Record<string, unknown>` for the `metadata.custom` field
- `ChatEvent` — 18-variant discriminated union (`message:start`, `message:delta`, `message:complete`, `tool:start`, `tool:complete`, `thinking:start`, `thinking:delta`, `thinking:end`, `done`, `error`, etc.)
- `IChatProvider` — provider interface with `sendMessage()`, `streamMessage()`, `listModels()`, `validate()`, `dispose()`
- `MessagePart` — union of `TextPart`, `ReasoningPart`, `ToolCallPart`, `SourcePart`, `FilePart`

**Utility functions:**
- `createChatId()` — generate a branded `ChatId`
- `getMessageText(message)` — extract text content from all parts
- `getMessageToolCalls(message)` — extract tool call parts from a message
- `getMessageReasoning(message)` — extract reasoning parts from a message
- `extractToolResults(message)` — extract tool results as `ToolResult[]`
- `agentEventToChatEvent(event, messageId)` — convert a single `AgentEvent` to `ChatEvent`
- `adaptAgentEvents(events, messageId)` — convert an async iterable of agent events to chat events
- `toAgentMessage(message)` / `fromAgentMessage(message)` — bidirectional message conversion
- Type guards: `isChatMessage()`, `isChatSession()`, `isChatEvent()`, `isTextPart()`, `isToolCallPart()`, `isReasoningPart()`, `isMessagePart()`, `isSourcePart()`, `isFilePart()`

## Event System (`chat/events`)

Typed event emitter with middleware pipeline for chat events.

```typescript
import { ChatEventBus, collectText, filterEvents } from "@witqq/agent-sdk/chat/events";

const bus = new ChatEventBus();

// Subscribe to specific events
const unsubscribe = bus.on("message:delta", (event) => {
  console.log(event.text);
});

// Add middleware (runs before listeners)
bus.use((ctx) => {
  console.log("Event:", ctx.event.type);
  ctx.next();
});

bus.emit("message:delta", { type: "message:delta", messageId, text: "Hello" });

// Async iterable utilities
const text = await collectText(chatEventStream);
const messageEvents = filterEvents(chatEventStream, "message:start", "message:delta", "message:complete");
```

**Classes:**
- `TypedEventEmitter<T>` — generic emitter with `on()`, `once()`, `off()`, `emit()`
- `ChatEventBus` — extends `TypedEventEmitter` with `use(middleware)` for event pipeline

**Functions:**
- `eventFilter(...types)` — create a predicate for filtering event types
- `filterEvents(source, ...types)` — filter an async iterable of events
- `mapEvents(source, transform)` — transform an async iterable of events
- `collectText(source)` — collect all `message:delta` text into a string

## Error Handling (`chat/errors`)

Error classification and retry strategies with 19 error codes.

```typescript
import { classifyError, withRetry, ChatError, ChatErrorCode, ExponentialBackoffStrategy } from "@witqq/agent-sdk/chat/errors";

try {
  await fetch(url);
} catch (err) {
  const chatError = classifyError(err);
  console.log(chatError.code);      // ChatErrorCode.NETWORK
  console.log(chatError.retryable);  // true
}

// Retry with exponential backoff
const result = await withRetry(
  () => fetchData(),
  new ExponentialBackoffStrategy({ maxAttempts: 3, baseMs: 1000 }),
  { signal: abortController.signal }
);
```

**Error codes:** `NETWORK`, `TIMEOUT`, `AUTH_EXPIRED`, `AUTH_INVALID`, `RATE_LIMIT`, `PROVIDER_ERROR`, `MODEL_NOT_FOUND`, `MODEL_OVERLOADED`, `CONTEXT_OVERFLOW`, `INVALID_INPUT`, `INVALID_RESPONSE`, `PERMISSION_DENIED`, `BACKEND_NOT_INSTALLED`, `SESSION_NOT_FOUND`, `STORAGE_ERROR`, `DISPOSED`, `ABORTED`, `INVALID_TRANSITION`, `REENTRANCY`

**Functions:**
- `classifyError(error)` — pattern-match unknown errors into `ChatError` with appropriate code
- `withRetry(fn, strategy, options?)` — retry a function with configurable strategy and abort support
- `isRetryable(error)` — check if an error is retryable

## Storage Adapters (`chat/storage`)

Generic key-value storage with in-memory and file-based implementations.

```typescript
import { InMemoryStorage, FileStorage } from "@witqq/agent-sdk/chat/storage";
import type { IStorageAdapter } from "@witqq/agent-sdk/chat/storage";

// In-memory (default, zero-config)
const memory = new InMemoryStorage<MyItem>();

// File-based (JSON file per item)
const files = new FileStorage<MyItem>({ directory: "./data" });

// CRUD operations
await memory.create("key1", { name: "Item 1" });
const item = await memory.get("key1");
const items = await memory.list({ limit: 10, offset: 0 });
await memory.update("key1", { name: "Updated" });
await memory.delete("key1");
```

**Interface:** `IStorageAdapter<T>` with `get()`, `list()`, `create()`, `update()`, `delete()`, `has()`, `count()`, `clear()`

## Session Management (`chat/sessions`)

Session store wrapping storage adapters with message management and pagination.

```typescript
import { InMemorySessionStore } from "@witqq/agent-sdk/chat/sessions";
import type { IChatSessionStore } from "@witqq/agent-sdk/chat/sessions";

const store = new InMemorySessionStore();

// Create session
const session = await store.createSession({
  config: { model: "gpt-4", backend: "vercel-ai" },
  title: "My Chat",
});

// Append messages (single or bulk)
await store.appendMessage(session.id, message);
await store.saveMessages(session.id, [message1, message2]);

// Paginated message retrieval
const page = await store.loadMessages(session.id, { limit: 20, offset: 0 });
console.log(page.messages, page.total, page.hasMore);

// Archive / unarchive
await store.archiveSession(session.id);
await store.unarchiveSession(session.id);

// List and search sessions
const sessions = await store.listSessions({ limit: 10 });
const results = await store.searchSessions({ query: "deployment" });
```

**Implementations:** `InMemorySessionStore` (zero-config) and `FileSessionStore` (JSON files).

## Context Window (`chat/context`)

Token estimation and context window management with overflow strategies.

```typescript
import { ContextWindowManager, estimateTokens } from "@witqq/agent-sdk/chat/context";

const manager = new ContextWindowManager({
  maxTokens: 128_000,
  reservedTokens: 2000,
  strategy: "sliding-window",
});

const result = manager.fitMessages(messages);
console.log(result.totalTokens);    // estimated token usage
console.log(result.removedCount);   // messages removed to fit
console.log(result.wasTruncated);   // whether truncation occurred

// Standalone token estimation
const tokens = estimateTokens(message, { charsPerToken: 4 });
```

**Strategies:** `truncate-oldest` (drop oldest messages), `sliding-window` (keep recent window), `summarize-placeholder` (replace removed messages with a placeholder or async summary).

**Async summarizer:** The `summarize-placeholder` strategy accepts an optional async summarizer function that generates a real summary from removed messages:

```typescript
const manager = new ContextWindowManager({
  maxTokens: 128_000,
  strategy: "summarize-placeholder",
  summarizer: async (removed) => {
    // Call LLM to summarize removed messages
    const text = removed.map(m => getMessageText(m)).join("\n");
    return `Previous context: ${await llm.summarize(text)}`;
  },
});

// Use fitMessagesAsync() to invoke the summarizer
const result = await manager.fitMessagesAsync(messages);
```

If no summarizer is configured or the summarizer throws, a static placeholder is used instead.

## Message Accumulator (`chat/accumulator`)

Converts streaming agent events into a complete `ChatMessage`. Tracks text, tool calls, reasoning, and sources as they arrive.

```typescript
import { MessageAccumulator } from "@witqq/agent-sdk/chat/accumulator";

const acc = new MessageAccumulator();

// Feed streaming events as they arrive
for await (const event of agentEventStream) {
  acc.apply(event);

  // Get in-progress snapshot for UI rendering
  const snapshot = acc.snapshot();
  renderMessage(snapshot);
}

// Get completed message
const message = acc.finalize();
```

**Key methods:** `apply(event)` to feed events, `snapshot()` for in-progress state, `finalize()` for completed message.

## State Machines (`chat/state`)

Validated state machines for runtime, message, and tool call lifecycles. Includes reentrancy guard and abort controller.

```typescript
import {
  createRuntimeStateMachine,
  createMessageStateMachine,
  ChatReentrancyGuard,
  ChatAbortController,
} from "@witqq/agent-sdk/chat/state";

// Runtime state machine: idle → streaming → idle
const runtime = createRuntimeStateMachine();
runtime.transition("streaming");  // OK
runtime.transition("idle");       // OK
runtime.transition("error");      // throws ChatError(INVALID_TRANSITION) — idle can only go to streaming or disposed

// Reentrancy guard: prevent concurrent sends
const guard = new ChatReentrancyGuard();
guard.acquire();   // OK
guard.acquire();   // throws ChatError(REENTRANCY)
guard.release();

// Abort controller with external signal linking
const ctrl = new ChatAbortController(externalSignal);
ctrl.abort("user cancelled");
ctrl.dispose();  // clean up signal listener
```

**State machines:** `createRuntimeStateMachine()` (idle↔streaming↔error→disposed), `createMessageStateMachine()` (pending→streaming→complete/error/cancelled), `createToolCallStateMachine()` (pending→running→complete, with approval gate).

## Backend Adapters (`chat/backends`)

High-level adapters bridging `IAgentService` to `ChatEvent` streams with session management and resume.

```typescript
import {
  CopilotChatAdapter, ClaudeChatAdapter, VercelAIChatAdapter,
  SSEChatTransport, streamToTransport,
  type IBackendAdapter, type IChatTransport
} from "@witqq/agent-sdk/chat/backends";

// Create adapter (auto-creates and owns its agent service)
const adapter = new CopilotChatAdapter({
  agentConfig: { systemPrompt: "You are helpful.", model: "gpt-4.1" },
});

// Or inject an existing service (adapter does NOT dispose it)
const adapter2 = new CopilotChatAdapter({
  agentService: existingService,
  agentConfig: { systemPrompt: "You are helpful." },
});

// Stream messages
for await (const event of adapter.streamMessage(session, "Hello")) {
  // ChatEvent: message:start, message:delta, tool:start, tool:complete, message:complete
}

// Resume a persistent session
if (adapter.canResume()) {
  for await (const event of adapter.resume(session, adapter.backendSessionId!)) {
    // Continues existing conversation
  }
}

// SSE transport for HTTP streaming
const transport = new SSEChatTransport(httpResponse);
await streamToTransport(adapter.streamMessage(session, msg), transport);

adapter.dispose();
```

**Adapters:** `CopilotChatAdapter` (persistent session, resume), `ClaudeChatAdapter` (persistent session, resume), `VercelAIChatAdapter` (stateless, no resume).

**Transport:** `IChatTransport` interface with `send()`, `error()`, `close()`. Three built-in implementations: `SSEChatTransport` (Server-Sent Events over HTTP), `WsChatTransport` (WebSocket via `WebSocketLike` abstraction), `InProcessChatTransport` (zero-network async iterable). `streamToTransport()` pipes any `AsyncIterable<ChatEvent>` to transport. See [Custom Transports](./custom-transports.md) for implementation guide.

**Transport interceptors:** `withInterceptors(transport, interceptors)` wraps any transport with composable hooks for logging, metrics, or event transformation.

```typescript
import { withInterceptors, type TransportInterceptor } from "@witqq/agent-sdk/chat/backends";

const logger: TransportInterceptor = {
  beforeSend(event) { console.log("send:", event.type); return event; },
  onError(err) { console.error("transport error:", err); },
};
const wrapped = withInterceptors(sseTransport, [logger]);
```

Hooks: `beforeSend` (modify event or return null to suppress), `afterSend`, `beforeClose`, `onError`. Multiple interceptors chain left-to-right.

**Service ownership:** When `agentService` is passed via options, the adapter does **not** dispose it. When omitted, the adapter creates and owns its service.

## Chat Runtime (`chat/runtime`)

Unified facade that orchestrates all chat modules into a single `IChatRuntime` interface.

```typescript
import { createChatRuntime, type IChatRuntime } from "@witqq/agent-sdk/chat/runtime";

interface AppMetadata extends Record<string, unknown> {
  userId: string;
  plan: "free" | "pro";
}

const runtime = createChatRuntime<AppMetadata>({
  backends: {
    copilot: () => new CopilotChatAdapter({ agentService }),
  },
  defaultBackend: "copilot",
  sessionStore,
  contextManager,
  retry: { maxRetries: 2, initialDelayMs: 500, backoffMultiplier: 2 },
});
```

**Factory:** `createChatRuntime<TMetadata>(options)` returns `IChatRuntime<TMetadata>`. The generic `TMetadata` flows through `createSession()` and `getSession()` to type the `metadata.custom` field. Backend adapters are created lazily from factory functions.

**Retry:** `RetryConfig` (`maxRetries`, `initialDelayMs`, `backoffMultiplier`) controls pre-stream retry behavior. If the adapter factory or the first stream event fails, the runtime retries with exponential backoff. Once the first event is received, the stream is committed (no mid-stream retry). Failed adapters are disposed before retry.

**Session delegation:** `createSession()`, `getSession(id)`, `listSessions()`, `deleteSession(id)`, `archiveSession(id)`, `switchSession(id)` — delegates to `IChatSessionStore`.

**Send flow:** `send(sessionId, content, options?)` → persist user message → run `onBeforeSend` middleware → stream via adapter → `feedAccumulator()` bridges `ChatEvent` → `AgentEvent` → run `onEvent` middleware per event → persist assistant message → run `onAfterReceive` middleware. Yields `ChatEvent` items.

**Backend/model switching:** `switchBackend(name)` changes active backend (adapter created lazily). `switchModel(model)` sets model for next `send()`.

**Tool registration:** `addTool(def)`, `removeTool(name)`, `getTools()`. Tools persist across backend switches, passed to adapters via `SendMessageOptions.tools`.

**Tool context:** Runtime-registered tools receive an optional `ToolContext` as their second parameter. `ChatRuntime.send()` builds the context from the current session (`{ sessionId, custom? }`) and injects it via closure wrapping. Existing single-parameter tools work unchanged.

```typescript
import type { ToolContext } from "@witqq/agent-sdk";

const tool: ToolDefinition = {
  name: "db_query",
  description: "Query database",
  parameters: z.object({ sql: z.string() }),
  execute: async (params, context?: ToolContext) => {
    // context.sessionId — current chat session
    // context.custom — session metadata (user ID, tenant, etc.)
    return queryDb(params.sql, context?.custom?.tenantId);
  },
};
runtime.registerTool(tool);
```

**Middleware:** `use(middleware)` registers `ChatMiddleware` (onBeforeSend, onEvent, onAfterReceive, onError). Sequential execution in registration order.

**Lifecycle:** State machine (idle → streaming → idle/error/disposed). `status` property, `abort()` cancels current send, `dispose()` cleans up. Error auto-recovery: transient errors reset to idle on next `send()`.

**Context stats:** `getContextStats(sessionId)` returns the last trimming result for a session: `{ totalTokens, removedCount, wasTruncated, availableBudget }` or `null` if no context config is set. Updated after each `send()`.

**Archive callback:** `onContextTrimmed: (sessionId, removedMessages) => void` in runtime options. Called when context trimming removes messages during `send()`. Callback errors are caught and swallowed to avoid disrupting the send flow.

**Stream watchdog:** `streamTimeoutMs` in runtime options wraps the event stream with an inactivity timeout. If no events arrive within the configured window, the stream aborts with `ChatError(TIMEOUT)`. Timer resets on each received event. Uses `Promise.race()` with cancellable timeouts to avoid timer leaks.

```typescript
const runtime = createChatRuntime({
  backends: { copilot: () => adapter },
  defaultBackend: "copilot",
  sessionStore,
  context: { maxTokens: 8192, reservedTokens: 500 },
  onContextTrimmed: (sessionId, removed) => {
    console.log(`Trimmed ${removed.length} messages from ${sessionId}`);
  },
});

// After send(), query stats
const stats = runtime.getContextStats(sessionId);
if (stats?.wasTruncated) {
  console.log(`Used ${stats.totalTokens} of ${stats.availableBudget} tokens`);
}
```

## React Bindings (`chat/react`)

Headless React hooks wrapping `IChatRuntime`. React 18+ as optional peer dependency.

```typescript
import { ChatProvider, useChat, useMessages } from "@witqq/agent-sdk/chat/react";
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";

// Wrap your app with ChatProvider
function App() {
  const runtime = useMemo(() => createChatRuntime(options), []);
  return createElement(ChatProvider, { runtime }, createElement(Chat));
}

// Use hooks in child components
function Chat() {
  const { messages, sendMessage, isGenerating, stop, error } = useChat();

  return createElement("div", null,
    messages.map((msg) => createElement("div", { key: msg.id }, getMessageText(msg))),
    createElement("button", { onClick: () => sendMessage("Hello") }, "Send"),
    isGenerating && createElement("button", { onClick: stop }, "Stop"),
  );
}
```

### Hooks

| Hook | Purpose |
|------|---------|
| `ChatProvider` | React context provider wrapping `IChatRuntime` |
| `useChatRuntime()` | Access runtime from context (throws outside provider) |
| `useChat(options?)` | Send messages, track status, manage sessions |
| `useMessages({ sessionId })` | Reactive message list via `useSyncExternalStore` |

### useChat Return

```typescript
interface UseChatReturn {
  sessionId: string | null;
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  stop: () => void;
  isGenerating: boolean;
  status: RuntimeStatus;
  error: Error | null;
  clearError: () => void;
  newSession: () => Promise<string>;
}
```

### Components

Headless rendering components using `createElement` (no JSX required).

| Component | Purpose |
|-----------|---------|
| `Message` | Renders `ChatMessage.parts` with `data-role`/`data-status`, render props for all 5 part types |
| `ThinkingBlock` | Collapsible reasoning via `details/summary`, streaming indicator |
| `ToolCallView` | Tool call display with approve/deny buttons when `requires_approval` |
| `MarkdownRenderer` | Markdown→HTML parser with headings, code blocks, links, lists |
| `useToolApproval(messages)` | Tracks tool calls needing approval, returns `pendingRequests`/`approve`/`deny` |

```typescript
import { Message, MarkdownRenderer, useToolApproval } from "@witqq/agent-sdk/chat/react";

// Render messages with custom text renderer
createElement(Message, {
  message: msg,
  renderText: (part) => createElement(MarkdownRenderer, { content: part.text }),
});

// Track tool approvals
const { pendingRequests, approve, deny } = useToolApproval(messages, onApprove, onDeny);
```

### Composition Components

| Component | Purpose |
|-----------|---------|
| `Thread` | Scrollable message list with auto-scroll, loading indicator |
| `Composer` | Auto-resizing textarea with Enter to send, stop button |
| `ThreadProvider` | Slot-based customization for Thread rendering |
| `useThreadSlots()` | Access slot overrides from `ThreadProvider` context |

```typescript
import { Thread, Composer, ThreadProvider } from "@witqq/agent-sdk/chat/react";

// Basic usage
createElement(Thread, { messages, isGenerating });
createElement(Composer, { onSend: sendMessage, onStop: stop, isGenerating });

// Custom rendering via slots
createElement(ThreadProvider, {
  renderToolCall: (part, i) => createElement("div", { key: i }, part.name),
}, createElement(Thread, { messages }));
```

### Session and Model Components

| Component/Hook | Purpose |
|----------------|---------|
| `ThreadList` | Session sidebar with create, delete, switch, search |
| `useSSE(url)` | Fetch-based SSE client with reconnection and multi-line data |
| `useModels()` | Model list with loading state, caching, search/filter |
| `ModelSelector` | Dropdown with search, keyboard navigation, tier badges |

```typescript
import { ThreadList, useSSE, useModels, ModelSelector } from "@witqq/agent-sdk/chat/react";

// Session sidebar
createElement(ThreadList, { sessions, activeSessionId, onSelect, onDelete, onCreate });

// SSE transport with reconnection
const { status, connect, disconnect, lastEvent } = useSSE("/api/chat/stream", {
  onEvent: handleEvent,
  reconnect: true,
  reconnectInterval: 3000,
});

// Model selection
const { models, search, setSearch } = useModels();
createElement(ModelSelector, { models, selected: currentModel, onSelect: setModel });
```

### Auth Components

| Component/Hook | Purpose |
|----------------|---------|
| `useAuth({ backend })` | Multi-backend auth state machine (Copilot Device Flow, Claude OAuth+PKCE, API key) |
| `AuthDialog` | Headless multi-backend auth dialog with render props |

```typescript
import { useAuth, AuthDialog } from "@witqq/agent-sdk/chat/react";
import type { AuthBackend } from "@witqq/agent-sdk/chat/react";

// Auth hook with Copilot Device Flow
const { status, deviceCode, verificationUrl, startDeviceFlow, token } = useAuth({
  backend: "copilot",
  onAuthenticated: (token) => console.log("Authenticated:", token.accessToken),
});

// Auth hook with Claude OAuth
const { authorizeUrl, startOAuthFlow, completeOAuth } = useAuth({ backend: "claude" });

// Multi-backend auth dialog
createElement(AuthDialog, {
  backends: ["copilot", "claude", "api-key"] as AuthBackend[],
  onAuthenticated: handleAuth,
  renderCopilotFlow: ({ deviceCode, verificationUrl }) =>
    createElement("div", null, `Code: ${deviceCode}, URL: ${verificationUrl}`),
});
```

### Token Auto-Refresh

Automatic background token refresh for expiring tokens (e.g. Claude OAuth).

```typescript
import { TokenRefreshManager } from "@witqq/agent-sdk/auth";
import type { AuthToken, ClaudeAuthToken } from "@witqq/agent-sdk/auth";

const manager = new TokenRefreshManager({
  token: claudeToken,
  refresh: (t) => claudeAuth.refreshToken((t as ClaudeAuthToken).refreshToken),
  refreshThreshold: 0.8,  // refresh at 80% of lifetime (default)
  maxRetries: 3,           // retry attempts on failure (default)
});

manager.on("refreshed", (newToken: AuthToken) => {
  tokenStore.save("claude", newToken);
});
manager.on("error", (err: Error, attempt: number) => {
  console.warn(`Refresh attempt ${attempt} failed:`, err.message);
});
manager.on("expired", () => {
  console.error("Token expired — re-authentication required");
});

manager.start();

// Update token after manual refresh
manager.updateToken(newToken);

// Clean up
manager.dispose();
```

### RemoteChatRuntime

Client-side `IChatRuntime` adapter that delegates all operations to a server over HTTP/SSE. Enables React hooks to work in browser apps where the actual `ChatRuntime` runs server-side.

```typescript
import { RemoteChatRuntime } from "@witqq/agent-sdk/chat/react";

const runtime = new RemoteChatRuntime({ baseUrl: "/api/chat" });

// Use with ChatProvider — all hooks work transparently
createElement(ChatProvider, { runtime }, createElement(Chat));
```

#### Server Endpoint Contract

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/sessions/create` | Create session |
| `GET` | `/sessions/{id}` | Get session |
| `GET` | `/sessions` | List sessions |
| `DELETE` | `/sessions/{id}` | Delete session |
| `POST` | `/sessions/{id}/archive` | Archive session |
| `POST` | `/send` | Send message (SSE stream response) |
| `POST` | `/abort` | Abort generation |
| `GET` | `/models` | List available models |
| `POST` | `/backend/switch` | Switch backend |
| `POST` | `/model/switch` | Switch model |

#### Options

```typescript
interface RemoteChatRuntimeOptions {
  baseUrl: string;        // Server base URL (no trailing slash)
  headers?: HeadersInit;  // Custom headers (auth tokens, etc.)
  fetch?: typeof fetch;   // Custom fetch implementation
}
```

Streaming uses SSE with `ChatEvent` JSON payloads. Abort cancellation is handled via `AbortController` with clean stream teardown.

## Demo Application

See [examples/demo/README.md](../../examples/demo/README.md) for a working React demo showcasing all modules.

## Research Documents

- [ARCHITECTURE.md](ARCHITECTURE.md) — architecture specification
- [IMPLEMENTATION.md](IMPLEMENTATION.md) — implementation roadmap
- [PROJECTS-ANALYSIS.md](PROJECTS-ANALYSIS.md) — project analysis
- [COMPETITORS.md](COMPETITORS.md) — competitive landscape