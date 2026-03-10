---
title: "C4 Level 2: Container Diagram"
project: "@witqq/agent-sdk"
note: "For libraries, containers = modules / entry points"
---

# Container Diagram (C4 Level 2)

```mermaid
graph TB
    subgraph SDK["@witqq/agent-sdk"]
        AgentCore["Agent Core<br/><i>BaseAgent, IAgentService<br/>ToolDefinition, AgentEvent</i>"]
        Backends["Backend Adapters<br/><i>Copilot/Claude/VercelAI<br/>AgentService</i>"]
        Auth["Auth Providers<br/><i>CopilotAuth, ClaudeAuth<br/>TokenRefreshManager</i>"]
        ChatTypes["Chat Core Types<br/><i>ChatEvent, ChatMessage<br/>ChatSession, ChatId</i>"]
        ChatInfra["Chat Infrastructure<br/><i>IChatSessionStore<br/>IStorageAdapter, SQLite</i>"]
        ChatDomain["Chat Domain<br/><i>StateMachine, ChatError<br/>ContextWindowManager</i>"]
        ChatBackends["Chat Backend Adapters<br/><i>IChatBackend, adapters<br/>SSE/WS transports</i>"]
        Runtime["Chat Runtime<br/><i>IChatRuntime<br/>ChatRuntime</i>"]
        Server["Chat Server<br/><i>createChatHandler<br/>createAuthHandler</i>"]
        Client["Chat Client<br/><i>IChatClient<br/>RemoteChatClient</i>"]
        React["Chat React<br/><i>ChatProvider, useChat<br/>ChatUI, hooks</i>"]
    end

    Backends -->|"extends"| AgentCore
    ChatBackends -->|"wraps IAgentService"| Backends
    ChatBackends -->|"uses types"| ChatTypes
    ChatDomain -->|"uses types"| ChatTypes
    ChatInfra -->|"uses types"| ChatTypes
    Runtime -->|"manages adapters"| ChatBackends
    Runtime -->|"persists sessions"| ChatInfra
    Runtime -->|"uses state/errors/context"| ChatDomain
    Server -->|"calls IChatRuntime"| Runtime
    Server -->|"delegates auth"| Auth
    Client -->|"HTTP/SSE"| Server
    React -->|"consumes IChatClient"| Client
```

## Module Responsibilities

| Module | Entry Point | Responsibility |
|--------|-------------|----------------|
| Agent Core | `@witqq/agent-sdk` | Base agent abstraction: state machine, retry, abort |
| Backend Adapters | `@witqq/agent-sdk/{copilot,claude,vercel-ai}` | Vendor SDK wrappers → AgentEvent stream |
| Auth Providers | `@witqq/agent-sdk/auth` | OAuth flows (no token storage) |
| Chat Core Types | `@witqq/agent-sdk/chat/core` | Leaf types: ChatEvent, ChatMessage, ChatSession |
| Chat Infrastructure | `@witqq/agent-sdk/chat/{storage,sessions,sqlite}` | Data persistence adapters |
| Chat Domain | `@witqq/agent-sdk/chat/{state,errors,context,accumulator}` | Business rules: state machines, errors, context |
| Chat Backend Adapters | `@witqq/agent-sdk/chat/backends` | IChatBackend bridge + transports |
| Chat Runtime | `@witqq/agent-sdk/chat/runtime` | Server orchestrator: sessions + middleware + streaming |
| Chat Server | `@witqq/agent-sdk/chat/server` | HTTP handlers + routing + provider resolution |
| Chat Client | `@witqq/agent-sdk/chat/react` (RemoteChatClient) | HTTP/SSE proxy with local provider selection |
| Chat React | `@witqq/agent-sdk/chat/react` | Hooks and headless components |

## Dependency Direction

Dependencies flow **downward and inward**:
- React → Client → Server → Runtime → Domain/Infrastructure/Backend Adapters → Core Types
- No circular dependencies
- Core Types is a **leaf** — depended upon by all chat modules, depends on nothing
