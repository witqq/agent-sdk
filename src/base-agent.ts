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
  UsageData,
} from "./types.js";
import { ReentrancyError, DisposedError, AbortError } from "./errors.js";

/** Abstract base agent with shared lifecycle logic.
 *  Concrete backends extend this and implement the protected _run/_stream methods. */
export abstract class BaseAgent implements IAgent {
  protected state: AgentState = "idle";
  protected abortController: AbortController | null = null;
  protected readonly config: AgentConfig;

  /** Backend identifier (e.g. "copilot", "claude", "vercel-ai") */
  protected abstract readonly backendName: string;

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
      const result = await this.executeRun(messages, options, ac.signal);
      this.enrichAndNotifyUsage(result);
      return result;
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
      const result = await this.executeRun(messages, options, ac.signal);
      this.enrichAndNotifyUsage(result);
      return result;
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
      const result = await this.executeRunStructured(
        messages,
        schema,
        options,
        ac.signal,
      );
      this.enrichAndNotifyUsage(result);
      return result;
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
      const enriched = this.enrichStream(this.executeStream(messages, options, ac.signal));
      yield* this.heartbeatStream(enriched);
    } finally {
      this.state = "idle";
      this.abortController = null;
    }
  }

  async *streamWithContext(
    messages: Message[],
    options?: RunOptions,
  ): AsyncIterable<AgentEvent> {
    this.guardReentrancy();
    this.guardDisposed();

    const ac = this.createAbortController(options?.signal);
    this.state = "streaming";

    try {
      const enriched = this.enrichStream(this.executeStream(messages, options, ac.signal));
      yield* this.heartbeatStream(enriched);
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

  // ─── Usage Enrichment ───────────────────────────────────────────

  /** Enrich result usage with model/backend and fire onUsage callback */
  private enrichAndNotifyUsage(result: AgentResult<unknown>): void {
    if (result.usage) {
      result.usage = {
        ...result.usage,
        model: this.config.model,
        backend: this.backendName,
      };
      this.callOnUsage(result.usage);
    }
  }

  /** Wrap a stream to enrich usage_update events and fire onUsage callback */
  private async *enrichStream(
    source: AsyncIterable<AgentEvent>,
  ): AsyncIterable<AgentEvent> {
    for await (const event of source) {
      if (event.type === "usage_update") {
        const usage: UsageData = {
          promptTokens: event.promptTokens,
          completionTokens: event.completionTokens,
          model: this.config.model,
          backend: this.backendName,
        };
        this.callOnUsage(usage);
        yield { type: "usage_update", ...usage };
      } else {
        yield event;
      }
    }
  }

  /** Fire onUsage callback (fire-and-forget: errors logged, not propagated) */
  private callOnUsage(usage: UsageData): void {
    if (!this.config.onUsage) return;
    try {
      this.config.onUsage(usage);
    } catch (e) {
      console.warn(
        "[agent-sdk] onUsage callback error:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  // ─── Heartbeat ───────────────────────────────────────────────

  /** Wrap a stream to emit heartbeat events at configured intervals.
   *  When heartbeatInterval is not set, passes through directly. */
  private async *heartbeatStream(
    source: AsyncIterable<AgentEvent>,
  ): AsyncIterable<AgentEvent> {
    const interval = this.config.heartbeatInterval;
    if (!interval || interval <= 0) {
      yield* source;
      return;
    }

    const iterator = source[Symbol.asyncIterator]();
    let pendingEvent: Promise<IteratorResult<AgentEvent>> | null = null;
    let heartbeatResolve: (() => void) | null = null;

    const timer = setInterval(() => {
      if (heartbeatResolve) {
        const resolve = heartbeatResolve;
        heartbeatResolve = null;
        resolve();
      }
    }, interval);

    try {
      while (true) {
        if (!pendingEvent) {
          pendingEvent = iterator.next();
        }

        const heartbeatPromise = new Promise<void>((resolve) => {
          heartbeatResolve = resolve;
        });

        const eventDone = pendingEvent.then(
          (r) => ({ kind: "event" as const, result: r }),
        );
        const heartbeatDone = heartbeatPromise.then(
          () => ({ kind: "heartbeat" as const }),
        );

        const winner = await Promise.race([eventDone, heartbeatDone]);

        if (winner.kind === "heartbeat") {
          yield { type: "heartbeat" };
        } else {
          pendingEvent = null;
          heartbeatResolve = null;
          if (winner.result.done) break;
          yield winner.result.value;
        }
      }
    } finally {
      clearInterval(timer);
      heartbeatResolve = null;
    }
  }

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
