/**
 * ThreadProvider Slot Overrides
 *
 * Shows how to replace SDK default renderers with your own components.
 * This is the primary customization mechanism for projects with their own design systems
 * (shadcn/ui, Ant Design, Material UI, custom components).
 *
 * Real-world examples:
 * - claude-supervisor uses react-markdown + rehype-highlight for markdown
 * - moira uses shadcn/ui Card components for tool calls
 */

import { createElement } from 'react';
import type { ChatMessage } from '@witqq/agent-sdk/chat/core';
import type { ToolCallPart, TextPart, ReasoningPart } from '@witqq/agent-sdk/chat/core';

// ============================================================
// Custom Message Renderer
// ============================================================

interface CustomMessageProps {
  message: ChatMessage;
}

/**
 * Example: shadcn/ui-style message bubble
 * In real code, import your Card/Avatar/Badge components from your design system.
 */
function CustomMessage({ message }: CustomMessageProps) {
  const isAssistant = message.role === 'assistant';

  return createElement('div', {
    className: `message ${isAssistant ? 'assistant' : 'user'}`,
    style: {
      display: 'flex',
      gap: '12px',
      padding: '16px',
      borderRadius: '12px',
      background: isAssistant ? '#f8f9fa' : '#e3f2fd',
      marginBottom: '8px',
    },
  },
    // Avatar
    createElement('div', {
      style: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: isAssistant ? '#6366f1' : '#2196f3',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        flexShrink: 0,
      },
    }, isAssistant ? 'AI' : 'U'),

    // Content
    createElement('div', { style: { flex: 1 } },
      ...message.parts.map((part, i) => {
        if (part.type === 'text') {
          return createElement('div', { key: i, dangerouslySetInnerHTML: { __html: (part as TextPart).text } });
        }
        if (part.type === 'reasoning') {
          return createElement('details', { key: i, style: { color: '#666', fontSize: '14px' } },
            createElement('summary', null, 'Thinking...'),
            createElement('p', null, (part as ReasoningPart).text),
          );
        }
        return null;
      }),
    ),
  );
}

// ============================================================
// Custom Tool Call Renderer
// ============================================================

interface CustomToolCallProps {
  part: ToolCallPart;
  onApprove?: () => void;
  onDeny?: () => void;
}

/**
 * Example: Per-tool rendering (like claude-supervisor's ToolRenderers)
 * Different tools get different UI treatments.
 */
function CustomToolCall({ part, onApprove, onDeny }: CustomToolCallProps) {
  const { name: toolName, args, result, status } = part;

  // Choose icon and color based on tool type
  const toolConfig: Record<string, { icon: string; color: string }> = {
    bash: { icon: '💻', color: '#1a1a2e' },
    write: { icon: '📝', color: '#16213e' },
    edit: { icon: '✏️', color: '#0f3460' },
    read: { icon: '📖', color: '#533483' },
    search: { icon: '🔍', color: '#2c3333' },
  };

  const config = toolConfig[toolName] || { icon: '🔧', color: '#374151' };

  return createElement('div', {
    style: {
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden',
      margin: '8px 0',
    },
  },
    // Header
    createElement('div', {
      style: {
        background: config.color,
        color: 'white',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
      },
    },
      createElement('span', null, config.icon),
      createElement('strong', null, toolName),
      status === 'pending' && createElement('span', {
        style: { marginLeft: 'auto', fontSize: '12px', opacity: 0.7 },
      }, '⏳ Running...'),
    ),

    // Args (collapsible)
    args && createElement('details', {
      style: { padding: '8px 12px', fontSize: '13px' },
    },
      createElement('summary', { style: { cursor: 'pointer', color: '#666' } }, 'Arguments'),
      createElement('pre', {
        style: { margin: '4px 0', padding: '8px', background: '#f5f5f5', borderRadius: '4px', overflow: 'auto' },
      }, typeof args === 'string' ? args : JSON.stringify(args, null, 2)),
    ),

    // Result
    result && createElement('div', {
      style: { padding: '8px 12px', fontSize: '13px', borderTop: '1px solid #e5e7eb' },
    },
      createElement('pre', {
        style: { margin: 0, padding: '8px', background: '#f0fdf4', borderRadius: '4px', overflow: 'auto', maxHeight: '200px' },
      }, typeof result === 'string' ? result : JSON.stringify(result, null, 2)),
    ),

    // Approval buttons
    status === 'requires_approval' && createElement('div', {
      style: { padding: '8px 12px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px' },
    },
      createElement('button', {
        onClick: onApprove,
        style: { padding: '4px 16px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
      }, '✓ Approve'),
      createElement('button', {
        onClick: onDeny,
        style: { padding: '4px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
      }, '✗ Deny'),
    ),
  );
}

// ============================================================
// Wiring: ThreadProvider with custom renderers
// ============================================================

/**
 * Usage with ThreadProvider:
 *
 * ```tsx
 * import { ThreadProvider, Thread, ChatProvider } from '@witqq/agent-sdk/chat/react';
 *
 * function App() {
 *   return (
 *     <ChatProvider runtime={runtime}>
 *       <ThreadProvider
 *         renderMessage={(msg) => <CustomMessage message={msg} />}
 *         renderToolCall={(part, { onApprove, onDeny }) => (
 *           <CustomToolCall part={part} onApprove={onApprove} onDeny={onDeny} />
 *         )}
 *         renderThinkingBlock={({ text, isStreaming }) => (
 *           <details open={isStreaming}>
 *             <summary>{isStreaming ? 'Thinking...' : 'Thought process'}</summary>
 *             <p style={{ color: '#888', fontStyle: 'italic' }}>{text}</p>
 *           </details>
 *         )}
 *       >
 *         <Thread messages={messages} />
 *       </ThreadProvider>
 *     </ChatProvider>
 *   );
 * }
 * ```
 */

export { CustomMessage, CustomToolCall };
