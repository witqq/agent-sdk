import type { ClaudeAuthToken, OAuthFlowResult, OAuthFlowOptions } from "./types.js";
import { TokenExchangeError } from "./types.js";
import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const DEFAULT_REDIRECT_URI =
  "https://platform.claude.com/oauth/code/callback";
const DEFAULT_SCOPES =
  "user:profile user:inference user:sessions:claude_code user:mcp_servers";

/** Fetch function type for dependency injection in tests */
type FetchFn = typeof globalThis.fetch;

/** Random bytes generator for dependency injection in tests */
type RandomBytesFn = (size: number) => Uint8Array;

/**
 * Programmatic OAuth+PKCE authentication for Claude SDK.
 *
 * @example
 * ```ts
 * const auth = new ClaudeAuth();
 * const { authorizeUrl, completeAuth } = auth.startOAuthFlow({
 *   redirectUri: "https://platform.claude.com/oauth/code/callback",
 * });
 * // Open authorizeUrl in browser, get code from redirect
 * const token = await completeAuth(code);
 * // Use token with ClaudeBackendOptions: env.CLAUDE_CODE_OAUTH_TOKEN
 * ```
 */
export class ClaudeAuth {
  private readonly fetchFn: FetchFn;
  private readonly randomBytes: RandomBytesFn;

  /**
   * @param options - Optional configuration with custom fetch and random bytes for testing
   */
  constructor(options?: {
    fetch?: FetchFn;
    randomBytes?: RandomBytesFn;
  }) {
    this.fetchFn = options?.fetch ?? globalThis.fetch;
    this.randomBytes = options?.randomBytes ?? defaultRandomBytes;
  }

  /**
   * Start the Claude OAuth+PKCE flow.
   * Generates PKCE code verifier/challenge and returns an authorize URL
   * plus a `completeAuth(code)` function for token exchange.
   *
   * @param options - Redirect URI and optional scopes
   * @returns OAuth flow result with authorize URL and completeAuth function
   * @throws {AuthError} If PKCE generation fails
   *
   * @example
   * ```ts
   * const auth = new ClaudeAuth();
   * const { authorizeUrl, completeAuth } = auth.startOAuthFlow({
   *   redirectUri: "https://platform.claude.com/oauth/code/callback",
   * });
   * console.log(`Open: ${authorizeUrl}`);
   * const token = await completeAuth(authorizationCode);
   * ```
   */
  startOAuthFlow(options?: OAuthFlowOptions): OAuthFlowResult {
    const redirectUri = options?.redirectUri ?? DEFAULT_REDIRECT_URI;
    const scopes = options?.scopes ?? DEFAULT_SCOPES;

    const codeVerifier = this.generateCodeVerifier();
    const state = this.generateState();

    const authorizeUrl = this.buildAuthorizeUrl(
      redirectUri,
      scopes,
      codeVerifier,
      state,
    );

    return {
      authorizeUrl,
      completeAuth: (codeOrUrl: string) => {
        const code = ClaudeAuth.extractCode(codeOrUrl);
        return this.exchangeCode(code, codeVerifier, state, redirectUri);
      },
    };
  }

  /**
   * Extract an authorization code from user input.
   * Accepts a raw code string or a full redirect URL containing a `code` query parameter.
   *
   * @param input - Raw authorization code or redirect URL
   * @returns The extracted authorization code
   *
   * @example
   * ```ts
   * ClaudeAuth.extractCode("abc123"); // "abc123"
   * ClaudeAuth.extractCode("https://platform.claude.com/oauth/code/callback?code=abc123&state=xyz"); // "abc123"
   * ```
   */
  static extractCode(input: string): string {
    const trimmed = input.trim();
    try {
      const url = new URL(trimmed);
      const code = url.searchParams.get("code");
      if (code) return code;
    } catch {
      // Not a URL — treat as raw code
    }
    // Handle code#state format from redirect page
    const hashIdx = trimmed.indexOf("#");
    if (hashIdx > 0) {
      return trimmed.substring(0, hashIdx);
    }
    return trimmed;
  }

  /**
   * Refresh an expired Claude token.
   *
   * @param refreshToken - The refresh token from a previous authentication
   * @returns New auth token with refreshed access token
   * @throws {TokenExchangeError} If the refresh request fails
   *
   * @example
   * ```ts
   * const auth = new ClaudeAuth();
   * const newToken = await auth.refreshToken(oldToken.refreshToken);
   * ```
   */
  async refreshToken(refreshToken: string): Promise<ClaudeAuthToken> {
    const response = await this.fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new TokenExchangeError(
        `Token refresh failed: ${response.status} ${text}`,
      );
    }

    const data = (await response.json()) as TokenResponse;
    return this.mapTokenResponse(data);
  }

  private generateCodeVerifier(): string {
    const bytes = this.randomBytes(96);
    return base64Encode(bytes)
      .replace(/\+/g, "~")
      .replace(/=/g, "_")
      .replace(/\//g, "-");
  }

  private generateState(): string {
    const bytes = this.randomBytes(16);
    return hexEncode(bytes);
  }

  private buildAuthorizeUrl(
    redirectUri: string,
    scopes: string,
    codeVerifier: string,
    state: string,
  ): string {
    const codeChallenge = this.generateCodeChallengeSync(codeVerifier);

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("code", "true");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);

    return url.toString();
  }

  private generateCodeChallengeSync(verifier: string): string {
    const hash = createHash("sha256").update(verifier).digest("base64");
    return hash.split("=")[0].replace(/\+/g, "-").replace(/\//g, "_");
  }

  private async exchangeCode(
    code: string,
    codeVerifier: string,
    state: string,
    redirectUri: string,
  ): Promise<ClaudeAuthToken> {
    const response = await this.fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
        state,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new TokenExchangeError(
        `Token exchange failed: ${response.status} ${text}`,
      );
    }

    const data = (await response.json()) as TokenResponse;
    return this.mapTokenResponse(data);
  }

  private mapTokenResponse(data: TokenResponse): ClaudeAuthToken {
    return {
      accessToken: data.access_token,
      tokenType: data.token_type ?? "bearer",
      expiresIn: data.expires_in,
      obtainedAt: Date.now(),
      refreshToken: data.refresh_token,
      scopes: data.scope?.split(" ") ?? [],
    };
  }
}

// ─── Internal Types ───────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  refresh_token: string;
}

// ─── Utility Functions ────────────────────────────────────────

function defaultRandomBytes(size: number): Uint8Array {
  return new Uint8Array(nodeRandomBytes(size));
}

function base64Encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function hexEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}
