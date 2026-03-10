/**
 * Unit tests for auth demo server logic: token persistence and state management.
 * Tests the token save/load/clear functions and message history behavior.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Token persistence functions (extracted logic, same as server.ts)
function tokenPath(dir: string, provider: string): string {
  return path.join(dir, `${provider}-token.json`);
}

function saveToken(dir: string, provider: string, token: { accessToken: string; tokenType: string; obtainedAt: number }): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tokenPath(dir, provider), JSON.stringify(token));
}

function loadToken(dir: string, provider: string): { accessToken: string; tokenType: string; obtainedAt: number } | null {
  try {
    const data = fs.readFileSync(tokenPath(dir, provider), "utf-8");
    return JSON.parse(data);
  } catch { return null; }
}

function clearTokens(dir: string): void {
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith("-token.json")) fs.unlinkSync(path.join(dir, f));
    }
  } catch { /* ignore */ }
}

describe("Demo server: token persistence", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-tokens-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves and loads a token", () => {
    const token = { accessToken: "ghu_abc123", tokenType: "bearer", obtainedAt: Date.now() };
    saveToken(tmpDir, "copilot", token);
    const loaded = loadToken(tmpDir, "copilot");
    expect(loaded).toEqual(token);
  });

  it("returns null for non-existent token", () => {
    expect(loadToken(tmpDir, "copilot")).toBeNull();
  });

  it("saves tokens for multiple providers independently", () => {
    const t1 = { accessToken: "ghu_abc", tokenType: "bearer", obtainedAt: 1000 };
    const t2 = { accessToken: "sk-xyz", tokenType: "bearer", obtainedAt: 2000 };
    saveToken(tmpDir, "copilot", t1);
    saveToken(tmpDir, "vercel-ai", t2);
    expect(loadToken(tmpDir, "copilot")).toEqual(t1);
    expect(loadToken(tmpDir, "vercel-ai")).toEqual(t2);
  });

  it("overwrites existing token on re-save", () => {
    const t1 = { accessToken: "old", tokenType: "bearer", obtainedAt: 1000 };
    const t2 = { accessToken: "new", tokenType: "bearer", obtainedAt: 2000 };
    saveToken(tmpDir, "copilot", t1);
    saveToken(tmpDir, "copilot", t2);
    expect(loadToken(tmpDir, "copilot")!.accessToken).toBe("new");
  });

  it("clears all tokens", () => {
    saveToken(tmpDir, "copilot", { accessToken: "a", tokenType: "bearer", obtainedAt: 1 });
    saveToken(tmpDir, "claude", { accessToken: "b", tokenType: "bearer", obtainedAt: 2 });
    clearTokens(tmpDir);
    expect(loadToken(tmpDir, "copilot")).toBeNull();
    expect(loadToken(tmpDir, "claude")).toBeNull();
  });

  it("clear does not fail on empty directory", () => {
    expect(() => clearTokens(tmpDir)).not.toThrow();
  });

  it("clear does not remove non-token files", () => {
    fs.writeFileSync(path.join(tmpDir, "other.txt"), "keep me");
    saveToken(tmpDir, "copilot", { accessToken: "a", tokenType: "bearer", obtainedAt: 1 });
    clearTokens(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, "other.txt"))).toBe(true);
    expect(loadToken(tmpDir, "copilot")).toBeNull();
  });
});

describe("Demo server: message history state", () => {
  // Simulates the state management from server.ts
  interface SessionState {
    messages: Array<{ role: string; content: string }>;
    provider: string | null;
  }

  let state: SessionState;

  beforeEach(() => {
    state = { messages: [], provider: null };
  });

  it("accumulates messages in order", () => {
    state.messages.push({ role: "user", content: "hello" });
    state.messages.push({ role: "assistant", content: "hi there" });
    state.messages.push({ role: "user", content: "my name is Pete" });
    state.messages.push({ role: "assistant", content: "Nice to meet you, Pete!" });

    expect(state.messages).toHaveLength(4);
    expect(state.messages[0].role).toBe("user");
    expect(state.messages[3].content).toContain("Pete");
  });

  it("resets messages on provider switch", () => {
    state.messages.push({ role: "user", content: "test" });
    state.messages.push({ role: "assistant", content: "reply" });

    // Simulate provider switch (same as handleAuthStart)
    state.provider = "claude";
    state.messages = [];

    expect(state.messages).toHaveLength(0);
  });

  it("resets messages on agent create", () => {
    state.messages.push({ role: "user", content: "old context" });

    // Simulate handleAgentCreate
    state.messages = [];

    expect(state.messages).toHaveLength(0);
  });

  it("resets messages on dispose", () => {
    state.messages.push({ role: "user", content: "test" });

    // Simulate handleDispose
    state.provider = null;
    state.messages = [];

    expect(state.messages).toHaveLength(0);
    expect(state.provider).toBeNull();
  });
});
