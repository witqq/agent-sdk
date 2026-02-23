# Roadmap — @witqq/agent-sdk + @witqq/chat-sdk

Based on architecture review findings: `docs/ARCHITECTURE-REVIEW.md`

## Phase 0: Quick Wins (parallel with Phase 1)

Can be done independently, no dependencies.

### Step 0.1: Package Structure
- [ ] Add `src/chat/index.ts` barrel export (fix MAJOR-14 — chat-sdk invisible)
- [ ] Re-export chat-sdk types from main `src/index.ts`
- [ ] Add subpath exports to `package.json`

### Step 0.2: Sync I/O → Async I/O
- [ ] FilePermissionStore: `readFileSync`/`writeFileSync` → async (fix MAJOR-10)
- [ ] FileStorage: same sync→async fix (fix MAJOR-12)
- [ ] Add file locking for concurrent access (fix MINOR-8)

### Step 0.3: Code Cleanup
- [ ] Remove unused `timestamp` from FilePermissionStore (MINOR-6)
- [ ] Fix `zodToJsonSchema` silent `{}` for unsupported types — warn or throw (MAJOR-13)
- [ ] Remove duplicate `contentToText`/`getTextContent` (MINOR-9)

## Phase 1: Core Architecture Fixes (agent-sdk)

Priority: CRITICAL. All consumer pain points trace back here.

### Step 1.1: Error Hierarchy Unification
- [ ] Add `code: string` and `retryable: boolean` to `AgentSDKError`
- [ ] Remove duplicate `AuthError` in `chat/errors.ts` — use single class from `auth/types.ts`
- [ ] Make auth errors extend `AgentSDKError` (fix CRITICAL-5)
- [ ] Add typed error classes: `TimeoutError`, `NetworkError`, `RateLimitError`, `AuthenticationError`, `ValidationError`, `ConfigurationError`
- [ ] Migrate chat-sdk `StorageError` to extend `AgentSDKError`
- [ ] Update all `catch` blocks in backends to throw typed errors
- [ ] Update tests

### Step 1.2: IAgent Session API
- [ ] Add `resetContext(messages?: Message[]): Promise<void>` to IAgent interface
- [ ] Add `getMessages(): Message[]` to IAgent interface
- [ ] Add `clearMessages(): void` to IAgent interface
- [ ] Implement `resetContext` in CopilotAgent (clear session + seed messages)
- [ ] Implement `resetContext` in ClaudeAgent (clear session_id + seed messages)
- [ ] Implement `resetContext` in VercelAIAgent (reset message array)
- [ ] Make `systemPrompt` optional in AgentConfig
- [ ] Add `sessionMode: "auto"` as default (CLI→persistent, API→per-call)
- [ ] Add `autoApprovePermissions` option to AgentConfig
- [ ] Update BaseAgent to accumulate messages internally for `run()/stream()`
- [ ] Update tests (428+ existing must pass)

### Step 1.3: Context Building Fix
- [ ] Replace `buildContextualPrompt()` string concatenation with structured message array (CRITICAL-2)
- [ ] Copilot backend: pass messages via SDK session, not string prompt
- [ ] Claude backend: pass messages via SDK query, not string prompt
- [ ] Verify persistent session works with structured messages
- [ ] Update tests

### Step 1.4: ModelInfo Enhancement
- [ ] Add `tier`, `contextWindow`, `maxOutputTokens`, `supportsThinking`, `supportsTools` to ModelInfo
- [ ] Implement in Copilot backend (`listModels`)
- [ ] Implement in Claude backend (`listModels`)
- [ ] Implement in Vercel AI backend (`listModels`)
- [ ] Update tests

## Phase 2: Chat-SDK Architecture Fix

Priority: HIGH. Blocks real multi-session apps.

### Step 2.1: Session/Message Split
- [ ] Create `IChatMessageStore` interface (addMessage, getMessages with pagination, deleteMessage)
- [ ] Create `InMemoryChatMessageStore` implementation
- [ ] Create `FileChatMessageStore` implementation
- [ ] Remove `messages` field from `ChatSession` type
- [ ] Update `IChatSessionStore` to handle sessions only (no messages)
- [ ] Fix O(n) addMessage → O(1) via separate store (CRITICAL-6,7)
- [ ] Update tests

### Step 2.2: ChatClient Integration
- [ ] Create `ChatClient` class that integrates agent-sdk + chat-sdk
- [ ] `send()` — send message, persist, manage context window
- [ ] `switchSession()` — load history, call `agent.resetContext()`
- [ ] `createSession()` — create new empty session
- [ ] Event emission for UI binding (`message:start`, `message:delta`, `message:end`, `error`)
- [ ] Update tests

### Step 2.3: Context Window Integration
- [ ] Wire `ContextWindowManager` into `ChatClient`
- [ ] Auto-trim on send if context exceeds limit
- [ ] Support `maxContextTokens` in session config
- [ ] Archival strategy — save trimmed messages to separate archive store
- [ ] Update tests

## Phase 3: Consumer DX & Components

Priority: MEDIUM. Improves adoption and reduces boilerplate.

### Step 3.1: React Components
- [ ] `<ChatProvider>` — wraps ChatClient, provides context
- [ ] `<MessageList>` — renders messages with streaming support
- [ ] `<MessageInput>` — input with send, auto-resize
- [ ] `<ThinkingBlock>` — collapsible thinking/reasoning display
- [ ] `<ToolCallBlock>` — tool call display with args/result
- [ ] `<SessionList>` — sidebar with session list, create, delete, switch
- [ ] `<ModelSelector>` — model picker with tier badges
- [ ] `<PermissionDialog>` — tool permission approval UI
- [ ] All components use Tailwind CSS, fully customizable via className/render props
- [ ] Publish as `@witqq/chat-sdk/react` subpath export

### Step 3.2: Server Utilities
- [ ] `createChatRouter()` — Express/Hono adapter for chat-sdk endpoints
- [ ] Standard endpoints: send, sessions CRUD, messages CRUD, models list
- [ ] SSE streaming endpoint
- [ ] WebSocket streaming endpoint (optional)
- [ ] Auth middleware integration
- [ ] Error serialization middleware

### Step 3.3: Adapters
- [ ] SQLite message store adapter
- [ ] PostgreSQL message store adapter
- [ ] Redis session cache adapter
- [ ] Transcript export (Markdown, JSON)
- [ ] Session import/restore from transcript

### Step 3.4: Standard Tools
- [ ] Event interceptor tool (logs all agent events)
- [ ] Cost tracker tool (token counting per call/session)
- [ ] Rate limiter tool (configurable per-user/per-session)
- [ ] Tool permission manager (UI-driven approval/deny)

## Phase 4: Demo & Documentation

### Step 4.1: Demo Rewrite
- [ ] Rewrite demo app using chat-sdk React components (dogfood our SDK)
- [ ] Remove manual state management — ChatClient handles everything
- [ ] Multiple backend support via ModelSelector
- [ ] Session sidebar with real persistence
- [ ] Docker-compose with single `npm run demo` command

### Step 4.2: Documentation
- [ ] Migration guide from current API to v2 (breaking changes table)
- [ ] Getting started tutorial (5 minutes to chat app)
- [ ] Architecture overview with layer diagram
- [ ] API reference (auto-generated from TSDoc)
- [ ] Examples: simple bot, multi-session app, custom storage, custom components

## Dependency Order

```
Phase 1.1 (errors)
  └─ Phase 1.2 (IAgent session API)
       ├─ Phase 1.3 (context building)
       └─ Phase 2.1 (session/message split)
            └─ Phase 2.2 (ChatClient)
                 ├─ Phase 2.3 (context window)
                 ├─ Phase 3.1 (React components)
                 ├─ Phase 3.2 (server utilities)
                 └─ Phase 3.3 (adapters)
Phase 1.4 (ModelInfo) — independent, can parallel with 1.2-3.3
Phase 3.4 (tools) — independent, can parallel with 2.x
Phase 4 — after all above
```
