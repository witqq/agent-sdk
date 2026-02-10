/**
 * Interactive demo: @witqq/agent-sdk with authentication flows.
 *
 * Showcases all three backends (Copilot, Claude, Vercel AI) with:
 * - OAuth/Device Flow authentication
 * - Model selection
 * - Streaming agent responses
 * - Provider switching
 *
 * Run locally:  npx tsx examples/auth-demo/index.ts
 * Run in Docker: docker compose -f examples/auth-demo/docker-compose.yml run --rm demo
 */
import * as readline from "node:readline";
import { createAgentService } from "@witqq/agent-sdk";
import type { IAgentService, IAgent, PermissionRequest } from "@witqq/agent-sdk";
import { CopilotAuth, ClaudeAuth } from "@witqq/agent-sdk/auth";
import type { AuthToken, CopilotAuthToken, ClaudeAuthToken } from "@witqq/agent-sdk/auth";

// ─── State ──────────────────────────────────────────────────────

interface AppState {
  provider: "copilot" | "claude" | "vercel-ai" | null;
  token: AuthToken | null;
  service: IAgentService | null;
  agent: IAgent | null;
}

const state: AppState = {
  provider: null,
  token: null,
  service: null,
  agent: null,
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
  print(`\n${"═".repeat(50)}`);
  print(`  ${title}`);
  print(`${"═".repeat(50)}\n`);
}

// ─── Provider Selection ─────────────────────────────────────────

async function selectProvider(): Promise<"copilot" | "claude" | "vercel-ai"> {
  printHeader("Select Provider");
  print("  1. GitHub Copilot (Device Flow auth)");
  print("  2. Claude (OAuth + PKCE auth)");
  print("  3. Vercel AI (API key auth)");
  print("");

  while (true) {
    const choice = await ask("Choice [1-3]: ");
    if (choice === "1") return "copilot";
    if (choice === "2") return "claude";
    if (choice === "3") return "vercel-ai";
    print("Invalid choice. Enter 1, 2, or 3.");
  }
}

// ─── Authentication ─────────────────────────────────────────────

async function authenticateCopilot(): Promise<CopilotAuthToken> {
  printHeader("Copilot Authentication (GitHub Device Flow)");
  const auth = new CopilotAuth();
  const flow = await auth.startDeviceFlow();

  print(`  User Code: ${flow.userCode}`);
  print(`  Open URL:  ${flow.verificationUrl}`);
  print("");
  print("  Enter the code at the URL above, then press Enter here.");
  print("  Waiting for authorization...");

  const token = await flow.waitForToken();
  const copilotToken = token as CopilotAuthToken;
  print(`\n  Authenticated${copilotToken.login ? ` as ${copilotToken.login}` : ""}!`);
  return copilotToken;
}

async function authenticateClaude(): Promise<ClaudeAuthToken> {
  printHeader("Claude Authentication (OAuth + PKCE)");
  const auth = new ClaudeAuth();
  const flow = await auth.startOAuthFlow();

  print(`  Open URL: ${flow.authorizeUrl}`);
  print("");
  print("  After authorizing, paste the authorization code or the full redirect URL.");
  const input = await ask("  Code or URL: ");

  const token = await flow.completeAuth(input);
  print("\n  Authenticated!");
  return token;
}

let vercelBaseUrl: string | null = null;

async function authenticateVercelAI(): Promise<AuthToken> {
  printHeader("Vercel AI Authentication (API Key)");
  const baseUrl = await ask("  Base URL (enter for https://api.openai.com/v1): ");
  vercelBaseUrl = baseUrl || process.env.VERCEL_AI_BASE_URL || "https://api.openai.com/v1";
  const apiKey = await ask("  Enter your API key: ");
  return {
    accessToken: apiKey,
    tokenType: "bearer",
    obtainedAt: Date.now(),
  };
}

async function authenticate(provider: "copilot" | "claude" | "vercel-ai"): Promise<AuthToken> {
  switch (provider) {
    case "copilot": return authenticateCopilot();
    case "claude": return authenticateClaude();
    case "vercel-ai": return authenticateVercelAI();
  }
}

// ─── Service Creation ───────────────────────────────────────────

async function createService(provider: "copilot" | "claude" | "vercel-ai", token: AuthToken): Promise<IAgentService> {
  switch (provider) {
    case "copilot":
      return createAgentService("copilot", { githubToken: token.accessToken });
    case "claude":
      return createAgentService("claude", { oauthToken: token.accessToken });
    case "vercel-ai":
      return createAgentService("vercel-ai", {
        baseUrl: vercelBaseUrl || process.env.VERCEL_AI_BASE_URL || "https://api.openai.com/v1",
        apiKey: token.accessToken,
      });
  }
}

// ─── Model Selection ────────────────────────────────────────────

async function selectModel(service: IAgentService): Promise<string> {
  printHeader("Select Model");

  try {
    const models = await service.listModels();
    if (models.length === 0) {
      print("  No models available. Using default.");
      return "gpt-4.1";
    }

    models.forEach((m, i) => {
      print(`  ${i + 1}. ${m.id}${m.name ? ` — ${m.name}` : ""}`);
    });
    print("");

    while (true) {
      const choice = await ask(`Choice [1-${models.length}]: `);
      const idx = parseInt(choice, 10) - 1;
      if (idx >= 0 && idx < models.length) {
        print(`  Selected: ${models[idx].id}`);
        return models[idx].id;
      }
      print(`Invalid choice. Enter 1-${models.length}.`);
    }
  } catch {
    print("  Could not list models. Enter model name manually.");
    return ask("  Model name: ");
  }
}

// ─── Chat Loop ──────────────────────────────────────────────────

async function chatLoop(agent: IAgent) {
  printHeader("Chat (type /quit to exit, /switch to change provider)");

  while (true) {
    const input = await ask("\nYou: ");

    if (input === "/quit" || input === "/exit") {
      break;
    }
    if (input === "/switch") {
      return "switch";
    }
    if (!input) continue;

    try {
      process.stdout.write("\nAgent: ");
      let hasOutput = false;

      for await (const event of agent.stream(input)) {
        if (event.type === "text_delta" && event.text) {
          process.stdout.write(event.text);
          hasOutput = true;
        }
      }

      if (!hasOutput) {
        print("(no text response)");
      } else {
        print(""); // newline after stream
      }
    } catch (err) {
      print(`\nError: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return "quit";
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  printHeader("@witqq/agent-sdk Interactive Demo");
  print("  This demo showcases authentication and agent interaction");
  print("  across all three supported backends.\n");

  let running = true;

  while (running) {
    // Select provider
    state.provider = await selectProvider();

    // Authenticate
    try {
      state.token = await authenticate(state.provider);
    } catch (err) {
      print(`\nAuthentication failed: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // Create service
    try {
      state.service = await createService(state.provider, state.token);
    } catch (err) {
      print(`\nService creation failed: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // Select model
    const model = await selectModel(state.service);

    // Create agent
    state.agent = state.service.createAgent({
      model,
      systemPrompt: "You are a helpful assistant. Be concise in your responses.",
      sessionMode: state.provider === "copilot" || state.provider === "claude" ? "persistent" : undefined,
      tools: [],
      supervisor: {
        onPermission: async (req: PermissionRequest) => ({
          allowed: true,
          scope: "session" as const,
        }),
      },
    });

    // Chat
    const action = await chatLoop(state.agent);

    // Cleanup
    if (state.agent) {
      await state.agent.dispose();
      state.agent = null;
    }
    if (state.service) {
      await state.service.dispose();
      state.service = null;
    }

    if (action === "quit") {
      running = false;
    }
    // action === "switch" continues the loop
  }

  print("\nGoodbye!");
  rl.close();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
