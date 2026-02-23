/**
 * Unified React demo backend: agent-sdk + Chat SDK server utilities.
 *
 * Uses SDK server handlers (createChatHandler, createAuthHandler, FileTokenStore,
 * corsMiddleware) for auth, chat routing, and token persistence. App-specific
 * code (tools, runtime creation, model listing, agent lifecycle) remains.
 *
 * Run: npx tsx examples/demo/server.ts
 * Open: http://localhost:3456
 */
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { createAgentService } from "@witqq/agent-sdk";
import type { IAgentService, PermissionRequest } from "@witqq/agent-sdk";
import { CopilotAuth, ClaudeAuth } from "@witqq/agent-sdk/auth";
import type { AuthToken } from "@witqq/agent-sdk/auth";
import { InMemorySessionStore } from "@witqq/agent-sdk/chat/sessions";
import {
  CopilotChatAdapter, ClaudeChatAdapter, VercelAIChatAdapter,
} from "@witqq/agent-sdk/chat/backends";
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
import type { IChatRuntime } from "@witqq/agent-sdk/chat/runtime";
import {
  createChatHandler, createAuthHandler, FileTokenStore, corsMiddleware,
} from "@witqq/agent-sdk/chat/server";
import type { RequestHandler } from "@witqq/agent-sdk/chat/server";
import { z } from "zod";
import { createAllowlist, isModelAllowed, filterModels } from "./model-allowlist.js";

const PORT = parseInt(process.env.PORT || "3456", 10);
const TOKEN_DIR = process.env.TOKEN_DIR || path.join(import.meta.dirname, ".tokens");
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(import.meta.dirname, "frontend", "dist");

// ─── Model Allowlist ────────────────────────────────────────────

/** Models allowed in the demo. Prevents accidental use of paid models. */
const MODEL_ALLOWLIST = createAllowlist(process.env.DEMO_ALLOWED_MODELS);

// ─── Logging ────────────────────────────────────────────────────

type LogTag = "API" | "AUTH" | "SERVICE" | "ERROR" | "STARTUP";

function log(tag: LogTag, msg: string, data?: Record<string, unknown>): void {
  const ts = new Date().toISOString().slice(11, 23);
  const extra = data ? " " + Object.entries(data)
    .map(([k, v]) => `${k}=${typeof v === "string" && v.length > 40 ? v.slice(0, 8) + "***" : JSON.stringify(v)}`)
    .join(" ") : "";
  console.log(`[${ts}] [${tag}] ${msg}${extra}`);
}

function logError(tag: LogTag, msg: string, err: unknown): void {
  const errMsg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? "\n" + err.stack : "";
  console.error(`[${new Date().toISOString().slice(11, 23)}] [${tag}] ${msg}: ${errMsg}${stack}`);
}

// ─── Tool Definitions ───────────────────────────────────────────

function createDemoTools() {
  return [
    {
      name: "search_news",
      description: "Search for recent news on a given topic. Returns headlines and snippets.",
      parameters: z.object({
        query: z.string().describe("Search query for news"),
      }),
      execute: async (args: { query: string }) => {
        return JSON.stringify({
          results: [
            { headline: `Breaking: ${args.query} — Major developments today`, snippet: "Industry experts weigh in on recent changes..." },
            { headline: `${args.query}: What you need to know in 2025`, snippet: "A comprehensive look at the current landscape..." },
            { headline: `Opinion: The future of ${args.query}`, snippet: "Leading researchers share their predictions..." },
          ],
        });
      },
    },
    {
      name: "calculator",
      description: "Perform arithmetic calculations. Supports +, -, *, /, and parentheses.",
      parameters: z.object({
        expression: z.string().describe("Mathematical expression to evaluate, e.g. '2 + 2 * 3'"),
      }),
      execute: async (args: { expression: string }) => {
        try {
          const sanitized = args.expression.replace(/[^0-9+\-*/.() ]/g, "");
          // NOTE: Function() is used intentionally for arithmetic eval.
          // Input is sanitized to [0-9+\-*/.() ] only — no code injection possible.
          const result = Function(`"use strict"; return (${sanitized})`)();
          return JSON.stringify({ expression: args.expression, result });
        } catch {
          return JSON.stringify({ error: `Cannot evaluate: ${args.expression}` });
        }
      },
    },
    {
      name: "format_output",
      description: "Format and display structured output to the user.",
      parameters: z.object({
        title: z.string().describe("Report title"),
        bullets: z.array(z.string()).describe("Bullet points"),
        conclusion: z.string().describe("Brief conclusion"),
      }),
      needsApproval: true,
      execute: async (args: { title: string; bullets: string[]; conclusion: string }) => {
        const formatted = [
          `# ${args.title}`,
          "",
          ...args.bullets.map((b: string) => `• ${b}`),
          "",
          `Conclusion: ${args.conclusion}`,
        ].join("\n");
        return formatted;
      },
    },
  ];
}

// ─── State ──────────────────────────────────────────────────────

type Provider = "copilot" | "claude" | "vercel-ai";

// ⚠️ Single-user demo: global state is shared across all connections.
const state: {
  provider: Provider | null;
  token: AuthToken | null;
  service: IAgentService | null;
  vercelBaseUrl: string | null;
} = { provider: null, token: null, service: null, vercelBaseUrl: null };

const sessionStore = new InMemorySessionStore();
let runtime: IChatRuntime | null = null;
let chatApiHandler: RequestHandler | null = null;

// ─── Service Helpers ────────────────────────────────────────────

async function ensureService(): Promise<void> {
  if (state.service) return;
  if (!state.provider || !state.token) return;
  log("SERVICE", `Creating service for ${state.provider}`);
  switch (state.provider) {
    case "copilot":
      state.service = await createAgentService("copilot", { githubToken: state.token.accessToken });
      break;
    case "claude":
      state.service = await createAgentService("claude", { oauthToken: state.token.accessToken });
      break;
    case "vercel-ai":
      state.service = await createAgentService("vercel-ai", {
        baseUrl: state.vercelBaseUrl || process.env.VERCEL_AI_BASE_URL || "https://api.openai.com/v1",
        apiKey: state.token.accessToken,
      });
      break;
  }
}

async function cleanupState(): Promise<void> {
  chatApiHandler = null;
  if (runtime) { await runtime.dispose(); runtime = null; }
  if (state.service) { await state.service.dispose(); state.service = null; }
}

function buildAgentConfig(): Record<string, unknown> {
  const tools = createDemoTools();
  return {
    model: runtime?.currentModel || undefined,
    systemPrompt: "You are a helpful assistant with access to tools for search, math, and formatting. Be concise. Use ONLY the provided tools (search_news, calculator, format_output) when asked to search, calculate, or format. Do NOT use any other tools like web_fetch.",
    tools,
    availableTools: tools.map(t => t.name),
    maxTurns: 10,
    supervisor: {
      onPermission: async (_req: PermissionRequest) => ({ allowed: true, scope: "session" as const }),
    },
  };
}

function createAppRuntime(model?: string): IChatRuntime {
  const agentConfig = buildAgentConfig();
  const backends: Record<string, () => import("@witqq/agent-sdk/chat/backends").IBackendAdapter> = {};
  if (state.provider === "copilot") backends.copilot = () => new CopilotChatAdapter({ agentConfig, agentService: state.service! });
  if (state.provider === "claude") backends.claude = () => new ClaudeChatAdapter({ agentConfig, agentService: state.service! });
  if (state.provider === "vercel-ai") backends["vercel-ai"] = () => new VercelAIChatAdapter({ agentConfig, agentService: state.service! });

  const tools = createDemoTools();
  const rt = createChatRuntime({
    backends,
    defaultBackend: state.provider!,
    sessionStore,
    context: { maxTokens: 8192, reservedTokens: 500, strategy: "truncate-oldest" },
    defaultModel: model || undefined,
  });
  for (const tool of tools) rt.registerTool(tool);
  return rt;
}

// ─── SDK Handlers ───────────────────────────────────────────────

const tokenStore = new FileTokenStore({ directory: TOKEN_DIR });

const authApiHandler = createAuthHandler({
  tokenStore,
  prefix: "/api",
  createCopilotAuth: () => new CopilotAuth(),
  createClaudeAuth: () => new ClaudeAuth(),
  onAuth: async (provider, token) => {
    log("AUTH", `Auth completed for ${provider}`);
    state.provider = provider as Provider;
    state.token = token;
    if (provider === "vercel-ai") {
      state.vercelBaseUrl = (token as Record<string, unknown>).baseUrl as string
        || process.env.VERCEL_AI_BASE_URL || "https://api.openai.com/v1";
    }
    try {
      await ensureService();
      // Auto-create runtime + chat handler so useRemoteChat can create sessions immediately
      if (runtime) { await runtime.dispose(); runtime = null; }
      runtime = createAppRuntime();
      chatApiHandler = createChatHandler(runtime, { prefix: "/api/chat", heartbeatMs: 30000 });
      log("API", `Runtime auto-created for ${provider}`);
    } catch (err) {
      logError("SERVICE", "Failed to create runtime during auth", err);
    }
  },
  onLogout: async () => {
    log("AUTH", "Logout requested");
    await cleanupState();
    state.provider = null;
    state.token = null;
  },
});

const cors = corsMiddleware();

// ─── Helpers ────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
  });
}

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ─── Static File Serving ────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".map": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
};

function serveStatic(url: string, res: http.ServerResponse): boolean {
  const safePath = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(FRONTEND_DIR, safePath);
  if (!filePath.startsWith(FRONTEND_DIR)) return false;
  try {
    if (fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      res.end(fs.readFileSync(filePath));
      return true;
    }
  } catch { /* fall through */ }
  return false;
}

function serveIndex(res: http.ServerResponse): void {
  try {
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
    res.end(fs.readFileSync(path.join(FRONTEND_DIR, "index.html"), "utf-8"));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Frontend not built. Run: cd examples/demo/frontend && npm run build");
  }
}

// ─── HTTP Server ────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (cors(req, res)) return;
  const url = (req.url || "/").split("?")[0];

  // Health check for Docker/orchestrators
  if (url === "/api/health") {
    json(res, { ok: true });
    return;
  }

  // Chat routes → SDK chat handler (RemoteChatRuntime contract)
  // Model allowlist enforcement: intercept model-related routes before delegating
  if (url.startsWith("/api/chat/") || url === "/api/chat") {
    if (!chatApiHandler) { json(res, { error: "No active agent" }, 400); return; }

    // GET /api/chat/models → filter to allowed models only
    if (req.method === "GET" && (url === "/api/chat/models" || url.startsWith("/api/chat/models?"))) {
      const models = await runtime!.listModels();
      const allowed = filterModels(MODEL_ALLOWLIST, models as Array<{ id?: string; name?: string }>);
      json(res, allowed);
      return;
    }

    // POST /api/chat/model/switch → reject disallowed models
    if (req.method === "POST" && url === "/api/chat/model/switch") {
      try {
        const body = JSON.parse(await readBody(req) || "{}") as Record<string, unknown>;
        const model = body.model as string;
        if (!model) { json(res, { error: "model is required" }, 400); return; }
        if (!isModelAllowed(MODEL_ALLOWLIST, model)) {
          json(res, { error: `Model "${model}" is not allowed. Allowed models: ${[...MODEL_ALLOWLIST].join(", ")}` }, 403);
          return;
        }
        runtime!.switchModel(model);
        json(res, { ok: true });
      } catch (err) {
        json(res, { error: err instanceof Error ? err.message : "Invalid request" }, 400);
      }
      return;
    }

    // POST /api/chat/send → reject disallowed model overrides
    if (req.method === "POST" && url === "/api/chat/send") {
      try {
        const rawBody = await readBody(req);
        const body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
        if (body.model && !isModelAllowed(MODEL_ALLOWLIST, body.model as string)) {
          json(res, { error: `Model "${body.model}" is not allowed. Allowed models: ${[...MODEL_ALLOWLIST].join(", ")}` }, 403);
          return;
        }
        // Re-create a fake request with already-read body for the handler
        const fakeReq = {
          method: req.method,
          url: req.url,
          on(event: string, listener: (...args: unknown[]) => void) {
            if (event === "data") listener(Buffer.from(rawBody));
            if (event === "end") listener();
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await chatApiHandler(fakeReq as any, res as any);
      } catch (err) {
        json(res, { error: err instanceof Error ? err.message : "Invalid request" }, 400);
      }
      return;
    }

    // All other chat routes → delegate directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await chatApiHandler(req as any, res as any);
    return;
  }

  // Auth + token routes → SDK auth handler
  if (url.startsWith("/api/auth/") || url.startsWith("/api/tokens/")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await authApiHandler(req as any, res as any);
    return;
  }

  // App-specific API routes
  if (req.method === "POST" && url.startsWith("/api/")) {
    try {
      const body = JSON.parse(await readBody(req) || "{}") as Record<string, unknown>;

      if (url === "/api/agent/dispose") {
        await cleanupState();
        state.provider = null;
        state.token = null;
        json(res, { ok: true });
        return;
      }

      json(res, { error: "Not found" }, 404);
    } catch (err) {
      logError("API", `${req.method} ${url} error`, err);
      json(res, { error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
    return;
  }

  // Static files
  if (req.method === "GET") {
    if (url === "/" || url === "/index.html") { serveIndex(res); return; }
    if (serveStatic(url, res)) return;
    // Client-side routing fallback: serve index.html for non-file paths
    if (!path.extname(url)) { serveIndex(res); return; }
  }

  json(res, { error: "Not found" }, 404);
});

// Prevent unhandled errors from crashing the server
process.on("uncaughtException", (err) => logError("ERROR", "Uncaught exception (server stays alive)", err));
process.on("unhandledRejection", (err) => logError("ERROR", "Unhandled rejection (server stays alive)", err));

server.listen(PORT, "0.0.0.0", () => {
  log("STARTUP", `Demo server started on port ${PORT}`, { tokenDir: TOKEN_DIR, frontendDir: FRONTEND_DIR });
  console.log(`\n  @witqq/agent-sdk Demo (React + Chat SDK)`);
  console.log(`  http://localhost:${PORT}\n`);
});
