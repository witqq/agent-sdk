# Migration Plan: news-podcast → @witqq/agent-sdk@0.7.0

## Current State

- **SDK version**: `@witqq/agent-sdk@^0.6.1` (root), `@^0.6.0` (backend workspace)
- **Patches**: None
- **Usage**: Headless AI execution layer — no chat UI, no Chat SDK
- **Integration**: 3 files: `AgentFactory.ts`, `search-tools.ts`, `auth.ts`
- **Backends used**: All 3 (copilot, claude, vercel-ai)
- **Zod version**: `^4.3.6` (v4 — compatible with SDK 0.7.0)

## Migration Steps

### Step 1: Bump SDK Version

```bash
# In news-podcast root
npm update @witqq/agent-sdk@^0.7.0
```

Also align the duplicate version in `packages/backend/package.json` to `^0.7.0`.

### Step 2: Verify Tool Compatibility (Zod v4)

`search-tools.ts` uses Zod v4 for tool parameter schemas. SDK 0.7.0 supports both Zod v3.23+ and v4.x. Verify tools still work:
- `createWebSearchTool()` — `z.object({ query: z.string() })`
- `createWebFetchTool()` — `z.object({ url: z.string() })`
- `createAddNewsItemTool()` — `z.object({ title, description, url, ... })`

### Step 3: Run Tests

```bash
npm test
```

### Step 4: Integration Smoke Test

Start dev environment and verify:
1. Copilot backend: run a research prompt with WebSearch tool
2. Claude backend: run content generation
3. Vercel AI backend: run with configured provider
4. Auth flows: verify Copilot Device Flow and Claude OAuth still work

## Improvement Opportunities (Optional, Post-Migration)

These are NOT required for the version bump but would improve code quality:

### A. Use `runStructured()` for JSON responses
Currently services parse JSON from free text via regex. SDK provides `agent.runStructured(schema)`:

```typescript
// Before (fragile)
const text = await agentFactory.runPrompt(prompt, ...);
const items = JSON.parse(extractJsonBlock(text));

// After (reliable)
const result = await agent.runStructured(prompt, { schema: NewsItemsSchema });
```

**Affected services**: `HotNewsCheckService.parseItems()`, `ContentGenerationService` output parsing.

### B. Replace Legacy Error Bridge
`AgentFactory.classifyError()` does string matching. SDK 0.7.0 has `ChatError` with typed `ChatErrorCode`:

```typescript
// Before
if (error.message.includes("429")) return new RateLimitError();

// After
import { ChatError, ChatErrorCode } from '@witqq/agent-sdk/chat/errors';
if (error instanceof ChatError && error.code === ChatErrorCode.RATE_LIMIT) ...
```

### C. Consolidate Token Refresh
Token refresh is duplicated in two places. Can be centralized in `AgentFactory.ensureTokenFresh()`.

## Risk Assessment

- **Risk**: VERY LOW — no patches, no Chat SDK, straightforward version bump
- **Rollback**: Revert to `^0.6.1` in package.json
- **Estimated effort**: 30 minutes including testing
- **Breaking changes**: None expected — 0.6.x → 0.7.0 is additive
