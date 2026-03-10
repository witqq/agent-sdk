---
title: Advanced Patterns
description: Production-ready patterns — tools, permissions, error handling, streaming progress, and more.
sidebar:
  order: 3
---

These examples demonstrate real-world patterns for production use. Each is self-contained and copy-pasteable.

## Multi-Tool Composition

Register multiple tools that work together. The LLM decides which tools to call and in what order:

```typescript
import { createAgentService, type ToolDefinition } from "@witqq/agent-sdk";
import { z } from "zod";

const searchTool: ToolDefinition<{ query: string }> = {
  name: "search_docs",
  description: "Search internal documentation",
  parameters: z.object({ query: z.string() }),
  async execute({ query }) {
    // Simulate document search
    return [
      { title: "Auth Guide", snippet: `...${query}...` },
      { title: "API Reference", snippet: `Details about ${query}` },
    ];
  },
};

const summarizeTool: ToolDefinition<{ text: string; maxWords: number }> = {
  name: "summarize",
  description: "Summarize text to a given word count",
  parameters: z.object({
    text: z.string(),
    maxWords: z.number().default(50),
  }),
  async execute({ text, maxWords }) {
    return `Summary (${maxWords} words max): ${text.slice(0, maxWords * 6)}...`;
  },
};

const createTicketTool: ToolDefinition<{
  title: string;
  description: string;
  priority: string;
}> = {
  name: "create_ticket",
  description: "Create a support ticket",
  parameters: z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(["low", "medium", "high"]),
  }),
  async execute(params) {
    const id = `TICKET-${Date.now()}`;
    console.log(`Created ticket ${id}: ${params.title} [${params.priority}]`);
    return { id, ...params, status: "open" };
  },
};

async function main() {
  const service = await createAgentService("copilot", {});
  const agent = service.createAgent({
    systemPrompt: `You are a support agent. Use tools to:
1. Search docs for relevant information
2. Summarize findings for the user
3. Create tickets when issues can't be resolved from docs`,
    tools: [searchTool, summarizeTool, createTicketTool],
  });

  const result = await agent.run(
    "I can't figure out how to set up OAuth. Can you help?",
    { model: "gpt-4.1" },
  );

  console.log("Response:", result.output);
  console.log(
    "Tools used:",
    result.toolCalls.map((tc) => tc.toolName),
  );

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Permission Handling

Control which tool calls require user approval:

```typescript
import {
  createAgentService,
  type ToolDefinition,
  type PermissionRequest,
  type PermissionDecision,
  type SupervisorHooks,
} from "@witqq/agent-sdk";
import { z } from "zod";

const readFileTool: ToolDefinition<{ path: string }> = {
  name: "read_file",
  description: "Read a file from disk",
  parameters: z.object({ path: z.string() }),
  // No approval needed — read-only operation
  needsApproval: false,
  async execute({ path }) {
    return `Contents of ${path}: ...`;
  },
};

const deleteFileTool: ToolDefinition<{ path: string }> = {
  name: "delete_file",
  description: "Delete a file from disk",
  parameters: z.object({ path: z.string() }),
  // Requires explicit approval — destructive operation
  needsApproval: true,
  async execute({ path }) {
    console.log(`Deleted: ${path}`);
    return { deleted: path };
  },
};

// Supervisor hooks handle approval logic
const supervisor: SupervisorHooks = {
  async onPermission(
    request: PermissionRequest,
    _signal: AbortSignal,
  ): Promise<PermissionDecision> {
    console.log(`Permission requested for: ${request.toolName}`);
    console.log(`  Args: ${JSON.stringify(request.toolArgs)}`);

    // Auto-approve safe paths, deny everything else
    const path = request.toolArgs.path as string;
    if (path.startsWith("/tmp/")) {
      return { allowed: true, scope: "session" };
    }
    return { allowed: false, reason: "Only /tmp/ paths allowed" };
  },
};

async function main() {
  const service = await createAgentService("copilot", {});
  const agent = service.createAgent({
    systemPrompt: "You manage files. Use tools as needed.",
    tools: [readFileTool, deleteFileTool],
    supervisor,
  });

  const result = await agent.run(
    "Read /tmp/data.txt then delete /tmp/old-data.txt",
    { model: "gpt-4.1" },
  );
  console.log(result.output);

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Interactive User Input

Let the agent ask the user questions during execution:

```typescript
import {
  createAgentService,
  type SupervisorHooks,
  type UserInputRequest,
  type UserInputResponse,
} from "@witqq/agent-sdk";
import * as readline from "node:readline";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

const supervisor: SupervisorHooks = {
  async onAskUser(
    request: UserInputRequest,
    _signal: AbortSignal,
  ): Promise<UserInputResponse> {
    console.log(`\nAgent asks: ${request.question}`);
    if (request.choices?.length) {
      request.choices.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
    }
    const answer = await prompt("Your answer: ");
    return { answer, wasFreeform: true };
  },
};

async function main() {
  const service = await createAgentService("copilot", {});
  const agent = service.createAgent({
    systemPrompt: "You help users configure projects. Ask clarifying questions.",
    supervisor,
  });

  const result = await agent.run("Set up a new web project for me.", {
    model: "gpt-4.1",
  });
  console.log(result.output);

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Streaming with Progress Tracking

Build a progress indicator for long-running agent tasks:

```typescript
import { createAgentService, type AgentEvent, type IAgent } from "@witqq/agent-sdk";

async function streamWithProgress(
  agent: IAgent,
  prompt: string,
  model: string,
): Promise<string> {
  const stream = agent.stream(prompt, { model });

  let output = "";
  let tokenCount = 0;
  let toolsInProgress: string[] = [];

  for await (const event of stream) {
    switch (event.type) {
      case "text_delta":
        output += event.text;
        tokenCount++;
        // Update progress indicator every 10 tokens
        if (tokenCount % 10 === 0) {
          process.stderr.write(
            `\r⏳ Generating... ${tokenCount} tokens`,
          );
        }
        break;

      case "tool_call_start":
        toolsInProgress.push(event.toolName);
        process.stderr.write(
          `\r🔧 Calling tool: ${event.toolName}...      `,
        );
        break;

      case "tool_call_end":
        toolsInProgress = toolsInProgress.filter(
          (t) => t !== event.toolName,
        );
        process.stderr.write(
          `\r✅ Tool ${event.toolName} completed.       `,
        );
        break;

      case "thinking_start":
        process.stderr.write("\r🧠 Thinking...                    ");
        break;

      case "thinking_end":
        process.stderr.write("\r💡 Done thinking.                 ");
        break;

      case "usage_update":
        process.stderr.write(
          `\r📊 Tokens: ${event.promptTokens}→${event.completionTokens}`,
        );
        break;

      case "error":
        process.stderr.write(`\r❌ Error: ${event.error}\n`);
        if (!event.recoverable) throw new Error(event.error);
        break;

      case "done":
        process.stderr.write(
          `\r✨ Complete! (${tokenCount} tokens)        \n`,
        );
        break;
    }
  }

  return output;
}

async function main() {
  const service = await createAgentService("copilot", {});
  const agent = service.createAgent({
    systemPrompt: "You are a thorough technical writer.",
  });

  const output = await streamWithProgress(
    agent,
    "Explain the event loop in Node.js in detail.",
    "gpt-4.1",
  );

  console.log("\n--- Response ---\n");
  console.log(output);

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Abort and Timeout

Cancel long-running requests with AbortController or built-in timeouts:

```typescript
import { createAgentService } from "@witqq/agent-sdk";

async function main() {
  const service = await createAgentService("copilot", {});

  // Method 1: AbortController
  const agent1 = service.createAgent({ systemPrompt: "Be verbose." });
  const controller = new AbortController();

  // Cancel after 3 seconds
  setTimeout(() => {
    console.log("Aborting...");
    controller.abort();
  }, 3000);

  try {
    await agent1.run("Write a very long essay about AI.", {
      model: "gpt-4.1",
      signal: controller.signal,
    });
  } catch (err) {
    console.log("Aborted:", (err as Error).message);
  }

  // Method 2: Built-in timeout configuration
  const agent2 = service.createAgent({
    systemPrompt: "Test timeout.",
    timeout: {
      total: 5000, // 5 second total timeout
    },
  });

  try {
    await agent2.run("Write another long essay.", { model: "gpt-4.1" });
  } catch (err) {
    console.log("Timed out:", (err as Error).message);
  }

  // Method 3: agent.abort() — cancel from another context
  const agent3 = service.createAgent({ systemPrompt: "Test" });
  const promise = agent3.run("Long task...", { model: "gpt-4.1" });

  setTimeout(() => agent3.abort(), 2000);

  try {
    await promise;
  } catch (err) {
    console.log("Agent aborted:", (err as Error).message);
  }

  agent1.dispose();
  agent2.dispose();
  agent3.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Error Handling Patterns

Production-grade error handling with retry and classification:

```typescript
import {
  createAgentService,
  AgentSDKError,
  SubprocessError,
  AbortError,
  ActivityTimeoutError,
  classifyAgentError,
  type IAgent,
} from "@witqq/agent-sdk";

async function robustRun(
  agent: IAgent,
  prompt: string,
  model: string,
  maxRetries = 3,
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await agent.run(prompt, { model });
      return result.output;
    } catch (err) {
      // Classify the error to decide retry strategy
      const errorCode = classifyAgentError(err as Error);

      if (err instanceof AbortError) {
        console.log("Request was cancelled — not retrying");
        return null;
      }

      if (err instanceof ActivityTimeoutError) {
        console.log(`Attempt ${attempt}: timeout, retrying...`);
        continue;
      }

      if (err instanceof SubprocessError) {
        console.log(`Attempt ${attempt}: backend process error`);
        if (attempt === maxRetries) throw err;
        // Wait before retry with exponential backoff
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      if (err instanceof AgentSDKError) {
        console.error(`SDK error (code: ${errorCode}): ${(err as Error).message}`);
        throw err;
      }

      // Unknown error — don't retry
      throw err;
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts`);
}

async function main() {
  const service = await createAgentService("copilot", {});
  const agent = service.createAgent({ systemPrompt: "Test error handling." });

  const result = await robustRun(agent, "Hello!", "gpt-4.1");
  console.log(result);

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```

## Usage Tracking

Monitor token consumption across agent calls:

```typescript
import { createAgentService, type UsageData } from "@witqq/agent-sdk";

// Accumulate usage across all calls
let totalPromptTokens = 0;
let totalCompletionTokens = 0;

async function main() {
  const service = await createAgentService("copilot", {});
  const agent = service.createAgent({
    systemPrompt: "Be concise.",
    onUsage(usage: UsageData) {
      totalPromptTokens += usage.promptTokens;
      totalCompletionTokens += usage.completionTokens;
      console.log(
        `[Usage] ${usage.model}: +${usage.promptTokens}/${usage.completionTokens} tokens`,
      );
    },
  });

  await agent.run("What is 2+2?", { model: "gpt-4.1" });
  await agent.run("What is 3+3?", { model: "gpt-4.1" });
  await agent.run("What is 4+4?", { model: "gpt-4.1" });

  console.log("\n--- Total Usage ---");
  console.log(`Prompt tokens: ${totalPromptTokens}`);
  console.log(`Completion tokens: ${totalCompletionTokens}`);
  console.log(`Total tokens: ${totalPromptTokens + totalCompletionTokens}`);

  agent.dispose();
  await service.dispose();
}

main().catch(console.error);
```
