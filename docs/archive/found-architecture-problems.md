# SDK Architecture Review — Root Cause Analysis

Date: 2025-02-24
Trigger: Model passthrough bug → revealed fundamental design flaws

## The Real Problems

This review goes beyond symptoms (specific bugs) to analyze **why the API design makes these bugs inevitable**. The model passthrough bug is not a single mistake — it's a predictable consequence of 4 foundational architecture problems.

---

## Problem 1: Agent Identity Is Conflated With Runtime Parameters

**What**: `AgentConfig` mixes things with fundamentally different lifecycles into one frozen blob.

```typescript
// types.ts:322-355 — ONE config for everything
interface AgentConfig {
  model?: string;           // ← changes per-call or per-user-action
  modelParams?: ModelParams; // ← changes per-call
  systemPrompt: string;     // ← stable for session lifetime
  tools: ToolDefinition[];  // ← can change at runtime (registerTool)
  sessionMode?: "per-call" | "persistent";  // ← set once, never changes
  supervisor?: SupervisorHooks;  // ← set once
  availableTools?: string[];     // ← set once
  providerOptions?: Record<string, Record<string, unknown>>; // ← changes per-call
}
```

Then `BaseAgent` freezes ALL of it at construction (base-agent.ts:32):
```typescript
this.config = Object.freeze({ ...config });
```

**Why this is wrong**: `model` has the lifecycle of a per-call parameter (user can switch models between messages). `systemPrompt` has the lifecycle of a session. `sessionMode` has the lifecycle of a backend. They should NOT be in the same object, and certainly not all frozen.

**What it causes**:
- Model can never change on an existing agent → must destroy + recreate → loses CLI session
- Tools can never change on existing agent → `registerTool()` in runtime has no way to propagate
- No concept of "update this parameter without destroying everything"

**What the API should look like**:
```typescript
// Immutable identity — set once at agent creation
interface AgentIdentity {
  systemPrompt: string;
  sessionMode?: "per-call" | "persistent";
  supervisor?: SupervisorHooks;
  availableTools?: string[];
}

// Per-call parameters — passed to run()/stream(), NOT frozen
interface CallOptions {
  model?: string;
  modelParams?: ModelParams;
  tools?: ToolDefinition[];       // runtime-level tools injected per-call
  providerOptions?: Record<string, Record<string, unknown>>;
  signal?: AbortSignal;
}
```

The agent reads `options.model ?? this._defaultModel` on each call instead of `this.config.model`.

---

## Problem 2: No Change Propagation Across Layers

**What**: The layer stack is `Runtime → Adapter → Agent → Backend SDK`, but changes at the top CANNOT propagate down.

```
ChatRuntime._currentModel = "gpt-5-mini"  ← user calls switchModel()
    ↓ (no propagation mechanism)
BaseBackendAdapter._agent (cached)         ← still has old model
    ↓ (config frozen)
CopilotAgent.config.model                  ← immutable
    ↓ (baked at construction)
CopilotAgent.sessionConfig.model           ← immutable snapshot
    ↓
Copilot CLI SDK session                    ← uses baked model
```

There are 4 layers and ZERO mechanisms for top-down state updates:
- `switchModel()` (runtime.ts:515-517) is a fire-and-forget setter — sets `_currentModel` and returns
- `switchBackend()` (runtime.ts:497-513) works by **destroying** the adapter, not updating it
- The adapter has no `updateModel()`, `invalidate()`, or observer pattern
- The agent has no `setModel()`, `updateConfig()`, or any mutation API
- `switchProvider()` works **by accident** — it calls `switchBackend()` first which destroys the adapter

**Why this is wrong**: A UI application (which this SDK enables) is inherently dynamic. Users change models, tools get registered, providers get switched. The architecture assumes all config is known at construction time and never changes — that's a CLI/script assumption, not a chat app assumption.

**What it causes**:
- `switchModel()` appears to work (updates getter) but silently does nothing for 2/3 backends
- The adapter's `getOrCreateAgent(options)` receives model override in `options` but discards it for cached persistent agents (base.ts:187-189)
- Tools registered via `runtime.registerTool()` get injected at the `send()` level but never update the agent's tool list

**What the API should look like**:
Option A: Adapter accepts per-call config, creates/recycles agent as needed:
```typescript
// Adapter level
streamMessage(session, message, options: { model?, tools?, ... }): AsyncIterable<ChatEvent>
// Adapter decides: same model → reuse agent; different model → dispose + recreate
```

Option B: Agent accepts per-call parameters:
```typescript
// Agent level
streamWithContext(messages, options: { model?, tools?, ... }): AsyncIterable<AgentEvent>
// Agent forwards model to CLI SDK per-call, no need to recreate
```

Option B is better because CLI sessions (Copilot, Claude) may support model switching natively without session destruction. But Option A is simpler to implement now.

---

## Problem 3: Adapter Conflates Connection, Session, and Config

**What**: `BaseBackendAdapter` manages 3 things with one cached `_agent`:

```typescript
// base.ts:33-51
class BaseBackendAdapter {
  _agentService: IAgentService;  // connection factory
  _agent: IAgent | null;         // cached: connection + session + config
  _agentConfig: AgentConfig;     // snapshot of config at adapter creation
}
```

The `_agent` bundles:
1. **Connection** to the CLI process (Copilot/Claude) or API endpoint (Vercel)
2. **Session state** (conversation history in CLI, session ID for resume)
3. **Configuration** (model, system prompt, tools)

These should be separate because they have different invalidation triggers:
- Connection → invalidated by auth failure, CLI crash, backend switch
- Session → invalidated by explicit session switch or destruction
- Configuration → invalidated by switchModel(), registerTool()

**Why this is wrong**: When the user switches model, we want to change the config but keep the connection and session. When the backend crashes, we want to recreate the connection but keep the config. The current design forces all-or-nothing: dispose the agent = destroy everything.

**What it causes**:
- Model switch destroys CLI session (conversation history lost in backend)
- Backend crash destroys config (model, tools must be re-provided)
- `CopilotChatAdapter` and `ClaudeChatAdapter` force `sessionMode: "persistent"` (they know sessions should persist), but then the adapter's `getOrCreateAgent()` doesn't respect model changes because the cached agent is the session

**What the API should look like**:
```typescript
// Adapter manages lifecycle independently
class BaseBackendAdapter {
  _agentService: IAgentService;  // connection factory — long-lived
  _agent: IAgent | null;         // current agent — recreated on model change
  _currentModel: string;         // tracked separately, compared on each send()
  
  getOrCreateAgent(options?: SendMessageOptions): IAgent {
    const model = options?.model ?? this._currentModel;
    
    if (this._agent && model === this._agentModel) {
      return this._agent;  // same model → reuse
    }
    
    // Model changed → dispose old, create new
    this._agent?.dispose();
    this._agent = this._agentService.createAgent({ ...this._baseConfig, model });
    this._agentModel = model;
    return this._agent;
  }
}
```

---

## Problem 4: React Components Have No Coherent Model Selection Concept

**What**: The UI offers 3 independent paths to select a model, with no coordination:

1. **ProviderSelector** (ChatUI:185) → `switchProvider()` → disposes adapter + sets model → **works**
2. **ModelSelector** (ChatUI:169) → `switchModel()` → sets _currentModel only → **broken**
3. **ProviderSettings** (configure step) → `switchBackend()` + `listModels()` → **side-effect: destroys current conversation adapter**

**Why this is wrong**: There's no single source of truth for "which model is active". The runtime has `_currentModel`, each session has `config.model`, each provider has `model`, and the ModelSelector shows its own selected state. None are synchronized:
- Switch provider → `_currentModel` updates, but session.config.model does NOT
- Switch model → `_currentModel` updates, but active adapter's agent keeps old model
- Create session → session.config.model copied from `_currentModel` at creation time, never updated

The fundamental confusion: is the model a property of the **runtime** (global, shared across sessions), the **session** (per-conversation), or the **provider** (user-configured preset)? The current design says "all three" with no reconciliation.

**What it causes**:
- `ChatUI` shows BOTH ModelSelector and ProviderSelector simultaneously — user has two model-changing controls that work differently
- `ProviderSettings` calls `runtime.switchBackend()` as a side-effect just to list models — destroys active adapter during a settings flow
- Session's `config.model` is set at creation and never updated → stale after any model switch
- `ModelSelector` has React hooks violation (hooks after early return, ModelSelector.ts:42 vs 79-136) — crashes when models array populates async

**What the API should look like**:

Model selection mode:
```
IF providers configured → Provider mode:
  - ProviderSelector shown (near composer)
  - ModelSelector hidden
  - Model changes go through provider settings
  - switchProvider() is the ONLY model-changing API
  
IF no providers → Standalone mode:
  - ModelSelector shown (header)
  - No ProviderSelector
  - switchModel() is the model-changing API
```

Session model tracking:
```typescript
// When model changes at runtime level, update active session's config
async switchModel(model: string): Promise<void> {
  this._currentModel = model;
  // Invalidate adapter's cached agent
  if (this._activeAdapter) {
    await this._activeAdapter.dispose();
    this._activeAdapter = null;
  }
  // Update active session config so it reflects reality
  if (this._activeSessionId) {
    await this._sessionStore.updateConfig(this._activeSessionId, { model });
  }
}
```

Model listing without side-effects:
```typescript
// Add to IChatRuntime — lists models for ANY backend without switching
async listModelsForBackend(name: string): Promise<ModelInfo[]> {
  const factory = this._backends[name];
  const tempAdapter = await factory();
  try { return await tempAdapter.listModels(); }
  finally { await tempAdapter.dispose(); }
}
```

---

---

## Problem 5: Frontend Is a Copy of the Backend Layer, Not a Thin Client

**What**: `RemoteChatRuntime` (client-side, lives in `src/chat/react/`) implements the EXACT same `IChatRuntime` interface as `ChatRuntime` (server-side, lives in `src/chat/runtime.ts`).

```typescript
// IChatRuntime — the god-interface shared by both server and client
interface IChatRuntime {
  // Stuff the frontend actually needs:
  send(sessionId, message): AsyncIterable<ChatEvent>;
  createSession(), getSession(), listSessions(), deleteSession();
  switchModel(), switchProvider(), listModels();
  abort();
  
  // Stuff that only makes sense on the server:
  registerTool(tool: ToolDefinition): void;    // ← frontend stores locally, never executes
  removeTool(name: string): void;
  readonly registeredTools: ReadonlyMap<string, ToolDefinition>;  // ← ToolDefinition has execute()
  use(middleware: ChatMiddleware): void;        // ← client middleware? server handles this
  removeMiddleware(middleware: ChatMiddleware): void;
  getContextStats(sessionId): ContextStats | null;  // ← always returns null on client
  switchBackend(name: string): Promise<void>;  // ← frontend doesn't have backends
}
```

`RemoteChatRuntime` imports from server-side modules:
```typescript
// RemoteChatRuntime.ts
import type { ToolDefinition, ModelInfo } from "../../types.js";     // agent-level type
import type { IChatRuntime, BackendInfo } from "../runtime.js";       // server runtime
import type { CreateSessionOptions } from "../sessions.js";           // server sessions
import type { ContextStats } from "../context.js";                    // server context trimming
import type { ProviderConfig } from "../server/provider-store.js";    // server storage
```

The client has `Map<string, ToolDefinition>` (line 65) — a local tool registry that never executes tools. It has `getContextStats()` that always returns `null`. It has `registerTool()` that stores locally. It's a hollow copy of the server.

**Why this is wrong**: The frontend and backend have fundamentally different responsibilities:
- **Server** (ChatRuntime): Owns agents, executes tools, manages sessions in DB, trims context, applies middleware
- **Client** (RemoteChatRuntime): Renders UI, sends HTTP requests, parses SSE streams

By making them implement the same interface:
1. Server-side concepts leak into client bundle (ToolDefinition with `execute: Function`, middleware types, context stats)
2. Client has stub methods that exist only to satisfy the interface (registerTool stores locally but tools never execute, getContextStats returns null)
3. Any interface change requires updating both implementations — the client-side one is always a degraded copy
4. React hooks never call 6 of the 25 `IChatRuntime` members (tools, middleware, context stats) — these exist purely because the client implements the server interface

**What it causes**:
- `ChatUI` calls `runtime.switchBackend()` — a server concept that makes the client pretend it has backends
- `ProviderSettings` calls `runtime.switchBackend()` + `runtime.listModels()` — server operations treated as local
- `useChat` hook works against `IChatRuntime` but only needs `send()`, `createSession()`, `abort()`
- Client bundle includes types for `ToolDefinition` (with execute function), `ChatMiddleware`, `ContextStats`

**What the API should look like**:

```typescript
// What the frontend actually needs — a thin client contract
interface IChatClient {
  // Sessions
  createSession(options?: CreateSessionOptions): Promise<SessionInfo>;
  getSession(id: string): Promise<SessionInfo | null>;
  listSessions(): Promise<SessionInfo[]>;
  deleteSession(id: string): Promise<void>;
  archiveSession(id: string): Promise<void>;
  switchSession(id: string): void;
  readonly activeSessionId: string | null;
  
  // Messaging
  send(sessionId: string, message: string, options?: { model?: string }): AsyncIterable<ChatEvent>;
  abort(): void;
  
  // Models / Providers
  listModels(): Promise<Array<{ id: string; name?: string }>>;
  switchModel(model: string): void;
  readonly currentModel: string | null;
  switchBackend(backend: string): Promise<void>;
  readonly currentBackend: string | null;
  switchProvider(providerId: string): Promise<void>;
  listProviders(): Promise<ProviderInfo[]>;
  createProvider(config: ProviderConfig): Promise<ProviderInfo>;
  updateProvider(id: string, changes: Partial<ProviderConfig>): Promise<ProviderInfo>;
  deleteProvider(id: string): Promise<void>;
  
  // Status
  readonly status: "idle" | "streaming" | "error" | "disposed";
  onSessionChange(callback: () => void): () => void;
  dispose(): Promise<void>;
}

// IChatRuntime extends IChatClient with server-only methods
interface IChatRuntime extends IChatClient {
  registerTool(tool: ToolDefinition): void;
  removeTool(name: string): void;
  use(middleware: ChatMiddleware): void;
  switchBackend(name: string): Promise<void>;
  getContextStats(sessionId: string): ContextStats | null;
  // ... other server-only methods
}
```

React hooks and `RemoteChatRuntime` work against `IChatClient`. `ChatRuntime` implements `IChatRuntime` (superset). The client never imports `ToolDefinition`, `ChatMiddleware`, or other server concepts.

---

## Summary of Root Causes → Symptoms

| Root Cause | Symptoms It Produces |
|-----------|---------------------|
| **P1**: Config lifecycle conflation | Model frozen at construction, agent can't update, must destroy+recreate for any config change |
| **P2**: No change propagation | switchModel() is no-op, runtime state and adapter state diverge silently |
| **P3**: Adapter bundles everything | Model change destroys session, no way to change one without the other |
| **P4**: No coherent UI model | Dual selectors, side-effects in settings, stale session config, hooks crash |
| **P5**: Frontend = server copy | Client imports server types, has stub methods, god-interface shared across layers |

---

## Proposed Fix Strategy

### Phase 1: Immediate (unblock users, fix crashes)
1. `BaseBackendAdapter.getOrCreateAgent()` — detect model mismatch, dispose+recreate agent
2. `ChatRuntime.switchModel()` — make async, dispose adapter (like switchBackend)
3. `ModelSelector` — move all hooks before conditional return
4. `ChatUI` — hide ModelSelector when providers exist

### Phase 2: Structural (fix the design)
5. Split `AgentConfig` into `AgentIdentity` + `CallOptions`
6. Make `run()`/`stream()` accept model in call options, backends read it per-call
7. Add `listModelsForBackend(name)` to runtime (no side-effects)
8. Remove `switchBackend()` side-effect from ProviderSettings
9. Adapter tracks model separately, compares on each send
10. Extract `IChatClient` interface from `IChatRuntime` — thin client contract
11. `RemoteChatRuntime` implements `IChatClient`, not `IChatRuntime`
12. React hooks typed against `IChatClient`, not `IChatRuntime`

### Phase 3: Architecture (prevent recurrence)
13. Define single source of truth for model: runtime._currentModel + session.config.model sync
14. Provider mode vs standalone mode in ChatUI
15. Test coverage for model override in persistent session mode
16. Consider native per-call model in CLI SDKs (Copilot, Claude)
17. Client bundle should not import from `types.ts` (agent-level types)
