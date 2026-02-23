# @witqq/chat-sdk

Universal chat SDK for building AI agent interfaces. Works with Copilot CLI, Claude Code, and any OpenAI-compatible API.

## Quick Start

```bash
npm install @witqq/chat-sdk @witqq/agent-sdk
```

```tsx
import { ChatProvider, Thread, Composer } from '@witqq/chat-sdk/react';
import { createChatRuntime } from '@witqq/chat-sdk';

const runtime = createChatRuntime({
  backend: 'vercel-ai',
  model: 'anthropic/claude-sonnet-4-5',
  apiKey: process.env.API_KEY,
});

function App() {
  return (
    <ChatProvider runtime={runtime}>
      <Thread />
      <Composer />
    </ChatProvider>
  );
}
```

That's it. A fully functional chat with streaming, thinking blocks, tool rendering, and error handling.

## Core Concepts

### Runtime

The runtime connects your UI to an AI backend. Three backends are supported:

```ts
// Claude Code CLI
const runtime = createChatRuntime({ backend: 'claude' });

// GitHub Copilot CLI
const runtime = createChatRuntime({ backend: 'copilot' });

// Any OpenAI-compatible API (OpenRouter, OpenAI, local models)
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_KEY,
  model: 'anthropic/claude-sonnet-4-5',
});
```

### Messages & Parts

Messages are composed of typed parts — text, reasoning, tool calls, sources, files:

```ts
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];    // TextPart | ReasoningPart | ToolCallPart | SourcePart | FilePart
  status: MessageStatus;   // 'streaming' | 'complete' | 'error' | 'cancelled'
  metadata?: MessageMetadata;
}
```

### Sessions (Threads)

Each conversation is a session. Multiple sessions are managed by the runtime:

```ts
// Create new session
const session = runtime.createSession();

// Switch between sessions
runtime.switchSession(sessionId);

// List all sessions
const sessions = await runtime.listSessions();

// Restore from storage
const session = await runtime.restoreSession(sessionId);
```

## Streaming

Messages stream in real-time with typed events:

```tsx
import { Thread } from '@witqq/chat-sdk/react';

// Thread handles all streaming automatically
<Thread
  components={{
    Text: ({ text, status }) => <Markdown>{text}</Markdown>,
    Reasoning: ({ text, isStreaming }) => (
      <Collapsible title="Thinking...">{text}</Collapsible>
    ),
    ToolCall: ({ name, args, result, status }) => (
      <ToolCard name={name} status={status}>
        <pre>{JSON.stringify(args, null, 2)}</pre>
        {result && <div>{result}</div>}
      </ToolCard>
    ),
  }}
/>
```

### Events & Hooks

Subscribe to lifecycle events:

```ts
runtime.on('message:start', (msg) => console.log('New message'));
runtime.on('message:delta', (delta) => console.log('Delta:', delta));
runtime.on('message:complete', (msg) => console.log('Done'));
runtime.on('tool:start', (call) => console.log('Tool:', call.name));
runtime.on('tool:complete', (call) => console.log('Result:', call.result));
runtime.on('error', (err) => console.error(err.code, err.message));
runtime.on('session:switch', (id) => console.log('Session:', id));
```

## Tools

### Server Tools

Tools that execute on the server:

```ts
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  tools: {
    getWeather: {
      description: 'Get current weather',
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => {
        const data = await fetchWeather(city);
        return { temperature: data.temp, condition: data.condition };
      },
    },
  },
});
```

### Frontend Tools

Tools that render UI and wait for user interaction:

```ts
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  tools: {
    confirmAction: {
      description: 'Ask user to confirm an action',
      parameters: z.object({ action: z.string(), risk: z.enum(['low', 'high']) }),
      // No execute — renders UI, waits for user
    },
  },
});

// Register tool UI
<ChatProvider runtime={runtime}>
  <ToolUI
    name="confirmAction"
    render={({ args, addResult }) => (
      <div>
        <p>Confirm: {args.action}?</p>
        <button onClick={() => addResult({ confirmed: true })}>Yes</button>
        <button onClick={() => addResult({ confirmed: false })}>No</button>
      </div>
    )}
  />
  <Thread />
</ChatProvider>
```

### Tool Approval

Require user approval before tool execution:

```ts
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  tools: {
    deleteFile: {
      description: 'Delete a file',
      parameters: z.object({ path: z.string() }),
      needsApproval: true, // or (args) => args.path.includes('/important/')
      execute: async ({ path }) => fs.unlink(path),
    },
  },
});
```

The `<Thread>` component automatically renders approval UI when `needsApproval` is set.

## Storage Adapters

Persist sessions and messages to any storage:

```ts
import { createChatRuntime, FileSessionStore } from '@witqq/chat-sdk';

// File-based storage (JSON files)
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  storage: new FileSessionStore('./data/sessions'),
});

// Custom storage (your database)
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  storage: {
    async saveSession(session) { await db.sessions.upsert(session); },
    async loadSession(id) { return db.sessions.findById(id); },
    async listSessions() { return db.sessions.findAll(); },
    async deleteSession(id) { await db.sessions.delete(id); },
    async saveMessages(sessionId, messages) { await db.messages.bulkUpsert(sessionId, messages); },
    async appendMessage(sessionId, message) { await db.messages.insert({ ...message, sessionId }); },
    async loadMessages(sessionId) { return db.messages.findBySession(sessionId); },
  },
});
```

Built-in adapters: `InMemorySessionStore`, `FileSessionStore`.

## Context Management

Automatic context window management:

```ts
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  context: {
    maxTokens: 128_000,      // Context window budget
    reserveTokens: 4_000,    // Reserve for response
    strategy: 'sliding',     // 'sliding' | 'summarize' | 'truncate'
  },
});
```

## Error Handling

Typed errors with automatic retry:

```ts
import { ChatErrorCode } from '@witqq/chat-sdk';

runtime.on('error', (error) => {
  switch (error.code) {
    case ChatErrorCode.RATE_LIMIT:
      console.log(`Rate limited. Retry in ${error.retryAfter}ms`);
      break;
    case ChatErrorCode.CONTEXT_OVERFLOW:
      console.log('Context too long. Auto-trimming...');
      break;
    case ChatErrorCode.AUTH_EXPIRED:
      console.log('Re-authenticate');
      break;
    case ChatErrorCode.NETWORK:
      console.log('Connection lost. Reconnecting...');
      break;
  }
});

// Configure retry
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
    backoffFactor: 2,
    retryOn: [ChatErrorCode.RATE_LIMIT, ChatErrorCode.NETWORK],
  },
});
```

## React UI Components

### Pre-built Components

```tsx
import {
  ChatProvider,
  Thread,
  Composer,
  ThreadList,
} from '@witqq/chat-sdk/react';

function ChatApp() {
  return (
    <ChatProvider runtime={runtime}>
      <div className="flex h-screen">
        <ThreadList className="w-64 border-r" />
        <div className="flex-1 flex flex-col">
          <Thread />
          <Composer />
        </div>
      </div>
    </ChatProvider>
  );
}
```

### Primitives (Headless)

Full control with unstyled primitives:

```tsx
import { ThreadPrimitive, ComposerPrimitive, MessagePrimitive } from '@witqq/chat-sdk/react';

function CustomThread() {
  return (
    <ThreadPrimitive.Root>
      <ThreadPrimitive.Viewport>
        <ThreadPrimitive.Messages>
          {(message) => (
            <MessagePrimitive.Root message={message}>
              <MessagePrimitive.Parts
                text={CustomText}
                reasoning={CustomReasoning}
                toolCall={CustomToolCall}
              />
            </MessagePrimitive.Root>
          )}
        </ThreadPrimitive.Messages>
      </ThreadPrimitive.Viewport>
      <ThreadPrimitive.ScrollToBottom />
    </ThreadPrimitive.Root>
  );
}

function CustomComposer() {
  return (
    <ComposerPrimitive.Root>
      <ComposerPrimitive.Input placeholder="Type a message..." />
      <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
      <ComposerPrimitive.Cancel>Stop</ComposerPrimitive.Cancel>
    </ComposerPrimitive.Root>
  );
}
```

### Styling

Components use CSS custom properties for theming:

```css
:root {
  --chat-max-width: 768px;
  --chat-bg: #ffffff;
  --chat-bubble-user: #006cff;
  --chat-bubble-assistant: #f0f0f0;
  --chat-font-size: 14px;
}
```

Or use Tailwind with `className` prop on all components.

## Permissions

Manage tool permissions with persistent scopes:

```ts
import { FilePermissionStore } from '@witqq/agent-sdk';

const runtime = createChatRuntime({
  backend: 'claude',
  permissionStore: new FilePermissionStore('./.permissions.json'),
  onPermission: async (request) => {
    // Show UI for user decision
    const decision = await showPermissionDialog(request);
    return {
      allowed: decision.allowed,
      scope: decision.remember ? 'project' : 'once',
    };
  },
});
```

Scopes: `once` | `session` | `project` | `always`.

## Provider Switching

Switch models at runtime:

```ts
// List available models
const models = await runtime.listModels();

// Switch model
runtime.setModel('openai/gpt-4o');
```

## Transport

Override default transport for custom server integration:

```ts
import { createChatRuntime, HttpTransport, WebSocketTransport } from '@witqq/chat-sdk';

// SSE (default for vercel-ai)
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  transport: new HttpTransport({ url: '/api/chat' }),
});

// WebSocket
const runtime = createChatRuntime({
  backend: 'vercel-ai',
  transport: new WebSocketTransport({
    url: 'ws://localhost:3001/chat',
    reconnect: { maxRetries: 5, delay: 1000 },
  }),
});
```

## Package Exports

```
@witqq/chat-sdk           → Core: runtime, sessions, storage, errors, types
@witqq/chat-sdk/react      → React: components, primitives, hooks
@witqq/chat-sdk/transport  → Transport: HTTP, WebSocket, custom
```

## TypeScript

Full type safety with generics:

```ts
interface MyMetadata {
  source: string;
  confidence: number;
}

const runtime = createChatRuntime<MyMetadata>({
  backend: 'vercel-ai',
});

// Typed metadata throughout
runtime.on('message:complete', (msg) => {
  console.log(msg.metadata?.source); // typed!
});
```
