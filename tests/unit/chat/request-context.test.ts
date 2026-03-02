import { describe, it, expect, beforeEach } from "vitest";
import { resolveRequestContext } from "../../../src/chat/server/request-context.js";
import { InMemoryProviderStore } from "../../../src/chat/server/provider-store.js";
import { InMemoryTokenStore } from "../../../src/chat/server/token-store.js";
import { ChatError } from "../../../src/chat/errors.js";
import { ErrorCode } from "../../../src/types/errors.js";
import type { ProviderConfig } from "../../../src/chat/provider-types.js";
import type { AuthToken } from "../../../src/auth/types.js";

describe("resolveRequestContext", () => {
  let providerStore: InMemoryProviderStore;
  let tokenStore: InMemoryTokenStore;

  const testProvider: ProviderConfig = {
    id: "my-copilot",
    backend: "copilot",
    model: "gpt-5-mini",
    label: "Copilot GPT-5 Mini",
    createdAt: Date.now(),
  };

  const testToken: AuthToken = {
    accessToken: "ghp_test_token_123",
    tokenType: "bearer",
    obtainedAt: Date.now(),
  };

  beforeEach(() => {
    providerStore = new InMemoryProviderStore();
    tokenStore = new InMemoryTokenStore();
  });

  it("resolves providerId to full RequestContext", async () => {
    await providerStore.create(testProvider);
    await tokenStore.save("copilot", testToken);

    const ctx = await resolveRequestContext("my-copilot", {
      providerStore,
      tokenStore,
    });

    expect(ctx.backend).toBe("copilot");
    expect(ctx.credentials.accessToken).toBe("ghp_test_token_123");
    expect(ctx.model).toBe("gpt-5-mini");
    expect(ctx.provider.id).toBe("my-copilot");
  });

  it("throws PROVIDER_NOT_FOUND for unknown providerId", async () => {
    try {
      await resolveRequestContext("nonexistent", {
        providerStore,
        tokenStore,
      });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ChatError);
      expect((error as ChatError).code).toBe(ErrorCode.PROVIDER_NOT_FOUND);
      expect((error as ChatError).message).toContain("nonexistent");
    }
  });

  it("throws AUTH_REQUIRED when no token for backend", async () => {
    await providerStore.create(testProvider);
    // No token saved for "copilot"

    try {
      await resolveRequestContext("my-copilot", {
        providerStore,
        tokenStore,
      });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ChatError);
      expect((error as ChatError).code).toBe(ErrorCode.AUTH_REQUIRED);
      expect((error as ChatError).message).toContain("copilot");
    }
  });

  it("resolves different backends correctly", async () => {
    const claudeProvider: ProviderConfig = {
      id: "my-claude",
      backend: "claude",
      model: "claude-sonnet-4-5",
      label: "Claude Sonnet",
      createdAt: Date.now(),
    };
    const claudeToken: AuthToken = {
      accessToken: "sk-ant-test",
      tokenType: "bearer",
      obtainedAt: Date.now(),
    };

    await providerStore.create(claudeProvider);
    await tokenStore.save("claude", claudeToken);

    const ctx = await resolveRequestContext("my-claude", {
      providerStore,
      tokenStore,
    });

    expect(ctx.backend).toBe("claude");
    expect(ctx.credentials.accessToken).toBe("sk-ant-test");
    expect(ctx.model).toBe("claude-sonnet-4-5");
  });

  it("returns provider reference in context", async () => {
    await providerStore.create(testProvider);
    await tokenStore.save("copilot", testToken);

    const ctx = await resolveRequestContext("my-copilot", {
      providerStore,
      tokenStore,
    });

    expect(ctx.provider).toMatchObject({
      id: "my-copilot",
      backend: "copilot",
      model: "gpt-5-mini",
      label: "Copilot GPT-5 Mini",
    });
  });

  it("PROVIDER_NOT_FOUND is not retryable", async () => {
    try {
      await resolveRequestContext("missing", { providerStore, tokenStore });
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as ChatError).retryable).toBe(false);
    }
  });

  it("AUTH_REQUIRED is not retryable", async () => {
    await providerStore.create(testProvider);

    try {
      await resolveRequestContext("my-copilot", { providerStore, tokenStore });
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as ChatError).retryable).toBe(false);
    }
  });
});
