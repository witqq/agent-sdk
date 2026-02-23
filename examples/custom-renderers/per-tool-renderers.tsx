/**
 * Per-Tool Renderers
 *
 * Different tools get different visual treatments.
 * This pattern is used by claude-supervisor (Write/Edit/Bash renderers)
 * and moira (ToolCallCard with type-specific formatting).
 *
 * Usage:
 *   <ThreadProvider renderToolCall={(part) => <PerToolRenderer part={part} />}>
 *     <Thread messages={messages} />
 *   </ThreadProvider>
 */

import { createElement } from 'react';
import type { ToolCallPart } from '@witqq/agent-sdk/chat/core';

// Tool-specific renderers
const toolRenderers: Record<string, (part: ToolCallPart) => ReturnType<typeof createElement>> = {
  bash: renderBashTool,
  write: renderWriteTool,
  edit: renderEditTool,
  read: renderReadTool,
};

/** Main dispatcher: routes to tool-specific renderer or generic fallback */
export function PerToolRenderer({ part }: { part: ToolCallPart }) {
  const renderer = toolRenderers[part.toolName];
  if (renderer) return renderer(part);
  return renderGenericTool(part);
}

// ============================================================
// Bash Tool — terminal-style display
// ============================================================

function renderBashTool(part: ToolCallPart) {
  const command = typeof part.args === 'object' && part.args !== null
    ? (part.args as Record<string, unknown>).command as string
    : String(part.args);

  return createElement('div', { style: { margin: '8px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' } },
    // Terminal header
    createElement('div', {
      style: { background: '#1a1a2e', color: '#22c55e', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
    },
      createElement('span', null, '💻'),
      createElement('code', null, 'bash'),
      part.status === 'pending' && createElement('span', { style: { marginLeft: 'auto', animation: 'pulse 1s infinite' } }, '⏳'),
    ),
    // Command
    createElement('pre', {
      style: { margin: 0, padding: '12px', background: '#0d1117', color: '#c9d1d9', fontSize: '13px', fontFamily: 'monospace' },
    }, `$ ${command}`),
    // Output
    part.result && createElement('pre', {
      style: { margin: 0, padding: '12px', background: '#0d1117', color: '#8b949e', fontSize: '12px', fontFamily: 'monospace', borderTop: '1px solid #21262d', maxHeight: '200px', overflow: 'auto' },
    }, String(part.result)),
  );
}

// ============================================================
// Write Tool — file creation display
// ============================================================

function renderWriteTool(part: ToolCallPart) {
  const args = part.args as Record<string, unknown> | undefined;
  const filePath = args?.path || args?.file_path || 'unknown';

  return createElement('div', { style: { margin: '8px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #16213e' } },
    createElement('div', {
      style: { background: '#16213e', color: '#60a5fa', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
    },
      createElement('span', null, '📝'),
      createElement('code', null, `Created: ${filePath}`),
    ),
    part.result && createElement('div', {
      style: { padding: '8px 12px', fontSize: '12px', color: '#22c55e', background: '#0f1a0f' },
    }, '✓ File created successfully'),
  );
}

// ============================================================
// Edit Tool — diff-style display
// ============================================================

function renderEditTool(part: ToolCallPart) {
  const args = part.args as Record<string, unknown> | undefined;
  const filePath = args?.path || args?.file_path || 'unknown';
  const oldStr = args?.old_str as string | undefined;
  const newStr = args?.new_str as string | undefined;

  return createElement('div', { style: { margin: '8px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #0f3460' } },
    createElement('div', {
      style: { background: '#0f3460', color: '#93c5fd', padding: '6px 12px', fontSize: '13px' },
    },
      createElement('span', null, '✏️ '),
      createElement('code', null, `Edited: ${filePath}`),
    ),
    oldStr && createElement('pre', {
      style: { margin: 0, padding: '8px 12px', background: '#2d1215', color: '#fca5a5', fontSize: '12px', fontFamily: 'monospace' },
    }, `- ${oldStr.slice(0, 200)}${oldStr.length > 200 ? '...' : ''}`),
    newStr && createElement('pre', {
      style: { margin: 0, padding: '8px 12px', background: '#0f1a0f', color: '#86efac', fontSize: '12px', fontFamily: 'monospace' },
    }, `+ ${newStr.slice(0, 200)}${newStr.length > 200 ? '...' : ''}`),
  );
}

// ============================================================
// Read Tool — file content display
// ============================================================

function renderReadTool(part: ToolCallPart) {
  const args = part.args as Record<string, unknown> | undefined;
  const filePath = args?.path || args?.file_path || 'unknown';

  return createElement('div', { style: { margin: '8px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' } },
    createElement('div', {
      style: { background: '#1a1a2e', color: '#a78bfa', padding: '6px 12px', fontSize: '13px' },
    },
      createElement('span', null, '📖 '),
      createElement('code', null, `Read: ${filePath}`),
    ),
    part.result && createElement('pre', {
      style: { margin: 0, padding: '8px 12px', background: '#0d1117', color: '#c9d1d9', fontSize: '12px', fontFamily: 'monospace', maxHeight: '300px', overflow: 'auto' },
    }, String(part.result).slice(0, 1000)),
  );
}

// ============================================================
// Generic fallback
// ============================================================

function renderGenericTool(part: ToolCallPart) {
  return createElement('div', { style: { margin: '8px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #374151' } },
    createElement('div', {
      style: { background: '#374151', color: '#d1d5db', padding: '6px 12px', fontSize: '13px' },
    },
      createElement('span', null, '🔧 '),
      createElement('strong', null, part.toolName),
    ),
    part.args && createElement('details', { style: { padding: '8px 12px', fontSize: '12px' } },
      createElement('summary', { style: { cursor: 'pointer', color: '#9ca3af' } }, 'Arguments'),
      createElement('pre', { style: { margin: '4px 0', fontSize: '12px', fontFamily: 'monospace' } },
        JSON.stringify(part.args, null, 2)),
    ),
    part.result && createElement('div', {
      style: { padding: '8px 12px', fontSize: '12px', borderTop: '1px solid #374151' },
    }, createElement('pre', { style: { margin: 0, fontFamily: 'monospace', maxHeight: '200px', overflow: 'auto' } },
      typeof part.result === 'string' ? part.result : JSON.stringify(part.result, null, 2))),
  );
}
