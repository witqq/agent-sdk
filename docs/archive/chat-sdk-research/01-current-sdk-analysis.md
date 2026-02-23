# @witqq/agent-sdk — Полный анализ SDK

## 1. Обзор проекта

**Что это:** Универсальный абстрактный слой для AI-агентов. npm-пакет, предоставляющий единый интерфейс для работы с тремя разными LLM-бэкендами.

**npm package:** `@witqq/agent-sdk`
**Версия:** `0.6.1`
**Лицензия:** MIT
**Node.js:** `>=18`
**TypeScript:** strict mode, target ES2022, moduleResolution bundler

**Назначение:** Позволяет писать код агента один раз и запускать его через Copilot CLI, Claude CLI или Vercel AI SDK (любой OpenAI-compatible API). Абстрагирует различия в tool mapping, permission handling, streaming events и session management.

**Ключевая идея архитектуры:**
- CLI-бэкенды (Copilot, Claude) — сами являются runtime агента; SDK отправляет промпт и получает события
- API-бэкенд (Vercel AI) — SDK сам управляет tool loop через `generateText()`/`streamText()`

---

## 2. Архитектура

### Entry Points (package exports)

```
@witqq/agent-sdk           → src/index.ts        (типы, registry, factory, permission store, utils)
@witqq/agent-sdk/copilot   → src/backends/copilot.ts
@witqq/agent-sdk/claude    → src/backends/claude.ts
@witqq/agent-sdk/vercel-ai → src/backends/vercel-ai.ts
@witqq/agent-sdk/auth      → src/auth/index.ts    (CopilotAuth, ClaudeAuth, token types)
```

Каждый export имеет ESM (`.js`) и CJS (`.cjs`) варианты с `.d.ts`/`.d.cts` декларациями. Сборка через tsup.

### Модульная структура

```
src/
├── index.ts               — Public API re-exports
├── types.ts               — Все публичные типы и интерфейсы
├── base-agent.ts          — Абстрактный BaseAgent с lifecycle
├── registry.ts            — Реестр бэкендов, фабрика createAgentService
├── errors.ts              — Иерархия ошибок (AgentSDKError → *)
├── permission-store.ts    — IPermissionStore + InMemory/File/Composite реализации
├── backends/
│   ├── copilot.ts         — Copilot CLI backend (~924 строки)
│   ├── claude.ts          — Claude CLI backend (~1127 строк)
│   └── vercel-ai.ts       — Vercel AI SDK backend (~708 строк)
├── auth/
│   ├── types.ts           — AuthToken, DeviceFlowResult, OAuthFlowResult, ошибки
│   ├── index.ts           — Re-exports
│   ├── copilot-auth.ts    — GitHub Device Flow
│   └── claude-auth.ts     — OAuth + PKCE
└── utils/
    ├── schema.ts          — zodToJsonSchema (Zod v3/v3.24/v4 совместимость)
    └── messages.ts        — messagesToPrompt, contentToText, buildSystemPrompt
```

### Dependency Graph

```
index.ts ──→ types.ts
         ──→ errors.ts
         ──→ registry.ts ──→ types.ts, errors.ts
         ──→ base-agent.ts ──→ types.ts, errors.ts
         ──→ permission-store.ts ──→ types.ts
         ──→ utils/schema.ts
         ──→ utils/messages.ts ──→ types.ts

backends/copilot.ts ──→ types.ts, base-agent.ts, errors.ts, utils/schema.ts
backends/claude.ts  ──→ types.ts, base-agent.ts, errors.ts, utils/schema.ts
backends/vercel-ai.ts ──→ types.ts, base-agent.ts, errors.ts, utils/schema.ts, permission-store.ts
```

Бэкенды загружаются **лениво** через dynamic `import()` в registry.ts — tree-shaking friendly.

---

## 3. Ключевые типы и интерфейсы

### Примитивные типы

| Тип | Определение |
|---|---|
| `JSONValue` | `string \| number \| boolean \| null \| JSONValue[] \| { [key: string]: JSONValue }` |
| `MessageContent` | `string \| Array<ContentPart>` |
| `ContentPart` | `{ type: "text"; text: string } \| { type: "image"; data: string; mimeType: string }` |
| `AgentState` | `"idle" \| "running" \| "streaming" \| "disposed"` |
| `PermissionScope` | `"once" \| "session" \| "project" \| "always"` |

### ToolDeclaration / ToolDefinition

```typescript
interface ToolDeclaration<TParams = unknown> {
  name: string;
  description: string;
  parameters: z.ZodType<TParams>;      // Zod schema для параметров
  needsApproval?: boolean;              // Требует одобрения пользователя
  metadata?: {
    category?: string;
    icon?: string;
    tags?: string[];
  };
}

interface ToolDefinition<TParams = unknown> extends ToolDeclaration<TParams> {
  execute: (params: TParams) => Promise<JSONValue> | JSONValue;
}
```

**Ключевое различие:** `ToolDeclaration` — только схема (что LLM видит). `ToolDefinition` — с функцией execute. CLI-бэкенды используют declaration для LLM + execute map внутренне. API-бэкенд (Vercel) передаёт execute напрямую.

### ToolCall / ToolResult

```typescript
interface ToolCall {
  id: string;
  name: string;
  args: JSONValue;
}

interface ToolResult {
  toolCallId: string;
  name: string;
  result: JSONValue;
  isError?: boolean;
}
```

### Message (Discriminated Union)

```typescript
type Message =
  | { role: "user"; content: MessageContent }
  | { role: "assistant"; content: MessageContent; toolCalls?: ToolCall[] }
  | { role: "tool"; content?: string; toolResults: ToolResult[] }
  | { role: "system"; content: string };
```

### Permission System

```typescript
interface PermissionRequest {
  toolName: string;
  toolArgs: Record<string, unknown>;
  suggestedScope?: PermissionScope;      // Подсказка от SDK (Claude)
  rawSDKRequest?: unknown;               // Оригинальный запрос SDK
}

interface PermissionDecision {
  allowed: boolean;
  scope?: PermissionScope;               // Как долго помнить решение
  modifiedInput?: Record<string, unknown>; // Изменённые аргументы
  reason?: string;                        // Причина отказа
}

type PermissionCallback = (
  request: PermissionRequest,
  signal: AbortSignal,
) => Promise<PermissionDecision>;
```

### User Input (Ask User)

```typescript
interface UserInputRequest {
  question: string;
  choices?: string[];
  allowFreeform?: boolean;   // default: true
}

interface UserInputResponse {
  answer: string;
  wasFreeform: boolean;
  selectedChoiceIndex?: number;
}
```

### SupervisorHooks

```typescript
interface SupervisorHooks {
  onPermission?: PermissionCallback;
  onAskUser?: (
    request: UserInputRequest,
    signal: AbortSignal,
  ) => Promise<UserInputResponse>;
}
```

### StructuredOutputConfig

```typescript
interface StructuredOutputConfig<T = unknown> {
  schema: z.ZodType<T>;
  name?: string;
  description?: string;
}
```

### UsageData

```typescript
interface UsageData {
  promptTokens: number;
  completionTokens: number;
  model?: string;
  backend?: string;
}
```

### AgentEvent (Streaming Events — discriminated union)

```typescript
type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "tool_call_start"; toolCallId: string; toolName: string; args: JSONValue }
  | { type: "tool_call_end"; toolCallId: string; toolName: string; result: JSONValue }
  | { type: "permission_request"; request: PermissionRequest }
  | { type: "permission_response"; toolName: string; decision: PermissionDecision }
  | { type: "ask_user"; request: UserInputRequest }
  | { type: "ask_user_response"; answer: string }
  | { type: "thinking_start" }
  | { type: "thinking_end" }
  | { type: "usage_update"; promptTokens: number; completionTokens: number; model?: string; backend?: string }
  | { type: "session_info"; sessionId: string; transcriptPath?: string; backend: string }
  | { type: "heartbeat" }
  | { type: "error"; error: string; recoverable: boolean }
  | { type: "done"; finalOutput: string | null; structuredOutput?: unknown }
```

**15 типов событий.** Охватывают: текст, thinking/reasoning, tool calls, permissions, user interaction, usage, session info, heartbeat, errors, completion.

### RunOptions

```typescript
interface RunOptions {
  signal?: AbortSignal;
  context?: Record<string, unknown>;
}
```

### AgentConfig

```typescript
interface AgentConfig {
  model?: string;
  modelParams?: ModelParams;
  systemPrompt: string;
  tools: ToolDefinition[];
  supervisor?: SupervisorHooks;
  maxTurns?: number;
  timeout?: TimeoutConfig;
  errorHandling?: ErrorHandlingConfig;
  permissionStore?: IPermissionStore;
  systemMessageMode?: "append" | "replace";   // default: "append"
  availableTools?: string[];                   // фильтр built-in tools
  onUsage?: (usage: UsageData) => void;        // fire-and-forget callback
  heartbeatInterval?: number;                  // ms, для keep-alive
  sessionMode?: "per-call" | "persistent";     // default: "per-call"
  providerOptions?: Record<string, Record<string, unknown>>;  // passthrough
}
```

### ModelParams

```typescript
interface ModelParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}
```

### TimeoutConfig

```typescript
interface TimeoutConfig {
  total?: number;        // Max time for entire agent run (ms)
  perTool?: number;      // Max time for a single tool execution (ms)
  perLLMRequest?: number; // Max time for a single LLM request (ms)
}
```

### ErrorHandlingConfig

```typescript
interface ErrorHandlingConfig {
  onToolError?: "fail" | "continue" | "ask-llm";
  retryLLM?: { maxAttempts: number; backoffMs: number };
  onError?: (error: Error, context: { phase: "tool" | "llm" | "permission" | "ask-user" }) => void;
}
```

### AgentResult

```typescript
interface AgentResult<T = void> {
  output: string | null;
  structuredOutput: T extends void ? undefined : T;
  toolCalls: Array<{
    toolName: string;
    args: JSONValue;
    result: JSONValue;
    approved: boolean;
  }>;
  messages: Message[];
  usage?: UsageData;
}
```

### IAgent

```typescript
interface IAgent {
  readonly sessionId: string | undefined;
  run(prompt: MessageContent, options?: RunOptions): Promise<AgentResult>;
  runWithContext(messages: Message[], options?: RunOptions): Promise<AgentResult>;
  runStructured<T>(prompt: MessageContent, schema: StructuredOutputConfig<T>, options?: RunOptions): Promise<AgentResult<T>>;
  stream(prompt: MessageContent, options?: RunOptions): AsyncIterable<AgentEvent>;
  streamWithContext(messages: Message[], options?: RunOptions): AsyncIterable<AgentEvent>;
  abort(): void;
  interrupt(): Promise<void>;
  getState(): AgentState;
  getConfig(): Readonly<AgentConfig>;
  dispose(): void;
}
```

### IAgentService

```typescript
interface ModelInfo {
  id: string;
  name?: string;
  provider?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface IAgentService {
  readonly name: string;
  createAgent(config: AgentConfig): IAgent;
  listModels(): Promise<ModelInfo[]>;
  validate(): Promise<ValidationResult>;
  dispose(): Promise<void>;
}
```

### Backend Options

```typescript
interface CopilotBackendOptions {
  cliPath?: string;
  workingDirectory?: string;
  githubToken?: string;
  useLoggedInUser?: boolean;
  cliArgs?: string[];
  timeout?: number;                          // sendAndWait timeout (ms)
  env?: Record<string, string | undefined>;  // custom env vars
}

interface ClaudeBackendOptions {
  cliPath?: string;
  workingDirectory?: string;
  maxTurns?: number;
  oauthToken?: string;                       // CLAUDE_CODE_OAUTH_TOKEN
  env?: Record<string, string | undefined>;
}

interface VercelAIBackendOptions {
  apiKey: string;
  provider?: string;     // default: "openrouter"
  baseUrl?: string;      // default: "https://openrouter.ai/api/v1"
}
```

### Type Guards (экспортируемые функции)

```typescript
function isToolDefinition(tool: ToolDeclaration): tool is ToolDefinition
function isTextContent(content: MessageContent): content is string
function isMultiPartContent(content: MessageContent): content is ContentPart[]
function getTextContent(content: MessageContent): string
```

---

## 4. BaseAgent

### State Machine

```
idle ──→ running ──→ idle
idle ──→ streaming ──→ idle
idle ──→ disposed (terminal)
any ──→ disposed (via dispose())
```

### Lifecycle

1. **Constructor:** Принимает `AgentConfig`, замораживает через `Object.freeze()`
2. **run/runWithContext:** Ставит state `running`, вызывает `executeRun()`, возвращает в `idle`
3. **runStructured:** Аналогично, вызывает `executeRunStructured()`
4. **stream/streamWithContext:** Ставит state `streaming`, вызывает `executeStream()`, yield'ит events
5. **dispose:** Вызывает `abort()`, ставит state `disposed`

### Re-entrancy Guard

`guardReentrancy()` — бросает `ReentrancyError` если state уже `running` или `streaming`. Вызывается перед каждой операцией.

### Disposed Guard

`guardDisposed()` — бросает `DisposedError` если state `disposed`.

### Abort

- `abort()`: Вызывает `abortController.abort()`
- `interrupt()`: По умолчанию = `abort()`. Бэкенды переопределяют (Copilot: `session.abort()`, Claude: `query.interrupt()`)
- `createAbortController()`: Создаёт внутренний `AbortController`, связывает с внешним `signal` из `RunOptions`
- `checkAbort()`: Бросает `AbortError` если signal уже aborted

### Usage Enrichment

`enrichAndNotifyUsage()` — после `executeRun()` добавляет `model` и `backend` к usage, вызывает `onUsage` callback (fire-and-forget).

`enrichStream()` — async generator wrapper, обогащает `usage_update` события model/backend.

### Heartbeat

`heartbeatStream()` — Wrapper для stream. При настроенном `heartbeatInterval` использует `Promise.race()` между следующим event и timer. Если timer побеждает — yield `{ type: "heartbeat" }`.

### Абстрактные методы (реализуются бэкендами)

```typescript
abstract executeRun(messages, options, signal): Promise<AgentResult>
abstract executeRunStructured<T>(messages, schema, options, signal): Promise<AgentResult<T>>
abstract executeStream(messages, options, signal): AsyncIterable<AgentEvent>
```

Плюс абстрактное поле `backendName: string`.

---

## 5. Бэкенды

### 5.1 Copilot Backend (`src/backends/copilot.ts`)

**SDK:** `@github/copilot-sdk` (optional peer dep, `^0.1.22`)

**Архитектура:** CLI-based. `CopilotAgentService` создаёт и кэширует `CopilotClient`. `CopilotAgent` создаёт sessions через клиент.

#### Инициализация клиента (`ensureClient()`)
- Lazy init с кэшированием через promise (повторные вызовы получают тот же promise)
- `client.start()` → `client.getAuthStatus()` → если не authenticated, `client.stop()` + throw
- При ошибке: promise очищается (`clientPromise = null`), следующий вызов создаст новый

#### Session modes
- **per-call** (default): Каждый `run()`/`stream()` создаёт новый session и destroy'ит после
- **persistent**: Один session переиспользуется. `streaming: true` всегда. Session destroy при `dispose()` или ошибке

#### `getOrCreateSession(streaming)`
- persistent + existing session → возврат existing
- иначе → `client.createSession(config)` с tools, model, systemMessage, permissions, user input handler

#### Tool Mapping (`mapToolsToSDK()`)
- `ToolDefinition[]` → SDK `Tool[]`
- Parameters: Zod schema передаётся напрямую (SDK принимает ZodSchema)
- Handler: `tool.execute(args)` → string result (или `JSON.stringify()`)

#### Permission Handling (`buildPermissionHandler()`)
- Если `onPermission` не задан → auto-approve (headless safety)
- Проверяет `permissionStore.isApproved()` → если да, skip callback
- Маппинг: `PermissionRequest` → unified request → callback → `SDKPermissionResult`

#### User Input Handling (`buildUserInputHandler()`)
- Если `onAskUser` не задан → auto-answer "Complete the task autonomously" (headless safety)
- Маппинг: SDK request → unified → callback → response

#### Event Mapping (`mapSessionEvent()`)

| SDK Event Type | → AgentEvent |
|---|---|
| `assistant.message_delta` | `text_delta` |
| `assistant.reasoning` / `assistant.reasoning_delta` | `thinking_start` + `thinking_delta` |
| `tool.execution_start` | `tool_call_start` |
| `tool.execution_complete` | `tool_call_end` |
| `assistant.usage` | `usage_update` |
| `session.error` | `error` |
| `assistant.message` | `done` |

**ToolCallTracker:** Маппит `toolCallId → { toolName, args }`. Нужен потому что `tool.execution_complete` не содержит `toolName`.

**ThinkingTracker:** Отслеживает состояние thinking блока. SDK не имеет явного "reasoning end" — детекция через первый не-reasoning event. Дублированные reasoning events (SDK replays) фильтруются через `isCompleted()`.

#### Structured Output
Prompt augmentation: добавляет JSON Schema инструкцию к последнему user message. Парсинг: regex для ```json``` блоков → `JSON.parse()` → `schema.parse()`.

#### executeRun
- `session.sendAndWait()` с опциональным timeout
- Подписка на session events для сбора toolCalls и usage
- При persistent mode: только последний user prompt (history нативно в session)

#### executeStream
- `session.send()` + event queue (push/waitForItem pattern)
- Emit `session_info` при новой сессии
- Слушает `session.idle` для завершения, `session.error` для ошибок

#### Interrupt
- `session.abort()` (graceful) + `abort()` (signal)

#### Dispose
- Destroy persistent session + `super.dispose()`

---

### 5.2 Claude Backend (`src/backends/claude.ts`)

**SDK:** `@anthropic-ai/claude-agent-sdk` (optional peer dep, `>=0.2.0`)

**Архитектура:** CLI-based. `ClaudeAgentService` создаёт `ClaudeAgent`. Каждый agent вызывает `sdk.query()` — AsyncGenerator SDKMessage.

#### Tool Mapping (MCP-based)
Tools передаются через MCP server pattern:
- `buildMcpServer()` → `sdk.createSdkMcpServer()` с tools
- Tool names: `mcp__agent-sdk-tools__<toolName>` prefix
- `stripMcpPrefix()` нормализует имена во всех tool events
- Input schema: предпочитает `.shape` из ZodObject, fallback на `zodToJsonSchema()`
- `allowedTools` автоматически расширяется MCP tool именами

#### Permission Handling (`buildCanUseTool()`)
- Маппинг SDK suggestions → unified `PermissionScope`:
  - `session`, `cliArg` → `"session"`
  - `projectSettings`, `localSettings` → `"project"`
  - `userSettings` → `"always"`
- Reverse маппинг scope → destination для `updatedPermissions`
- `permissionStore` проверяется первым
- `modifiedInput` и `updatedPermissions` передаются обратно в SDK

#### Event Mapping (`mapSDKMessage()`)

| SDK Message Type | → AgentEvent |
|---|---|
| `assistant` (с content blocks) | `tool_call_start` (для tool_use блоков) |
| `tool_use_summary` | `tool_call_end` |
| `stream_event` → `content_block_delta` (text) | `text_delta` |
| `stream_event` → `content_block_start` (thinking) | `thinking_start` |
| `stream_event` → `content_block_delta` (thinking index) | `thinking_delta` |
| `stream_event` → `content_block_stop` (thinking index) | `thinking_end` |
| `tool_progress` | `null` (heartbeat, ignored) |
| `result` (success) | `usage_update` |
| `result` (error) | `error` |

**ClaudeToolCallTracker:** FIFO-очередь по toolName для корреляции start/end событий (поддержка параллельных вызовов одного tool).

**`thinkingBlockIndices` (Set<number>):** Отслеживает индексы content block'ов типа "thinking" чтобы правильно маппить `content_block_delta` как `thinking_delta` вместо `text_delta`.

#### Session modes
- **per-call** (default): Каждый query — новый
- **persistent**: `persistSession: true` + `resume: sessionId` на последующих вызовах
- `clearPersistentSession()`: Очистка при ошибках

#### Structured Output
Claude SDK имеет нативную поддержку через `outputFormat: { type: "json_schema", schema }`. Парсинг: `r.structured_output` (нативный) → fallback JSON.parse result → fallback regex ```json``` блоков.

#### executeRun
- `sdk.query({ prompt, options })` → iterate AsyncGenerator
- toolResultCapture Map для сбора результатов tool calls
- Back-fill tool results из capture map при `tool_use_summary` или `result`

#### executeStream
- Аналогично, но yield'ит mapped events
- Emit `session_info` + `done` на `result.success`

#### Interrupt
- `query.interrupt()` (graceful) → `abort()` (signal)

#### onAskUser
**НЕ ПОДДЕРЖИВАЕТСЯ.** Warning в constructor если задан.

#### listModels
- Запрос к `https://api.anthropic.com/v1/models` с OAuth token
- Требует `anthropic-beta: oauth-2025-04-20` header
- Кэширование результата

---

### 5.3 Vercel AI Backend (`src/backends/vercel-ai.ts`)

**SDK:** `ai` (>=4.0.0) + `@ai-sdk/openai-compatible` (>=2.0.0), optional peer deps

**Архитектура:** API-based. Нет subprocess — чистые HTTP-вызовы. SDK управляет tool loop.

**Defaults:**
- Base URL: `https://openrouter.ai/api/v1`
- Provider: `openrouter`
- Default model: `anthropic/claude-sonnet-4-5`
- Max turns: 10

#### Model Creation
- `loadCompat()` → `createOpenAICompatible()` → `provider.chatModel(modelId)`
- Model кэшируется в инстансе

#### Tool Mapping (`mapToolsToSDK()`)
- `ToolDefinition[]` → `Record<string, SDKToolDefinition>` через `sdk.tool()`
- Input schema: `zodToJsonSchema()` → `sdk.jsonSchema()` (JSON Schema wrapping)
- `wrapToolExecute()`: Permission check → `tool.execute()` → error wrapping
- **ask_user tool:** Если `supervisor.onAskUser` задан, автоматически инжектируется tool `ask_user` с description "Ask the user a question"

#### Permission Check (`wrapToolExecute()`)
- Проверка: `permissionStore.isApproved()` → `sessionApprovals.has()` → callback
- `sessionApprovals` Set<string> — in-memory per-agent approvals
- `modifiedInput` поддержка
- `ToolExecutionError` при отказе или ошибке выполнения

#### Event Mapping (`mapStreamPart()`)

| SDK Stream Part | → AgentEvent |
|---|---|
| `text-delta` | `text_delta` |
| `tool-call` | `tool_call_start` |
| `tool-result` | `tool_call_end` |
| `tool-error` | `error` (recoverable: true) |
| `reasoning-start` | `thinking_start` |
| `reasoning-end` | `thinking_end` |
| `reasoning-delta` | `thinking_delta` |
| `finish-step` | `usage_update` |
| `error` | `error` (recoverable: false) |

#### executeRun
- `sdk.generateText()` с `stopWhen: sdk.stepCountIs(maxTurns)` для multi-step tool loop
- Собирает toolCalls из всех steps
- Output: только текст последнего step (intermediate reasoning отбрасывается)
- `providerOptions` passthrough (e.g. Google thinking config)

#### executeRunStructured
- `sdk.generateObject()` с Zod schema → `sdk.jsonSchema()`
- Нативная валидация SDK + fallback через `schema.parse()`

#### executeStream
- `sdk.streamText()` с fullStream AsyncIterable
- Intermediate text reset при `finish-step` с `finishReason: "tool-calls"`
- `totalUsage` await в конце
- Emit `done` с finalOutput

#### listModels
- Fetch `{baseUrl}/models` → parse `{ data: [{ id }] }`
- Returns `[]` при ошибке

#### onAskUser
Поддерживается через инжектированный `ask_user` tool.

---

## 6. Auth

### CopilotAuth (`src/auth/copilot-auth.ts`)

**Протокол:** GitHub Device Flow (OAuth 2.0 Device Authorization Grant)

**Client ID:** `Ov23ctDVkRmgkPke0Mmm`
**Scopes:** `read:user,read:org,repo,gist`

**Поток:**
1. `startDeviceFlow()` → POST `github.com/login/device/code` → `{ userCode, verificationUrl, waitForToken() }`
2. Пользователь открывает URL, вводит code
3. `waitForToken()` — polling POST `github.com/login/oauth/access_token` с интервалом
   - `authorization_pending` → продолжать
   - `slow_down` → увеличить interval
   - `expired_token` → throw `DeviceCodeExpiredError`
   - `access_denied` → throw `AccessDeniedError`
   - success → fetch `/user` для login → return `CopilotAuthToken`

**DI:** `fetch` через constructor для тестирования.

### ClaudeAuth (`src/auth/claude-auth.ts`)

**Протокол:** OAuth 2.0 Authorization Code + PKCE (S256)

**Client ID:** `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
**Authorize URL:** `https://claude.ai/oauth/authorize`
**Token URL:** `https://platform.claude.com/v1/oauth/token`
**Default Redirect URI:** `https://platform.claude.com/oauth/code/callback`
**Default Scopes:** `user:profile user:inference user:sessions:claude_code user:mcp_servers`

**Поток:**
1. `startOAuthFlow()` → генерирует PKCE code verifier (96 random bytes, base64) + state (16 bytes, hex) → authorize URL с code_challenge
2. Пользователь открывает URL, авторизуется
3. `completeAuth(codeOrUrl)` → exchange code + code_verifier → `ClaudeAuthToken`
4. `refreshToken(refreshToken)` → POST token URL → new `ClaudeAuthToken`

**`extractCode(input)`:** Static метод. Принимает raw code или полный redirect URL с query params.

**DI:** `fetch` + `randomBytes` через constructor.

### Auth Token Types

```typescript
interface AuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  obtainedAt: number;
}

interface CopilotAuthToken extends AuthToken {
  login?: string;
}

interface ClaudeAuthToken extends AuthToken {
  refreshToken: string;
  scopes: string[];
}
```

### Auth Errors

```
AuthError (base)
├── DeviceCodeExpiredError
├── AccessDeniedError
└── TokenExchangeError
```

---

## 7. Permission System

### IPermissionStore

```typescript
interface IPermissionStore {
  isApproved(toolName: string): Promise<boolean>;
  approve(toolName: string, scope: PermissionScope): Promise<void>;
  revoke(toolName: string): Promise<void>;
  clear(): Promise<void>;
  dispose(): Promise<void>;
}
```

### InMemoryPermissionStore

- `Map<string, PermissionScope>` в памяти
- `scope: "once"` → не персистируется (return без записи)
- Lifetime: до process exit или dispose

### FilePermissionStore

- JSON файл на диске: `{ approvals: { [toolName]: { scope, timestamp } } }`
- Atomic writes: tmp file → `fs.renameSync()`
- `scope: "once"` → не записывается
- Пути: `{projectDir}/.agent-sdk/permissions.json` или `~/.agent-sdk/permissions.json`

### CompositePermissionStore

Трёхуровневая композиция:

| Scope | Store | Persistence |
|---|---|---|
| `session` | sessionStore (InMemory) | До конца процесса |
| `project` | projectStore (File) | Файл в директории проекта |
| `always` | userStore (File) | Файл в home директории |

- `isApproved()`: проверяет все три store по порядку (OR)
- `approve()`: роутит по scope в нужный store
- `revoke()` / `clear()`: все три store

### `createDefaultPermissionStore(projectDir?)`

Фабрика создаёт `CompositePermissionStore` с:
- `sessionStore`: `InMemoryPermissionStore`
- `projectStore`: `FilePermissionStore` → `{cwd}/.agent-sdk/permissions.json`
- `userStore`: `FilePermissionStore` → `~/.agent-sdk/permissions.json`

---

## 8. Registry

### Типы

```typescript
type BackendFactory<TOptions = unknown> = (options: TOptions) => IAgentService | Promise<IAgentService>;

interface BackendOptionsMap {
  copilot: CopilotBackendOptions;
  claude: ClaudeBackendOptions;
  "vercel-ai": VercelAIBackendOptions;
}

type BuiltinBackendName = keyof BackendOptionsMap; // "copilot" | "claude" | "vercel-ai"
```

### Функции

| Функция | Назначение |
|---|---|
| `registerBackend(name, factory)` | Регистрация custom бэкенда. Throws `BackendAlreadyRegisteredError` если уже есть |
| `unregisterBackend(name)` | Удаление (для тестов). Returns boolean |
| `hasBackend(name)` | Проверка (включая built-in) |
| `listBackends()` | Список всех (registered + built-in) |
| `resetRegistry()` | Очистка (для тестов) |
| `createAgentService(name, options)` | Type-safe фабрика с overloads |

### Lazy Loading

Built-in бэкенды загружаются через dynamic `import()` при первом вызове `createAgentService()`. Результат кэшируется в registry.

```typescript
// Overloaded signatures для type safety
function createAgentService<K extends BuiltinBackendName>(name: K, options: BackendOptionsMap[K]): Promise<IAgentService>;
function createAgentService(name: string, options: unknown): Promise<IAgentService>;
```

Порядок: custom registry → built-in lazy load → `BackendNotFoundError`.

---

## 9. Utils

### zodToJsonSchema (`src/utils/schema.ts`)

Конвертация Zod schema → JSON Schema. Три стратегии детекции:

1. **Zod v4:** `schema.toJSONSchema()` (нативный)
2. **Zod v3.24+:** `schema.jsonSchema()` (нативный)
3. **Zod v3 legacy:** `_def.typeName` extraction (ручной маппинг)

Legacy маппинг поддерживает: `ZodString`, `ZodNumber`, `ZodBoolean`, `ZodNull`, `ZodArray`, `ZodObject`, `ZodOptional`, `ZodEnum`. Остальные → `{}`.

### messagesToPrompt (`src/utils/messages.ts`)

`Message[]` → flat string. Все роли конвертируются в plain text через `getTextContent()`, объединяются через `\n\n`.

### contentToText

`MessageContent` → string. Wrapper над `getTextContent()`.

### buildSystemPrompt

Конкатенация base system prompt + optional schema instruction через `\n\n`.

---

## 10. Что покрыто / Что НЕ покрыто

### ✅ Реализовано

| Категория | Детали |
|---|---|
| **3 бэкенда** | Copilot CLI, Claude CLI, Vercel AI (OpenAI-compatible) |
| **Tool system** | Declaration/Definition split, Zod schemas, execute functions |
| **Permission system v3.1** | 4 scopes, 3 store implementations, composite routing |
| **Streaming** | AsyncIterable<AgentEvent>, 15 event types |
| **Structured output** | Zod schema validation, native (Claude/Vercel) + prompt augmentation (Copilot) |
| **Session management** | per-call + persistent modes для CLI бэкендов |
| **Auth** | GitHub Device Flow (Copilot), OAuth+PKCE (Claude) |
| **Abort/Interrupt** | AbortSignal linking, graceful interrupt per backend |
| **Re-entrancy guard** | Concurrent run protection |
| **Usage tracking** | Token counting, model/backend enrichment, onUsage callback |
| **Heartbeat** | Configurable interval, keep-alive для длинных tool executions |
| **Thinking/Reasoning** | Start/delta/end events для всех бэкендов |
| **Error hierarchy** | 8 typed error classes |
| **Zod compatibility** | v3.23+, v3.24+, v4.x |
| **Lazy loading** | Built-in backends via dynamic import |
| **Multi-part content** | Text + Image parts в MessageContent |
| **Custom backends** | registerBackend() API |

### ❌ НЕ реализовано / Отсутствует

| Категория | Статус |
|---|---|
| **UI компоненты** | Нет. Чистый backend SDK без React/UI |
| **Транскрипты/логирование** | Только `session_info` event с путём к файлу. Нет SDK-уровневого transcript storage |
| **Storage adapters** | Только Permission store. Нет generic key-value store, нет conversation history storage |
| **Context management** | Нет built-in context window management, token counting, truncation |
| **Token storage (auth)** | Auth providers возвращают токены, но НЕ хранят их. Ответственность приложения |
| **Multi-agent orchestration** | Нет agent-to-agent communication, нет workflow engine |
| **Middleware/Plugins** | Нет middleware chain для обработки events или tool calls |
| **Rate limiting** | Нет built-in rate limiter для API calls |
| **Caching** | Нет response caching, нет tool result caching |
| **Timeout enforcement** | `TimeoutConfig` объявлен в типах, но **НЕ реализован** в бэкендах (кроме Copilot sendAndWait timeout) |
| **ErrorHandling enforcement** | `ErrorHandlingConfig` объявлен (`onToolError`, `retryLLM`), но **НЕ реализован** в base-agent или бэкендах |
| **stopSequences** | Объявлен в `ModelParams`, но **НЕ передаётся** ни в один бэкенд |
| **Image content** | `ContentPart` type "image" определён, но **НЕ обрабатывается** бэкендами (все используют `getTextContent()`) |
| **runWithContext + structured** | Нет `runStructuredWithContext()` — structured output только с single prompt |
| **Tool metadata** | `metadata` field в `ToolDeclaration` (category, icon, tags) определён, но **НЕ используется** бэкендами |
| **Permission events в stream** | `permission_request` и `permission_response` events определены, но **НЕ emit'ятся** из бэкендов |
| **ask_user events в stream** | `ask_user` и `ask_user_response` events определены, но **НЕ emit'ятся** (кроме как через injected tool в Vercel AI) |

---

## 11. Зависимости

### Peer Dependencies (required)

| Package | Version | Назначение |
|---|---|---|
| `zod` | `^3.23.0 \|\| ^4.0.0` | Schema definition для tools и structured output |

### Peer Dependencies (optional)

| Package | Version | Назначение |
|---|---|---|
| `@github/copilot-sdk` | `^0.1.22` | Copilot CLI backend |
| `@anthropic-ai/claude-agent-sdk` | `>=0.2.0` | Claude CLI backend |
| `ai` | `>=4.0.0` | Vercel AI SDK (generateText, streamText, generateObject) |
| `@ai-sdk/openai-compatible` | `>=2.0.0` | OpenAI-compatible provider для Vercel AI |

### Dev Dependencies

| Package | Version |
|---|---|
| `typescript` | `^5.8.0` |
| `tsup` | `^8.4.0` |
| `vitest` | `^4.0.18` |
| `@types/node` | `^25.2.1` |
| `testfold` | `^0.2.1` |

Все optional peer deps также в devDependencies для тестирования.

### Ключевые архитектурные решения по зависимостям

1. **Zod — единственная required peer dep.** Все бэкенды опциональны.
2. **Бэкенды загружаются лениво.** Если `@github/copilot-sdk` не установлен, Copilot backend просто бросит `SubprocessError`/`DependencyError` при первом использовании.
3. **Локальные type definitions.** Каждый бэкенд определяет local interfaces (`SDKClient`, `SDKSession`, `SDKQuery` и т.д.) вместо импорта из SDK. Это позволяет компилировать без установленных peer deps.
4. **Test injection pattern.** `_injectSDK()` / `_resetSDK()` в каждом бэкенде для мокирования SDK в unit тестах.
