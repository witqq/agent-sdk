# Backends

Four backends implement `IAgentService`. CLI backends (Copilot, Claude) spawn a subprocess — the CLI drives the tool loop. API backends (Vercel AI) make HTTP calls — the SDK drives the tool loop. Mock LLM is built-in for testing.

## Feature Matrix

| Feature | Copilot | Claude | Vercel AI | Mock LLM |
|---------|---------|--------|-----------|----------|
| `run()` | ✓ | ✓ | ✓ | ✓ |
| `stream()` | ✓ | ✓ | ✓ | ✓ |
| `runStructured()` | ✓ (text extraction) | ✓ (text extraction) | ✓ (`generateObject`) | ✓ (configurable) |
| Persistent sessions | ✓ | ✓ | — | — |
| Tool execution | External (CLI) | External (CLI) | Internal (SDK) | Simulated |
| Permission callbacks | ✓ | ✓ | — | ✓ (configurable) |
| Ask user | ✓ | — | ✓ (injected tool) | — |
| Auth | GitHub Device Flow | OAuth + PKCE | API key | — |
| `listModels()` | ✓ (GitHub API) | ✓ (Anthropic API) | ✓ (provider API) | ✓ (static list) |
| Retry on transient errors | ✓ | ✓ | ✓ | ✓ |
| Heartbeat | ✓ | ✓ | ✓ | ✓ |
| External dependency | `@github/copilot-sdk` | `@anthropic-ai/claude-agent-sdk` | `ai` + `@ai-sdk/openai-compatible` | None |

## Copilot

Wraps `@github/copilot-sdk` — spawns a Node.js subprocess running the Copilot CLI agent.

### Install

```bash
npm install @github/copilot-sdk
```

### Setup

```typescript
import { createCopilotService } from "@witqq/agent-sdk/copilot";

const service = createCopilotService({
  useLoggedInUser: true,           // use GitHub CLI auth (gh auth)
  // OR:
  // githubToken: "ghp_...",       // explicit token
  workingDirectory: process.cwd(), // optional
  cliPath: "/path/to/copilot",    // optional custom CLI path
  cliArgs: ["--allow-all"],        // optional extra CLI flags
  env: { PATH: "/custom/bin" },    // optional env vars for subprocess
});
```

### Notes

- **System requirements:** `@github/copilot-sdk` includes a native binary requiring glibc. Alpine Linux (musl) is not supported — use `node:24.20.0-bookworm-slim` or similar.
- **Headless mode:** Without `supervisor.onPermission` / `supervisor.onAskUser`, the backend auto-approves permissions and auto-answers user questions to prevent hanging.
- **System prompt mode:** Default `mode: "append"` adds your prompt to the Copilot built-in prompt. Use `systemMessageMode: "replace"` to fully replace it (removes built-in tool instructions).
- **Available tools filter:** Restrict Copilot built-in tools with `availableTools: ["web_search", "web_fetch"]` in `AgentConfig`.

## Claude

Wraps `@anthropic-ai/claude-agent-sdk` — spawns a subprocess running the Claude CLI agent.

### Install

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Setup

```typescript
import { createClaudeService } from "@witqq/agent-sdk/claude";

const service = createClaudeService({
  workingDirectory: process.cwd(),
  cliPath: "/path/to/claude",     // optional
  maxTurns: 10,                    // optional turn limit
  env: { CLAUDE_CONFIG_DIR: "/custom/config" },
});
```

### Notes

- `supervisor.onAskUser` is **not supported** — a warning is emitted if set.
- When `supervisor.onPermission` is set, the Claude backend automatically sets `permissionMode: "default"` so the CLI invokes the callback instead of using built-in rules.

## Vercel AI

Wraps Vercel AI SDK 7 with `@ai-sdk/openai-compatible` for OpenRouter, OpenAI, and compatible providers.

### Install

```bash
npm install ai @ai-sdk/openai-compatible
```

### Setup

```typescript
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";

const service = createVercelAIService({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseUrl: "https://openrouter.ai/api/v1", // default
  provider: "openrouter",                   // default
});
```

### Conversation History and Output Limit

Pass SDK `Message[]` to `runWithContext()` or `streamWithContext()`. Keep assistant tool calls and their matching tool results in the history. Each result's `toolCallId` must match the assistant call's `id`, and both use the same tool name.

```typescript
import type { Message } from "@witqq/agent-sdk";
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";

const service = createVercelAIService({ apiKey: process.env.OPENROUTER_API_KEY! });
const agent = service.createAgent({
  systemPrompt: "Summarize the supplied tool evidence.",
  modelParams: { maxTokens: 512 },
});
const messages: Message[] = [
  { role: "user", content: "Summarize the search result." },
  { role: "assistant", content: "Searching", toolCalls: [
    { id: "call-1", name: "search", args: { query: "example" } },
  ] },
  { role: "tool", toolResults: [
    { toolCallId: "call-1", name: "search", result: { title: "Example" } },
  ] },
];

const result = await agent.runWithContext(messages, { model: "openai/gpt-4.1-mini" });
```

The backend converts these public messages to native tool content parts without mutating the supplied history. Tool results accept strings or JSON values; set `isError: true` on a result to preserve a tool failure. Assistant text, tool names, call IDs and result values are retained.

`modelParams.maxTokens` limits generated output on blocking, structured and streaming calls. The backend maps it to AI SDK 7's `maxOutputTokens`. Configure this public setting directly; no provider option is required for the output limit.

### Retry Ownership

Native AI transport retries are disabled for blocking, structured and streaming execution. With `RunOptions.retry` omitted or `retry.maxRetries: 0`, each model step issues one provider request. A tool loop can still contain several model steps.

`RunOptions.retry` controls the SDK lifecycle's retries for recognized retryable `AgentSDKError` instances. Raw native provider failures are not automatically converted into retryable SDK errors. A stream can retry only before its first event reaches the caller; later failures propagate without restarting the visible operation.

### Prompt Rejection and Provider Effects

When native `InvalidPromptError` occurs before the model's generation or streaming method is entered, the backend throws `AgentSDKError` with `code: "INVALID_INPUT"`, `retryable: false`, `providerRequestSent: false` and the native error as `cause`. Correct the prompt before retrying. For streaming, catch this error around iteration of the async iterable.

Use `AgentSDKError.is(error)` across bundled entry points. Only explicit `providerRequestSent === false` proves that no model request was dispatched. An undefined value leaves provider effects unknown. A provider-originated `InvalidPromptError` after dispatch retains its original identity without an unsent marker; network failures, timeouts and aborts also provide no unsent proof.

### Native Stream Failures

A terminal provider stream error emits an `error` event with an `AgentSDKError` in `cause`, drains native terminal promises without replacing the primary failure, and throws that same SDK error from iteration. It does not emit `done`. Usage already measured in completed steps remains available; synthetic finish parts do not prove a successful response or an unsent request.

Native `Error` causes retain their identity for in-process consumers. Plain provider payloads, including AI SDK `StreamProviderError.data`, are projected to bounded diagnostic fields: `message` (2048 characters), string `code` (128), `type` (128), and `param` (256, or null). Finite numeric codes are retained; a numeric integer status hint from 400 through 599 can populate `httpStatus`. Arbitrary provider fields are excluded from this projection. Do not serialize raw `Error` causes to clients; select the public diagnostic fields your application needs.

A throwing tool emits a recoverable `error` with `code: "TOOL_EXECUTION"`, `toolCallId`, `toolName` and its primary cause. It does not emit a successful `tool_call_end`. The native model may continue with the failed tool result, and measured model usage is retained. `recoverable` describes that tool-loop behavior; it does not authorize a hidden provider retry.

### Declared Input and Local Tool Refusals

Declared Zod parameters are validated by the native parser before the application executor, including the injected `ask_user` question schema. Accepted values follow the declared schema. A rejected call retains its actual invalid input.

A streaming native refusal for an unavailable tool or invalid input can carry `error.localToolRefusal`, exported as `LocalToolRefusal`. It requires a recognized native parse-error class and matching call/error observations with no local or provider tool execution. Its `reason` is `no_such_tool` or `invalid_tool_input`; ID, name and optional arguments describe the observed call. Generic thrown errors, provider-executed failures and error wording provide no equivalent proof. No successful `tool_call_end` is emitted for a refusal.

Streaming `tool_call_start.args` is optional. Retain absent input as absent and actual null as null. These observations remain untrusted. Local refusal does not mean the model request was unsent, its response complete or its usage zero. Applications own admission of any continuation.

For a native call whose initial streamed name is empty, the backend can locally normalize one later consistent name observed for the same call ID. It retains the original identity and native argument assembly, resets observations for each request and adds no model request. Missing or conflicting names are not guessed. This local assembly normalization does not change the caller's configured native tool-loop limit.


### Model-Specific Options

Pass provider options via `providerOptions` on `AgentConfig`:

```typescript
const agent = service.createAgent({
  model: "google/gemini-2.0-flash",
  systemPrompt: "Think step by step.",
  providerOptions: {
    google: { thinkingConfig: { thinkingBudget: 1024 } },
  },
});
```

### Cost & Provider Metadata

Per-request cost reporting is enabled automatically. The backend asks the gateway to include cost/cache details in the response usage and lifts that block into `providerMetadata`, so cost surfaces with no extra configuration — for both streaming and non-streaming, and for any OpenAI-compatible gateway that reports cost (OpenRouter and similar).

```typescript
const result = await agent.run("Hello", { model: "openai/gpt-4.1-mini" });
result.usage?.cost;             // number | undefined — normalized USD cost (e.g. OpenRouter)
result.usage?.cachedTokens;     // number | undefined — prompt tokens served from cache
result.usage?.providerMetadata; // raw provider metadata, untouched
```

`promptTokens` and `completionTokens` come from native input and output token usage. Blocking and streaming tool loops total tokens, cost and cached tokens across completed steps. Structured output reports its generation usage. Raw `providerMetadata` is the last available step's metadata.

Streaming `usage_update` events are cumulative snapshots for the current run. Replace the previous snapshot rather than adding snapshots together; completed-step usage remains available if a later step fails. Normalized `cost` is supplied only when every observed step reports a measured cost, on both blocking and streaming tool loops. If a later step has no reported cost, the latest snapshot omits `cost`; an earlier snapshot can still retain its measured prefix cost. Raw `providerMetadata` remains the last available step's metadata and does not establish a complete run price. Missing cache details leave `cachedTokens` undefined.

Streaming snapshots and the `onUsage` callback include optional `tokenUsageKnown: { promptTokens, completionTokens }` presence flags. A false flag means the numeric counter contains only the measured prefix, not a known zero for the missing usage. Explicit raw provider zero counts are known. A step with neither measured tokens nor reported cost emits no usage snapshot unless an earlier measured prefix needs to be marked incomplete. Missing usage, partial text and terminal stream errors never establish zero cost or an unsent request. Backends or blocking results without these flags do not establish the same presence guarantee.

`providerOptions` remains the supported path for other per-provider request extras. It reaches `generateText`, `generateObject`, and `streamText` on all paths.

```typescript
const agent = service.createAgent({
  model: "google/gemini-2.0-flash",
  systemPrompt: "Think step by step.",
  providerOptions: {
    google: { thinkingConfig: { thinkingBudget: 1024 } },
  },
});
```

### Notes

- Uses `generateText()` for runs, `generateObject()` for structured output, `streamText()` for streaming.
- Supports `supervisor.onAskUser` via an injected `ask_user` tool.
- `finishReason` from the stream `finish` part is propagated to the `done` event.

## Mock LLM

Built-in backend for automated testing. No external dependencies — no API keys, no CLI tools, no network calls. Extends `BaseAgent` for full lifecycle support (retry, heartbeat, middleware, usage enrichment).

### Setup

```typescript
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

const service = createMockLLMService({ mode: { type: "echo" } });
const agent = service.createAgent({ systemPrompt: "Test" });
```

### Response Modes

| Mode | Configuration | Behavior |
|------|--------------|----------|
| Echo | `{ type: "echo" }` | Returns the user's prompt as the response |
| Static | `{ type: "static", response: "text" }` | Always returns the specified response |
| Scripted | `{ type: "scripted", responses: [...], loop?: true }` | Returns responses in sequence. With `loop: true`, cycles back to start; without, repeats last response |
| Error | `{ type: "error", error: "msg", code?: "TIMEOUT", recoverable?: true }` | Throws `AgentSDKError`. Set `recoverable: true` for BaseAgent retry |

### Advanced Capabilities

- **Latency simulation** — `latency: { type: "fixed", ms: 100 }` or `latency: { type: "random", minMs, maxMs }`
- **Streaming control** — `streaming: { chunkSize: 5, chunkDelayMs: 10 }`
- **Permission simulation** — `permissions: { toolNames: ["bash"], autoApprove: true }` or `permissions: { toolNames: ["rm"], denyTools: ["rm"] }`
- **Tool call simulation** — `toolCalls: [{ toolName: "search", args: {...}, result: {...} }]`
- **Structured output** — `structuredOutput: { city: "Paris", country: "France" }`
- **Configurable finishReason** — `finishReason: "stop" | "length" | "tool-calls"`

See [Mock LLM Guide](mock-llm.md) for testing patterns and integration with `createMockAgentService`.

## Switching Backends

All backends share `AgentConfig` and return the same `AgentResult`. Switch by changing only the service creation:

```typescript
import { createAgentService } from "@witqq/agent-sdk";

const config = {
  systemPrompt: "You are a helpful assistant.",
  tools: [searchTool],
};

// Switch backend:
const service = await createAgentService("copilot", { useLoggedInUser: true });
// const service = await createAgentService("claude", { workingDirectory: "." });
// const service = await createAgentService("vercel-ai", { apiKey: "..." });

// Mock LLM — use direct import (not registered in createAgentService):
// import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
// const service = createMockLLMService({ mode: { type: "echo" } });

const agent = service.createAgent(config);
const result = await agent.run("Hello", { model: "gpt-5-mini" });
```

Or use direct backend imports:

```typescript
import { createCopilotService } from "@witqq/agent-sdk/copilot";
import { createClaudeService } from "@witqq/agent-sdk/claude";
import { createVercelAIService } from "@witqq/agent-sdk/vercel-ai";
import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
```

## Model Names

| Backend | Model ID example | Short name |
|---------|-----------------|------------|
| Copilot | `gpt-4o` | (same) |
| Claude | `claude-sonnet-4-5-20250514` | `sonnet` |
| Vercel AI | `anthropic/claude-sonnet-4-5` | (provider-specific) |
| Mock LLM | `mock-model` | (any string) |

Use `service.listModels()` to get available models per backend.
