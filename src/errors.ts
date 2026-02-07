/** Base error class for agent-sdk */
export class AgentSDKError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AgentSDKError";
  }
}

/** Thrown when agent.run() is called while already running (M8 re-entrancy guard) */
export class ReentrancyError extends AgentSDKError {
  constructor() {
    super("Agent is already running. Await the current run before starting another.");
    this.name = "ReentrancyError";
  }
}

/** Thrown when an operation is attempted on a disposed agent/service */
export class DisposedError extends AgentSDKError {
  constructor(entity: string) {
    super(`${entity} has been disposed and cannot be used.`);
    this.name = "DisposedError";
  }
}

/** Thrown when a backend is not found in the registry */
export class BackendNotFoundError extends AgentSDKError {
  constructor(backend: string) {
    super(
      `Unknown backend: "${backend}". ` +
      `Built-in: copilot, claude, vercel-ai. ` +
      `Custom: use registerBackend() first.`,
    );
    this.name = "BackendNotFoundError";
  }
}

/** Thrown when a backend is already registered */
export class BackendAlreadyRegisteredError extends AgentSDKError {
  constructor(backend: string) {
    super(`Backend "${backend}" is already registered. Use a different name or unregister first.`);
    this.name = "BackendAlreadyRegisteredError";
  }
}

/** Thrown when subprocess management fails */
export class SubprocessError extends AgentSDKError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SubprocessError";
  }
}

/** Thrown when a required peer dependency is not installed */
export class DependencyError extends AgentSDKError {
  public readonly packageName: string;

  constructor(packageName: string) {
    super(`${packageName} is not installed. Install it: npm install ${packageName}`);
    this.name = "DependencyError";
    this.packageName = packageName;
  }
}

/** Thrown when an agent run is aborted */
export class AbortError extends AgentSDKError {
  constructor() {
    super("Agent run was aborted.");
    this.name = "AbortError";
  }
}

/** Thrown when a tool execution fails */
export class ToolExecutionError extends AgentSDKError {
  public readonly toolName: string;

  constructor(toolName: string, message: string, options?: ErrorOptions) {
    super(`Tool "${toolName}" failed: ${message}`, options);
    this.name = "ToolExecutionError";
    this.toolName = toolName;
  }
}

/** Thrown when structured output parsing fails */
export class StructuredOutputError extends AgentSDKError {
  constructor(message: string, options?: ErrorOptions) {
    super(`Structured output error: ${message}`, options);
    this.name = "StructuredOutputError";
  }
}
