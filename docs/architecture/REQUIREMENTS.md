# Requirements — @witqq/chat-sdk

## Source

Task description + user answers + existing docs:
- docs/ARCHITECTURE-REVIEW.md (8 CRITICAL, 14 MAJOR)
- docs/chat-sdk/06-usecases-matrix.md (4 consumer projects analysis)
- docs/chat-sdk/ARCHITECTURE.md (previous architecture draft v3)

---

## Must-Have (блокирует релиз)

### M1: Session Management
**Как** разработчик чат-приложения **я хочу** управлять сессиями (создавать, переключать, восстанавливать) **чтобы** поддерживать множество разговоров в одном приложении.

**Acceptance criteria:**
- Создание новой сессии с уникальным ID
- Переключение между сессиями без пересоздания агента
- Восстановление сессии из хранилища после рестарта приложения
- Продолжение нативных CLI сессий (Claude Code, Copilot) если транскрипт ещё на диске
- Продолжение из сохранённой истории сообщений если нативная сессия удалена с диска
- State machine сессии: idle → active → ended + error states

### M2: Session Storage Adapters
**Как** разработчик **я хочу** сохранять сессии и сообщения через адаптеры хранения **чтобы** использовать БД своего приложения.

**Acceptance criteria:**
- InMemorySessionStore (для тестов/dev)
- FileSessionStore (JSON файлы)
- Интерфейс ISessionStore для кастомных адаптеров (SQLite, PostgreSQL, etc.)
- Сообщения хранятся отдельно от метаданных сессии (не O(n) на каждую операцию)
- Пагинация сообщений

### M3: Streaming Events
**Как** разработчик **я хочу** получать стриминг событий от AI **чтобы** показывать ответ в реальном времени.

**Acceptance criteria:**
- Единая модель событий поверх 3 бэкендов (Copilot/Claude/Vercel AI)
- text_delta, tool_call_start, tool_call_end, thinking_start, thinking_delta, thinking_end
- AsyncIterable + callback-based API
- AbortSignal для отмены
- Heartbeat / keep-alive

### M4: Context Window Management
**Как** разработчик **я хочу** автоматическое управление контекстным окном **чтобы** не получать context overflow.

**Acceptance criteria:**
- Token estimation (символьная + опциональная с tiktoken)
- Sliding window (system → summaries → recent messages)
- Auto-archival когда достигнут порог
- Emergency trim при overflow с retry
- Конфигурируемый бюджет токенов

### M5: Error Handling
**Как** разработчик **я хочу** типизированные ошибки с классификацией **чтобы** обрабатывать разные сценарии по-разному.

**Acceptance criteria:**
- classifyError() для маппинга raw provider errors
- NetworkError, AuthError, RateLimitError, TimeoutError, ContextOverflowError, ProviderError, ValidationError
- retryable flag + suggested delay
- Единая иерархия (все extends ChatSDKError extends AgentSDKError)
- Retry strategy (configurable: max retries, backoff)

### M6: React UI Components
**Как** разработчик **я хочу** готовые React компоненты для чата **чтобы** быстро создать UI.

**Acceptance criteria:**
- MessageList (auto-scroll, virtualization для больших историй)
- MessageBubble (markdown rendering, code highlighting)
- ChatInput (send/stop, multiline)
- ToolCallBlock (expandable, status indicator, custom renderer per tool)
- ThinkingBlock (collapsible, animated)
- ErrorDisplay (inline в чате)
- Headless-first: логика + a11y, стили опциональны
- Composable: каждый компонент отдельно, или собрать полный ChatWidget
- Кастомизируемые: рендер-пропсы или slots для замены частей

### M7: Provider/Model Management
**Как** разработчик **я хочу** переключаться между провайдерами и моделями **чтобы** дать пользователю выбор.

**Acceptance criteria:**
- ProviderRegistry — регистрация провайдеров (Copilot, Claude, Vercel AI, кастомные)
- listModels() для каждого провайдера
- Переключение модели per-session или per-call
- Auto token refresh для OAuth провайдеров

### M8: Tool System
**Как** разработчик **я хочу** определять серверные и фронтовые тулзы **чтобы** AI мог выполнять действия.

**Acceptance criteria:**
- ToolRegistry с серверными тулзами (Zod schema → execute on server)
- Фронтовые тулзы (execute в браузере, результат отправляется обратно)
- Tool permission management (per-tool approve/deny)
- Tool preference toggle (enable/disable)
- DI контекст (per-request: userId, sessionId, signal)

### M9: Event System & Middleware
**Как** разработчик **я хочу** перехватывать и обрабатывать все события SDK **чтобы** добавлять кастомную логику.

**Acceptance criteria:**
- ChatEventBus — подписка на все типы событий
- Middleware pipeline (перехват запросов, трансформация ответов)
- Перехватчики: onBeforeSend, onAfterReceive, onError, onToolCall
- Логирование всех событий (опциональное)

### M10: Transport Layer
**Как** разработчик **я хочу** стандартный транспорт для стриминга к фронтенду **чтобы** не писать свой SSE/WebSocket.

**Acceptance criteria:**
- Server-side SSE writer (AgentEvent → Data Stream Protocol)
- Client-side transport (SSE reader → ChatEvent)
- Reconnection handling с восстановлением
- WebSocket альтернатива (для NATS-подобных сценариев)
- In-process transport (для monolith)

### M11: Permission UI
**Как** разработчик **я хочу** готовые UI компоненты для permission requests **чтобы** пользователь мог одобрять действия агента.

**Acceptance criteria:**
- PermissionPrompt компонент (Allow Once / Allow Always / Deny)
- Inline в потоке чата
- Интеграция с IPermissionStore из agent-sdk

---

## Should-Have (плохой DX без них)

### S1: Chat List/Sidebar
Готовый компонент списка чатов с поиском, группировкой, удалением.

### S2: Model Selector UI
Компонент выбора провайдера/модели с tier badges и fallback.

### S3: Usage/Quota Meter
Компонент показа использования токенов / контекстного окна.

### S4: Transcript Parsing
Парсинг транскриптов Claude Code и Copilot для импорта истории.

### S5: AskUser Support
UI компонент для ask_user запросов агента (кнопки, чекбоксы, текст).

### S6: AgentService Caching
Pool/registry для кэширования IAgentService с eviction strategy.

### S7: Type-Only Exports
`@witqq/agent-sdk/types` entry point без runtime зависимостей.

---

## Nice-to-Have

### N1: Floating/Docked Chat Widget
Overlay/docked виджет для встраивания чата в существующее приложение.

### N2: Content Moderation
Опциональная проверка контента перед отправкой.

### N3: Rate Limiting
Client-side rate limiting для предотвращения спама.

### N4: E2E Test Markers
Bypass LLM для интеграционных тестов.

---

## Constraints

- **Опциональность:** Все модули tree-shakeable. Можно использовать только sessions без UI, или только UI без storage.
- **Зависимости:** Минимум peer deps. Core = 0 npm deps. React = peer dep react.
- **API stability:** Можно ломать всё в угоду красивого API (пользователь одобрил).
- **Runtime:** Node.js only (серверная часть). React 18+ (UI часть).
- **Storage:** InMemory и File из коробки. SQLite через кастомный адаптер.
- **Framework:** React only для UI компонентов.
- **Отношение к agent-sdk:** Extends, not replaces. agent-sdk = бэкенды и тулзы. chat-sdk = сессии, хранение, UI, транспорт.
