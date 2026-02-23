# agent-sdk Demo

Unified React + TypeScript demo showcasing all agent-sdk features:
authentication flows, model selection, SSE streaming chat with thinking blocks,
tool calls, error handling, and Chat SDK modules integration.

## Run with Docker

```bash
docker compose -f examples/demo/docker-compose.yml up --build
# Open http://localhost:3456
```

## Features

- **3 auth providers:** Copilot (Device Flow), Claude (OAuth+PKCE), Vercel AI (API key)
- **Lifecycle hook:** `useRemoteChat` orchestrates auth → runtime → session automatically
- **Model selection:** filterable list or manual entry via `runtime.switchModel()`
- **SSE streaming chat:** real-time text, thinking blocks, tool calls
- **3 demo tools:** search_news, calculator, format_output (with approval)
- **Chat SDK integration:** ChatEventBus, MessageAccumulator, classifyError, StateMachine, agentEventToChatEvent bridge
- **Session management:** create, switch, delete, archive/unarchive with sidebar toggle
- **Token persistence:** saved across container restarts

## Architecture

- **Frontend:** React 19 + TypeScript, built with Vite
- **Backend:** Node.js HTTP server with agent-sdk + Chat SDK server utilities
- **Docker:** 3-stage build (SDK → frontend → runtime)
- **Lifecycle:** `useRemoteChat` hook manages auth → `RemoteChatRuntime` → session creation. Server auto-creates runtime in `onAuth` callback.

## API Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/auth/start` | Start auth flow for provider |
| `POST /api/auth/copilot/poll` | Poll Copilot device flow |
| `POST /api/auth/claude/complete` | Complete Claude OAuth |
| `POST /api/auth/vercel/complete` | Connect with API key |
| `GET /api/tokens/saved` | List saved tokens |
| `POST /api/tokens/use` | Use a saved token |
| `POST /api/tokens/clear` | Clear all tokens |
| `POST /api/auth/dispose` | Dispose auth state and runtime |
| `POST /api/chat/sessions/create` | Create new session |
| `GET /api/chat/sessions/{id}` | Get session |
| `GET /api/chat/sessions` | List sessions |
| `DELETE /api/chat/sessions/{id}` | Delete session |
| `POST /api/chat/send` | SSE streaming chat |
| `POST /api/chat/abort` | Abort current stream |
| `GET /api/chat/models` | List available models |
| `POST /api/chat/model/switch` | Switch active model |
| `POST /api/agent/dispose` | Dispose agent runtime |

## Limitations

- **Single-user:** global state is shared across all connections; not for multi-user or multi-tab usage
- **Demo tools only:** search, calculator, and format_output are mock implementations
