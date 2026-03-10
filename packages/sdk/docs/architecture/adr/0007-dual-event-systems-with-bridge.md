---
title: "ADR-0007: Separate Agent and Chat Event Types with Bridge"
status: accepted
---

# ADR-0007: Separate Agent and Chat Event Types with Bridge

## Status
Accepted

## Context
- The SDK has two abstraction levels: low-level agent operations (run/stream with tools) and high-level chat conversations (sessions, messages, UI updates)
- `AgentEvent` types (`text_delta`, `tool_call_start`, `tool_call_end`, `usage`, `thinking_*`) model raw LLM stream output
- `ChatEvent` types (`message:start`, `message:delta`, `tool:start`, `tool:complete`, `done`) model chat-level state changes
- Chat events need additional concerns: session context, message accumulation, part status tracking
- Agent backends (Copilot, Claude, Vercel AI) should not know about chat concepts
- Quality attributes affected: QA-1 (Maintainability), Separation of Concerns

## Decision
Maintain two separate event type systems: `AgentEvent` (18 types) for low-level agent operations and `ChatEvent` (18 types with colon-separated names) for chat-level operations. A bridge module (`src/chat/bridge.ts`) provides bidirectional conversion: `agentEventToChatEvent()` and `chatEventToAgentEvent()`.

## Options Considered

### Option 1: Single Unified Event Type
- Pros: One event type to learn; no bridge needed; simpler mental model; no conversion overhead
- Cons: Agent backends forced to know about chat concepts (sessions, message parts); event type grows unbounded as either layer adds features; breaking changes in chat propagate to agent consumers; violates Separation of Concerns between bounded contexts

### Option 2: Separate Types with Bridge (chosen)
- Pros: Agent Core and Chat Domain evolve independently; backends only deal with `AgentEvent`; chat layer can add events (e.g., `session:created`) without touching agent types; bridge is the single translation point — easy to test and maintain
- Cons: Two event type hierarchies to learn; bridge conversion has runtime cost (negligible — object creation per event); `chatEventToAgentEvent()` returns `null` for chat-only events (lossy reverse mapping)

### Option 3: Event Inheritance Hierarchy
- Pros: ChatEvent extends AgentEvent — automatic compatibility; no bridge needed for forward direction
- Cons: TypeScript lacks proper discriminated union inheritance; `instanceof` checks unreliable across bundles; tight coupling between layers — agent event changes cascade to chat events; discriminant field collisions between levels

## Consequences
- Positive: Agent backends (Copilot, Claude, VercelAI) are completely unaware of chat concepts. `MessageAccumulator` translates events into progressive `ChatMessage` builds. Each layer has its own event naming convention (snake_case agent vs colon:separated chat).
- Negative: New events must be added in both types and the bridge. `chatEventToAgentEvent()` returns null for events without agent equivalents (e.g., `done`), requiring null checks in consumers.
- Risks: Bridge can become a bottleneck if event types diverge significantly. Must keep bridge tests comprehensive — currently tested via accumulator integration tests.

## Related
- [Bounded Context Map](../bounded-context-map.md) — ChatTypes↔AgentCore boundary is where the bridge operates
- [ADR-0001](./0001-independent-sibling-interfaces.md) — different event types contribute to independent interfaces
- [ADR-0003](./0003-cli-subprocess-backends.md) — backends emit AgentEvent, never ChatEvent
