# User Journeys — @witqq/chat-sdk

## Consumer Type 1: Simple Chat App

**Persona**: Developer building a chat interface for their app. Wants minimal setup.

### Journey

```
1. npm install @witqq/chat-sdk @witqq/agent-sdk
2. Create runtime with backend + API key
3. Wrap app in <ChatProvider runtime={runtime}>
4. Add <Thread /> and <Composer />
5. App works: sends messages, streams responses, renders thinking/tools
6. Style with CSS variables or Tailwind className
7. Add custom tool rendering (optional)
8. Deploy
```

### Code (complete app)

```tsx
import { ChatProvider, Thread, Composer } from '@witqq/chat-sdk/react';
import { createChatRuntime } from '@witqq/chat-sdk';

const runtime = createChatRuntime({
  backend: 'vercel-ai',
  model: 'anthropic/claude-sonnet-4-5',
  apiKey: process.env.API_KEY,
});

export default function App() {
  return (
    <ChatProvider runtime={runtime}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Thread />
        <Composer />
      </div>
    </ChatProvider>
  );
}
```

### Touchpoints

| Step | SDK API | Notes |
|------|---------|-------|
| Init runtime | `createChatRuntime()` | Single factory, 3 config fields min |
| Mount UI | `<ChatProvider>`, `<Thread>`, `<Composer>` | Zero config components |
| Send message | Composer auto-handles | No code needed |
| Stream response | Thread auto-handles | Auto-scroll, thinking, tools |
| Error display | Thread auto-handles | Built-in error UI |

---

## Consumer Type 2: Multi-Chat Enterprise App

**Persona**: Building Slack-like app with multiple chats, persistence, custom DB.

### Journey

```
1. npm install @witqq/chat-sdk @witqq/agent-sdk
2. Create runtime with custom storage adapter
3. Implement ISessionStore (save/load to PostgreSQL)
4. Set up ThreadList for sidebar
5. Configure permission store
6. Add custom tool UIs
7. Style with primitives + custom components
8. Add error handling + retry
9. Deploy with WebSocket transport
```

### Code (key parts)

```tsx
// Storage adapter
const storage: ISessionStore = {
  async saveSession(session) { await db.query('INSERT INTO sessions ...', session); },
  async loadSession(id) { return db.query('SELECT * FROM sessions WHERE id = ?', id); },
  async listSessions() { return db.query('SELECT * FROM sessions ORDER BY updatedAt DESC'); },
  async deleteSession(id) { await db.query('DELETE FROM sessions WHERE id = ?', id); },
  async saveMessages(sessionId, messages) {
    await db.query('INSERT INTO messages ...', messages.map(m => ({ ...m, sessionId })));
  },
  async loadMessages(sessionId) {
    return db.query('SELECT * FROM messages WHERE sessionId = ? ORDER BY createdAt', sessionId);
  },
};

// Runtime
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  storage,
  retry: { maxRetries: 3, retryOn: ['RATE_LIMIT', 'NETWORK'] },
  context: { maxTokens: 128_000, strategy: 'sliding' },
  tools: { searchDocs, createTicket, updateStatus },
});

// UI with sidebar
function ChatApp() {
  return (
    <ChatProvider runtime={runtime}>
      <div className="flex h-screen">
        <ThreadList className="w-64" />
        <div className="flex-1 flex flex-col">
          <ThreadHeader />
          <Thread components={{ toolCall: CustomToolRenderer }} />
          <Composer attachments={true} />
        </div>
      </div>
    </ChatProvider>
  );
}
```

### Touchpoints

| Step | SDK API | Notes |
|------|---------|-------|
| Storage adapter | `ISessionStore` interface | 6 methods to implement |
| Thread list | `<ThreadList>` + `runtime.listSessions()` | Built-in component |
| Switch session | `runtime.switchSession(id)` | Loads history from storage |
| Custom tools | `<ToolUI name="..." render={...} />` | Per-tool component registration |
| Error handling | `runtime.on('error', ...)` + retry config | Typed error codes |
| Permissions | `onPermission` callback + store | Persistent scopes |
| Transport | `WebSocketTransport` | Custom server |

---

## Consumer Type 3: Pipeline / Background Processing

**Persona**: Building AI pipeline (podcast generation, data analysis). No chat UI.

### Journey

```
1. npm install @witqq/chat-sdk
2. Create runtime (headless, no React)
3. Send messages programmatically
4. Stream events for progress tracking
5. Handle errors with retry
6. Multiple sequential agent calls
```

### Code

```ts
import { createChatRuntime } from '@witqq/chat-sdk';

const runtime = createChatRuntime({
  backend: 'claude',
  model: 'claude-sonnet-4-5',
});

// Create session
const session = runtime.createSession();

// Send message and get complete response
const response = await runtime.send('Analyze this data: ...', {
  sessionId: session.id,
});
console.log(response.text); // Full response text
console.log(response.toolCalls); // Tool calls made

// Stream for progress
for await (const event of runtime.stream('Generate podcast script', {
  sessionId: session.id,
})) {
  if (event.type === 'message:delta') process.stdout.write(event.text);
  if (event.type === 'tool:start') console.log(`\nTool: ${event.name}`);
  if (event.type === 'usage') console.log(`\nTokens: ${event.totalTokens}`);
}
```

### Touchpoints

| Step | SDK API | Notes |
|------|---------|-------|
| Create session | `runtime.createSession()` | No UI needed |
| Send message | `runtime.send(text, opts)` | Returns complete response |
| Stream | `runtime.stream(text, opts)` | AsyncIterable<ChatEvent> |
| Events | Typed event union | Same events as UI version |
| Error | `ChatError` with code | Same error system |

---

## Consumer Type 4: SDK Consumer (wrapping in own framework)

**Persona**: Building higher-level framework on top of chat-sdk (like Moira, Supervisor).

### Journey

```
1. npm install @witqq/chat-sdk
2. Import core types and interfaces only
3. Create custom runtime adapter
4. Integrate with own session/state management
5. Build own streaming pipeline
6. Use error classifier for own error handling
```

### Code

```ts
import {
  IChatRuntime,
  ChatMessage,
  ChatEvent,
  ISessionStore,
  ChatErrorCode,
  MessagePart,
} from '@witqq/chat-sdk';

// Use types for own system
class SupervisorSession {
  private runtime: IChatRuntime;

  constructor(backend: string, config: AgentConfig) {
    this.runtime = createChatRuntime({ backend, ...config });
  }

  async executeTask(task: string): Promise<TaskResult> {
    const session = this.runtime.createSession();
    const response = await this.runtime.send(task, { sessionId: session.id });

    // Use parts for structured output
    const toolResults = response.parts
      .filter((p): p is ToolCallPart => p.type === 'tool_call')
      .map(p => ({ name: p.name, result: p.result }));

    return { text: response.text, tools: toolResults };
  }
}

// Custom storage for NATS
class NatsSessionStore implements ISessionStore {
  constructor(private nats: NatsConnection) {}
  // ... implement interface
}
```

### Touchpoints

| Step | SDK API | Notes |
|------|---------|-------|
| Types only | Import from `@witqq/chat-sdk` | Types + interfaces |
| Runtime | `createChatRuntime()` | Same factory |
| Custom store | `ISessionStore` | Implement interface |
| Event hooks | `runtime.on()` | Subscribe to events |
| Error codes | `ChatErrorCode` enum | Classify errors |
| Message parts | `MessagePart` union | Structured access |

---

## Cross-cutting Journey: Error Recovery

```
1. User sends message
2. Stream starts (text_delta events)
3. Network error occurs
4. → runtime emits 'error' event with ChatErrorCode.NETWORK
5. → If retry configured: auto-retry with backoff
6. → If retry exhausted: emit 'error' with retryExhausted=true
7. → Thread shows error UI with "Retry" button
8. → User clicks Retry → runtime.retry(sessionId)
9. → Stream resumes from last checkpoint
```

## Cross-cutting Journey: Session Continuity

```
1. User has active chat with Claude CLI
2. App restarts
3. runtime.restoreSession(id) → loads from storage
4. If CLI session still alive (transcript on disk):
   → runtime.send() resumes natively (persistent session)
5. If CLI session gone:
   → runtime.send() replays saved history into new session
6. User continues chatting seamlessly
```
