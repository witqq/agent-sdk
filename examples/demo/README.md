# agent-sdk Demo

Unified React + TypeScript demo showcasing agent-sdk features with minimal custom code.
The server is ~130 lines of configuration. The frontend is 16 lines.

## Quick Start

```bash
npm run demo              # Build & start in Docker (port 3456)
npm run demo -- stop      # Stop Docker container
npm run demo -- logs      # Follow Docker logs
npm run demo -- restart   # Rebuild & restart
npm run demo -- dev       # Local dev without Docker
```

## What It Demonstrates

- **Multi-backend auth:** Copilot (Device Flow), Claude (OAuth+PKCE), Vercel AI (API key)
- **Provider management:** Create, edit, delete providers (backend + model combos)
- **Session management:** Create, switch, delete sessions via sidebar
- **SSE streaming chat:** Real-time text, thinking blocks, tool calls
- **Tool execution:** 3 demo tools (search_news, calculator, format_output with approval)
- **Token refresh:** Automatic background refresh for Copilot and Claude tokens (via `TokenRefreshManager`)
- **Token usage:** Per-message prompt/completion/total token counts
- **Error handling:** Inline error banner with dismiss
- **Loading animation:** Bouncing dots during generation
- **Model allowlist:** Server-side enforcement (default: gpt-5-mini only)
- **Persistent storage:** SQLite for sessions, providers, and auth tokens

## Architecture

```
Frontend (React)              Server (Node.js)
┌─────────────────┐          ┌──────────────────────────────┐
│ App.tsx (16 LOC) │          │ server.ts (~130 LOC)         │
│   └─ ChatUI      │ ──SSE──▶│   createChatServer({         │
│       └─ theme.css│          │     runtime, auth, providers,│
│                   │          │     hooks, autoCreateProviders│
└─────────────────┘          │   })                         │
                              │   └─ SQLite (sessions,       │
                              │      providers, tokens)      │
                              └──────────────────────────────┘
```

- **Frontend:** `RemoteChatClient` + `ChatUI` — zero custom components
- **Backend:** `createChatServer` handles all routing (chat, auth, providers, static files)
- **Stateless:** Backend adapters are created per-request with credentials from `tokenStore`
- **Storage:** Single SQLite DB via `createSQLiteStorage()`
- **Docker:** 3-stage build (SDK → frontend → runtime), single `/data` volume

## SDK Components Used

| Component | Purpose |
|---|---|
| `createChatServer` | Combined HTTP handler (chat + auth + providers + static) |
| `createChatRuntime` | Runtime with backends, sessions, tools, context window |
| `createSQLiteStorage` | Unified SQLite for sessions + providers + tokens |
| `TokenRefreshManager` | Automatic background token refresh for Copilot/Claude |
| `RemoteChatClient` | Client-side HTTP/SSE bridge to server runtime |
| `ChatUI` | Full chat interface with all React components |
| `theme.css` | Default dark theme with `[data-*]` attribute selectors |

## API Endpoints

All endpoints are served by `createChatServer` — no custom route handling.

| Endpoint | Description |
|---|---|
| `POST /api/auth/start` | Start auth flow for backend |
| `POST /api/auth/copilot/poll` | Poll Copilot device flow |
| `POST /api/auth/claude/complete` | Complete Claude OAuth |
| `POST /api/auth/vercel/complete` | Connect with API key |
| `GET /api/tokens/saved` | List saved tokens |
| `POST /api/tokens/use` | Activate a saved token |
| `POST /api/tokens/clear` | Clear all tokens |
| `POST /api/chat/sessions/create` | Create session |
| `GET /api/chat/sessions/{id}` | Get session |
| `GET /api/chat/sessions` | List sessions |
| `DELETE /api/chat/sessions/{id}` | Delete session |
| `POST /api/chat/send` | SSE streaming chat |
| `POST /api/chat/abort` | Abort current stream |
| `GET /api/chat/models` | List models (filtered by allowlist) |
| `POST /api/chat/model/switch` | Switch active model |
| `GET /api/chat/providers` | List providers |
| `POST /api/chat/providers` | Create provider |
| `PUT /api/chat/providers/{id}` | Update provider |
| `DELETE /api/chat/providers/{id}` | Delete provider |
| `GET /api/health` | Health check |

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `PORT` | `3456` | Server port |
| `DB_PATH` | `.data/chat.db` / `/data/chat.db` | SQLite database path |
| `DEMO_ALLOWED_MODELS` | `gpt-5-mini` | Comma-separated model allowlist |
| `VERCEL_AI_BASE_URL` | `https://api.openai.com/v1` | Vercel AI base URL |
| `OPENAI_API_KEY` | — | OpenAI API key (for Vercel AI backend) |

## Known Limitations

- **Single-user auth state:** The `AuthHandler` uses closure-scoped `pendingCopilot`/`pendingClaude` variables, meaning only one auth flow can be in-flight at a time. Acceptable for demo scope.
- **Demo tools only:** search, calculator, format_output are mock implementations
- **Docker volumes:** App data uses single `/data` volume. A separate named volume `copilot-config` stores Copilot CLI config (`~/.copilot`).
