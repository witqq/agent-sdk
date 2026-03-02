import { describe, it, expect, vi, beforeEach } from "vitest";
import { CopilotAuth } from "../../src/auth/copilot-auth.js";
import {
  AuthError,
  DeviceCodeExpiredError,
  AccessDeniedError,
  TokenExchangeError,
} from "../../src/auth/types.js";
import type { CopilotAuthToken } from "../../src/auth/types.js";

// ─── Helpers ───────────────────────────────────────────────────

function mockFetch(responses: Array<{ ok: boolean; status?: number; statusText?: string; json: () => unknown }>) {
  let callIndex = 0;
  return vi.fn(async () => {
    const response = responses[callIndex];
    if (!response) throw new Error(`Unexpected fetch call #${callIndex}`);
    callIndex++;
    return response;
  }) as unknown as typeof globalThis.fetch;
}

function deviceCodeResponse(overrides?: Partial<{
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}>) {
  return {
    ok: true,
    status: 200,
    json: () => ({
      device_code: "dc_test123",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
      ...overrides,
    }),
  };
}

function pendingResponse() {
  return {
    ok: true,
    status: 200,
    json: () => ({ error: "authorization_pending" }),
  };
}

function slowDownResponse(interval?: number) {
  return {
    ok: true,
    status: 200,
    json: () => ({ error: "slow_down", interval }),
  };
}

function tokenResponse(token = "gho_testtoken123", extras?: { refresh_token?: string; expires_in?: number }) {
  return {
    ok: true,
    status: 200,
    json: () => ({
      access_token: token,
      token_type: "bearer",
      scope: "read:user,read:org,repo,gist",
      ...extras,
    }),
  };
}

function userResponse(login = "testuser") {
  return {
    ok: true,
    status: 200,
    json: () => ({ login }),
  };
}

function errorResponse(error: string, description?: string) {
  return {
    ok: true,
    status: 200,
    json: () => ({
      error,
      error_description: description,
    }),
  };
}

function httpErrorResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    json: () => ({}),
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe("CopilotAuth", () => {
  let auth: CopilotAuth;
  let fetchFn: ReturnType<typeof mockFetch>;

  describe("startDeviceFlow", () => {
    it("requests device code and returns flow result", async () => {
      fetchFn = mockFetch([deviceCodeResponse()]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();

      expect(flow.userCode).toBe("ABCD-1234");
      expect(flow.verificationUrl).toBe("https://github.com/login/device");
      expect(typeof flow.waitForToken).toBe("function");

      // Verify fetch was called with correct params
      expect(fetchFn).toHaveBeenCalledOnce();
      const [url, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://github.com/login/device/code");
      expect(options.method).toBe("POST");
      expect(options.body?.toString()).toContain("client_id=Ov23ctDVkRmgkPke0Mmm");
      expect(options.body?.toString()).toContain("scope=read%3Auser%2Cread%3Aorg%2Crepo%2Cgist");
    });

    it("allows custom scopes", async () => {
      fetchFn = mockFetch([deviceCodeResponse()]);
      auth = new CopilotAuth({ fetch: fetchFn });

      await auth.startDeviceFlow({ scopes: "read:user" });

      const [, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(options.body?.toString()).toContain("scope=read%3Auser");
    });

    it("throws AuthError on HTTP error", async () => {
      fetchFn = mockFetch([httpErrorResponse(500, "Internal Server Error")]);
      auth = new CopilotAuth({ fetch: fetchFn });

      await expect(auth.startDeviceFlow()).rejects.toThrow(AuthError);
    });

    it("throws AuthError on HTTP error with status details", async () => {
      fetchFn = mockFetch([httpErrorResponse(503, "Service Unavailable")]);
      auth = new CopilotAuth({ fetch: fetchFn });

      await expect(auth.startDeviceFlow()).rejects.toThrow(
        "Failed to request device code: 503 Service Unavailable",
      );
    });
  });

  describe("waitForToken", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("returns token after immediate success", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse(),
        tokenResponse("gho_success123"),
        userResponse("octocat"),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken();

      // Advance past the poll interval
      await vi.advanceTimersByTimeAsync(5000);

      const token = await tokenPromise;
      expect(token.accessToken).toBe("gho_success123");
      expect(token.tokenType).toBe("bearer");
      expect(token.login).toBe("octocat");
      expect(typeof token.obtainedAt).toBe("number");
    });

    it("polls through authorization_pending states", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse(),
        pendingResponse(),
        pendingResponse(),
        tokenResponse("gho_after_pending"),
        userResponse("testuser"),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken();

      // 3 polls needed (2 pending + 1 success)
      await vi.advanceTimersByTimeAsync(5000); // 1st poll (pending)
      await vi.advanceTimersByTimeAsync(5000); // 2nd poll (pending)
      await vi.advanceTimersByTimeAsync(5000); // 3rd poll (success)

      const token = await tokenPromise;
      expect(token.accessToken).toBe("gho_after_pending");
    });

    it("handles slow_down by increasing interval", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse({ interval: 5 }),
        slowDownResponse(10),
        tokenResponse("gho_slow"),
        userResponse(),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken();

      // First poll at 5s interval
      await vi.advanceTimersByTimeAsync(5000);
      // After slow_down, interval should be 10s
      await vi.advanceTimersByTimeAsync(10000);

      const token = await tokenPromise;
      expect(token.accessToken).toBe("gho_slow");
    });

    it("throws DeviceCodeExpiredError on expired_token", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse(),
        errorResponse("expired_token"),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken();
      const expectation = expect(tokenPromise).rejects.toThrow(DeviceCodeExpiredError);

      await vi.advanceTimersByTimeAsync(5000);

      await expectation;
      await expect(tokenPromise).rejects.toThrow(
        "Device code expired. Please restart the auth flow.",
      );
    });

    it("throws AccessDeniedError on access_denied", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse(),
        errorResponse("access_denied"),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken();
      const expectation = expect(tokenPromise).rejects.toThrow(AccessDeniedError);

      await vi.advanceTimersByTimeAsync(5000);

      await expectation;
      await expect(tokenPromise).rejects.toThrow("Access was denied by the user.");
    });

    it("throws AuthError with description on unknown error", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse(),
        errorResponse("bad_verification_code", "The code has already been used"),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken();
      const expectation = expect(tokenPromise).rejects.toThrow(AuthError);

      await vi.advanceTimersByTimeAsync(5000);

      await expectation;
      await expect(tokenPromise).rejects.toThrow("The code has already been used");
    });

    it("throws AuthError on poll HTTP error", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse(),
        httpErrorResponse(500, "Internal Server Error"),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken();
      const expectation = expect(tokenPromise).rejects.toThrow(AuthError);

      await vi.advanceTimersByTimeAsync(5000);

      await expectation;
      await expect(tokenPromise).rejects.toThrow("Token poll failed: 500");
    });

    it("returns token without login if user API fails", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse(),
        tokenResponse("gho_nologin"),
        httpErrorResponse(401, "Unauthorized"),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken();

      await vi.advanceTimersByTimeAsync(5000);

      const token = await tokenPromise;
      expect(token.accessToken).toBe("gho_nologin");
      expect(token.login).toBeUndefined();
    });

    it("supports abort signal", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse(),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const controller = new AbortController();
      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken(controller.signal);
      const expectation = expect(tokenPromise).rejects.toThrow("Authentication was aborted.");

      // Abort before poll completes
      controller.abort();
      await vi.advanceTimersByTimeAsync(5000);

      await expectation;
    });

    it("token has no expiresIn when not provided by GitHub", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse(),
        tokenResponse(),
        userResponse(),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken();

      await vi.advanceTimersByTimeAsync(5000);

      const token = await tokenPromise;
      expect(token.expiresIn).toBeUndefined();
      expect(token.refreshToken).toBeUndefined();
    });

    it("captures refresh_token and expires_in when provided by GitHub", async () => {
      fetchFn = mockFetch([
        deviceCodeResponse(),
        tokenResponse("gho_expiring", { refresh_token: "ghr_refresh123", expires_in: 28800 }),
        userResponse("octocat"),
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const flow = await auth.startDeviceFlow();
      const tokenPromise = flow.waitForToken();

      await vi.advanceTimersByTimeAsync(5000);

      const token = await tokenPromise;
      expect(token.accessToken).toBe("gho_expiring");
      expect(token.refreshToken).toBe("ghr_refresh123");
      expect(token.expiresIn).toBe(28800);
      expect(token.login).toBe("octocat");
    });
  });

  describe("error types", () => {
    it("DeviceCodeExpiredError is instance of AuthError", () => {
      const error = new DeviceCodeExpiredError();
      expect(error).toBeInstanceOf(AuthError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("DeviceCodeExpiredError");
    });

    it("AccessDeniedError is instance of AuthError", () => {
      const error = new AccessDeniedError();
      expect(error).toBeInstanceOf(AuthError);
      expect(error.name).toBe("AccessDeniedError");
    });
  });

  describe("constructor", () => {
    it("uses global fetch by default", () => {
      const auth = new CopilotAuth();
      expect(auth).toBeInstanceOf(CopilotAuth);
    });

    it("accepts custom fetch function", () => {
      const customFetch = vi.fn() as unknown as typeof globalThis.fetch;
      const auth = new CopilotAuth({ fetch: customFetch });
      expect(auth).toBeInstanceOf(CopilotAuth);
    });
  });

  describe("refreshToken", () => {
    it("exchanges refresh token for new access token", async () => {
      fetchFn = mockFetch([
        {
          ok: true,
          status: 200,
          json: () => ({
            access_token: "gho_new_access",
            token_type: "bearer",
            refresh_token: "ghr_new_refresh",
            expires_in: 28800,
          }),
        },
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const token = await auth.refreshToken("ghr_old_refresh");

      expect(token.accessToken).toBe("gho_new_access");
      expect(token.tokenType).toBe("bearer");
      expect(token.refreshToken).toBe("ghr_new_refresh");
      expect(token.expiresIn).toBe(28800);
      expect(typeof token.obtainedAt).toBe("number");

      // Verify correct request parameters
      const [url, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://github.com/login/oauth/access_token");
      expect(options.body?.toString()).toContain("grant_type=refresh_token");
      expect(options.body?.toString()).toContain("refresh_token=ghr_old_refresh");
      expect(options.body?.toString()).toContain("client_id=Ov23ctDVkRmgkPke0Mmm");
    });

    it("throws TokenExchangeError on HTTP error", async () => {
      fetchFn = mockFetch([httpErrorResponse(500, "Internal Server Error")]);
      auth = new CopilotAuth({ fetch: fetchFn });

      await expect(auth.refreshToken("ghr_test")).rejects.toThrow(
        "Token refresh failed: 500 Internal Server Error",
      );
    });

    it("throws TokenExchangeError on error response", async () => {
      fetchFn = mockFetch([
        {
          ok: true,
          status: 200,
          json: () => ({
            error: "invalid_grant",
            error_description: "The refresh token is invalid or expired",
          }),
        },
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      await expect(auth.refreshToken("ghr_expired")).rejects.toThrow(
        "The refresh token is invalid or expired",
      );
    });

    it("throws TokenExchangeError when response missing access_token", async () => {
      fetchFn = mockFetch([
        {
          ok: true,
          status: 200,
          json: () => ({}),
        },
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      await expect(auth.refreshToken("ghr_test")).rejects.toThrow(
        "Token refresh response missing access_token",
      );
    });

    it("handles response without refresh_token (non-rotating)", async () => {
      fetchFn = mockFetch([
        {
          ok: true,
          status: 200,
          json: () => ({
            access_token: "gho_refreshed",
            token_type: "bearer",
            expires_in: 3600,
          }),
        },
      ]);
      auth = new CopilotAuth({ fetch: fetchFn });

      const token = await auth.refreshToken("ghr_test");
      expect(token.accessToken).toBe("gho_refreshed");
      expect(token.refreshToken).toBeUndefined();
      expect(token.expiresIn).toBe(3600);
    });

    it("supports abort signal", async () => {
      const controller = new AbortController();
      controller.abort();

      fetchFn = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")) as unknown as typeof globalThis.fetch;
      auth = new CopilotAuth({ fetch: fetchFn });

      await expect(
        auth.refreshToken("ghr_test", controller.signal),
      ).rejects.toThrow();
    });
  });
});
