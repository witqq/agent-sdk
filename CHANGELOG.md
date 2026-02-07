# Changelog

## [0.2.0] — 2026-02-07

### Core
- `heartbeat` event type in `AgentEvent` — keepalive for long-running streams during tool execution gaps
- `AgentConfig.heartbeatInterval` — interval in milliseconds for emitting heartbeat events during streaming (default: off)
- `IAgent.streamWithContext(messages)` — streaming with full conversation history, mirrors `runWithContext` pattern
- `thinking_delta` event type in `AgentEvent` — reasoning text separated from output
- `toolCallId` field in `tool_call_start` and `tool_call_end` events — propagated from all three backends
- `UsageData` type with optional `model` and `backend` fields — enriched in `AgentResult.usage` and `usage_update` events
- `AgentConfig.onUsage` callback — fire-and-forget usage notification after run completion and during streaming

### Vercel AI Backend
- `reasoning-delta` stream parts emit `thinking_delta` events instead of `text_delta`, preventing reasoning text from leaking into main output
- Tool call events propagate `toolCallId` from SDK stream parts

### Copilot Backend
- Tool call events propagate `toolCallId` from SDK event data

### Claude Backend
- `ClaudeToolCallTracker` correlates `tool_use` block IDs with `tool_use_summary` events for consistent `toolCallId` propagation

## [0.1.1] — 2026-02-07

### Copilot Backend
- Auth check on client startup — throws `SubprocessError` immediately if not authenticated
- Default auto-approve permission handler in headless mode (no `onPermission` callback)
- Default auto-answer user input handler in headless mode (no `onAskUser` callback)
- `CopilotBackendOptions.cliArgs` — pass CLI flags (e.g. `--allow-all`) to Copilot subprocess
- `AgentConfig.systemMessageMode` — control system prompt mode (`"append"` default, `"replace"` opt-in)
- `AgentConfig.availableTools` — filter built-in tools available to the model

### Documentation
- Backend peer dependency table with version constraints and optional markers
- glibc system requirement for Copilot native binary
- Model naming conventions (full IDs vs short names)
- `cliArgs`, `systemMessageMode`, `availableTools` usage examples

## [0.1.0] — 2026-02-07

Initial release. Multi-backend AI agent abstraction layer.

- 3 backends: Copilot CLI, Claude CLI, Vercel AI SDK
- Unified `IAgent` / `IAgentService` interfaces
- Tool system: `ToolDeclaration` / `ToolDefinition` split
- Permission system v3.1 with scopes and stores
- Streaming events (13 event types)
- Structured output via Zod schemas
- Backend registry with lazy loading
