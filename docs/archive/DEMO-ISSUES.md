# Demo Issues Found During Testing

## Resolved Issues

### Issue 1: Auto-created providers are unexpected ✅
- **Resolution**: `autoCreateProviders` defaults to `false`. Demo explicitly opts in. Step 19.

### Issue 2: Model field is text input instead of dropdown ✅  
- **Resolution**: ProviderSettings edit view uses `<select>` dropdown from `listModels()`. Step 19.

### Issue 3: No loading/thinking animation during agent work ✅
- **Resolution**: Bouncing dots animation via `[data-thread-loading]` CSS. Step 19.

### Issue 4: Tool registration is confusing — dual path ✅
- **Resolution**: `createChatRuntime({ tools })` option added. Demo uses it directly. Step 19 + Step 20.

### Issue 5: availableTools is an undocumented security boundary ✅
- **Resolution**: JSDoc security warning added to `AgentConfig.availableTools`. Step 19.

### Issue 6: Input area design — controls should be INSIDE the input box ✅
- **Resolution**: `[data-chat-input-controls]` row above composer with provider selector + usage badge. Step 19.

### Issue 7: Token usage statistics not exposed ✅
- **Resolution**: `UsageBadge` component + `ChatUsage` tracking in `useChat`. Step 19.

### Issue 8: Many SDK features not demonstrated in demo ⚠️
- **Status**: Partially resolved. Demo now shows: auth, streaming chat, tool calls with approval, loading indicator, error banner, usage badge, provider management, model selection, session management.
- **Remaining**: Context trimming stats, session archive/search not surfaced in UI (but API endpoints exist).

### Issue 9: No error display in chat UI ✅
- **Resolution**: Error banner with dismiss button via `[data-chat-error]`. Step 19.

### Issue 10: agentService not initialized before send ✅
- **Resolution**: Demo uses `ServiceManager` (auto-wired via `createChatServer`). Service lifecycle managed by SDK. Step 20.
