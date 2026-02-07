# agent-sdk

Multi-backend AI agent abstraction layer for Node.js. Switch between Copilot CLI, Claude CLI, and Vercel AI SDK backends with a unified API.

## Install

```bash
npm install @witqq/agent-sdk zod
```

## Backends

| Backend | Peer dependency | Type |
|---|---|---|
| `copilot` | `@github/copilot-sdk` | CLI subprocess |
| `claude` | `@anthropic-ai/claude-agent-sdk` | CLI subprocess |
| `vercel-ai` | `ai` + `@ai-sdk/openai-compatible` | API-based |

Install only the backend you need:

```bash
npm install @github/copilot-sdk            # copilot
npm install @anthropic-ai/claude-agent-sdk  # claude
npm install ai @ai-sdk/openai-compatible   # vercel-ai
```

## Quick Start

```typescript
import { createAgentService } from "@witqq/agent-sdk";
import { z } from "zod";

const service = await createAgentService("copilot", { useLoggedInUser: true });

const agent = service.createAgent({
  systemPrompt: "You are a helpful assistant.",
  tools: [
    {
      name: "search",
      description: "Search the web",
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ results: [`Result for: ${query}`] }),
    },
  ],
});

const result = await agent.run("Find news about AI");
console.log(result.output);

agent.dispose();
await service.dispose();
```

## Tool Definition

Tools are defined with a Zod schema for parameters and an `execute` function:

```typescript
import { z } from "zod";
import type { ToolDefinition } from "@witqq/agent-sdk";

// Basic tool
const searchTool: ToolDefinition = {
  name: "search",
  description: "Search the web",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => ({ results: [`Result for: ${query}`] }),
};

// Tool requiring user approval before execution
const writeFileTool: ToolDefinition = {
  name: "write_file",
  description: "Write content to a file",
  parameters: z.object({ path: z.string(), content: z.string() }),
  needsApproval: true,
  execute: async ({ path, content }) => ({ written: true, path }),
};
```

When `needsApproval: true`, the `supervisor.onPermission` callback is invoked before execution. Without a supervisor, approval-required tools are denied by default.

## Permission Handling

The `supervisor` hooks intercept permission requests and user-facing questions:

```typescript
const agent = service.createAgent({
  systemPrompt: "File assistant",
  tools: [writeFileTool],
  supervisor: {
    onPermission: async (req, signal) => {
      // req.toolName, req.toolArgs, req.suggestedScope
      console.log(`${req.toolName} wants to run with`, req.toolArgs);
      return {
        allowed: true,
        scope: "session",          // "once" | "session" | "project" | "always"
        // modifiedInput: { ... }, // optionally modify args before execution
        // reason: "...",          // denial reason (if allowed: false)
      };
    },
    onAskUser: async (req, signal) => {
      // req.question, req.choices, req.allowFreeform
      return { answer: "yes", wasFreeform: false };
    },
  },
});
```

## Permission Store

Persist permission decisions across runs so approved tools don't re-prompt:

```typescript
import { createDefaultPermissionStore } from "@witqq/agent-sdk";

const store = createDefaultPermissionStore("./my-project");
const agent = service.createAgent({
  systemPrompt: "File assistant",
  permissionStore: store,
  tools: [writeFileTool],
  supervisor: {
    onPermission: async (req) => ({ allowed: true, scope: "project" }),
  },
});
```

Scopes control persistence:
- `"once"` — not stored, one-time approval
- `"session"` — in-memory, cleared on dispose
- `"project"` — persisted to `<projectDir>/.agent-sdk/permissions.json`
- `"always"` — persisted to `~/.agent-sdk/permissions.json`

Custom stores implement `IPermissionStore`:

```typescript
interface IPermissionStore {
  isApproved(toolName: string): Promise<boolean>;
  approve(toolName: string, scope: PermissionScope): Promise<void>;
  revoke(toolName: string): Promise<void>;
  clear(): Promise<void>;
  dispose(): Promise<void>;
}
```

## Structured Output

Extract typed data from LLM responses using `runStructured`:

```typescript
import { z } from "zod";

const result = await agent.runStructured(
  "What is the capital of France?",
  {
    schema: z.object({
      city: z.string(),
      country: z.string(),
      population: z.number(),
    }),
    name: "city_info",           // optional, helps the LLM
    description: "City details", // optional
  },
);

console.log(result.structuredOutput);
// { city: "Paris", country: "France", population: 2161000 }
```

The Vercel AI backend uses `generateObject()` for structured output. Copilot and Claude backends extract structured data from the LLM text response.

## Streaming Events

All backends emit the same event types:

```typescript
for await (const event of agent.stream("Tell me a story")) {
  switch (event.type) {
    case "text_delta":
      process.stdout.write(event.text);
      break;
    case "tool_call_start":
      console.log(`Calling ${event.toolName}`, event.args);
      break;
    case "tool_call_end":
      console.log(`${event.toolName} returned`, event.result);
      break;
    case "error":
      console.error(event.error, "recoverable:", event.recoverable);
      break;
    case "done":
      console.log("Final:", event.finalOutput);
      break;
  }
}
```

| Event | Fields | Description |
|-------|--------|-------------|
| `text_delta` | `text` | Incremental text output |
| `thinking_start` | — | Model started reasoning |
| `thinking_end` | — | Model finished reasoning |
| `tool_call_start` | `toolName`, `args` | Tool invocation began |
| `tool_call_end` | `toolName`, `result` | Tool invocation completed |
| `permission_request` | `request` | Permission check initiated |
| `permission_response` | `toolName`, `decision` | Permission decision made |
| `ask_user` | `request` | User input requested |
| `ask_user_response` | `answer` | User response received |
| `usage_update` | `promptTokens`, `completionTokens` | Token usage |
| `error` | `error`, `recoverable` | Error during execution |
| `done` | `finalOutput`, `structuredOutput?` | Execution completed |

## Backend-Specific Options

### Copilot

```typescript
import { createCopilotService } from "@witqq/agent-sdk/copilot";

const service = createCopilotService({
  useLoggedInUser: true,          // use GitHub CLI auth
  cliPath: "/path/to/copilot",   // optional custom CLI path
  workingDirectory: process.cwd(),
  githubToken: "ghp_...",        // optional, alternative to useLoggedInUser
});
```

### Claude

```typescript
import { createClaudeService } from "@witqq/agent-sdk/claude";

const service = createClaudeService({
  cliPath: "/path/to/claude",    // optional custom CLI path
  workingDirectory: process.cwd(),
  maxTurns: 10,
});
```

`supervisor.onAskUser` is not supported by the Claude backend; a warning is emitted if set.

### Vercel AI (OpenRouter / OpenAI-compatible)

```typescript
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";

const service = createVercelAIService({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseUrl: "https://openrouter.ai/api/v1", // default
  provider: "openrouter",                   // default
});

const agent = service.createAgent({
  model: "anthropic/claude-sonnet-4-5",
  systemPrompt: "You are a helpful assistant.",
  tools: [searchTool],
});
```

Uses `generateText()` for runs, `generateObject()` for structured output, `streamText()` for streaming. Supports `supervisor.onAskUser` via an injected `ask_user` tool.

## Switching Backends

All backends share the same `AgentConfig` and return the same `AgentResult`. To switch backends, change only the service creation:

```typescript
import { createAgentService } from "@witqq/agent-sdk";
import { z } from "zod";

const tools = [
  {
    name: "greet",
    description: "Greet a user",
    parameters: z.object({ name: z.string() }),
    execute: async ({ name }) => ({ message: `Hello, ${name}!` }),
  },
];

const config = {
  systemPrompt: "You are a helpful assistant.",
  tools,
};

// Switch backend by changing the first argument:
const service = await createAgentService("copilot", { useLoggedInUser: true });
// const service = await createAgentService("claude", { workingDirectory: "." });
// const service = await createAgentService("vercel-ai", { apiKey: "..." });

const agent = service.createAgent(config);
const result = await agent.run("Greet Alice");
```

Or use direct backend imports to avoid lazy loading:

```typescript
import { createCopilotService } from "@witqq/agent-sdk/copilot";
import { createClaudeService } from "@witqq/agent-sdk/claude";
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";
```

## Build

```bash
npm run build     # tsup → ESM + CJS
npm run test      # vitest
npm run typecheck  # tsc --noEmit
```

## License

MIT
