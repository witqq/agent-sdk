# CLAUDE.md — agent-sdk

## Project

AI agent abstraction layer (npm package `@witqq/agent-sdk`).
npm workspaces monorepo: `packages/sdk/` (publishable), `packages/demo/` (demo app), `packages/docs-site/` (Starlight docs).
4 backends: Copilot CLI SDK, Claude CLI SDK, Vercel AI SDK v6, Mock LLM (testing).
Shared interfaces for tools, permissions, streaming, structured output.

## Build

```bash
npm run build     # tsup → ESM + CJS + DTS (delegates to packages/sdk)
npm run test      # vitest (2498+ tests, packages/sdk)
npm run typecheck # tsc --noEmit (packages/sdk)
```

Workspace commands: `npm run build -w packages/sdk`, `npm run test -w packages/sdk`.

## Architecture

CLI SDKs (Copilot, Claude) ARE the agent runtime — they decide tool calls.
API SDKs (Vercel AI) — WE drive the tool loop via generateText().

Key types: `ToolDeclaration` / `ToolDefinition` / `ToolDefinitionLike` / `ToolContext`.
`ModelInfo`: `{ id, name?, description?, provider?, contextWindow? }`.
Permission v3.1: scopes `once | session | project | always`.
Zod compatibility: v3.23+ and v4.x (peer dep `^3.23.0 || ^4.0.0`).
Error hierarchy: `AgentSDKError` base → `StorageError`, `AuthError`, `ChatError`.

## Code Style

- TypeScript strict mode
- ESM-first, CJS via tsup
- Backend SDKs as optional peer deps
- Separate entry points per backend (tree-shaking)

## Testing

Unit: vitest (`packages/sdk/tests/unit/`), 2498+ tests.
Integration: `packages/sdk/tests/integration/` — requires real CLI auth.
E2E: `packages/sdk/tests/e2e/` — tests against running demo server.

### ⛔ Model restrictions in tests

**NEVER use paid models in integration tests.**

- **Copilot**: `gpt-5-mini` ONLY
- **Claude**: `claude-haiku-4-5-*` ONLY
- **Vercel AI / OpenRouter**: `openai/gpt-4.1-mini` or equivalent cheapest

**FORBIDDEN**: `gpt-4.1`, `gpt-5`, `gpt-5.1`, `claude-sonnet-*`, `claude-opus-*`.

```bash
npm run test      # unit tests only
npm run test:e2e  # demo server E2E (requires running demo)
```

## Demo

```bash
npm run demo              # Build & start in Docker (port 3456)
npm run demo -- stop      # Stop
npm run demo -- logs      # Logs
npm run demo -- restart   # Rebuild & restart
```

## Docs Site

```bash
docker compose up -d      # Build & start docs-site locally (port 3457)
docker compose down        # Stop
```

Landing page: custom Astro layout at `packages/docs-site/src/pages/index.astro` overrides Starlight splash.
Components: `packages/docs-site/src/components/landing/{Hero,Features,Footer}.astro`.
CSS: `packages/docs-site/src/styles/landing.css`.
Remote deploy: `infra-tools auto --config .deploy-config.json --server witqq` → agent-sdk.witqq.dev.

## Documentation

- `packages/sdk/docs/architecture/INDEX.md` — architecture docs index
- `packages/sdk/docs/architecture/overview.md` — system overview
- `packages/sdk/docs/architecture/api-surface.md` — all exports reference
- `packages/sdk/docs/chat-sdk/README.md` — chat SDK consumer docs
- `packages/sdk/docs/chat-sdk/server-quickstart.md` — server setup guide
- `packages/sdk/docs/chat-sdk/custom-transports.md` — transport implementation
- `packages/sdk/docs/chat-sdk/custom-renderers.md` — CSS theming, slot overrides
- `CHANGELOG.md` — release history
