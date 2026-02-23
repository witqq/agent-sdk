import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  InMemoryStorage,
  FileStorage,
  StorageError,
  type IStorageAdapter,
  type ListOptions,
  type StorageErrorCode,
  type FileStorageOptions,
} from "../../../src/chat/storage.js";

// ─── Test data type ────────────────────────────────────────────

interface TestItem {
  name: string;
  value: number;
}

// ─── Shared test suite for any IStorageAdapter ─────────────────

function runStorageAdapterTests(
  name: string,
  createAdapter: () => IStorageAdapter<TestItem>,
) {
  describe(name, () => {
    let adapter: IStorageAdapter<TestItem>;

    beforeEach(() => {
      adapter = createAdapter();
    });

    // ── create ──

    describe("create", () => {
      it("stores an item by key", async () => {
        await adapter.create("k1", { name: "Alice", value: 1 });
        const item = await adapter.get("k1");
        expect(item).toEqual({ name: "Alice", value: 1 });
      });

      it("throws DUPLICATE_KEY when key already exists", async () => {
        await adapter.create("k1", { name: "Alice", value: 1 });
        await expect(
          adapter.create("k1", { name: "Bob", value: 2 }),
        ).rejects.toThrow(StorageError);

        try {
          await adapter.create("k1", { name: "Bob", value: 2 });
        } catch (e) {
          expect(e).toBeInstanceOf(StorageError);
          expect((e as StorageError).code).toBe("DUPLICATE_KEY");
        }
      });
    });

    // ── get ──

    describe("get", () => {
      it("returns null for missing key", async () => {
        const item = await adapter.get("nonexistent");
        expect(item).toBeNull();
      });

      it("returns a deep copy (mutations don't affect storage)", async () => {
        await adapter.create("k1", { name: "Alice", value: 1 });
        const item = await adapter.get("k1");
        item!.name = "MUTATED";
        const fresh = await adapter.get("k1");
        expect(fresh!.name).toBe("Alice");
      });

      it("stores a deep copy (mutating original doesn't affect stored data)", async () => {
        const original = { name: "Alice", value: 1 };
        await adapter.create("k1", original);
        original.name = "MUTATED";
        const stored = await adapter.get("k1");
        expect(stored!.name).toBe("Alice");
      });
    });

    // ── update ──

    describe("update", () => {
      it("updates an existing item", async () => {
        await adapter.create("k1", { name: "Alice", value: 1 });
        await adapter.update("k1", { name: "Alice", value: 99 });
        const item = await adapter.get("k1");
        expect(item).toEqual({ name: "Alice", value: 99 });
      });

      it("throws NOT_FOUND when key missing", async () => {
        await expect(
          adapter.update("missing", { name: "X", value: 0 }),
        ).rejects.toThrow(StorageError);

        try {
          await adapter.update("missing", { name: "X", value: 0 });
        } catch (e) {
          expect((e as StorageError).code).toBe("NOT_FOUND");
        }
      });
    });

    // ── delete ──

    describe("delete", () => {
      it("removes an existing item", async () => {
        await adapter.create("k1", { name: "Alice", value: 1 });
        await adapter.delete("k1");
        const item = await adapter.get("k1");
        expect(item).toBeNull();
      });

      it("throws NOT_FOUND when key missing", async () => {
        await expect(adapter.delete("missing")).rejects.toThrow(StorageError);

        try {
          await adapter.delete("missing");
        } catch (e) {
          expect((e as StorageError).code).toBe("NOT_FOUND");
        }
      });
    });

    // ── has ──

    describe("has", () => {
      it("returns false for missing key", async () => {
        expect(await adapter.has("nope")).toBe(false);
      });

      it("returns true for existing key", async () => {
        await adapter.create("k1", { name: "A", value: 1 });
        expect(await adapter.has("k1")).toBe(true);
      });

      it("returns false after deletion", async () => {
        await adapter.create("k1", { name: "A", value: 1 });
        await adapter.delete("k1");
        expect(await adapter.has("k1")).toBe(false);
      });
    });

    // ── count ──

    describe("count", () => {
      it("returns 0 when empty", async () => {
        expect(await adapter.count()).toBe(0);
      });

      it("reflects number of stored items", async () => {
        await adapter.create("k1", { name: "A", value: 1 });
        await adapter.create("k2", { name: "B", value: 2 });
        expect(await adapter.count()).toBe(2);
      });

      it("decreases after deletion", async () => {
        await adapter.create("k1", { name: "A", value: 1 });
        await adapter.create("k2", { name: "B", value: 2 });
        await adapter.delete("k1");
        expect(await adapter.count()).toBe(1);
      });
    });

    // ── clear ──

    describe("clear", () => {
      it("removes all items", async () => {
        await adapter.create("k1", { name: "A", value: 1 });
        await adapter.create("k2", { name: "B", value: 2 });
        await adapter.clear();
        expect(await adapter.count()).toBe(0);
        expect(await adapter.get("k1")).toBeNull();
      });

      it("works on empty storage", async () => {
        await adapter.clear();
        expect(await adapter.count()).toBe(0);
      });
    });

    // ── list ──

    describe("list", () => {
      beforeEach(async () => {
        await adapter.create("k1", { name: "Charlie", value: 3 });
        await adapter.create("k2", { name: "Alice", value: 1 });
        await adapter.create("k3", { name: "Bob", value: 2 });
      });

      it("returns all items when no options", async () => {
        const items = await adapter.list();
        expect(items).toHaveLength(3);
      });

      it("filters items by predicate", async () => {
        const items = await adapter.list({
          filter: (i) => i.value > 1,
        });
        expect(items).toHaveLength(2);
        expect(items.every((i) => i.value > 1)).toBe(true);
      });

      it("sorts items by comparator", async () => {
        const items = await adapter.list({
          sort: (a, b) => a.name.localeCompare(b.name),
        });
        expect(items.map((i) => i.name)).toEqual([
          "Alice",
          "Bob",
          "Charlie",
        ]);
      });

      it("paginates with offset and limit", async () => {
        const items = await adapter.list({
          sort: (a, b) => a.value - b.value,
          offset: 1,
          limit: 1,
        });
        expect(items).toHaveLength(1);
        expect(items[0].name).toBe("Bob");
      });

      it("returns empty array when filter matches nothing", async () => {
        const items = await adapter.list({
          filter: (i) => i.value > 100,
        });
        expect(items).toEqual([]);
      });

      it("returns empty array when storage is empty", async () => {
        await adapter.clear();
        const items = await adapter.list();
        expect(items).toEqual([]);
      });

      it("combines filter and sort", async () => {
        const items = await adapter.list({
          filter: (i) => i.value >= 2,
          sort: (a, b) => b.value - a.value,
        });
        expect(items.map((i) => i.name)).toEqual(["Charlie", "Bob"]);
      });
    });
  });
}

// ─── Run shared tests for InMemoryStorage ──────────────────────

runStorageAdapterTests("InMemoryStorage", () => new InMemoryStorage<TestItem>());

// ─── Run shared tests for FileStorage ──────────────────────────

describe("FileStorage", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "chat-sdk-storage-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  runStorageAdapterTests(
    "FileStorage (shared CRUD)",
    () => new FileStorage<TestItem>({ directory: tempDir }),
  );

  // ── FileStorage-specific tests ──

  it("creates directory if it doesn't exist", async () => {
    const nestedDir = join(tempDir, "nested", "deep", "dir");
    const store = new FileStorage<TestItem>({ directory: nestedDir });
    await store.create("k1", { name: "A", value: 1 });
    const item = await store.get("k1");
    expect(item).toEqual({ name: "A", value: 1 });
  });

  it("uses custom extension", async () => {
    const store = new FileStorage<TestItem>({
      directory: tempDir,
      extension: ".dat",
    });
    await store.create("k1", { name: "A", value: 1 });
    const item = await store.get("k1");
    expect(item).toEqual({ name: "A", value: 1 });
    expect(await store.count()).toBe(1);
  });

  it("sanitizes key characters for file name without collisions", async () => {
    const store = new FileStorage<TestItem>({ directory: tempDir });
    await store.create("key/with:special chars!", { name: "A", value: 1 });
    const item = await store.get("key/with:special chars!");
    expect(item).toEqual({ name: "A", value: 1 });
  });

  it("handles keys with special characters without collisions", async () => {
    const store = new FileStorage<TestItem>({ directory: tempDir });
    await store.create("key/a", { name: "slash", value: 1 });
    await store.create("key_a", { name: "underscore", value: 2 });
    expect(await store.get("key/a")).toEqual({ name: "slash", value: 1 });
    expect(await store.get("key_a")).toEqual({ name: "underscore", value: 2 });
    expect(await store.count()).toBe(2);
  });

  it("throws SERIALIZATION_ERROR for corrupted JSON file", async () => {
    const store = new FileStorage<TestItem>({ directory: tempDir });
    writeFileSync(join(tempDir, "bad-key.json"), "not valid json{{{", "utf-8");
    try {
      await store.get("bad-key");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(StorageError);
      expect((e as StorageError).code).toBe("SERIALIZATION_ERROR");
    }
  });
});

// ─── StorageError tests ────────────────────────────────────────

describe("StorageError", () => {
  it("has correct name and code", () => {
    const err = new StorageError("test msg", "NOT_FOUND");
    expect(err.name).toBe("StorageError");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("test msg");
  });

  it("is instanceof Error", () => {
    const err = new StorageError("fail", "IO_ERROR");
    expect(err).toBeInstanceOf(Error);
  });

  it("supports all error codes", () => {
    const codes: StorageErrorCode[] = [
      "NOT_FOUND",
      "DUPLICATE_KEY",
      "IO_ERROR",
      "SERIALIZATION_ERROR",
    ];
    for (const code of codes) {
      const err = new StorageError("msg", code);
      expect(err.code).toBe(code);
    }
  });
});

// ─── Type exports test ─────────────────────────────────────────

describe("type exports", () => {
  it("exports all expected types", () => {
    expect(InMemoryStorage).toBeDefined();
    expect(FileStorage).toBeDefined();
    expect(StorageError).toBeDefined();
  });

  it("InMemoryStorage implements IStorageAdapter interface", () => {
    const store: IStorageAdapter<TestItem> = new InMemoryStorage<TestItem>();
    expect(store.get).toBeDefined();
    expect(store.list).toBeDefined();
    expect(store.create).toBeDefined();
    expect(store.update).toBeDefined();
    expect(store.delete).toBeDefined();
    expect(store.has).toBeDefined();
    expect(store.count).toBeDefined();
    expect(store.clear).toBeDefined();
  });
});
