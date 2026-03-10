import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileTokenStore } from "../../../src/chat/server/token-store.js";
import type { AuthToken } from "../../../src/auth/types.js";

const TEST_DIR = join(tmpdir(), `agent-sdk-token-test-${process.pid}`);

function makeToken(overrides: Partial<AuthToken> = {}): AuthToken {
  return {
    accessToken: "test-access-token",
    expiresAt: Date.now() + 3600_000,
    ...overrides,
  };
}

describe("FileTokenStore", () => {
  let store: FileTokenStore;

  beforeEach(() => {
    // Clean slate for each test
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    store = new FileTokenStore({ directory: TEST_DIR });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  // ─── save + load ────────────────────────────────────────────

  it("saves and loads a token", async () => {
    const token = makeToken();
    await store.save("copilot", token);
    const loaded = await store.load("copilot");
    expect(loaded).toEqual(token);
  });

  it("creates directory if it does not exist", async () => {
    const nested = join(TEST_DIR, "a", "b", "c");
    const nestedStore = new FileTokenStore({ directory: nested });
    await nestedStore.save("test", makeToken());
    expect(existsSync(nested)).toBe(true);
  });

  it("overwrites existing token on save", async () => {
    await store.save("copilot", makeToken({ accessToken: "old" }));
    await store.save("copilot", makeToken({ accessToken: "new" }));
    const loaded = await store.load("copilot");
    expect(loaded?.accessToken).toBe("new");
  });

  it("returns null for non-existent provider", async () => {
    const loaded = await store.load("nonexistent");
    expect(loaded).toBeNull();
  });

  it("stores multiple providers independently", async () => {
    await store.save("copilot", makeToken({ accessToken: "a" }));
    await store.save("claude", makeToken({ accessToken: "b" }));
    await store.save("vercel", makeToken({ accessToken: "c" }));

    expect((await store.load("copilot"))?.accessToken).toBe("a");
    expect((await store.load("claude"))?.accessToken).toBe("b");
    expect((await store.load("vercel"))?.accessToken).toBe("c");
  });

  // ─── clear ──────────────────────────────────────────────────

  it("clears a specific provider token", async () => {
    await store.save("copilot", makeToken());
    await store.clear("copilot");
    expect(await store.load("copilot")).toBeNull();
  });

  it("clear on non-existent provider does not throw", async () => {
    await expect(store.clear("nonexistent")).resolves.toBeUndefined();
  });

  // ─── clearAll ───────────────────────────────────────────────

  it("clears all tokens", async () => {
    await store.save("copilot", makeToken());
    await store.save("claude", makeToken());
    await store.clearAll();
    expect(await store.load("copilot")).toBeNull();
    expect(await store.load("claude")).toBeNull();
  });

  it("clearAll on non-existent directory does not throw", async () => {
    const missing = new FileTokenStore({ directory: join(TEST_DIR, "missing") });
    await expect(missing.clearAll()).resolves.toBeUndefined();
  });

  // ─── list ───────────────────────────────────────────────────

  it("lists saved providers", async () => {
    await store.save("copilot", makeToken());
    await store.save("claude", makeToken());
    const providers = await store.list();
    expect(providers.sort()).toEqual(["claude", "copilot"]);
  });

  it("list returns empty for non-existent directory", async () => {
    const missing = new FileTokenStore({ directory: join(TEST_DIR, "missing") });
    expect(await missing.list()).toEqual([]);
  });

  it("list excludes non-token files", async () => {
    await store.save("copilot", makeToken());
    // Create a file that doesn't match the token pattern
    writeFileSync(join(TEST_DIR, "other.json"), "{}");
    const providers = await store.list();
    expect(providers).toEqual(["copilot"]);
  });

  // ─── Corrupt data ──────────────────────────────────────────

  it("returns null for corrupt JSON file", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, "corrupt-token.json"), "not-json{{{");
    expect(await store.load("corrupt")).toBeNull();
  });

  it("returns null for empty file", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, "empty-token.json"), "");
    expect(await store.load("empty")).toBeNull();
  });

  // ─── Token with optional fields ─────────────────────────────

  it("preserves refreshToken and other optional fields", async () => {
    const token = makeToken({ refreshToken: "refresh-123" });
    await store.save("provider", token);
    const loaded = await store.load("provider");
    expect(loaded?.refreshToken).toBe("refresh-123");
  });
});
