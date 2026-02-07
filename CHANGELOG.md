# Changelog

## [Unreleased]

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
