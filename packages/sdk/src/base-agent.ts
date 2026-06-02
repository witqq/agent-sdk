import type {
  IAgent,
  FullAgentConfig,
  AgentState,
  AgentResult,
  AgentEvent,
  MessageContent,
  Message,
  RunOptions,
  RetryConfig,
  StructuredOutputConfig,
  UsageData,
  ToolDefinition,
  StreamMiddleware,
  StreamContext,
} from "./types.js";
import { ReentrancyError, DisposedError, AbortError, ActivityTimeoutError } from "./errors.js";
import { AgentSDKError } from "./errors.js";
import { isRecoverableErrorCode } from "./types/errors.js";

/** Abstract base agent with shared lifecycle logic.
 *  Concrete backends extend this and implement the protected _run/_stream methods. */
export abstract class BaseAgent implements IAgent {
  protected state: AgentState = "idle";
  protected abortController: AbortController | null = null;
  protected readonly config: FullAgentConfig;
  private _cleanupExternalSignal: (() => void) | null = null;
  private _streamMiddleware: StreamMiddleware[] = [];

  /** Backend identifier (e.g. "copilot", "claude", "vercel-ai") */
  protected abstract readonly backendName: string;

  /** CLI session ID for persistent mode. Override in backends that support it. */
  get sessionId(): string | undefined {
    return undefined;
  }

  constructor(config: FullAgentConfig) {
    this.config = Object.freeze({ ...config });
  }

  // ─── Public Interface ─────────────────────────────────────────

  async run(
    prompt: MessageContent,
    options: RunOptions,
  ): Promise<AgentResult> {
    this.guardReentrancy();
    this.guardDisposed();

    const ac = this.createAbortController(options?.signal);
    this.state = "running";

    try {
      const messages: Message[] = [{ role: "user", content: prompt }];
      const result = await this.withRetry(
        () => this.executeRun(messages, options, ac.signal), options,
      );
      this.enrichAndNotifyUsage(result, options);
      return result;
    } finally {
      this.cleanupRun();
    }
  }

  async runWithContext(
    messages: Message[],
    options: RunOptions,
  ): Promise<AgentResult> {
    this.guardReentrancy();
    this.guardDisposed();

    const ac = this.createAbortController(options?.signal);
    this.state = "running";

    try {
      const result = await this.withRetry(
        () => this.executeRun(messages, options, ac.signal), options,
      );
      this.enrichAndNotifyUsage(result, options);
      return result;
    } finally {
      this.cleanupRun();
    }
  }

  async runStructured<T>(
    prompt: MessageContent,
    schema: StructuredOutputConfig<T>,
    options: RunOptions,
  ): Promise<AgentResult<T>> {
    this.guardReentrancy();
    this.guardDisposed();

    const ac = this.createAbortController(options?.signal);
    this.state = "running";

    try {
      const messages: Message[] = [{ role: "user", content: prompt }];
      const result = await this.withRetry(
        () => this.executeRunStructured(messages, schema, options, ac.signal), options,
      );
      this.enrichAndNotifyUsage(result, options);
      return result;
    } finally {
      this.cleanupRun();
    }
  }

  async *stream(
    prompt: MessageContent,
    options: RunOptions,
  ): AsyncIterable<AgentEvent> {
    this.guardReentrancy();
    this.guardDisposed();

    const ac = this.createAbortController(options?.signal);
    this.state = "streaming";

    try {
      const messages: Message[] = [{ role: "user", content: prompt }];
      yield* this.streamWithRetry(
        () => this.applyStreamPipeline(this.executeStream(messages, options, ac.signal), options, ac),
        options,
      );
    } finally {
      this.cleanupRun();
    }
  }

  async *streamWithContext(
    messages: Message[],
    options: RunOptions,
  ): AsyncIterable<AgentEvent> {
    this.guardReentrancy();
    this.guardDisposed();

    const ac = this.createAbortController(options?.signal);
    this.state = "streaming";

    try {
      yield* this.streamWithRetry(
        () => this.applyStreamPipeline(this.executeStream(messages, options, ac.signal), options, ac),
        options,
      );
    } finally {
      this.cleanupRun();
    }
  }

  /** Register a stream middleware. Applied in registration order after built-in transforms. */
  addStreamMiddleware(middleware: StreamMiddleware): void {
    this.guardDisposed();
    this._streamMiddleware.push(middleware);
  }

  /** Apply built-in transforms (enrich→timeout→heartbeat) then custom middleware */
  private async *applyStreamPipeline(
    source: AsyncIterable<AgentEvent>,
    options: RunOptions,
    ac: AbortController,
  ): AsyncIterable<AgentEvent> {
    // Built-in pipeline
    let stream: AsyncIterable<AgentEvent> = this.enrichStream(source, options);
    stream = this.activityTimeoutStream(stream, options?.activityTimeoutMs, ac);
    stream = this.heartbeatStream(stream);

    // Custom middleware
    if (this._streamMiddleware.length > 0) {
      const ctx: StreamContext = {
        model: options.model,
        backend: this.backendName,
        abortController: ac,
        config: Object.freeze({ ...this.config }),
      };
      for (const mw of this._streamMiddleware) {
        stream = mw(stream, ctx);
      }
    }

    yield* stream;
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /** Default interrupt — falls back to abort(). Backends may override with graceful shutdown. */
  async interrupt(): Promise<void> {
    this.abort();
  }

  getState(): AgentState {
    return this.state;
  }

  getConfig(): Readonly<FullAgentConfig> {
    return this.config;
  }

  /** Mark agent as disposed. Override to add cleanup. */
  dispose(): void {
    this._cleanupExternalSignal?.();
    this._cleanupExternalSignal = null;
    this.abort();
    this.state = "disposed";
  }

  // ─── Abstract Methods (implemented by backends) ───────────────

  /** Execute a blocking run. Backend implements the actual LLM call. */
  protected abstract executeRun(
    messages: Message[],
    options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult>;

  /** Execute a structured output run. Backend implements parsing. */
  protected abstract executeRunStructured<T>(
    messages: Message[],
    schema: StructuredOutputConfig<T>,
    options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult<T>>;

  /** Execute a streaming run. Backend yields events. */
  protected abstract executeStream(
    messages: Message[],
    options: RunOptions,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent>;

  // ─── Retry Logic ─────────────────────────────────────────────

  /** Check if an error should be retried given the retry configuration. */
  private isRetryableError(error: unknown, retry: RetryConfig): boolean {
    // Abort and reentrancy errors are never retryable
    if (error instanceof AbortError || error instanceof ReentrancyError || error instanceof DisposedError) {
      return false;
    }
    if (AgentSDKError.is(error)) {
      // If specific retryable error codes configured, check against them
      if (retry.retryableErrors && retry.retryableErrors.length > 0 && error.code) {
        return retry.retryableErrors.includes(error.code as typeof retry.retryableErrors[number]);
      }
      // Otherwise check the retryable flag or recoverable code
      if (error.retryable) return true;
      if (error.code) return isRecoverableErrorCode(error.code as Parameters<typeof isRecoverableErrorCode>[0]);
    }
    return false;
  }

  /** Execute a function with retry logic per RetryConfig. */
  private async withRetry<T>(
    fn: () => Promise<T>,
    options: RunOptions,
  ): Promise<T> {
    const retry = options?.retry;
    if (!retry || !retry.maxRetries || retry.maxRetries <= 0) {
      return fn();
    }

    const maxRetries = retry.maxRetries;
    const initialDelay = retry.initialDelayMs ?? 1000;
    const multiplier = retry.backoffMultiplier ?? 2;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt >= maxRetries || !this.isRetryableError(err, retry)) {
          throw err;
        }
        // Exponential backoff
        const delay = initialDelay * Math.pow(multiplier, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Check abort between retries
        if (options?.signal?.aborted || this.abortController?.signal.aborted) {
          throw err;
        }
      }
    }
    throw lastError;
  }

  /** Execute a stream factory with pre-stream retry: retries until first event, then committed. */
  private async *streamWithRetry(
    factory: () => AsyncIterable<AgentEvent>,
    options: RunOptions,
  ): AsyncIterable<AgentEvent> {
    const retry = options?.retry;
    if (!retry || !retry.maxRetries || retry.maxRetries <= 0) {
      yield* factory();
      return;
    }

    const maxRetries = retry.maxRetries;
    const initialDelay = retry.initialDelayMs ?? 1000;
    const multiplier = retry.backoffMultiplier ?? 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const stream = factory();
        const iterator = stream[Symbol.asyncIterator]();
        // Try to get first event — this is the "pre-stream" phase
        const first = await iterator.next();
        if (first.done) return;
        // First event received — stream committed, no more retries
        yield first.value;
        // Yield remaining events
        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          yield next.value;
        }
        return;
      } catch (err) {
        if (attempt >= maxRetries || !this.isRetryableError(err, retry)) {
          throw err;
        }
        const delay = initialDelay * Math.pow(multiplier, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (options?.signal?.aborted || this.abortController?.signal.aborted) {
          throw err;
        }
      }
    }
  }

  // ─── CallOptions Resolution ──────────────────────────────────

  /** Resolve tools to use for this call (per-call override > config default) */
  protected resolveTools(options?: RunOptions): ToolDefinition[] {
    return options?.tools ?? this.config.tools ?? [];
  }

  // ─── Usage Enrichment ───────────────────────────────────────────

  /** Enrich result usage with model/backend and fire onUsage callback */
  private enrichAndNotifyUsage(result: AgentResult<unknown>, options: RunOptions): void {
    if (result.usage) {
      result.usage = {
        ...result.usage,
        model: options.model,
        backend: this.backendName,
      };
      this.callOnUsage(result.usage);
    }
  }

  /** Wrap a stream to enrich usage_update events and fire onUsage callback */
  private async *enrichStream(
    source: AsyncIterable<AgentEvent>,
    options: RunOptions,
  ): AsyncIterable<AgentEvent> {
    const model = options.model;
    for await (const event of source) {
      if (event.type === "usage_update") {
        const usage: UsageData = {
          promptTokens: event.promptTokens,
          completionTokens: event.completionTokens,
          model,
          backend: this.backendName,
          // Preserve any provider-supplied metadata the backend attached
          // (cost, cached tokens, raw passthrough) instead of dropping it.
          ...(event.cost !== undefined && { cost: event.cost }),
          ...(event.cachedTokens !== undefined && { cachedTokens: event.cachedTokens }),
          ...(event.providerMetadata !== undefined && { providerMetadata: event.providerMetadata }),
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

  // ─── Activity Timeout ────────────────────────────────────────

  /** Wrap a stream to abort on inactivity. Resets timer on every event.
   *  When timeoutMs is not set, passes through directly. */
  private async *activityTimeoutStream(
    source: AsyncIterable<AgentEvent>,
    timeoutMs: number | undefined,
    ac: AbortController,
  ): AsyncIterable<AgentEvent> {
    if (!timeoutMs || timeoutMs <= 0) {
      yield* source;
      return;
    }

    const iterator = source[Symbol.asyncIterator]();
    let timerId: ReturnType<typeof setTimeout> | undefined;
    try {
      while (true) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => reject(new ActivityTimeoutError(timeoutMs)), timeoutMs);
        });
        const result = await Promise.race([iterator.next(), timeoutPromise]);
        clearTimeout(timerId);
        if (result.done) break;
        yield result.value;
      }
    } catch (err) {
      if (err instanceof ActivityTimeoutError) {
        ac.abort(err);
      }
      throw err;
    } finally {
      clearTimeout(timerId);
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

  /** Clean up after a run completes (success, error, or abort). */
  private cleanupRun(): void {
    this._cleanupExternalSignal?.();
    this._cleanupExternalSignal = null;
    this.state = "idle";
    this.abortController = null;
  }

  private createAbortController(externalSignal?: AbortSignal): AbortController {
    const ac = new AbortController();
    this.abortController = ac;
    this._cleanupExternalSignal = null;

    if (externalSignal) {
      if (externalSignal.aborted) {
        ac.abort();
      } else {
        const listener = () => ac.abort();
        externalSignal.addEventListener("abort", listener, { once: true });
        this._cleanupExternalSignal = () => externalSignal.removeEventListener("abort", listener);
      }
    }

    return ac;
  }
}
