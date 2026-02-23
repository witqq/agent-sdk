# Architecture Review — @witqq/agent-sdk + @witqq/chat-sdk

Critical analysis of the entire SDK architecture. All issues documented with severity, exact locations, and consumer impact.

**Date**: 2025-07-18  
**Scope**: agent-sdk (types, base-agent, 3 backends, auth, registry, permissions, utils) + chat-sdk (sessions, storage, context, events, errors)

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 8 | Broken abstractions, data corruption risks, unusable API |
| MAJOR | 14 | Bad DX, missing features, inconsistencies |
| MINOR | 9 | Code quality, dead code, naming issues |

---

## Module 1: Session Management (agent-sdk)

### CRITICAL-1: No session abstraction — consumers must dispose/recreate agents to switch conversations

**Files**: `src/types.ts:256`, `src/base-agent.ts`, `src/backends/copilot.ts:509-531`, `src/backends/claude.ts:614-617`

**Problem**: CLI backends (Copilot, Claude) maintain internal subprocess sessions with conversation history. The SDK has `sessionMode: "per-call" | "persistent"` but no way to:
- Reset context without disposing the agent
- Switch between conversations
- Get/set conversation history

**Consumer impact**: In a multi-session chat app, when user switches from Chat A to Chat B, the consumer must:
1. `agent.dispose()` — kills subprocess, loses all state
2. `service.createAgent(config)` — spawns new subprocess (slow)
3. Manually pass Chat B's history via `runWithContext(messages)`

This is a ~500ms operation that should be instant.

**What should exist**: `IAgent.resetContext(messages?: Message[])` or `IAgent.switchSession(sessionId?: string)`

### CRITICAL-2: buildContextualPrompt destroys message structure

**Files**: `src/backends/copilot.ts:793-806`, `src/backends/claude.ts:1000-1014`

**Problem**: Both CLI backends concatenate the entire message history into a single string:
```
Conversation history:
User: Hello, I'm Peter
Assistant: Nice to meet you, Peter!
User: What's my name?
```

This loses:
- Message boundaries (LLM sees one blob, not discrete turns)
- Multimodal content (images, tool results discarded)
- Role semantics (text prefixes instead of native role separation)
- Token efficiency (duplicated context on every call in per-call mode)

**Consumer impact**: Reduced quality of multi-turn conversations. Multimodal messages silently broken.

### CRITICAL-3: Persistent session state lives in agent instance, not managed by SDK

**Files**: `src/backends/copilot.ts:462-463`, `src/backends/claude.ts:578-579`

**Problem**: Each agent instance owns ONE session. The mapping is 1:1 (one agent = one conversation). But real apps need 1:N (one agent = many conversations over time).

The `sessionMode: "persistent"` keeps a single subprocess session alive. When consumer needs a new conversation, they must create a new agent entirely. The old session is destroyed.

There's no session pool, no session store, no way to park a session and resume later.

---

## Module 2: IAgent & BaseAgent

### MAJOR-1: run() vs runWithContext() — confusing dual API

**Files**: `src/types.ts:290-292`, `src/base-agent.ts:36-75`

**Problem**: Two ways to send messages:
- `run(prompt)` — creates `[{role: "user", content: prompt}]` and calls executeRun
- `runWithContext(messages)` — passes raw array and calls executeRun

Both call the same `executeRun()`. The split adds no value — it's syntactic sugar that doubles the API surface. Same for `stream`/`streamWithContext`.

**Consumer impact**: Confusion about which to use. Most apps need context anyway, so `run()` is rarely useful alone.

### MAJOR-2: No way to access/modify conversation history

**Files**: `src/types.ts:287-324`

**Problem**: IAgent has no `getMessages()`, `clearMessages()`, or `setMessages()`. The agent is a black box for conversation state. Consumer has to maintain their own parallel message array and pass it on every call.

**Consumer impact**: Duplicated state management. Divergence between agent's internal state (CLI session) and consumer's message array.

### MAJOR-3: AgentConfig.systemPrompt is required but shouldn't be

**Files**: `src/types.ts:229`

**Problem**: `systemPrompt: string` is required in AgentConfig. Many use cases don't need a system prompt (the backend/model has defaults). Forcing it leads to empty strings: `systemPrompt: ""`.

### MINOR-1: AgentState "streaming" vs "running" distinction adds complexity without value

**Files**: `src/types.ts:282`, `src/base-agent.ts:44,112`

**Problem**: The state machine has 4 states: `idle | running | streaming | disposed`. But `running` and `streaming` are equivalent for the re-entrancy guard — both prevent new operations. The distinction leaks implementation details (streaming is an optimization, not a state).

---

## Module 3: Copilot Backend

### MAJOR-4: Session lifecycle is fragile — clearPersistentSession destroys without fallback

**Files**: `src/backends/copilot.ts:509-515`

**Problem**: `clearPersistentSession()` calls `session.destroy()` and sets everything to null. The next call creates a fresh session, but all conversation context is lost. There's no way to "reset" a session without losing it.

Error recovery flow: error → clearPersistentSession → next call creates new session → context lost. No retry of the failed call with the same context.

### MAJOR-5: ensureClient caches promise but error clears it — subtle retry bug

**Files**: `src/backends/copilot.ts:821-862`

**Problem**: If `ensureClient()` fails (e.g., auth check), `clientPromise` is set to null. But if multiple calls are in flight during the first startup, they all await the same promise, all get the error, then all try to create new clients concurrently (since `clientPromise` is null).

### MINOR-2: Tool event parsing uses fragile JSON.parse with silent fallbacks

**Files**: `src/backends/copilot.ts:640-650`

**Problem**: `tool.execution_start` args are parsed from JSON string with `try/catch` returning raw string on failure. No validation, no error logging.

---

## Module 4: Claude Backend

### MAJOR-6: onAskUser explicitly unsupported — warning only

**Files**: `src/backends/claude.ts:591`

**Problem**: If consumer sets `supervisor.onAskUser`, Claude backend emits a console.warn and silently ignores it. No error thrown, no clear API contract about what's supported per backend.

**Consumer impact**: Silent feature gap. App works with Copilot, breaks with Claude.

### MINOR-3: ClaudeToolCallTracker FIFO assumption may be wrong

**Files**: `src/backends/claude.ts:390-418`

**Problem**: Tool call correlation assumes FIFO order per tool name. If the SDK reorders events, tool calls could be mismatched with their results.

---

## Module 5: Vercel AI Backend

### MAJOR-7: No session support — stateless per call, no message accumulation

**Files**: `src/backends/vercel-ai.ts`

**Problem**: Unlike CLI backends which maintain sessions, Vercel AI is purely stateless. Every call requires the full message array. But the IAgent interface doesn't distinguish — consumer doesn't know they MUST maintain messages externally for Vercel AI but NOT for Copilot.

**Consumer impact**: Backend-specific behavior leaking through a "universal" interface.

### MINOR-4: listModels hardcoded fallback for openai.com

**Files**: `src/backends/vercel-ai.ts` (listModels)

**Problem**: Falls back to hardcoded OpenAI model list when API call fails. This list will become stale.

---

## Module 6: Registry

### MAJOR-8: Global mutable singleton — no isolation

**Files**: `src/registry.ts`

**Problem**: The registry is a module-level `Map`. All code in the process shares it. No way to have separate registries for testing, multi-tenant, or parallel operations.

### MAJOR-9: Cannot override built-in backends

**Files**: `src/registry.ts` (registerBackend throws on existing name)

**Problem**: `registerBackend("copilot", myFactory)` throws `BackendAlreadyRegisteredError`. Consumer cannot replace built-in backends with custom implementations (e.g., mock for testing, custom wrapper).

### MINOR-5: resetRegistry exported publicly — test concern in production API

**Files**: `src/registry.ts`, `src/index.ts`

---

## Module 7: Permission Store

### MAJOR-10: FilePermissionStore uses sync I/O in async interface

**Files**: `src/permissions.ts:101,114-115`

**Problem**: `readFileSync`/`writeFileSync` called in `async` methods. Blocks event loop. The `Promise` return type is misleading.

### MINOR-6: Timestamp stored but never used — dead code

**Files**: `src/permissions.ts` (FileStoreEntry.timestamp)

### MINOR-7: CompositePermissionStore silently aliases userStore to projectStore

**Files**: `src/permissions.ts:140`

**Problem**: When `userStore` is not provided, "always"-scoped approvals go to `projectStore` without the consumer knowing.

---

## Module 8: Error Hierarchy

### CRITICAL-4: Naming collision — two AuthError classes

**Files**: `src/chat/errors.ts:61`, `src/auth/types.ts:134`

**Problem**: Both define `class AuthError`. Both set `this.name = "AuthError"`. `instanceof` checks are ambiguous depending on import path.

### CRITICAL-5: Auth and Storage errors bypass SDK hierarchy

**Files**: `src/auth/types.ts:134` (extends `Error`), `src/chat/storage.ts` (`StorageError extends Error`)

**Problem**: `AuthError` extends raw `Error`, not `AgentSDKError`. `StorageError` also extends raw `Error`. This means `catch (e) { if (e instanceof AgentSDKError) }` will miss auth and storage errors entirely.

**Consumer impact**: Error handling that catches `AgentSDKError` will silently miss auth failures.

### MAJOR-11: Missing core error types — chat reinvents them

**Files**: `src/errors.ts`, `src/chat/errors.ts`

**Problem**: Core has no `TimeoutError`, `NetworkError`, `ValidationError`, `ConfigurationError`. Chat module creates its own under `ChatSDKError`. Other modules that need these must either import from chat (wrong dependency direction) or create duplicates.

---

## Module 9: Chat-SDK Sessions

### CRITICAL-6: O(n) addMessage — entire session read/written on each message

**Files**: `src/chat/sessions.ts` (BaseSessionStore.addMessage)

**Problem**: `addMessage()` does:
1. `adapter.get(sessionId)` — loads entire ChatSession including ALL messages
2. `session.messages.push(message)` — appends
3. `adapter.update(sessionId, session)` — writes entire ChatSession back

For a session with 1000 messages, every new message serializes/deserializes 1000 messages. This is O(n) per write.

**Consumer impact**: Performance degrades linearly with conversation length. Unacceptable for production chat apps.

### CRITICAL-7: Messages stored inside ChatSession — no separate message storage

**Files**: `src/chat/core.ts` (ChatSession.messages), `src/chat/sessions.ts`

**Problem**: `ChatSession` has `messages: ChatMessage[]` directly. There's no `IMessageStore` or separate message table. Pagination in `getMessages()` is fake — it loads all messages and slices in memory.

This means:
- Can't query messages independently of sessions
- Can't efficiently paginate large conversations
- Can't implement message-level operations (edit, delete, branch) without loading entire session

### CRITICAL-8: No integration between chat-sdk sessions and agent-sdk agents

**Files**: `src/chat/sessions.ts`, `src/types.ts`

**Problem**: Chat-sdk has `IChatSessionStore` for managing conversations. Agent-sdk has `IAgent` for running AI calls. They don't know about each other.

Consumer must manually:
1. Load session from store
2. Extract messages
3. Call `agent.runWithContext(messages)`
4. Save response to store
5. Handle context window limits manually

This is the ENTIRE chat loop — the "SDK" provides none of it.

---

## Module 10: Chat-SDK Storage

### MAJOR-12: FileStorage uses sync I/O

**Files**: `src/chat/storage.ts`

**Problem**: Same as permission store — `readFileSync`/`writeFileSync` in async methods.

### MINOR-8: No concurrency control — last-write-wins race condition

**Files**: `src/chat/storage.ts` (FileStorage)

---

## Module 11: Chat-SDK Context

### No critical issues. ContextWindowManager is well-designed but disconnected from the rest.

The problem is integration: it exists in isolation, nobody calls it automatically.

---

## Module 12: Utilities

### MAJOR-13: zodToJsonSchema returns {} for unsupported types — silent corruption

**Files**: `src/utils/schema.ts`

**Problem**: The `default` case returns `{}` with no warning for unsupported Zod types (ZodUnion, ZodLiteral, ZodRecord, ZodTuple, ZodNullable). Tool schemas using these types will silently have incorrect JSON Schema.

---

## Module 13: Package Structure

### MAJOR-14: Chat-sdk has no barrel export — dead module

**Files**: `src/chat/` (no index.ts)

**Problem**: 6 implementation files with no `index.ts` barrel. Not re-exported from main `src/index.ts` either. The chat module is effectively invisible to consumers — it exists only for the demo server's direct imports.

### MINOR-9: contentToText duplicates getTextContent

**Files**: `src/utils/messages.ts`, `src/types.ts`

---

## Priority Matrix

### Must Fix Before Release (Blocks Production Use)

1. **CRITICAL-1**: Session management — resetContext / switchSession
2. **CRITICAL-2**: buildContextualPrompt — use proper message passing
3. **CRITICAL-3**: Session lifecycle — session pool / multi-conversation
4. **CRITICAL-6**: O(n) addMessage — split message storage
5. **CRITICAL-7**: Fake pagination — real message storage
6. **CRITICAL-8**: Zero integration between chat-sdk and agent-sdk

### Should Fix Before Release (Bad DX)

7. **CRITICAL-4,5**: Error hierarchy breaks
8. **MAJOR-1**: Simplify run/runWithContext API
9. **MAJOR-2**: Add getMessages/clearMessages to IAgent
10. **MAJOR-7**: Backend-specific behavior leaking through universal interface
11. **MAJOR-14**: Chat-sdk package exports
12. **MAJOR-13**: zodToJsonSchema silent failures

### Can Fix After Release

13. **MAJOR-8,9**: Registry isolation / override
14. **MAJOR-10,12**: Sync I/O in async interfaces
15. All MINOR issues

---

## Research: Industry Patterns

How leading SDKs solve session management — patterns we should adopt.

### 1. Vercel AI SDK v5 — Transport + External Storage

**Pattern**: SDK is stateless. Sessions managed externally by the consumer.

```typescript
// SDK provides typed message containers
import { UIMessage, ModelMessage, convertToModelMessages } from "ai";

// Consumer manages storage keyed by chatId
const { messages, sendMessage } = useChat({
  id: chatId,
  messages: initialUIMessages,  // restore session
  transport: new DefaultChatTransport({
    api: "/api/chat",
    // Only send new message — backend has full history
    prepareSendMessagesRequest: ({ messages, id }) => ({
      body: { message: messages[messages.length - 1], id }
    }),
  }),
});
```

**Key insights**:
- **Two message types**: `UIMessage` (rich, for UI/storage) → `ModelMessage` (minimal, for LLM). Conversion utilities provided.
- **Consumer owns persistence**: SDK provides no storage — consumer picks DB, file, Redis.
- **Session = chatId + UIMessage[]**: No session object, just ID + messages.
- **Context compaction**: Consumer implements summarization of old messages. SDK only provides the hook points.

**Applicable to us**: Our chat-sdk should provide the storage adapters but not force them. Agent-sdk should work with or without sessions — just accept messages.

### 2. OpenAI Assistants API / Agents SDK — Server-Managed Threads

**Pattern**: Sessions ("Threads") are server-side objects. API manages history automatically.

```python
# Create a thread (= session)
thread = client.beta.threads.create()

# Add message to thread
client.beta.threads.messages.create(
    thread_id=thread.id,
    role="user",
    content="Hello!"
)

# Run assistant on the thread — it sees ALL previous messages
run = client.beta.threads.runs.create(
    thread_id=thread.id,
    assistant_id=assistant.id
)
```

**Key insights**:
- **Thread = persistent server-side session**: All messages auto-stored by API.
- **No manual history passing**: API reads the thread's full history.
- **Truncation strategy**: `truncation_strategy` parameter controls how much history model sees.
- **Thread is an ID**: Consumer stores `thread.id`, not messages.
- **Session memory**: Agents SDK has `Session` objects that track conversation history with automatic trimming and summarization.

**Applicable to us**: Our CLI backends (Copilot, Claude) already have server-managed sessions. We should expose them the same way — consumer gets a session ID, SDK handles history internally.

### 3. LangChain.js — Pluggable Memory Backends

**Pattern**: Abstract `BaseChatMessageHistory` with many implementations.

```typescript
// Session store per user/conversation
const histories = new Map<string, ChatMessageHistory>();

function getHistory(sessionId: string): ChatMessageHistory {
  if (!histories.has(sessionId)) {
    histories.set(sessionId, new InMemoryChatMessageHistory());
  }
  return histories.get(sessionId)!;
}

// Use in chain
const chain = new ConversationChain({
  memory: new BufferMemory({
    chatHistory: getHistory(sessionId),
  }),
});
```

**Key insights**:
- **Pluggable backends**: InMemory, File, Postgres, MongoDB, Redis, DynamoDB, S3.
- **Session = sessionId → ChatMessageHistory**: Simple mapping.
- **Memory strategies**: BufferMemory (all), WindowBufferMemory (last N), SummaryMemory (summarize old).
- **History is separate from chain**: Not coupled to the LLM call mechanism.

**Applicable to us**: Our `IStorageAdapter` pattern is similar but needs `IChatMessageHistory` specifically for messages (not whole sessions).

### 4. Anthropic Messages API — Fully Stateless

**Pattern**: No server-side state. Consumer sends full history every call.

```python
messages = [
    {"role": "user", "content": "I'm Peter"},
    {"role": "assistant", "content": "Hello Peter!"},
    {"role": "user", "content": "What's my name?"},
]
response = anthropic.messages.create(
    model="claude-4-opus",
    messages=messages,  # Full history every time
)
messages.append({"role": "assistant", "content": response.content[0].text})
```

**Key insights**:
- **Simplest model**: No sessions, no threads, just messages array.
- **Consumer owns everything**: History, truncation, persistence.
- **Prompt caching**: Anthropic caches message prefixes server-side for efficiency.
- **Role alternation required**: user/assistant must alternate.

**Applicable to us**: Our Vercel AI backend works this way. Important: our API should support this simple model too — not force sessions on stateless consumers.

### 5. Synthesis — Design Patterns for Our SDK

| Pattern | Used By | Session Location | Consumer Complexity |
|---------|---------|-----------------|-------------------|
| Server-managed sessions | OpenAI Threads, Copilot CLI, Claude CLI | Server/subprocess | Low |
| Client-managed messages | Anthropic API, Vercel AI | Consumer code | Medium |
| Pluggable memory | LangChain.js | Configurable | Low-Medium |
| Two-tier messages | Vercel AI SDK v5 | Split UI/Model | Medium |

**Our SDK must support ALL patterns** because we wrap ALL these backends:

1. **CLI backends** (Copilot, Claude): Server-managed sessions → expose session ID, auto-handle history
2. **API backends** (Vercel AI): Stateless → consumer passes messages, we store nothing
3. **Chat-SDK layer**: Pluggable storage → optional session persistence over any backend
4. **No lock-in**: Consumer can use just agent-sdk (bare) or agent-sdk + chat-sdk (managed)

**Key design principle**: Session management should be OPTIONAL and LAYERED:
- Layer 0: `agent.run(prompt)` — simplest, no history
- Layer 1: `agent.run(prompt, { sessionId })` — SDK manages history internally per session
- Layer 2: `chatSession.send(prompt)` — chat-sdk manages storage, context window, persistence

---

## Consumer Analysis

Analysis of 3 active consumers + 1 benchmark project. What they actually need vs what we provide.

### Project 1: MCP Moira (mcp-moira-dev2)

**What it is**: Agent Workflow Engine with Web UI dashboard. 6-package monorepo. Heavy, sophisticated consumer.

**SDK version**: `^0.6.0`

**APIs used**:
- `createAgentService(backend, options)` — factory
- `service.createAgent(config)` → `agent.streamWithContext(messages)` — streaming with context
- `CopilotAuth.startDeviceFlow()`, `ClaudeAuth.startOAuthFlow()` — auth flows
- `AgentEvent` type union — event processing

**Session management**:
- **Custom `AgentSessionRegistry`** — in-memory LRU cache (30min TTL) mapping `conversationId → IAgent`. Reuses agent instances for CLI backends.
- **Custom `AgentServiceRegistry`** — per-user LRU cache (max 100, 30min TTL) of `IAgentService` instances.
- Both are custom code because SDK provides nothing for this.

**Pain points & workarounds**:

| # | Issue | Workaround | Root Cause |
|---|-------|-----------|------------|
| 1 | **150+ lines of duplicated types** | Re-declared `AgentServiceLike`, `AgentLike`, `AgentEvent`, `ContextMessage`, `JSONValue`, `ChatToolDefinition` locally | SDK types can't be imported into shared package without making SDK a hard runtime dependency |
| 2 | **`as unknown as AgentServiceLike` casts** | Double-cast everywhere | SDK return types don't match their local interfaces |
| 3 | **Synthetic `tool_call_end` events** | Emit fake results for stuck tool cards | Claude backend sometimes doesn't emit `tool_call_end` |
| 4 | **Provider options as opaque records** | `Record<string, Record<string, unknown>>` | No type safety for provider-specific options |

**What they need from us**:
- Type-only package or better tree-shaking so types don't bring runtime dependencies
- Complete event coverage (no missing `tool_call_end`)
- Session/agent pooling built into SDK
- Typed provider options

### Project 2: Claude Supervisor (claude-supervisor-dev)

**What it is**: Multi-provider AI session supervisor with human-in-the-loop permission approval. Full-stack (backend + Web UI + Telegram + NATS).

**SDK version**: `^0.5.2`

**APIs used**:
- All 3 backend sub-paths (`/claude`, `/copilot`, `/vercel-ai`)
- `agent.run()`, `agent.runStructured<T>()`, `agent.stream()` — all modes
- `sessionMode: 'persistent'` — session resume
- `supervisor.onPermission()` — permission callbacks
- `session_info` event — transcript path capture
- Auth: `CopilotAuth`, `ClaudeAuth` — full OAuth flows

**Session management**:
- **`AgentServicePool`** — caches `IAgentService` per `provider:configName:workingDirectory` key with deduplication of concurrent creation.
- **`SDKSessionAdapter`** — wraps SDK agents with **SQLite-persisted session state**, mapping internal session IDs to backend `backendSessionId`.
- They track `session_info` events to capture transcript paths.

**Pain points & workarounds** (documented in their `docs/SDK-ISSUES.md`):

| # | Issue | Workaround | Root Cause |
|---|-------|-----------|------------|
| 1 | **`toolCallId` not normalized** | Casts `rawSDKRequest` and extracts `toolUseID` (Claude) or `toolCallId` (Copilot) manually | `PermissionRequest` lacks normalized tool call ID |
| 2 | **No model tier metadata** | Custom `inferModelTier()` — string-matches model names (`haiku→fast`, `opus→premium`) | `listModels()` returns only `{ id, name }` |
| 3 | **Vercel AI `listModels()` returns empty** | Falls back to direct HTTP fetch to `/models` endpoint | SDK doesn't handle this provider's API |
| 4 | **Error classification by string matching** | Custom `classify-error.ts` matches "401", "429", "rate limit" patterns | No structured error types from SDK |
| 5 | **4 Jest module name mappings needed** | Complex Jest config for SDK sub-path exports | ESM/CJS resolution complexity |

**What they need from us**:
- Normalized `toolCallId` in `PermissionRequest`
- Model metadata (tier, context window, pricing)
- Structured error types with codes (not string matching)
- Better ESM/CJS interop for testing

### Project 3: News Podcast (news-podcast)

**What it is**: AI-powered news podcast generator with voice synthesis. Monorepo (backend/frontend/telegram-bot). Runs in Docker.

**SDK version**: `^0.6.1`

**APIs used**:
- `createAgentService()` — factory with provider caching
- `agent.run()`, `agent.stream()` — both modes
- `AgentEvent` processing — full event union
- Auth: `CopilotAuth`, `ClaudeAuth` — device flow + OAuth
- `AbortSignal.timeout` composition

**Session management**:
- **Per-call agents**: New `IAgent` created for each `runPrompt()` call, `dispose()`d after. No persistent sessions.
- **Service caching**: `Map<ProviderType, IAgentService>` — one service per provider, invalidated on config/token change.
- Token refresh: Proactive Claude token refresh (5-min buffer before expiry).

**Pain points & workarounds**:

| # | Issue | Workaround | Root Cause |
|---|-------|-----------|------------|
| 1 | **Hardcoded fallback model list** | 10+ Claude models hardcoded | `listModels()` returns empty without token |
| 2 | **`total_cost_usd: 0` always** | Cost tracking disabled | SDK doesn't expose cost data |
| 3 | **Error classification by strings** | Pattern-matching "429", "rate limit" on error messages | Same as supervisor — no structured errors |
| 4 | **300s timeout as "safety net"** | Generous `SEND_AND_WAIT_TIMEOUT_MS` | No clear guidance on reasonable timeouts |
| 5 | **Auto-allow all permissions** | `onPermission: async () => ({ allowed: true })` | No "auto-allow" permission mode built-in |

**What they need from us**:
- Cost/usage data in events
- Structured error types
- Default permission modes (auto-allow, auto-deny)
- Model list that works without auth (for UI display)

### Benchmark: Planeta Analysis (planeta-analysis-worktree)

**What it is**: Analytics platform monorepo. Uses `@openai/agents` + Vercel AI SDK v5 + `@assistant-ui/react` + LangChain. **Does NOT use @witqq/agent-sdk** — included as a benchmark for how others solve the same problems.

**SDK version**: N/A — not a dependency

**How they solve the same problems we face**:

| Feature | Their Approach | Our SDK Status |
|---------|---------------|----------------|
| **Thread management** | SQLite: `threads → messages → tool_calls` tables. ThreadService with CRUD, ownership, cleanup. | Chat-sdk sessions store messages inside session object (CRITICAL-6,7) |
| **Session switching** | Stateless backend — reload full history from DB per request. No in-memory sessions. | Must dispose/recreate agent (CRITICAL-1) |
| **Chat UI** | `@assistant-ui/react` primitives: Thread, Message, Composer, BranchPicker, ThreadList | We build custom React components from scratch |
| **State bridge** | `useExternalStoreRuntime()` + `threadListAdapter` connecting MobX to assistant-ui | No integration layer |
| **Message editing** | `onEdit` truncates history and resends | Not supported |
| **Branch navigation** | `BranchPickerPrimitive` for message alternatives | Not supported |
| **Auto-title** | Generated from first assistant response | Not implemented |
| **Thread lifecycle** | `local_XXXXX → real_ID` replacement on first message | Not implemented |

**Key architectural insight**: Their backend is **stateless per request** — DB is single source of truth, frontend store is local cache. No in-memory session management. This is the RIGHT pattern for multi-user apps and what our chat-sdk should enable.

### Cross-Consumer Summary

**Common patterns across all 3 active consumers**:
1. **Custom service caching** — all 3 build their own LRU cache of `IAgentService` (SDK provides nothing)
2. **Error classification by string matching** — all 3 parse error messages for "429", "rate limit", etc.
3. **Type workarounds** — duplicated types, unsafe casts, or local re-declarations
4. **Auth token lifecycle** — all manage token storage/refresh themselves
5. **No session management from SDK** — each builds custom session infrastructure

**Features ALL consumers want but don't have**:
1. Structured error types with codes
2. Service pooling/caching
3. Model metadata (tier, context window)
4. Cost/usage tracking
5. Auto-allow permission mode
6. Session management that doesn't require dispose/recreate

---


## Proposed Architecture v3

### Key Design Decisions

#### Decision 1: Remove IAgent as separate entity

**Why:** IAgent mixed 3 responsibilities: configuration, execution, lifecycle. Competitors separate these: OpenAI has Agent (config) + Runner (execution), LangChain has Runnable (execution) + MessageHistory (state).

**Solution:** IAgentService creates ISession directly. No intermediate IAgent middleman. Service = backend connection + factory. Session = conversation context + execution.

**Evidence:** Vercel AI SDK has no Agent entity — just `streamText()` calls. LangChain has no Agent class between Runnable and MessageHistory. OpenAI's Agent is purely config — Runner does execution.

#### Decision 2: ITranscript as separate concept (not inside ISession)

**Why:** User requirement: "нужен концепт транскрипта/истории отдельно от сессии". For CLI: transcript comes from CLI storage. For API: transcript comes from ITranscriptStore. Transcript can be exported and imported across sessions/adapters.

**Evidence:** LangChain's `BaseChatMessageHistory` (17 adapters) is separate from the runnable. OpenAI Agents' `Session` interface is purely a message container. assistant-ui's `ThreadHistoryAdapter` is pluggable and separate from the runtime.

#### Decision 3: Model per-call, not per-session

**Why:** User requirement: "начать сессию с одной моделью а продолжить с другой". Every competitor does this: Vercel AI (model on every streamText call + prepareStep for per-step), OpenAI Agents (RunConfig.model overrides Agent.model), LangChain (model = Runnable node, fully decoupled), Claude SDK v1 (Query.setModel() mid-stream).

**Solution:** SessionConfig has optional `model` as default. RunOptions has `model` as per-call override. Session's transcript stores which model was used per-message.

#### Decision 4: SessionHooks replaces SupervisorHooks (6 hooks vs 2)

**Why:** Both CLI SDKs have preToolUse/postToolUse/onPermission/onSessionStart/onSessionEnd. Our SupervisorHooks only had onPermission + onAskUser — insufficient.

**Evidence:** Copilot SDK has SessionHooks (onPreToolUse, onPostToolUse, onUserPromptSubmitted, onSessionStart, onSessionEnd, onErrorOccurred). Claude SDK has hook events (PreToolUse, PostToolUse, PermissionRequest, SessionStart, SessionEnd, Stop). OpenAI Agents has AgentHooks EventEmitter.

#### Decision 5: ITranscriptStore is optional — SDK manages lifecycle when provided

**Why:** User requirement: "store должен быть опциональным, SDK работает и без него, но если передан — SDK полностью управляет lifecycle". CLI backends store history internally. API backends need storage. When store is provided, SDK auto-mirrors messages for recovery after restart.

**Evidence:** LangChain — storage is BYO via `getMessageHistory(sessionId)` factory. OpenAI Agents — `Session` is optional on `run()`. assistant-ui — `ThreadHistoryAdapter` is optional. All make storage pluggable and optional.

### Core Interfaces (4 key interfaces)

```typescript
// ============================================
// 1. ISession — main entity (replaces IAgent)
// ============================================
interface ISession {
  /** Unique session ID. CLI: from SDK. API: generated UUID. */
  readonly id: string;

  /** Session metadata. */
  readonly metadata: SessionMetadata;

  /** Current state: idle, running, streaming, disposed. */
  readonly state: SessionState;

  /** Transcript — message history of this session.
   *  CLI: reads from CLI's internal storage.
   *  API: reads from ITranscriptStore.
   *  Always available even without explicit store. */
  readonly transcript: ITranscript;

  /** Send message, get response.
   *  model/systemPrompt in RunOptions override session defaults. */
  run(prompt: MessageContent, options?: RunOptions): Promise<AgentResult>;

  /** Streaming response. */
  stream(prompt: MessageContent, options?: RunOptions): AsyncIterable<AgentEvent>;

  /** Structured output with Zod schema. */
  runStructured<T>(
    prompt: MessageContent,
    schema: StructuredOutputConfig<T>,
    options?: RunOptions,
  ): Promise<AgentResult<T>>;

  /** Cancel current run. */
  abort(): void;

  /** Release resources. CLI: destroy subprocess.
   *  Session can be restored via service.getSession(id)
   *  if transcript is saved (in CLI or in store). */
  dispose(): Promise<void>;
}

type SessionState = 'idle' | 'running' | 'streaming' | 'disposed';

interface SessionMetadata {
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  defaults?: {
    model?: string;
    systemPrompt?: string;
  };
  custom?: Record<string, unknown>;
}

// ============================================
// 2. ITranscript — message history (separate from session)
// Inspired by: LangChain BaseChatMessageHistory,
//   OpenAI Agents Session.getItems/addItems
// ============================================
interface ITranscript {
  /** Get messages with optional pagination. */
  getMessages(options?: { limit?: number; offset?: number }): Promise<Message[]>;

  /** Add a message. Used by SDK for auto-mirroring to store.
   *  Also available for manual message injection (e.g., restore from backup). */
  addMessage(message: Message): Promise<void>;

  /** Subscribe to new messages.
   *  Works even for CLI adapters — react to messages/tools without storage. */
  onMessage(listener: (message: Message) => void): () => void;

  /** Clear history. */
  clear(): Promise<void>;

  /** Message count. */
  count(): Promise<number>;

  /** Export full history. For migration between adapters/sessions. */
  export(): Promise<Message[]>;
}

// ============================================
// 3. ITranscriptStore — pluggable storage
// Inspired by: LangChain (17 adapters), OpenAI Session interface
// Optional. If not provided: CLI stores internally, API uses InMemory.
// If provided: SDK auto-mirrors messages for recovery.
// ============================================
interface ITranscriptStore {
  /** Get/create transcript for a session. */
  getTranscript(sessionId: string): Promise<ITranscript>;

  /** List sessions (metadata only). */
  listSessions(options?: { limit?: number; offset?: number }): Promise<SessionMetadata[]>;

  /** Create new session in store. Returns session ID. */
  createSession(metadata: SessionMetadata): Promise<string>;

  /** Delete session and its transcript. */
  deleteSession(sessionId: string): Promise<void>;

  /** Update session metadata. */
  updateSession(sessionId: string, metadata: Partial<SessionMetadata>): Promise<void>;
}

// ============================================
// 4. SessionHooks — extended hooks (replaces SupervisorHooks)
// Inspired by: Copilot SDK SessionHooks, Claude SDK hook events,
//   OpenAI Agents AgentHooks EventEmitter
// ============================================
interface SessionHooks {
  /** Before tool execution. Can allow/deny/modify args.
   *  Maps to: Copilot onPreToolUse, Claude PreToolUse hook */
  onPreToolUse?(context: PreToolUseContext): Promise<ToolHookResult>;

  /** After tool execution. Can inspect/modify result.
   *  Maps to: Copilot onPostToolUse, Claude PostToolUse hook */
  onPostToolUse?(context: PostToolUseContext): Promise<void>;

  /** Permission request (merges old onPermission).
   *  Maps to: Copilot PermissionHandler, Claude canUseTool */
  onPermission?(request: PermissionRequest): Promise<PermissionDecision>;

  /** User input request.
   *  Maps to: Copilot onUserInputRequest */
  onAskUser?(request: UserInputRequest): Promise<UserInputResponse>;

  /** Event stream tap — for logging, monitoring, UI updates.
   *  Receives every AgentEvent without blocking execution. */
  onEvent?(event: AgentEvent): void;

  /** Error handler. Can retry/skip/abort.
   *  Maps to: Copilot onErrorOccurred */
  onError?(error: Error): ErrorAction;
}

interface PreToolUseContext {
  toolName: string;
  args: Record<string, unknown>;
  sessionId: string;
}

type ToolHookResult =
  | { action: 'allow' }
  | { action: 'allow'; modifiedArgs: Record<string, unknown> }
  | { action: 'deny'; reason: string };

interface PostToolUseContext extends PreToolUseContext {
  result: unknown;
  durationMs: number;
}

type ErrorAction = 'retry' | 'skip' | 'abort';
```

### Updated IAgentService

```typescript
interface IAgentService {
  /** Create new session.
   *  Copilot: client.createSession(config)
   *  Claude: query({ options: { sessionId } })
   *  Vercel AI: store.createSession() + in-memory context */
  createSession(config?: SessionConfig): Promise<ISession>;

  /** Restore session by ID.
   *  Recovery flow:
   *  1. Try CLI resume (Copilot: resumeSession, Claude: resume option)
   *  2. If CLI session lost but store exists → load from store → create new CLI → replay
   *  3. If no store → return null
   *  Copilot: client.resumeSession(id)
   *  Claude: query({ options: { resume: id } })
   *  Vercel AI: store.getTranscript(id) + rebuild context */
  getSession(id: string): Promise<ISession | null>;

  /** List sessions.
   *  Copilot: client.listSessions() (full support)
   *  Claude: from store if available (no native listSessions)
   *  Vercel AI: from store */
  listSessions(options?: { limit?: number; offset?: number }): Promise<SessionInfo[]>;

  /** One-shot call without session (ephemeral). */
  run(prompt: MessageContent, options?: RunOptions): Promise<AgentResult>;
  stream(prompt: MessageContent, options?: RunOptions): AsyncIterable<AgentEvent>;

  /** List available models. */
  listModels(): Promise<ModelInfo[]>;

  /** Release all resources. */
  dispose(): Promise<void>;
}

interface SessionConfig {
  title?: string;
  model?: string;           // default for this session, overridable per-call
  systemPrompt?: string;    // default for this session
  tools?: ToolDefinition[];
  hooks?: SessionHooks;
  custom?: Record<string, unknown>;
}

// RunOptions: per-call overrides
interface RunOptions {
  signal?: AbortSignal;
  model?: string;           // override model for this call
  systemPrompt?: string;    // override prompt for this call
  temperature?: number;
  maxTokens?: number;
  context?: Record<string, unknown>;
}

interface SessionInfo {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount?: number;
}
```

### Backend Mapping

| Our Abstraction | Copilot SDK | Claude SDK (v1) | Claude SDK (v2) | Vercel AI |
|---|---|---|---|---|
| `service.createSession()` | `client.createSession(config)` | `query({ options: { sessionId } })` | `v2_createSession(opts)` | `store.createSession()` |
| `service.getSession(id)` | `client.resumeSession(id)` | `query({ options: { resume: id } })` | `v2_resumeSession(id)` | `store.getTranscript(id)` |
| `service.listSessions()` | `client.listSessions()` → `SessionMetadata[]` | From store (no native API) | From store (no native API) | From store |
| `session.run(prompt, { model })` | `session.send(opts)` (model per-session) | New `query({ model })` call | `session.send(msg)` (model per-session) | `generateText({ model, messages })` |
| `session.stream(prompt)` | `session.send(opts)` + event listener | `query()` async iterator | `session.stream()` | `streamText({ model, messages })` |
| `session.transcript.getMessages()` | `session.getMessages()` | Replay events on resume | `session.stream()` on resume | From store |
| `session.transcript.onMessage()` | `session.on('assistant.message')` | Stream event listener | `session.stream()` listener | Post-`generateText` callback |
| `session.abort()` | `session.abort()` | `query.close()` | `session.close()` | `AbortSignal` |
| `session.dispose()` | `session.destroy()` | Process exit | `session[Symbol.asyncDispose]()` | N/A |
| `hooks.onPreToolUse` | `SessionHooks.onPreToolUse` | `PreToolUse` hook | `PreToolUse` hook | Custom wrapper |
| `hooks.onPermission` | `PermissionHandler` | `canUseTool()` | `canUseTool()` | N/A (no permissions) |
| `hooks.onEvent` | `session.on(eventType)` | Stream events | Stream events | `onChunk`/`onStepFinish` |

### Session Recovery Flow

```
service.getSession(id):
  ┌─ 1. Try CLI resume ─────────────────────────┐
  │   Copilot: client.resumeSession(id)          │
  │   Claude: query({ options: { resume: id } }) │
  │   ✓ → return session (CLI has full context)   │
  │   ✗ → step 2                                  │
  └──────────────────────────────────────────────┘
  ┌─ 2. Has transcriptStore? ────────────────────┐
  │   ✓ → load messages from store               │
  │     → create NEW CLI session                  │
  │     → replay messages internally               │
  │     → return session                          │
  │   ✗ → step 3                                  │
  └──────────────────────────────────────────────┘
  ┌─ 3. No recovery possible ────────────────────┐
  │   → return null                               │
  └──────────────────────────────────────────────┘
```

### Consumer Usage Examples

```typescript
// ── 1. Simple: ephemeral, no session ──
const service = createAgentService('copilot', { model: 'gpt-4.1' });
const result = await service.run('What is 2+2?');
console.log(result.output); // "4"

// ── 2. Multi-session ──
const chat1 = await service.createSession({ title: 'Code review' });
const chat2 = await service.createSession({ title: 'Planning' });
await chat1.run("I'm working on auth");
await chat2.run("I'm planning sprint");
await chat1.run("What module?"); // → "auth"
await chat2.run("What am I doing?"); // → "planning sprint"

// ── 3. Model switch mid-session (Vercel AI — supports any model per-call) ──
const vercelService = createAgentService('vercel-ai', { apiKey: '...', baseUrl: 'https://api.openai.com/v1' });
const session = await vercelService.createSession({ model: 'gpt-4.1' });
await session.run('Analyze this code');
await session.run('Now explain', { model: 'o3-mini' }); // different model, same context

// ── 4. Restore after restart (with store) ──
const store = new SQLiteTranscriptStore('./sessions.db');
const service = createAgentService('copilot', { model: 'gpt-4.1', transcriptStore: store });
const session = await service.createSession({ title: 'Important work' });
await session.run('Remember: deadline March 15');
const id = session.id;
// ─── RESTART ───
const service2 = createAgentService('copilot', { model: 'gpt-4.1', transcriptStore: store });
const restored = await service2.getSession(id); // SDK handles recovery
await restored!.run('What is the deadline?'); // → "March 15" ✓

// ── 5. Switch adapter (Copilot → Vercel AI) ──
const history = await session.transcript.export();
await session.dispose();
const vercel = createAgentService('vercel-ai', { apiKey: '...', transcriptStore: store });
const newSession = await vercel.createSession({ title: 'Continued' });
await newSession.run('Continue', { context: { previousMessages: history } });

// ── 6. Hooks for events and permissions ──
const supervised = await service.createSession({
  title: 'Supervised',
  hooks: {
    onEvent(event) { ws.send(JSON.stringify(event)); },
    async onPreToolUse({ toolName, args }) {
      if (toolName === 'write_file' && args.path?.includes('/etc'))
        return { action: 'deny', reason: 'Cannot write to /etc' };
      return { action: 'allow' };
    },
    async onPermission(request) {
      return { allowed: await showDialog(request), scope: 'session' };
    },
    onError(error) {
      return error.message.includes('rate limit') ? 'retry' : 'abort';
    },
  },
});

// ── 7. Custom Postgres adapter ──
class PostgresStore implements ITranscriptStore { /* ... */ }
const service = createAgentService('vercel-ai', {
  apiKey: '...', transcriptStore: new PostgresStore(pool),
});

// ── 8. CLI monitoring (no storage, just events) ──
const monitored = await service.createSession({
  hooks: { onEvent(e) { analytics.track(e.type); } },
});
const history = await monitored.transcript.getMessages(); // reads from CLI
monitored.transcript.onMessage((msg) => { db.log(msg); }); // react without storing
```

### Breaking Changes

| Change | Impact | Migration |
|--------|--------|-----------|
| `IAgent` removed | **High** | Replace `service.createAgent(config)` → `service.createSession(config)` |
| `AgentConfig` → `SessionConfig` | **High** | Rename and move per-call fields to `RunOptions` |
| `SupervisorHooks` → `SessionHooks` | **Medium** | Rename `onPermission`→`onPermission` (same), add new hooks |
| `BaseAgent` → `BaseSession` | **Medium** (backend authors) | Rename class, implement `transcript` property |
| `RunOptions` gains `model`, `systemPrompt` | **None** — additive | Use for per-call overrides |
| New `ITranscript` interface | **None** — additive | Access via `session.transcript` |
| New `ITranscriptStore` interface | **None** — additive | Pass to service for persistence |
| `ChatSession.messages` removed | **High** (chat-sdk) | Use `session.transcript.getMessages()` |
| `IChatProvider` removed | **High** (chat-sdk) | Use `ISession` directly |
| `ChatEvent` unified with `AgentEvent` | **High** (chat-sdk) | Use `AgentEvent` everywhere |
| `AuthError` unified (one class) | **Low** | Import from `@witqq/agent-sdk` |
| `AgentSDKError` gains `code` + `retryable` | **None** — additive | Use `error.code` instead of string matching |

### Migration: Session Switch

```
Before (v2 — slow, subprocess restart):
  agent.dispose();
  const newAgent = service.createAgent(config);
  await newAgent.runWithContext(newMessages);

After (v3 — fast, native sessions):
  const session1 = await service.createSession();
  await session1.run("Hello");
  const session2 = await service.createSession();
  await session2.run("Different chat");
  await session1.run("Continue here"); // no restart
```

### v2 → v3 Comparison

| | v2 (ISession+IAgent) | v3 (ISession only) |
|---|---|---|
| Entity chain | IAgentService → IAgent → ISession | IAgentService → ISession |
| History | Inside ISession (getMessages) | Separate ITranscript |
| Storage | ISessionStore on IAgent | ITranscriptStore on IAgentService |
| Hooks | SupervisorHooks (2 hooks) | SessionHooks (6 hooks) |
| Model | Per-session fixed | Per-call override + session default |
| Adapter switch | Not possible | transcript.export() → new session |
| Event tap | No | hooks.onEvent + transcript.onMessage |

---

## Competitor Research (Phase 2)

Полный анализ конкурентов доступен в: **docs/architecture/COMPETITOR-ANALYSIS.md**

### Проанализированные SDK (из исходников)

| SDK | Что взять | Что НЕ делать |
|-----|-----------|--------------|
| **Vercel AI SDK v6** | UIMessageChunk streaming protocol (~25 типов), ChatTransport interface с reconnection, parts-based UIMessage model | Нет session storage, нет UI компонентов |
| **assistant-ui** | 3-tier component system (primitives→styled→slots), ThreadList management, per-part status tracking, framework-agnostic core | Custom reactive system (tap) — over-engineered для нашего случая |
| **OpenAI Agents SDK** | Generic TContext, Session protocol simplicity, two-tier hooks (global + per-agent), RunState для resumable runs | Python-only, handoffs complexity |
| **LangChain.js** | Error codes enum, withRetry()/withFallbacks() composition, namespace branding | CallbackManager complexity, Runnable interface overhead |
| **Anthropic SDK** | MessageStream accumulator pattern, retry с jitter + retry-after headers, async API key rotation | Stateless, no session/chat |
| **ai-chatbot (Vercel)** | Parts-based rendering, tool approval UI, auto-scroll + streaming UX patterns | Full-stack coupling, no abstraction |

### Industry Best Practices (15 паттернов)

1. Parts-based message model (не string) — все 5 SDK
2. Per-part status tracking — assistant-ui
3. Typed stream event union — все 5 SDK
4. Pluggable session storage — OpenAI, LangChain, assistant-ui
5. Transport abstraction — Vercel AI
6. Tool approval state machine — Vercel AI, OpenAI, assistant-ui
7. Headless primitives + styled layer — assistant-ui
8. Exponential backoff с jitter — Vercel AI, Anthropic, LangChain
9. Error code classification — LangChain
10. Framework-agnostic core — assistant-ui
11. Component slot system — assistant-ui, ai-chatbot
12. Thread list management — assistant-ui
13. Reconnection support — Vercel AI
14. Lifecycle hooks (2 levels) — OpenAI Agents
15. Message branching — assistant-ui

### Наши конкурентные преимущества

1. **CLI backend integration** — уникально: Claude Code + Copilot CLI
2. **Built-in permission system** — v3.1, scopes once/session/project/always
3. **Context window management** — ContextWindowManager превосходит конкурентов
4. **Event bus с middleware** — ChatEventBus + TypedEventEmitter + middleware

### Критические gaps (требуют решения в Phase 4)

1. Нет parts-based message model
2. Нет transport abstraction
3. Нет headless UI primitives
4. Нет thread list management
5. Нет tool approval state machine
6. Нет reconnection support
7. Session 1:1 coupled с agent

---

## Backend Mapping (Phase 3)

### API Surface по бэкендам

| Capability | Copilot SDK | Claude SDK | Vercel AI SDK |
|-----------|------------|-----------|--------------|
| **Session modes** | per-call / persistent | per-call / persistent (resume) | per-call only |
| **Session ID** | `session.sessionId` | SDK `session_id` from result | Нет |
| **Session resume** | Нет cross-process | `resume: sessionId` | Нет |
| **Message format** | Text prompt (serialized) | Text prompt / last msg (persistent) | `Message[]` structured |
| **Streaming events** | 7 SDK event types | AsyncGenerator<SDKMessage> | `fullStream` iterable |
| **Token counting** | `assistant.usage` event | `modelUsage` map | `totalUsage` / per-step |
| **Context management** | SDK internal (opaque) | SDK internal | Нет |
| **Model config** | `model` only (no params) | `model`, systemPrompt | `model`, temperature, maxTokens, topP, providerOptions |
| **Model listing** | `client.listModels()` | HTTP API `/v1/models` | HTTP GET `{baseUrl}/models` |
| **Tool definition** | Zod schemas → SDK Tool[] | MCP server (Zod shape) | `tool()` + jsonSchema |
| **Tool approval** | Permission → SDK PermissionResult | `canUseTool` callback | `needsApproval` + wrapToolExecute |
| **Permission store** | `IPermissionStore` + callback | `IPermissionStore` + canUseTool | `IPermissionStore` + wrapToolExecute |
| **Permission scopes** | once/session/project/always | once/session → SDK "session", project → "projectSettings", always → "userSettings" | once/session/project/always |
| **User input** | `onUserInputRequest` | ⚠️ Not supported | `ask_user` injected tool |
| **Error handling** | SubprocessError, AbortError | SubprocessError, AbortError | DependencyError, ToolExecutionError, AbortError |
| **Error recovery** | clearPersistentSession on error | clearPersistentSession on error | No recovery |
| **Retry** | Auto-restart subprocess | Нет | Нет |
| **Structured output** | Prompt augmentation + JSON parse | Prompt augmentation + JSON parse | `generateObject()` native |
| **Transport** | stdio subprocess | SDK subprocess | HTTP API (via `ai` package) |
| **Abort** | `session.abort()` | `query.interrupt()` / `.close()` | AbortSignal on SDK calls |

### Must-Have Use Cases → Backend Mapping

| Requirement | Copilot | Claude | Vercel AI | Эмуляция |
|------------|---------|--------|-----------|----------|
| **M1: Create session** | ✅ persistent mode | ✅ persistent + resume | ❌ нет сессий | **Эмулировать**: message array = session |
| **M1: Switch session** | ❌ | ❌ | ❌ | **Эмулировать**: new agent or switch context |
| **M1: Restore session** | ⚠️ только если CLI сессия жива | ✅ resume by sessionId | ❌ | **Эмулировать**: replay message history |
| **M2: Save messages** | ❌ нет API | ❌ нет API | ❌ нет API | **Chat-SDK layer**: adapter pattern |
| **M2: Load messages** | ❌ | ❌ | ✅ accepts Message[] | **Chat-SDK layer**: adapter → messages |
| **M3: Text streaming** | ✅ text_delta | ✅ text_delta | ✅ text-delta | Native |
| **M3: Thinking streaming** | ✅ reasoning events | ✅ thinking blocks | ✅ reasoning events | Native |
| **M3: Tool streaming** | ✅ tool_call_start/end | ✅ tool events | ✅ tool-call/result | Native |
| **M4: Token tracking** | ✅ usage events | ✅ modelUsage | ✅ totalUsage | Native |
| **M4: Context trimming** | ❌ SDK internal | ❌ SDK internal | ❌ нет | **Chat-SDK layer**: ContextWindowManager |
| **M5: Error classification** | ⚠️ basic | ⚠️ basic | ⚠️ basic | **Chat-SDK layer**: error classifier |
| **M5: Retry** | ⚠️ subprocess restart | ❌ | ❌ | **Chat-SDK layer**: retry strategy |
| **M7: Model selection** | ✅ model string | ✅ model string | ✅ model + params | Native |
| **M7: Model listing** | ✅ listModels() | ✅ listModels() | ✅ listModels() | Native |
| **M8: Tool definition** | ✅ Zod → SDK | ✅ MCP server | ✅ jsonSchema | Native |
| **M8: Tool execution** | ✅ execute callback | ✅ MCP handler | ✅ execute wrapper | Native |
| **M8: Tool approval** | ✅ onPermission | ✅ canUseTool | ✅ needsApproval | Native |
| **M9: Lifecycle events** | ✅ 7 event types | ✅ AsyncGenerator events | ✅ stream parts | Native (unified mapping) |
| **M11: Permission scopes** | ✅ 4 scopes | ✅ 4 scopes (mapped) | ✅ 4 scopes | Native |

### Операции требующие эмуляции

| # | Операция | Бэкенды | Стратегия эмуляции |
|---|---------|---------|-------------------|
| 1 | **Session create/switch** | Vercel AI | Message array = session state. Chat-SDK manages session, passes full history |
| 2 | **Session restore** | Copilot, Vercel AI | Replay saved message history into new agent call |
| 3 | **Message persistence** | Все три | Chat-SDK SessionStorage adapter layer (InMemory/File/Custom) |
| 4 | **Context window management** | Все три | Chat-SDK ContextWindowManager (уже есть) |
| 5 | **Error classification** | Все три | Chat-SDK error classifier (уже есть) |
| 6 | **Retry strategy** | Claude, Vercel AI | Chat-SDK retry wrapper с exponential backoff |
| 7 | **Thread list** | Все три | Chat-SDK ThreadListManager (new) |
| 8 | **Reconnection** | Все три | Chat-SDK transport layer reconnection |
| 9 | **Parts-based messages** | Все три (events flat) | Chat-SDK message accumulator (stream events → UIMessage parts) |
| 10 | **Tool approval state machine** | Все три (basic) | Chat-SDK approval flow (requires-action → approved/denied) |

### Ограничения по бэкендам (невозможно эмулировать)

| # | Ограничение | Бэкенд | Impact |
|---|------------|--------|--------|
| 1 | **Нет model params** (temperature, topP) | Copilot | Low — CLI выбирает оптимальные |
| 2 | **Нет askUser** | Claude | Medium — workaround через tool |
| 3 | **Нет mid-run model switch** | Все три | None — by design (model per session) |
| 4 | **Нет partial tool streaming** | Copilot | Low — tool results atomic |
| 5 | **Нет structured output streaming** | Copilot, Claude | Low — batch result OK |

### Lowest Common Denominator (LCD)

Все 3 бэкенда поддерживают:
- Text/thinking/tool streaming events
- Tool definition via Zod schemas
- Tool permission/approval callbacks
- Usage/token tracking (post-call)
- Model selection (string)
- Abort/cancel
- Error events

Chat-SDK abstraction layer MUST provide:
- Session management (create/switch/restore) over all backends
- Message persistence via adapter
- Parts-based message model with accumulator
- Thread list management
- Error classification + retry
- Transport abstraction with reconnection
- Tool approval state machine
