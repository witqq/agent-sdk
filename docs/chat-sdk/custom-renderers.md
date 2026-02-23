# Custom Renderers Guide

The SDK provides headless React components that handle state, events, and accessibility. You control visual rendering through three approaches: CSS attribute selectors, slot overrides, and per-tool dispatch.

## Approach 1: CSS-Only Theming

All SDK components use `data-*` attributes instead of class names. Override these selectors in your stylesheet without any React code.

```css
/* Dark theme via attribute selectors */
[data-thread] {
  background: #1a1a2e;
  color: #e2e8f0;
}

[data-thread-message][data-role="assistant"] {
  background: #16213e;
  border-left: 3px solid #6366f1;
  padding: 12px;
  margin: 8px 0;
}

[data-thread-message][data-role="user"] {
  background: #0f3460;
  border-left: 3px solid #2196f3;
  padding: 12px;
  margin: 8px 0;
}

[data-tool-status="pending"] {
  opacity: 0.7;
  animation: pulse 1s infinite;
}

[data-thinking][data-streaming="true"] summary {
  color: #fbbf24;
}

[data-action="send"] {
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
}
```

See `examples/custom-renderers/css-theme/dark-theme.css` for a complete dark theme.

Available data attributes:

| Component | Attribute | Values |
|-----------|-----------|--------|
| Thread | `data-thread` | — |
| Thread message | `data-thread-message`, `data-role` | `user`, `assistant`, `system` |
| Thread loading | `data-thread-loading` | — |
| Message | `data-role`, `data-status` | role + `pending`, `streaming`, `complete`, `error` |
| ThinkingBlock | `data-thinking`, `data-streaming` | `true`, `false` |
| ToolCallView | `data-tool-status`, `data-tool-name` | status + tool name string |
| Composer send | `data-action` | `send` |
| Composer stop | `data-action` | `stop` |
| MarkdownRenderer | `data-md-heading`, `data-md-paragraph`, etc. | — |
| ModelSelector | `data-model-selector-trigger`, `data-model-selector-dropdown`, `data-model-selector-item`, `data-tier` | tier string |
| AuthDialog | `data-auth-dialog`, `data-auth-selector`, `data-auth-backend`, `data-auth-selected`, `data-auth-content`, `data-auth-status`, `data-auth-flow`, `data-auth-error-display` | — |
| ThreadList | `data-session-item`, `data-session-active` | — |

## Approach 2: ThreadProvider Slot Overrides

Replace default renderers with your components via `ThreadProvider`. Wraps `Thread` and injects render functions through React context.

```tsx
import { createElement } from 'react';
import {
  ChatProvider, ThreadProvider, Thread, Composer,
} from '@witqq/agent-sdk/chat/react';
import type { ChatMessage, ToolCallPart, ReasoningPart } from '@witqq/agent-sdk/chat/core';

function CustomMessage({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === 'assistant';
  return createElement('div', {
    className: `msg ${isAssistant ? 'assistant' : 'user'}`,
  },
    createElement('span', { className: 'avatar' }, isAssistant ? 'AI' : 'U'),
    createElement('div', { className: 'content' },
      ...message.parts.map((part, i) => {
        if (part.type === 'text') {
          return createElement('p', { key: i }, part.text);
        }
        return null;
      }),
    ),
  );
}

function App({ runtime }) {
  return createElement(ChatProvider, { runtime },
    createElement(ThreadProvider, {
      renderMessage: (msg) => createElement(CustomMessage, { message: msg }),
      renderToolCall: (part: ToolCallPart) =>
        createElement('div', { className: 'tool-card' },
          createElement('strong', null, part.toolName),
          part.result && createElement('pre', null, String(part.result)),
        ),
      renderThinkingBlock: (part: ReasoningPart) =>
        createElement('details', null,
          createElement('summary', null, 'Reasoning'),
          createElement('p', null, part.text),
        ),
    },
      createElement(Thread, { messages: [], autoScroll: true }),
    ),
    createElement(Composer, { onSend: () => {} }),
  );
}
```

### ThreadSlotOverrides Interface

```typescript
interface ThreadSlotOverrides {
  renderMessage?: (message: ChatMessage, index: number) => ReactNode;
  renderToolCall?: (part: ToolCallPart, index: number) => ReactNode;
  renderThinkingBlock?: (part: ReasoningPart, index: number) => ReactNode;
}
```

Access slots programmatically via `useThreadSlots()` (throws outside provider) or `useOptionalThreadSlots()` (returns null).

## Approach 3: Per-Tool Dispatch

Route different tools to different renderers. Useful when tools like `bash`, `write`, `edit`, `read` need distinct visual treatments.

```tsx
import { createElement } from 'react';
import type { ToolCallPart } from '@witqq/agent-sdk/chat/core';

const toolRenderers: Record<string, (part: ToolCallPart) => ReturnType<typeof createElement>> = {
  bash: (part) => createElement('pre', {
    style: { background: '#0d1117', color: '#22c55e', padding: '12px' },
  }, `$ ${(part.args as Record<string, unknown>)?.command}\n${part.result ?? ''}`),

  write: (part) => createElement('div', { className: 'file-created' },
    createElement('code', null, `Created: ${(part.args as Record<string, unknown>)?.path}`),
  ),

  edit: (part) => createElement('div', { className: 'file-edited' },
    createElement('code', null, `Edited: ${(part.args as Record<string, unknown>)?.path}`),
  ),
};

function PerToolRenderer({ part }: { part: ToolCallPart }) {
  const render = toolRenderers[part.toolName];
  if (render) return render(part);
  // Generic fallback
  return createElement('div', null,
    createElement('strong', null, part.toolName),
    part.args && createElement('pre', null, JSON.stringify(part.args, null, 2)),
  );
}

// Wire into ThreadProvider:
// <ThreadProvider renderToolCall={(part) => <PerToolRenderer part={part} />}>
```

See `examples/custom-renderers/per-tool-renderers.tsx` for a complete implementation with bash terminal, file creation, diff-style edit, and file read renderers.

## Working Examples

| Path | Description |
|------|-------------|
| `examples/custom-renderers/css-theme/dark-theme.css` | CSS-only dark theme |
| `examples/custom-renderers/slot-overrides.tsx` | ThreadProvider slot overrides with shadcn/ui-style components |
| `examples/custom-renderers/per-tool-renderers.tsx` | Per-tool dispatch with 4 tool-specific renderers |
