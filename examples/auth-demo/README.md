# Interactive Demo

Interactive demo for `@witqq/agent-sdk` showcasing authentication, multi-turn chat, tool calling, and streaming across all backends.

## Features

- Provider selection (Copilot, Claude, Vercel AI)
- Authentication flows (GitHub Device Flow, OAuth+PKCE, API key)
- Multi-turn conversations with persistent sessions
- 7 keyboard shortcuts for common test messages
- 3 demo tools: search_news, calculator, format_output (with approval)
- Streaming event display with ANSI colors (text, tool calls, thinking)
- Per-turn statistics (tool call count, text chunks, thinking blocks)
- Provider switching without restart
- Web UI on http://localhost:3456 (Docker/server mode)

## Run in Docker (one command)

```bash
docker compose -f examples/auth-demo/docker-compose.yml up
# Open http://localhost:3456
```

With Vercel AI API key:
```bash
OPENAI_API_KEY=sk-... docker compose -f examples/auth-demo/docker-compose.yml up
```

## Run Locally

```bash
# Web server
npx tsx examples/auth-demo/server.ts
# Open http://localhost:3456

# CLI mode
npx tsx examples/auth-demo/index.ts
```

## Keyboard Shortcuts

Type a number during chat to send a preset test message:

| Key | Action | Message |
|-----|--------|---------|
| 1 | Use search tool | Search for TypeScript news |
| 2 | Use calculator | Compute 1337 * 42 + 99 |
| 3 | Multi-tool chain | Search then calculate |
| 4 | List tools | Ask what tools are available |
| 5 | Summarize | Summarize the conversation |
| 6 | Format output | Create a formatted report |
| 7 | Follow-up | Ask for more details |

## Commands

- `/help` — show help and shortcuts
- `/shortcuts` — show shortcut details
- `/stats` — show session statistics
- `/switch` — switch to a different provider
- `/quit` or `/exit` — exit the app

## Auth Flow Details

### Copilot (GitHub Device Flow)
1. App requests a device code from GitHub
2. User opens the verification URL and enters the code
3. App polls GitHub until authorization completes
4. Token is used for Copilot CLI backend

### Claude (OAuth + PKCE)
1. App generates PKCE verifier and challenge
2. User opens the authorize URL in a browser
3. After authorizing, user pastes the callback code
4. App exchanges the code for an access token
5. Token is injected as `CLAUDE_CODE_OAUTH_TOKEN` env var

### Vercel AI (API Key)
1. User provides an OpenAI-compatible API key
2. Key is used directly for API calls
