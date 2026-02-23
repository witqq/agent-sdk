# Architecture Design — @witqq/chat-sdk

## 4.0 Quality Attributes

| Attribute | Target | Constraint |
|-----------|--------|-----------|
| Bundle size (core) | < 15 KB gzipped | No heavy deps in core |
| Bundle size (react) | < 25 KB gzipped | React as peer dep |
| Peer deps | `react >= 18`, `@witqq/agent-sdk`, `zod ^3.23 \|\| ^4.0` | Max 3 peer deps for core |
| TypeScript | Strict mode, ESM-first, CJS via tsup | Generic types for metadata |
| Extension points | Storage adapter, transport adapter, component slots, event hooks | Interface-based DI |
| Runtime | Node.js >= 18, browser (for React components) | No Node-only APIs in core |
| Semver | 0.x during development, 1.0 after validation | Breaking changes in minor until 1.0 |

---

## 4.2.5 Architecture Decision Records

### ADR-1: Parts-based Message Model

**Context**: Current SDK uses flat string content. All competitors (Vercel AI, assistant-ui, Anthropic) use typed parts.

**Options**:
1. Keep string content + parse on render
2. Parts-based model with typed union

**Decision**: Option 2 — Parts-based model.

**Rationale**: Enables per-part status tracking, per-part rendering, streaming accumulation. Industry standard.

**Consequences**: Breaking change for chat module. Migration required.

---

### ADR-2: Framework-Agnostic Core

**Context**: assistant-ui separates core from React. Our current chat module mixes concerns.

**Options**:
1. Core + React in one package
2. Separate packages (`@witqq/chat-sdk` + `@witqq/chat-sdk-react`)
3. Single package with separate entry points

**Decision**: Option 3 — Single package with entry points (`@witqq/chat-sdk` and `@witqq/chat-sdk/react`).

**Rationale**: Simpler publishing, single version, tree-shaking via entry points. Same pattern as agent-sdk.

**Consequences**: React code must not import from core at module level.

---

### ADR-3: Custom Subscribable vs Zustand

**Context**: assistant-ui built custom reactive system (tap). We need state management for chat.

**Options**:
1. Zustand (popular, simple)
2. Custom subscribable (like assistant-ui)
3. `useSyncExternalStore` directly

**Decision**: Option 3 — `useSyncExternalStore` with runtime as external store.

**Rationale**: Zero dependency. Runtime already has state. React 18+ native. No extra layer.

**Consequences**: Runtime must implement `subscribe(callback)` + `getSnapshot()` pattern.

---

### ADR-4: Transport Abstraction

**Context**: Vercel AI has `ChatTransport` interface. Our backends use different transports (stdio, HTTP).

**Options**:
1. No transport abstraction (backend handles it)
2. Thin transport interface for HTTP/WS only
3. Full transport abstraction over all backends

**Decision**: Option 2 — Thin transport for Vercel AI backend only. CLI backends (Copilot, Claude) use agent-sdk directly.

**Rationale**: CLI backends are subprocess-based, transport abstraction doesn't apply. Only Vercel AI backend benefits from HTTP/WS swap.

**Consequences**: `ChatTransport` interface only used by Vercel AI backend adapter.

---

### ADR-5: Session ≠ Agent

**Context**: Current SDK couples session 1:1 with agent instance. All competitors decouple them.

**Options**:
1. Keep 1:1 coupling
2. Decouple: runtime manages sessions, agent is execution engine

**Decision**: Option 2 — Runtime decouples session from agent.

**Rationale**: Enables session switching without agent recreation. Enables session persistence. Matches OpenAI/assistant-ui patterns.

**Consequences**: Runtime holds agent reference internally. Sessions are data objects, not tied to agent lifecycle.

---

### ADR-6: Message Accumulator Pattern

**Context**: Anthropic SDK uses `#accumulateMessage()` to build message from stream events. We need the same for converting agent events → ChatMessage.

**Options**:
1. Build message inline during streaming
2. Separate accumulator class

**Decision**: Option 2 — `MessageAccumulator` class.

**Rationale**: Reusable across backends. Testable independently. Handles edge cases (parallel tool calls, thinking blocks).

**Consequences**: New class with clear API: `accumulator.apply(event)` → updated message.

---

### ADR-7: Error Code Enum

**Context**: LangChain uses typed error codes. Our current error system has hierarchy but no classification.

**Options**:
1. Error class hierarchy (current)
2. Error code enum + single ChatError class
3. Both: hierarchy + codes

**Decision**: Option 2 — Single `ChatError` with `code` enum.

**Rationale**: Simpler for consumers. switch/case on code. No instanceof issues across packages. LangChain validates this approach.

**Consequences**: Flatten error hierarchy. ChatError has `.code`, `.message`, `.retryable`, `.retryAfter`.

---

### ADR-8: Component Architecture — 3-Tier

**Context**: assistant-ui uses primitives + pre-built + slots. Vercel AI has only hooks.

**Options**:
1. Only hooks (like Vercel AI)
2. Only pre-built components
3. 3-tier: primitives + pre-built + slots (like assistant-ui)

**Decision**: Option 3 — 3-tier component system.

**Rationale**: Covers all consumer types. Simple apps use pre-built. Custom apps use primitives. Slots for targeted overrides.

**Consequences**: More code to maintain. Need clear API boundaries between tiers.

---

## 4.3 Architecture Layers

```
┌─────────────────────────────────────────────┐
│              React UI Layer                  │
│  Primitives → Pre-built → Component Slots   │
├─────────────────────────────────────────────┤
│              Runtime Layer                   │
│  ChatRuntime: sessions, streaming, events   │
├──────────────┬──────────────┬───────────────┤
│  Session     │  Message     │  Event        │
│  Manager     │  Accumulator │  Bus          │
├──────────────┴──────────────┴───────────────┤
│              Backend Adapter Layer           │
│  CopilotAdapter | ClaudeAdapter | VercelAI  │
├─────────────────────────────────────────────┤
│              agent-sdk (existing)            │
│  BaseAgent, backends, types, permissions    │
└─────────────────────────────────────────────┘

Cross-cutting:
  ├── Storage Layer (ISessionStore adapters)
  ├── Error Layer (ChatError + codes + retry)
  ├── Context Layer (ContextWindowManager)
  └── Transport Layer (HTTP/WS for Vercel AI)
```

### Layer Responsibilities

| Layer | Responsibility | Public API | Dependencies |
|-------|---------------|-----------|-------------|
| **React UI** | Render chat UI, handle user interactions | Components, Primitives, Hooks | Runtime Layer |
| **Runtime** | Orchestrate sessions, route messages, emit events | `createChatRuntime()`, `IChatRuntime` | Backend Adapter, Session Manager, Event Bus |
| **Session Manager** | Create/switch/restore sessions, manage thread list | `ISessionManager` | Storage Layer |
| **Message Accumulator** | Convert stream events → ChatMessage parts | `IMessageAccumulator` | Message types |
| **Event Bus** | Typed pub/sub for lifecycle events | `on()`, `off()`, `emit()` | None |
| **Backend Adapter** | Bridge runtime → agent-sdk backends | `IBackendAdapter` | agent-sdk |
| **Storage** | Persist sessions and messages | `ISessionStore` | None (interface only) |
| **Error** | Classify, wrap, retry | `ChatError`, `ChatErrorCode` | None |
| **Context** | Manage context window budget | `IContextManager` | Message types |
| **Transport** | HTTP/WS communication (Vercel AI only) | `IChatTransport` | None (interface only) |

### Dependency Rules (no cycles)

```
React UI → Runtime → Backend Adapter → agent-sdk
                   → Session Manager → Storage
                   → Event Bus
                   → Message Accumulator
                   → Error
                   → Context Manager
```

---

## 4.4 Core Interfaces

### IChatRuntime

```ts
interface IChatRuntime<TMetadata = unknown> {
  // Session management
  createSession(opts?: CreateSessionOpts): ChatSession;
  switchSession(sessionId: string): Promise<void>;
  restoreSession(sessionId: string): Promise<ChatSession>;
  listSessions(opts?: ListOpts): Promise<SessionInfo[]>;
  deleteSession(sessionId: string): Promise<void>;
  readonly currentSession: ChatSession | null;

  // Messaging
  send(text: string, opts?: SendOpts): Promise<ChatMessage<TMetadata>>;
  stream(text: string, opts?: SendOpts): AsyncIterable<ChatEvent>;

  // Model
  setModel(model: string): void;
  listModels(): Promise<ModelInfo[]>;
  readonly model: string;

  // Tools
  registerTool(name: string, tool: ToolDefinition): void;
  removeTool(name: string): void;
  addToolResult(toolCallId: string, result: unknown): void;
  approveToolCall(toolCallId: string, approved: boolean): void;

  // Events
  on<E extends ChatEventType>(event: E, handler: ChatEventHandler<E>): () => void;
  off<E extends ChatEventType>(event: E, handler: ChatEventHandler<E>): void;

  // Lifecycle
  abort(): void;
  retry(sessionId?: string): Promise<void>;
  dispose(): void;
  readonly status: RuntimeStatus; // 'idle' | 'streaming' | 'error' | 'disposed'
}
```

### Supporting Types

```ts
interface SendOpts {
  sessionId?: string;       // Target session (defaults to currentSession)
  model?: string;           // Per-call model override
  signal?: AbortSignal;     // Per-call abort signal
  metadata?: Record<string, unknown>;
}

interface CreateSessionOpts {
  id?: string;              // Custom ID (auto-generated if omitted)
  title?: string;
  model?: string;           // Per-session model override
  metadata?: Record<string, unknown>;
}

interface ListOpts {
  limit?: number;           // Pagination
  offset?: number;
  status?: 'active' | 'archived';
}

interface ModelInfo {
  id: string;
  name?: string;
  provider?: string;
  contextWindow?: number;
  capabilities?: string[];
}

interface ToolContext {
  sessionId: string;
  userId?: string;
  signal: AbortSignal;
  runtime: IChatRuntime;
}

// Tool execute receives ToolContext as second argument:
// execute: (args: TArgs, context: ToolContext) => Promise<TResult>

// Status type definitions
type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error' | 'cancelled';
type PartStatus = 'streaming' | 'complete';
type RuntimeStatus = 'idle' | 'streaming' | 'error' | 'disposed';
type ToolCallStatus = 'pending' | 'running' | 'requires_approval' | 'complete' | 'error' | 'denied';
type SessionStatus = 'active' | 'archived';
```

### ChatRuntimeConfig

```ts
interface ChatRuntimeConfig<TMetadata = unknown> {
  // Required
  backend: 'copilot' | 'claude' | 'vercel-ai' | IBackendAdapter;

  // Model
  model?: string;
  apiKey?: string;
  baseUrl?: string;

  // Storage
  storage?: ISessionStore;

  // Tools
  tools?: Record<string, ToolDefinition>;

  // Context management
  context?: {
    maxTokens?: number;
    reserveTokens?: number;
    strategy?: 'sliding' | 'summarize' | 'truncate';
  };

  // Error handling
  retry?: {
    maxRetries?: number;
    initialDelay?: number;
    backoffFactor?: number;
    retryOn?: ChatErrorCode[];
  };

  // Events & middleware
  middleware?: ChatMiddleware[];

  // Transport (Vercel AI backend only)
  transport?: IChatTransport;

  // Permissions
  permissionStore?: IPermissionStore;
  onPermission?: (request: PermissionRequest) => Promise<PermissionDecision>;

  // Vercel AI specific
  providerOptions?: Record<string, unknown>;
}
```

### ChatSession

```ts
interface ChatSession {
  readonly id: string;
  readonly status: SessionStatus;
  title?: string;
  readonly backend: string;
  readonly model: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly messageCount: number;
  metadata?: Record<string, unknown>;

  // Access messages (delegates to storage)
  getMessages(opts?: { limit?: number; offset?: number }): Promise<ChatMessage[]>;
  readonly lastMessage?: ChatMessage;

  // React integration
  subscribe(callback: () => void): () => void;
  getSnapshot(): ChatSession;
}
```

### ChatMessage

```ts
interface ChatMessage<TMetadata = unknown> {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  status: MessageStatus;
  metadata?: TMetadata;
  createdAt: Date;
  updatedAt: Date;

  // Convenience getters (computed from parts)
  readonly text: string;               // All text parts joined
  readonly toolCalls: ToolCallPart[];  // All tool_call parts
  readonly reasoning: string;          // All reasoning parts joined
}

type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolCallPart
  | SourcePart
  | FilePart;

interface TextPart {
  type: 'text';
  text: string;
  status: PartStatus; // 'streaming' | 'complete'
}

interface ReasoningPart {
  type: 'reasoning';
  text: string;
  status: PartStatus;
}

interface ToolCallPart {
  type: 'tool_call';
  toolCallId: string;
  name: string;
  args: unknown;
  result?: unknown;
  status: ToolCallStatus; // 'pending' | 'running' | 'requires_approval' | 'approved' | 'denied' | 'complete' | 'error'
  error?: string;
}

interface SourcePart {
  type: 'source';
  url: string;
  title?: string;
}

interface FilePart {
  type: 'file';
  name: string;
  mimeType: string;
  data: string; // base64
}
```

### ISessionStore

```ts
interface ISessionStore {
  saveSession(session: SessionData): Promise<void>;
  loadSession(id: string): Promise<SessionData | null>;
  listSessions(opts?: ListOpts): Promise<SessionInfo[]>;
  deleteSession(id: string): Promise<void>;
  saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void>;
  appendMessage(sessionId: string, message: ChatMessage): Promise<void>;
  loadMessages(sessionId: string, opts?: { limit?: number; offset?: number }): Promise<ChatMessage[]>;
}

interface SessionData {
  id: string;
  title?: string;
  status: 'active' | 'archived';
  backend: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

interface SessionInfo {
  id: string;
  title?: string;
  status: 'active' | 'archived';
  lastMessage?: string;
  messageCount: number;
  updatedAt: Date;
}
```

### IBackendAdapter

```ts
interface IBackendAdapter {
  send(messages: ChatMessage[], opts: BackendOpts): Promise<ChatMessage>;
  stream(messages: ChatMessage[], opts: BackendOpts): AsyncIterable<AgentEvent>;

  // Session resume support
  // CLI backends (Copilot, Claude) persist sessions to disk:
  // - Copilot: sessionMode "persistent", session survives CLI restart
  // - Claude: resume: sessionId + persistSession: true, session restored from disk
  // Returns true if the CLI session can be resumed (almost always for CLI backends).
  // Vercel AI is stateless — always returns true (context sent as messages).
  canResume(sessionId: string): Promise<boolean>;

  // Resume a CLI session by its backend-specific session ID.
  // For Copilot: reuses persistent session via getOrCreateSession()
  // For Claude: passes resume: sessionId to query()
  // For Vercel AI: no-op (stateless, context is in messages)
  resume(sessionId: string): Promise<void>;

  // Get the backend-specific session ID (CLI session ID, not our ChatSession ID).
  // Stored in ChatSession metadata for resume after restart.
  readonly backendSessionId?: string;

  abort(): void;
  listModels(): Promise<ModelInfo[]>;
  dispose(): void;
}

interface BackendOpts {
  model?: string;
  signal?: AbortSignal;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  permissionStore?: IPermissionStore;
}
```

### IContextManager

```ts
interface IContextManager {
  estimateTokens(messages: ChatMessage[]): number;
  trimToFit(messages: ChatMessage[], budget: number): ChatMessage[];
  readonly strategy: 'sliding' | 'summarize' | 'truncate';
  readonly maxTokens: number;
  readonly reserveTokens: number;
}
```

### IChatTransport (Vercel AI only)

```ts
interface IChatTransport {
  sendMessages(request: TransportRequest): ReadableStream<ChatEvent>;
  reconnect(sessionId: string): ReadableStream<ChatEvent> | null;
}
```

### ChatEvent

Events use colon-separated naming (`category:action`):

```ts
type ChatEventType =
  // Message lifecycle
  | 'message:start'
  | 'message:delta'        // text delta
  | 'message:complete'
  | 'message:error'
  // Tool lifecycle
  | 'tool:start'
  | 'tool:complete'
  | 'tool:error'
  | 'tool:approval_required'
  // Thinking
  | 'thinking:start'
  | 'thinking:delta'
  | 'thinking:end'
  // Session
  | 'session:switch'
  | 'session:create'
  | 'session:restore'
  // Meta
  | 'usage'
  | 'error'
  | 'status_change'
  | 'heartbeat';

interface ChatEvent<T extends ChatEventType = ChatEventType> {
  type: T;
  sessionId: string;
  timestamp: number;
  data: ChatEventData[T]; // discriminated by type
}
```

### Middleware

```ts
interface ChatMiddleware {
  /** Transform message before sending to backend */
  onBeforeSend?(message: ChatMessage, context: MiddlewareContext): ChatMessage | Promise<ChatMessage>;
  /** Transform/intercept stream events */
  onEvent?(event: ChatEvent, context: MiddlewareContext): ChatEvent | null | Promise<ChatEvent | null>;
  /** Transform completed message */
  onAfterReceive?(message: ChatMessage, context: MiddlewareContext): ChatMessage | Promise<ChatMessage>;
  /** Intercept errors */
  onError?(error: ChatError, context: MiddlewareContext): ChatError | null | Promise<ChatError | null>;
}

interface MiddlewareContext {
  sessionId: string;
  runtime: IChatRuntime;
  signal: AbortSignal;
}
```

Middleware added to runtime via config:

```ts
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  middleware: [loggingMiddleware, metricsMiddleware, authMiddleware],
});
```

### ChatError

```ts
enum ChatErrorCode {
  // Network
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',

  // Auth
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',

  // Rate limiting
  RATE_LIMIT = 'RATE_LIMIT',

  // Provider
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  MODEL_OVERLOADED = 'MODEL_OVERLOADED',

  // Context
  CONTEXT_OVERFLOW = 'CONTEXT_OVERFLOW',

  // Validation
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',

  // Permission
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Internal
  BACKEND_NOT_INSTALLED = 'BACKEND_NOT_INSTALLED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  STORAGE_ERROR = 'STORAGE_ERROR',
  DISPOSED = 'DISPOSED',
  ABORTED = 'ABORTED',
}

class ChatError extends Error {
  readonly code: ChatErrorCode;
  readonly retryable: boolean;
  readonly retryAfter?: number; // ms
  readonly cause?: Error;
}
```

---

## 4.5 State Machines

### Runtime Status

```
  ┌──────────┐
  │  idle     │ ← initial state
  ├──────────┤
  │          │── send()/stream() ──→ ┌──────────┐
  │          │                       │ streaming │
  │          │ ←── done/error ──── ├──────────┤
  │          │                       │          │── abort() ──→ idle
  └──────────┘                       └──────────┘
       │                                  │
       │── error ──→ ┌──────────┐        │── error ──→ ┌──────────┐
       │             │  error   │        │             │  error   │
       │             ├──────────┤        │             ├──────────┤
       │             │ retry()  │──→ idle│             │ retry()  │──→ streaming
       │             └──────────┘        │             └──────────┘
       │
       │── dispose() ──→ ┌──────────┐
                         │ disposed │ (terminal)
                         └──────────┘
```

### Message Status

```
  ┌──────────┐
  │ pending  │ (user message created)
  ├──────────┤
  │          │── stream start ──→ ┌───────────┐
  │          │                    │ streaming  │
  │          │                    ├───────────┤
  │          │                    │ text/tool  │
  │          │                    │ deltas     │
  └──────────┘                    └───────────┘
                                       │
                        ┌──────────────┼──────────────┐
                        │              │              │
                   ┌──────────┐  ┌──────────┐  ┌──────────┐
                   │ complete │  │  error   │  │cancelled │
                   └──────────┘  └──────────┘  └──────────┘
```

### Tool Call Status

```
  ┌──────────┐
  │ pending  │ (tool call detected in stream)
  ├──────────┤
  │          │── args complete ──→ ┌───────────────────┐
  │          │                     │ requires_approval  │ (if needsApproval)
  │          │                     ├───────────────────┤
  │          │                     │                   │── approve(true) ──┐
  │          │                     │                   │── approve(false) ─┤
  │          │                     └───────────────────┘                   │
  │          │                                                            │
  │          │── args complete (no approval) ──→ ┌──────────┐            │
  │          │                                   │ running  │ ←──────────┘ (approved)
  │          │                                   ├──────────┤
  │          │                                   │ execute  │
  │          │                                   └──────────┘
  │          │                                        │
  └──────────┘                          ┌─────────────┼──────────┐
                                        │             │          │
                                   ┌──────────┐ ┌──────────┐ ┌──────────┐
                                   │ complete │ │  error   │ │  denied  │
                                   └──────────┘ └──────────┘ └──────────┘
```

### Session Status

Note: SessionStatus uses `active` / `archived` for storage. Runtime-level session state (idle/streaming/error) is tracked by RuntimeStatus on the runtime, not the session itself.

```
  ┌──────────┐
  │   new    │ ── first message ──→ ┌──────────┐
  └──────────┘                      │  active  │ ←── restore / unarchive
                                    ├──────────┤
                                    │          │── archive ──→ ┌──────────┐
                                    │          │               │ archived │
                                    │          │ ←── unarchive │          │
                                    └──────────┘               └──────────┘
                                         │
                                         │── delete ──→ ┌──────────┐
                                                        │ deleted  │ (terminal)
                                                        └──────────┘
```

---

## 4.5.5 Streaming & Events

### Event Normalization

```
Copilot SDK Events        Claude SDK Events         Vercel AI Stream Parts
──────────────────        ─────────────────         ──────────────────────
assistant.message_delta → text (content_block)   → text-delta
                        ↘                        ↗
                         ╰── ChatEvent.text_delta ──╯

assistant.reasoning     → thinking (content_block) → reasoning-delta
reasoning_delta        ↘                           ↗
                        ╰── ChatEvent.thinking_delta ╯

tool.execution_start   → tool_use                  → tool-call
                      ↘                            ↗
                       ╰── ChatEvent.tool_start ────╯

tool.execution_complete → tool_use_summary        → tool-result
                       ↘                          ↗
                        ╰── ChatEvent.tool_complete ╯

assistant.usage        → modelUsage               → finish-step.usage
                      ↘                           ↗
                       ╰── ChatEvent.usage ────────╯

session.error          → error result             → error part
                      ↘                           ↗
                       ╰── ChatEvent.error ────────╯
```

### Streaming Lifecycle

```
1. runtime.stream(text) called
2. → Session Manager validates session
3. → Backend Adapter creates agent call
4. → Agent starts streaming
5. → MessageAccumulator initialized with empty assistant message
6. → For each AgentEvent:
     a. MessageAccumulator.apply(event) → updated ChatMessage
     b. EventBus.emit(mapped ChatEvent)
     c. React UI re-renders (useSyncExternalStore)
7. → On completion:
     a. MessageAccumulator.finalize() → complete ChatMessage
     b. Session Manager saves message to storage
     c. EventBus.emit('message:complete')
8. → On error:
     a. ChatError created with code
     b. If retryable + retry configured → auto-retry
     c. Else → emit 'error', message status = 'error'
9. → On abort:
     a. Backend adapter abort()
     b. Message status = 'cancelled'
     c. Partial message preserved
```

### Cancellation

- `runtime.abort()` → calls `adapter.abort()` → calls `agent.abort()`
- Partial message preserved with `status: 'cancelled'`
- Running tool calls get `status: 'error'` with `ABORTED` reason

### Reconnection (Vercel AI only)

```
1. Network error detected
2. → Transport.reconnect(sessionId) called
3. → GET /api/chat/{sessionId}/stream
4. → If 200: resume stream from server's last position
5. → If 204: no active stream (complete or never started)
6. → If error: emit error, schedule retry
```

---

## 4.6 Error Taxonomy

| Code | Retryable | Retry Strategy | Recovery |
|------|-----------|---------------|----------|
| `NETWORK` | ✅ | Exponential backoff, max 3 | Auto-retry |
| `TIMEOUT` | ✅ | Retry with longer timeout | Auto-retry |
| `AUTH_EXPIRED` | ✅ (once) | Refresh token → retry | Emit event for re-auth |
| `AUTH_INVALID` | ❌ | — | User must re-authenticate |
| `RATE_LIMIT` | ✅ | Wait `retryAfter` ms | Auto-retry after delay |
| `PROVIDER_ERROR` | ✅ | Exponential backoff | Auto-retry |
| `MODEL_NOT_FOUND` | ❌ | — | User must select valid model |
| `MODEL_OVERLOADED` | ✅ | Wait + retry | Auto-retry |
| `CONTEXT_OVERFLOW` | ❌ | — | Auto-trim context, retry |
| `INVALID_INPUT` | ❌ | — | User must fix input |
| `INVALID_RESPONSE` | ✅ | Retry | Auto-retry |
| `PERMISSION_DENIED` | ❌ | — | User must approve |
| `BACKEND_NOT_INSTALLED` | ❌ | — | Install dependency |
| `SESSION_NOT_FOUND` | ❌ | — | Create new session |
| `DISPOSED` | ❌ | — | Create new runtime |
| `ABORTED` | ❌ | — | User-initiated |

---

## 4.7 Backward Compatibility

### Current Public API Changes

| Export | Package | Action | Migration |
|--------|---------|--------|-----------|
| `ChatMessage` (chat/core) | chat-sdk | **Replace** | New parts-based ChatMessage |
| `ChatSession` (chat/core) | chat-sdk | **Replace** | New SessionData interface |
| `ChatEvent` (chat/core) | chat-sdk | **Replace** | New typed event union |
| `IChatSessionStore` (chat/sessions) | chat-sdk | **Replace** | → `ISessionStore` |
| `InMemoryChatSessionStore` | chat-sdk | **Replace** | → `InMemorySessionStore` |
| `FileChatSessionStore` | chat-sdk | **Replace** | → `FileSessionStore` |
| `ChatErrorClassifier` (chat/errors) | chat-sdk | **Keep** | Integrate with ChatErrorCode |
| `ChatEventBus` (chat/events) | chat-sdk | **Replace** | → runtime.on() |
| `ContextWindowManager` (chat/context) | chat-sdk | **Keep** | Integrate with runtime |
| `IStorageAdapter` (chat/storage) | chat-sdk | **Remove** | Merged into ISessionStore |
| All agent-sdk exports | agent-sdk | **Keep** | No changes |

### Migration Guide

```ts
// Before (v0.x)
import { ChatSession, IChatSessionStore } from '@witqq/chat-sdk';
const store = new InMemoryChatSessionStore();
const session = new ChatSession({ id: '1', messages: [] });

// After (v1.x)
import { createChatRuntime, InMemorySessionStore } from '@witqq/chat-sdk';
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  storage: new InMemorySessionStore(),
});
const session = runtime.createSession();
```

---

## 4.8 Security Model

### Trust Boundaries

```
┌────────────────────────┐
│     Browser (UI)       │ ← User trust boundary
├────────────────────────┤
│     Server (Runtime)   │ ← App trust boundary
├────────────────────────┤
│   Backend SDK          │ ← SDK trust boundary
├────────────────────────┤
│   AI Provider / CLI    │ ← Provider trust boundary
└────────────────────────┘
```

### Credential Policy

- API keys: never stored in SDK. Passed via config, forwarded to agent-sdk.
- OAuth tokens: handled by auth module in agent-sdk.
- Permission scopes: persisted in `IPermissionStore` (user's responsibility).
- Session data: persisted in `ISessionStore` (user's responsibility).

### STRIDE Considerations

| Threat | Mitigation |
|--------|-----------|
| **Spoofing** | Auth handled by agent-sdk + provider |
| **Tampering** | Message integrity via ID + timestamps |
| **Repudiation** | Event logging via hooks |
| **Information Disclosure** | No credential storage in SDK |
| **Denial of Service** | Rate limit handling, abort support |
| **Elevation of Privilege** | Permission scopes, tool approval |

---

## 4.9 Testing Architecture

### Test Boundaries

| Layer | Test Type | Mock Strategy |
|-------|-----------|--------------|
| **React UI** | Unit (vitest + testing-library) | Mock `IChatRuntime` |
| **Runtime** | Unit + Integration | Mock `IBackendAdapter` |
| **Backend Adapter** | Unit | Mock agent-sdk (`_injectSDK()`) |
| **Session Manager** | Unit | Mock `ISessionStore` |
| **Message Accumulator** | Unit | Feed mock events |
| **Error** | Unit | Direct instantiation |
| **Storage** | Unit + Integration | InMemory for unit, File for integration |

### Streaming Tests

```ts
// Test pattern: feed events, verify accumulated message
const accumulator = new MessageAccumulator();

accumulator.apply({ type: 'text_delta', text: 'Hello' });
accumulator.apply({ type: 'text_delta', text: ' world' });
accumulator.apply({ type: 'done' });

const message = accumulator.finalize();
expect(message.parts[0]).toEqual({ type: 'text', text: 'Hello world', status: 'complete' });
```

### Error Scenario Tests

```ts
// Test pattern: simulate error, verify classification + retry
const runtime = createTestRuntime({
  adapter: mockAdapter({ failFirst: 2, error: new Error('rate limited') }),
  retry: { maxRetries: 3 },
});

const result = await runtime.send('test');
expect(result.text).toBeDefined(); // Succeeded after retries
expect(mockAdapter.callCount).toBe(3); // 2 failures + 1 success
```

### Integration Tests (per backend)

```ts
// Requires real CLI/API auth
describe('Copilot integration', () => {
  it('streams text response', async () => {
    const runtime = createChatRuntime({ backend: 'copilot', model: 'gpt-4.1' });
    const events = [];
    for await (const event of runtime.stream('Say hello')) {
      events.push(event);
    }
    expect(events.some(e => e.type === 'message:delta')).toBe(true);
    expect(events.some(e => e.type === 'message:complete')).toBe(true);
  });
});
```
