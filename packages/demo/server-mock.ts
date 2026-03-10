/**
 * @witqq/agent-sdk Demo — Mock LLM variant (zero-auth).
 *
 * Identical architecture to the real demo server, but uses MockLLMChatAdapter
 * instead of real backends. No API keys, no OAuth, fully deterministic.
 *
 * Proves that mock-llm is a true drop-in backend replacement.
 *
 * Run: npx tsx examples/demo/server-mock.ts
 */
import * as http from "node:http";
import * as path from "node:path";
import type { PermissionRequest } from "@witqq/agent-sdk";
import type { AuthToken } from "@witqq/agent-sdk/auth";
import { MockLLMChatAdapter } from "@witqq/agent-sdk/chat/backends";
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
import { createChatServer } from "@witqq/agent-sdk/chat/server";
import { createSQLiteStorage } from "@witqq/agent-sdk/chat/sqlite";
import { DEMO_TOOLS } from "./tools.js";

const PORT = parseInt(process.env.PORT || "3457", 10);
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(import.meta.dirname, "frontend", "dist");
const DB_PATH = process.env.DB_PATH || path.join(import.meta.dirname, ".data", "chat-mock.db");

// ─── Storage ────────────────────────────────────────────────────

const { sessionStore, providerStore, tokenStore } = createSQLiteStorage(DB_PATH);

// ─── Agent Config ───────────────────────────────────────────────

const agentConfig = () => ({
  systemPrompt: "You are a helpful assistant. Use provided tools when asked to search, calculate, or format. Be concise.",
  tools: DEMO_TOOLS, availableTools: DEMO_TOOLS.map(t => t.name), maxTurns: 10,
  supervisor: { onPermission: async (_r: PermissionRequest) => ({ allowed: true, scope: "session" as const }) },
});

// ─── Backend Variants ───────────────────────────────────────────
// Multiple backends with different mock-llm modes for comprehensive E2E testing.

function mockFactory(_credentials: AuthToken) {
  return new MockLLMChatAdapter({
    agentConfig: agentConfig(),
    mockOptions: {
      mode: { type: "echo" },
      models: [
        { id: "mock-echo", name: "Mock Echo", provider: "mock-llm" },
        { id: "mock-scripted", name: "Mock Scripted", provider: "mock-llm" },
        { id: "mock-static", name: "Mock Static", provider: "mock-llm" },
      ],
      streaming: { chunkSize: 5 },
    },
  });
}

function scriptedFactory(_credentials: AuthToken) {
  return new MockLLMChatAdapter({
    agentConfig: agentConfig(),
    mockOptions: {
      mode: { type: "scripted", responses: ["First reply", "Second reply", "Third reply"], loop: true },
      models: [{ id: "mock-scripted-model", name: "Mock Scripted", provider: "mock-scripted" }],
      streaming: { chunkSize: 5 },
    },
  });
}

function errorFactory(_credentials: AuthToken) {
  return new MockLLMChatAdapter({
    agentConfig: agentConfig(),
    mockOptions: {
      mode: { type: "error", error: "Simulated backend failure", code: "test_error", recoverable: false },
      models: [{ id: "mock-error-model", name: "Mock Error", provider: "mock-error" }],
    },
  });
}

function toolCallFactory(_credentials: AuthToken) {
  return new MockLLMChatAdapter({
    agentConfig: agentConfig(),
    mockOptions: {
      mode: { type: "static", response: "Tool result processed" },
      models: [{ id: "mock-tool-model", name: "Mock Tool", provider: "mock-tools" }],
      toolCalls: [
        { toolName: "web_search", args: { query: "test query" }, result: "Search result: 42" },
      ],
      streaming: { chunkSize: 10 },
    },
  });
}

function finishReasonFactory(_credentials: AuthToken) {
  return new MockLLMChatAdapter({
    agentConfig: agentConfig(),
    mockOptions: {
      mode: { type: "static", response: "Length-limited response" },
      models: [{ id: "mock-finish-model", name: "Mock Finish", provider: "mock-finish" }],
      finishReason: "length",
      streaming: { chunkSize: 10 },
    },
  });
}

function structuredFactory(_credentials: AuthToken) {
  return new MockLLMChatAdapter({
    agentConfig: agentConfig(),
    mockOptions: {
      mode: { type: "static", response: '{"name":"Alice","age":30}' },
      models: [{ id: "mock-structured-model", name: "Mock Structured", provider: "mock-structured" }],
      structuredOutput: { name: "Alice", age: 30 },
      streaming: { chunkSize: 10 },
    },
  });
}

function permissionsFactory(_credentials: AuthToken) {
  return new MockLLMChatAdapter({
    agentConfig: agentConfig(),
    mockOptions: {
      mode: { type: "static", response: "Permission granted response" },
      models: [{ id: "mock-perm-model", name: "Mock Permissions", provider: "mock-permissions" }],
      permissions: {
        toolNames: ["bash", "file_write"],
        autoApprove: false,
        denyTools: ["bash"],
      },
      streaming: { chunkSize: 10 },
    },
  });
}

// ─── Runtime & Server ───────────────────────────────────────────

const runtime = createChatRuntime({
  backends: {
    "mock-llm": async (c: AuthToken) => mockFactory(c),
    "mock-scripted": async (c: AuthToken) => scriptedFactory(c),
    "mock-error": async (c: AuthToken) => errorFactory(c),
    "mock-tools": async (c: AuthToken) => toolCallFactory(c),
    "mock-finish": async (c: AuthToken) => finishReasonFactory(c),
    "mock-structured": async (c: AuthToken) => structuredFactory(c),
    "mock-permissions": async (c: AuthToken) => permissionsFactory(c),
  },
  defaultBackend: "mock-llm", sessionStore, tools: DEMO_TOOLS,
  context: { maxTokens: 8192, reservedTokens: 500, strategy: "truncate-oldest" },
});

// Pre-seed dummy tokens and providers for all mock backends
async function seedMockProviders(): Promise<void> {
  const backendNames = ["mock-llm", "mock-scripted", "mock-error", "mock-tools", "mock-finish", "mock-structured", "mock-permissions"];

  for (const backend of backendNames) {
    await tokenStore.save(backend, {
      accessToken: `${backend}-token-not-used`,
      tokenType: "bearer",
      obtainedAt: Date.now(),
    });
  }

  const existing = await providerStore.list();
  const existingBackends = new Set(existing.map(p => p.backend));

  const seedProviders = [
    { backend: "mock-llm", model: "mock-echo", label: "Mock LLM (echo)" },
    { backend: "mock-scripted", model: "mock-scripted-model", label: "Mock LLM (scripted)" },
    { backend: "mock-error", model: "mock-error-model", label: "Mock LLM (error)" },
    { backend: "mock-tools", model: "mock-tool-model", label: "Mock LLM (tools)" },
    { backend: "mock-finish", model: "mock-finish-model", label: "Mock LLM (finishReason)" },
    { backend: "mock-structured", model: "mock-structured-model", label: "Mock LLM (structured)" },
    { backend: "mock-permissions", model: "mock-perm-model", label: "Mock LLM (permissions)" },
  ];

  for (const sp of seedProviders) {
    if (!existingBackends.has(sp.backend)) {
      await providerStore.create({
        id: crypto.randomUUID(),
        backend: sp.backend,
        model: sp.model,
        label: sp.label,
        createdAt: Date.now(),
      });
    }
  }
}

seedMockProviders().then(() => {
  const handler = createChatServer({
    runtime, staticDir: FRONTEND_DIR, autoCreateProviders: false,
    chatPrefix: "/api/chat", authPrefix: "/api",
    auth: {
      tokenStore,
      createCopilotAuth: () => { throw new Error("No real auth in mock mode"); },
      createClaudeAuth: () => { throw new Error("No real auth in mock mode"); },
    },
    providers: { providerStore },
    chatHandlerOptions: { heartbeatMs: 30000, tokenStore },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  http.createServer(handler as any).listen(PORT, "0.0.0.0", () => {
    console.log(`\n  @witqq/agent-sdk Mock Demo → http://localhost:${PORT}\n`);
  });
}).catch((err) => {
  console.error("Failed to seed mock provider:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => console.error("[ERROR]", err instanceof Error ? err.message : err));
process.on("unhandledRejection", (err) => console.error("[ERROR]", err instanceof Error ? err.message : err));
