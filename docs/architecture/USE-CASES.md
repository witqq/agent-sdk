# Use Cases — @witqq/chat-sdk

## Consumer Types

### Type 1: Simple Chat App Developer
Один чат, один провайдер, минимальная конфигурация. Хочет 5 строк до работающего чата.

### Type 2: Multi-Chat Enterprise Developer (Moira, Supervisor, Planeta)
Множество сессий, множество провайдеров, кастомные тулзы, persistence в БД, кастомный UI.

### Type 3: Pipeline Developer (Podcast)
AI как часть pipeline — без UI, без чата, только programmatic API. Нужны sessions для continuity, error handling, retry.

### Type 4: SDK Consumer (другие библиотеки)
Строит поверх chat-sdk свою абстракцию. Нужны чистые интерфейсы, type-only exports, hooks.

---

## Use Cases by Type

### Type 1: Simple Chat App

#### UC-1.1: Быстрый старт — чат за 5 строк
```tsx
import { ChatProvider, ChatWidget } from '@witqq/chat-sdk/react';
import { createChatRuntime } from '@witqq/chat-sdk';

const runtime = createChatRuntime({
  backend: 'copilot',
  // auto-discovers auth from environment
});

function App() {
  return (
    <ChatProvider client={client}>
      <ChatWidget />
    </ChatProvider>
  );
}
```

#### UC-1.2: Отправка сообщения и показ стриминга
```tsx
import { useChat } from '@witqq/chat-sdk/react';

function Chat() {
  const { messages, sendMessage, isStreaming, stop } = useChat();
  
  return (
    <div>
      {messages.map(m => <MessageBubble key={m.id} message={m} />)}
      <ChatInput onSend={sendMessage} onStop={stop} isStreaming={isStreaming} />
    </div>
  );
}
```

#### UC-1.3: Обработка ошибок
```tsx
const { error, retry } = useChat();

if (error) {
  return <ErrorDisplay error={error} onRetry={retry} />;
}
```

### Type 2: Multi-Chat Enterprise

#### UC-2.1: Создание и переключение сессий
```typescript
import { ChatClient, InMemorySessionStore } from '@witqq/chat-sdk';

const runtime = createChatRuntime({
  backend: 'copilot',
  sessionStore: new InMemorySessionStore(),
});

// Create sessions
const session1 = await runtime.createSession({ title: 'Task A' });
const session2 = await runtime.createSession({ title: 'Task B' });

// Switch
await runtime.switchSession(session2.id);

// Send — automatically uses current session
const response = await runtime.send('Hello');

// List all sessions
const sessions = await runtime.listSessions();
```

#### UC-2.2: Восстановление сессии после рестарта
```typescript
import { FileSessionStore } from '@witqq/chat-sdk';

const runtime = createChatRuntime({
  backend: 'claude',
  sessionStore: new FileSessionStore('./sessions'),
});

// Restore — loads from file, resumes native CLI session if transcript exists
const session = await runtime.restoreSession(sessionId);

// If native session was deleted, continues from saved messages
await runtime.send('Continue where we left off');
```

#### UC-2.3: Кастомный storage adapter
```typescript
import type { ISessionStore } from '@witqq/chat-sdk';

class PostgresSessionStore implements ISessionStore {
  async createSession(metadata) { /* INSERT INTO sessions */ }
  async getSession(id) { /* SELECT FROM sessions */ }
  async addMessage(sessionId, message) { /* INSERT INTO messages */ }
  async getMessages(sessionId, { limit, offset }) { /* SELECT with pagination */ }
  async updateSession(id, updates) { /* UPDATE sessions */ }
  async deleteSession(id) { /* DELETE */ }
  async listSessions(filter?) { /* SELECT with filters */ }
}

const runtime = createChatRuntime({
  backend: 'vercel-ai',
  sessionStore: new PostgresSessionStore(pool),
});
```

#### UC-2.4: Серверные и фронтовые тулзы
```typescript
// Server tools
const tools = [
  {
    name: 'searchDocuments',
    description: 'Search documents in knowledge base',
    schema: z.object({ query: z.string() }),
    execute: async ({ query }, ctx) => {
      // ctx has userId, sessionId, signal
      return await knowledgeBase.search(query, ctx.userId);
    },
  },
];

// Frontend tools (executed in browser)
const frontendTools = [
  {
    name: 'scrollToElement',
    description: 'Scroll page to specific element',
    schema: z.object({ selector: z.string() }),
    // No execute — handled by frontend toolHandler
  },
];

const runtime = createChatRuntime({
  tools,
  frontendTools,
  toolHandler: async (toolCall) => {
    // Handle frontend tool execution
    document.querySelector(toolCall.args.selector)?.scrollIntoView();
    return { success: true };
  },
});
```

#### UC-2.5: Context window management
```typescript
const runtime = createChatRuntime({
  context: {
    maxTokens: 100000,
    strategy: 'sliding-window', // system → summaries → recent
    archiveThreshold: 0.8, // archive when 80% full
    emergencyTrimPercent: 50, // trim 50% on overflow
  },
});
```

#### UC-2.6: Transport (SSE server → React client)
```typescript
// Server (Express/Hono/Fastify)
import { createSSEHandler } from '@witqq/chat-sdk/transport';

app.post('/api/chat', createSSEHandler({
  client,
  onBeforeSend: (message) => { /* log, validate */ },
}));

// Client
import { ChatProvider } from '@witqq/chat-sdk/react';
import { SSETransport } from '@witqq/chat-sdk/transport';

const transport = new SSETransport({ url: '/api/chat' });

<ChatProvider transport={transport}>
  <ChatWidget />
</ChatProvider>
```

#### UC-2.7: Кастомные рендереры для тулзов
```tsx
import { ToolCallView } from '@witqq/chat-sdk/react';

const toolRenderers = {
  searchDocuments: ({ args, result, status }) => (
    <div className="search-results">
      <p>Query: {args.query}</p>
      {result?.items?.map(item => <SearchResult key={item.id} item={item} />)}
    </div>
  ),
  // Default renderer for unregistered tools
};

<MessageList toolRenderers={toolRenderers} />
```

#### UC-2.8: Provider switching
```typescript
const runtime = createChatRuntime({
  providers: {
    copilot: { /* auto from env */ },
    claude: { token: savedClaudeToken },
    'vercel-ai': { baseUrl: 'https://api.openai.com/v1', apiKey: '...' },
  },
  defaultProvider: 'copilot',
});

// Switch provider for current session
await runtime.switchProvider('claude', { model: 'claude-sonnet-4-20250514' });

// Or per-message
await runtime.send('Hello', { provider: 'vercel-ai', model: 'gpt-4o' });
```

#### UC-2.9: Permission handling
```tsx
import { usePermissions } from '@witqq/chat-sdk/react';

function Chat() {
  const { pendingPermission, approve, deny } = usePermissions();
  
  return (
    <>
      <MessageList />
      {pendingPermission && (
        <PermissionPrompt
          request={pendingPermission}
          onApprove={(scope) => approve(scope)} // 'once' | 'session' | 'always'
          onDeny={() => deny()}
        />
      )}
    </>
  );
}
```

### Type 3: Pipeline Developer

#### UC-3.1: Programmatic API без UI
```typescript
const runtime = createChatRuntime({
  backend: 'claude',
  sessionStore: new FileSessionStore('./pipeline-sessions'),
});

const session = await runtime.createSession({ title: 'Research task' });

// Sequential calls with automatic context
const step1 = await runtime.send('Research topic X');
const step2 = await runtime.send('Now analyze the findings');
const step3 = await runtime.send('Write a summary');

// Error handling with retry
try {
  const result = await runtime.send('Generate report', {
    retry: { maxAttempts: 3, backoff: 'exponential' },
  });
} catch (e) {
  if (e instanceof RateLimitError) {
    await sleep(e.retryAfter);
    // retry
  }
}
```

### Type 4: SDK Consumer

#### UC-4.1: Type-only imports
```typescript
import type { 
  ChatMessage, ChatSession, IChatProvider, 
  ChatEvent, ISessionStore 
} from '@witqq/chat-sdk';
// Zero runtime cost — types only
```

#### UC-4.2: Event interception
```typescript
const runtime = createChatRuntime({
  middleware: [
    {
      onBeforeSend: async (message) => {
        // Content moderation
        await moderateContent(message.content);
        return message;
      },
      onEvent: async (event) => {
        // Logging
        await auditLog.write(event);
        return event;
      },
    },
  ],
});
```
