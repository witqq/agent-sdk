# CLAUDE.md — agent-sdk

## Project

AI agent abstraction layer (npm package).
3 backends: Copilot CLI SDK, Claude CLI SDK, Vercel AI SDK v6.
Shared interfaces for tools, permissions, streaming, structured output.

## Build

```bash
npm run build     # tsup → ESM + CJS + DTS
npm run test      # vitest (428+ tests)
npm run typecheck # tsc --noEmit
```

## Architecture

CLI SDKs (Copilot, Claude) ARE the agent runtime — they decide tool calls.
API SDKs (Vercel AI) — WE drive the tool loop via generateText().

Key types: `ToolDeclaration` (schema only) / `ToolDefinition` (with execute).
Permission v3.1: scopes `once | session | project | always`.
Zod compatibility: v3.23+ and v4.x (peer dep `^3.23.0 || ^4.0.0`).
Permission store: `IPermissionStore` with `InMemoryPermissionStore`, `FilePermissionStore`, `CompositePermissionStore`.

### Package Exports

```
@witqq/agent-sdk           → src/index.ts (types, registry, factory, permission store)
@witqq/agent-sdk/copilot   → src/backends/copilot.ts
@witqq/agent-sdk/claude    → src/backends/claude.ts
@witqq/agent-sdk/vercel-ai → src/backends/vercel-ai.ts
@witqq/agent-sdk/auth      → src/auth/index.ts (CopilotAuth, ClaudeAuth, token types)
```

### Registry

`registerBackend(name, factory)` + `createAgentService(name, options)`.
Built-in backends: `copilot`, `claude`, `vercel-ai` (lazy-loaded via dynamic import).
Custom backends registered at runtime.

### BaseAgent

Abstract class with state machine: `idle → running/streaming → idle → disposed`.
Re-entrancy guard: throws `ReentrancyError` on concurrent runs.
Abort controller: `abort()` + external `AbortSignal` linking.
Backends extend and implement `executeRun`, `executeRunStructured`, `executeStream`.

### Copilot Backend (`src/backends/copilot.ts`)

`CopilotAgentService` wraps `@github/copilot-sdk` (optional peer dep).
- `ensureClient()`: lazy init, explicit `start()`, auth check, caches via promise
- Session modes: `per-call` (default) creates fresh session per call; `persistent` reuses session across calls
- `getOrCreateSession()`: session lifecycle — reuse persistent or create new; persistent always streaming=true
- `clearPersistentSession()`: error recovery — clears broken session so next call creates fresh one
- `sessionId` getter: exposes CLI session ID for persistent mode tracking
- `ToolCallTracker`: maps `toolCallId` → `toolName` (SDK's `tool.execution_complete` lacks name)
- Tool event parsing: `tool.execution_start` args parsed from JSON string; `tool.execution_complete` result unwrapped from `{ content: ... }` wrapper
- `ThinkingTracker`: tracks reasoning state, emits `thinking_start`/`thinking_delta`/`thinking_end` from `assistant.reasoning_delta` events
- `mapToolsToSDK()`: `ToolDefinition[]` → SDK `Tool[]` with `zodToJsonSchema`
- `buildPermissionHandler()`: `SupervisorHooks.onPermission` → SDK `onPermissionRequest` (auto-approve default)
- `buildUserInputHandler()`: `SupervisorHooks.onAskUser` → SDK `onUserInputRequest` (auto-answer default)
- `cliArgs` passthrough from `CopilotBackendOptions` to `CopilotClient`
- `systemMessageMode` (default "append") and `availableTools` from `AgentConfig`
- Structured output: prompt augmentation + JSON parsing from response text
- Test injection: `_injectSDK()` / `_resetSDK()` for mock SDK in unit tests

### Claude Backend (`src/backends/claude.ts`)

`ClaudeAgentService` wraps `@anthropic-ai/claude-agent-sdk` (optional peer dep).
- `query()` call with async iterator for streaming events
- `buildCanUseTool()`: `SupervisorHooks.onPermission` → SDK `canUseTool` callback
- `buildMcpConfig()` / `buildMcpServer()`: converts ToolDefinitions to MCP tool format (Zod shape, not JSON Schema), auto-populates `allowedTools` with `mcp__agent-sdk-tools__<name>` entries
- `stripMcpPrefix()`: normalizes MCP tool names (removes `mcp__agent-sdk-tools__` prefix) in all tool events
- `tool_progress` handling: returns `null` (heartbeat, not a tool call start)
- `tool_use_summary`: always emits `tool_call_end` even with empty summary
- Structured output: prompt augmentation + JSON parsing from response text
- Persistent sessions: `sessionMode: "persistent"` → captures `session_id` from result, passes `resume: sessionId` on subsequent calls, `persistSession: true`
- Error recovery: `clearPersistentSession()` on errors, next call starts fresh
- `thinkingBlockIndices`: Set<number> tracks thinking content block indices for `thinking_start`/`thinking_delta`/`thinking_end` emission from stream events
- `onAskUser` not supported (warning emitted if set)
- Test injection: `_injectSDK()` / `_resetSDK()`

### Vercel AI Backend (`src/backends/vercel-ai.ts`)

`VercelAIAgentService` wraps Vercel AI SDK v6 (`ai` + `@ai-sdk/openai-compatible`).
- Local SDK type definitions match v6 API: `input`/`output` (not v5 `args`/`result`), discriminated `SDKStreamPart` union
- `generateText()` for runs with multi-step tool loop (`stopWhen: stepCountIs(n)`)
- `generateObject()` for structured output with Zod schema validation
- `streamText()` with `fullStream` iteration for streaming
- `mapStreamPart()`: converts SDK stream parts to `AgentEvent` using `Extract<>` type narrowing
- `mapToolsToSDK()`: converts ToolDefinitions to Vercel AI tool format (`inputSchema` via `sdk.jsonSchema()`)
- `wrapToolExecute()`: permission checks before tool execution
- `providerOptions` passthrough from `AgentConfig` to all SDK calls (e.g. `{ google: { thinkingConfig: { thinkingBudget: 1024 } } }`)
- `onAskUser` supported via injected `ask_user` tool
- `listModels()`: tries `/models` endpoint via fetch, falls back to OpenAI presets for `openai.com` base URL, returns empty for unknown providers
- No subprocess management — pure API calls

### Auth Providers (`src/auth/`)

Programmatic OAuth authentication for Copilot and Claude backends.
No token storage — returns tokens, app stores them.

- `CopilotAuth` — GitHub Device Flow: `startDeviceFlow()` → `{ userCode, verificationUrl, waitForToken() }`
- `ClaudeAuth` — OAuth Authorization Code + PKCE: `startOAuthFlow()` → `{ authorizeUrl, completeAuth(codeOrUrl) }`, `refreshToken()`
- Types: `AuthToken`, `CopilotAuthToken`, `ClaudeAuthToken`, `DeviceFlowResult`, `OAuthFlowResult`
- Errors: `AuthError`, `DeviceCodeExpiredError`, `AccessDeniedError`, `TokenExchangeError`
- Dependency injection: `fetch` via constructor for testability

### Utilities

- `zodToJsonSchema()` — Zod schema → JSON Schema (v4 toJSONSchema → v3.24 jsonSchema → v3 _def fallback)
- `messagesToPrompt()` — Message[] → flat string
- `contentToText()` — MessageContent → plain text

## Code Style

- TypeScript strict mode
- ESM-first, CJS via tsup
- zod as peer dependency
- Backend SDKs as optional peer deps
- Separate entry points per backend (tree-shaking)

## Testing

- Unit: vitest (`tests/unit/`), 428+ tests
- Integration: vitest (`tests/integration/`) — requires real CLI authentication
- Use cheap models for integration tests (`gpt-4.1`)
