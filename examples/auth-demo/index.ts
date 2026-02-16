/**
 * Interactive demo: @witqq/agent-sdk with authentication flows.
 *
 * Tests multi-turn conversations across Copilot, Claude, and Vercel AI backends
 * with keyboard shortcuts for standard test messages, streaming event display,
 * demo tools, and turn/tool-call verification.
 *
 * Run locally:  npx tsx examples/auth-demo/index.ts
 * Run in Docker: docker compose -f examples/auth-demo/docker-compose.yml run --rm demo
 */
import * as readline from "node:readline";
import { createAgentService } from "@witqq/agent-sdk";
import type {
  IAgentService,
  IAgent,
  PermissionRequest,
  UserInputRequest,
  AgentEvent,
} from "@witqq/agent-sdk";
import { CopilotAuth, ClaudeAuth } from "@witqq/agent-sdk/auth";
import type { AuthToken, CopilotAuthToken, ClaudeAuthToken } from "@witqq/agent-sdk/auth";
import { z } from "zod";

// ─── Shortcuts ──────────────────────────────────────────────────

interface Shortcut {
  key: string;
  label: string;
  message: string;
}

const SHORTCUTS: Shortcut[] = [
  { key: "1", label: "Use search tool", message: "Search for the latest news about TypeScript and summarize what you find." },
  { key: "2", label: "Use calculator", message: "What is 1337 * 42 + 99? Use the calculator tool to compute it." },
  { key: "3", label: "Multi-tool chain", message: "First search for 'AI agents 2025', then calculate how many words are in the first headline you found." },
  { key: "4", label: "List your tools", message: "What tools do you have available? List each one with its description." },
  { key: "5", label: "Summarize conversation", message: "Summarize our conversation so far. What have we discussed?" },
  { key: "6", label: "Format output", message: "Create a formatted report with a title, 3 bullet points about AI, and a brief conclusion. Use the format_output tool." },
  { key: "7", label: "Ask a follow-up", message: "Tell me more about the last thing you mentioned. Go deeper." },
];

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
          ...args.bullets.map((b) => `• ${b}`),
          "",
          `Conclusion: ${args.conclusion}`,
        ].join("\n");
        return formatted;
      },
    },
  ];
}

// ─── State ──────────────────────────────────────────────────────

interface TurnStats {
  turnNumber: number;
  toolCalls: number;
  textChunks: number;
  thinkingBlocks: number;
  permissionRequests: number;
  finishReason: string;
}

interface AppState {
  provider: "copilot" | "claude" | "vercel-ai" | null;
  token: AuthToken | null;
  service: IAgentService | null;
  agent: IAgent | null;
  turnCount: number;
  totalToolCalls: number;
}

const state: AppState = {
  provider: null,
  token: null,
  service: null,
  agent: null,
  turnCount: 0,
  totalToolCalls: 0,
};

// ─── Readline helpers ───────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function print(msg: string) {
  console.log(msg);
}

function printHeader(title: string) {
  print(`\n${"═".repeat(60)}`);
  print(`  ${title}`);
  print(`${"═".repeat(60)}\n`);
}

function printDivider() {
  print(`${"─".repeat(60)}`);
}

// ─── Colors (basic ANSI) ────────────────────────────────────────

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ─── Provider Selection ─────────────────────────────────────────

async function selectProvider(): Promise<"copilot" | "claude" | "vercel-ai"> {
  printHeader("Select Backend Provider");
  print("  1. GitHub Copilot  (Device Flow auth, free with GitHub subscription)");
  print("  2. Claude          (OAuth + PKCE auth)");
  print("  3. Vercel AI       (API key, any OpenAI-compatible provider)");
  print("");

  while (true) {
    const choice = await ask("Choice [1-3]: ");
    if (choice === "1") return "copilot";
    if (choice === "2") return "claude";
    if (choice === "3") return "vercel-ai";
    print("  Invalid choice.");
  }
}

// ─── Authentication ─────────────────────────────────────────────

let vercelBaseUrl: string | null = null;

async function authenticate(provider: "copilot" | "claude" | "vercel-ai"): Promise<AuthToken> {
  switch (provider) {
    case "copilot": {
      printHeader("Copilot Authentication (GitHub Device Flow)");
      const auth = new CopilotAuth();
      const flow = await auth.startDeviceFlow();
      print(`  User Code: ${c.bold(flow.userCode)}`);
      print(`  Open URL:  ${flow.verificationUrl}`);
      print("\n  Waiting for authorization...");
      const token = await flow.waitForToken();
      const ct = token as CopilotAuthToken;
      print(`  ${c.green("✓")} Authenticated${ct.login ? ` as ${ct.login}` : ""}`);
      return ct;
    }
    case "claude": {
      printHeader("Claude Authentication (OAuth + PKCE)");
      const auth = new ClaudeAuth();
      const flow = await auth.startOAuthFlow();
      print(`  Open URL: ${flow.authorizeUrl}`);
      const input = await ask("  Paste code or redirect URL: ");
      const token = await flow.completeAuth(input);
      print(`  ${c.green("✓")} Authenticated`);
      return token;
    }
    case "vercel-ai": {
      printHeader("Vercel AI Authentication (API Key)");
      const baseUrl = await ask("  Base URL (enter for https://api.openai.com/v1): ");
      vercelBaseUrl = baseUrl || process.env.VERCEL_AI_BASE_URL || "https://api.openai.com/v1";
      const apiKey = await ask("  API key: ");
      return { accessToken: apiKey, tokenType: "bearer", obtainedAt: Date.now() };
    }
  }
}

// ─── Service & Agent Creation ───────────────────────────────────

async function createService(provider: "copilot" | "claude" | "vercel-ai", token: AuthToken): Promise<IAgentService> {
  switch (provider) {
    case "copilot":
      return createAgentService("copilot", { githubToken: token.accessToken });
    case "claude":
      return createAgentService("claude", { oauthToken: token.accessToken });
    case "vercel-ai":
      return createAgentService("vercel-ai", {
        baseUrl: vercelBaseUrl || "https://api.openai.com/v1",
        apiKey: token.accessToken,
      });
  }
}

async function selectModel(service: IAgentService): Promise<string> {
  printHeader("Select Model");
  try {
    const models = await service.listModels();
    if (models.length === 0) {
      print("  No models listed. Enter model name manually.");
      return ask("  Model: ");
    }
    models.forEach((m, i) => print(`  ${i + 1}. ${m.id}${m.name ? ` — ${m.name}` : ""}`));
    print("");
    while (true) {
      const choice = await ask(`Choice [1-${models.length}]: `);
      const idx = parseInt(choice, 10) - 1;
      if (idx >= 0 && idx < models.length) return models[idx].id;
      print("  Invalid choice.");
    }
  } catch {
    print("  Could not list models.");
    return ask("  Model name: ");
  }
}

function createAgent(service: IAgentService, model: string, provider: string): IAgent {
  const tools = createDemoTools();
  return service.createAgent({
    model,
    systemPrompt:
      "You are a helpful assistant for testing the agent-sdk. You have access to tools: search_news (search for news), calculator (math), and format_output (structured display). Use them when appropriate. Be concise.",
    sessionMode: provider === "copilot" || provider === "claude" ? "persistent" : undefined,
    tools,
    maxTurns: 10,
    // Restrict Copilot to only our demo tools (prevents using built-in web_fetch etc.)
    availableTools: provider === "copilot" ? tools.map(t => t.name) : undefined,
    supervisor: {
      onPermission: async (req: PermissionRequest) => {
        print(`  ${c.yellow("🔐")} Permission: ${c.bold(req.toolName)} — auto-approved (session)`);
        return { allowed: true, scope: "session" as const };
      },
      onAskUser: async (req: UserInputRequest) => {
        print(`\n  ${c.magenta("❓")} Agent asks: ${req.question}`);
        if (req.choices && req.choices.length > 0) {
          req.choices.forEach((ch, i) => print(`     ${i + 1}. ${ch}`));
          const ans = await ask("  Your answer: ");
          const idx = parseInt(ans, 10) - 1;
          if (idx >= 0 && idx < req.choices.length) {
            return { answer: req.choices[idx], wasFreeform: false };
          }
          return { answer: ans, wasFreeform: true };
        }
        const ans = await ask("  Your answer: ");
        return { answer: ans, wasFreeform: true };
      },
    },
  });
}

// ─── Streaming with Event Display ───────────────────────────────

async function streamResponse(agent: IAgent, message: string): Promise<TurnStats> {
  const stats: TurnStats = {
    turnNumber: ++state.turnCount,
    toolCalls: 0,
    textChunks: 0,
    thinkingBlocks: 0,
    permissionRequests: 0,
    finishReason: "unknown",
  };

  process.stdout.write(`\n${c.cyan("Agent")}: `);

  try {
    for await (const event of agent.stream(message)) {
      handleEvent(event, stats);
    }
  } catch (err) {
    print(`\n${c.red("Error")}: ${err instanceof Error ? err.message : String(err)}`);
    stats.finishReason = "error";
  }

  state.totalToolCalls += stats.toolCalls;
  print("");
  printTurnStats(stats);

  return stats;
}

function handleEvent(event: AgentEvent, stats: TurnStats) {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.text);
      stats.textChunks++;
      break;

    case "thinking_start":
      process.stdout.write(`\n  ${c.dim("💭 [thinking...]")}`);
      stats.thinkingBlocks++;
      break;

    case "thinking_delta":
      if (event.text) process.stdout.write(c.dim(event.text));
      break;

    case "thinking_end":
      process.stdout.write(c.dim(" [/thinking]\n"));
      break;

    case "tool_call_start":
      stats.toolCalls++;
      print(`\n  ${c.green("🔧")} ${c.bold(event.toolName)}(${c.dim(JSON.stringify(event.args).slice(0, 80))})`);
      break;

    case "tool_call_end":
      print(`  ${c.green("  ✓")} ${c.dim(String(event.result).slice(0, 100))}`);
      break;

    case "permission_request":
      stats.permissionRequests++;
      break;

    case "usage_update":
      break;

    case "session_info":
      break;

    case "heartbeat":
      break;

    case "done":
      stats.finishReason = "done";
      break;

    case "error":
      print(`\n  ${c.red("❌")} ${event.error}`);
      stats.finishReason = "error";
      break;
  }
}

function printTurnStats(stats: TurnStats) {
  printDivider();
  print(
    `  Turn ${stats.turnNumber} | ` +
    `Tools: ${stats.toolCalls} | ` +
    `Text chunks: ${stats.textChunks} | ` +
    `Thinking: ${stats.thinkingBlocks} | ` +
    `Permissions: ${stats.permissionRequests} | ` +
    `Status: ${stats.finishReason}`
  );
  print(
    `  Session totals: ${state.turnCount} turns, ${state.totalToolCalls} tool calls`
  );
  printDivider();
}

// ─── Help & Shortcuts Display ───────────────────────────────────

function printHelp() {
  print("");
  print("  " + c.bold("Commands:"));
  print("    /help     — Show this help");
  print("    /shortcuts — Show message shortcuts");
  print("    /stats    — Show session statistics");
  print("    /switch   — Switch to different provider");
  print("    /quit     — Exit");
  print("");
  print("  " + c.bold("Shortcuts (type the number):"));
  for (const s of SHORTCUTS) {
    print(`    ${c.cyan(s.key)}  ${s.label}`);
  }
  print("");
}

function printShortcuts() {
  print("");
  print("  " + c.bold("Quick Messages (type the number to send):"));
  for (const s of SHORTCUTS) {
    print(`    ${c.cyan(s.key)}  ${c.bold(s.label)}`);
    print(`       ${c.dim(s.message.slice(0, 70) + (s.message.length > 70 ? "..." : ""))}`);
  }
  print("");
}

function printStats() {
  print("");
  print(`  Provider:         ${state.provider}`);
  print(`  Turns:            ${state.turnCount}`);
  print(`  Total tool calls: ${state.totalToolCalls}`);
  print("");
}

// ─── Chat Loop ──────────────────────────────────────────────────

async function chatLoop(agent: IAgent): Promise<"quit" | "switch"> {
  printHeader(`Chat — ${state.provider} (multi-turn)`);
  printHelp();

  while (true) {
    const raw = await ask(`\n${c.bold("You")}: `);
    const input = raw.trim();

    if (!input) continue;

    if (input === "/quit" || input === "/exit") return "quit";
    if (input === "/switch") return "switch";
    if (input === "/help") { printHelp(); continue; }
    if (input === "/shortcuts") { printShortcuts(); continue; }
    if (input === "/stats") { printStats(); continue; }

    const shortcut = SHORTCUTS.find((s) => s.key === input);
    const message = shortcut ? shortcut.message : input;

    if (shortcut) {
      print(`  ${c.dim(`→ ${shortcut.label}: "${message.slice(0, 60)}..."`)}`);
    }

    await streamResponse(agent, message);
  }
}

// ─── Cleanup ────────────────────────────────────────────────────

async function cleanup() {
  if (state.agent) {
    await state.agent.dispose();
    state.agent = null;
  }
  if (state.service) {
    await state.service.dispose();
    state.service = null;
  }
  state.turnCount = 0;
  state.totalToolCalls = 0;
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  printHeader("@witqq/agent-sdk — Interactive Multi-Backend Demo");
  print("  Test multi-turn conversations across all three backends.");
  print("  Each session includes tools for search, math, and formatting.");
  print("  Type a number (1-7) to send a preset test message.\n");

  let running = true;

  while (running) {
    state.provider = await selectProvider();

    try {
      state.token = await authenticate(state.provider);
    } catch (err) {
      print(`\n${c.red("Auth failed")}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    try {
      state.service = await createService(state.provider, state.token);
    } catch (err) {
      print(`\n${c.red("Service failed")}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const model = await selectModel(state.service);
    state.agent = createAgent(state.service, model, state.provider);

    const action = await chatLoop(state.agent);
    await cleanup();

    if (action === "quit") running = false;
  }

  print("\nGoodbye!");
  rl.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
