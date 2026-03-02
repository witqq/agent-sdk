---
title: Glossary
project: "@witqq/agent-sdk"
---

# Glossary

| Term | Definition |
|------|------------|
| **AgentEvent** | Discriminated union of events emitted during agent execution (text_delta, tool_call_start, etc.) |
| **AgentSDKError** | Base error class with `_agentSDKError` marker and static `is()` for cross-bundle instanceof checks |
| **AuthToken** | Token object returned by auth providers, containing access token and metadata |
| **Backend** | An AI provider implementation (copilot, claude, vercel-ai) |
| **Backend Adapter** | Class wrapping a vendor SDK to produce an AgentEvent stream (e.g., CopilotAgentService) |
| **BackendAdapterFactory** | Function `(credentials: AuthToken) => IChatBackend` — creates adapters per-request with credentials |
| **BaseAgent** | Abstract class implementing agent state machine (idle → running/streaming → idle → disposed) |
| **ChatBackend / IChatBackend** | Higher-level adapter bridging IAgentService → ChatEvent stream |
| **ChatError** | Error class extending AgentSDKError with 28 error codes (NETWORK, TIMEOUT, AUTH_EXPIRED, TOOL_EXECUTION, etc.) |
| **ChatEvent** | 18-type discriminated union with colon-separated names (message:start, tool:complete, done) |
| **ChatId** | Branded string type for chat session identifiers, validated as UUID |
| **ChatMessage** | Message with id, role, parts array (TextPart, ReasoningPart, ToolCallPart, etc.) |
| **ChatMiddleware** | Runtime middleware with 4 lifecycle hooks (beforeSend, onEvent, afterReceive, onError) |
| **ChatRuntime** | Server-side implementation of IChatRuntime — orchestrates sessions, adapters, middleware |
| **ChatSession** | Conversation container with messages, config, metadata |
| **ContextWindowManager** | Stateless manager that trims messages to fit within token budget using configurable strategies |
| **createChatHandler** | Factory creating HTTP request handler that maps RemoteChatClient endpoints to IChatRuntime calls |
| **createAuthHandler** | Factory creating HTTP handler for server-mediated auth flows (Device Flow, OAuth, API keys) |
| **createChatServer** | One-call factory combining chat handler, auth handler, provider handler, static files, CORS |
| **ExponentialBackoffStrategy** | Retry strategy with configurable base/max delay, jitter, and max attempts |
| **IAgentService** | Core interface for agent execution: run(), stream(), runStructured(), dispose() |
| **IChatClient** | Client-facing interface for browser/remote consumers. Includes provider CRUD and selection. |
| **IChatRuntime** | Server-side interface. Includes tools, middleware, context trimming. Different send() signature. |
| **IChatSessionStore** | Storage interface for chat sessions: CRUD, pagination, search |
| **IStorageAdapter** | Generic storage interface: create, get, update, delete, query |
| **MessageAccumulator** | Stateful converter from AgentEvent stream to ChatMessage with progressive part building |
| **MessagePart** | 5-variant union: TextPart, ReasoningPart, ToolCallPart, SourcePart, FilePart |
| **Provider** | User-configured entity combining backend + model + label (e.g., "GPT-5 Mini via OpenRouter") |
| **ProviderConfig** | Persistent provider configuration: { id, backend, model, label, createdAt } |
| **RemoteChatClient** | Client-side IChatClient implementation that delegates over HTTP/SSE to server |
| **RuntimeSendOptions** | Required options for IChatRuntime.send(): backend, model, credentials (all mandatory) |
| **SendMessageOptions** | Optional options for IChatClient.send(): model, signal, tools |
| **StateMachine** | Generic validated state machine with declarative transition maps, used for runtime/message/tool lifecycles |
| **TokenRefreshManager** | Automatic background token refresh with configurable threshold, backoff, and event emission |
| **ToolDefinition** | Tool with name, description, parameters (Zod or JSON Schema), and execute function |
| **ToolContext** | Request-scoped session data injected into tool execute functions |
| **Transport** | Delivery mechanism for ChatEvents to clients (SSEChatTransport, WsChatTransport, InProcessChatTransport) |
