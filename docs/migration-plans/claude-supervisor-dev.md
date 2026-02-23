# Migration Plan: claude-supervisor-dev → @witqq/agent-sdk@0.7.0

## Current State

- **SDK version**: `@witqq/agent-sdk@0.5.2`
- **Patches**: None
- **Usage**: Deep integration — 12 files across 2 packages (backend + supervisor-agent)
- **Backends used**: All 3 (copilot, claude, vercel-ai)
- **Features used**: `createAgentService`, `IAgentService`, `IAgent`, `AgentEvent` streaming, `ToolDefinition`, `runStructured()`, `CopilotAuth`, `ClaudeAuth`, `canUseTool` callback

## API Compatibility

v0.5.2 → v0.7.0 has **NO breaking changes** to the core APIs used by this project:

| API | Status |
|-----|--------|
| `createAgentService()` | ✅ Unchanged |
| `IAgentService` / `IAgent` | ✅ Unchanged |
| `RunOptions` | ✅ Unchanged |
| `AgentEvent` | ✅ New types added, none removed |
| `ToolDefinition` | ✅ Compatible (optional `ToolContext` param added) |
| `CopilotAuth` / `ClaudeAuth` | ✅ Unchanged |
| Backend options | ✅ New fields added (`resumeSessionId`, `env`) |

## Migration Steps

### Step 1: Bump SDK Version

```bash
# In claude-supervisor-dev root
npm update @witqq/agent-sdk@^0.7.0
```

### Step 2: Adopt `resumeSessionId` (Optional Improvement)

The project extends `RunOptions` with custom `SupervisorRunOptions` to add resume support. SDK 0.7.0 natively supports `resumeSessionId` in both backend options:

```typescript
// Before (custom extension)
interface SupervisorRunOptions extends RunOptions {
  context?: { resume?: boolean; workingDirectory?: string };
}

// After (native SDK support)
const service = await createAgentService("claude", {
  ...options,
  resumeSessionId: storedSessionId,  // native support
});
```

**Files affected**: `sdk-session-adapter.ts`, backend options types

### Step 3: Check Vercel AI Stream Parts

If `stream-processor.ts` processes Vercel AI tool events, verify field names match v6:
- Tool `args` → `input`
- Tool `result` → `output`

The SDK normalizes these to `AgentEvent` format, so this likely doesn't affect the project. Verify with tests.

### Step 4: Address SDK-GAPs (SDK-Side Fixes for Future Versions)

Three SDK-GAP comments found in the code — document for SDK roadmap:

| # | SDK-GAP | Location | Needed in SDK |
|---|---------|----------|---------------|
| 1 | Multi-config per provider | `service-pool.ts:52` | Support named configs in `createAgentService` |
| 2 | Claude text deduplication | `stream-processor.ts:226` | Filter duplicate text events in Claude backend |
| 3 | ask_user tool event filtering | `stream-processor.ts:244` | Don't emit tool_call events for built-in ask_user |

### Step 5: Run Tests

```bash
npm test
# or testfold if configured
```

### Step 6: Integration Smoke Test

1. Start supervisor → create session with Copilot backend → verify streaming works
2. Create session with Claude backend → verify tool permission flow works
3. Test supervisor-agent evaluator (uses `runStructured()`)
4. Test session resume after server restart

## Additional Improvements (Post-Migration)

### A. Use Native `resumeSessionId`
Remove custom resume logic from `SupervisorRunOptions` and use SDK's built-in support. This eliminates the `context.resume` pattern.

### B. Use SDK Error Classification
Replace custom `classify-error.ts` with SDK's `ChatError` + `ChatErrorCode`:
```typescript
import { ChatError, ChatErrorCode } from '@witqq/agent-sdk/chat/errors';
// ChatErrorCode.NETWORK, TIMEOUT, RATE_LIMIT, AUTH_EXPIRED, etc.
```

### C. Stream Activity Timeout (SDK Feature Request)
Project implements `withActivityWatchdog()` for hang detection. Consider adding to SDK as a built-in option on `agent.stream()`:
```typescript
agent.stream(prompt, { activityTimeoutMs: 120_000 })
```

## SDK Issues Found (For agent-sdk Backlog)

1. **Text deduplication in Claude backend** — Claude emits both streaming deltas AND a final summary text. The summary duplicates all accumulated text. SDK should filter the summary when streaming.

2. **ask_user tool events** — Claude emits `tool_call_start`/`tool_call_end` for the internal `ask_user` tool. These shouldn't be exposed as regular tool events since it's a built-in interaction mechanism, not a user-defined tool.

3. **Multi-config per provider** — `IAgentService` assumes one config per provider. Real-world apps need multiple configs (e.g., different API keys for different users or different model tiers).

## Risk Assessment

- **Risk**: LOW — no breaking changes, no patches to update
- **Rollback**: Revert to `^0.5.2`
- **Estimated effort**: 1-2 hours including testing (bump only); 4-6 hours if adopting resumeSessionId + error classification
