import type { z } from "zod";
import type { IPermissionStore } from "./permission-store.js";

// ─── JSON Value ────────────────────────────────────────────────

/** JSON-serializable value used for tool arguments and results */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// ─── Message Content ───────────────────────────────────────────

/** Message content — plain string or array of text/image parts */
export type MessageContent = string | Array<ContentPart>;

/** Individual content part within a multi-part message */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

// ─── Tool System (B1: Declaration/Definition split) ────────────

/** What the LLM sees — name, description, schema. Passed to all backends. */
export interface ToolDeclaration<TParams = unknown> {
  name: string;
  description: string;
  parameters: z.ZodType<TParams>;
  needsApproval?: boolean;
  metadata?: {
    category?: string;
    icon?: string;
    tags?: string[];
  };
}

/** Full tool with execute function. Required for API-based backends.
 *  CLI backends extract declaration; execute map held internally. */
export interface ToolDefinition<TParams = unknown>
  extends ToolDeclaration<TParams> {
  execute: (params: TParams) => Promise<JSONValue> | JSONValue;
}

// ─── Tool Calls / Results ──────────────────────────────────────

/** A tool call made by the LLM during execution */
export interface ToolCall {
  id: string;
  name: string;
  args: JSONValue;
}

/** Result of executing a tool call */
export interface ToolResult {
  toolCallId: string;
  name: string;
  result: JSONValue;
  isError?: boolean;
}

// ─── Messages (Discriminated Union) ────────────────────────────

/** Conversation message — discriminated union on `role` */
export type Message =
  | { role: "user"; content: MessageContent }
  | { role: "assistant"; content: MessageContent; toolCalls?: ToolCall[] }
  | { role: "tool"; content?: string; toolResults: ToolResult[] }
  | { role: "system"; content: string };

// ─── Permission System (v3.1 with scopes) ──────────────────────

/** Scope for "remember this decision" */
export type PermissionScope = "once" | "session" | "project" | "always";

/** What the permission callback receives */
export interface PermissionRequest {
  toolName: string;
  toolArgs: Record<string, unknown>;
  /** SDK-suggested scope (from Claude CLI's suggestions) */
  suggestedScope?: PermissionScope;
  /** Original SDK permission request (for pass-through) */
  rawSDKRequest?: unknown;
}

/** What the permission callback returns */
export interface PermissionDecision {
  allowed: boolean;
  /** How long to remember this decision */
  scope?: PermissionScope;
  /** Modified tool arguments (tool args may be altered by user) */
  modifiedInput?: Record<string, unknown>;
  /** Denial reason (if denied) */
  reason?: string;
}

/** Permission callback signature */
export type PermissionCallback = (
  request: PermissionRequest,
  signal: AbortSignal,
) => Promise<PermissionDecision>;

// ─── User Input (Ask User) ────────────────────────────────────

/** Request for user input — separate from permissions */
export interface UserInputRequest {
  question: string;
  choices?: string[];
  /** Whether to allow freeform text input (default: true) */
  allowFreeform?: boolean;
}

/** Response from user to an input request */
export interface UserInputResponse {
  answer: string;
  /** true if user typed a custom answer instead of selecting a choice */
  wasFreeform: boolean;
  /** Index of selected choice (if choice was selected) */
  selectedChoiceIndex?: number;
}

// ─── Supervisor Hooks ──────────────────────────────────────────

/** Hooks for supervisor/UI to intercept agent actions */
export interface SupervisorHooks {
  onPermission?: PermissionCallback;
  onAskUser?: (
    request: UserInputRequest,
    signal: AbortSignal,
  ) => Promise<UserInputResponse>;
}

// ─── Structured Output ─────────────────────────────────────────

/** Configuration for typed structured output from LLM */
export interface StructuredOutputConfig<T = unknown> {
  schema: z.ZodType<T>;
  name?: string;
  description?: string;
}

// ─── Agent Events (Streaming) ──────────────────────────────────

/** Events emitted during streaming agent execution */
export type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; toolName: string; args: JSONValue }
  | { type: "tool_call_end"; toolName: string; result: JSONValue }
  | { type: "permission_request"; request: PermissionRequest }
  | {
      type: "permission_response";
      toolName: string;
      decision: PermissionDecision;
    }
  | { type: "ask_user"; request: UserInputRequest }
  | { type: "ask_user_response"; answer: string }
  | { type: "thinking_start" }
  | { type: "thinking_end" }
  | {
      type: "usage_update";
      promptTokens: number;
      completionTokens: number;
    }
  | { type: "error"; error: string; recoverable: boolean }
  | { type: "done"; finalOutput: string | null; structuredOutput?: unknown };

// ─── Run Options ───────────────────────────────────────────────

/** Options passed to agent.run() / agent.stream() */
export interface RunOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Arbitrary context passed to the agent run */
  context?: Record<string, unknown>;
}

// ─── Agent Configuration ───────────────────────────────────────

/** LLM model parameters */
export interface ModelParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

/** Timeout configuration for agent operations */
export interface TimeoutConfig {
  /** Max time for entire agent run (ms) */
  total?: number;
  /** Max time for a single tool execution (ms) */
  perTool?: number;
  /** Max time for a single LLM request (ms) */
  perLLMRequest?: number;
}

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

/** Configuration for creating an agent */
export interface AgentConfig {
  model?: string;
  modelParams?: ModelParams;
  systemPrompt: string;
  tools: ToolDefinition[];
  supervisor?: SupervisorHooks;
  maxTurns?: number;
  timeout?: TimeoutConfig;
  errorHandling?: ErrorHandlingConfig;
  /** Pluggable store for persisting permission scope decisions across runs */
  permissionStore?: IPermissionStore;
}

// ─── Agent Result (Generic) ────────────────────────────────────

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
  usage?: { promptTokens: number; completionTokens: number };
}

// ─── Agent State ───────────────────────────────────────────────

/** Agent lifecycle state */
export type AgentState = "idle" | "running" | "streaming" | "disposed";

// ─── Agent Interface ───────────────────────────────────────────

/** Core agent interface — run prompts, stream events, manage lifecycle */
export interface IAgent {
  run(prompt: MessageContent, options?: RunOptions): Promise<AgentResult>;
  runWithContext(
    messages: Message[],
    options?: RunOptions,
  ): Promise<AgentResult>;
  runStructured<T>(
    prompt: MessageContent,
    schema: StructuredOutputConfig<T>,
    options?: RunOptions,
  ): Promise<AgentResult<T>>;
  stream(
    prompt: MessageContent,
    options?: RunOptions,
  ): AsyncIterable<AgentEvent>;
  abort(): void;
  getState(): AgentState;
  getConfig(): Readonly<AgentConfig>;
  /** Release resources. After dispose(), agent must not be used. */
  dispose(): void;
}

// ─── Service Interface ─────────────────────────────────────────

/** Model metadata returned by listModels() */
export interface ModelInfo {
  id: string;
  name?: string;
  provider?: string;
}

/** Result of backend validation check */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Backend service interface — creates agents, lists models, validates config */
export interface IAgentService {
  readonly name: string;
  createAgent(config: AgentConfig): IAgent;
  listModels(): Promise<ModelInfo[]>;
  validate(): Promise<ValidationResult>;
  dispose(): Promise<void>;
}

// ─── Backend Options ───────────────────────────────────────────

/** Options for Copilot CLI backend */
export interface CopilotBackendOptions {
  cliPath?: string;
  workingDirectory?: string;
  githubToken?: string;
  useLoggedInUser?: boolean;
}

/** Options for Claude CLI backend */
export interface ClaudeBackendOptions {
  cliPath?: string;
  workingDirectory?: string;
  maxTurns?: number;
}

/** Options for Vercel AI SDK backend */
export interface VercelAIBackendOptions {
  apiKey: string;
  provider?: string;
  baseUrl?: string;
}

// ─── Type Guards ───────────────────────────────────────────────

/** Type guard: checks if a ToolDeclaration has an execute function (i.e., is a ToolDefinition) */
export function isToolDefinition(
  tool: ToolDeclaration,
): tool is ToolDefinition {
  return "execute" in tool && typeof (tool as ToolDefinition).execute === "function";
}

/** Type guard: checks if MessageContent is plain string */
export function isTextContent(content: MessageContent): content is string {
  return typeof content === "string";
}

/** Type guard: checks if MessageContent is multi-part array */
export function isMultiPartContent(
  content: MessageContent,
): content is ContentPart[] {
  return Array.isArray(content);
}

/** Extract text from MessageContent regardless of format */
export function getTextContent(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}
