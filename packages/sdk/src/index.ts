// ─── Core Types ────────────────────────────────────────────────
export type {
  JSONValue,
  MessageContent,
  ContentPart,
  ToolDeclaration,
  ToolDefinition,
  ToolContext,
  ToolCall,
  ToolResult,
  Message,
  PermissionScope,
  PermissionRequest,
  PermissionDecision,
  PermissionCallback,
  UserInputRequest,
  UserInputResponse,
  SupervisorHooks,
  StructuredOutputConfig,
  UsageData,
  AgentEvent,
  RunOptions,
  ModelParams,
  TimeoutConfig,
  ErrorHandlingConfig,
  AgentConfig,
  CallDefaults,
  FullAgentConfig,
  AgentResult,
  AgentState,
  IAgent,
  ModelInfo,
  ValidationResult,
  IAgentService,
  CopilotBackendOptions,
  ClaudeBackendOptions,
  VercelAIBackendOptions,
  CallOptions,
  RetryConfig,
  StreamMiddleware,
  StreamContext,
} from "./types.js";

// ─── Error Classification ──────────────────────────────────────
export {
  ErrorCode,
  isRecoverableErrorCode,
  classifyAgentError,
} from "./types.js";

// ─── Type Guards ───────────────────────────────────────────────
export {
  isToolDefinition,
  isTextContent,
  isMultiPartContent,
  getTextContent,
} from "./types.js";

// ─── Errors ────────────────────────────────────────────────────
export type { AgentSDKErrorOptions } from "./errors.js";
export {
  AgentSDKError,
  ReentrancyError,
  DisposedError,
  BackendNotFoundError,
  BackendAlreadyRegisteredError,
  SubprocessError,
  DependencyError,
  AbortError,
  ToolExecutionError,
  ActivityTimeoutError,
  StructuredOutputError,
} from "./errors.js";

// ─── Registry & Factory ────────────────────────────────────────
export type { BackendFactory, BackendOptionsMap, BuiltinBackendName } from "./registry.js";
export {
  registerBackend,
  registerLazyBackend,
  unregisterBackend,
  hasBackend,
  listBackends,
  resetRegistry,
  createAgentService,
  disposeBackend,
  listConfigs,
} from "./registry.js";

// ─── Base Agent ────────────────────────────────────────────────
export { BaseAgent } from "./base-agent.js";

// ─── Utilities ─────────────────────────────────────────────────
export { zodToJsonSchema } from "./utils/schema.js";
export { messagesToPrompt, contentToText, buildSystemPrompt } from "./utils/messages.js";

// ─── Permission Store ──────────────────────────────────────────
export type { IPermissionStore } from "./permission-store.js";
export {
  InMemoryPermissionStore,
  FilePermissionStore,
  CompositePermissionStore,
  createDefaultPermissionStore,
} from "./permission-store.js";
