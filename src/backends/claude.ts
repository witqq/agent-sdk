import type {
  IAgent,
  IAgentService,
  FullAgentConfig,
  AgentResult,
  AgentEvent,
  Message,
  RunOptions,
  StructuredOutputConfig,
  ToolDefinition,
  ClaudeBackendOptions,
  ModelInfo,
  ValidationResult,
  JSONValue,
  PermissionRequest as UnifiedPermissionRequest,
  PermissionDecision,
  PermissionScope,
  UserInputRequest,
  UserInputResponse,
  SupervisorHooks,
} from "../types.js";
import { classifyAgentError, isRecoverableErrorCode } from "../types.js";
import { BaseAgent } from "../base-agent.js";
import { DisposedError, SubprocessError, AbortError } from "../errors.js";
import { zodToJsonSchema } from "../utils/schema.js";
import { extractLastUserPrompt, buildContextualPrompt } from "./shared.js";

export type { ClaudeBackendOptions } from "../types.js";

// ─── Local Type Definitions (matching @anthropic-ai/claude-agent-sdk shapes) ──
// Avoids requiring the SDK to be installed at compile time.

/** @internal Claude SDK PermissionUpdate destination */
type PermissionUpdateDestination =
  | "userSettings"
  | "projectSettings"
  | "localSettings"
  | "session"
  | "cliArg";

/** @internal Claude SDK PermissionUpdate */
interface SDKPermissionUpdate {
  type: "addRules" | "replaceRules" | "removeRules" | "setMode" | "addDirectories" | "removeDirectories";
  destination: PermissionUpdateDestination;
  [key: string]: unknown;
}

/** @internal Claude SDK PermissionResult */
type SDKPermissionResult =
  | {
      behavior: "allow";
      updatedInput?: Record<string, unknown>;
      updatedPermissions?: SDKPermissionUpdate[];
      toolUseID?: string;
    }
  | {
      behavior: "deny";
      message: string;
      interrupt?: boolean;
      toolUseID?: string;
    };

/** @internal Claude SDK CanUseTool callback */
type SDKCanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal;
    suggestions?: SDKPermissionUpdate[];
    blockedPath?: string;
    decisionReason?: string;
    toolUseID: string;
    agentID?: string;
  },
) => Promise<SDKPermissionResult>;

/** @internal MCP server name used when registering agent-sdk tools */
const MCP_SERVER_NAME = "agent-sdk-tools";
const MCP_TOOL_PREFIX = `mcp__${MCP_SERVER_NAME}__`;

/** @internal Claude Code MCP tool naming convention: mcp__<server>__<tool> */
function mcpToolName(toolName: string): string {
  return `${MCP_TOOL_PREFIX}${toolName}`;
}

/** @internal Strip MCP prefix to recover original tool name */
function stripMcpPrefix(name: string): string {
  return name.startsWith(MCP_TOOL_PREFIX) ? name.slice(MCP_TOOL_PREFIX.length) : name;
}

/**
 * Claude CLI built-in tool names that should be filtered from AgentEvent stream.
 * These are internal tools handled by the CLI runtime, not user-registered tools.
 * Matches Copilot behavior where ask_user is callback-only, never exposed as tool events.
 */
const CLAUDE_INTERNAL_TOOL_NAMES = new Set(["AskUserQuestion"]);

/** @internal Claude SDK Options */
interface SDKOptions {
  abortController?: AbortController;
  allowedTools?: string[];
  canUseTool?: SDKCanUseTool;
  cwd?: string;
  disallowedTools?: string[];
  env?: { [envVar: string]: string | undefined };
  includePartialMessages?: boolean;
  maxTurns?: number;
  model?: string;
  outputFormat?: { type: "json_schema"; schema: Record<string, unknown> };
  pathToClaudeCodeExecutable?: string;
  permissionMode?: string;
  persistSession?: boolean;
  resume?: string;
  sessionId?: string;
  systemPrompt?:
    | string
    | { type: "preset"; preset: "claude_code"; append?: string };
  tools?: string[];
  mcpServers?: Record<string, unknown>;
}

/** @internal Claude SDK ModelInfo */
interface SDKModelInfo {
  value: string;
  displayName: string;
  description: string;
}

/** @internal Claude SDK ResultSuccess */
interface SDKResultSuccess {
  type: "result";
  subtype: "success";
  result: string;
  structured_output?: unknown;
  num_turns: number;
  total_cost_usd: number;
  usage: Record<string, number>;
  modelUsage: Record<string, { inputTokens: number; outputTokens: number }>;
  session_id: string;
}

/** @internal Claude SDK ResultError */
interface SDKResultError {
  type: "result";
  subtype: string;
  errors: string[];
  is_error: boolean;
  usage: Record<string, number>;
  modelUsage: Record<string, { inputTokens: number; outputTokens: number }>;
  session_id: string;
}

/** @internal Claude SDK message union */
interface SDKMessage {
  type: string;
  subtype?: string;
  [key: string]: unknown;
}

/** @internal Claude SDK Query interface — AsyncGenerator<SDKMessage> with control methods */
interface SDKQuery extends AsyncGenerator<SDKMessage, void> {
  close(): void;
  interrupt(): Promise<void>;
  supportedModels(): Promise<SDKModelInfo[]>;
}

/** @internal SDK's MCP tool definition */
interface SDKMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

/** @internal SDK server config */
interface SDKMcpServerConfigWithInstance {
  type: "sdk";
  name: string;
  instance: unknown;
}

/** @internal */
type SDKModule = {
  query: (params: { prompt: string; options?: SDKOptions }) => SDKQuery;
  createSdkMcpServer: (options: {
    name: string;
    version?: string;
    tools?: SDKMcpToolDefinition[];
  }) => SDKMcpServerConfigWithInstance;
  tool: (
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>,
  ) => SDKMcpToolDefinition;
};

// ─── Dynamic SDK Loader ─────────────────────────────────────────

/** Module-level mock set by _injectSDK() for testing */
let _sdkMock: SDKModule | null = null;

/** Load the Claude SDK. Checks module-level mock first, then dynamic import. */
async function loadSDK(): Promise<SDKModule> {
  if (_sdkMock) return _sdkMock;
  try {
    // @ts-ignore — peer dependency, not present at compile time
    return (await import("@anthropic-ai/claude-agent-sdk")) as SDKModule;
  } catch {
    throw new SubprocessError(
      "@anthropic-ai/claude-agent-sdk is not installed. Install it: npm install @anthropic-ai/claude-agent-sdk",
    );
  }
}

/** @internal For testing: inject mock SDK module */
export function _injectSDK(mock: SDKModule | null): void {
  _sdkMock = mock;
}

/** @internal For testing: reset injected SDK */
export function _resetSDK(): void {
  _sdkMock = null;
}

// ─── Known Models ───────────────────────────────────────────────

const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";
const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_OAUTH_BETA = "oauth-2025-04-20";

// ─── Tool Mapping ───────────────────────────────────────────────

/**
 * Normalize Claude's AskUserQuestion input format to UserInputRequest.
 * Claude sends: { questions: [{ question, options?: [{ label }] }] }
 * SDK expects: { question, choices?, allowFreeform? }
 */
function normalizeAskUserInput(args: Record<string, unknown>): UserInputRequest {
  // Direct format (already normalized or simple question)
  if (typeof args.question === "string") {
    return {
      question: args.question,
      choices: Array.isArray(args.choices) ? args.choices as string[] : undefined,
      allowFreeform: args.allowFreeform !== false,
    };
  }

  // Claude's nested format: { questions: [{ question, options?: [{ label }] }] }
  const questions = args.questions as Array<{
    question: string;
    options?: Array<{ label: string }>;
  }> | undefined;

  if (questions && questions.length > 0) {
    const first = questions[0];
    return {
      question: first.question,
      choices: first.options?.map((o) => o.label),
      allowFreeform: true,
    };
  }

  // Fallback: stringify the entire input as the question
  return { question: JSON.stringify(args), allowFreeform: true };
}

function buildMcpServer(
  sdk: SDKModule,
  tools: ToolDefinition[],
  toolResultCapture?: Map<string, JSONValue>,
  onAskUser?: SupervisorHooks["onAskUser"],
): SDKMcpServerConfigWithInstance | undefined {
  if (tools.length === 0 && !onAskUser) return undefined;

  const mcpTools = tools.map((tool) => {
    // Claude SDK's tool() expects a Zod raw shape ({key: z.string(), ...}),
    // not a JSON Schema object. Extract .shape from ZodObject.
    const zodSchema = tool.parameters as { shape?: Record<string, unknown> };
    const inputSchema = zodSchema.shape ?? zodToJsonSchema(tool.parameters) as Record<string, unknown>;
    return sdk.tool(
      tool.name,
      tool.description ?? "",
      inputSchema,
      async (args: Record<string, unknown>) => {
        const result = await tool.execute(args);
        if (toolResultCapture) {
          toolResultCapture.set(tool.name, result as JSONValue);
        }
        return {
          content: [
            {
              type: "text" as const,
              text: typeof result === "string" ? result : JSON.stringify(result),
            },
          ],
        };
      },
    );
  });

  // Inject ask_user MCP tool when onAskUser callback is configured
  if (onAskUser) {
    const askUserTool = sdk.tool(
      "ask_user",
      "Ask the user a question and wait for their response",
      {
        question: { type: "string", description: "The question to ask the user" },
        choices: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of choices for multiple choice",
        },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "object", properties: { label: { type: "string" } } } },
            },
          },
          description: "Alternative nested question format",
        },
      },
      async (args: Record<string, unknown>) => {
        const normalized = normalizeAskUserInput(args);
        // No parent signal available in MCP tool context; provide a standalone controller
        const response: UserInputResponse = await onAskUser(normalized, AbortSignal.timeout(300_000));
        return {
          content: [{ type: "text" as const, text: response.answer }],
        };
      },
    );
    mcpTools.push(askUserTool);
  }

  return sdk.createSdkMcpServer({
    name: MCP_SERVER_NAME,
    version: "1.0.0",
    tools: mcpTools,
  });
}

// ─── Permission Mapping ─────────────────────────────────────────

/** Map our PermissionScope to Claude SDK's PermissionUpdateDestination */
function scopeToDestination(scope: PermissionScope): PermissionUpdateDestination {
  switch (scope) {
    case "once":
      return "session";
    case "session":
      return "session";
    case "project":
      return "projectSettings";
    case "always":
      return "userSettings";
  }
}

/** Map Claude SDK suggestions to our PermissionScope */
function destinationToScope(dest: PermissionUpdateDestination): PermissionScope {
  switch (dest) {
    case "session":
    case "cliArg":
      return "session";
    case "projectSettings":
    case "localSettings":
      return "project";
    case "userSettings":
      return "always";
  }
}

/** Extract best suggestedScope from SDK's PermissionUpdate[] */
function extractSuggestedScope(
  suggestions?: SDKPermissionUpdate[],
): PermissionScope | undefined {
  if (!suggestions || suggestions.length === 0) return undefined;
  // Use the destination of the first suggestion as the scope hint
  return destinationToScope(suggestions[0].destination);
}

function buildCanUseTool(
  config: FullAgentConfig,
): SDKCanUseTool | undefined {
  const onPermission = config.supervisor?.onPermission;
  if (!onPermission) return undefined;

  const permissionStore = config.permissionStore;

  return async (
    rawToolName: string,
    input: Record<string, unknown>,
    options,
  ): Promise<SDKPermissionResult> => {
    const toolName = stripMcpPrefix(rawToolName);
    // Check store first — if already approved, skip callback
    if (permissionStore && await permissionStore.isApproved(toolName)) {
      return {
        behavior: "allow",
        toolUseID: options.toolUseID,
      };
    }

    const unifiedRequest: UnifiedPermissionRequest = {
      toolName,
      toolArgs: input,
      toolCallId: options.toolUseID,
      suggestedScope: extractSuggestedScope(options.suggestions),
      rawSDKRequest: { toolName, input, ...options },
    };

    const decision: PermissionDecision = await onPermission(
      unifiedRequest,
      options.signal,
    );

    if (decision.allowed) {
      // Persist approval to store
      if (permissionStore && decision.scope) {
        await permissionStore.approve(toolName, decision.scope);
      }

      const result: SDKPermissionResult = {
        behavior: "allow",
        toolUseID: options.toolUseID,
      };
      if (decision.modifiedInput) {
        (result as { updatedInput?: Record<string, unknown> }).updatedInput =
          decision.modifiedInput;
      }
      // Map scope decision to SDK's updatedPermissions
      if (decision.scope && decision.scope !== "once" && options.suggestions) {
        (result as { updatedPermissions?: SDKPermissionUpdate[] }).updatedPermissions =
          options.suggestions.map((s) => ({
            ...s,
            destination: scopeToDestination(decision.scope!),
          }));
      }
      return result;
    }

    return {
      behavior: "deny",
      message: decision.reason ?? "Permission denied",
      toolUseID: options.toolUseID,
    };
  };
}

// ─── Usage Aggregation Helper ───────────────────────────────────

function aggregateUsage(
  modelUsage?: Record<string, { inputTokens: number; outputTokens: number }>,
): { promptTokens: number; completionTokens: number } {
  let promptTokens = 0;
  let completionTokens = 0;
  for (const u of Object.values(modelUsage ?? {})) {
    promptTokens += u.inputTokens ?? 0;
    completionTokens += u.outputTokens ?? 0;
  }
  return { promptTokens, completionTokens };
}

// ─── Event Mapping ──────────────────────────────────────────────

/**
 * Tracks tool call IDs to tool names for Claude backend.
 *
 * The Claude SDK emits tool_use blocks (with `id` and `name`) in assistant messages,
 * but tool_use_summary messages only carry `tool_name` (and optionally
 * `preceding_tool_use_ids`). This tracker correlates start/end events using a
 * per-tool-name FIFO queue to handle parallel calls to the same tool.
 */
class ClaudeToolCallTracker {
  private queues = new Map<string, string[]>();

  trackStart(toolCallId: string, toolName: string): void {
    if (!this.queues.has(toolName)) {
      this.queues.set(toolName, []);
    }
    this.queues.get(toolName)!.push(toolCallId);
  }

  /** Peek at the current tool call ID for a tool name (does not consume) */
  peekToolCallId(toolName: string): string {
    const queue = this.queues.get(toolName);
    if (!queue || queue.length === 0) return "";
    return queue[0];
  }

  /** Consume and return the first tool call ID for a tool name */
  consumeToolCallId(toolName: string): string {
    const queue = this.queues.get(toolName);
    if (!queue || queue.length === 0) return "";
    return queue.shift()!;
  }

  clear(): void {
    this.queues.clear();
  }
}

function mapSDKMessage(msg: SDKMessage, thinkingBlockIndices?: Set<number>, toolCallTracker?: ClaudeToolCallTracker): AgentEvent | AgentEvent[] | null {
  switch (msg.type) {
    case "assistant": {
      // Full assistant message — contains BetaMessage with content blocks
      const betaMessage = msg.message as {
        content?: Array<{
          type: string;
          text?: string;
          name?: string;
          input?: unknown;
          id?: string;
        }>;
      } | undefined;
      if (!betaMessage?.content) return null;

      const events: AgentEvent[] = [];

      // Emit tool_call_start for each tool_use block
      // NOTE: Text content is NOT extracted here — during streaming it arrives
      // via content_block_delta events, and during executeRun it comes from
      // the result message. Emitting text from assistant messages would cause
      // duplication.
      for (const block of betaMessage.content) {
        if (block.type === "tool_use") {
          const toolCallId = String(block.id ?? "");
          const toolName = stripMcpPrefix(block.name ?? "unknown");
          // Filter out internal Claude CLI tools (e.g. AskUserQuestion)
          if (CLAUDE_INTERNAL_TOOL_NAMES.has(toolName)) continue;
          if (toolCallTracker) {
            toolCallTracker.trackStart(toolCallId, toolName);
          }
          events.push({
            type: "tool_call_start",
            toolCallId,
            toolName,
            args: (block.input as JSONValue) ?? {},
          });
        }
      }

      return events.length > 0 ? events : null;
    }

    case "user": {
      // User messages with tool_use_result indicate tool completion
      const toolResult = msg.tool_use_result as JSONValue | undefined;
      // Extract tool name from the message context if available
      if (toolResult !== undefined) {
        // The user message after tool execution — emit tool_call_end
        // tool_name may not be in user messages, but we can infer from context
        return null; // Handled via tool_use_summary below
      }
      return null;
    }

    case "tool_use_summary": {
      // Emitted after tool execution — contains summary of tool results
      const summary = msg.summary as string | undefined;
      const toolName = stripMcpPrefix((msg.tool_name as string | undefined) ?? "unknown");
      // Filter out internal Claude CLI tools (e.g. AskUserQuestion)
      if (CLAUDE_INTERNAL_TOOL_NAMES.has(toolName)) return null;
      // Resolve toolCallId: prefer preceding_tool_use_ids, fall back to tracker
      const precedingIds = msg.preceding_tool_use_ids as string[] | undefined;
      let toolCallId = "";
      if (precedingIds && precedingIds.length > 0) {
        toolCallId = precedingIds[0];
        // Consume from tracker to keep queue in sync
        if (toolCallTracker) toolCallTracker.consumeToolCallId(toolName);
      } else if (toolCallTracker) {
        toolCallId = toolCallTracker.consumeToolCallId(toolName);
      }
      // Always emit tool_call_end — summary may be empty
      return {
        type: "tool_call_end",
        toolCallId,
        toolName,
        result: (summary ?? null) as JSONValue,
      };
    }

    case "stream_event": {
      // Partial streaming events — BetaRawMessageStreamEvent
      const event = msg.event as {
        type: string;
        delta?: { type: string; text?: string; thinking?: string };
        content_block?: { type: string; name?: string; id?: string };
        index?: number;
      } | undefined;
      if (!event) return null;

      // Thinking block deltas — emit thinking_delta instead of text_delta
      if (
        event.type === "content_block_delta" &&
        event.index !== undefined &&
        thinkingBlockIndices?.has(event.index)
      ) {
        const thinkingText = String(event.delta?.thinking ?? event.delta?.text ?? "");
        if (thinkingText) {
          return { type: "thinking_delta", text: thinkingText };
        }
        return null;
      }

      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta" &&
        event.delta.text
      ) {
        return { type: "text_delta", text: event.delta.text };
      }

      if (event.type === "content_block_start" && event.content_block?.type === "thinking") {
        if (thinkingBlockIndices && event.index !== undefined) {
          thinkingBlockIndices.add(event.index);
        }
        return { type: "thinking_start" };
      }

      if (event.type === "content_block_stop" && event.index !== undefined && thinkingBlockIndices?.has(event.index)) {
        thinkingBlockIndices.delete(event.index);
        return { type: "thinking_end" };
      }

      return null;
    }

    case "tool_progress": {
      // Heartbeat while tool is executing — not a new tool call
      return null;
    }

    case "result": {
      if (msg.subtype === "success") {
        const r = msg as unknown as SDKResultSuccess;
        return {
          type: "usage_update",
          ...aggregateUsage(r.modelUsage),
        };
      }
      if (msg.is_error) {
        const r = msg as unknown as SDKResultError;
        const errorMsg = r.errors?.join("; ") ?? "Unknown error";
        const code = classifyAgentError(errorMsg);
        return {
          type: "error",
          error: errorMsg,
          recoverable: isRecoverableErrorCode(code),
          code,
        };
      }
      return null;
    }

    default:
      return null;
  }
}

// ─── ClaudeAgent ────────────────────────────────────────────────

class ClaudeAgent extends BaseAgent {
  protected readonly backendName = "claude";
  private readonly options: ClaudeBackendOptions;
  private readonly tools: ToolDefinition[];
  private readonly canUseTool: SDKCanUseTool | undefined;
  private readonly isPersistent: boolean;
  private _sessionId: string | undefined;
  private activeQuery: SDKQuery | null = null;

  constructor(config: FullAgentConfig, options: ClaudeBackendOptions) {
    super(config);
    this.options = options;
    this.tools = config.tools ?? [];
    this.canUseTool = buildCanUseTool(config);
    this.isPersistent = config.sessionMode === "persistent";

    // Restore session ID from stored identifier for session resume after server restart.
    // buildQueryOptions() uses _sessionId to set opts.resume when isPersistent.
    if (options.resumeSessionId) {
      this._sessionId = options.resumeSessionId;
    }
  }

  override get sessionId(): string | undefined {
    return this._sessionId;
  }

  override async interrupt(): Promise<void> {
    try {
      if (this.activeQuery) {
        await this.activeQuery.interrupt();
      }
    } catch {
      // fire-and-forget: SDK interrupt errors should not prevent abort
    } finally {
      this.abort();
    }
  }

  /** Clear persistent session state after an error so next call starts fresh */
  private clearPersistentSession(): void {
    this._sessionId = undefined;
  }

  private emitSessionInfo(sessionId: string): AgentEvent {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    const transcriptPath = home
      ? `${home}/.claude/projects/.session/sessions/${sessionId}/conversation.jsonl`
      : undefined;
    return { type: "session_info", sessionId, transcriptPath, backend: "claude" };
  }

  private buildQueryOptions(signal: AbortSignal, options: RunOptions): SDKOptions {
    const ac = new AbortController();
    // Link external signal → SDK's abort controller
    signal.addEventListener("abort", () => ac.abort(), { once: true });

    const opts: SDKOptions = {
      abortController: ac,
      model: options.model,
      maxTurns: this.options.maxTurns,
      cwd: this.options.workingDirectory,
      pathToClaudeCodeExecutable: this.options.cliPath,
      persistSession: this.isPersistent,
      includePartialMessages: true,
      canUseTool: this.canUseTool,
    };

    // Resume persistent session on subsequent calls
    if (this.isPersistent && this._sessionId) {
      opts.resume = this._sessionId;
    }

    if (this.config.systemPrompt) {
      opts.systemPrompt = this.config.systemPrompt;
    }

    if (this.options.oauthToken || this.options.env) {
      opts.env = {
        ...process.env,
        ...(this.options.env ?? {}),
        ...(this.options.oauthToken
          ? { CLAUDE_CODE_OAUTH_TOKEN: this.options.oauthToken }
          : {}),
      };
    }

    // Auto-set permissionMode when canUseTool is configured so Claude CLI
    // actually invokes the callback instead of using built-in rules.
    if (opts.canUseTool && !opts.permissionMode) {
      opts.permissionMode = "default";
    }

    // When availableTools is set, restrict built-in tool availability.
    // opts.tools controls which tools are available (Bash, Read, Edit, etc.).
    // opts.allowedTools only auto-approves permissions but does NOT restrict availability.
    // MCP tool names are added to allowedTools later by buildMcpConfig().
    if (this.config.availableTools) {
      opts.tools = [...this.config.availableTools];
    }

    return opts;
  }

  private async buildMcpConfig(
    opts: SDKOptions,
    toolResultCapture?: Map<string, JSONValue>,
  ): Promise<SDKOptions> {
    const onAskUser = this.config.supervisor?.onAskUser;
    if (this.tools.length === 0 && !onAskUser) return opts;

    const sdk = await loadSDK();
    const mcpServer = buildMcpServer(sdk, this.tools, toolResultCapture, onAskUser);
    if (mcpServer) {
      opts.mcpServers = {
        [MCP_SERVER_NAME]: mcpServer,
      };
      // Auto-allow MCP tools so Claude Code invokes them without blocking.
      // Claude Code names MCP tools as mcp__<server>__<tool>.
      const mcpToolNames = this.tools.map((t) => mcpToolName(t.name));
      if (onAskUser) {
        mcpToolNames.push(mcpToolName("ask_user"));
      }
      opts.allowedTools = [...(opts.allowedTools ?? []), ...mcpToolNames];
    }

    // When onAskUser is configured, block built-in AskUserQuestion so Claude uses our MCP tool
    if (onAskUser) {
      opts.disallowedTools = [...(opts.disallowedTools ?? []), "AskUserQuestion"];
    }

    return opts;
  }

  // ─── Retry Helpers (shared across executeRun/RunStructured/Stream) ──

  /** Setup a retry query: clear session, rebuild with full history */
  private async prepareRetryQuery(
    sdk: SDKModule,
    messages: Message[],
    signal: AbortSignal,
    options: RunOptions,
    toolResultCapture: Map<string, JSONValue>,
    modifyOpts?: (opts: SDKOptions) => void,
  ): Promise<SDKQuery> {
    this.clearPersistentSession();
    const retryPrompt = buildContextualPrompt(messages);
    let retryOpts = this.buildQueryOptions(signal, options);
    toolResultCapture.clear();
    retryOpts = await this.buildMcpConfig(retryOpts, toolResultCapture);
    modifyOpts?.(retryOpts);
    const retryQ = sdk.query({ prompt: retryPrompt, options: retryOpts });
    this.activeQuery = retryQ;
    return retryQ;
  }

  /** Extract tool_use blocks from an assistant SDK message into toolCalls array */
  private collectToolCallsFromMessage(
    msg: SDKMessage,
    toolCalls: AgentResult["toolCalls"],
    toolResultCapture: Map<string, JSONValue>,
  ): void {
    if (msg.type !== "assistant") return;
    const betaMessage = msg.message as {
      content?: Array<{ type: string; name?: string; input?: unknown }>;
    } | undefined;
    if (!betaMessage?.content) return;
    for (const block of betaMessage.content) {
      if (block.type === "tool_use") {
        const toolName = stripMcpPrefix(block.name ?? "unknown");
        if (CLAUDE_INTERNAL_TOOL_NAMES.has(toolName)) continue;
        toolCalls.push({
          toolName,
          args: (block.input as JSONValue) ?? {},
          result: toolResultCapture.get(toolName) ?? null,
          approved: true,
        });
      }
    }
  }

  /** Back-fill tool results from capture map on summary/result messages */
  private backfillToolResults(
    msg: SDKMessage,
    toolCalls: AgentResult["toolCalls"],
    toolResultCapture: Map<string, JSONValue>,
  ): void {
    if (msg.type !== "tool_use_summary" && msg.type !== "result") return;
    for (const tc of toolCalls) {
      if (tc.result === null) {
        const captured = toolResultCapture.get(tc.toolName);
        if (captured !== undefined) tc.result = captured;
      }
    }
  }

  /** Wrap retry inner loop with shared error handling */
  private async withRetryErrorHandling<T>(
    signal: AbortSignal,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (retryError) {
      if (this.isPersistent) this.clearPersistentSession();
      if (signal.aborted) throw new AbortError();
      throw retryError;
    } finally {
      this.activeQuery = null;
    }
  }

  // ─── executeRun ─────────────────────────────────────────────────

  protected async executeRun(
    messages: Message[],
    options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const isResuming = this.isPersistent && this._sessionId !== undefined;
    const prompt = isResuming
      ? extractLastUserPrompt(messages)
      : buildContextualPrompt(messages);
    let opts = this.buildQueryOptions(signal, options);
    const toolResultCapture = new Map<string, JSONValue>();
    opts = await this.buildMcpConfig(opts, toolResultCapture);

    const q = sdk.query({ prompt, options: opts });
    this.activeQuery = q;
    const toolCalls: AgentResult["toolCalls"] = [];
    let output: string | null = null;
    let usage: AgentResult["usage"];

    try {
      for await (const msg of q) {
        this.collectToolCallsFromMessage(msg, toolCalls, toolResultCapture);
        this.backfillToolResults(msg, toolCalls, toolResultCapture);

        // Capture result and session_id
        if (msg.type === "result") {
          if (msg.subtype === "success") {
            const r = msg as unknown as SDKResultSuccess;
            output = r.result;
            usage = aggregateUsage(r.modelUsage);
            if (this.isPersistent && r.session_id) {
              this._sessionId = r.session_id;
            }
          } else if (msg.is_error) {
            const r = msg as unknown as SDKResultError;
            throw new Error(
              `Claude query failed: ${r.errors?.join("; ") ?? "unknown error"}`,
            );
          }
        }
      }
    } catch (e) {
      if (signal.aborted) throw new AbortError();
      if (isResuming && this.isPersistent) {
        const retryQ = await this.prepareRetryQuery(sdk, messages, signal, options, toolResultCapture);
        toolCalls.length = 0;
        output = null;
        return this.withRetryErrorHandling(signal, async () => {
          for await (const msg of retryQ) {
            this.collectToolCallsFromMessage(msg, toolCalls, toolResultCapture);
            this.backfillToolResults(msg, toolCalls, toolResultCapture);
            if (msg.type === "result") {
              if (msg.subtype === "success") {
                const r = msg as unknown as SDKResultSuccess;
                output = r.result;
                usage = aggregateUsage(r.modelUsage);
                if (this.isPersistent && r.session_id) {
                  this._sessionId = r.session_id;
                }
              } else if (msg.is_error) {
                const r = msg as unknown as SDKResultError;
                throw new Error(
                  `Claude query failed: ${r.errors?.join("; ") ?? "unknown error"}`,
                );
              }
            }
          }
          return {
            output,
            structuredOutput: undefined as AgentResult["structuredOutput"],
            toolCalls,
            messages: [
              ...messages,
              ...(output !== null
                ? [{ role: "assistant" as const, content: output }]
                : []),
            ],
            usage,
          };
        });
      }
      if (this.isPersistent) this.clearPersistentSession();
      throw e;
    } finally {
      this.activeQuery = null;
    }

    return {
      output,
      structuredOutput: undefined as AgentResult["structuredOutput"],
      toolCalls,
      messages: [
        ...messages,
        ...(output !== null
          ? [{ role: "assistant" as const, content: output }]
          : []),
      ],
      usage,
    };
  }

  // ─── executeRunStructured ───────────────────────────────────────

  protected async executeRunStructured<T>(
    messages: Message[],
    schema: StructuredOutputConfig<T>,
    options: RunOptions,
    signal: AbortSignal,
  ): Promise<AgentResult<T>> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const isResuming = this.isPersistent && this._sessionId !== undefined;
    const prompt = isResuming
      ? extractLastUserPrompt(messages)
      : buildContextualPrompt(messages);
    let opts = this.buildQueryOptions(signal, options);
    const toolResultCapture = new Map<string, JSONValue>();
    opts = await this.buildMcpConfig(opts, toolResultCapture);

    // Claude SDK has native structured output via outputFormat
    const jsonSchema = zodToJsonSchema(schema.schema);
    opts.outputFormat = {
      type: "json_schema",
      schema: jsonSchema as Record<string, unknown>,
    };

    const q = sdk.query({ prompt, options: opts });
    this.activeQuery = q;
    const toolCalls: AgentResult["toolCalls"] = [];
    let output: string | null = null;
    let structuredOutput: T | undefined;
    let usage: AgentResult["usage"];

    try {
      for await (const msg of q) {
        this.collectToolCallsFromMessage(msg, toolCalls, toolResultCapture);
        this.backfillToolResults(msg, toolCalls, toolResultCapture);

        if (msg.type === "result" && msg.subtype === "success") {
          const r = msg as unknown as SDKResultSuccess;
          output = r.result;

          // Claude SDK returns parsed structured_output when using outputFormat
          if (r.structured_output !== undefined) {
            try {
              structuredOutput = schema.schema.parse(r.structured_output);
            } catch {
              // Fallback: try parsing result string
              try {
                structuredOutput = schema.schema.parse(JSON.parse(r.result));
              } catch {
                // Leave undefined
              }
            }
          } else if (r.result) {
            // Fallback: parse from result string
            try {
              const jsonMatch = r.result.match(/```(?:json)?\s*([\s\S]*?)```/);
              const raw = jsonMatch ? jsonMatch[1]!.trim() : r.result.trim();
              structuredOutput = schema.schema.parse(JSON.parse(raw));
            } catch {
              // Leave undefined
            }
          }

          usage = aggregateUsage(r.modelUsage);
          if (this.isPersistent && r.session_id) {
            this._sessionId = r.session_id;
          }
        } else if (msg.type === "result" && msg.is_error) {
          const r = msg as unknown as SDKResultError;
          throw new Error(
            `Claude query failed: ${r.errors?.join("; ") ?? "unknown error"}`,
          );
        }
      }
    } catch (e) {
      if (signal.aborted) throw new AbortError();
      if (isResuming && this.isPersistent) {
        const retryQ = await this.prepareRetryQuery(
          sdk, messages, signal, options, toolResultCapture,
          (opts) => { opts.outputFormat = { type: "json_schema", schema: jsonSchema as Record<string, unknown> }; },
        );
        toolCalls.length = 0;
        output = null;
        structuredOutput = undefined;
        return this.withRetryErrorHandling(signal, async () => {
          for await (const msg of retryQ) {
            this.collectToolCallsFromMessage(msg, toolCalls, toolResultCapture);
            this.backfillToolResults(msg, toolCalls, toolResultCapture);
            if (msg.type === "result" && msg.subtype === "success") {
              const r = msg as unknown as SDKResultSuccess;
              output = r.result;
              if (r.structured_output !== undefined) {
                try { structuredOutput = schema.schema.parse(r.structured_output); } catch {
                  try { structuredOutput = schema.schema.parse(JSON.parse(r.result)); } catch {
                    // Leave undefined
                  }
                }
              } else if (r.result) {
                try {
                  const jsonMatch = r.result.match(/```(?:json)?\s*([\s\S]*?)```/);
                  const raw = jsonMatch ? jsonMatch[1]!.trim() : r.result.trim();
                  structuredOutput = schema.schema.parse(JSON.parse(raw));
                } catch {
                  // Leave undefined
                }
              }
              usage = aggregateUsage(r.modelUsage);
              if (this.isPersistent && r.session_id) {
                this._sessionId = r.session_id;
              }
            } else if (msg.type === "result" && msg.is_error) {
              const r = msg as unknown as SDKResultError;
              throw new Error(
                `Claude query failed: ${r.errors?.join("; ") ?? "unknown error"}`,
              );
            }
          }
          return {
            output,
            structuredOutput: structuredOutput as AgentResult<T>["structuredOutput"],
            toolCalls,
            messages: [
              ...messages,
              ...(output !== null
                ? [{ role: "assistant" as const, content: output }]
                : []),
            ],
            usage,
          };
        });
      }
      if (this.isPersistent) this.clearPersistentSession();
      throw e;
    } finally {
      this.activeQuery = null;
    }

    return {
      output,
      structuredOutput: structuredOutput as AgentResult<T>["structuredOutput"],
      toolCalls,
      messages: [
        ...messages,
        ...(output !== null
          ? [{ role: "assistant" as const, content: output }]
          : []),
      ],
      usage,
    };
  }

  // ─── executeStream ──────────────────────────────────────────────

  protected async *executeStream(
    messages: Message[],
    options: RunOptions,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const isResuming = this.isPersistent && this._sessionId !== undefined;
    const prompt = isResuming
      ? extractLastUserPrompt(messages)
      : buildContextualPrompt(messages);
    let opts = this.buildQueryOptions(signal, options);
    // Capture actual tool results from MCP handler execution
    const toolResultCapture = new Map<string, JSONValue>();
    opts = await this.buildMcpConfig(opts, toolResultCapture);

    const q = sdk.query({ prompt, options: opts });
    this.activeQuery = q;
    const thinkingBlockIndices = new Set<number>();
    const toolCallTracker = new ClaudeToolCallTracker();
    // Track pending tool calls to emit tool_call_end for tools without tool_use_summary
    const pendingStreamToolCalls = new Map<string, string>();
    let hasStreamedText = false;

    try {
      for await (const msg of q) {
        if (signal.aborted) throw new AbortError();

        const events = mapSDKMessage(msg, thinkingBlockIndices, toolCallTracker);
        if (events) {
          const mapped = Array.isArray(events) ? events : [events];
          for (const e of mapped) {
            // Track tool_call_start for fallback emission
            if (e.type === "tool_call_start") {
              pendingStreamToolCalls.set(e.toolCallId, e.toolName);
            }
            // Enrich tool_call_end with captured actual result instead of summary text
            if (e.type === "tool_call_end" && toolResultCapture.has(e.toolName)) {
              e.result = toolResultCapture.get(e.toolName)!;
              toolResultCapture.delete(e.toolName);
              pendingStreamToolCalls.delete(e.toolCallId);
            } else if (e.type === "tool_call_end") {
              pendingStreamToolCalls.delete(e.toolCallId);
            }
            if (e.type === "text_delta") hasStreamedText = true;
            yield e;
          }
        }

        // Capture session_id and emit done event on result
        if (msg.type === "result" && msg.subtype === "success") {
          const r = msg as unknown as SDKResultSuccess;
          // Emit tool_call_end for any tools that executed but never got tool_use_summary
          for (const [toolCallId, toolName] of pendingStreamToolCalls) {
            if (toolResultCapture.has(toolName)) {
              yield {
                type: "tool_call_end" as const,
                toolCallId,
                toolName,
                result: toolResultCapture.get(toolName)!,
              };
              toolResultCapture.delete(toolName);
            }
          }
          pendingStreamToolCalls.clear();
          if (r.session_id) {
            if (this.isPersistent) {
              this._sessionId = r.session_id;
            }
            yield this.emitSessionInfo(r.session_id);
          }
          yield {
            type: "done",
            finalOutput: hasStreamedText ? null : r.result,
            ...(hasStreamedText ? { streamed: true } : {}),
          };
        }
      }
    } catch (e) {
      if (signal.aborted) throw new AbortError();
      // Single retry on resume failure: clear session, rebuild with full history
      if (isResuming && this.isPersistent) {
        const retryQ = await this.prepareRetryQuery(sdk, messages, signal, options, toolResultCapture);
        const retryThinkingBlockIndices = new Set<number>();
        const retryToolCallTracker = new ClaudeToolCallTracker();
        const retryPendingToolCalls = new Map<string, string>();
        let retryHasStreamedText = false;
        try {
          for await (const msg of retryQ) {
            if (signal.aborted) throw new AbortError();
            const retryEvents = mapSDKMessage(msg, retryThinkingBlockIndices, retryToolCallTracker);
            if (retryEvents) {
              const mapped = Array.isArray(retryEvents) ? retryEvents : [retryEvents];
              for (const ev of mapped) {
                if (ev.type === "tool_call_start") {
                  retryPendingToolCalls.set(ev.toolCallId, ev.toolName);
                }
                if (ev.type === "tool_call_end" && toolResultCapture.has(ev.toolName)) {
                  ev.result = toolResultCapture.get(ev.toolName)!;
                  toolResultCapture.delete(ev.toolName);
                  retryPendingToolCalls.delete(ev.toolCallId);
                } else if (ev.type === "tool_call_end") {
                  retryPendingToolCalls.delete(ev.toolCallId);
                }
                if (ev.type === "text_delta") retryHasStreamedText = true;
                yield ev;
              }
            }
            if (msg.type === "result" && msg.subtype === "success") {
              const r = msg as unknown as SDKResultSuccess;
              for (const [toolCallId, toolName] of retryPendingToolCalls) {
                if (toolResultCapture.has(toolName)) {
                  yield {
                    type: "tool_call_end" as const,
                    toolCallId,
                    toolName,
                    result: toolResultCapture.get(toolName)!,
                  };
                  toolResultCapture.delete(toolName);
                }
              }
              retryPendingToolCalls.clear();
              if (r.session_id) {
                if (this.isPersistent) {
                  this._sessionId = r.session_id;
                }
                yield this.emitSessionInfo(r.session_id);
              }
              yield {
                type: "done",
                finalOutput: retryHasStreamedText ? null : r.result,
                ...(retryHasStreamedText ? { streamed: true } : {}),
              };
            }
          }
        } catch (retryError) {
          if (this.isPersistent) this.clearPersistentSession();
          if (signal.aborted) throw new AbortError();
          throw retryError;
        } finally {
          this.activeQuery = null;
        }
        return;
      }
      if (this.isPersistent) this.clearPersistentSession();
      throw e;
    } finally {
      this.activeQuery = null;
    }
  }

  override dispose(): void {
    this._sessionId = undefined;
    super.dispose();
  }
}

// ─── Helpers ────────────────────────────────────────────────────

class ClaudeAgentService implements IAgentService {
  readonly name = "claude";
  private disposed = false;
  private readonly options: ClaudeBackendOptions;
  private cachedModels: ModelInfo[] | null = null;

  constructor(options: ClaudeBackendOptions) {
    this.options = options;
  }

  createAgent(config: FullAgentConfig): IAgent {
    if (this.disposed) throw new DisposedError("ClaudeAgentService");
    return new ClaudeAgent(config, this.options);
  }

  async listModels(): Promise<ModelInfo[]> {
    if (this.disposed) throw new DisposedError("ClaudeAgentService");
    if (this.cachedModels) return this.cachedModels;

    const token = this.options.oauthToken;
    if (!token) {
      return [];
    }

    const res = await globalThis.fetch(
      `${ANTHROPIC_MODELS_URL}?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "anthropic-version": ANTHROPIC_API_VERSION,
          "anthropic-beta": ANTHROPIC_OAUTH_BETA,
        },
      },
    );

    if (!res.ok) {
      return [];
    }

    const body = (await res.json()) as {
      data?: Array<{ id: string; display_name?: string; max_input_tokens?: number }>;
    };

    if (!body.data || body.data.length === 0) {
      return [];
    }

    this.cachedModels = body.data.map((m) => ({
      id: m.id,
      name: m.display_name,
      provider: "claude",
      ...(m.max_input_tokens != null && { contextWindow: m.max_input_tokens }),
    }));
    return this.cachedModels;
  }

  async validate(): Promise<ValidationResult> {
    if (this.disposed) throw new DisposedError("ClaudeAgentService");

    const errors: string[] = [];
    try {
      await loadSDK();
    } catch (e) {
      errors.push(
        e instanceof Error ? e.message : String(e),
      );
      return { valid: false, errors };
    }

    // Verify CLI is accessible by attempting a minimal query
    try {
      const sdk = await loadSDK();
      const q = sdk.query({
        prompt: "echo test",
        options: {
          model: "claude-sonnet-4-20250514",
          pathToClaudeCodeExecutable: this.options.cliPath,
          cwd: this.options.workingDirectory,
          persistSession: false,
          maxTurns: 1,
          permissionMode: "plan",
        },
      });
      // Wait for first message (auth check)
      const first = await q.next();
      q.close();
      if (first.done) {
        errors.push("Claude CLI returned no messages — may not be authenticated.");
      }
    } catch (e) {
      errors.push(
        `Failed to connect to Claude CLI: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.cachedModels = null;
  }
}

// ─── Factory ────────────────────────────────────────────────────

/** Create Claude CLI backend service. */
export function createClaudeService(
  options: ClaudeBackendOptions,
): IAgentService {
  return new ClaudeAgentService(options);
}
