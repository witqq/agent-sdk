# Custom Renderer Examples

Demonstrates how to plug custom design systems into SDK headless components.

The SDK provides headless components with `data-*` attributes. You style them via CSS or replace them entirely using `ThreadProvider` slot overrides.

## Approaches

### 1. CSS-Only Styling (`css-theme/`)

Override `data-*` attribute selectors. Zero React code needed.

### 2. ThreadProvider Slot Overrides (`slot-overrides.tsx`)

Replace default renderers with your own components via `ThreadProvider`:
- `renderMessage` — custom message bubble
- `renderToolCall` — custom tool call card
- `renderThinkingBlock` — custom thinking/reasoning block

### 3. Per-Tool Renderers (`per-tool-renderers.tsx`)

Different UI for different tool types (like claude-supervisor's Write/Edit/Bash renderers).

## Key Concept

SDK components are **headless** — they handle state, events, and accessibility.
Your components handle **visual rendering** — colors, fonts, layout.

```tsx
// Default: SDK renders with data-* attributes
<Thread messages={messages} />

// Custom: You provide render functions
<ThreadProvider
  renderMessage={(msg) => <MyMessage msg={msg} />}
  renderToolCall={(part) => <MyToolCall part={part} />}
>
  <Thread messages={messages} />
</ThreadProvider>
```
