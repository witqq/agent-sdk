---
title: "Chat SDK"
description: "React components and server utilities for chat interfaces"
---

The Chat SDK provides React components and server-side utilities for building chat interfaces powered by `@witqq/agent-sdk`.

## Entry Points

| Import Path | Purpose |
|-------------|---------|
| `@witqq/agent-sdk/chat` | Core chat types, sessions, utilities |
| `@witqq/agent-sdk/chat/runtime` | Chat runtime creation and management |
| `@witqq/agent-sdk/chat/react` | React hooks and components |
| `@witqq/agent-sdk/chat/server` | Server-side HTTP handler |
| `@witqq/agent-sdk/chat/storage` | SQLite chat persistence |

These are the primary entry points. See [API Reference](/api-reference/) for the full list.

## Server Setup

```typescript
import { createChatHandler } from "@witqq/agent-sdk/chat/server";
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
import { createAgentService } from "@witqq/agent-sdk";
import { InMemorySessionStore } from "@witqq/agent-sdk/chat";
import { CopilotChatAdapter } from "@witqq/agent-sdk/chat/backends";

const runtime = createChatRuntime({
  backends: {
    copilot: async (creds) =>
      new CopilotChatAdapter({
        agentConfig: { systemPrompt: "You are a helpful assistant" },
        agentService: await createAgentService("copilot", {
          githubToken: creds.accessToken,
        }),
      }),
  },
  defaultBackend: "copilot",
  sessionStore: new InMemorySessionStore(),
});

const handler = createChatHandler(runtime);
// handler is (req, res) => Promise<void> — use with your HTTP framework
```

## React Components

```tsx
import { ChatProvider, Thread, Composer } from "@witqq/agent-sdk/chat/react";
import { RemoteChatClient } from "@witqq/agent-sdk/chat/react";

const client = new RemoteChatClient({ baseUrl: "/api/chat" });

function App() {
  return (
    <ChatProvider runtime={client}>
      <Thread />
      <Composer />
    </ChatProvider>
  );
}
```

Key exported components: `ChatUI`, `ChatLayout`, `Thread`, `Composer`, `Message`, `ThinkingBlock`, `ToolCallView`, `ModelSelector`, `ProviderSelector`.

Key hooks: `useChat`, `useMessages`, `useSessions`, `useModels`, `useBackends`, `useProviders`, `useToolApproval`.

See the [API Reference](/api-reference/) for full type definitions.
