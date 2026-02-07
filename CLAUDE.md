# CLAUDE.md — agent-sdk

## Project

AI agent abstraction layer (npm package).
3 backends: Copilot CLI SDK, Claude CLI SDK, Vercel AI SDK v6.
Shared interfaces for tools, permissions, streaming, structured output.

## Build

```bash
npm run build     # tsup → ESM + CJS + DTS
npm run test      # vitest (269 tests)
npm run typecheck # tsc --noEmit
```

## Architecture

CLI SDKs (Copilot, Claude) ARE the agent runtime — they decide tool calls.
API SDKs (Vercel AI) — WE drive the tool loop via generateText().

Key types: `ToolDeclaration` (schema only) / `ToolDefinition` (with execute).
Permission v3.1: scopes `once | session | project | always`.
Permission store: `IPermissionStore` with `InMemoryPermissionStore`, `FilePermissionStore`, `CompositePermissionStore`.

### Package Exports

```
@witqq/agent-sdk           → src/index.ts (types, registry, factory, permission store)
@witqq/agent-sdk/copilot   → src/backends/copilot.ts
@witqq/agent-sdk/claude    → src/backends/claude.ts
@witqq/agent-sdk/vercel-ai → src/backends/vercel-ai.ts
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
- `ensureClient()`: lazy init, explicit `start()`, caches via promise
- Session-per-run: fresh `CopilotSession` per `run()`/`stream()`, destroyed in `finally`
- `ToolCallTracker`: maps `toolCallId` → `toolName` (SDK's `tool.execution_complete` lacks name)
- `mapToolsToSDK()`: `ToolDefinition[]` → SDK `Tool[]` with `zodToJsonSchema`
- `buildPermissionHandler()`: `SupervisorHooks.onPermission` → SDK `onPermissionRequest`
- `buildUserInputHandler()`: `SupervisorHooks.onAskUser` → SDK `onUserInputRequest`
- Structured output: prompt augmentation + JSON parsing from response text
- Test injection: `_injectSDK()` / `_resetSDK()` for mock SDK in unit tests

### Claude Backend (`src/backends/claude.ts`)

`ClaudeAgentService` wraps `@anthropic-ai/claude-agent-sdk` (optional peer dep).
- `query()` call with async iterator for streaming events
- `buildCanUseTool()`: `SupervisorHooks.onPermission` → SDK `canUseTool` callback
- `buildMcpConfig()` / `buildMcpServer()`: converts ToolDefinitions to MCP tool format
- Structured output: prompt augmentation + JSON parsing from response text
- `onAskUser` not supported (warning emitted if set)
- Test injection: `_injectSDK()` / `_resetSDK()`

### Vercel AI Backend (`src/backends/vercel-ai.ts`)

`VercelAIAgentService` wraps Vercel AI SDK v6 (`ai` + `@ai-sdk/openai-compatible`).
- `generateText()` for runs with multi-step tool loop
- `generateObject()` for structured output with Zod schema validation
- `streamText()` with `fullStream` iteration for streaming
- `mapToolsToSDK()`: converts ToolDefinitions to Vercel AI tool format
- `wrapToolExecute()`: permission checks before tool execution
- `onAskUser` supported via injected `ask_user` tool
- No subprocess management — pure API calls

### Utilities

- `zodToJsonSchema()` — Zod schema → JSON Schema
- `messagesToPrompt()` — Message[] → flat string
- `contentToText()` — MessageContent → plain text

## Code Style

- TypeScript strict mode
- ESM-first, CJS via tsup
- zod as peer dependency
- Backend SDKs as optional peer deps
- Separate entry points per backend (tree-shaking)

## Testing

- Unit: vitest (`tests/unit/`), 269 tests
- Integration: vitest (`tests/integration/`) — requires real CLI authentication
- Use cheap models for integration tests (`gpt-4.1`)
