// ─── Auth Token Types ──────────────────────────────────────────

import { AgentSDKError } from "../errors.js";

/**
 * Base auth token returned by all auth providers.
 *
 * @example
 * ```ts
 * import type { AuthToken } from "@witqq/agent-sdk/auth";
 *
 * const token: AuthToken = {
 *   accessToken: "gho_abc123...",
 *   tokenType: "bearer",
 *   obtainedAt: Date.now(),
 * };
 * ```
 */
export interface AuthToken {
  /** The access token string */
  accessToken: string;
  /** Token type (e.g. "bearer") */
  tokenType: string;
  /** Seconds until token expires (undefined = long-lived) */
  expiresIn?: number;
  /** Timestamp when the token was obtained */
  obtainedAt: number;
}

/**
 * Copilot-specific token (GitHub OAuth, long-lived).
 *
 * @example
 * ```ts
 * import type { CopilotAuthToken } from "@witqq/agent-sdk/auth";
 *
 * const token: CopilotAuthToken = {
 *   accessToken: "gho_abc123...",
 *   tokenType: "bearer",
 *   obtainedAt: Date.now(),
 *   login: "octocat",
 * };
 * ```
 */
export interface CopilotAuthToken extends AuthToken {
  /** GitHub user login associated with the token */
  login?: string;
}

/**
 * Claude-specific token (OAuth+PKCE, expires in 8h).
 *
 * @example
 * ```ts
 * import type { ClaudeAuthToken } from "@witqq/agent-sdk/auth";
 *
 * const token: ClaudeAuthToken = {
 *   accessToken: "sk-ant-oat01-...",
 *   tokenType: "bearer",
 *   expiresIn: 28800,
 *   obtainedAt: Date.now(),
 *   refreshToken: "sk-ant-rt01-...",
 *   scopes: ["user:inference", "user:profile"],
 * };
 * ```
 */
export interface ClaudeAuthToken extends AuthToken {
  /** Refresh token for obtaining new access tokens */
  refreshToken: string;
  /** OAuth scopes granted */
  scopes: string[];
}

// ─── Device Flow Types (Copilot) ──────────────────────────────

/**
 * Result of initiating a GitHub Device Flow.
 *
 * @example
 * ```ts
 * import { CopilotAuth } from "@witqq/agent-sdk/auth";
 *
 * const auth = new CopilotAuth();
 * const { userCode, verificationUrl, waitForToken } = await auth.startDeviceFlow();
 * console.log(`Open ${verificationUrl} and enter code: ${userCode}`);
 * const token = await waitForToken();
 * ```
 */
export interface DeviceFlowResult {
  /** The code the user must enter at the verification URL */
  userCode: string;
  /** URL where the user enters the code */
  verificationUrl: string;
  /** Polls GitHub until user authorizes; resolves with token */
  waitForToken: (signal?: AbortSignal) => Promise<CopilotAuthToken>;
}

// ─── OAuth Flow Types (Claude) ────────────────────────────────

/** Options for starting a Claude OAuth flow */
export interface OAuthFlowOptions {
  /** The redirect URI registered with the OAuth app */
  redirectUri?: string;
  /** OAuth scopes to request (defaults to user:profile user:inference) */
  scopes?: string;
}

/**
 * Result of initiating a Claude OAuth flow.
 *
 * @example
 * ```ts
 * import type { OAuthFlowResult } from "@witqq/agent-sdk/auth";
 *
 * const result: OAuthFlowResult = {
 *   authorizeUrl: "https://claude.ai/oauth/authorize?...",
 *   completeAuth: async (code) => ({ ... }),
 * };
 * // Open result.authorizeUrl in browser, get code from redirect
 * const token = await result.completeAuth(code);
 * ```
 */
export interface OAuthFlowResult {
  /** URL to open in browser for user authorization */
  authorizeUrl: string;
  /** Exchange the authorization code (or full redirect URL) for tokens */
  completeAuth: (codeOrUrl: string) => Promise<ClaudeAuthToken>;
}

// ─── Auth Errors ──────────────────────────────────────────────

/** Base error for auth operations.
 * @param message - Error description
 * @param options - Standard ErrorOptions (e.g. cause)
 */
export class AuthError extends AgentSDKError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AuthError";
  }
}

/** Device code expired before user authorized */
export class DeviceCodeExpiredError extends AuthError {
  constructor() {
    super("Device code expired. Please restart the auth flow.");
    this.name = "DeviceCodeExpiredError";
  }
}

/** User denied access during OAuth flow */
export class AccessDeniedError extends AuthError {
  constructor() {
    super("Access was denied by the user.");
    this.name = "AccessDeniedError";
  }
}

/** Token exchange or refresh failed.
 * @param message - Error description
 * @param options - Standard ErrorOptions (e.g. cause)
 */
export class TokenExchangeError extends AuthError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TokenExchangeError";
  }
}
