/**
 * Mock LLM backend — a fully functional backend for automated testing.
 *
 * Implements IAgentService using BaseAgent, providing configurable response
 * modes (echo, static, scripted, error) with full streaming support.
 * Unlike the lightweight testing mock (createMockAgentService), this backend
 * participates in the full BaseAgent lifecycle: retry, heartbeat, activity
 * timeout, middleware pipeline, and usage enrichment.
 *
 * Advanced capabilities:
 * - Latency simulation (fixed or random delay)
 * - Streaming chunk control (chunk size, inter-chunk delay)
 * - Configurable finishReason in done events
 * - Permission simulation (auto-approve, deny, or delegate to supervisor)
 */
import { BaseAgent } from "../base-agent.js";
import { AgentSDKError } from "../errors.js";
import type {
  IAgentService,
  IAgent,
  FullAgentConfig,
  ModelInfo,
  ValidationResult,
  AgentResult,
  AgentEvent,
  Message,
  RunOptions,
  StructuredOutputConfig,
  MockLLMBackendOptions,
  MockLLMResponseMode,
  MockLLMLatency,
  MockLLMStreamingOptions,
  MockLLMPermissionOptions,
  MockLLMToolCall,
  JSONValue,
} from "../types.js";

// ─── Helpers ────────────────────────────────────────────────────

/** Extract the user's prompt text from the last message */
function extractPrompt(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user") {
      return typeof msg.content === "string"
        ? msg.content
        : msg.content
            .filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("");
    }
  }
  return "";
}

/** Resolve the response text for the given mode and call index */
function resolveResponse(
  mode: MockLLMResponseMode,
  messages: Message[],
  callIndex: number,
): string {
  switch (mode.type) {
    case "echo":
      return extractPrompt(messages);
    case "static":
      return mode.response;
    case "scripted": {
      if (mode.loop) {
        return mode.responses[callIndex % mode.responses.length];
      }
      if (callIndex < mode.responses.length) {
        return mode.responses[callIndex];
      }
      return mode.responses[mode.responses.length - 1];
    }
    case "error":
      throw new AgentSDKError(mode.error, {
        code: mode.code ?? "backend_error",
        retryable: mode.recoverable ?? false,
      });
  }
}

/** Apply latency delay if configured */
async function applyLatency(
  latency: MockLLMLatency | undefined,
  signal: AbortSignal,
): Promise<void> {
  if (!latency) return;
  const ms =
    latency.type === "fixed"
      ? latency.ms
      : latency.minMs + Math.random() * (latency.maxMs - latency.minMs);
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    if (signal.aborted) {
      clearTimeout(timer);
      reject(new Error("aborted"));
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Split text into chunks based on streaming options */
function chunkText(
  text: string,
  streaming: MockLLMStreamingOptions | undefined,
): string[] {
  if (streaming?.chunkSize && streaming.chunkSize > 0) {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += streaming.chunkSize) {
      chunks.push(text.slice(i, i + streaming.chunkSize));
    }
    return chunks;
  }
  // Default: word-boundary splitting
  return text.split(/(\s+)/).filter(Boolean);
}

/** Delay between stream chunks if configured */
async function chunkDelay(
  streaming: MockLLMStreamingOptions | undefined,
  signal: AbortSignal,
): Promise<void> {
  const ms = streaming?.chunkDelayMs;
  if (!ms || ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    if (signal.aborted) {
      clearTimeout(timer);
      reject(new Error("aborted"));
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// ─── MockLLMAgent ──────────────────────────────────────────────

class MockLLMAgent extends BaseAgent {
  protected readonly backendName = "mock-llm";
  private readonly mode: MockLLMResponseMode;
  private readonly latency: MockLLMLatency | undefined;
  private readonly streaming: MockLLMStreamingOptions | undefined;
  private readonly finishReason: string;
  private readonly permissions: MockLLMPermissionOptions | undefined;
  private readonly toolCallConfigs: MockLLMToolCall[];
  private readonly configuredStructuredOutput: unknown;
  private callIndex = 0;

  constructor(config: FullAgentConfig, options: MockLLMBackendOptions) {
    super(config);
    this.mode = options.mode ?? { type: "echo" };
    this.latency = options.latency;
    this.streaming = options.streaming;
    this.finishReason = options.finishReason ?? "stop";
    this.permissions = options.permissions;
    this.toolCallConfigs = options.toolCalls ?? [];
    this.configuredStructuredOutput = options.structuredOutput;
  }

  protected async executeRun(
    messages: Message[],
    _options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult> {
    this.checkAbort(signal);
    await applyLatency(this.latency, signal);
    this.checkAbort(signal);

    const idx = this.callIndex++;
    const output = resolveResponse(this.mode, messages, idx);
    const toolCalls = this.toolCallConfigs.map((tc) => ({
      toolName: tc.toolName,
      args: (tc.args ?? {}) as JSONValue,
      result: (tc.result ?? null) as JSONValue,
      approved: true,
    }));

    return {
      output,
      structuredOutput: undefined,
      toolCalls,
      messages: [
        ...messages,
        { role: "assistant" as const, content: output },
      ],
      usage: { promptTokens: 10, completionTokens: output.length },
    };
  }

  protected async executeRunStructured<T>(
    messages: Message[],
    _schema: StructuredOutputConfig<T>,
    _options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult<T>> {
    this.checkAbort(signal);
    await applyLatency(this.latency, signal);
    this.checkAbort(signal);

    const idx = this.callIndex++;
    const output = resolveResponse(this.mode, messages, idx);

    let parsed: T;
    if (this.configuredStructuredOutput !== undefined) {
      parsed = this.configuredStructuredOutput as T;
    } else {
      try {
        parsed = JSON.parse(output) as T;
      } catch {
        parsed = output as unknown as T;
      }
    }

    return {
      output,
      structuredOutput: parsed as T extends void ? undefined : T,
      toolCalls: [],
      messages: [
        ...messages,
        { role: "assistant" as const, content: output },
      ],
      usage: { promptTokens: 10, completionTokens: output.length },
    };
  }

  protected async *executeStream(
    messages: Message[],
    _options: RunOptions,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    this.checkAbort(signal);
    await applyLatency(this.latency, signal);
    this.checkAbort(signal);

    // Permission simulation — emit before generating response
    if (this.permissions) {
      yield* this.simulatePermissions(signal);
    }

    // Tool call simulation — emit tool_call_start/end pairs
    if (this.toolCallConfigs.length > 0) {
      yield* this.simulateToolCalls(signal);
    }

    const idx = this.callIndex++;
    const output = resolveResponse(this.mode, messages, idx);

    const chunks = chunkText(output, this.streaming);
    for (let i = 0; i < chunks.length; i++) {
      this.checkAbort(signal);
      if (i > 0) {
        await chunkDelay(this.streaming, signal);
      }
      yield { type: "text_delta", text: chunks[i] };
    }

    yield {
      type: "usage_update",
      promptTokens: 10,
      completionTokens: output.length,
    };

    yield {
      type: "done",
      finalOutput: output,
      finishReason: this.finishReason,
    };
  }

  private async *simulateToolCalls(
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    for (let i = 0; i < this.toolCallConfigs.length; i++) {
      this.checkAbort(signal);
      const tc = this.toolCallConfigs[i];
      const toolCallId = tc.toolCallId ?? `mock-tc-${i}`;

      yield {
        type: "tool_call_start",
        toolCallId,
        toolName: tc.toolName,
        args: (tc.args ?? {}) as JSONValue,
      };

      yield {
        type: "tool_call_end",
        toolCallId,
        toolName: tc.toolName,
        result: (tc.result ?? null) as JSONValue,
      };
    }
  }

  private async *simulatePermissions(
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const perms = this.permissions!;
    for (const toolName of perms.toolNames) {
      this.checkAbort(signal);

      const request = {
        toolName,
        toolArgs: {},
      };

      yield { type: "permission_request", request };

      // Determine decision
      if (perms.denyTools?.includes(toolName)) {
        yield {
          type: "permission_response",
          toolName,
          decision: { allowed: false, reason: "Denied by mock configuration" },
        };
      } else if (perms.autoApprove) {
        yield {
          type: "permission_response",
          toolName,
          decision: { allowed: true, scope: "once" as const },
        };
      } else {
        // Delegate to supervisor callback if available
        const supervisor = this.getConfig().supervisor;
        if (supervisor?.onPermission) {
          const decision = await supervisor.onPermission(request, signal);
          yield { type: "permission_response", toolName, decision };
        } else {
          // No supervisor — auto-approve (headless mode)
          yield {
            type: "permission_response",
            toolName,
            decision: { allowed: true, scope: "once" as const },
          };
        }
      }
    }
  }
}

// ─── MockLLMService ─────────────────────────────────────────────

class MockLLMService implements IAgentService {
  readonly name = "mock-llm";
  private readonly options: MockLLMBackendOptions;
  private readonly models: ModelInfo[];

  constructor(options: MockLLMBackendOptions = {}) {
    this.options = options;
    this.models = (options.models ?? [
      { id: "mock-fast", name: "Mock Fast" },
      { id: "mock-quality", name: "Mock Quality" },
    ]).map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
    }));
  }

  createAgent(config: FullAgentConfig): IAgent {
    return new MockLLMAgent(config, this.options);
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.models;
  }

  async validate(): Promise<ValidationResult> {
    return { valid: true, errors: [] };
  }

  async dispose(): Promise<void> {
    // no-op — mock has no resources to release
  }
}

// ─── Public API ─────────────────────────────────────────────────

/** Create a mock LLM backend service for automated testing.
 *
 *  Unlike the lightweight `createMockAgentService` (from `@witqq/agent-sdk/testing`),
 *  this backend extends `BaseAgent` and participates in the full agent lifecycle:
 *  retry, heartbeat, activity timeout, middleware pipeline, and usage enrichment.
 *
 *  @example
 *  ```ts
 *  import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";
 *
 *  // Basic echo mode
 *  const service = createMockLLMService({ mode: { type: "echo" } });
 *
 *  // With latency simulation and streaming control
 *  const realisticService = createMockLLMService({
 *    mode: { type: "static", response: "Hello!" },
 *    latency: { type: "fixed", ms: 100 },
 *    streaming: { chunkSize: 5, chunkDelayMs: 10 },
 *    finishReason: "stop",
 *  });
 *
 *  // With permission simulation
 *  const permService = createMockLLMService({
 *    mode: { type: "echo" },
 *    permissions: { toolNames: ["bash", "file_write"], autoApprove: true },
 *  });
 *  ```
 */
export function createMockLLMService(
  options: MockLLMBackendOptions = {},
): IAgentService {
  return new MockLLMService(options);
}

export type {
  MockLLMBackendOptions,
  MockLLMResponseMode,
  MockLLMLatency,
  MockLLMStreamingOptions,
  MockLLMPermissionOptions,
  MockLLMToolCall,
};
