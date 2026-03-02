// ─── Barrel re-export ───────────────────────────────────────────

export type { JSONValue } from "./json.js";

export type {
  ToolDeclaration,
  ToolDefinition,
  ToolDefinitionLike,
  ToolContext,
  ToolCall,
  ToolResult,
} from "./tools.js";

export type {
  MessageContent,
  ContentPart,
  Message,
} from "./messages.js";

export type {
  PermissionScope,
  PermissionRequest,
  PermissionDecision,
  PermissionCallback,
  UserInputRequest,
  UserInputResponse,
  SupervisorHooks,
} from "./permissions.js";

export type {
  ModelInfo,
  ModelParams,
  ValidationResult,
} from "./models.js";

export {
  ErrorCode,
  isRecoverableErrorCode,
  classifyAgentError,
} from "./errors.js";

export type {
  UsageData,
  AgentEvent,
  StreamContext,
  StreamMiddleware,
} from "./events.js";

export type {
  CallOptions,
  RetryConfig,
  StructuredOutputConfig,
  RunOptions,
  TimeoutConfig,
  ErrorHandlingConfig,
  AgentConfig,
  CallDefaults,
  FullAgentConfig,
  AgentResult,
  AgentState,
  IAgent,
  IAgentService,
  AgentServiceLike,
} from "./agent.js";

export type {
  CopilotBackendOptions,
  ClaudeBackendOptions,
  VercelAIBackendOptions,
} from "./backends.js";

export {
  isToolDefinition,
  isTextContent,
  isMultiPartContent,
  getTextContent,
} from "./guards.js";
