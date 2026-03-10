/**
 * @witqq/agent-sdk Demo — stateless AI chat backend.
 *
 * No ServiceManager, no in-memory token cache.
 * Each request resolves credentials from persistent tokenStore via providerId.
 * Backend factories receive credentials per-call through RuntimeSendOptions.
 *
 * Run: npm run demo → http://localhost:3456
 */
import * as http from "node:http";
import * as path from "node:path";
import { createAgentService } from "@witqq/agent-sdk";
import type { PermissionRequest } from "@witqq/agent-sdk";
import type { AuthToken } from "@witqq/agent-sdk/auth";
import { CopilotAuth, ClaudeAuth, TokenRefreshManager } from "@witqq/agent-sdk/auth";
import type { ClaudeAuthToken } from "@witqq/agent-sdk/auth";
import { CopilotChatAdapter, ClaudeChatAdapter, VercelAIChatAdapter } from "@witqq/agent-sdk/chat/backends";
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
import { createChatServer } from "@witqq/agent-sdk/chat/server";
import { createSQLiteStorage } from "@witqq/agent-sdk/chat/sqlite";
import { createAllowlist, isModelAllowed, filterModels } from "./model-allowlist.js";
import { DEMO_TOOLS } from "./tools.js";

const PORT = parseInt(process.env.PORT || "3456", 10);
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(import.meta.dirname, "frontend", "dist");
const DB_PATH = process.env.DB_PATH || path.join(import.meta.dirname, ".data", "chat.db");
const ALLOWLIST = createAllowlist(process.env.DEMO_ALLOWED_MODELS);

// ─── Storage ────────────────────────────────────────────────────

const { sessionStore, providerStore, tokenStore } = createSQLiteStorage(DB_PATH);

// ─── Agent Config ───────────────────────────────────────────────

const agentConfig = () => ({
  systemPrompt: "You are a helpful assistant. Use provided tools when asked to search, calculate, or format. Be concise.",
  tools: DEMO_TOOLS, availableTools: DEMO_TOOLS.map(t => t.name), maxTurns: 10,
  supervisor: { onPermission: async (_r: PermissionRequest) => ({ allowed: true, scope: "session" as const }) },
});

// ─── Backend Factory Helpers ────────────────────────────────────

function serviceOpts(backend: string, token: AuthToken): Record<string, unknown> {
  if (backend === "copilot") return { githubToken: token.accessToken };
  if (backend === "claude") return { oauthToken: token.accessToken };
  return {
    baseUrl: (token as Record<string, unknown>).baseUrl as string
      || process.env.VERCEL_AI_BASE_URL || "https://api.openai.com/v1",
    apiKey: token.accessToken,
  };
}

// ─── Token Refresh ──────────────────────────────────────────────

let refreshManager: TokenRefreshManager | undefined;
const copilotAuthInstance = new CopilotAuth();
const claudeAuthInstance = new ClaudeAuth();

function makeRefreshFn(backend: string): ((token: AuthToken) => Promise<AuthToken>) | undefined {
  if (backend === "copilot") return (t) => copilotAuthInstance.refreshToken(t.refreshToken!);
  if (backend === "claude") return (t) => claudeAuthInstance.refreshToken((t as ClaudeAuthToken).refreshToken);
  return undefined;
}

function startRefreshIfNeeded(backend: string, token: AuthToken): void {
  refreshManager?.dispose();
  refreshManager = undefined;

  const refreshFn = makeRefreshFn(backend);
  if (!refreshFn || !token.expiresIn || !token.refreshToken) return;

  refreshManager = new TokenRefreshManager({ token, refresh: refreshFn });
  refreshManager.on("refreshed", (newToken) => {
    tokenStore.save(backend, newToken).catch(() => {});
    console.log(`[TokenRefresh] ${backend} token refreshed`);
  });
  refreshManager.on("error", (err) => {
    console.warn("[TokenRefresh] Refresh failed:", err.message);
  });
  refreshManager.on("expired", () => {
    console.warn(`[TokenRefresh] ${backend} token expired — re-auth required`);
  });
  refreshManager.start();
  console.log(`[TokenRefresh] Started for ${backend} token (expires in ${token.expiresIn}s)`);
}

// ─── Runtime & Server ───────────────────────────────────────────

const runtime = createChatRuntime({
  backends: {
    copilot: async (credentials: AuthToken) => {
      const svc = await createAgentService("copilot", serviceOpts("copilot", credentials));
      return new CopilotChatAdapter({ agentConfig: agentConfig(), agentService: svc });
    },
    claude: async (credentials: AuthToken) => {
      const svc = await createAgentService("claude", serviceOpts("claude", credentials));
      return new ClaudeChatAdapter({ agentConfig: agentConfig(), agentService: svc });
    },
    "vercel-ai": async (credentials: AuthToken) => {
      const svc = await createAgentService("vercel-ai", serviceOpts("vercel-ai", credentials));
      return new VercelAIChatAdapter({ agentConfig: agentConfig(), agentService: svc });
    },
  },
  defaultBackend: "copilot", sessionStore, tools: DEMO_TOOLS,
  context: { maxTokens: 8192, reservedTokens: 500, strategy: "truncate-oldest" },
});

const handler = createChatServer({
  runtime, staticDir: FRONTEND_DIR, autoCreateProviders: true,
  chatPrefix: "/api/chat", authPrefix: "/api",
  auth: {
    tokenStore,
    createCopilotAuth: () => copilotAuthInstance,
    createClaudeAuth: () => claudeAuthInstance,
    onAuth: (backend, token) => startRefreshIfNeeded(backend, token),
    onLogout: () => { refreshManager?.dispose(); refreshManager = undefined; },
  },
  providers: { providerStore },
  hooks: {
    filterModels: (models) => filterModels(ALLOWLIST, models as Array<{ id?: string; name?: string }>),
    onModelSwitch: (model) => { if (!isModelAllowed(ALLOWLIST, model)) throw new Error(`Model ${model} not allowed`); },
  },
  chatHandlerOptions: { heartbeatMs: 30000, tokenStore },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
http.createServer(handler as any).listen(PORT, "0.0.0.0", () => {
  console.log(`\n  @witqq/agent-sdk Demo → http://localhost:${PORT}\n`);
});
process.on("uncaughtException", (err) => console.error("[ERROR]", err instanceof Error ? err.message : err));
process.on("unhandledRejection", (err) => console.error("[ERROR]", err instanceof Error ? err.message : err));
