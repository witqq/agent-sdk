import type {
  IAgent,
  AgentConfig,
  AgentState,
  AgentResult,
  AgentEvent,
  MessageContent,
  Message,
  RunOptions,
  StructuredOutputConfig,
} from "./types.js";
import { ReentrancyError, DisposedError, AbortError } from "./errors.js";

/** Abstract base agent with shared lifecycle logic.
 *  Concrete backends extend this and implement the protected _run/_stream methods. */
export abstract class BaseAgent implements IAgent {
  protected state: AgentState = "idle";
  protected abortController: AbortController | null = null;
  protected readonly config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = Object.freeze({ ...config });
  }

  // ─── Public Interface ─────────────────────────────────────────

  async run(
    prompt: MessageContent,
    options?: RunOptions,
  ): Promise<AgentResult> {
    this.guardReentrancy();
    this.guardDisposed();

    const ac = this.createAbortController(options?.signal);
    this.state = "running";

    try {
      const messages: Message[] = [{ role: "user", content: prompt }];
      return await this.executeRun(messages, options, ac.signal);
    } finally {
      this.state = "idle";
      this.abortController = null;
    }
  }

  async runWithContext(
    messages: Message[],
    options?: RunOptions,
  ): Promise<AgentResult> {
    this.guardReentrancy();
    this.guardDisposed();

    const ac = this.createAbortController(options?.signal);
    this.state = "running";

    try {
      return await this.executeRun(messages, options, ac.signal);
    } finally {
      this.state = "idle";
      this.abortController = null;
    }
  }

  async runStructured<T>(
    prompt: MessageContent,
    schema: StructuredOutputConfig<T>,
    options?: RunOptions,
  ): Promise<AgentResult<T>> {
    this.guardReentrancy();
    this.guardDisposed();

    const ac = this.createAbortController(options?.signal);
    this.state = "running";

    try {
      const messages: Message[] = [{ role: "user", content: prompt }];
      return await this.executeRunStructured(
        messages,
        schema,
        options,
        ac.signal,
      );
    } finally {
      this.state = "idle";
      this.abortController = null;
    }
  }

  async *stream(
    prompt: MessageContent,
    options?: RunOptions,
  ): AsyncIterable<AgentEvent> {
    this.guardReentrancy();
    this.guardDisposed();

    const ac = this.createAbortController(options?.signal);
    this.state = "streaming";

    try {
      const messages: Message[] = [{ role: "user", content: prompt }];
      yield* this.executeStream(messages, options, ac.signal);
    } finally {
      this.state = "idle";
      this.abortController = null;
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  getState(): AgentState {
    return this.state;
  }

  getConfig(): Readonly<AgentConfig> {
    return this.config;
  }

  /** Mark agent as disposed. Override to add cleanup. */
  dispose(): void {
    this.abort();
    this.state = "disposed";
  }

  // ─── Abstract Methods (implemented by backends) ───────────────

  /** Execute a blocking run. Backend implements the actual LLM call. */
  protected abstract executeRun(
    messages: Message[],
    options: RunOptions | undefined,
    signal: AbortSignal,
  ): Promise<AgentResult>;

  /** Execute a structured output run. Backend implements parsing. */
  protected abstract executeRunStructured<T>(
    messages: Message[],
    schema: StructuredOutputConfig<T>,
    options: RunOptions | undefined,
    signal: AbortSignal,
  ): Promise<AgentResult<T>>;

  /** Execute a streaming run. Backend yields events. */
  protected abstract executeStream(
    messages: Message[],
    options: RunOptions | undefined,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent>;

  // ─── Guards ───────────────────────────────────────────────────

  protected guardReentrancy(): void {
    if (this.state === "running" || this.state === "streaming") {
      throw new ReentrancyError();
    }
  }

  protected guardDisposed(): void {
    if (this.state === "disposed") {
      throw new DisposedError("Agent");
    }
  }

  /** Throw AbortError if signal is already aborted */
  protected checkAbort(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new AbortError();
    }
  }

  // ─── Internal Helpers ─────────────────────────────────────────

  private createAbortController(externalSignal?: AbortSignal): AbortController {
    const ac = new AbortController();
    this.abortController = ac;

    if (externalSignal) {
      if (externalSignal.aborted) {
        ac.abort();
      } else {
        externalSignal.addEventListener("abort", () => ac.abort(), {
          once: true,
        });
      }
    }

    return ac;
  }
}
