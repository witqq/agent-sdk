# Competitor Analysis: AI Chat SDK Landscape

Comprehensive analysis of 6 key solutions for embedding AI chat into applications.  
Research context: 4 internal project use cases (Moira, Supervisor, Podcast, Planeta).

---

## 1. Vercel AI SDK (v5/v6 + AI Elements)

**Repository:** `vercel/ai` · MIT · 18K+ stars  
**Packages:** `ai`, `@ai-sdk/react`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`

### Architecture

Three-layer approach:

1. **AI SDK Core** (`ai`) — `generateText()`, `generateObject()`, `streamText()`, `streamObject()`. Provider-agnostic API over LLMs through provider registry. Multi-step tool loop via `maxSteps`. Structured output with Zod schema validation.

2. **AI SDK UI** (`@ai-sdk/react`) — React hooks `useChat()`, `useCompletion()`, `useObject()`. Transport via Data Stream Protocol (SSE): format `0:text`, `9:tool_call`, `a:tool_result`, `d:finish`, `e:error`. `UIMessage` / `ModelMessage` separation of frontend and backend representations.

3. **AI Elements** (v6, 2025) — 20+ headless React components: `<Thread>`, `<Composer>`, `<Message>`, `<ToolInvocation>`, `<Thinking>`, `<SourceList>`. Built on `useSyncExternalStore` for React 18+ compatibility. Headless approach: components contain logic, styling via CSS/Tailwind.

**Transport-based architecture (v6):** `ChatTransport` abstraction enables SSE, WebSocket, custom protocols. `useChat()` takes `transport` parameter instead of `api` URL.

**Provider registry:** Unified `LanguageModel` interface — providers (`@ai-sdk/openai`, `@ai-sdk/anthropic`, etc.) implement it. Adding new provider = npm package without core changes.

### Key Modules

| Package | Purpose |
|---------|---------|
| `ai` | Core: generateText, streamText, generateObject, tools |
| `@ai-sdk/react` | React hooks: useChat, useCompletion, useObject |
| `@ai-sdk/openai` | OpenAI + OpenAI-compatible provider |
| `@ai-sdk/anthropic` | Claude provider |
| `@ai-sdk/google` | Gemini provider |
| `@ai-sdk/ui-utils` | Shared utilities for UI frameworks |

### Strengths (What to Adopt)

- **Data Stream Protocol** — standardized wire format for streaming AI events (text, tool calls, finish reasons). Moira already re-implements this manually (`AgentEventStreamAdapter`). Our SDK should provide ready serializer/deserializer.
- **Transport abstraction** — `ChatTransport` interface separates hooks from wire protocol. Allows single `useChat()` to work over SSE, WebSocket, NATS. Directly addresses our pain point 3.2 (three different transports across projects).
- **UIMessage / ModelMessage separation** — frontend representation (attachments, UI metadata) separated from backend (role, content, tool_calls). Planeta and Supervisor do this ad-hoc.
- **Provider registry pattern** — plug-and-play providers through unified `LanguageModel` interface. Our agent-sdk already uses similar pattern via `registerBackend()`.
- **Headless components** — AI Elements provide structure without imposing design system. Ideal for SDK to be embedded in different UIs.
- **Multi-step tool loop** — `maxSteps` + `stopWhen` in `generateText()`. Our Vercel AI backend already uses this.
- **Structured output** — `generateObject()` with Zod schema and `output: "enum"`. Native support, not prompt augmentation.

### Weaknesses (Our Opportunities)

- **No persistent sessions** — `useChat()` stores messages in React state. No built-in persist/restore from DB mechanism. Three of our projects write their own SQLite storage.
- **No context window management** — no sliding window, auto-archival, token budget. Moira and Planeta implement this from scratch.
- **No permission system** — tools execute automatically. Supervisor and Planeta require human-in-the-loop approval.
- **No error classification** — provider errors not typed. Supervisor and Podcast write their own `classifyError()`.
- **No agent service caching** — each call creates new request. No pool/registry for reuse.
- **No auto token refresh** — OAuth token management outside SDK scope.
- **Single-framework (React)** — no Vue, Svelte adapters in core (community exists).
- **No tool context DI** — tools are static, no factory pattern for per-request context (userId, session).

### Relevance to Our Use Cases

| Use Case | Vercel AI SDK Coverage | Our Gap |
|----------|----------------------|---------|
| Multi-backend | ✅ Provider registry | ✅ Have in agent-sdk |
| Streaming events | ✅ Data Stream Protocol | Need serializer in SDK |
| Thinking blocks | ✅ AI Elements `<Thinking>` | Need headless components |
| Tool visualization | ✅ `<ToolInvocation>` | Need headless components |
| Session persistence | ❌ None | **P2 — IChatStorage** |
| Context management | ❌ None | **P2 — ContextWindowManager** |
| Permission system | ❌ None | **P3 — Permission events** |
| Error classification | ❌ None | **P1 — classifyError()** |

---

## 2. CopilotKit

**Repository:** `CopilotKit/CopilotKit` · MIT · 20K+ stars  
**Packages:** `@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime`, `@copilotkit/shared`

### Architecture

Agentic SDK — AI doesn't just respond in chat, but performs actions in the application. Three layers:

1. **Frontend Layer** (`@copilotkit/react-core`) — `<CopilotKit>` provider, `useCopilotAction()` hook for declaring frontend actions AI can invoke, `useCopilotReadable()` for exposing app state to AI. `useCopilotChat()` for standard chat.

2. **Transport Layer** — AG-UI Protocol (Agent-User Interaction Protocol). Open standard over SSE for agent-user interactions. Adoption: Google ADK, LangChain, AWS, CrewAI. Events: `TEXT_MESSAGE_START/CONTENT/END`, `TOOL_CALL_START/ARGS/END`, `STATE_SNAPSHOT`, `STATE_DELTA`.

3. **Backend Layer** (`@copilotkit/runtime`) — `CopilotRuntime` server. Accepts AG-UI events from agent frameworks (LangGraph, CrewAI, custom) and proxies to frontend. Self-hosted and Copilot Cloud support.

**Key concept:** AI is aware of application state (`useCopilotReadable`) and can modify it (`useCopilotAction`). Not just chatbot — integrated copilot in UX.

### Key Modules

| Package | Purpose |
|---------|---------|
| `@copilotkit/react-core` | Provider, hooks (useCopilotAction, useCopilotReadable, useCopilotChat) |
| `@copilotkit/react-ui` | Ready UI: CopilotSidebar, CopilotChat, CopilotPopup, CopilotTextarea |
| `@copilotkit/runtime` | Backend runtime (Node.js) |
| `@copilotkit/shared` | Shared types and AG-UI protocol definitions |

### Strengths (What to Adopt)

- **AG-UI Protocol** — open standard for agent↔UI communication. Adoption by major players (Google, AWS) gives it chances to become de-facto standard. Unlike Vercel Data Stream Protocol (proprietary), AG-UI is community-driven spec.
- **Frontend actions** — `useCopilotAction()` allows AI to invoke frontend functions (navigate, toggle UI, fill form). Planeta implements similar via browser tools + ARIA snapshot, but less elegantly.
- **App state awareness** — `useCopilotReadable()` exposes React state to AI agent. Planeta does this through page context injection (construction/dashboard/budget contexts), but manually.
- **Ready-to-use UI widgets** — `CopilotSidebar`, `CopilotPopup` — ready overlay/docked chat widgets. Planeta has `FloatingChatWidget`, Moira has full-page chat. SDK could provide similar layouts.
- **Agent framework agnostic** — backend accepts any framework via AG-UI (LangGraph, CrewAI, custom). Similar to our multi-backend approach.

### Weaknesses (Our Opportunities)

- **React-only** — complete React binding. No headless core for other frameworks.
- **Heavy runtime** — `@copilotkit/runtime` requires backend server. For simple cases (direct API call) — overhead. Our SDK allows direct API via Vercel AI backend without additional server.
- **Limited UI customization** — ready components are styled. Few headless alternatives. assistant-ui wins on composability.
- **Vendor tendencies** — Copilot Cloud for production. Self-hosted works, but documentation points to cloud.
- **No session persistence** — like Vercel AI SDK, stores state in React. No DB adapters.
- **No context window management** — no automatic token budget management.
- **No error classification/retry** — provider errors not typed.
- **No permission scoping** — `useCopilotAction` lacks granular permission model (once/session/always).

### Relevance to Our Use Cases

| Use Case | CopilotKit Coverage | Our Gap |
|----------|-------------------|---------|
| Frontend tool execution | ✅ useCopilotAction | Planeta already does via assistant-ui |
| App state awareness | ✅ useCopilotReadable | Need page context injection pattern |
| Chat widget layouts | ✅ Sidebar/Popup/Chat | Need layout primitives |
| AG-UI protocol | ✅ Open standard | Consider compatibility |
| Session persistence | ❌ | **P2 — IChatStorage** |
| Context management | ❌ | **P2 — ContextWindowManager** |
| Permission system | ❌ | Have in agent-sdk (IPermissionStore) |
| Multi-backend | Partial (OpenAI, Anthropic, Google) | ✅ Have in agent-sdk |

---

## 3. assistant-ui

**Repository:** `assistant-ui/assistant-ui` · MIT · 3K+ stars  
**Packages:** `@assistant-ui/react`, `@assistant-ui/react-markdown`, `@assistant-ui/react-ai-sdk`, `@assistant-ui/react-langgraph`

### Architecture

Composable UI primitives modeled after shadcn/ui + Radix UI. Hub-and-spoke:

1. **Core** (`@assistant-ui/react`) — primitive components: `<Thread>`, `<Composer>`, `<Message>`, `<BranchPicker>`, `<ActionBar>`. State management via Zustand stores. Runtime abstraction: `AssistantRuntime` interface.

2. **Protocol adapters** — connections to various backends:
   - `@assistant-ui/react-ai-sdk` — bridge to Vercel AI SDK useChat()
   - `@assistant-ui/react-langgraph` — bridge to LangGraph
   - `ExternalStoreRuntime` — for custom backends (MST, Redux)
   - `useExternalMessageConverter` — message converter from any format

3. **Extensions:**
   - `@assistant-ui/react-markdown` — Markdown rendering with syntax highlighting
   - Tool UI components — custom renderers for tool calls
   - Branch navigation — navigation through conversation tree branches

**Key concept:** Minimal building blocks, maximum composability. Each component — separate import, styling via CSS variables.

### Key Modules

| Package | Purpose |
|---------|---------|
| `@assistant-ui/react` | Core primitives: Thread, Composer, Message, BranchPicker |
| `@assistant-ui/react-markdown` | MarkdownText component |
| `@assistant-ui/react-ai-sdk` | Adapter for Vercel AI SDK |
| `@assistant-ui/react-langgraph` | Adapter for LangGraph |

### Strengths (What to Adopt)

- **Composable primitives** — shadcn/ui style: copy component, modify for yourself. No prop drilling, no monster components. Planeta already uses assistant-ui and confirms this approach.
- **Runtime abstraction** — `AssistantRuntime` separates UI from backend. `ExternalStoreRuntime` allows Planeta to use MobX State Tree as source of truth. Our SDK could provide similar runtime adapter.
- **`useExternalMessageConverter`** — conversion from any message format to assistant-ui format. Solves pain 2.1 (type duplication): projects can use SDK types and convert to UI.
- **WAI-ARIA compliance** — accessibility out of box. Keyboard shortcuts, screen reader support. None of our projects have full a11y.
- **Branch navigation** — `BranchPicker` for navigating alternative responses. Unique feature absent in other competitors.
- **Tool UI extensibility** — custom renderers for tool calls via `makeAssistantTool`. Planeta uses this for browser tools UI.
- **Human-in-the-loop** — built-in tool approval/reject UI support. Supervisor and Planeta implement this manually.
- **Zustand state management** — lightweight, React 18+ compatible. Predictable state without Redux complexity.

### Weaknesses (Our Opportunities)

- **React-only** — no Vue/Svelte/Angular support.
- **No backend logic** — pure UI. No server-side streaming, tool execution, session management. Needs Vercel AI SDK or custom backend.
- **React 18+ required** — Planeta on React 17 applies 5 patch-package patches for compatibility. Zustand v5 doesn't support React 17.
- **No built-in persistence** — messages in Zustand store, not DB.
- **Limited documentation** — compared to Vercel AI SDK or CopilotKit. Fewer examples.
- **No error handling patterns** — error UI is minimal. Retry, error classification — out of scope.
- **No context management** — token budget, sliding window — not covered.
- **Non-monolithic architecture** — shadcn-style means more boilerplate in initial setup. Trade-off: flexibility vs time-to-start.

### Relevance to Our Use Cases

| Use Case | assistant-ui Coverage | Our Gap |
|----------|---------------------|---------|
| Chat message list | ✅ Thread, Message | Need headless primitives |
| Chat input | ✅ Composer | Need headless primitives |
| Markdown rendering | ✅ @assistant-ui/react-markdown | SDK markdown component |
| Tool call cards | ✅ ToolUI extensibility | SDK tool renderers |
| Thinking blocks | ✅ Thinking primitive | SDK thinking component |
| Thread list / sidebar | ✅ ThreadList | SDK thread management |
| Branch navigation | ✅ BranchPicker | Unique, consider |
| Accessibility | ✅ WAI-ARIA | Need a11y |
| Backend integration | ❌ UI-only | agent-sdk covers |
| Persistence | ❌ | **P2 — IChatStorage** |
| Context management | ❌ | **P2 — ContextWindowManager** |

---

## 4. LangChain.js Agent Chat UI

**Repository:** `langchain-ai/agent-chat-ui` + `langchain-ai/chat-langchain` · MIT  
**Packages:** Standalone React app (not npm library), depends on `@langchain/langgraph-sdk`

### Architecture

Full-stack reference implementation for chat with LangGraph agents:

1. **Frontend** — React + Tailwind CSS. Components: `ChatWindow`, `ChatMessageBubble`, `SourceBubble`, `AutoResizeTextarea`, `InlineCitation`. Streaming via LangGraph SDK client.

2. **Backend** — LangGraph Cloud / self-hosted LangGraph Platform. Threads API for persistence. Time-travel debugging via `Thread.getState()`.

3. **Integrations:**
   - LangGraph threads — built-in persistence via graph state
   - RAG with citations — `SourceBubble` for displaying source documents
   - Contextual memory — `MemorySaver` in LangGraph
   - Model/thread management — UI for switching models and threads

### Key Modules

| Component | Purpose |
|-----------|---------|
| `ChatWindow` | Main chat container |
| `ChatMessageBubble` | Message rendering (markdown, code, images) |
| `SourceBubble` | RAG source citations display |
| `AutoResizeTextarea` | Auto-expanding input |
| `InlineCitation` | Inline source links |

### Strengths (What to Adopt)

- **RAG citations UI** — `SourceBubble` and `InlineCitation` — ready components for displaying source documents. Planeta implements `SourceDocumentLink` manually. Pattern for SDK: citation components.
- **Time-travel debugging** — LangGraph threads allow viewing graph state at any point. For Supervisor (JSONL transcripts, session recovery) this pattern is useful.
- **Thread persistence out-of-box** — LangGraph Platform stores threads. Solves pain 2.6 (each project writes own schema).
- **Streaming citations** — sources stream incrementally, don't wait for response end. Good UX pattern.
- **Model switching UI** — component for model selection within thread. Moira and Supervisor have `ModelSelector`, but implemented differently.

### Weaknesses (Our Opportunities)

- **LangGraph lock-in** — tight coupling to LangGraph Cloud/Platform. Doesn't work with other backends. Our SDK is backend-agnostic.
- **Not library, but application** — Agent Chat UI is reference app, not reusable npm package. Copy files, don't import.
- **Limited component set** — no thinking blocks, tool approval, branch navigation, error handling UI.
- **No headless approach** — components styled (Chakra UI / Tailwind). Can't use without their design system.
- **No permission management** — tools execute without user approval.
- **No context window management** — LangGraph manages state, but token budget not covered.
- **No multi-provider** — one LLM provider per deployment. No runtime model switching.
- **Chakra UI / Tailwind dependency** — styling coupling, hard to embed in other design system (Ant Design at Planeta).

### Relevance to Our Use Cases

| Use Case | LangChain Chat Coverage | Our Gap |
|----------|----------------------|---------|
| RAG citations | ✅ SourceBubble, InlineCitation | Need citation component |
| Thread persistence | ✅ LangGraph threads | **P2 — IChatStorage** |
| Streaming | ✅ LangGraph SDK | ✅ Have in agent-sdk |
| Time-travel debug | ✅ Thread state history | Consider for audit/transcripts |
| Multi-provider | ❌ | ✅ Have in agent-sdk |
| Headless components | ❌ | Our approach — headless |
| Permission system | ❌ | Have in agent-sdk |
| Context management | ❌ | **P2 — ContextWindowManager** |
| Error classification | ❌ | **P1 — classifyError()** |

---

## 5. Stream Chat AI SDK

**Product:** GetStream.io · Commercial (free tier available)  
**Packages:** `stream-chat-js`, `stream-chat-react`, `stream-chat-react-native`, `stream-chat-css`, `stream-chat-js-ai-sdk`

### Architecture

Enterprise-grade real-time chat infrastructure + AI agent integration:

1. **Chat Infrastructure** — full-featured real-time chat: channels, threads, reactions, read receipts, typing indicators, push notifications, moderation. API-first: REST + WebSocket.

2. **AI SDK Extension** (`stream-chat-js-ai-sdk`) — bridge between Stream Chat and AI agents:
   - `AIAgent` class — represents AI participant in channel
   - Streaming via channel events
   - Markdown, code blocks, charts rendering
   - Tool calls display

3. **Multi-platform:**
   - `stream-chat-react` — React components
   - `stream-chat-react-native` — React Native
   - iOS SDK (Swift)
   - Android SDK (Kotlin)
   - Flutter SDK

4. **LangChain integration** (`stream-chat-langchain`) — bridge for LangChain agents → Stream Chat channels.

### Key Modules

| Package | Purpose |
|---------|---------|
| `stream-chat-js` | Core JS/TS client |
| `stream-chat-react` | React UI components |
| `stream-chat-react-native` | React Native components |
| `stream-chat-js-ai-sdk` | AI agent integration |
| `stream-chat-langchain` | LangChain bridge |

### Strengths (What to Adopt)

- **Multi-platform** — unified API, native SDK for React, RN, iOS, Android, Flutter. If our SDK targets web-only — not critical, but pattern of headless core + framework bindings worth noting.
- **Production-grade infrastructure** — CDN, edge, auto-scaling, offline support, push notifications. Shows maturity of real-time chat to aspire to.
- **Rich content rendering** — Markdown with syntax highlighting, LaTeX, charts (Mermaid), tables. AI-specific rendering patterns.
- **Moderation built-in** — content moderation, profanity filters, block lists. Moira has moderation pipeline (3 providers), Stream Chat is enterprise standard.
- **Thread model** — parent/reply thread model with read state tracking. Architecturally mature conversation approach.
- **Typing indicators + read receipts** — real-time collaboration features useful for multi-user AI chat.
- **Offline support** — messages queued offline, sync on reconnect. None of our projects have offline support.

### Weaknesses (Our Opportunities)

- **Commercial** — pricing per MAU. For open-source SDK and self-hosted deployment — not suitable.
- **Chat-first, AI-second** — AI agent is chat platform extension, not AI-first SDK. Our approach is AI-first.
- **No tool execution** — displays tool calls, but execution out of scope. Our SDK executes tools.
- **No permission system for AI tools** — no human-in-the-loop approval for AI actions.
- **No context window management** — this is chat infrastructure, not AI orchestration.
- **No multi-LLM support** — AI agent connects as user, not as backend with model switching.
- **No structured output** — no `generateObject()` equivalent.
- **Vendor lock-in** — dependency on GetStream.io API. Self-hosted options limited.
- **Overhead** — for simple AI chat with single user, entire chat infrastructure is overkill.

### Relevance to Our Use Cases

| Use Case | Stream Chat Coverage | Our Gap |
|----------|-------------------|---------|
| Real-time streaming | ✅ WebSocket | ✅ Have in agent-sdk |
| Markdown rendering | ✅ Rich content | Need markdown component |
| Multi-platform | ✅ React, RN, iOS, Android | Web-only first phase |
| Moderation | ✅ Built-in | Moira-specific, not in SDK |
| Offline support | ✅ | Consider for future versions |
| Tool execution | ❌ | ✅ Have in agent-sdk |
| Permission system | ❌ | ✅ Have in agent-sdk |
| Context management | ❌ | **P2 — ContextWindowManager** |
| Multi-provider | ❌ | ✅ Have in agent-sdk |
| Session persistence | Partial (chat persistence) | **P2 — IChatStorage** |

---

## 6. Additional Solutions (Brief Overview)

### Botpress
**Type:** Low-code chatbot platform  
**Approach:** Visual flow builder + NLU engine. Drag-and-drop conversation flows.  
**Relevance:** Minimal. Targets no-code/low-code chatbots, not developer SDK for AI-powered apps. No tool execution, no multi-provider, no streaming.  
**Takeaway:** Visual conversation designer — pattern, but for different abstraction level (flow management vs code-first SDK).

### Rasa
**Type:** Open-source conversational AI framework  
**Approach:** NLU pipeline + dialogue management + custom actions. Python-first.  
**Relevance:** Low. Enterprise NLU/NLP framework for intent-based bots. Not LLM-first, not streaming-first.  
**Takeaway:** Action server pattern — isolation of backend actions in separate service. Similar to our tool execution separation (backend vs frontend tools).

### MirrorFly
**Type:** White-label chat SDK (commercial)  
**Approach:** Pre-built chat UI + messaging infrastructure. Real-time video/voice/text.  
**Relevance:** Minimal. Chat infrastructure vendor, not AI SDK. Competitor to Stream Chat, not our SDK.  
**Takeaway:** White-label pattern — SDK visually adapts to app brand. CSS variables + theming.

### Sendbird
**Type:** In-app chat & messaging API (commercial)  
**Approach:** Chat infrastructure + AI chatbot integration. React UIKit.  
**AI Features:** Sendbird AI Chatbot — LLM integration via knowledge base. Auto-reply, suggested replies.  
**Relevance:** Low-medium. More chat platform + AI addon than AI-first SDK.  
**Takeaway:** Knowledge base integration pattern — structured FAQ/docs → AI context. Similar to RAG, but simplified.

---

## 7. Comparative Feature Matrix

| Feature | Vercel AI SDK | CopilotKit | assistant-ui | LangChain Chat | Stream Chat | Our SDK (Goal) |
|---------|:------------:|:----------:|:------------:|:--------------:|:-----------:|:--------------:|
| **Core** | | | | | | |
| Multi-provider support | ✅ Registry | ✅ 3 providers | ❌ Adapter layer | ❌ LangGraph | ❌ | ✅ 3 backends |
| Streaming | ✅ DSP | ✅ AG-UI | ✅ via adapter | ✅ LangGraph | ✅ WebSocket | ✅ AsyncIterable |
| Structured output | ✅ generateObject | ❌ | ❌ | ❌ | ❌ | ✅ runStructured |
| Tool execution | ✅ Multi-step | ✅ Frontend | ❌ UI only | ✅ LangGraph | ❌ | ✅ Backend+Frontend |
| Error classification | ❌ | ❌ | ❌ | ❌ | ❌ | 🎯 P1 |
| Retry/backoff | ❌ | ❌ | ❌ | ❌ | ❌ | 🎯 P2 |
| **Session** | | | | | | |
| Session persistence (DB) | ❌ | ❌ | ❌ | ✅ LangGraph threads | ✅ Cloud | 🎯 P2 |
| Session resume | ❌ | ❌ | ❌ | ✅ Checkpoints | ❌ | ✅ sessionMode |
| Context window mgmt | ❌ | ❌ | ❌ | ❌ | ❌ | 🎯 P2 |
| Token estimation | ❌ | ❌ | ❌ | ❌ | ❌ | 🎯 P2 |
| **Permissions** | | | | | | |
| Tool permission system | ❌ | ❌ | Partial (HITL) | ❌ | ❌ | ✅ IPermissionStore |
| Permission scopes | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 4 scopes |
| Permission UI | ❌ | ❌ | ✅ Basic | ❌ | ❌ | 🎯 Component |
| **Auth** | | | | | | |
| OAuth flows | ❌ | ❌ | ❌ | ❌ | ✅ Token-based | ✅ Copilot+Claude |
| Auto token refresh | ❌ | ❌ | ❌ | ❌ | ❌ | 🎯 P1 |
| **Transport** | | | | | | |
| Wire protocol | ✅ DSP (SSE) | ✅ AG-UI (SSE) | ❌ via adapter | ✅ LangGraph | ✅ WebSocket | 🎯 P2 |
| Transport abstraction | ✅ ChatTransport | ✅ AG-UI | ✅ Runtime | ❌ | ✅ | 🎯 P2 |
| Reconnection | ❌ | ❌ | ❌ | ❌ | ✅ | 🎯 |
| **UI Components** | | | | | | |
| Headless components | ✅ AI Elements | ❌ Styled | ✅ Primitives | ❌ Styled | ❌ Styled | 🎯 Headless |
| Chat thread | ✅ | ✅ | ✅ | ✅ | ✅ | 🎯 |
| Composer/input | ✅ | ✅ | ✅ | ✅ | ✅ | 🎯 |
| Thinking blocks | ✅ | ❌ | ✅ | ❌ | ❌ | 🎯 |
| Tool call cards | ✅ | ✅ | ✅ | ❌ | Partial | 🎯 |
| Thread sidebar | ❌ | ❌ | ✅ | ✅ | ✅ | 🎯 |
| Markdown rendering | ❌ Bring-your-own | ❌ | ✅ | ✅ | ✅ | 🎯 |
| Source citations | ❌ | ❌ | ❌ | ✅ | ❌ | 🎯 |
| Branch navigation | ❌ | ❌ | ✅ | ❌ | ❌ | Consider |
| Accessibility (a11y) | Partial | Partial | ✅ WAI-ARIA | ❌ | ✅ | 🎯 |
| **Advanced** | | | | | | |
| Agent service pool | ❌ | ❌ | ❌ | ❌ | ❌ | 🎯 P1 |
| Frontend tool execution | ❌ | ✅ | ✅ makeAssistantTool | ❌ | ❌ | 🎯 |
| Tool context DI | ❌ | ❌ | ❌ | ❌ | ❌ | 🎯 P2 |
| AskUser (user input) | ❌ | ❌ | Partial | ❌ | ❌ | ✅ onAskUser |
| Multi-platform | ❌ React | ❌ React | ❌ React | ❌ React | ✅ All | Web first |

**Legend:** ✅ Available · ❌ Not available · Partial Limited · 🎯 Goal for our SDK

---

## 8. Key Insights for Our SDK

### 8.1 No Competitor Covers Full Stack

Each solves part of the problem:

- **Vercel AI SDK** — best in core AI logic (streaming, tools, structured output), weak in persistence and UI.
- **CopilotKit** — best in agent-app integration, weak in headless and customization.
- **assistant-ui** — best in composable UI, but no backend logic.
- **LangChain Chat** — best in RAG/citations, but LangGraph lock-in.
- **Stream Chat** — best in production chat infrastructure, but not AI-first.

**Our opportunity:** Vertically integrated SDK: backend (agent-sdk) + transport + frontend (headless components). Nobody offers such stack out of the box.

### 8.2 Three Uncovered Domains (All Competitors)

1. **Session persistence** — no competitor (except LangGraph Platform) provides DB-backed chat storage. All store messages in React state.

2. **Context window management** — nobody has sliding window, token budget, auto-archival. Critical for production chat (long conversations).

3. **Error classification + retry** — no SDK typifies provider errors and provides built-in retry with backoff. All projects write their own `classifyError()`.

### 8.3 Two UI Approaches: Styled vs Headless

- **Styled** (CopilotKit, LangChain Chat, Stream Chat) — quick start, difficult customization.
- **Headless** (Vercel AI Elements, assistant-ui) — more boilerplate, full control.

**Our choice:** Headless primitives (like assistant-ui) + optional default styles. Reason: 4 of our projects use different design systems (Ant Design, shadcn/ui, custom Tailwind, Chakra UI). Headless is the only option compatible with all.

### 8.4 Transport Protocol — Two Candidates

1. **Vercel Data Stream Protocol** — de-facto standard for Next.js ecosystem. Moira already re-implements it. Simple SSE-based format.
2. **AG-UI Protocol** (CopilotKit) — community-driven open standard. Adoption by Google, AWS, LangChain. More formal specification.

**Recommendation:** Support both through transport abstraction (like Vercel AI SDK v6 `ChatTransport`). Default — own format based on `AgentEvent`, adapters for DSP and AG-UI.

### 8.5 assistant-ui as Reference for UI Architecture

Planeta already uses assistant-ui. Key patterns:

- `AssistantRuntime` — backend abstraction.
- `ExternalStoreRuntime` — bridge from any state manager (MST, Redux, Zustand) to UI.
- `useExternalMessageConverter` — message conversion without changing source format.
- Composable primitives — each component separate, no god-components.

**Recommendation:** Don't compete with assistant-ui in composable UI. Instead — provide `AssistantRuntime` adapter for agent-sdk. Focus of our SDK — backend logic + transport + runtime adapter, not UI layer competition.

### 8.6 CopilotKit Shows Future of Frontend Tools

`useCopilotAction()` + `useCopilotReadable()` — elegant pattern for AI ↔ app integration. Planeta does same via browser tools + ARIA snapshot, but less declaratively.

**Recommendation:** Consider declarative API for frontend tools: `useAgentTool(name, schema, handler)` instead of imperative `makeAssistantTool()`.

---

## 9. What to Adopt from Each Competitor

### From Vercel AI SDK

| What | How to Apply |
|-----|-------------|
| Data Stream Protocol | Build DSP serializer/deserializer into SDK transport layer. Moira stops re-implementing format. |
| ChatTransport abstraction | `AgentChatTransport` interface in SDK: SSE, WebSocket, custom. Same API for all projects. |
| UIMessage / ModelMessage split | Define `ChatUIMessage` (frontend) and `ChatModelMessage` (backend) types in SDK. Solves type duplication (pain 2.1). |
| Provider registry | Already implemented in agent-sdk via `registerBackend()`. Extend model listing. |
| AI Elements headless approach | Headless components: logic + a11y, styles on application. Render props or slot pattern. |
| Multi-step tool loop | Already implemented in Vercel AI backend. Document pattern for other backends. |

### From CopilotKit

| What | How to Apply |
|-----|-------------|
| AG-UI Protocol awareness | Ensure AgentEvent → AG-UI mapping compatibility. Don't implement AG-UI runtime, but can emit AG-UI events. |
| Frontend actions pattern | `useAgentTool(name, schema, handler)` — declarative hook for frontend tools. Planeta can migrate from `makeAssistantTool`. |
| App state awareness | `useAgentContext(key, value)` — hook for exposing app state to AI agent. Alternative to manual page context injection. |
| Chat widget layouts | Provide layout primitives: `ChatOverlay`, `ChatDocked`, `ChatSidebar` — positioning + resize. |

### From assistant-ui

| What | How to Apply |
|-----|-------------|
| AssistantRuntime abstraction | `AgentSDKRuntime` — adapter from agent-sdk streaming to assistant-ui Runtime. Planeta can remove MST bridge. |
| Composable primitives pattern | Follow shadcn/ui approach: each component — separate import, minimal dependencies. |
| useExternalMessageConverter | Convert `AgentEvent[]` → assistant-ui Message format. SDK utility. |
| WAI-ARIA compliance | A11y out-of-box for all SDK UI components. Keyboard navigation, screen reader labels. |
| Branch navigation | BranchPicker for conversation branching. Low priority, but unique feature. |
| makeAssistantTool | Similar API for frontend tool definition + UI rendering. |

### From LangChain Agent Chat UI

| What | How to Apply |
|-----|-------------|
| Citation components | `<SourceCitation>`, `<InlineCitation>` — headless components for RAG source display. Planeta uses `SourceDocumentLink`. |
| Thread persistence model | Threads API pattern: create → messages → state. For `IChatStorage` interface. |
| Time-travel debugging | State snapshot per message — for audit trail and session recovery. Supervisor can use for transcript analysis. |
| Model switching UI pattern | `<ModelSelector>` headless component — dropdown with model listing from `listModels()`. |

### From Stream Chat

| What | How to Apply |
|-----|-------------|
| Rich content rendering patterns | Markdown + LaTeX + Mermaid + code highlighting. Comprehensive rendering pipeline. |
| Typing indicators | `<TypingIndicator>` — shows AI "typing". Simple pattern, improves UX. |
| Reconnection handling | Auto-reconnect + message queue + sync. Pattern for transport layer resilience. |
| Thread model | Parent/reply thread model. Architecturally stable approach for nested conversations. |
| Offline queue | Messages queued offline, sync on reconnect. Future consideration. |

---

## 10. Our SDK Positioning

### Where We Compete

```
                    Backend Logic
                         │
         Stream Chat     │     Vercel AI SDK
         (infrastructure)│     (core AI logic)
                         │
  ──────────────── Full Stack ──────────────────
                         │
         CopilotKit      │     Our SDK (goal)
         (agentic app)   │     (vertically integrated)
                         │
                    Frontend UI
                         │
         LangChain Chat  │     assistant-ui
         (reference app) │     (composable primitives)
```

### Our Unique Value Proposition

1. **Vertically integrated** — from `IAgentService` to `<Thread>` component. No competitor covers full stack.
2. **Multi-backend** — Copilot CLI, Claude CLI, Vercel AI (OpenAI, Anthropic, Google, custom). Unified API.
3. **Permission system** — 4 scope levels, persistent store, inline UI. Nobody has it.
4. **Context window management** — sliding window, token budget, auto-archival. Nobody has it.
5. **Error classification + retry** — typed errors, auto-retry with backoff. Nobody has it.
6. **Session persistence** — `IChatStorage` interface + adapters. Closes gap of all competitors.
7. **Auth flows** — OAuth for Copilot (Device Flow) and Claude (PKCE). Unique for SDK.
8. **Headless UI + default styles** — composable (like assistant-ui) + ready-to-use (like CopilotKit).

### Competitive Risk Factors

| Risk | Probability | Mitigation |
|------|------------|------------|
| Vercel AI SDK adds persistence | High (v7+) | First-mover advantage + deeper integration with agent-sdk backends |
| AG-UI becomes standard | Medium | Ensure compatibility, no lock-in to own protocol |
| assistant-ui adds backend | Low (UI-focused) | Provide runtime adapter, become complementary |
| CopilotKit covers headless | Medium | Our headless will be framework-agnostic (Vercel — React only) |
| Stream Chat AI improves | Low (chat-first) | We're AI-first, different markets |

---

*Analysis based on 4 internal project requirements: Moira (workflow orchestration), Supervisor (agent monitoring), Podcast (content generation), Planeta (construction management).*