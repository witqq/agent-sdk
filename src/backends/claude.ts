import type {
  IAgent,
  IAgentService,
  AgentConfig,
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
} from "../types.js";
import { getTextContent } from "../types.js";
import { BaseAgent } from "../base-agent.js";
import { DisposedError, SubprocessError, AbortError } from "../errors.js";
import { zodToJsonSchema } from "../utils/schema.js";

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

let sdkModule: SDKModule | null = null;

async function loadSDK(): Promise<SDKModule> {
  if (sdkModule) return sdkModule;
  try {
    // @ts-ignore — peer dependency, not present at compile time
    sdkModule = (await import("@anthropic-ai/claude-agent-sdk")) as SDKModule;
    return sdkModule!;
  } catch {
    throw new SubprocessError(
      "@anthropic-ai/claude-agent-sdk is not installed. Install it: npm install @anthropic-ai/claude-agent-sdk",
    );
  }
}

/** @internal For testing: inject mock SDK module */
export function _injectSDK(mock: SDKModule | null): void {
  sdkModule = mock;
}

/** @internal For testing: reset injected SDK */
export function _resetSDK(): void {
  sdkModule = null;
}

// ─── Known Models ───────────────────────────────────────────────

const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";
const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_OAUTH_BETA = "oauth-2025-04-20";

// ─── Tool Mapping ───────────────────────────────────────────────

function buildMcpServer(
  sdk: SDKModule,
  tools: ToolDefinition[],
  toolResultCapture?: Map<string, JSONValue>,
): SDKMcpServerConfigWithInstance | undefined {
  if (tools.length === 0) return undefined;

  const mcpTools = tools.map((tool) =>
    sdk.tool(
      tool.name,
      tool.description ?? "",
      zodToJsonSchema(tool.parameters) as Record<string, unknown>,
      async (args: Record<string, unknown>) => {
        const result = await tool.execute(args);
        // Capture result for AgentResult.toolCalls
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
    ),
  );

  return sdk.createSdkMcpServer({
    name: "agent-sdk-tools",
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
  config: AgentConfig,
): SDKCanUseTool | undefined {
  const onPermission = config.supervisor?.onPermission;
  if (!onPermission) return undefined;

  const permissionStore = config.permissionStore;

  return async (
    toolName: string,
    input: Record<string, unknown>,
    options,
  ): Promise<SDKPermissionResult> => {
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

      // Extract text content from the message
      const textParts = betaMessage.content
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text!)
        .join("");

      if (textParts) {
        events.push({ type: "text_delta", text: textParts });
      }

      // Emit tool_call_start for each tool_use block
      for (const block of betaMessage.content) {
        if (block.type === "tool_use") {
          const toolCallId = String(block.id ?? "");
          const toolName = block.name ?? "unknown";
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
      const toolName = (msg.tool_name as string | undefined) ?? "unknown";
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
      // Emit as tool_call_end with summary as result
      if (summary) {
        return {
          type: "tool_call_end",
          toolCallId,
          toolName,
          result: summary as JSONValue,
        };
      }
      return null;
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
      const toolName = msg.tool_name as string | undefined;
      if (!toolName) return null;
      const toolCallId = toolCallTracker?.peekToolCallId(toolName) ?? "";
      return { type: "tool_call_start", toolCallId, toolName, args: {} };
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
        return {
          type: "error",
          error: r.errors?.join("; ") ?? "Unknown error",
          recoverable: false,
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

  constructor(config: AgentConfig, options: ClaudeBackendOptions) {
    super(config);
    this.options = options;
    this.tools = config.tools;
    this.canUseTool = buildCanUseTool(config);
    this.isPersistent = config.sessionMode === "persistent";

    // Warn if onAskUser is set — Claude CLI SDK doesn't support user interaction hooks
    if (config.supervisor?.onAskUser) {
      console.warn(
        "[agent-sdk/claude] supervisor.onAskUser is not supported by the Claude CLI backend. " +
        "User interaction requests from the model will not be forwarded.",
      );
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

  private buildQueryOptions(signal: AbortSignal): SDKOptions {
    const ac = new AbortController();
    // Link external signal → SDK's abort controller
    signal.addEventListener("abort", () => ac.abort(), { once: true });

    const opts: SDKOptions = {
      abortController: ac,
      model: this.config.model,
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

    return opts;
  }

  private async buildMcpConfig(
    opts: SDKOptions,
    toolResultCapture?: Map<string, JSONValue>,
  ): Promise<SDKOptions> {
    if (this.tools.length === 0) return opts;

    const sdk = await loadSDK();
    const mcpServer = buildMcpServer(sdk, this.tools, toolResultCapture);
    if (mcpServer) {
      opts.mcpServers = {
        "agent-sdk-tools": mcpServer,
      };
    }
    return opts;
  }

  // ─── executeRun ─────────────────────────────────────────────────

  protected async executeRun(
    messages: Message[],
    _options: RunOptions | undefined,
    signal: AbortSignal,
  ): Promise<AgentResult> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const isResuming = this.isPersistent && this._sessionId !== undefined;
    const prompt = isResuming
      ? extractLastUserPrompt(messages)
      : buildContextualPrompt(messages);
    let opts = this.buildQueryOptions(signal);
    const toolResultCapture = new Map<string, JSONValue>();
    opts = await this.buildMcpConfig(opts, toolResultCapture);

    const q = sdk.query({ prompt, options: opts });
    this.activeQuery = q;
    const toolCalls: AgentResult["toolCalls"] = [];
    let output: string | null = null;
    let usage: AgentResult["usage"];

    try {
      for await (const msg of q) {
        // Collect tool calls from assistant messages
        if (msg.type === "assistant") {
          const betaMessage = msg.message as {
            content?: Array<{
              type: string;
              text?: string;
              name?: string;
              input?: unknown;
              id?: string;
            }>;
          } | undefined;
          if (betaMessage?.content) {
            for (const block of betaMessage.content) {
              if (block.type === "tool_use") {
                const toolName = block.name ?? "unknown";
                toolCalls.push({
                  toolName,
                  args: (block.input as JSONValue) ?? {},
                  result: toolResultCapture.get(toolName) ?? null,
                  approved: true,
                });
              }
            }
          }
        }

        // Back-fill results from capture map for previously added tool calls
        if (msg.type === "tool_use_summary" || msg.type === "result") {
          for (const tc of toolCalls) {
            if (tc.result === null) {
              const captured = toolResultCapture.get(tc.toolName);
              if (captured !== undefined) tc.result = captured;
            }
          }
        }

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
      if (this.isPersistent) this.clearPersistentSession();
      if (signal.aborted) throw new AbortError();
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
    _options: RunOptions | undefined,
    signal: AbortSignal,
  ): Promise<AgentResult<T>> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const isResuming = this.isPersistent && this._sessionId !== undefined;
    const prompt = isResuming
      ? extractLastUserPrompt(messages)
      : buildContextualPrompt(messages);
    let opts = this.buildQueryOptions(signal);
    opts = await this.buildMcpConfig(opts);

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
      if (this.isPersistent) this.clearPersistentSession();
      if (signal.aborted) throw new AbortError();
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
    _options: RunOptions | undefined,
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    this.checkAbort(signal);

    const sdk = await loadSDK();
    const isResuming = this.isPersistent && this._sessionId !== undefined;
    const prompt = isResuming
      ? extractLastUserPrompt(messages)
      : buildContextualPrompt(messages);
    let opts = this.buildQueryOptions(signal);
    opts = await this.buildMcpConfig(opts);

    const q = sdk.query({ prompt, options: opts });
    this.activeQuery = q;
    const thinkingBlockIndices = new Set<number>();
    const toolCallTracker = new ClaudeToolCallTracker();

    try {
      for await (const msg of q) {
        if (signal.aborted) throw new AbortError();

        const event = mapSDKMessage(msg, thinkingBlockIndices, toolCallTracker);
        if (event) {
          if (Array.isArray(event)) {
            for (const e of event) yield e;
          } else {
            yield event;
          }
        }

        // Capture session_id and emit done event on result
        if (msg.type === "result" && msg.subtype === "success") {
          const r = msg as unknown as SDKResultSuccess;
          if (r.session_id) {
            if (this.isPersistent) {
              this._sessionId = r.session_id;
            }
            yield this.emitSessionInfo(r.session_id);
          }
          yield { type: "done", finalOutput: r.result };
        }
      }
    } catch (e) {
      if (this.isPersistent) this.clearPersistentSession();
      if (signal.aborted) throw new AbortError();
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

function extractLastUserPrompt(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user") {
      return getTextContent(msg.content);
    }
  }
  return "";
}

/** Build prompt with conversation history for CLI backends that create fresh sessions */
function buildContextualPrompt(messages: Message[]): string {
  if (messages.length <= 1) {
    return extractLastUserPrompt(messages);
  }

  const history = messages.slice(0, -1).map((msg) => {
    const text = msg.content ? getTextContent(msg.content) : "";
    return msg.role === "user" ? `User: ${text}` : `Assistant: ${text}`;
  }).join("\n");

  const lastPrompt = extractLastUserPrompt(messages);

  return `Conversation history:\n${history}\n\nUser: ${lastPrompt}`;
}

class ClaudeAgentService implements IAgentService {
  readonly name = "claude";
  private disposed = false;
  private readonly options: ClaudeBackendOptions;
  private cachedModels: ModelInfo[] | null = null;

  constructor(options: ClaudeBackendOptions) {
    this.options = options;
  }

  createAgent(config: AgentConfig): IAgent {
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
      data?: Array<{ id: string; display_name?: string }>;
    };

    if (!body.data || body.data.length === 0) {
      return [];
    }

    this.cachedModels = body.data.map((m) => ({
      id: m.id,
      name: m.display_name,
      provider: "claude",
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
