/**
 * Demo: agent-sdk with Copilot CLI backend (free model via GitHub subscription).
 *
 * Shows: tool usage, permission handling, streaming events.
 *
 * Run: npx tsx examples/copilot-demo.ts
 */
import { createAgentService } from "@witqq/agent-sdk";
import type { PermissionRequest, UserInputRequest } from "@witqq/agent-sdk";
import { z } from "zod";

async function main() {
  console.log("Creating Copilot agent service...\n");

  const service = await createAgentService("copilot", {
    useLoggedInUser: true,
  });

  const agent = service.createAgent({
    systemPrompt:
      "You are a helpful assistant. When asked about current events or news, use the search tool. Always respond concisely.",
    sessionMode: "persistent",
    tools: [
      {
        name: "search_news",
        description: "Search for recent news on a given topic. Returns headlines.",
        parameters: z.object({
          query: z.string().describe("Search query for news"),
        }),
      },
      {
        name: "format_output",
        description: "Format and display the final result to the user",
        parameters: z.object({
          headlines: z.array(z.string()).describe("News headlines to display"),
          summary: z.string().describe("Brief summary"),
        }),
        needsApproval: true,
      },
    ],
    supervisor: {
      onPermission: async (req: PermissionRequest) => {
        console.log(
          `\n🔐 Permission requested for tool: ${req.toolName}`
        );
        console.log(`   Args: ${JSON.stringify(req.toolArgs)}`);
        console.log(`   → Auto-approving with 'session' scope\n`);
        return { allowed: true, scope: "session" as const };
      },
      onAskUser: async (req: UserInputRequest) => {
        console.log(`\n❓ Agent asks: ${req.question}`);
        return { answer: "Continue", wasFreeform: true };
      },
    },
  });

  console.log("Streaming agent response...\n");
  console.log("─".repeat(60));

  try {
    for await (const event of agent.stream(
      "Find 3 recent tech news headlines about AI and format them nicely."
    )) {
      switch (event.type) {
        case "text_delta":
          process.stdout.write(event.text);
          break;
        case "thinking_start":
          console.log("\n💭 [thinking...]");
          break;
        case "thinking_end":
          console.log("💭 [/thinking]");
          break;
        case "tool_call_start":
          console.log(`\n🔧 Tool: ${event.toolName}(${JSON.stringify(event.args)})`);
          break;
        case "tool_call_end":
          console.log(`   ✅ Result: ${JSON.stringify(event.result).slice(0, 100)}...`);
          break;
        case "permission_request":
          console.log(`\n🔐 Permission event: ${(event as any).toolName}`);
          break;
        case "usage_update":
          // silent
          break;
        case "done":
          console.log("\n─".repeat(60));
          console.log("✅ Done!");
          break;
        case "error":
          console.error(`\n❌ Error: ${event.error}`);
          break;
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    agent.dispose();
    await service.dispose();
  }
}

main().catch(console.error);
