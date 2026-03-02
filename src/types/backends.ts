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

/** Options for Vercel AI SDK backend */
export interface VercelAIBackendOptions {
  apiKey: string;
  provider?: string;
  baseUrl?: string;
}
