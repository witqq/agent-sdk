/**
 * Tests for provider store implementations (InMemoryProviderStore, FileProviderStore).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { InMemoryProviderStore, FileProviderStore } from "../../../src/chat/server/provider-store.js";
import type { ProviderConfig } from "../../../src/chat/provider-types.js";

const TEST_DIR = join(tmpdir(), `agent-sdk-provider-test-${process.pid}`);

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "test-id",
    backend: "copilot",
    model: "gpt-5-mini",
    label: "Copilot GPT-5 mini",
    createdAt: Date.now(),
    ...overrides,
  };
}

// ─── InMemoryProviderStore ─────────────────────────────────────

describe("InMemoryProviderStore", () => {
  let store: InMemoryProviderStore;

  beforeEach(() => {
    store = new InMemoryProviderStore();
  });

  it("creates and gets a provider", async () => {
    const provider = makeProvider();
    await store.create(provider);
    const loaded = await store.get("test-id");
    expect(loaded).toEqual(provider);
  });

  it("get returns null for nonexistent provider", async () => {
    const loaded = await store.get("nonexistent");
    expect(loaded).toBeNull();
  });

  it("shallow clones on read", async () => {
    const provider = makeProvider();
    await store.create(provider);
    const a = await store.get("test-id");
    const b = await store.get("test-id");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("updates an existing provider", async () => {
    await store.create(makeProvider());
    await store.update("test-id", { label: "Updated Label", model: "gpt-4.1" });
    const loaded = await store.get("test-id");
    expect(loaded!.label).toBe("Updated Label");
    expect(loaded!.model).toBe("gpt-4.1");
    // id and createdAt unchanged
    expect(loaded!.id).toBe("test-id");
  });

  it("update throws for nonexistent provider", async () => {
    await expect(store.update("missing", { label: "X" })).rejects.toThrow('Provider "missing" not found');
  });

  it("deletes a provider", async () => {
    await store.create(makeProvider());
    await store.delete("test-id");
    expect(await store.get("test-id")).toBeNull();
  });

  it("delete on nonexistent does not throw", async () => {
    await expect(store.delete("nonexistent")).resolves.toBeUndefined();
  });

  it("lists all providers", async () => {
    await store.create(makeProvider({ id: "p1", label: "A" }));
    await store.create(makeProvider({ id: "p2", label: "B" }));
    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list.map(p => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("list returns empty when no providers", async () => {
    const list = await store.list();
    expect(list).toEqual([]);
  });

  it("generates UUID if id is empty", async () => {
    await store.create(makeProvider({ id: "" }));
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBeTruthy();
    expect(list[0].id).not.toBe("");
  });
});

// ─── FileProviderStore ─────────────────────────────────────────

describe("FileProviderStore", () => {
  let store: FileProviderStore;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    store = new FileProviderStore({ directory: TEST_DIR });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it("creates and gets a provider", async () => {
    const provider = makeProvider();
    await store.create(provider);
    const loaded = await store.get("test-id");
    expect(loaded).toEqual(provider);
  });

  it("creates directory if it does not exist", async () => {
    const nested = join(TEST_DIR, "a", "b");
    const nestedStore = new FileProviderStore({ directory: nested });
    await nestedStore.create(makeProvider());
    expect(existsSync(nested)).toBe(true);
  });

  it("get returns null for nonexistent provider", async () => {
    const loaded = await store.get("nonexistent");
    expect(loaded).toBeNull();
  });

  it("updates an existing provider", async () => {
    await store.create(makeProvider());
    await store.update("test-id", { label: "Updated", backend: "claude" });
    const loaded = await store.get("test-id");
    expect(loaded!.label).toBe("Updated");
    expect(loaded!.backend).toBe("claude");
    expect(loaded!.id).toBe("test-id");
  });

  it("update throws for nonexistent provider", async () => {
    await expect(store.update("missing", { label: "X" })).rejects.toThrow('Provider "missing" not found');
  });

  it("deletes a provider", async () => {
    await store.create(makeProvider());
    await store.delete("test-id");
    expect(await store.get("test-id")).toBeNull();
  });

  it("delete on nonexistent does not throw", async () => {
    await expect(store.delete("nonexistent")).resolves.toBeUndefined();
  });

  it("lists all providers", async () => {
    await store.create(makeProvider({ id: "p1" }));
    await store.create(makeProvider({ id: "p2" }));
    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list.map(p => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("list returns empty for nonexistent directory", async () => {
    const missing = new FileProviderStore({ directory: join(TEST_DIR, "missing") });
    expect(await missing.list()).toEqual([]);
  });

  it("list excludes non-provider files", async () => {
    await store.create(makeProvider());
    writeFileSync(join(TEST_DIR, "other.json"), "{}");
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("test-id");
  });

  it("returns null for corrupt JSON file", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, "corrupt-provider.json"), "not-json{{{");
    expect(await store.get("corrupt")).toBeNull();
  });
});
