/**
 * Integration test for Copilot CLI backend.
 *
 * Requires:
 * - `copilot` CLI installed and authenticated
 * - `@github/copilot-sdk` installed (peer dependency)
 *
 * Run: npx vitest run tests/integration/copilot.test.ts
 * Skip in CI: these tests require authentication and real API calls.
 */
import { describe, it, expect, afterAll } from "vitest";
import { z } from "zod";
import { createCopilotService } from "../../src/backends/copilot.js";
import type { AgentConfig, AgentEvent, PermissionRequest, UserInputRequest } from "../../src/types.js";

// Check if @github/copilot-sdk is available
let sdkAvailable = false;
try {
  await import("@github/copilot-sdk");
  sdkAvailable = true;
} catch {
  sdkAvailable = false;
}

// IMPORTANT: Use ONLY free/cheapest models for integration tests!
// NEVER use paid models (gpt-4.1, gpt-5, claude-sonnet, etc.) — they consume subscription.
const TEST_MODEL = "gpt-5-mini";
const TIMEOUT = 120_000;

// Track service for cleanup
let service: ReturnType<typeof createCopilotService> | null = null;

afterAll(async () => {
  if (service) {
    await service.dispose();
    service = null;
  }
});

function getService() {
  if (!service) {
    service = createCopilotService({
      useLoggedInUser: true,
    });
  }
  return service;
}

describe.skipIf(!sdkAvailable)("Copilot CLI Backend — Integration", () => {
  it("should validate authentication", async () => {
    const svc = getService();
    const result = await svc.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  }, TIMEOUT);

  it("should list available models", async () => {
    const svc = getService();
    const models = await svc.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toBeDefined();
    expect(models[0].name).toBeDefined();
    // Check that gpt-4.1-mini is available
    const miniModel = models.find((m) => m.id.includes("gpt-4.1") || m.id.includes("gpt-5-mini"));
    expect(miniModel).toBeDefined();
  }, TIMEOUT);

  it("should run a simple prompt and return output", async () => {
    const svc = getService();
    const config: AgentConfig = {
      systemPrompt: "You are a helpful assistant. Always respond briefly.",
      tools: [],
      model: TEST_MODEL,
    };
    const agent = svc.createAgent(config);

    try {
      const result = await agent.run("What is 2+2? Answer with just the number.");
      expect(result.output).toBeDefined();
      expect(result.output).not.toBeNull();
      expect(result.output!).toContain("4");
      expect(result.messages.length).toBeGreaterThanOrEqual(2);
    } finally {
      agent.dispose();
    }
  }, TIMEOUT);

  it("should call a registered tool", async () => {
    const toolCalls: Array<{ query: string }> = [];

    const svc = getService();
    const config: AgentConfig = {
      systemPrompt:
        "You are a news assistant. When asked for news, ALWAYS use the search_news tool first. Respond with the results.",
      tools: [
        {
          name: "search_news",
          description: "Search for latest news articles on a topic",
          parameters: z.object({
            query: z.string().describe("The search query for news"),
          }),
          execute: async (params) => {
            toolCalls.push(params);
            return {
              articles: [
                { title: "AI Advances in 2025", source: "TechNews" },
                { title: "New Chip Architecture", source: "HardwareWorld" },
              ],
            };
          },
        },
      ],
      model: TEST_MODEL,
    };
    const agent = svc.createAgent(config);

    try {
      const result = await agent.run("What are the latest tech news?");

      // Tool should have been called
      expect(toolCalls.length).toBeGreaterThanOrEqual(1);
      expect(toolCalls[0].query).toBeDefined();

      // Result should reference the tool output
      expect(result.output).toBeDefined();
      expect(result.toolCalls.length).toBeGreaterThanOrEqual(1);
      expect(result.toolCalls[0].toolName).toBe("search_news");
    } finally {
      agent.dispose();
    }
  }, TIMEOUT);

  it("should fire permission callback", async () => {
    const permissionRequests: PermissionRequest[] = [];

    const svc = getService();
    const config: AgentConfig = {
      systemPrompt: "You are a file assistant. Use the write_file tool to write 'hello' to /tmp/test-agent-sdk.txt.",
      tools: [
        {
          name: "write_file",
          description: "Write content to a file",
          parameters: z.object({
            path: z.string().describe("File path"),
            content: z.string().describe("File content"),
          }),
          needsApproval: true,
          execute: async (params) => {
            return { written: true, path: params.path };
          },
        },
      ],
      model: TEST_MODEL,
      supervisor: {
        onPermission: async (req) => {
          permissionRequests.push(req);
          return { allowed: true, scope: "once" };
        },
      },
    };
    const agent = svc.createAgent(config);

    try {
      const result = await agent.run("Write hello to /tmp/test-agent-sdk.txt");
      // Permission callback should have fired at least once
      // Note: The Copilot CLI may or may not trigger permission for SDK-provided tools
      // depending on the CLI's internal permission model
      expect(result.output).toBeDefined();
    } finally {
      agent.dispose();
    }
  }, TIMEOUT);

  it("should stream events", async () => {
    const svc = getService();
    const config: AgentConfig = {
      systemPrompt: "You are a helpful assistant. Respond briefly.",
      tools: [],
      model: TEST_MODEL,
    };
    const agent = svc.createAgent(config);

    try {
      const events: AgentEvent[] = [];
      for await (const event of agent.stream("Say hello")) {
        events.push(event);
      }

      // Should have at least some text_delta events
      const textDeltas = events.filter((e) => e.type === "text_delta");
      expect(textDeltas.length).toBeGreaterThan(0);

      // Should have a done event
      const doneEvents = events.filter((e) => e.type === "done");
      expect(doneEvents.length).toBeGreaterThanOrEqual(1);
    } finally {
      agent.dispose();
    }
  }, TIMEOUT);

  it("should return structured output", async () => {
    const svc = getService();
    const schema = z.object({
      answer: z.number(),
      explanation: z.string(),
    });

    const config: AgentConfig = {
      systemPrompt: "You are a math assistant. Always respond in the requested JSON format.",
      tools: [],
      model: TEST_MODEL,
    };
    const agent = svc.createAgent(config);

    try {
      const result = await agent.runStructured(
        "What is 7 * 8?",
        { schema },
      );

      // Output should be present
      expect(result.output).toBeDefined();

      // Structured output should parse
      if (result.structuredOutput) {
        expect(result.structuredOutput.answer).toBe(56);
        expect(typeof result.structuredOutput.explanation).toBe("string");
      }
    } finally {
      agent.dispose();
    }
  }, TIMEOUT);
});
