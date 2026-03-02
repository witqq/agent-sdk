import type { z } from "zod";
import type { IPermissionStore } from "../permission-store.js";
import type { ToolDefinition } from "./tools.js";
import type { Message, MessageContent } from "./messages.js";
import type { SupervisorHooks } from "./permissions.js";
import type { ModelParams, ModelInfo, ValidationResult } from "./models.js";
import type { AgentEvent, UsageData } from "./events.js";
import type { ErrorCode } from "./errors.js";
import type { JSONValue } from "./json.js";

// ─── Call Options (NEW — per-call overrides) ───────────────────

/** Per-call overrides passed to run(), stream(), runStructured().
 *  Allows overriding the model, tools, signal, and other parameters
 *  on a per-request basis without modifying the agent configuration. */
export interface CallOptions {
  /** Override the default model for this call */
  model?: string;
  /** Override/extend tools for this call */
  tools?: ToolDefinition[];
  /** Per-call abort signal */
  signal?: AbortSignal;
  /** Override system message for this call */
  systemMessage?: string;
  /** Provider-specific options passed through to the underlying SDK */
  providerOptions?: Record<string, unknown>;
  /** Per-call timeout in milliseconds */
  timeout?: number;
  /** Per-call token limit */
  maxTokens?: number;
  /** Retry configuration for this call */
  retry?: RetryConfig;
}

// ─── Retry Config (NEW) ───────────────────────────────────────

/** Configuration for automatic retries on transient errors */
export interface RetryConfig {
  /** Maximum number of retries (default: 0 — no retry) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Which error codes to retry (default: all recoverable codes) */
  retryableErrors?: ErrorCode[];
}

// ─── Structured Output ─────────────────────────────────────────

/** Configuration for typed structured output from LLM */
export interface StructuredOutputConfig<T = unknown> {
  schema: z.ZodType<T>;
  name?: string;
  description?: string;
}

// ─── Run Options ───────────────────────────────────────────────

/** Options passed to agent.run() / agent.stream().
 *  Extends CallOptions with run-specific fields (context, activityTimeoutMs).
 *  model is REQUIRED — every agent call must specify the model explicitly. */
export interface RunOptions extends CallOptions {
  /** Model to use for this call (required — no implicit defaults) */
  model: string;
  /** Arbitrary context passed to the agent run */
  context?: Record<string, unknown>;
  /** Inactivity timeout for streaming (ms). When set, the stream aborts if no
   *  event (including heartbeats/progress) arrives within this period. Resets on
   *  every received event. Default: no timeout. Only affects stream()/streamWithContext(). */
  activityTimeoutMs?: number;
}

// ─── Timeout Configuration ─────────────────────────────────────

/** Timeout configuration for agent operations */
export interface TimeoutConfig {
  /** Max time for entire agent run (ms) */
  total?: number;
  /** Max time for a single tool execution (ms) */
  perTool?: number;
  /** Max time for a single LLM request (ms) */
  perLLMRequest?: number;
}

// ─── Error Handling ────────────────────────────────────────────

/** Error handling strategy configuration */
export interface ErrorHandlingConfig {
  /** What to do when a tool throws */
  onToolError?: "fail" | "continue" | "ask-llm";
  /** Retry config for transient LLM failures */
  retryLLM?: { maxAttempts: number; backoffMs: number };
  /** Global error callback for monitoring */
  onError?: (
    error: Error,
    context: { phase: "tool" | "llm" | "permission" | "ask-user" },
  ) => void;
}

// ─── Agent Configuration ───────────────────────────────────────

/** Identity-only agent configuration — defines the agent's behavior, NOT per-call defaults.
 *  For creating an agent with model/tools defaults, use FullAgentConfig. */
export interface AgentConfig {
  systemPrompt: string;
  supervisor?: SupervisorHooks;
  maxTurns?: number;
  timeout?: TimeoutConfig;
  errorHandling?: ErrorHandlingConfig;
  /** Pluggable store for persisting permission scope decisions across runs */
  permissionStore?: IPermissionStore;
  /** How to apply systemPrompt: "append" adds to backend default, "replace" overrides it.
   *  Default: "append". Currently used by the Copilot backend. */
  systemMessageMode?: "append" | "replace";
  /**
   * Filter for backend built-in tools (e.g. `["web_search", "web_fetch"]` for Copilot).
   * When set, only listed built-in tools are available. Backend-specific.
   *
   * **Security note**: This is a trust boundary — it controls which backend-native tools
   * the AI agent can invoke. By default, backends expose ALL their built-in tools.
   * Set this to restrict access (e.g. prevent file system access in a web-facing agent).
   */
  availableTools?: string[];
  /** Callback invoked with usage data after run completion or during streaming.
   *  Fire-and-forget: errors are logged but not propagated. */
  onUsage?: (usage: UsageData) => void;
  /** Interval in milliseconds for emitting heartbeat events during streaming.
   *  When set, heartbeat events are emitted to keep the stream alive during
   *  long tool executions. Default: off (no heartbeats). */
  heartbeatInterval?: number;
  /** Session reuse mode for CLI backends (Copilot, Claude).
   *  "per-call" (default): creates a fresh CLI session for each run/stream call.
   *  "persistent": reuses the same CLI session across calls, preserving conversation
   *  history natively in the CLI backend. Session is destroyed on agent dispose(). */
  sessionMode?: "per-call" | "persistent";
}

/** Per-call defaults that can be provided at agent creation time.
 *  Each field can also be overridden on individual calls via RunOptions. */
export interface CallDefaults {
  /** Default model (overridable per-call via RunOptions.model) */
  model?: string;
  /** Default model parameters */
  modelParams?: ModelParams;
  /** Default tools (overridable per-call via RunOptions.tools) */
  tools?: ToolDefinition[];
  /** Provider-specific options passed through to the underlying SDK.
   *  For Vercel AI: passed as providerOptions to generateText/streamText.
   *  Example: { google: { thinkingConfig: { thinkingBudget: 1024 } } } */
  providerOptions?: Record<string, Record<string, unknown>>;
}

/** Full agent configuration: identity + per-call defaults.
 *  This is what createAgent() accepts. Backward-compatible with the old AgentConfig shape. */
export type FullAgentConfig = AgentConfig & CallDefaults;

// ─── Agent Result ──────────────────────────────────────────────

/** Result of an agent run, generic over structured output type T */
export interface AgentResult<T = void> {
  output: string | null;
  structuredOutput: T extends void ? undefined : T;
  toolCalls: Array<{
    toolName: string;
    args: JSONValue;
    result: JSONValue;
    approved: boolean;
  }>;
  messages: Message[];
  usage?: UsageData;
}

// ─── Agent State ───────────────────────────────────────────────

/** Agent lifecycle state */
export type AgentState = "idle" | "running" | "streaming" | "disposed";

// ─── Agent Interface ───────────────────────────────────────────

/** Core agent interface — run prompts, stream events, manage lifecycle */
export interface IAgent {
  /** The CLI session ID when using persistent session mode. Undefined in per-call mode
   *  or before the first call. Can be stored externally for session resume. */
  readonly sessionId: string | undefined;
  /** Run a single prompt and return the result. Wraps prompt in a user message. */
  run(prompt: MessageContent, options: RunOptions): Promise<AgentResult>;
  /** Run with full conversation history. Messages are passed directly to the backend. */
  runWithContext(
    messages: Message[],
    options: RunOptions,
  ): Promise<AgentResult>;
  /** Run with structured output validated against a Zod schema. */
  runStructured<T>(
    prompt: MessageContent,
    schema: StructuredOutputConfig<T>,
    options: RunOptions,
  ): Promise<AgentResult<T>>;
  /** Stream events for a single prompt. Wraps prompt in a user message. */
  stream(
    prompt: MessageContent,
    options: RunOptions,
  ): AsyncIterable<AgentEvent>;
  /** Stream events with full conversation history. Messages are passed directly to the backend. */
  streamWithContext(
    messages: Message[],
    options: RunOptions,
  ): AsyncIterable<AgentEvent>;
  /** Abort the current operation. No-op if not running. */
  abort(): void;
  /** Gracefully interrupt the current operation. Resolves when the backend acknowledges. */
  interrupt(): Promise<void>;
  /** Get current agent lifecycle state. */
  getState(): AgentState;
  /** Get frozen agent configuration. */
  getConfig(): Readonly<FullAgentConfig>;
  /** Release resources. After dispose(), agent must not be used. */
  dispose(): void;
}

// ─── Service Interface ─────────────────────────────────────────

/** Backend service interface — creates agents, lists models, validates config */
export interface IAgentService {
  readonly name: string;
  createAgent(config: FullAgentConfig): IAgent;
  listModels(): Promise<ModelInfo[]>;
  validate(): Promise<ValidationResult>;
  dispose(): Promise<void>;
}

/** Structural subtype of IAgentService — accepts any object with the right shape.
 *  Use in function signatures where you don't want to require the full interface. */
export type AgentServiceLike = Pick<IAgentService, "name" | "createAgent" | "listModels" | "validate" | "dispose">;
