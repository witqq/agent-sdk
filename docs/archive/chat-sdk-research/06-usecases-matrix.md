# Матрица юзкейсов AI Chat SDK

Консолидация из 4 проектов-потребителей и анализа текущего agent-sdk.

**Проекты:**
- **Moira** — MCP Moira (workflow engine + web chat)
- **Supervisor** — Claude Supervisor (AI agent supervision)
- **Podcast** — News Podcast (podcast generator pipeline)
- **Planeta** — Planeta Analysis (enterprise analytics + AI chat)

---

## 1. Матрица юзкейсов

### Ядро: провайдеры и бэкенды

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Multi-backend (Claude/Copilot/Vercel) | ✅ 6 провайдеров через 3 бэкенда | ✅ все 3 бэкенда | ✅ все 3 бэкенда | ❌ только Vercel AI SDK 5 напрямую | ✅ |
| Provider/model switching per-session | ✅ `ModelSelector` UI, per-conversation | ✅ per-session switch на лету | ✅ per-stage (research/content/transcription) | ✅ per-user `providers` таблица | ❌ hot-swap нет |
| Model listing (`listModels()`) | ✅ через agent-sdk | ✅ через agent-sdk + tier badges | ✅ через agent-sdk + fallback на hardcoded | ❌ своя реализация | ✅ |
| Custom/BYOK provider endpoints | ✅ `custom` тип с user API key | ✅ multi-config Vercel AI (OpenRouter + Ollama) | ❌ | ✅ `createOpenAICompatible()` per-user | ❌ |

### Сессии и персистентность

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Session create/start | ✅ `AgentRuntime.processMessage()` | ✅ `SDKSessionAdapter` + NATS | ✅ `AgentFactory.runPrompt()` | ✅ `AgentService.runStreamingWithFullEvents()` | ✅ |
| Session restore/resume (persistent) | ❌ per-request агенты | ✅ `computeCanResume()` + `backendSessionId` | ❌ stateless pipeline | ❌ stateless HTTP | ✅ `sessionMode: "persistent"` |
| Session abort/cancel | ✅ `AbortController` при client disconnect | ✅ abort через NATS + AbortController | ✅ per-call AbortSignal timeout | ✅ `cancelCurrentStreaming()` + AbortController | ✅ |
| Chat history persistence (DB) | ✅ SQLite: `chat_message`, `chat_conversation` | ✅ SQLite: `sdk_session_messages` | ❌ нет чат-истории (pipeline) | ✅ SQLite: `threads`, `messages`, `tool_calls` | ❌ |
| Session state machine | ❌ простой lock | ✅ `starting→running→idle→ended` + `waiting_permission` + `error` + `resumable` | ❌ | ❌ | ✅ `idle→running/streaming→idle→disposed` |

### Стриминг и события

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Streaming events (SSE/WebSocket) | ✅ HTTP SSE через Data Stream Protocol | ✅ NATS pub/sub → nats.ws WebSocket | ✅ `agent.stream()` для logging | ✅ HTTP SSE (better-sse) | ✅ `AsyncIterable<AgentEvent>` |
| Data Stream Protocol (Vercel format) | ✅ `AgentEventStreamAdapter` → DSP | ❌ NATS-native events | ❌ | ❌ SSE custom events | ❌ |
| Thinking/reasoning blocks | ✅ collapsible в UI (Brain icon) | ✅ `thinking` message type в chat | ❌ | ✅ `Reasoning` компонент | ✅ `thinking_start/delta/end` |
| Heartbeat / keep-alive | ✅ 15-sec interval в `AgentRuntime` | ❌ NATS handles | ❌ | ❌ | ✅ `heartbeatStream()` |
| Reconnection handling | ❌ | ✅ NATS auto-reconnect + UI indicator | ❌ | ❌ | ❌ |
| Event interception/hooks | ✅ `AgentEventStreamAdapter.pipe()` | ✅ `categorizeSDKMessage()` + NATS routing | ✅ `AgentActionCallback` logging | ✅ SSE event handlers в MST store | ❌ middleware нет |

### Инструменты (Tools)

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Backend tool execution | ✅ 15+ tools (workflow, VFS, web search, crawl) | ✅ через CLI SDK (Read, Write, Bash, Grep) | ✅ 2 tools (WebSearch, WebFetch) | ✅ server tools (searchDocuments, listModels, getModelStructure) | ✅ |
| Frontend tool execution | ❌ | ❌ | ❌ | ✅ browser tools (`makeAssistantTool`) — click, type, scroll, DnD | ❌ |
| Tool context / DI (per-request) | ✅ `ChatToolFactory(ctx: ToolContext)` — userId, conversationId, signal | ❌ tools статичны через CLI | ❌ tools статичны | ❌ tools статичны | ❌ |
| Specialized tool renderers (UI) | ✅ `ToolCallCard` (generic, collapsible) | ✅ `WriteFileRenderer`, `EditFileRenderer`, `BashRenderer`, `ReadFileRenderer`, `SearchResultsRenderer` | ❌ нет UI для tools | ✅ `BrowserToolsUI`, `DataAccessToolUI`, `ToolStatusWrapper` | ❌ |
| Tool permissions (per-tool approval) | ❌ auto-approve всё | ✅ 3-tier: auto → LLM evaluation → user escalation | ❌ auto-approve | ✅ 2-level: browser (localStorage) + server (SQLite, 2min timeout) | ✅ `IPermissionStore` |
| Tool preference toggle (enable/disable) | ❌ | ❌ | ❌ | ✅ `tool_preferences` таблица, UI toggle | ❌ |

### Permission management

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Permission store (persistent) | ❌ не используется | ❌ своя система в SQLite `permissions` | ❌ | ✅ SQLite `tool_permissions` | ✅ `FilePermissionStore`, `CompositePermissionStore` |
| Permission scopes (once/session/project/always) | ❌ | ✅ allow/deny + escalate | ❌ | ✅ `allow_once` / `allow_always` / `deny` | ✅ 4 scopes |
| LLM-based permission evaluation | ❌ | ✅ `SupervisorAgent` structured output | ❌ | ❌ | ❌ |
| Multi-channel permission resolution | ❌ | ✅ Web UI + Telegram (first wins) | ❌ | ❌ | ❌ |
| Inline permission UI (in chat) | ❌ | ✅ Allow/Deny buttons в `ToolCallMessage` | ❌ | ✅ `PermissionPrompt`, `ServerPermissionPrompt` | ❌ |

### Обработка ошибок

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Error classification (typed) | ❌ generic catch | ✅ `classifyError()` по типам | ✅ `classifyError()` → TimeoutError, RateLimitError, AuthError, NetworkError | ✅ `isContextOverflowError()` detection | ✅ `AgentSDKError` hierarchy |
| Retry with backoff | ❌ | ❌ | ✅ 3 retries, exponential backoff (5s × 2^n) | ✅ auto-retry 1x на context overflow | ❌ `retryLLM` declared but NOT implemented |
| Stuck session detection | ❌ | ✅ `isSessionStuck()` (>5min), `needsEscapeHatch()` (>5min) | ❌ | ❌ | ❌ |
| Partial message persistence | ✅ status `"error"` + `errorMessage` в DB | ✅ error message в `sdk_session_messages` | ❌ | ✅ error поле в `messages` таблице | ❌ |
| Token refresh on error | ✅ refresh Claude OAuth в `AgentServiceRegistry` | ✅ refresh через agent-sdk auth | ✅ proactive check + auto-refresh | ❌ | ✅ `ClaudeAuth.refreshToken()` |

### Chat UI компоненты

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Chat message list (auto-scroll) | ✅ `MessageList.tsx` | ✅ `SessionChatPage` inline | ❌ | ✅ `Thread` (assistant-ui) | ❌ |
| Chat input with send/stop | ✅ `ChatInput.tsx` | ✅ inline в `SessionChatPage` | ❌ | ✅ `ComposerControls` (assistant-ui) | ❌ |
| Markdown rendering | ✅ в `AssistantMessage.tsx` | ✅ `MarkdownRenderer` (react-markdown + remark-gfm + rehype-highlight) | ❌ | ✅ `MarkdownText` (@assistant-ui/react-markdown) | ❌ |
| Chat sidebar / thread list | ✅ `ChatSidebar.tsx` | ✅ `SessionsPage` | ❌ | ✅ `ThreadList` (assistant-ui) | ❌ |
| Model selector UI | ✅ `ModelSelector.tsx` dropdown | ✅ `ModelSelector` с tier badges + manual fallback | ✅ `ModelSelect` searchable dropdown (admin) | ❌ per-user in settings | ❌ |
| Thinking blocks UI | ✅ collapsible (Brain icon) | ✅ `thinking` message type | ❌ | ✅ `Reasoning` компонент (collapsible) | ❌ |
| Tool call cards UI | ✅ `ToolCallCard` (collapsible, status) | ✅ `ToolCallMessage` с permission badge | ❌ | ✅ `ToolStatusWrapper` (running/complete/error) | ❌ |
| Error display in chat | ✅ error banner + AlertCircle | ✅ `ErrorBanner` + connection status | ❌ | ✅ `ErrorMessage` + `ThreadErrorBoundary` | ❌ |
| Usage/quota meter | ✅ `UsageMeter.tsx` | ❌ | ❌ | ✅ `TokenUsageIndicator` (context fill %) | ❌ |
| Floating/docked chat widget | ❌ full page | ❌ full page | ❌ | ✅ `FloatingChatWidget` (overlay/docked, resize) | ❌ |

### Context management

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Sliding window (token budget) | ✅ `ContextManager`: system → summaries → recent (reverse-chrono) | ❌ CLI manages context | ❌ | ✅ `context-window-service`: sliding window + auto-chunk | ❌ |
| Token estimation | ✅ ~4 chars/token | ❌ | ❌ | ✅ ~3.5 chars/token | ❌ |
| Auto-archival / summarization | ✅ AI summarization при threshold, `isSummary` + `isArchived` flags | ❌ | ❌ | ❌ | ❌ |
| Context overflow recovery | ❌ | ❌ | ❌ | ✅ `emergencyTrim(50%)` → retry once | ❌ |
| Page/app context injection | ❌ | ❌ | ❌ | ✅ 3-layer: RAG docs + page context + ARIA snapshot | ❌ |
| Dynamic system prompt | ✅ `MCP Text Service` with DB overrides | ❌ | ✅ prompt templates с `{{PLACEHOLDER}}` | ✅ runtime-assembled (RAG/browser/data capabilities) | ❌ |

### Structured output

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Structured output (Zod schema) | ❌ | ✅ `runStructured()` для permission decisions | ❌ JSON parsing из текста (fragile) | ❌ | ✅ native (Claude/Vercel) + prompt augmentation (Copilot) |

### Auth (OAuth flows)

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Copilot auth (GitHub Device Flow) | ✅ `CopilotAuth` из agent-sdk | ✅ `CopilotAuth` из agent-sdk | ✅ `CopilotAuth` из agent-sdk | ❌ | ✅ |
| Claude auth (OAuth+PKCE) | ✅ `ClaudeAuth` из agent-sdk | ✅ `ClaudeAuth` из agent-sdk | ✅ `ClaudeAuth` из agent-sdk | ❌ | ✅ |
| Token persistence | ✅ `AuthTokenStore` (encrypted в DB) | ✅ `provider_configs` в SQLite | ✅ `SettingsService` key-value | ✅ `providers` таблица | ❌ app responsibility |
| Auto token refresh | ✅ inline в `AgentServiceRegistry` (~40 строк) | ✅ через agent-sdk auth | ✅ proactive check перед каждым Claude вызовом | ❌ | ✅ `refreshToken()` method only |

### Transcripts

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Transcript reading | ❌ | ✅ JSONL файлы Claude Code, `TranscriptModal` UI | ❌ | ❌ | ❌ только `session_info.transcriptPath` |
| Transcript/action logging | ❌ | ✅ `events` таблица (audit) | ✅ `agent_actions` таблица (tool_use, tool_result, assistant) | ❌ | ❌ |
| Message persistence (chat DB) | ✅ SQLite `chat_message` | ✅ SQLite `sdk_session_messages` | ❌ | ✅ SQLite `messages` + `tool_calls` | ❌ |

### Storage adapters

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| SQLite storage | ✅ Drizzle ORM (9 chat-related таблиц) | ✅ better-sqlite3 (7 таблиц) | ✅ Knex (10+ таблиц) | ✅ better-sqlite3 (7 chat-related таблиц) | ❌ |
| Agent service caching | ✅ `AgentServiceRegistry` LRU (max 100, TTL 30min) | ✅ `AgentServicePool` per key (provider:config:dir) | ✅ `Map<ProviderType, IAgentService>` | ❌ creates per-request | ❌ |
| Vector storage (RAG) | ❌ | ❌ | ❌ | ✅ LanceDB (per user+provider isolation) | ❌ |
| Virtual filesystem | ✅ `chat_virtual_file` (per-conversation) | ❌ | ❌ | ❌ | ❌ |

### RAG integration

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Document upload + embedding | ❌ | ❌ | ❌ | ✅ PDF/DOCX/ZIP → LangChain splitting → bge-m3 embedding → LanceDB | ❌ |
| Similarity search tool | ❌ | ❌ | ❌ | ✅ `searchDocuments` tool с query rewriting | ❌ |
| Source citations | ❌ | ❌ | ❌ | ✅ `SourceDocumentLink` компонент | ❌ |

### Browser automation

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| ARIA snapshot injection | ❌ | ❌ | ❌ | ✅ auto-inject перед каждым ответом (7-14KB) | ❌ |
| Browser tool execution | ❌ | ❌ | ❌ | ✅ 6 tools: click, double_click, type, scroll, scroll_element, dnd_drag | ❌ |
| Stateless HTTP roundtrip pattern | ❌ | ❌ | ❌ | ✅ tool-call → close SSE → frontend executes → new POST | ❌ |

### TTS / Voice

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Text-to-Speech | ❌ | ❌ | ✅ XTTS (self-hosted), RunPod XTTS, Yandex SpeechKit | ❌ | ❌ |
| Voice provider abstraction | ❌ | ❌ | ✅ `VoiceServiceFactory` + `IVoiceProvider` | ❌ | ❌ |

### Прочее

| Юзкейс | Moira | Supervisor | Podcast | Planeta | В SDK |
|--------|:-----:|:----------:|:-------:|:-------:|:-----:|
| Content moderation | ✅ 3 provider (OpenAI API, LLM-based, disabled) | ❌ | ❌ | ❌ | ❌ |
| Quota/rate limiting | ✅ 3-dimensional (daily tokens, monthly cost, daily requests) | ✅ rate limiter для supervisor agent | ❌ | ❌ | ❌ |
| AskUser (user input request) | ❌ не используется в web chat | ✅ `AskUserQuestionCard` с кнопками/чекбоксами | ❌ | ❌ | ✅ `onAskUser` hook |
| E2E test markers (bypass LLM) | ❌ | ✅ `[TEST:ALLOW]` в business logic | ✅ `isE2ETestRequest()` shared | ✅ `extractTestDecisionFromMessages()` → mock model | ❌ |
| Checkpoint/recovery | ❌ | ✅ `buildSDKSessionFromDB()` при рестарте | ✅ `GenerationRecoveryService` (regenerate/fail+refund) | ❌ | ❌ |
| Telegram integration | ❌ | ✅ bot + permission buttons + /ask | ✅ wizard, payments (Stars), scheduler, hot news | ❌ | ❌ |

---

## 2. Общие боли (в 2+ проектах)

### 2.1 Дублирование типов SDK

**Проекты:** Moira, Supervisor

**Проблема:** Оба проекта определяют локальные копии типов `AgentEvent`, `ToolDefinition`, `Message` в shared-пакетах вместо импорта из agent-sdk.

- **Moira:** `packages/shared/src/chat/` — `AgentLike`, `AgentServiceLike`, `AgentEvent` union, `ChatToolDefinition`, `ContextMessage` — все структурные копии SDK типов. Причина: избежание runtime-зависимости shared пакета от SDK.
- **Supervisor:** `packages/shared/` — типы сессий и событий параллельно SDK типам. `categorizeSDKMessage()` — ручная классификация SDK событий в domain-specific категории.

**Запрос к SDK:** Экспортировать чистые type-only пакеты (без runtime) или предоставить `@witqq/agent-sdk/types` entry point.

### 2.2 Error classification дублируется

**Проекты:** Supervisor, Podcast

**Проблема:** Оба проекта реализуют свой `classifyError()` для маппинга SDK/HTTP ошибок в domain-specific типы.

- **Supervisor:** `classifyError()` классифицирует по типам (auth, network, rate limit).
- **Podcast:** `AgentFactory.classifyError()` маппит сообщения ошибок в `TimeoutError`, `RateLimitError`, `AuthError`, `NetworkError`, `AgentError`. Дополнительно определены legacy типы `AgentError`, `TimeoutError` и т.д. параллельно SDK.

**Запрос к SDK:** SDK определяет `AgentSDKError` иерархию (8 классов), но не классифицирует HTTP-ошибки от провайдеров. Нужен встроенный `classifyError()` для маппинга raw provider errors в типизированные SDK ошибки.

### 2.3 Token estimation — грубая аппроксимация

**Проекты:** Moira, Planeta

**Проблема:** Обе реализации context window management используют character-based heuristic:
- **Moira:** `Math.ceil(text.length / 4)` (~4 chars/token)
- **Planeta:** `~3.5 chars/token`

Обе неточны для CJK, русского текста, JSON, кода. Разные токенизаторы (GPT, Claude, Gemini) дают разные результаты.

**Запрос к SDK:** Утилита `estimateTokens(text, model?)` с более точной аппроксимацией, или интеграция с tokenizer libraries.

### 2.4 AgentService caching — каждый пишет свой pool

**Проекты:** Moira, Supervisor, Podcast

**Проблема:** Три разных реализации кэширования `IAgentService`:
- **Moira:** `AgentServiceRegistry` — LRU eviction (max 100, TTL 30min), per-user + shared singletons
- **Supervisor:** `AgentServicePool` — per composite key (`provider:configName:workingDirectory`), lazy create
- **Podcast:** `Map<ProviderType, IAgentService>` — простой Map cache

**Запрос к SDK:** `AgentServicePool` как reference implementation или встроенная утилита для кэширования сервисов.

### 2.5 Auth token refresh — inline logic

**Проекты:** Moira, Supervisor, Podcast

**Проблема:** Все 3 проекта реализуют свою логику refresh OAuth токенов перед вызовом Claude:
- **Moira:** ~40 строк inline в `AgentServiceRegistry.createServiceForAdminModel()`
- **Podcast:** proactive check + auto-refresh в `AgentFactory.runPrompt()`
- **Supervisor:** refresh через agent-sdk auth + store

SDK предоставляет `ClaudeAuth.refreshToken()`, но не auto-refresh wrapper. Каждый проект пишет свой.

**Запрос к SDK:** Auto-refresh middleware или wrapper `withAutoRefresh(service, refreshCallback)`.

### 2.6 Chat message persistence — каждый свой schema

**Проекты:** Moira, Supervisor, Planeta

**Проблема:** Три проекта с chat UI — три разных SQLite схемы для хранения сообщений:
- **Moira:** `chat_message` (role, content, toolCalls JSON, toolResult JSON, thinking, status, isSummary, isArchived)
- **Supervisor:** `sdk_session_messages` (session_id, message_type, content, tool_name, tool_input, tool_use_id, tool_result)
- **Planeta:** `messages` (thread_id, role, content, reasoning, error, content_parts JSON) + отдельная `tool_calls` таблица

**Запрос к SDK:** Стандартизированная схема хранения сообщений или storage adapter interface.

### 2.7 Data Stream / SSE event формат — отсутствие стандарта

**Проекты:** Moira, Planeta

**Проблема:** Оба проекта стримят AI события к фронтенду, но каждый по-своему:
- **Moira:** `AgentEventStreamAdapter` вручную формирует Vercel Data Stream Protocol строки (`0:`, `9:`, `a:`, `d:`, `e:`) + `DataStreamChatTransport` на фронте парсит их — reimplementation стандартного протокола.
- **Planeta:** Custom SSE events через better-sse с собственным форматом.

**Запрос к SDK:** Server-side SSE writer и client-side transport для стандартного протокола, или хотя бы сериализатор `AgentEvent` → wire format.

### 2.8 Tool definition — разные форматы в одном проекте

**Проекты:** Moira, Planeta

**Проблема:**
- **Moira:** `ChatToolDefinition` (structural copy) ≈ `ToolDefinition` SDK, плюс `ChatToolFactory` для DI — SDK не поддерживает factory pattern.
- **Planeta:** 3 формата в одном проекте — server tools (zod), browser tools (JSON Schema via `makeAssistantTool`), frontend tools (JSON Schema). Нет единого реестра.

### 2.9 Context window management отсутствует в SDK

**Проекты:** Moira, Planeta

**Проблема:** Обе реализации пишут sliding window с token budget вручную:
- **Moira:** `ContextManager` — system → summaries → recent (reverse-chronological), auto-archival
- **Planeta:** `context-window-service` — sliding window + auto-chunk + emergency trim

Это критическая функциональность для web chat, и обе реализации по сути одинаковые.

---

## 3. Повторяющиеся решения (независимо реализованные паттерны)

### 3.1 Registry + Factory для Agent Services

**Moira:** `AgentServiceRegistry` — `resolveForUser()` / `resolveForModel()` / `getPublicService()`
**Supervisor:** `AgentServicePool` — lazy per-key с composite cache key
**Podcast:** `AgentFactory` — `Map<ProviderType, IAgentService>` кэш

Паттерн: создать `IAgentService` однажды, кэшировать, переиспользовать. Различается стратегия eviction и ключ кэширования.

### 3.2 Stream → Wire Protocol → UI Pipeline

**Moira:** `AgentEvent` → `AgentEventStreamAdapter` → Data Stream Protocol → HTTP SSE → `DataStreamChatTransport` → `useChat()` UIMessage
**Supervisor:** `AgentEvent` → NATS publish → nats.ws WebSocket → `useSDKSession()` → MessageBubble
**Planeta:** Vercel `streamText()` → SSE custom events → MST `AiChatStore` → assistant-ui Runtime → Thread

Паттерн: три независимых реализации транспорта AI событий от backend к frontend UI.

### 3.3 Error Classification + Retry

**Supervisor:** `classifyError()` → typed errors, permission timeout 5min, stream activity timeout 5min
**Podcast:** `classifyError()` → domain errors, retry 3x exponential backoff, abort compose
**Planeta:** `isContextOverflowError()` → emergency trim → retry 1x

Паттерн: классифицировать ошибку → решить retryable/fatal → retry с backoff.

### 3.4 Provider Config Persistence

**Moira:** `chat_provider_config` (encrypted AES-256-GCM) + `chat_admin_model` + `AuthTokenStore`
**Supervisor:** `provider_configs` (provider_type + config_name → config_json)
**Podcast:** `settings` key-value (categories: model, provider, auth)
**Planeta:** `providers` (user_id, api_url, api_token, model_id, embedding_model_id)

Паттерн: хранить provider credentials per-user в БД. Каждый проект — своя схема.

### 3.5 E2E Test Bypass Markers

**Supervisor:** `[TEST:ALLOW]`, `__SUPERVISOR_E2E_7x9k2m__:ALLOW` в business logic → bypass LLM
**Podcast:** `isE2ETestRequest()` + `getGenerationDecision()` → mock responses
**Planeta:** `extractTestDecisionFromMessages()` → `createMockModel()` → bypass LLM

Паттерн: маркер в input → bypass реального AI → предсказуемый ответ для E2E тестов. Три независимых реализации одной идеи.

### 3.6 Tool Call Tracking (correlate start ↔ end)

**Moira SDK:** `ToolCallTracker` в Copilot backend — `toolCallId → { toolName, args }`
**Moira SDK:** `ClaudeToolCallTracker` — FIFO очередь по toolName
**Supervisor:** `categorizeSDKMessage()` + tool pairing по `toolUseId`
**Planeta:** `content_parts` ordering для сохранения порядка text и tool calls

Паттерн: SDK события не всегда содержат полную информацию (Copilot `tool.execution_complete` без toolName), требуется stateful tracking.

### 3.7 Dynamic System Prompt Assembly

**Moira:** `MCP Text Service` с 3-level override hierarchy (model → agent → default)
**Podcast:** prompt templates с `{{PLACEHOLDER}}` заменами (topic, period, style)
**Planeta:** runtime-assembled prompt на основе capabilities (`ragEnabled`, `browserToolsEnabled`, `dataToolsEnabled`)

Паттерн: system prompt не static — собирается динамически на основе контекста, capabilities и настроек.

---

## 4. Уникальные потребности (per-project)

### Moira

| Потребность | Детали |
|------------|--------|
| **Multi-layer quota enforcement** | 3 измерения квот (daily tokens, monthly cost, daily requests) с lazy reset. SDK не имеет quota API. |
| **Auto-archival с AI summarization** | При превышении token threshold — суммирование через LLM, сохранение summary, архивация старых. Fail-open при ошибке. |
| **Content moderation pipeline** | 3 провайдера модерации (OpenAI API, LLM-based, disabled). Pipeline: quota → moderation → streaming. |
| **Virtual filesystem per-conversation** | `chat_virtual_file` — файлы привязаны к разговору, доступны через VFS tool. |
| **Tool context factories (DI)** | `ChatToolFactory(ctx: ToolContext)` — tools получают userId, conversationId, signal через closure. SDK tools статичны. |

### Supervisor

| Потребность | Детали |
|------------|--------|
| **LLM-based permission evaluation** | AI-агент как judge: анализирует context (транскрипт, память, правила) → structured output (allow/deny/escalate). |
| **AskUserQuestion with choices** | Вопросы от Claude Code с вариантами ответов → кнопки в Web UI / Telegram. Multi-select чекбоксы. |
| **Multi-channel notification** | Одно и то же permission request → Web UI buttons + Telegram inline buttons. First wins, другой канал обновляется. |
| **Session recovery after restart** | SQLite → in-memory reconstruction (`buildSDKSessionFromDB`). Persistent sessions через agent-sdk. |
| **Transcript reading** | Парсинг JSONL файлов Claude Code для context window supervisor agent. |
| **Stop verification** | AI анализ: завершена ли задача? Ошибки? → allow stop / block stop. |
| **NATS message bus** | Pub/sub + request-reply + JetStream для real-time events между backend/frontend/telegram. |

### Podcast

| Потребность | Детали |
|------------|--------|
| **Multi-stage AI pipeline** | Research (tools) → Content (LLM) → Transcription (LLM) → Validation loop → Voice (TTS). Каждый этап — отдельный agent с per-stage model/provider. |
| **TTS integration** | 3 голосовых провайдера (XTTS, RunPod, Yandex). Text chunking + ffmpeg concat. |
| **Checkpoint + recovery** | Промежуточные результаты в DB. При рестарте: regenerate_voice / regenerate_content_and_voice / fail_and_refund. |
| **Content validation loop** | AI expand/compress для попадания в target length. Max 2 итерации с degradation protection. |
| **Search tools (SearXNG + Crawl4AI)** | `createWebSearchTool()` / `createWebFetchTool()` — self-hosted search. Health check Crawl4AI. |
| **Per-stage provider/model config** | `SettingsService.getProvider('research')` / `getModel('content')` — разные модели для разных этапов. |
| **Telegram payments (Stars)** | Telegram Stars для оплаты генераций. Credits system. |

### Planeta

| Потребность | Детали |
|------------|--------|
| **Browser automation via ARIA** | 6 browser tools работают через ARIA snapshot (accessibility tree). Stateless HTTP roundtrip. Permission prompt перед действием. |
| **RAG pipeline** | PDF/DOCX/ZIP → text splitting → embedding (bge-m3) → LanceDB → similarity search с query rewriting. Per user+provider isolation. |
| **Page context injection** | Динамический контекст текущей страницы: constructor (модели, измерения, выбор), dashboard (виджеты, edit mode), budget (таблица). |
| **Frontend tool execution** | `makeAssistantTool` (assistant-ui) → tools выполняются в browser, результат POST обратно. Backend stateless. |
| **OLAP data access tools** | `listModels`, `getModelStructure`, `queryData` — прокси через `PlanetaApiClient` с session cookie пользователя. |
| **MobX State Tree ↔ assistant-ui bridge** | MST observable → snapshot → POJO → `useExternalMessageConverter` → assistant-ui Runtime. Нетривиальный bridge. |
| **Context overflow emergency trim** | `emergencyTrim(50%)` → retry once при `isContextOverflowError()`. |
| **React 17 compatibility** | 5 patch-package патчей для zustand, assistant-ui и зависимостей. Lock-in на Ant Design 4. |
| **Content parts ordering** | Сохранение порядка text и tool calls как они были сгенерированы LLM (не просто group by type). |

---

## 5. Приоритеты для SDK

### Tier 1 — Core (используется в 3-4 проектах, критически важно)

| Приоритет | Юзкейс | Кто использует | Обоснование |
|-----------|--------|----------------|-------------|
| **P1** | **AgentService caching/pool** | Moira, Supervisor, Podcast | Все 3 проекта написали свой pool. SDK должен предоставить `AgentServicePool` с configurable eviction (LRU/TTL). |
| **P1** | **Error classification** | Supervisor, Podcast, (Planeta свой) | `classifyError()` для маппинга HTTP/provider ошибок → типизированные SDK ошибки. Встроенный retry с backoff. |
| **P1** | **Auto token refresh** | Moira, Supervisor, Podcast | Wrapper `withAutoRefresh(service, refreshFn)` или middleware. 3 проекта пишут одно и то же. |
| **P1** | **Type-only exports** | Moira, Supervisor | `@witqq/agent-sdk/types` — чистые типы без runtime. Решает проблему дублирования в shared пакетах. |

### Tier 2 — Important (используется в 2-3 проектах)

| Приоритет | Юзкейс | Кто использует | Обоснование |
|-----------|--------|----------------|-------------|
| **P2** | **Context window management** | Moira, Planeta | Sliding window с token budget, auto-trim. Критично для web chat. SDK может предоставить `ContextWindowManager`. |
| **P2** | **Token estimation utility** | Moira, Planeta | `estimateTokens(text, model?)` с более точной аппроксимацией чем `length/4`. |
| **P2** | **Stream → SSE serializer** | Moira, Planeta | `AgentEvent` → wire format (Data Stream Protocol или custom). Server writer + client parser. |
| **P2** | **Tool context factories (DI)** | Moira, (Planeta partially) | `ToolFactory<TContext>` — tools с dependency injection. Pattern: `(ctx) => ToolDefinition`. |
| **P2** | **Chat message storage interface** | Moira, Supervisor, Planeta | `IChatStorage` interface для persist/load messages. Не конкретная реализация, а контракт. |
| **P2** | **Retry/backoff built-in** | Podcast, Planeta | `ErrorHandlingConfig.retryLLM` уже объявлен но не реализован. Нужна реализация в base-agent. |

### Tier 3 — Nice-to-have (уникально для 1 проекта, но полезно)

| Приоритет | Юзкейс | Кто использует | Обоснование |
|-----------|--------|----------------|-------------|
| **P3** | **Structured output improvements** | Supervisor, Podcast | Podcast парсит JSON из текста (хрупко). Должен использовать `runStructured()`. Нужна документация/примеры. |
| **P3** | **Permission events в stream** | Supervisor, Planeta | `permission_request`/`permission_response` events определены в SDK но не emit'ятся. Реализовать. |
| **P3** | **Multi-stage pipeline support** | Podcast | Per-stage model/provider config. SDK может предоставить `PipelineRunner` utility. |
| **P3** | **Agent action logging** | Supervisor, Podcast | `agent_actions` / audit events. SDK-level hook для логирования всех tool calls и results. |
| **P3** | **E2E test utilities** | Supervisor, Podcast, Planeta | Стандартный `createMockAgentService()` для тестов без реальных LLM вызовов. |
| **P3** | **Provider config persistence** | Moira, Supervisor, Podcast, Planeta | Стандартизированная схема хранения credentials. Или хотя бы `IProviderConfigStore` interface. |

### Не в SDK (domain-specific)

| Юзкейс | Почему не в SDK |
|--------|----------------|
| RAG pipeline | Domain-specific (embeddings, vector DB, text splitting). Слишком много вариаций. |
| Browser automation | Planeta-specific. ARIA snapshots, DOM manipulation — не AI SDK ответственность. |
| TTS/Voice | Podcast-specific. Отдельная domain. |
| Content moderation | Moira-specific. Реализация зависит от бизнес-требований. |
| Telegram integration | App-level, не SDK. |
| NATS message bus | Infrastructure choice, не SDK. |
| Quota management | Business logic, не SDK. |
| OLAP data tools | Domain-specific (Planeta). |
