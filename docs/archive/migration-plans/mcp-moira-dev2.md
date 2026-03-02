# Migration Plan: mcp-moira-dev2 → @witqq/agent-sdk@0.7.0

## Current State

- **SDK version**: `@witqq/agent-sdk@^0.6.1`
- **Patch**: `@witqq+agent-sdk+0.6.1.patch` (500+ lines, 9 categories of fixes)
- **Usage**: `createAgentService()`, `CopilotAuth`, `ClaudeAuth` (3 files, all dynamic imports)
- **Chat SDK**: NOT used — entire chat system is custom-built

## Key Finding: Patch Can Be Removed

All 9 patch categories are already integrated into agent-sdk@0.7.0:

| # | Patch Category | Status in 0.7.0 |
|---|---|---|
| 1 | Tool Result Capture Queue | ✅ Fixed |
| 2 | Session Resume with Retry | ✅ Fixed |
| 3 | `resumeSessionId` support | ✅ Fixed |
| 4 | `availableTools` → `opts.tools` (Claude) | ✅ Fixed |
| 5 | Zod-to-JSON-Schema async (Copilot) | ✅ Fixed |
| 6 | Rich History Serialization | ✅ Fixed |
| 7 | Streaming Tool Result Enrichment | ✅ Fixed |
| 8 | Vercel AI Message Mapping | ✅ Fixed |
| 9 | Copilot `availableTools` empty array | ✅ Fixed |

## Migration Steps

### Step 1: Bump SDK Version

```bash
# In mcp-moira-dev2 root
pnpm update @witqq/agent-sdk@^0.7.0
```

### Step 2: Remove Patch File

```bash
rm patches/@witqq+agent-sdk+0.6.1.patch
```

Verify no other patches reference agent-sdk in `package.json` patchedDependencies section.

### Step 3: Verify Integration Points

Three files use agent-sdk — verify each still works:

#### 3a. `packages/web-backend/src/routes/chat-registry.ts`
- Uses: `createAgentService("claude" | "copilot", config)`
- **Check**: `resumeSessionId` option is now natively supported. Verify the config object shape matches 0.7.0 types.
- **Check**: `availableTools` is now correctly passed as `opts.tools` — no behavior change needed.

#### 3b. `packages/web-backend/src/routes/admin-auth.ts`
- Uses: `CopilotAuth`, `ClaudeAuth` (dynamic import from `@witqq/agent-sdk/auth`)
- **No changes expected** — auth API is stable.

#### 3c. `packages/shared/src/chat/agent-service-registry.ts`
- Uses: `ClaudeAuth` for token refresh (dynamic import)
- **No changes expected** — refresh API is stable.

### Step 4: Run Tests

```bash
pnpm test
# or if testfold is configured:
testfold
```

Verify all chat-related tests pass, especially:
- Session creation and resume
- Tool execution (single and multiple calls of same tool)
- Streaming with tool results
- History serialization after session recovery
- Copilot backend with Zod tool schemas

### Step 5: Integration Test

Manual verification in dev environment:
1. Start chat with Copilot backend → send message → verify tools work
2. Start chat with Claude backend → send message → verify tools work
3. Restart server → resume session → verify context preserved
4. Verify `availableTools` restriction works (tools outside list not accessible)

## Future Considerations

### Chat SDK Adoption (Optional)
The project currently duplicates significant Chat SDK functionality. Potential migration areas:

| Custom Component | SDK Replacement | Effort | Value |
|---|---|---|---|
| `AgentEventStreamAdapter` | `SSEChatTransport` | Low | Medium — standardized protocol |
| `ContextManager` | `ContextWindowManager` | Medium | Low — custom has auto-archival |
| `AuthTokenStore` | `FileTokenStore` | Low | Low — custom has encryption |
| Full `AgentRuntime` | `ChatRuntime` | High | High — but custom has DB integration |

**Recommendation**: Keep custom chat system. The DB integration, encrypted token storage, and AI SDK Data Stream Protocol are project-specific requirements that the generic Chat SDK doesn't fully cover. The main value of upgrading is eliminating the 500+ line patch.

### SDK Issues to Track
- **Activity watchdog**: Project wraps streams with `withActivityWatchdog()` for hang detection. Consider adding to SDK as a feature.
- **Checkpoint persistence**: Project saves partial streaming results to DB. Consider `onCheckpoint` callback in SDK streaming.
- **Structural typing drift**: The `shared` package mirrors AgentEvent types locally. Could be simplified if SDK exports a lightweight types-only entry point.

## Risk Assessment

- **Risk**: LOW — this is a version bump + patch removal, no API changes
- **Rollback**: Restore patch file and downgrade to 0.6.1
- **Estimated effort**: 1-2 hours including testing
