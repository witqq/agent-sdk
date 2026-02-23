# Projects Analysis: Agent SDK Integration Patterns

This document analyzes four production projects using `@witqq/agent-sdk` to identify common patterns, pain points, and gaps that inform the SDK's evolution.

## Executive Summary

Four projects demonstrate diverse use cases for AI agents: workflow orchestration (MCP Moira), agent supervision (Claude Supervisor), content generation (News Podcast), and enterprise analytics (Planeta Analysis). Each project has developed sophisticated patterns for multi-provider AI, streaming, tool execution, and error handling.

**Key findings:**
- All projects require multi-provider support with runtime switching
- Permission management is critical but implemented differently across projects
- Error handling and retry patterns are consistently needed but reimplemented
- Chat UI components follow similar patterns but lack standardization
- Context window management is universally challenging

---

## 1. Project Overview

### 1.1 MCP Moira — Workflow Engine + Web Chat

**Purpose:** AI workflow engine with graphical workflow editor and multi-provider web chat interface.

**Tech Stack:**
- **Frontend:** React 18, Tailwind CSS 4, Radix UI, React Flow
- **Backend:** Node.js, Express, SQLite, Drizzle ORM
- **AI:** `@witqq/agent-sdk` v0.6.0, Vercel AI SDK v6, Copilot SDK, Claude SDK

**AI Integration:** Central component using all three agent-sdk backends (Claude, Copilot, Vercel AI). Supports 6 provider types with unified abstraction through agent-sdk.

**Key Patterns:**
- Registry + Factory pattern for agent services
- Data Stream Protocol for SSE streaming
- Tool context closure pattern for per-request dependency injection
- Multi-layer quota enforcement

### 1.2 Claude Supervisor — AI Agent Supervision

**Purpose:** Platform for managing and supervising AI agents (Claude Code, GitHub Copilot CLI) with web UI and Telegram integration.

**Tech Stack:**
- **Frontend:** React 19, Vite 7, React Router 7, TailwindCSS 4
- **Backend:** Node.js, Express, NATS Message Bus, SQLite
- **AI:** `@witqq/agent-sdk` v0.5.2, all three backends

**AI Integration:** Comprehensive use of agent-sdk for both supervised agents and permission evaluator. The supervisor agent itself is powered by agent-sdk with structured output.

**Key Patterns:**
- NATS-based event streaming
- Three-tier permission system (auto → LLM → escalate)
- Session state machine with recovery
- Provider abstraction via service pool

### 1.3 News Podcast — AI Content Generation Pipeline

**Purpose:** Automated news podcast generation using AI for research, content creation, transcription, and voice synthesis.

**Tech Stack:**
- **Monorepo:** Backend (Express), Frontend (React), Telegram Bot
- **AI:** `@witqq/agent-sdk` v0.6.1, multiple providers
- **TTS:** XTTS, RunPod, Yandex SpeechKit

**AI Integration:** Multi-stage AI pipeline with per-stage provider configuration. Uses agent-sdk for unified multi-provider access with comprehensive error handling.

**Key Patterns:**
- Pipeline pattern with checkpoint recovery
- Per-stage provider configuration
- Factory pattern for voice providers
- Exponential backoff retry

### 1.4 Planeta Analysis — Enterprise Analytics + AI Chat

**Purpose:** Enterprise OLAP analytics platform with embedded AI chat for data analysis and browser automation.

**Tech Stack:**
- **Frontend:** React 17, MobX State Tree, Ant Design, @assistant-ui/react
- **Backend:** Express, SQLite, LanceDB (vector storage)
- **AI:** Vercel AI SDK 5 (direct, not agent-sdk)

**AI Integration:** Direct Vercel AI SDK usage without agent-sdk abstraction. Sophisticated browser automation and RAG capabilities.

**Key Patterns:**
- MST ↔ assistant-ui bridge
- Dynamic system prompt assembly
- Stateless HTTP roundtrip for tools
- Multi-layer context injection

---

## 2. Agent SDK Usage Analysis

### 2.1 Adoption Patterns

| Project | SDK Version | Backends Used | Primary Use Case |
|---------|-------------|---------------|------------------|
| **MCP Moira** | v0.6.0 | All 3 (Claude, Copilot, Vercel AI) | Multi-provider web chat |
| **Claude Supervisor** | v0.5.2 | All 3 | Agent supervision + permission evaluation |
| **News Podcast** | v0.6.1 | All 3 | Multi-stage content pipeline |
| **Planeta Analysis** | ❌ None | Vercel AI SDK direct | Enterprise analytics chat |

### 2.2 Key SDK Modules Utilized

| Module | Moira | Supervisor | Podcast | Purpose |
|--------|-------|------------|---------|---------|
| `createAgentService()` | ✅ | ✅ | ✅ | Service factory with registry |
| `IAgentService/IAgent` | ✅ | ✅ | ✅ | Core interfaces |
| `AgentEvent` types | ✅ | ✅ | ✅ | Streaming event handling |
| `ToolDefinition` | ✅ | ✅ | ✅ | Tool schema definition |
| `@witqq/agent-sdk/auth` | ✅ | ✅ | ✅ | OAuth flows (Copilot, Claude) |
| `runStructured()` | ❌ | ✅ | ❌ | Zod-based structured output |
| Permission system | ❌ | ❌ | ❌ | Not used by any project |

### 2.3 What's NOT Used from SDK

- **Permission system:** All projects implement custom permission management
- **Built-in error types:** Projects define their own error classification
- **Context management:** Projects handle token estimation and sliding windows
- **Chat UI components:** All projects build custom React components

---

## 3. Common Use Cases Analysis

### 3.1 Core Chat Functionality

| Use Case | Priority | Projects Using | SDK Support |
|----------|----------|----------------|-------------|
| Multi-provider switching | P1 | All 4 | ✅ Full |
| Streaming responses | P1 | All 4 | ✅ Full |
| Model listing | P1 | 3/4 | ✅ Full |
| Session persistence | P2 | 2/4 | ✅ Backend only |
| Chat history (DB) | P2 | 3/4 | ❌ App responsibility |

### 3.2 Tool Execution

| Use Case | Priority | Projects Using | SDK Support |
|----------|----------|----------------|-------------|
| Backend tools | P1 | All 4 | ✅ Full |
| Frontend tools | P2 | 1/4 (Planeta) | ❌ None |
| Tool permissions | P1 | 2/4 | ✅ Interface only |
| Tool context injection | P2 | 1/4 (Moira) | ❌ None |
| Specialized tool UI | P2 | 3/4 | ❌ None |

### 3.3 Error Handling

| Use Case | Priority | Projects Using | SDK Support |
|----------|----------|----------------|-------------|
| Error classification | P1 | 2/4 | ✅ Basic hierarchy |
| Retry with backoff | P1 | 2/4 | ❌ Declared but not implemented |
| Token refresh | P1 | All 4 | ✅ Manual method only |
| Partial message persistence | P2 | 2/4 | ❌ None |
| Context overflow recovery | P2 | 1/4 (Planeta) | ❌ None |

### 3.4 Authentication

| Use Case | Priority | Projects Using | SDK Support |
|----------|----------|----------------|-------------|
| Copilot Device Flow | P1 | 3/4 | ✅ Full |
| Claude OAuth+PKCE | P1 | 3/4 | ✅ Full |
| Token persistence | P1 | All 4 | ❌ App responsibility |
| Auto token refresh | P1 | All 4 | ✅ Method only, no automation |

---

## 4. Architecture Patterns

### 4.1 Agent Service Management

**Registry + Factory Pattern** (Used by 3/4 projects):
```typescript
// Common pattern across projects
AgentServiceRegistry.resolveForUser(userId) → cached IAgentService
AgentServicePool.getService(provider, config) → per-key caching
AgentFactory.createService(provider) → singleton per provider
```

**Key benefits:**
- Service reuse and resource management
- Provider abstraction
- Configuration isolation

### 4.2 Streaming Architecture

**Event Processing Pipeline**:
```
SDK AgentEvent → Event Adapter → Transport Protocol → UI Components
```

**Variations:**
- **Moira:** AgentEvent → Data Stream Protocol → SSE → React
- **Supervisor:** AgentEvent → NATS events → WebSocket → React  
- **Podcast:** AgentEvent → logging/callback → pipeline progression
- **Planeta:** Direct SSE → MST store → assistant-ui

### 4.3 Error Handling Patterns

**Classification + Retry**:
```typescript
// Repeated pattern in Supervisor and Podcast
classifyError(error) → typed error → retry logic → fallback
```

**Common error types:**
- `TimeoutError`
- `RateLimitError` 
- `AuthError`
- `NetworkError`
- `AgentError` (generic)

### 4.4 Permission Management

**Three distinct approaches:**

1. **Auto-approve everything** (Moira, Podcast)
2. **Three-tier evaluation** (Supervisor): auto → LLM → user
3. **Two-level permissions** (Planeta): client (localStorage) + server (SQLite)

---

## 5. Key Pain Points

### 5.1 Type Duplication (P1)

**Problem:** Projects redefine SDK types locally to avoid runtime dependencies.

**Examples:**
- **Moira:** `AgentLike`, `ContextMessage`, `ChatToolDefinition` in `packages/shared`
- **Supervisor:** Event categorization through `categorizeSDKMessage()`

**Impact:** Type drift risk, maintenance burden

**Solution needed:** SDK type-only exports or separate type package

### 5.2 Error Handling Inconsistency (P1)

**Problem:** Each project implements custom error classification.

**Examples:**
- **Supervisor:** `classifyError()` for auth, network, rate limit
- **Podcast:** `AgentFactory.classifyError()` with exponential backoff

**Impact:** Code duplication, inconsistent UX

**Solution needed:** Built-in error classification in SDK

### 5.3 Context Window Management (P1)

**Problem:** Token estimation and sliding window logic reimplemented.

**Examples:**
- **Moira:** `~4 chars/token` heuristic + auto-archival
- **Planeta:** `~3.5 chars/token` + emergency trim

**Impact:** Inaccurate estimates, memory issues

**Solution needed:** Built-in context management with proper tokenization

### 5.4 Tool Definition Fragmentation (P2)

**Problem:** Multiple tool definition patterns across projects.

**Examples:**
- **Server tools:** Zod schemas (SDK native)
- **Frontend tools:** JSON Schema + makeAssistantTool (assistant-ui)
- **Context tools:** Factory pattern for DI (custom)

**Impact:** Learning curve, tool ecosystem fragmentation

### 5.5 Auth Token Management (P2)

**Problem:** Complex token refresh logic reimplemented per project.

**Examples:**
- **Moira:** ~40 lines inline refresh in `AgentServiceRegistry`
- **Supervisor:** Manual refresh through agent-sdk auth
- **Podcast:** Proactive check before each Claude call

**Impact:** Auth bugs, token expiration issues

**Solution needed:** Automatic token refresh with callback notifications

### 5.6 Chat UI Component Duplication (P2)

**Problem:** Similar React components reimplemented across projects.

**Common patterns:**
- Message lists with auto-scroll
- Chat input with send/stop
- Tool call cards with status
- Model selector dropdowns
- Error displays

**Impact:** Inconsistent UX, maintenance burden

---

## 6. Priority Gap Analysis

### P1 (Critical) - Must Address

| Gap | Projects Affected | Description |
|-----|-------------------|-------------|
| **Built-in error classification** | Supervisor, Podcast | SDK should classify provider errors into typed hierarchy |
| **Automatic token refresh** | All 3 using auth | SDK should handle token refresh automatically with callbacks |
| **Context window management** | Moira, Planeta | SDK should provide token estimation and sliding window |
| **Type-only exports** | Moira, Supervisor | Separate runtime-free type exports for shared packages |

### P2 (Important) - Should Address

| Gap | Projects Affected | Description |
|-----|-------------------|-------------|
| **Frontend tool execution** | Planeta | SDK should support client-side tool execution patterns |
| **Tool context injection** | Moira | SDK should support dependency injection for tools |
| **Retry with backoff** | Supervisor, Podcast | Implement declared `retryLLM` functionality |
| **Permission automation** | Supervisor | LLM-based permission evaluation patterns |

### P3 (Nice to Have) - Could Address

| Gap | Projects Affected | Description |
|-----|-------------------|-------------|
| **Chat UI components** | All 4 | Reusable React components for common chat patterns |
| **Data Stream Protocol** | Moira | Built-in support for Vercel AI streaming protocol |
| **Session recovery** | Supervisor, Podcast | Standardized checkpoint/recovery patterns |
| **RAG integration** | Planeta | Built-in document processing and vector search |

---

## 7. Recommendations

### 7.1 Immediate Actions (P1)

1. **Implement built-in error classification** with provider-specific error mapping
2. **Add automatic token refresh** with configurable callbacks and retry policies  
3. **Create type-only export paths** (`@witqq/agent-sdk/types`) for shared packages
4. **Implement context window management** with proper tokenization support

### 7.2 Medium-term Goals (P2)

1. **Design frontend tool execution** patterns and APIs
2. **Implement retry mechanisms** with exponential backoff
3. **Create tool context injection** system for dependency injection
4. **Standardize permission evaluation** patterns

### 7.3 Long-term Vision (P3)

1. **Develop chat UI component library** with framework-agnostic patterns
2. **Create reference architectures** for common use cases
3. **Build RAG integration helpers** for document processing
4. **Establish plugin ecosystem** for extending SDK capabilities

---

## 8. Success Metrics

### 8.1 Adoption Metrics
- **Reduced boilerplate:** Measure lines of custom error handling, auth logic, and type definitions
- **Time to integration:** Track how quickly new projects can integrate basic chat functionality
- **Breaking changes:** Minimize API changes that require project updates

### 8.2 Quality Metrics  
- **Error consistency:** Standardized error types across all projects
- **Token accuracy:** Improved context window management vs character-based heuristics
- **Auth reliability:** Reduced token expiration issues and auth failures

### 8.3 Ecosystem Health
- **Pattern reuse:** Common architectural patterns adopted across projects
- **Component reuse:** Shared UI components reducing duplicate development
- **Community contributions:** External contributions to SDK and patterns

---

This analysis demonstrates that `@witqq/agent-sdk` has achieved strong adoption across diverse use cases but reveals systematic gaps that, when addressed, will significantly improve developer experience and reduce maintenance burden across the ecosystem.