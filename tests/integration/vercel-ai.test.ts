/**
 * Integration test for Vercel AI SDK backend.
 *
 * Requires:
 * - `ai` and `@ai-sdk/openai-compatible` installed
 * - OPENROUTER_API_KEY environment variable set
 *
 * Run: npx vitest run tests/integration/vercel-ai.test.ts
 * Skip in CI: these tests require authentication and real API calls.
 */
import { describe, it, expect, afterAll } from "vitest";
import { z } from "zod";
import { createVercelAIService } from "../../src/backends/vercel-ai.js";
import type { AgentConfig, AgentEvent } from "../../src/types.js";

const API_KEY = process.env.OPENROUTER_API_KEY ?? "";
// IMPORTANT: Use ONLY the cheapest models for integration tests!
// NEVER use paid models — they consume subscription.
const TEST_MODEL = "openai/gpt-4.1-mini";
const TIMEOUT = 60_000;

let service: ReturnType<typeof createVercelAIService> | null = null;

afterAll(async () => {
  if (service) {
    await service.dispose();
    service = null;
  }
});

function getService() {
  if (!service) {
    service = createVercelAIService({
      apiKey: API_KEY,
    });
  }
  return service;
}

function baseConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    systemPrompt: "You are a helpful test assistant. Be very brief.",
    tools: [],
    model: TEST_MODEL,
    modelParams: { maxTokens: 200 },
    ...overrides,
  };
}

describe.skipIf(!API_KEY)("Vercel AI SDK Backend — Integration", () => {
  it("should validate configuration", async () => {
    const svc = getService();
    const result = await svc.validate();
    expect(result.valid).toBe(true);
  }, TIMEOUT);

  it("should run a simple prompt", async () => {
    const svc = getService();
    const agent = svc.createAgent(baseConfig());

    const result = await agent.run("Say 'hello world' and nothing else.");

    expect(result.output).toBeDefined();
    expect(result.output!.toLowerCase()).toContain("hello");
    expect(result.usage).toBeDefined();
    expect(result.usage!.promptTokens).toBeGreaterThan(0);

    agent.dispose();
  }, TIMEOUT);

  it("should stream a response", async () => {
    const svc = getService();
    const agent = svc.createAgent(baseConfig());

    const events: AgentEvent[] = [];
    for await (const event of agent.stream("Count from 1 to 3.")) {
      events.push(event);
    }

    const textEvents = events.filter((e) => e.type === "text_delta");
    expect(textEvents.length).toBeGreaterThan(0);

    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);

    agent.dispose();
  }, TIMEOUT);

  it("should generate structured output", async () => {
    const svc = getService();
    const agent = svc.createAgent(baseConfig());

    const schema = z.object({
      color: z.string(),
      hex: z.string(),
    });

    const result = await agent.runStructured(
      "What color is the sky? Give color name and hex code.",
      { schema, name: "color-info" },
    );

    expect(result.structuredOutput).toBeDefined();
    expect(result.structuredOutput!.color).toBeDefined();
    expect(result.structuredOutput!.hex).toBeDefined();

    agent.dispose();
  }, TIMEOUT);

  it("should execute tools", async () => {
    const svc = getService();

    const calcTool = {
      name: "calculate",
      description: "Calculate a math expression. Returns the numeric result.",
      parameters: z.object({ expression: z.string() }),
      execute: async (args: { expression: string }) => {
        // Simple safe math for testing
        const expr = args.expression.trim();
        if (expr === "7 * 8" || expr === "7*8") return "56";
        if (expr === "2 + 2" || expr === "2+2") return "4";
        return `Cannot compute: ${expr}`;
      },
    };

    const agent = svc.createAgent(
      baseConfig({
        tools: [calcTool],
        maxTurns: 5,
      }),
    );

    const result = await agent.run("What is 7 * 8? Use the calculate tool.");

    expect(result.output).toBeDefined();
    // The model should have used the tool
    expect(result.toolCalls.length).toBeGreaterThanOrEqual(1);
    expect(result.toolCalls[0].toolName).toBe("calculate");

    agent.dispose();
  }, TIMEOUT);
});
