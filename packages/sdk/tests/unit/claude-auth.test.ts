import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import { ClaudeAuth } from "../../src/auth/claude-auth.js";
import { TokenExchangeError } from "../../src/auth/types.js";

// ─── Test Helpers ────────────────────────────────────────────

/** Create deterministic random bytes for PKCE testing */
function createDeterministicRandomBytes(seed: number) {
  return (size: number): Uint8Array => {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = (seed + i) % 256;
    }
    return bytes;
  };
}

/** Compute expected PKCE code verifier from deterministic bytes */
function expectedCodeVerifier(seed: number): string {
  const bytes = new Uint8Array(96);
  for (let i = 0; i < 96; i++) bytes[i] = (seed + i) % 256;
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "~")
    .replace(/=/g, "_")
    .replace(/\//g, "-");
}

/** Compute expected code challenge from verifier */
function expectedCodeChallenge(verifier: string): string {
  return createHash("sha256")
    .update(verifier)
    .digest("base64")
    .split("=")[0]
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createMockFetch(responses: Array<{ ok: boolean; status?: number; body?: unknown; text?: string }>) {
  let callIndex = 0;
  return vi.fn(async () => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1];
    return {
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 400),
      statusText: resp.ok ? "OK" : "Bad Request",
      json: async () => resp.body,
      text: async () => resp.text ?? JSON.stringify(resp.body),
    } as unknown as Response;
  });
}

// ─── Tests ───────────────────────────────────────────────────

describe("ClaudeAuth", () => {
  const SEED = 42;
  let mockFetch: ReturnType<typeof createMockFetch>;
  let auth: ClaudeAuth;

  // Track randomBytes calls to handle verifier (96 bytes) then state (16 bytes)
  let randomBytesCallIndex: number;

  function createAuth(fetchResponses: Parameters<typeof createMockFetch>[0] = []) {
    randomBytesCallIndex = 0;
    mockFetch = createMockFetch(fetchResponses);
    auth = new ClaudeAuth({
      fetch: mockFetch as unknown as typeof globalThis.fetch,
      randomBytes: (size: number) => {
        const callSeed = randomBytesCallIndex === 0 ? SEED : SEED + 100;
        randomBytesCallIndex++;
        const bytes = new Uint8Array(size);
        for (let i = 0; i < size; i++) bytes[i] = (callSeed + i) % 256;
        return bytes;
      },
    });
    return auth;
  }

  describe("constructor", () => {
    it("creates instance with default options", () => {
      const auth = new ClaudeAuth();
      expect(auth).toBeInstanceOf(ClaudeAuth);
    });

    it("accepts custom fetch and randomBytes", () => {
      const auth = new ClaudeAuth({
        fetch: vi.fn() as unknown as typeof globalThis.fetch,
        randomBytes: () => new Uint8Array(0),
      });
      expect(auth).toBeInstanceOf(ClaudeAuth);
    });
  });

  describe("startOAuthFlow", () => {
    beforeEach(() => {
      createAuth();
    });

    it("returns authorizeUrl and completeAuth function", () => {
      const result = auth.startOAuthFlow();
      expect(result.authorizeUrl).toContain("https://claude.ai/oauth/authorize");
      expect(typeof result.completeAuth).toBe("function");
    });

    it("uses claude.ai authorize endpoint (not platform.claude.com)", () => {
      const result = auth.startOAuthFlow();
      expect(result.authorizeUrl).toMatch(/^https:\/\/claude\.ai\/oauth\/authorize/);
      expect(result.authorizeUrl).not.toContain("platform.claude.com/oauth/authorize");
    });

    it("includes correct query parameters", () => {
      const result = auth.startOAuthFlow();
      const url = new URL(result.authorizeUrl);

      expect(url.searchParams.get("client_id")).toBe("9d1c250a-e61b-44d9-88ed-5944d1962f5e");
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("code")).toBe("true");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("scope")).toContain("user:inference");
    });

    it("uses default redirect URI when not specified", () => {
      const result = auth.startOAuthFlow();
      const url = new URL(result.authorizeUrl);
      expect(url.searchParams.get("redirect_uri")).toBe(
        "https://platform.claude.com/oauth/code/callback",
      );
    });

    it("uses custom redirect URI when specified", () => {
      const result = auth.startOAuthFlow({
        redirectUri: "http://localhost:3000/callback",
      });
      const url = new URL(result.authorizeUrl);
      expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/callback");
    });

    it("uses custom scopes when specified", () => {
      const result = auth.startOAuthFlow({
        scopes: "user:profile org:create_api_key",
      });
      const url = new URL(result.authorizeUrl);
      expect(url.searchParams.get("scope")).toBe("user:profile org:create_api_key");
    });

    it("includes default scopes with user:inference", () => {
      const result = auth.startOAuthFlow();
      const url = new URL(result.authorizeUrl);
      const scopes = url.searchParams.get("scope")!;
      expect(scopes).toContain("user:inference");
      expect(scopes).toContain("user:profile");
    });
  });

  describe("PKCE generation", () => {
    it("generates code verifier with correct char replacements", () => {
      createAuth();
      const result = auth.startOAuthFlow();
      const url = new URL(result.authorizeUrl);
      // Verifier is internal but affects the challenge in the URL
      const challenge = url.searchParams.get("code_challenge")!;
      expect(challenge).toBeTruthy();
      expect(challenge).not.toContain("+");
      expect(challenge).not.toContain("/");
      expect(challenge).not.toContain("=");
    });

    it("generates deterministic PKCE with seeded randomBytes", () => {
      createAuth();
      const result1 = auth.startOAuthFlow();
      const url1 = new URL(result1.authorizeUrl);

      createAuth(); // Reset with same seed
      const result2 = auth.startOAuthFlow();
      const url2 = new URL(result2.authorizeUrl);

      expect(url1.searchParams.get("code_challenge")).toBe(
        url2.searchParams.get("code_challenge"),
      );
      expect(url1.searchParams.get("state")).toBe(url2.searchParams.get("state"));
    });

    it("code challenge matches SHA256 of verifier", () => {
      const verifier = expectedCodeVerifier(SEED);
      const expected = expectedCodeChallenge(verifier);

      createAuth();
      const result = auth.startOAuthFlow();
      const url = new URL(result.authorizeUrl);
      expect(url.searchParams.get("code_challenge")).toBe(expected);
    });

    it("state is hex-encoded random bytes", () => {
      createAuth();
      const result = auth.startOAuthFlow();
      const url = new URL(result.authorizeUrl);
      const state = url.searchParams.get("state")!;
      // Should be 32 hex chars (16 bytes)
      expect(state).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe("completeAuth (token exchange)", () => {
    const tokenResponse = {
      access_token: "sk-ant-oat01-test-token",
      token_type: "bearer",
      expires_in: 28800,
      scope: "user:profile user:inference",
      refresh_token: "sk-ant-rt01-test-refresh",
    };

    it("exchanges code for token successfully", async () => {
      createAuth([{ ok: true, body: tokenResponse }]);
      const { completeAuth } = auth.startOAuthFlow();
      const token = await completeAuth("test-auth-code");

      expect(token.accessToken).toBe("sk-ant-oat01-test-token");
      expect(token.tokenType).toBe("bearer");
      expect(token.expiresIn).toBe(28800);
      expect(token.refreshToken).toBe("sk-ant-rt01-test-refresh");
      expect(token.scopes).toEqual(["user:profile", "user:inference"]);
      expect(token.obtainedAt).toBeGreaterThan(0);
    });

    it("sends correct exchange parameters", async () => {
      createAuth([{ ok: true, body: tokenResponse }]);
      const { completeAuth } = auth.startOAuthFlow();
      await completeAuth("my-code");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://platform.claude.com/v1/oauth/token");
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options.body);
      expect(body.grant_type).toBe("authorization_code");
      expect(body.code).toBe("my-code");
      expect(body.client_id).toBe("9d1c250a-e61b-44d9-88ed-5944d1962f5e");
      expect(body.redirect_uri).toBe("https://platform.claude.com/oauth/code/callback");
      expect(body.code_verifier).toBeTruthy();
      expect(body.state).toBeTruthy();
    });

    it("throws TokenExchangeError on failure", async () => {
      createAuth([{ ok: false, status: 400, text: "invalid_grant" }]);
      const { completeAuth } = auth.startOAuthFlow();

      await expect(completeAuth("bad-code")).rejects.toThrow(TokenExchangeError);
      await expect(
        createAuth([{ ok: false, status: 400, text: "invalid_grant" }]).startOAuthFlow().completeAuth("x"),
      ).rejects.toThrow("Token exchange failed: 400");
    });

    it("uses custom redirect URI in exchange", async () => {
      createAuth([{ ok: true, body: tokenResponse }]);
      const { completeAuth } = auth.startOAuthFlow({
        redirectUri: "http://localhost:8080/cb",
      });
      await completeAuth("code");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.redirect_uri).toBe("http://localhost:8080/cb");
    });

    it("handles missing scope in response", async () => {
      createAuth([{
        ok: true,
        body: { ...tokenResponse, scope: undefined },
      }]);
      const { completeAuth } = auth.startOAuthFlow();
      const token = await completeAuth("code");
      expect(token.scopes).toEqual([]);
    });

    it("handles missing token_type in response", async () => {
      createAuth([{
        ok: true,
        body: { ...tokenResponse, token_type: undefined },
      }]);
      const { completeAuth } = auth.startOAuthFlow();
      const token = await completeAuth("code");
      expect(token.tokenType).toBe("bearer");
    });
  });

  describe("refreshToken", () => {
    const refreshResponse = {
      access_token: "sk-ant-oat01-refreshed-token",
      token_type: "bearer",
      expires_in: 28800,
      scope: "user:profile user:inference",
      refresh_token: "sk-ant-rt01-new-refresh",
    };

    it("refreshes token successfully", async () => {
      createAuth([{ ok: true, body: refreshResponse }]);
      const token = await auth.refreshToken("sk-ant-rt01-old-refresh");

      expect(token.accessToken).toBe("sk-ant-oat01-refreshed-token");
      expect(token.refreshToken).toBe("sk-ant-rt01-new-refresh");
      expect(token.expiresIn).toBe(28800);
    });

    it("sends correct refresh parameters", async () => {
      createAuth([{ ok: true, body: refreshResponse }]);
      await auth.refreshToken("my-refresh-token");

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://platform.claude.com/v1/oauth/token");
      const body = JSON.parse(options.body);
      expect(body.grant_type).toBe("refresh_token");
      expect(body.refresh_token).toBe("my-refresh-token");
      expect(body.client_id).toBe("9d1c250a-e61b-44d9-88ed-5944d1962f5e");
    });

    it("throws TokenExchangeError on refresh failure", async () => {
      createAuth([{ ok: false, status: 401, text: "invalid_refresh_token" }]);
      await expect(auth.refreshToken("bad-token")).rejects.toThrow(TokenExchangeError);
      await expect(
        createAuth([{ ok: false, status: 401, text: "invalid_refresh_token" }]).refreshToken("x"),
      ).rejects.toThrow("Token refresh failed: 401");
    });
  });

  describe("extractCode", () => {
    it("returns raw code string as-is", () => {
      expect(ClaudeAuth.extractCode("abc123")).toBe("abc123");
    });

    it("extracts code from redirect URL", () => {
      const url = "https://platform.claude.com/oauth/code/callback?code=test-code-123&state=abc";
      expect(ClaudeAuth.extractCode(url)).toBe("test-code-123");
    });

    it("extracts code from URL with encoded characters", () => {
      const url = "https://platform.claude.com/oauth/code/callback?code=code%20with%20spaces&state=s";
      expect(ClaudeAuth.extractCode(url)).toBe("code with spaces");
    });

    it("returns trimmed input when URL has no code param", () => {
      const url = "https://example.com/callback?state=abc";
      expect(ClaudeAuth.extractCode(url)).toBe(url);
    });

    it("trims whitespace from input", () => {
      expect(ClaudeAuth.extractCode("  abc123  \n")).toBe("abc123");
    });

    it("strips state suffix from code#state format", () => {
      expect(
        ClaudeAuth.extractCode(
          "8QQy1A3moAAvHAIDyibY9h9fdxWhRzPUAruH0xtOY1qBWHJR#98b3ed98dc780283da2760caf5ada20f",
        ),
      ).toBe("8QQy1A3moAAvHAIDyibY9h9fdxWhRzPUAruH0xtOY1qBWHJR");
    });
  });

  describe("completeAuth with URL input", () => {
    const tokenResponse = {
      access_token: "sk-ant-oat01-test-token",
      token_type: "bearer",
      expires_in: 28800,
      scope: "user:profile user:inference",
      refresh_token: "sk-ant-rt01-test-refresh",
    };

    it("auto-extracts code from redirect URL", async () => {
      createAuth([{ ok: true, body: tokenResponse }]);
      const { completeAuth } = auth.startOAuthFlow();
      const url = "https://platform.claude.com/oauth/code/callback?code=extracted-code&state=xyz";
      await completeAuth(url);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.code).toBe("extracted-code");
    });

    it("auto-strips state from code#state format", async () => {
      createAuth([{ ok: true, body: tokenResponse }]);
      const { completeAuth } = auth.startOAuthFlow();
      await completeAuth("REAL_CODE_HERE#deadbeef12345678");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.code).toBe("REAL_CODE_HERE");
    });
  });
});
