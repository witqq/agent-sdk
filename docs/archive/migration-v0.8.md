# Migration Guide: v0.7 → v0.8 — Consumer-Specific Notes

## General Changes

### Model is now per-call, not per-agent

`AgentConfig` no longer has a `model` field. Model is split into:

- **`AgentConfig`** — identity-only (systemPrompt, supervisor, maxTurns, permissions). No `model`, no `tools`.
- **`FullAgentConfig`** = `AgentConfig & CallDefaults` — includes optional `model`, `tools`, `providerOptions` as defaults.
- **`RunOptions.model`** — **required** `string`. Every `agent.run()` / `agent.stream()` call must specify a model.

```typescript
// BEFORE (v0.7)
const agent = service.createAgent({ model: "gpt-5-mini", systemPrompt: "..." });
const result = await agent.run(prompt);

// AFTER (v0.8)
const agent = service.createAgent({ systemPrompt: "..." });
const result = await agent.run(prompt, { model: "gpt-5-mini" });
```

If you pass `model` in `FullAgentConfig`, it serves as a default — but `RunOptions.model` is still **required** and overrides it.

### `switchModel()` deprecated on runtime

`IChatRuntime.switchModel()` is now a deprecated event-only stub. It emits a `model:change` event for React compat but does not store state. Model must be passed via `send(sessionId, msg, { model })`.

### `onRuntimeChange()` for runtime events

New `onRuntimeChange(callback)` subscription fires on `switchModel`, `switchBackend`, `switchProvider`. Returns unsubscribe function.

### Tool API renames on runtime

| v0.7 (if used) | v0.8 |
|---|---|
| `addTool()` | `registerTool()` |
| `getTools()` | `registeredTools` (getter) |
| — | `removeTool(name)` |

### Middleware removal

`runtime.removeMiddleware(middleware)` is now available — previously you could only add middleware via `use()`.

### BaseBackendAdapter tool passthrough fixed

`getOrCreateAgent()` now merges runtime-registered tools into agent config via `_toolsOverride`. Previously, tools registered via `runtime.registerTool()` were not forwarded to backend adapters when creating agents.

### ChatServerHooks replace deprecated options

```typescript
// BEFORE (v0.7)
createChatHandler(runtime, {
  modelFilter: (models) => models.filter(...),
  modelGuard: (model) => checkModel(model),
  onBeforeSwitch: (backend) => ensureAuth(backend),
});

// AFTER (v0.8) — use hooks
createChatHandler(runtime, {
  hooks: {
    filterModels: (models) => models.filter(...),
    onModelSwitch: (model) => { if (!allowed(model)) throw new Error("Not allowed"); },
    onBackendSwitch: (backend) => ensureAuth(backend),
    onProviderSwitch: ({ backend }) => ensureAuth(backend),
  },
});
```

### WritableResponse unified

Single type in `@witqq/agent-sdk/chat/backends` (re-exported from `@witqq/agent-sdk/chat/server`). Express.Response is now structurally compatible without casts.

### React types use IChatBase

React hooks and `ChatProvider` type against `IChatBase` instead of `IChatRuntime`. Use `RemoteChatClient` (not deprecated `RemoteChatRuntime`) on the client side.

### New features

| Feature | Entry point |
|---|---|
| `TokenRefreshManager` | `@witqq/agent-sdk/auth` |
| `FilePermissionStore`, `CompositePermissionStore` | `@witqq/agent-sdk` |
| `createSQLiteStorage()` | `@witqq/agent-sdk/chat/sqlite` |
| Stream watchdog (`streamTimeoutMs`) | `createChatRuntime({ streamTimeoutMs })` |
| Per-call retry (`CallOptions.retry`) | `agent.run(prompt, { model, retry: { maxRetries: 2 } })` |
| `removeMiddleware()` | `IChatRuntime` |
| `onRuntimeChange()` | `IChatRuntime` / `IChatClient` |

---

## news-podcast (^0.6.1 → ^0.8.0)

**Impact: Medium** — model must move from agent config to run/stream options.

### `packages/backend/src/services/agent/AgentFactory.ts`

**1. `createAgentFromOptions()` (line ~310) — use `FullAgentConfig`**

`AgentConfig` no longer accepts `model` or `tools`. Use `FullAgentConfig` which extends `AgentConfig` with `CallDefaults`:

```typescript
// BEFORE
import { type AgentConfig } from "@witqq/agent-sdk";

const agentConfig: AgentConfig = {
  model: options.model,       // ← REMOVED from AgentConfig
  systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
  tools,
  maxTurns: options.maxTurns,
  supervisor: { onPermission: async () => ({ allowed: true }) },
};

// AFTER
import { type FullAgentConfig } from "@witqq/agent-sdk";

const agentConfig: FullAgentConfig = {
  systemPrompt: options.systemPrompt || DEFAULT_SYSTEM_PROMPT,
  tools,                      // CallDefaults.tools (optional default)
  model: options.model,       // CallDefaults.model (optional default)
  maxTurns: options.maxTurns,
  supervisor: { onPermission: async () => ({ allowed: true }) },
};
```

**2. `executeAgent()` (line ~325) — pass model in RunOptions**

`RunOptions.model` is now required. Pass it explicitly in `run()` and `stream()`:

```typescript
// BEFORE (line ~334)
const result = await agent.run(options.prompt, { signal });
// BEFORE (line ~562)
for await (const event of agent.stream(options.prompt, { signal })) {

// AFTER
const result = await agent.run(options.prompt, { signal, model: options.model! });
for await (const event of agent.stream(options.prompt, { signal, model: options.model! })) {
```

**3. Import change**

```diff
 import {
   createAgentService,
   type IAgentService,
   type IAgent as SDKAgent,
-  type AgentConfig,
+  type FullAgentConfig,
   type AgentResult,
   type AgentEvent,
```

### `packages/backend/src/services/agent/search-tools.ts`

**No changes needed.** `ToolDefinition` and `JSONValue` imports are stable.

### `packages/backend/src/routes/auth.ts`

**No changes needed.** `CopilotAuth`, `ClaudeAuth`, token types, and error classes (`DeviceCodeExpiredError`, `AccessDeniedError`, `TokenExchangeError`) are all stable.

### Opportunities

- **`TokenRefreshManager`**: Replace the manual `ensureClaudeTokenFresh()` + `refreshClaudeToken()` logic (lines 408–539 in AgentFactory.ts) with automatic background refresh:
  ```typescript
  import { TokenRefreshManager } from "@witqq/agent-sdk/auth";
  const refreshManager = new TokenRefreshManager({
    token: claudeToken,
    refreshFn: (rt) => new ClaudeAuth().refreshToken(rt),
    thresholdPercent: 80,
  });
  refreshManager.on("refreshed", (newToken) => saveToken(newToken));
  refreshManager.start();
  ```
- **Per-call retry**: The SDK now has built-in retry in `RunOptions.retry`. Could replace the manual retry loop in `runPrompt()` (lines 178–246):
  ```typescript
  const result = await agent.run(prompt, {
    model: options.model!,
    signal,
    retry: { maxRetries: maxRetries, initialDelayMs: backoffBase, backoffMultiplier: 2 },
  });
  ```

---

## mcp-moira-dev2 (^0.7.0 → ^0.8.0)

**Impact: Low** — mostly patch removal + one deprecated API call.

### ✅ Remove the patch

Delete `patches/@witqq+agent-sdk+0.7.0.patch`. The patch fixes `BaseBackendAdapter.getOrCreateAgent()` to merge `options.tools` into agent config. This is now fixed in SDK source (`src/chat/backends/base.ts:215–225` — uses `_toolsOverride` to merge runtime tools). Remove from your patch management (pnpm/yarn `patchedDependencies` or similar).

### `packages/shared/src/chat/backend-adapter-factory.ts`

**No changes needed.** Creates `CopilotChatAdapter`, `ClaudeChatAdapter`, `VercelAIChatAdapter` with `agentConfig` and `agentService`. The `agentConfig` here uses optional `model` (via `FullAgentConfig`), which still works as an adapter-level default. Per-call model is handled by the runtime's `send()` options flowing through the adapter.

### `packages/shared/src/chat/chat-runtime-manager.ts`

**No changes needed.** Uses `createChatRuntime()`, `runtime.registerTool()`, `runtime.use()` — all stable APIs. The `context` option shape (`maxTokens`, `strategy`) is unchanged.

### `packages/shared/src/chat/tool-registry.ts`

**No changes needed.** Structural typing against SDK `ToolDefinition` — independent of SDK version.

### `packages/shared/src/chat/auto-archival-middleware.ts`

**No changes needed.** `ChatMiddleware` type and `onAfterReceive` hook are stable. The `createAgent()` call inside `summarizeMessages()` (line ~111) uses a bare `AgentConfig`-like object — this still works because `createAgent()` accepts `FullAgentConfig` which includes the optional fields.

### `packages/shared/src/chat/quota-guard-middleware.ts`

**No changes needed.** `ChatMiddleware` and `onBeforeSend` hook are stable.

### `packages/shared/src/chat/drizzle-session-store.ts`

**No changes needed.** Imports (`IChatSessionStore`, `ChatId`, `ChatSession`, `toChatId`, `StorageError`, `CreateSessionOptions`, `PaginatedMessages`) are all stable.

### `packages/web-backend/src/routes/chat-sdk-routes.ts`

**1. `switchModel()` call (line ~384) — now deprecated**

```typescript
// CURRENT (line 384)
runtime.switchModel(model);

// This still works — it's a deprecated stub that emits a model:change event.
// But it does NOT store model state on the runtime anymore.
```

The model is already passed per-send correctly (line ~219):
```typescript
const events = runtime.send(sessionId, text.trim(), {
  signal: abortController.signal,
  model: model ?? session.config.model ?? undefined,
});
```

**Action**: The `/model/switch` endpoint should store the model preference in your own DB/session config (you already have `updateConversation()` in PATCH route). The `runtime.switchModel()` call can stay for event emission but should not be the source of truth.

### Opportunities

- **`removeMiddleware()`**: Dynamically remove middleware (e.g., disable moderation guard for admin users during debugging).
- **`streamTimeoutMs`**: Add to `createChatRuntime()` to auto-abort stalled streams:
  ```typescript
  const runtime = createChatRuntime({
    backends, defaultBackend, sessionStore,
    streamTimeoutMs: 120_000,  // abort if no events for 2 minutes
  });
  ```
- **`onRuntimeChange()`**: Subscribe to backend/model switches to sync state across users/tabs.

---

## squl (^0.7.0 → ^0.8.0)

**Impact: Medium** — direct adapter usage with `agentConfig.model` needs attention.

### `backend/src/chatRoutes.ts`

**1. Adapter construction (lines ~186–208) — `agentConfig.model` still works**

The adapters accept `FullAgentConfig` which includes optional `model` as a `CallDefaults` field. Your current code compiles without changes:

```typescript
adapter = new CopilotChatAdapter({
  agentConfig: {
    systemPrompt,
    model: config.model,   // FullAgentConfig.model (CallDefaults) — valid
    tools: [],
  },
  copilotOptions: { ... },
});
```

**However**, for correctness you should also pass `model` in `streamMessage()` options since `RunOptions.model` is now the authoritative model source:

```typescript
// BEFORE (line ~235)
const events = adapter.streamMessage(chatSession, message);

// AFTER — explicit model
const events = adapter.streamMessage(chatSession, message, { model: config.model });
```

**2. `WritableResponse` cast (line ~230)**

```typescript
// BEFORE
const transport = new SSEChatTransport(
  res as unknown as import("@witqq/agent-sdk/chat/backends").WritableResponse,
  { request: req },
);

// AFTER — Express.Response now satisfies WritableResponse directly
const transport = new SSEChatTransport(res, { request: req });
```

**3. All other imports are stable**

`createChatId` from `@witqq/agent-sdk/chat/core`, `VercelAIChatAdapter`, `CopilotChatAdapter`, `SSEChatTransport`, `streamToTransport` from `@witqq/agent-sdk/chat/backends` — no changes.

### Opportunities

squl uses adapters directly (not the full runtime), so runtime-level features like `removeMiddleware()`, `streamTimeoutMs` don't apply unless you migrate to `createChatRuntime()`. However:

- **Stream watchdog** is available at the adapter level too if needed.
- **`IChatTransport` heartbeat** option (`heartbeatMs`) keeps SSE connections alive on aggressive proxies.

---

## claude-supervisor-dev (^0.5.2 → ^0.8.0)

**Impact: High** — large version jump (v0.5 → v0.8). Primary breaking change: `RunOptions.model` is now required.

### `packages/supervisor-agent/src/agent-service-factory.ts`

**No changes needed.** `createAgentService()`, `IAgentService`, `ClaudeBackendOptions`, `VercelAIBackendOptions`, `CopilotBackendOptions` — all stable across versions.

### `packages/supervisor-agent/src/json-mode-evaluator.ts`

**1. `createAgent()` calls — model moves to RunOptions**

Find all `service.createAgent({ model: ..., systemPrompt, tools })` calls. Remove `model` from agent config and pass it in `run()`/`runStructured()`:

```typescript
// BEFORE
const agent = service.createAgent({
  model: this.model,
  systemPrompt: "...",
  tools: supervisorTools,
});
const result = await agent.runStructured(prompt, DecisionZodSchema);

// AFTER
const agent = service.createAgent({
  systemPrompt: "...",
  tools: supervisorTools,
});
const result = await agent.runStructured(prompt, DecisionZodSchema, { model: this.model });
```

**2. Import change**

The `StructuredOutputConfig` import may not be needed anymore if you pass the schema directly. Check your specific usage. `IAgentService`, `IAgent`, `ToolDefinition` are stable.

### `packages/supervisor-agent/src/supervisor-tools.ts`

**No changes needed.** `ToolDefinition` and `JSONValue` types are stable.

### `packages/supervisor-agent/src/agent.ts`

**No changes needed.** Orchestrates evaluators and NATS subscriptions — no direct agent-sdk calls.

### `packages/backend/src/agent-service/types.ts`

**`SupervisorRunOptions extends RunOptions` — model is now required**

`RunOptions` now has a **required** `model: string` field. All construction sites for `SupervisorRunOptions` must include `model`:

```typescript
// BEFORE — model was optional in RunOptions
const options: SupervisorRunOptions = {
  context: { resume: sessionId },
};

// AFTER — model is required
const options: SupervisorRunOptions = {
  model: selectedModel,       // ← REQUIRED
  context: { resume: sessionId },
};
```

**Action**: Search for all places constructing `SupervisorRunOptions` or calling `agent.run()`/`agent.stream()` and ensure `model` is included.

### `packages/backend/src/sdk-session-adapter.ts`

**`IAgent` run/stream calls — model required**

Every `agent.run(prompt)` or `agent.stream(prompt)` call needs `{ model }`:

```typescript
// BEFORE
for await (const event of agent.stream(prompt, { signal })) { ... }

// AFTER
for await (const event of agent.stream(prompt, { model: selectedModel, signal })) { ... }
```

The `AgentEvent` type is stable — no changes to the event discriminated union.

### `packages/backend/src/agent-service/service-pool.ts`

**No changes needed.** `IAgentService` and `ModelInfo` types are stable. The pool creates services, not agents, so model changes don't affect it.

### `packages/backend/src/auth/auth-service.ts`

**No changes needed.** `CopilotAuth`, `ClaudeAuth`, `CopilotAuthToken`, `OAuthFlowResult` are all stable across versions.

### `packages/backend/src/sdk/stream-processor.ts`

**No changes needed.** `AgentEvent` type import is stable.

### Opportunities

- **`TokenRefreshManager`**: Replace manual Claude token refresh with automatic background refresh:
  ```typescript
  import { TokenRefreshManager } from "@witqq/agent-sdk/auth";
  ```
- **`FilePermissionStore`**: Persist permission scope decisions to disk so they survive restarts:
  ```typescript
  import { FilePermissionStore } from "@witqq/agent-sdk";
  const store = new FilePermissionStore("./data/permissions.json");
  const agent = service.createAgent({ systemPrompt: "...", permissionStore: store });
  ```
- **`CompositePermissionStore`**: Layer memory + file for fast reads with persistence.
- **Per-call retry**: Replace manual retry wrappers around agent calls:
  ```typescript
  const result = await agent.run(prompt, {
    model: "haiku",
    retry: { maxRetries: 2, initialDelayMs: 1000, backoffMultiplier: 2 },
  });
  ```

---

## Quick Reference: Import Changes

| What | v0.7 import | v0.8 import |
|---|---|---|
| Agent config with model/tools | `AgentConfig` | `FullAgentConfig` (for creation with defaults) |
| Agent config without model | `AgentConfig` | `AgentConfig` (identity-only) |
| Call defaults (model, tools) | part of `AgentConfig` | `CallDefaults` (separate interface) |
| `TokenRefreshManager` | — | `@witqq/agent-sdk/auth` |
| `FilePermissionStore` | — | `@witqq/agent-sdk` |
| `CompositePermissionStore` | — | `@witqq/agent-sdk` |
| `createSQLiteStorage` | — | `@witqq/agent-sdk/chat/sqlite` |
| `RemoteChatRuntime` | `@witqq/agent-sdk/chat/react` | `RemoteChatClient` (alias still works) |
| `IChatRuntime` (React code) | `@witqq/agent-sdk/chat/runtime` | `IChatBase` (or `IChatClient`) |

## Migration Checklist

- [ ] **news-podcast**: Update `createAgentFromOptions()` — use `FullAgentConfig`, pass `model` in `run()`/`stream()` options; consider replacing manual token refresh + retry with SDK built-ins
- [ ] **mcp-moira-dev2**: Delete `patches/@witqq+agent-sdk+0.7.0.patch`; test that tool passthrough works without it; note `switchModel()` is now a no-op stub
- [ ] **squl**: Pass `model` explicitly in `adapter.streamMessage()` options; remove `WritableResponse` cast
- [ ] **claude-supervisor-dev**: Add `model` to all `RunOptions`/`SupervisorRunOptions` construction sites; update `run()`/`runStructured()`/`stream()` calls throughout evaluator and session adapter
