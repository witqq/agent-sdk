# Auth Demo

Interactive web demo for `@witqq/agent-sdk` showcasing authentication and agent interaction across all backends.

## Features

- Provider selection (Copilot, Claude, Vercel AI)
- Authentication flows (GitHub Device Flow, OAuth+PKCE, API key)
- Chat with streaming agent responses
- Provider switching without restart
- Web UI on http://localhost:3456

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

## Commands in Chat

- `/quit` or `/exit` — exit the app
- `/switch` — switch to a different provider
