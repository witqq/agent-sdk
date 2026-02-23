# Competitor Analysis — @witqq/chat-sdk

## Source: исходный код (git clone), не документация

Дата анализа: июль 2025

---

## Проанализированные SDK

| # | SDK | Версия/коммит | Язык | Позиционирование | Зрелость |
|---|-----|--------------|------|-----------------|----------|
| 1 | **Vercel AI SDK v6** | latest (main) | TypeScript | Универсальный AI SDK: модели + hooks + streaming | Production, >50k stars |
| 2 | **assistant-ui** | latest (main) | TypeScript | React Chat UI библиотека для AI | Production, ~10k stars |
| 3 | **OpenAI Agents SDK** | latest (main) | Python | Multi-agent orchestration framework | Production, ~20k stars |
| 4 | **LangChain.js** | latest (main) | TypeScript | AI application framework с LCEL | Production, >15k stars |
| 5 | **Anthropic SDK (TS)** | latest (main) | TypeScript | Anthropic API клиент | Production, official |
| 6 | **Vercel ai-chatbot** | latest (main) | TypeScript/React | Референсная реализация чата | Template, official |

---

## 1. Сравнительная матрица: Must-Have Requirements

### M1: Session Management

| SDK | Решение | Паттерн | Файл |
|-----|---------|---------|------|
| **Vercel AI SDK** | `AbstractChat` класс управляет messages + status + transport. `ChatState<UI_MESSAGE>` хранит status/error/messages. `ChatStatus`: `submitted\|streaming\|ready\|error` | Messages in-memory array, no persistent session ID | `packages/ai/src/ui/chat.ts:192-751` |
| **assistant-ui** | `ThreadRuntimeCore` — центральный интерфейс. `ThreadListRuntimeCore` для списка сессий с `switchToThread()/archive()/rename()`. Item state: id, title, status (archived/regular/new/deleted) | Thread = session, ThreadList = session manager | `packages/core/src/runtime/interfaces/thread-runtime-core.ts:84-142`, `thread-list-runtime-core.ts:17-49` |
| **OpenAI Agents** | `Session` protocol с `get_items()/add_items()/clear_session()`. `SQLiteSession` реализация. `RunState` для resumable runs | Pluggable session protocol | `memory/session.py:14-55`, `memory/sqlite_session.py:14` |
| **LangChain.js** | `BaseChatMessageHistory` abstract: `getMessages()/addMessage()/clear()`. `RunnableWithMessageHistory` wraps chain, injects history by `sessionId` from `configurable` | Session = MessageHistory, injected via config | `libs/langchain-core/src/chat_history.ts:10-98`, `runnables/history.ts:105` |
| **Anthropic SDK** | Нет. Сырые `MessageParam[]` на каждый вызов | Stateless | — |
| **ai-chatbot** | PostgreSQL через Drizzle: `chat` таблица с `id/userId/visibility/title/createdAt`. Sidebar с SWR infinite scroll | Full-stack implementation | `components/sidebar-history.tsx:100`, `lib/db/` |

**Best practice:** assistant-ui ThreadList — полноценная session management с lifecycle (new→regular→archived→deleted), switchToThread, rename, generateTitle. OpenAI Agents Session protocol — простой pluggable интерфейс.

### M2: Session Storage Adapters

| SDK | Решение | Адаптеры из коробки |
|-----|---------|-------------------|
| **Vercel AI SDK** | Нет абстракции хранения. Messages в `ChatState` (in-memory) | Нет |
| **assistant-ui** | `ExternalStoreAdapter` с callbacks: `setMessages`, `convertMessage`, `onNew`, `onEdit`, `onReload`. `RemoteThreadListAdapter` для cloud. `InMemoryThreadListAdapter` для dev. History через `adapters.history.load()/append()` | InMemory, External, Remote, LocalThreadRuntime (with local history) |
| **OpenAI Agents** | `Session` protocol → `SQLiteSession` (file/in-memory), `OpenAIConversationsSession` (API), `OpenAIResponsesCompactionSession` | SQLite, OpenAI API |
| **LangChain.js** | `BaseChatMessageHistory` → `InMemoryChatMessageHistory`. Ecosystem: Redis, MongoDB, PostgreSQL и др | InMemory + ecosystem |
| **ai-chatbot** | Drizzle ORM + PostgreSQL конкретная реализация | PostgreSQL only |

**Best practice:** assistant-ui ExternalStoreAdapter — clean adapter pattern с минимальным interface. OpenAI Session protocol — простота.

### M3: Message Streaming

| SDK | Механизм | События | Файл |
|-----|----------|---------|------|
| **Vercel AI SDK** | `streamText()` → `StreamTextResult` → `toUIMessageStream()`. ~25 chunk types: text-start/delta/end, reasoning-*, tool-input-*, tool-output-*, source-*, file, step-*, start, finish, abort | `TextStreamPart<TOOLS>` union | `packages/ai/src/generate-text/stream-text-result.ts:370-450` |
| **assistant-ui** | `AssistantStreamChunk`: part-start/finish, text-delta, step-start/finish, message-finish, result, error. Encoders: DataStream, PlainText, AssistantTransport, UIMessageStream | Своя serialization layer | `packages/assistant-stream/src/core/AssistantStreamChunk.ts:29-101` |
| **OpenAI Agents** | `Runner.run_streamed()` → `AsyncIterator[StreamEvent]`. Events: `RawResponsesStreamEvent`, `RunItemStreamEvent` (message_output_created, tool_called, tool_output, handoff_requested) | Typed event union | `stream_events.py:61`, `result.py:483` |
| **LangChain.js** | Dual: low-level `CallbackManager` events (on_llm_stream, on_tool_start...) + high-level `streamEvents()`. Chunk variants (AIMessageChunk) для incremental | CallbackManager + streamEvents | `libs/langchain-core/src/callbacks/manager.ts:261-523` |
| **Anthropic SDK** | SSE → `Stream<RawMessageStreamEvent>` → `MessageStream` (high-level emitter). Events: message_start/delta/stop, content_block_start/delta/stop. `#accumulateMessage()` builds snapshot | SSE protocol | `src/lib/MessageStream.ts:51`, `src/core/streaming.ts:22` |

**Best practice:** Vercel AI SDK UIMessageChunk — самый полный набор событий. assistant-ui AssistantStream — clean serialization layer. Anthropic MessageStream accumulator pattern.

### M4: Context Window Management

| SDK | Решение |
|-----|---------|
| **Vercel AI SDK** | `pruneMessages()` — но удаляет content types (reasoning, tool calls), не по токенам. Нет token counting | `packages/ai/src/generate-text/prune-messages.ts:17-167` |
| **assistant-ui** | Нет встроенного |
| **OpenAI Agents** | `call_model_input_filter` hook — можно модифицировать input перед каждым LLM call. `OpenAIResponsesCompactionSession.run_compaction()` для серверной компрессии | `run_config.py:165-173` |
| **LangChain.js** | Нет встроенного context window, но `ContextOverflowError` с error code `CONTEXT_OVERFLOW` | `libs/langchain-core/src/errors/index.ts:141` |
| **Anthropic SDK** | Server-side `countTokens()` API. Beta `context-management` | `messages.ts:184` |

**Best practice:** OpenAI `call_model_input_filter` — hook для injection-based trimming. Наш ContextWindowManager уже лучше всех конкурентов.

### M5: Error Handling

| SDK | Иерархия | Retry | Классификация |
|-----|----------|-------|---------------|
| **Vercel AI SDK** | `AISDKError` base → 15+ подтипов (APICallError, InvalidToolInputError, RetryError...). `RetryError` wraps с reason | `retry-with-exponential-backoff.ts`: maxRetries 2, initialDelay 2000ms, backoffFactor 2, respects retry-after headers. Only `APICallError.isRetryable` | Нет classifier |
| **assistant-ui** | `MessagePartStatus`: running/complete/incomplete (с reason: cancelled/length/content-filter/error) | Нет встроенного retry | Status-based |
| **OpenAI Agents** | `AgentsException` → `MaxTurnsExceeded`, `ModelBehaviorError`, `UserError`, `ToolTimeoutError`, 4 guardrail exceptions. `RunErrorHandlers` pluggable by kind. Tool: `failure_error_function`, `timeout_behavior` | Tool-level timeout с behavior config | Kind-based handlers |
| **LangChain.js** | `LangChainError` с `isInstance()` брандингом. Codes: `CONTEXT_OVERFLOW`, `MODEL_AUTHENTICATION`, `MODEL_RATE_LIMIT`, `MODEL_NOT_FOUND`, `MODEL_ABORTED`, `OUTPUT_PARSING_FAILURE` | `withRetry()` → `RunnableRetry` (pRetry, maxAttempts 3, exponential). `withFallbacks()` → `RunnableWithFallbacks` | Error code enum |
| **Anthropic SDK** | `AnthropicError` → `APIError<status>` → 8 HTTP-typed subclasses (BadRequestError, RateLimitError...). `shouldRetry()` checks status + header | Exponential backoff 0.5s-8s, 25% jitter, maxRetries 2, respects retry-after | HTTP status based |

**Best practice:** LangChain error codes enum — типизированная классификация. Anthropic retry — jitter + retry-after headers. OpenAI `RunErrorHandlers` — pluggable error handling by kind.

### M6: React UI Components

| SDK | Подход | Компоненты |
|-----|--------|-----------|
| **Vercel AI SDK** | Только hooks: `useChat`, `useCompletion`, `useObject`. Нет компонентов | 0 React components |
| **assistant-ui** | 16 primitive namespaces (headless) + pre-built Tailwind UI. Primitives: Thread, Composer, Message, ActionBar, BranchPicker, Attachment, ThreadList, Suggestion, Error, ChainOfThought, SelectionToolbar, AssistantModal. Pre-built UI: полные styled компоненты | 16+ primitive groups + pre-built |
| **ai-chatbot** | Полная реализация: Chat, Messages, PreviewMessage, MultimodalInput, ChatHeader, SidebarHistory, ThinkingMessage. Parts-based rendering: text→Streamdown, reasoning→collapsible, tool→approval UI | ~15 components (reference impl) |

**Best practice:** assistant-ui 3-tier: primitives (headless) → pre-built UI (styled) → component slot system. Это наша целевая модель.

### M7: Provider/Model Switching

| SDK | Решение |
|-----|---------|
| **Vercel AI SDK** | `createOpenAI()`, `createAnthropic()` etc. — provider factory. `providerOptions` passthrough | Provider registry |
| **assistant-ui** | `ChatModelAdapter` interface → адаптеры: `useChatRuntime()` (Vercel AI), `useLangGraphRuntime()` (LangGraph) | Adapter pattern |
| **OpenAI Agents** | `model` field on Agent — string или `Model` protocol. `ModelSettings` dataclass | Per-agent model config |
| **LangChain.js** | `BaseChatModel.bindTools()` — abstract. Concrete: `ChatOpenAI`, `ChatAnthropic` etc | Inheritance hierarchy |

**Best practice:** assistant-ui ChatModelAdapter — clean adapter без привязки к конкретному SDK.

### M8: Tool System (Frontend + Server)

| SDK | Frontend tools | Server tools | Approval |
|-----|---------------|-------------|----------|
| **Vercel AI SDK** | Tools без `execute` → `onToolCall` events → `addToolOutput()` | Tools с `execute` | `needsApproval`: boolean или function. States: input-available → approval-requested → approval-responded → output |
| **assistant-ui** | `FrontendTool` с `parameters` + optional `execute/streamCall`. `useAssistantTool()` hook. `HumanTool` для human-in-loop | `BackendTool` — no params, server-side | `ToolCallMessagePartStatus.requires-action` с reason `interrupt` |
| **OpenAI Agents** | `@function_tool` decorator, auto JSON schema from signature. `ToolContext` injection | Server-side only (Python) | `needs_approval` field + `RunState` for resumable |
| **LangChain.js** | `StructuredTool` abstract с `_call()`. `DynamicTool` factory. `parentConfig` DI context | Server-side в цепочке | Нет встроенного approval |
| **Anthropic SDK** | `Tool` type с `input_schema`. `ToolUseBlock` / `ToolResultBlockParam` | Нет execute — raw API | Нет |

**Best practice:** assistant-ui — Frontend/Backend/Human tool separation. Vercel AI — approval state machine. OpenAI — decorator-based tool definition.

### M9: Event System

| SDK | Механизм |
|-----|----------|
| **Vercel AI SDK** | Нет общего event bus. Transport-specific streams | — |
| **assistant-ui** | Runtime events: `runStart`, `runEnd`, `initialize`, `modelContextUpdate`. `EventSubscriptionSubject` для pub/sub | Custom subscribable |
| **OpenAI Agents** | `RunHooksBase` (7 hooks: on_agent_start/end, on_tool_start/end, on_llm_start/end, on_handoff) + `AgentHooksBase` (same, per-agent) | Two-tier hooks |
| **LangChain.js** | `CallbackManager` иерархия: LLMRun, ChainRun, ToolRun, RetrieverRun. Custom events via `dispatchCustomEvent()` | Full callback system |

**Best practice:** OpenAI two-tier hooks (global + per-agent). LangChain callback hierarchy — comprehensive but complex.

### M10: Transport / Connection Management

| SDK | Transport | Reconnection |
|-----|-----------|-------------|
| **Vercel AI SDK** | `ChatTransport` interface: `sendMessages()` → `ReadableStream<UIMessageChunk>`, `reconnectToStream()` → stream или null. `HttpChatTransport` base. `DefaultChatTransport` с SSE + Zod validation | GET `${api}/${chatId}/stream` → 204 = no active stream |
| **assistant-ui** | `AssistantTransportEncoder/Decoder`. Multiple serialization formats. `ChatModelAdapter.run()` → `AssistantStream` | Via transport adapter |
| **Others** | Нет транспортной абстракции | — |

**Best practice:** Vercel AI `ChatTransport` — clean transport interface с reconnection support.

### M11: Permission System

| SDK | Решение |
|-----|---------|
| **Vercel AI SDK** | `needsApproval` на Tool level. State machine: approval-requested → responded | Per-tool |
| **assistant-ui** | `HumanTool` type для human-in-loop + `ToolCallMessagePartStatus.requires-action` | Tool-type based |
| **OpenAI Agents** | `needs_approval` + `RunState` для resumable runs после approval | Resumable state |
| **Others** | Нет | — |

---

## 2. Уникальные архитектурные паттерны

### Vercel AI SDK v6
1. **UIMessage parts model** — сообщение = массив typed parts (text, reasoning, tool, source, file). Каждый part имеет lifecycle (start/delta/end). Файл: `ui-messages.ts:75-87`
2. **UIMessageChunk protocol** — ~25 chunk types для streaming, полное описание всех возможных событий. `ui-message-chunks.ts:191-335`
3. **Transport abstraction** — `ChatTransport` interface с reconnection. Clean HTTP base class. `chat-transport.ts:15-83`
4. **Lazy PromiseLike on StreamTextResult** — `.text`, `.toolCalls`, `.usage` etc — всё lazy accessors которые auto-consume stream. `stream-text-result.ts:109`

### assistant-ui
1. **3-tier component system** — Primitives (headless) → Pre-built UI (styled) → Component slots (customizable). 16 primitive namespaces
2. **Custom reactive system (tap)** — Собственные subscribables с shallow memoization вместо Zustand/Redux. `useSyncExternalStore` integration
3. **Framework-agnostic core** — `@assistant-ui/core` не зависит от React. React — отдельный пакет
4. **Tool registration hooks** — `useAssistantTool()`, `useAssistantToolUI()` — tool UI регистрируется в React tree
5. **Message branching** — Tree-structured conversations, не линейные. Branch picker UI
6. **Per-part status tracking** — Каждый part имеет свой `MessagePartStatus` (running/complete/incomplete)
7. **Hierarchical scoping** — threads → thread → message → part — каждый уровень имеет свой scope для state

### OpenAI Agents SDK
1. **Generic TContext** — User context threaded через все callbacks и tool functions
2. **Handoffs** — Multi-agent routing через `handoffs` list
3. **Guardrails** — Input/output/tool guardrails с trip-wire exceptions
4. **RunState для resumable runs** — Serialize/deserialize state для прерванных runs (tool approval)
5. **call_model_input_filter** — Hook для модификации input перед каждым LLM call

### LangChain.js
1. **Runnable interface** — Универсальный `invoke/stream/batch/transform` с composition через `pipe()`
2. **Error code enum** — Типизированные error codes для классификации
3. **namespace branding** — `LangChainError.isInstance()` для safe instanceof across packages
4. **withRetry() + withFallbacks()** — Composition operators для error handling на уровне цепочки
5. **Chunk variants** — Каждый message type имеет Chunk variant для streaming (AIMessage → AIMessageChunk)

### Anthropic SDK
1. **MessageStream accumulator** — `#accumulateMessage()` строит snapshot из stream events, handling delta merge для text + tool input JSON (partial parse)
2. **Async API key rotation** — `ApiKeySetter` может быть async function
3. **Model-aware timeouts** — Auto-calculated non-streaming timeout per model
4. **Stream.tee()** — Split stream into two independent readers

---

## 3. Industry Best Practices (общие паттерны)

| # | Practice | Кто использует | Наше решение |
|---|----------|---------------|-------------|
| 1 | **Parts-based message model** (не string content) | Vercel AI, assistant-ui, Anthropic | Adopt: UIMessage с typed parts |
| 2 | **Per-part status tracking** | assistant-ui | Adopt: status на каждом part |
| 3 | **Typed stream event union** | Все 5 SDK | Adopt: discriminated union для stream events |
| 4 | **Pluggable session storage** | OpenAI, LangChain, assistant-ui | Adopt: adapter pattern |
| 5 | **Transport abstraction** | Vercel AI | Adopt: ChatTransport interface |
| 6 | **Tool approval state machine** | Vercel AI, OpenAI, assistant-ui | Adopt: requires-action → approved/denied |
| 7 | **Headless primitives + styled layer** | assistant-ui | Adopt: 3-tier component system |
| 8 | **Exponential backoff с jitter** | Vercel AI, Anthropic, LangChain | Adopt: retry-after headers + jitter |
| 9 | **Error code classification** | LangChain | Adopt: typed error codes |
| 10 | **Framework-agnostic core** | assistant-ui | Adopt: core без React зависимостей |
| 11 | **Component slot system** | assistant-ui, ai-chatbot | Adopt: message component overrides |
| 12 | **Thread list management** | assistant-ui | Adopt: ThreadList runtime |
| 13 | **Message branching** | assistant-ui | Consider: tree-structured conversations |
| 14 | **Reconnection support** | Vercel AI | Adopt: reconnectToStream() |
| 15 | **Lifecycle hooks (2 levels)** | OpenAI Agents | Adopt: global + per-session hooks |

---

## 4. Anti-patterns (что НЕ делать)

| # | Anti-pattern | Где встречается | Почему плохо |
|---|-------------|----------------|-------------|
| 1 | **String content model** | Старые API | Невозможно render reasoning, tools, sources отдельно |
| 2 | **Monolithic chat component** | CometChat, старые UI libs | Невозможно кастомизировать отдельные части |
| 3 | **Callback hell** | LangChain CallbackManager | Слишком много уровней вложенности |
| 4 | **Zustand/Redux для chat state** | Многие custom implementations | Over-engineering для простого use case, reactivity issues |
| 5 | **Привязка к одному provider** | Anthropic SDK, OpenAI SDK | Нет переключения между моделями |
| 6 | **Отсутствие error classification** | Vercel AI, assistant-ui | Невозможно автоматизировать retry/fallback |
| 7 | **Inline styled components** | Некоторые UI libs | Невозможно переопределить стили без `!important` |
| 8 | **Sync I/O для storage** | Наш текущий FileSessionStore | Блокирует event loop |
| 9 | **Silent error swallowing** | Vercel AI pruneMessages | Потеря информации без уведомления |
| 10 | **Смешение transport и business logic** | ai-chatbot | Невозможно заменить транспорт |

---

## 5. Ключевые выводы для архитектуры @witqq/chat-sdk

### Что adoptировать

1. **assistant-ui architectural model** — 3-tier (core → hooks → UI), parts-based messages, thread list management, per-part status. Это наш главный конкурент и reference architecture.

2. **Vercel AI SDK streaming protocol** — UIMessageChunk типы, transport abstraction с reconnection, lazy stream consumers.

3. **OpenAI Agents patterns** — Generic TContext, Session protocol simplicity, two-tier hooks, RunState для resumable operations.

4. **LangChain error system** — Error codes enum, `withRetry()/withFallbacks()` composition, namespace branding для safe instanceof.

### Наши конкурентные преимущества

1. **CLI backend integration** — Ни один конкурент не поддерживает Claude Code / Copilot CLI как backend. assistant-ui работает только с API SDKs.

2. **Built-in permission system** — У нас уже есть v3.1 permission system с scopes. Ни у кого нет аналога.

3. **Context window management** — Наш ContextWindowManager уже лучше всех конкурентов (они либо не имеют, либо имеют примитивный pruneMessages).

4. **Event bus с middleware** — ChatEventBus + TypedEventEmitter + middleware pipeline уже реализованы и мощнее аналогов.

### Gaps нашего текущего SDK

1. **Нет parts-based message model** — Все используют typed parts, мы используем flat string content
2. **Нет transport abstraction** — Нет ChatTransport interface
3. **Нет headless UI primitives** — Нет компонентной системы
4. **Нет thread list management** — Нет ThreadList runtime
5. **Нет tool approval state machine** — Нет approval flow
6. **Нет reconnection support** — Нет reconnectToStream()
7. **Session не disconnected от agent** — 1:1 coupling

---

## 6. Рекомендуемая архитектурная стратегия

На основе анализа 6 SDK рекомендуется **гибридная архитектура**:

| Уровень | Inspiration | Наша реализация |
|---------|-------------|----------------|
| **Core types** | assistant-ui message model + Vercel AI parts | Parts-based UIMessage с per-part status |
| **Session management** | assistant-ui ThreadList + OpenAI Session protocol | ThreadManager + SessionAdapter |
| **Streaming** | Vercel AI UIMessageChunk + Anthropic accumulator | Typed stream event union + message accumulator |
| **Transport** | Vercel AI ChatTransport | ChatTransport interface + HTTP/SSE/WS adapters |
| **Error handling** | LangChain error codes + Anthropic retry | Typed error codes + exponential backoff + jitter |
| **Tools** | assistant-ui Frontend/Backend/Human + Vercel AI approval | 3-type tool system + approval state machine |
| **React UI** | assistant-ui 3-tier model | Primitives → Styled → Slots |
| **Hooks** | OpenAI 2-tier | Global lifecycle + per-session hooks |
| **Storage** | OpenAI Session protocol simplicity | Simple adapter interface (InMemory, File, Custom) |
| **Backend integration** | Unique (наше преимущество) | CLI SDK adapters (Copilot, Claude, Vercel AI) |
