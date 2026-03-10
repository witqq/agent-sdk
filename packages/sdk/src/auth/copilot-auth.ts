import type { CopilotAuthToken, DeviceFlowResult } from "./types.js";
import {
  AuthError,
  DeviceCodeExpiredError,
  AccessDeniedError,
  TokenExchangeError,
} from "./types.js";

const CLIENT_ID = "Ov23ctDVkRmgkPke0Mmm";
const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_API_URL = "https://api.github.com/user";
const DEFAULT_SCOPES = "read:user,read:org,repo,gist";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenPollResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  interval?: number;
}

interface GitHubUser {
  login: string;
}

/** Fetch function type for dependency injection in tests */
type FetchFn = typeof globalThis.fetch;

/**
 * Programmatic GitHub Device Flow authentication for Copilot SDK.
 *
 * @example
 * ```ts
 * const auth = new CopilotAuth();
 * const flow = await auth.startDeviceFlow();
 * console.log(`Open ${flow.verificationUrl} and enter ${flow.userCode}`);
 * const token = await flow.waitForToken();
 * // Use token.accessToken with CopilotBackendOptions.githubToken
 * ```
 */
export class CopilotAuth {
  private readonly fetchFn: FetchFn;

  /** @param options - Optional configuration with custom fetch for testing */
  constructor(options?: { fetch?: FetchFn }) {
    this.fetchFn = options?.fetch ?? globalThis.fetch;
  }

  /**
   * Start the GitHub Device Flow.
   * Returns a device code result with user code, verification URL,
   * and a `waitForToken()` function that polls until the user authorizes.
   *
   * @param options - Optional scopes and abort signal
   * @returns Device flow result with user code, verification URL, and waitForToken poller
   * @throws {AuthError} If the device code request fails
   * @throws {DeviceCodeExpiredError} If the device code expires before user authorizes
   * @throws {AccessDeniedError} If the user denies access
   *
   * @example
   * ```ts
   * const auth = new CopilotAuth();
   * const { userCode, verificationUrl, waitForToken } = await auth.startDeviceFlow();
   * console.log(`Open ${verificationUrl} and enter code: ${userCode}`);
   * const token = await waitForToken();
   * ```
   */
  async startDeviceFlow(options?: {
    scopes?: string;
    signal?: AbortSignal;
  }): Promise<DeviceFlowResult> {
    const scopes = options?.scopes ?? DEFAULT_SCOPES;
    const response = await this.fetchFn(DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        scope: scopes,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new AuthError(
        `Failed to request device code: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as DeviceCodeResponse;

    return {
      userCode: data.user_code,
      verificationUrl: data.verification_uri,
      waitForToken: (signal?: AbortSignal) =>
        this.pollForToken(data.device_code, data.interval, signal),
    };
  }

  private async pollForToken(
    deviceCode: string,
    interval: number,
    signal?: AbortSignal,
  ): Promise<CopilotAuthToken> {
    let pollIntervalMs = interval * 1000;

    while (true) {
      if (signal?.aborted) {
        throw new AuthError("Authentication was aborted.");
      }

      await this.delay(pollIntervalMs, signal);

      const response = await this.fetchFn(ACCESS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          device_code: deviceCode,
          grant_type: GRANT_TYPE,
        }),
        signal,
      });

      if (!response.ok) {
        throw new AuthError(
          `Token poll failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as TokenPollResponse;

      if (data.access_token) {
        const token: CopilotAuthToken = {
          accessToken: data.access_token,
          tokenType: data.token_type ?? "bearer",
          obtainedAt: Date.now(),
        };

        if (data.refresh_token) {
          token.refreshToken = data.refresh_token;
        }
        if (data.expires_in) {
          token.expiresIn = data.expires_in;
        }

        // Try to fetch user login
        try {
          const login = await this.fetchUserLogin(data.access_token, signal);
          if (login) token.login = login;
        } catch {
          // Non-critical: login is optional
        }

        return token;
      }

      if (data.error === "authorization_pending") {
        continue;
      }

      if (data.error === "slow_down") {
        pollIntervalMs = (data.interval ?? interval + 5) * 1000;
        continue;
      }

      if (data.error === "expired_token") {
        throw new DeviceCodeExpiredError();
      }

      if (data.error === "access_denied") {
        throw new AccessDeniedError();
      }

      throw new AuthError(
        data.error_description ?? `Unexpected error: ${data.error}`,
      );
    }
  }

  private async fetchUserLogin(
    token: string,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    const response = await this.fetchFn(USER_API_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) return undefined;

    const user = (await response.json()) as GitHubUser;
    return user.login;
  }

  /**
   * Refresh an expired Copilot token using a refresh token.
   * Only works for GitHub App tokens that include a refresh_token.
   *
   * @param refreshToken - The refresh token from the original auth flow
   * @param signal - Optional abort signal
   * @returns Fresh CopilotAuthToken with new access and refresh tokens
   * @throws {TokenExchangeError} If the refresh request fails
   *
   * @example
   * ```ts
   * const auth = new CopilotAuth();
   * const newToken = await auth.refreshToken(oldToken.refreshToken!);
   * ```
   */
  async refreshToken(
    refreshToken: string,
    signal?: AbortSignal,
  ): Promise<CopilotAuthToken> {
    const response = await this.fetchFn(ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      signal,
    });

    if (!response.ok) {
      throw new TokenExchangeError(
        `Token refresh failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as TokenPollResponse;

    if (data.error) {
      throw new TokenExchangeError(
        data.error_description ?? `Token refresh error: ${data.error}`,
      );
    }

    if (!data.access_token) {
      throw new TokenExchangeError("Token refresh response missing access_token");
    }

    const token: CopilotAuthToken = {
      accessToken: data.access_token,
      tokenType: data.token_type ?? "bearer",
      obtainedAt: Date.now(),
    };

    if (data.refresh_token) {
      token.refreshToken = data.refresh_token;
    }
    if (data.expires_in) {
      token.expiresIn = data.expires_in;
    }

    return token;
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new AuthError("Authentication was aborted."));
        },
        { once: true },
      );
    });
  }
}
