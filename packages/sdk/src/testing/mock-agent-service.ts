/**
 * Mock IAgentService factory for testing.
 */
import type {
  IAgentService,
  IAgent,
  FullAgentConfig,
  ModelInfo,
  ValidationResult,
  AgentResult,
  AgentEvent,
  Message,
  MessageContent,
  RunOptions,
  StructuredOutputConfig,
  AgentState,
  MockLLMBackendOptions,
} from "../types.js";
import { createMockLLMService } from "../backends/mock-llm.js";

/** Options for createMockAgentService. */
export interface MockAgentServiceOptions {
  /** Service name. Default: "mock". */
  name?: string;
  /** Models to return from listModels(). */
  models?: ModelInfo[];
  /** Custom validation result. Default: { valid: true, errors: [] }. */
  validationResult?: ValidationResult;
  /** Custom run handler. Default: returns "Mock response". */
  onRun?: (prompt: MessageContent, options?: RunOptions) => Promise<AgentResult>;
  /** Custom stream handler. Default: yields text_delta + result events. */
  onStream?: (prompt: MessageContent, options?: RunOptions) => AsyncIterable<AgentEvent>;
  /** Opt-in: delegate to Mock LLM backend for richer simulation.
   *  When provided, createAgent() returns a full MockLLMAgent that participates
   *  in the BaseAgent lifecycle (retry, heartbeat, middleware, usage enrichment). */
  mockLLMBackend?: MockLLMBackendOptions;
}

class MockAgent implements IAgent {
  readonly sessionId: string | undefined = undefined;
  private _state: AgentState = "idle";
  private readonly _config: FullAgentConfig;
  private readonly _onRun?: MockAgentServiceOptions["onRun"];
  private readonly _onStream?: MockAgentServiceOptions["onStream"];

  constructor(config: FullAgentConfig, options?: MockAgentServiceOptions) {
    this._config = config;
    this._onRun = options?.onRun;
    this._onStream = options?.onStream;
  }

  async run(prompt: MessageContent, options: RunOptions): Promise<AgentResult> {
    if (this._onRun) return this._onRun(prompt, options);
    return { output: "Mock response", structuredOutput: undefined, toolCalls: [], messages: [], usage: { promptTokens: 10, completionTokens: 5 } };
  }

  async runWithContext(messages: Message[], options: RunOptions): Promise<AgentResult> {
    const lastMsg = messages[messages.length - 1];
    const text = typeof lastMsg?.content === "string" ? lastMsg.content : "context";
    return this.run(text, options);
  }

  async runStructured<T>(
    prompt: MessageContent,
    _schema: StructuredOutputConfig<T>,
    options: RunOptions,
  ): Promise<AgentResult<T>> {
    const base = await this.run(prompt, options);
    return { ...base, structuredOutput: undefined as unknown as T extends void ? undefined : T };
  }

  async *stream(prompt: MessageContent, options: RunOptions): AsyncIterable<AgentEvent> {
    if (this._onStream) {
      yield* this._onStream(prompt, options);
      return;
    }
    yield { type: "text_delta", text: "Mock " };
    yield { type: "text_delta", text: "response" };
    yield { type: "done", finalOutput: "Mock response" };
  }

  async *streamWithContext(messages: Message[], options: RunOptions): AsyncIterable<AgentEvent> {
    const lastMsg = messages[messages.length - 1];
    const text = typeof lastMsg?.content === "string" ? lastMsg.content : "context";
    yield* this.stream(text, options);
  }

  abort(): void {
    this._state = "idle";
  }

  async interrupt(): Promise<void> {
    this._state = "idle";
  }

  getState(): AgentState {
    return this._state;
  }

  getConfig(): Readonly<FullAgentConfig> {
    return this._config;
  }

  dispose(): void {
    this._state = "disposed";
  }
}

/**
 * Create a mock IAgentService for testing agent-level code.
 *
 * ```ts
 * const service = createMockAgentService({ name: "test" });
 * const agent = service.createAgent({ model: "gpt-5-mini" });
 * const result = await agent.run("Hello");
 * ```
 *
 * For richer simulation with full BaseAgent lifecycle, pass `mockLLMBackend`:
 * ```ts
 * const service = createMockAgentService({
 *   mockLLMBackend: { mode: { type: "echo" }, latency: { type: "fixed", ms: 50 } },
 * });
 * ```
 */
export function createMockAgentService(options: MockAgentServiceOptions = {}): IAgentService {
  // When mockLLMBackend is provided, delegate entirely to Mock LLM backend
  if (options.mockLLMBackend) {
    const llmService = createMockLLMService(options.mockLLMBackend);
    return {
      name: options.name ?? "mock",
      createAgent: (config: FullAgentConfig) => llmService.createAgent(config),
      listModels: () => llmService.listModels(),
      validate: () => llmService.validate(),
      dispose: () => llmService.dispose(),
    };
  }

  const name = options.name ?? "mock";
  return {
    name,
    createAgent(config: FullAgentConfig): IAgent {
      return new MockAgent(config, options);
    },
    async listModels(): Promise<ModelInfo[]> {
      return options.models ?? [
        { id: "mock-model-1", name: "Mock Model 1" },
        { id: "mock-model-2", name: "Mock Model 2" },
      ];
    },
    async validate(): Promise<ValidationResult> {
      return options.validationResult ?? { valid: true, errors: [] };
    },
    async dispose(): Promise<void> {
      // no-op
    },
  };
}
