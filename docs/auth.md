# Authentication

Each backend uses a different auth mechanism. The SDK provides auth helpers and token management.

## Overview

| Backend | Auth Method | Import |
|---------|------------|--------|
| Copilot (GitHub) | GitHub device flow or token | `@witqq/agent-sdk/copilot` |
| Claude (Anthropic) | OAuth with PKCE | `@witqq/agent-sdk/claude` |
| Vercel AI | API key | `@witqq/agent-sdk/vercel-ai` |
| Mock LLM | None | `@witqq/agent-sdk/mock-llm` |

Auth utilities are in `@witqq/agent-sdk/auth`.

## Copilot (GitHub)

### Backend Options

```typescript
interface CopilotBackendOptions {
  cliPath?: string;
  workingDirectory?: string;
  githubToken?: string;
  useLoggedInUser?: boolean;
  cliArgs?: string[];
  timeout?: number;
  startupTimeoutMs?: number;
  env?: Record<string, string | undefined>;
  resumeSessionId?: string;
}
```

### Using Existing CLI Session

The simplest approach. Requires `gh` CLI to be authenticated.

```typescript
import { createAgentService } from "@witqq/agent-sdk";

const service = await createAgentService("copilot", {
  useLoggedInUser: true,
});
```

### Direct Token

For CI/CD pipelines or environments with a pre-existing token:

```typescript
import { createAgentService } from "@witqq/agent-sdk";

const service = await createAgentService("copilot", {
  githubToken: process.env.GITHUB_TOKEN,
});
```

### Device Flow

Interactive authentication for CLI applications:

```typescript
import { CopilotAuth } from "@witqq/agent-sdk/auth";

const auth = new CopilotAuth();
const flow = await auth.startDeviceFlow();

console.log(`Open: ${flow.verificationUrl}`);
console.log(`Enter code: ${flow.userCode}`);

const token = await flow.waitForToken();
// token: { accessToken, tokenType, expiresIn, obtainedAt, login?, refreshToken? }

const service = await createAgentService("copilot", {
  githubToken: token.accessToken,
});
```

`waitForToken()` polls until the user completes auth or the code expires. Pass an `AbortSignal` to cancel:

```typescript
const controller = new AbortController();
const token = await flow.waitForToken(controller.signal);
```

## Claude (Anthropic)

### Backend Options

```typescript
interface ClaudeBackendOptions {
  cliPath?: string;
  workingDirectory?: string;
  maxTurns?: number;
  oauthToken?: string;
  env?: Record<string, string | undefined>;
  resumeSessionId?: string;
}
```

### Direct Token

```typescript
import { createAgentService } from "@witqq/agent-sdk";

const service = await createAgentService("claude", {
  oauthToken: process.env.CLAUDE_TOKEN,
});
```

### OAuth Flow

```typescript
import { ClaudeAuth } from "@witqq/agent-sdk/auth";

const auth = new ClaudeAuth();
const flow = auth.startOAuthFlow({
  redirectUri: "http://localhost:3000/callback",
});

console.log(`Authorize: ${flow.authorizeUrl}`);
// User authorizes, gets redirected with code

const token = await flow.completeAuth(codeOrCallbackUrl);
// token: { accessToken, tokenType, expiresIn, obtainedAt, refreshToken, scopes }

const service = await createAgentService("claude", {
  oauthToken: token.accessToken,
});
```

Extract the auth code from a callback URL:

```typescript
const code = ClaudeAuth.extractCode("http://localhost:3000/callback?code=abc123");
const token = await flow.completeAuth(code);
```

## Vercel AI

### Backend Options

```typescript
interface VercelAIBackendOptions {
  apiKey: string;
  provider?: string;
  baseUrl?: string;
}
```

No auth flow required. Pass the API key directly:

```typescript
import { createAgentService } from "@witqq/agent-sdk";

const service = await createAgentService("vercel-ai", {
  apiKey: process.env.OPENAI_API_KEY!,
  provider: "openai",
});
```

For OpenRouter or other compatible providers:

```typescript
const service = await createAgentService("vercel-ai", {
  apiKey: process.env.OPENROUTER_API_KEY!,
  provider: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
});
```

## Mock LLM

No auth required. Use `createMockLLMService` directly:

```typescript
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

const service = createMockLLMService({
  mode: { type: "echo" },
});
```

## Token Management

### AuthToken

Base token type shared across backends:

```typescript
interface AuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  obtainedAt: number;
}
```

Backend-specific extensions:

```typescript
interface CopilotAuthToken extends AuthToken {
  login?: string;
  refreshToken?: string;
}

interface ClaudeAuthToken extends AuthToken {
  refreshToken: string;
  scopes: string[];
}
```

### TokenRefreshManager

Automatically refreshes tokens before expiry. Emits events for monitoring.

```typescript
import { TokenRefreshManager } from "@witqq/agent-sdk/auth";

const manager = new TokenRefreshManager({
  token: initialToken,
  refresh: async (current) => {
    return await auth.refreshToken(current.refreshToken);
  },
  refreshThreshold: 0.8,  // refresh at 80% of lifetime
  maxRetries: 3,
  retryDelayMs: 1000,
});

manager.on("refreshed", (newToken) => {
  console.log("Token refreshed");
});

manager.on("error", (err, attempt) => {
  console.error(`Refresh failed (attempt ${attempt}): ${err.message}`);
});

manager.on("expired", () => {
  console.error("Token expired, re-authenticate");
});

manager.start();
// manager.token always returns the current valid token
const currentToken = manager.token;

// Cleanup
manager.dispose();
```

### TokenRefreshOptions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `token` | `AuthToken` | required | Initial token |
| `refresh` | `(token) => Promise<AuthToken>` | required | Refresh function |
| `refreshThreshold` | `number` (0-1) | `0.8` | When to refresh (fraction of lifetime) |
| `maxRetries` | `number` | `3` | Retry attempts on failure |
| `retryDelayMs` | `number` | `1000` | Delay between retries |
| `minDelayMs` | `number` | `1000` | Minimum delay before scheduling refresh |

## CI/CD Patterns

### GitHub Actions with Copilot

```typescript
const service = await createAgentService("copilot", {
  githubToken: process.env.GITHUB_TOKEN,
  workingDirectory: process.env.GITHUB_WORKSPACE,
});
```

### Environment Variable Pattern

```typescript
async function createBackend(): Promise<IAgentService> {
  if (process.env.GITHUB_TOKEN) {
    return await createAgentService("copilot", {
      githubToken: process.env.GITHUB_TOKEN,
    });
  }
  if (process.env.CLAUDE_TOKEN) {
    return await createAgentService("claude", {
      oauthToken: process.env.CLAUDE_TOKEN,
    });
  }
  if (process.env.OPENAI_API_KEY) {
    return await createAgentService("vercel-ai", {
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  throw new Error("No AI credentials found");
}
```

## Auth Errors

The `@witqq/agent-sdk/auth` module exports specific error types:

| Error | When |
|-------|------|
| `AuthError` | Base auth error |
| `DeviceCodeExpiredError` | Device flow code timed out |
| `AccessDeniedError` | User denied authorization |
| `TokenExchangeError` | Token exchange failed |

```typescript
import { DeviceCodeExpiredError } from "@witqq/agent-sdk/auth";

try {
  const token = await flow.waitForToken();
} catch (err) {
  if (err instanceof DeviceCodeExpiredError) {
    console.log("Code expired. Restart the flow.");
  }
}
```
