# Auth Flow Research Findings

## Overview

Researched programmatic OAuth flows for both CLI SDKs to enable authentication without terminal interaction.

## Copilot SDK — GitHub Device Flow ✅ WORKING

### Constants (from `@github/copilot` CLI source)
- **Client ID**: `Ov23ctDVkRmgkPke0Mmm`
- **Device Code Endpoint**: `POST https://github.com/login/device/code`
- **Token Endpoint**: `POST https://github.com/login/oauth/access_token`
- **Scopes**: `read:user,read:org,repo,gist`

### Flow
1. POST device/code → `{ device_code, user_code, verification_uri, interval }`
2. Show `verification_uri` + `user_code` to user
3. Poll token endpoint every `interval` seconds
4. Handle: `authorization_pending` (keep polling), `slow_down` (increase interval), success (`access_token`)
5. Token format: `gho_...` — long-lived (no expiration)

### SDK Integration
```javascript
const client = new CopilotClient({ githubToken: token });
// SDK internally sets COPILOT_SDK_AUTH_TOKEN env var for CLI subprocess
```

### CLI Token Storage
- macOS keychain via `keytar` (service: `copilot-cli`)
- Fallback: `~/.config/github-copilot/` config file

---

## Claude SDK — OAuth Authorization Code + PKCE ✅ WORKING

### Constants (from `@anthropic-ai/claude-agent-sdk` CLI source)
- **Client ID**: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- **Token URL**: `https://platform.claude.com/v1/oauth/token`
- **Manual Redirect**: `https://platform.claude.com/oauth/code/callback`

### ⚠️ CRITICAL: Two OAuth Endpoints with Different Scopes

| Endpoint | URL | Scopes |
|----------|-----|--------|
| **Claude.ai** | `https://claude.ai/oauth/authorize` | `user:profile user:inference user:sessions:claude_code user:mcp_servers` |
| **Console** | `https://platform.claude.com/oauth/authorize` | `org:create_api_key user:profile` |

**Must use claude.ai endpoint** to get `user:inference` scope required for model access.

### Flow
1. Generate PKCE: 96 random bytes → base64 with char replacements (`+→~ =→_ /→-`)
2. Build authorize URL with: `client_id`, `response_type=code`, `redirect_uri`, `scope`, `code_challenge`, `code_challenge_method=S256`, `state`, `code=true`
3. User opens URL, authorizes → redirect with `?code=xxx`
4. Exchange code: POST token URL with JSON body including `code_verifier`
5. Token format: `sk-ant-oat01-...`, expires in 28800s (8 hours), has `refresh_token`

### Key Discovery: Token Restriction
**Claude OAuth tokens are restricted to Claude Code CLI only.** Direct API calls to `/v1/messages` return:
```
400: "This credential is only authorized for use with Claude Code and cannot be used for other API requests."
```

This means the token MUST be used through the CLI subprocess (which is how the Claude Agent SDK works).

### SDK Integration
```javascript
import { query } from '@anthropic-ai/claude-agent-sdk';
const result = query({
  prompt: 'Hello',
  options: { env: { CLAUDE_CODE_OAUTH_TOKEN: token } }
});
```

The CLI's `i4()` function reads `CLAUDE_CODE_OAUTH_TOKEN` env var and creates an auth context with `scopes: ["user:inference"]`.

### CLI Credential Storage
- File: `~/.claude/.credentials.json`
- Env var: `CLAUDE_CODE_OAUTH_TOKEN` (access token) or `ANTHROPIC_API_KEY` (API key)
- File descriptor: `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR`

---

## Integration Architecture

### Recommended API
```typescript
import { CopilotAuth, ClaudeAuth } from '@witqq/agent-sdk/auth';

// Copilot — Device Flow
const copilot = new CopilotAuth();
const { userCode, verificationUrl, waitForToken } = await copilot.startDeviceFlow();
const token = await waitForToken(); // polls until user authorizes

// Claude — OAuth + PKCE
const claude = new ClaudeAuth();
const { authorizeUrl, completeAuth } = await claude.startOAuthFlow({
  redirectUri: 'https://myapp.com/callback'  // or manual redirect
});
const token = await completeAuth(callbackCode);
```

### Token Handling
- SDK provides auth providers, application stores tokens
- No built-in storage — application controls persistence
- Tokens passed directly when creating agent service

### Limitations
| Feature | Copilot | Claude |
|---------|---------|--------|
| Mechanism | Device Flow (user_code) | OAuth + PKCE (redirect) |
| Server needed | No (polling) | Yes (callback endpoint) |
| Token lifetime | Long-lived | 8 hours (refresh available) |
| Direct API | No (CLI only) | No (CLI only) |
| Refresh | New device flow | refresh_token |

## E2E Test Results

### Copilot (Docker)
- Auth: Device code → user authorized → `gho_...` token received
- SDK: `CopilotClient({ githubToken })` → `session.sendAndWait()` → model responded
- **PASS**

### Claude (Docker)
- Auth: OAuth+PKCE via claude.ai → all 4 scopes granted → `sk-ant-oat01-...` token
- Direct API: ❌ (restricted to Claude Code)
- SDK: `query({ options: { env: { CLAUDE_CODE_OAUTH_TOKEN } } })` → model responded "Hello!"
- **PASS**
