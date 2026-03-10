#!/usr/bin/env node

/**
 * Sync TypeDoc-generated API reference markdown into Starlight content pages.
 *
 * Reads docs/api/ output, adds Starlight frontmatter, rewrites internal links,
 * and writes to packages/docs-site/src/content/docs/api-reference/.
 *
 * Usage: node packages/docs-site/scripts/sync-api-docs.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = join(import.meta.dirname, "../../..");
const API_SRC = join(ROOT, "packages/sdk/docs/api");
const API_DEST = join(ROOT, "packages/docs-site/src/content/docs/api-reference");

/** File mapping: source (relative to docs/api/) → destination (relative to api-reference/) + metadata */
const FILES = [
  { src: "index.md", dest: "core.md", title: "Core Exports", desc: "Main SDK types, errors, and registry functions", order: 1 },
  { src: "auth.md", dest: "auth.md", title: "Auth", desc: "Authentication tokens, providers, and OAuth flows", order: 2 },
  { src: "backends/copilot.md", dest: "backends/copilot.md", title: "Copilot Backend", desc: "GitHub Copilot CLI backend service", order: 10 },
  { src: "backends/claude.md", dest: "backends/claude.md", title: "Claude Backend", desc: "Claude CLI backend service", order: 11 },
  { src: "backends/vercel-ai.md", dest: "backends/vercel-ai.md", title: "Vercel AI Backend", desc: "Vercel AI SDK backend service", order: 12 },
  { src: "backends/mock-llm.md", dest: "backends/mock-llm.md", title: "Mock LLM Backend", desc: "Mock backend for testing", order: 13 },
  { src: "chat.md", dest: "chat/index-exports.md", title: "Chat Barrel Exports", desc: "All chat module re-exports", order: 20 },
  { src: "chat/core.md", dest: "chat/core.md", title: "Chat Core", desc: "Core chat types — messages, sessions, options", order: 21 },
  { src: "chat/runtime.md", dest: "chat/runtime.md", title: "Chat Runtime", desc: "Chat runtime factory and backend adapter types", order: 22 },
  { src: "chat/events.md", dest: "chat/events.md", title: "Chat Events", desc: "Chat event types for streaming", order: 23 },
  { src: "chat/errors.md", dest: "chat/errors.md", title: "Chat Errors", desc: "Chat-specific error types", order: 24 },
  { src: "chat/sessions.md", dest: "chat/sessions.md", title: "Chat Sessions", desc: "Session store interfaces and in-memory implementation", order: 25 },
  { src: "chat/storage.md", dest: "chat/storage.md", title: "Chat Storage", desc: "Persistent chat storage interfaces", order: 26 },
  { src: "chat/state.md", dest: "chat/state.md", title: "Chat State", desc: "Reactive state management for chat UI", order: 27 },
  { src: "chat/context.md", dest: "chat/context.md", title: "Chat Context", desc: "Context accumulation and management", order: 28 },
  { src: "chat/accumulator.md", dest: "chat/accumulator.md", title: "Chat Accumulator", desc: "Event accumulator for message construction", order: 29 },
  { src: "chat/backends.md", dest: "chat/backends.md", title: "Chat Backends", desc: "Chat backend adapter interfaces and base classes", order: 30 },
  { src: "chat/server.md", dest: "chat/server.md", title: "Chat Server", desc: "HTTP server handler and auth middleware", order: 31 },
  { src: "chat/sqlite.md", dest: "chat/sqlite.md", title: "Chat SQLite", desc: "SQLite storage implementation", order: 32 },
  { src: "@witqq/agent-sdk/chat/react.md", dest: "chat/react.md", title: "Chat React", desc: "React components, hooks, and client", order: 33 },
  { src: "@witqq/agent-sdk/testing.md", dest: "testing.md", title: "Testing", desc: "Test utilities and mock agent service", order: 40 },
];

/** Link rewrite rules: TypeDoc relative path → Starlight path */
const LINK_REWRITES = new Map([
  // From root-level files
  ["index.md", "/api-reference/core/"],
  ["../index.md", "/api-reference/core/"],
  ["../../index.md", "/api-reference/core/"],
  ["../../../index.md", "/api-reference/core/"],
  ["auth.md", "/api-reference/auth/"],
  ["../auth.md", "/api-reference/auth/"],
  ["chat.md", "/api-reference/chat/index-exports/"],
  ["../chat.md", "/api-reference/chat/index-exports/"],

  // Backends
  ["backends/copilot.md", "/api-reference/backends/copilot/"],
  ["backends/claude.md", "/api-reference/backends/claude/"],
  ["backends/vercel-ai.md", "/api-reference/backends/vercel-ai/"],
  ["backends/mock-llm.md", "/api-reference/backends/mock-llm/"],
  ["../backends/copilot.md", "/api-reference/backends/copilot/"],
  ["../backends/claude.md", "/api-reference/backends/claude/"],
  ["../backends/vercel-ai.md", "/api-reference/backends/vercel-ai/"],
  ["../backends/mock-llm.md", "/api-reference/backends/mock-llm/"],
  ["copilot.md", "/api-reference/backends/copilot/"],
  ["claude.md", "/api-reference/backends/claude/"],
  ["vercel-ai.md", "/api-reference/backends/vercel-ai/"],
  ["mock-llm.md", "/api-reference/backends/mock-llm/"],

  // Chat submodules
  ["chat/core.md", "/api-reference/chat/core/"],
  ["chat/runtime.md", "/api-reference/chat/runtime/"],
  ["chat/events.md", "/api-reference/chat/events/"],
  ["chat/errors.md", "/api-reference/chat/errors/"],
  ["chat/sessions.md", "/api-reference/chat/sessions/"],
  ["chat/storage.md", "/api-reference/chat/storage/"],
  ["chat/state.md", "/api-reference/chat/state/"],
  ["chat/context.md", "/api-reference/chat/context/"],
  ["chat/accumulator.md", "/api-reference/chat/accumulator/"],
  ["chat/backends.md", "/api-reference/chat/backends/"],
  ["chat/server.md", "/api-reference/chat/server/"],
  ["chat/sqlite.md", "/api-reference/chat/sqlite/"],
  ["../chat/core.md", "/api-reference/chat/core/"],
  ["../chat/runtime.md", "/api-reference/chat/runtime/"],
  ["../chat/events.md", "/api-reference/chat/events/"],
  ["../chat/errors.md", "/api-reference/chat/errors/"],
  ["../chat/sessions.md", "/api-reference/chat/sessions/"],
  ["../chat/storage.md", "/api-reference/chat/storage/"],
  ["../chat/state.md", "/api-reference/chat/state/"],
  ["../chat/context.md", "/api-reference/chat/context/"],
  ["../chat/accumulator.md", "/api-reference/chat/accumulator/"],
  ["../chat/backends.md", "/api-reference/chat/backends/"],
  ["../chat/server.md", "/api-reference/chat/server/"],
  ["../chat/sqlite.md", "/api-reference/chat/sqlite/"],
  // Sibling references
  ["core.md", "/api-reference/chat/core/"],
  ["runtime.md", "/api-reference/chat/runtime/"],
  ["events.md", "/api-reference/chat/events/"],
  ["errors.md", "/api-reference/chat/errors/"],
  ["sessions.md", "/api-reference/chat/sessions/"],
  ["storage.md", "/api-reference/chat/storage/"],
  ["state.md", "/api-reference/chat/state/"],
  ["context.md", "/api-reference/chat/context/"],
  ["accumulator.md", "/api-reference/chat/accumulator/"],
  ["backends.md", "/api-reference/chat/backends/"],
  ["server.md", "/api-reference/chat/server/"],
  ["sqlite.md", "/api-reference/chat/sqlite/"],

  // Special nested paths
  ["@witqq/agent-sdk/chat/react.md", "/api-reference/chat/react/"],
  ["@witqq/agent-sdk/testing.md", "/api-reference/testing/"],

  // README links (remove)
  ["README.md", "/api-reference/"],
  ["../README.md", "/api-reference/"],
  ["../../README.md", "/api-reference/"],
  ["../../../README.md", "/api-reference/"],
]);

function transformContent(content, meta) {
  let lines = content.split("\n");

  // Remove TypeDoc breadcrumb navigation (first 4-5 lines)
  // Pattern: [**@witqq/agent-sdk**](README.md) \n *** \n [...] / module-name \n
  let startIdx = 0;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    if (lines[i].startsWith("# ")) {
      startIdx = i;
      break;
    }
  }

  let body = lines.slice(startIdx).join("\n");

  // Rewrite markdown links: [text](path.md#anchor) → [text](/api-reference/dest/#anchor)
  body = body.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (match, text, href) => {
    // Skip external links and anchors-only
    if (href.startsWith("http") || href.startsWith("#")) return match;

    // Split path and anchor
    const [pathPart, anchor] = href.split("#");
    const rewritten = LINK_REWRITES.get(pathPart);

    if (rewritten) {
      return anchor ? `[${text}](${rewritten}#${anchor})` : `[${text}](${rewritten})`;
    }

    // If not in rewrite map, keep as-is (might be a source link)
    return match;
  });

  // Add Starlight frontmatter
  const frontmatter = [
    "---",
    `title: "${meta.title}"`,
    `description: "${meta.desc}"`,
    `sidebar:`,
    `  order: ${meta.order}`,
    "---",
    "",
  ].join("\n");

  return frontmatter + body;
}

// Main
let processed = 0;
let skipped = 0;

for (const file of FILES) {
  const srcPath = join(API_SRC, file.src);
  if (!existsSync(srcPath)) {
    console.warn(`SKIP: ${file.src} not found`);
    skipped++;
    continue;
  }

  const content = readFileSync(srcPath, "utf-8");
  const transformed = transformContent(content, file);

  const destPath = join(API_DEST, file.dest);
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, transformed, "utf-8");

  const lines = transformed.split("\n").length;
  console.log(`OK: ${file.src} → api-reference/${file.dest} (${lines} lines)`);
  processed++;
}

console.log(`\nDone: ${processed} processed, ${skipped} skipped`);
