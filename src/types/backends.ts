/** Options for Copilot CLI backend */
export interface CopilotBackendOptions {
  cliPath?: string;
  workingDirectory?: string;
  githubToken?: string;
  useLoggedInUser?: boolean;
  /** Extra CLI arguments passed to the Copilot subprocess (e.g. ["--allow-all"]) */
  cliArgs?: string[];
  /** Timeout in milliseconds for sendAndWait() calls. When undefined, uses copilot-sdk default (60s). */
  timeout?: number;
  /** Timeout in milliseconds for CLI startup and auth check (default: 30000). */
  startupTimeoutMs?: number;
  /** Custom environment variables merged into the subprocess env */
  env?: Record<string, string | undefined>;
  /** Session ID to resume after server restart. On startup, the backend attempts
   *  to resume this session before creating a new one. */
  resumeSessionId?: string;
}

/** Options for Claude CLI backend */
export interface ClaudeBackendOptions {
  cliPath?: string;
  workingDirectory?: string;
  maxTurns?: number;
  /** OAuth token for Claude authentication (set as CLAUDE_CODE_OAUTH_TOKEN env var) */
  oauthToken?: string;
  /** Custom environment variables merged into the subprocess env */
  env?: Record<string, string | undefined>;
  /** Session ID to resume after server restart. On startup, the backend attempts
   *  to resume this session before creating a new one. */
  resumeSessionId?: string;
}

/** Options for Mock LLM backend */
export interface MockLLMBackendOptions {
  /** Response mode configuration */
  mode?: MockLLMResponseMode;
  /** Models to advertise from listModels() */
  models?: Array<{ id: string; name?: string; description?: string }>;
  /** Latency simulation — delay before each response */
  latency?: MockLLMLatency;
  /** Streaming behavior control */
  streaming?: MockLLMStreamingOptions;
  /** Override finishReason in done events (default: "stop") */
  finishReason?: string;
  /** Permission simulation for tool calls */
  permissions?: MockLLMPermissionOptions;
  /** Tool call simulation — emit tool_call_start/end events during streaming */
  toolCalls?: MockLLMToolCall[];
  /** Structured output — return specific JSON from runStructured() */
  structuredOutput?: unknown;
}

/** Response mode — determines how the mock agent generates responses */
export type MockLLMResponseMode =
  | { type: "echo" }
  | { type: "static"; response: string }
  | { type: "scripted"; responses: string[]; loop?: boolean }
  | { type: "error"; error: string; code?: string; recoverable?: boolean };

/** Latency simulation configuration */
export type MockLLMLatency =
  | { type: "fixed"; ms: number }
  | { type: "random"; minMs: number; maxMs: number };

/** Streaming chunk control */
export interface MockLLMStreamingOptions {
  /** Characters per chunk (default: word-boundary splitting) */
  chunkSize?: number;
  /** Delay in ms between chunks (default: 0) */
  chunkDelayMs?: number;
}

/** Permission simulation options */
export interface MockLLMPermissionOptions {
  /** Tool names to simulate permission requests for */
  toolNames: string[];
  /** Auto-approve all permission requests (default: false — uses supervisor callback) */
  autoApprove?: boolean;
  /** Tool names to always deny */
  denyTools?: string[];
}

/** Tool call simulation — emitted as tool_call_start/end events in stream */
export interface MockLLMToolCall {
  /** Tool name (e.g. "bash", "file_write") */
  toolName: string;
  /** Tool call arguments */
  args?: Record<string, unknown>;
  /** Tool execution result */
  result?: unknown;
  /** Tool call ID (auto-generated if not provided) */
  toolCallId?: string;
}

/** Options for Vercel AI SDK backend */
export interface VercelAIBackendOptions {
  apiKey: string;
  provider?: string;
  baseUrl?: string;
}
