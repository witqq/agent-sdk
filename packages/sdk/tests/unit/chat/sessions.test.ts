import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  InMemorySessionStore,
  FileSessionStore,
  StorageError,
  type IChatSessionStore,
  type CreateSessionOptions,
} from "../../../src/chat/sessions.js";
import { ErrorCode } from "../../../src/types/errors.js";
import type { ChatMessage, ChatId } from "../../../src/chat/core.js";
import { createChatId, getMessageText } from "../../../src/chat/core.js";

// ─── Test helpers ──────────────────────────────────────────────

const defaultConfig = { model: "gpt-4", backend: "vercel-ai" };

function makeOptions(
  overrides: Partial<CreateSessionOptions> = {},
): CreateSessionOptions {
  return { config: { ...defaultConfig }, ...overrides };
}

function makeMessage(
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: createChatId(),
    role: "user",
    parts: [{ type: "text" as const, text: "Hello, world!", status: "complete" as const }],
    createdAt: new Date().toISOString(),
    status: "complete",
    ...overrides,
  };
}

// ─── Shared session store test suite ───────────────────────────

function runSessionStoreTests(
  name: string,
  factory: () => IChatSessionStore,
) {
  describe(name, () => {
    let store: IChatSessionStore;

    beforeEach(() => {
      store = factory();
    });

    // ── Create ──

    describe("createSession", () => {
      it("creates a session with defaults", async () => {
        const session = await store.createSession(makeOptions());
        expect(session.id).toBeTruthy();
        expect(session.title).toBe("Untitled");
        expect(session.messages).toEqual([]);
        expect(session.config.model).toBe("gpt-4");
        expect(session.config.backend).toBe("vercel-ai");
        expect(session.metadata.messageCount).toBe(0);
        expect(session.metadata.totalTokens).toBe(0);
        expect(session.createdAt).toBeTruthy();
        expect(session.updatedAt).toBeTruthy();
      });

      it("creates a session with custom title", async () => {
        const session = await store.createSession(
          makeOptions({ title: "My Chat" }),
        );
        expect(session.title).toBe("My Chat");
      });

      it("creates a session with tags", async () => {
        const session = await store.createSession(
          makeOptions({ tags: ["important", "work"] }),
        );
        expect(session.metadata.tags).toEqual(["important", "work"]);
      });

      it("creates a session with custom metadata", async () => {
        const session = await store.createSession(
          makeOptions({ custom: { project: "alpha" } }),
        );
        expect(session.metadata.custom).toEqual({ project: "alpha" });
      });

      it("returns a deep copy (mutations don't affect stored data)", async () => {
        const session = await store.createSession(makeOptions());
        session.title = "MUTATED";
        const retrieved = await store.getSession(session.id);
        expect(retrieved!.title).toBe("Untitled");
      });
    });

    // ── Get ──

    describe("getSession", () => {
      it("returns null for non-existent session", async () => {
        const result = await store.getSession("nonexistent" as ChatId);
        expect(result).toBeNull();
      });

      it("returns session by ID", async () => {
        const created = await store.createSession(
          makeOptions({ title: "Test" }),
        );
        const retrieved = await store.getSession(created.id);
        expect(retrieved).toBeTruthy();
        expect(retrieved!.title).toBe("Test");
        expect(retrieved!.id).toBe(created.id);
      });
    });

    // ── List ──

    describe("listSessions", () => {
      it("returns empty array when no sessions", async () => {
        const result = await store.listSessions();
        expect(result).toEqual([]);
      });

      it("lists all sessions", async () => {
        await store.createSession(makeOptions({ title: "A" }));
        await store.createSession(makeOptions({ title: "B" }));
        const result = await store.listSessions();
        expect(result).toHaveLength(2);
      });

      it("filters sessions", async () => {
        await store.createSession(makeOptions({ title: "Alpha" }));
        await store.createSession(makeOptions({ title: "Beta" }));
        const result = await store.listSessions({
          filter: (s) => s.title === "Alpha",
        });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Alpha");
      });

      it("sorts sessions", async () => {
        await store.createSession(makeOptions({ title: "B" }));
        await store.createSession(makeOptions({ title: "A" }));
        const result = await store.listSessions({
          sort: (a, b) => a.title!.localeCompare(b.title!),
        });
        expect(result[0].title).toBe("A");
        expect(result[1].title).toBe("B");
      });

      it("limits and offsets sessions", async () => {
        await store.createSession(makeOptions({ title: "A" }));
        await store.createSession(makeOptions({ title: "B" }));
        await store.createSession(makeOptions({ title: "C" }));
        const result = await store.listSessions({ limit: 1, offset: 1 });
        expect(result).toHaveLength(1);
      });
    });

    // ── Update title ──

    describe("updateTitle", () => {
      it("updates session title", async () => {
        const session = await store.createSession(makeOptions());
        await store.updateTitle(session.id, "New Title");
        const updated = await store.getSession(session.id);
        expect(updated!.title).toBe("New Title");
      });

      it("updates updatedAt timestamp", async () => {
        const session = await store.createSession(makeOptions());
        const originalUpdatedAt = session.updatedAt;
        // Small delay to ensure different timestamp
        await new Promise((r) => setTimeout(r, 5));
        await store.updateTitle(session.id, "New Title");
        const updated = await store.getSession(session.id);
        expect(updated!.updatedAt).not.toBe(originalUpdatedAt);
      });

      it("throws NOT_FOUND for non-existent session", async () => {
        try {
          await store.updateTitle("nonexistent" as ChatId, "Title");
          expect.fail("should have thrown");
        } catch (e) {
          expect(e).toBeInstanceOf(StorageError);
          expect((e as StorageError).code).toBe(ErrorCode.STORAGE_NOT_FOUND);
        }
      });
    });

    // ── Update config ──

    describe("updateConfig", () => {
      it("merges partial config", async () => {
        const session = await store.createSession(makeOptions());
        await store.updateConfig(session.id, { temperature: 0.7 });
        const updated = await store.getSession(session.id);
        expect(updated!.config.model).toBe("gpt-4");
        expect(updated!.config.temperature).toBe(0.7);
      });

      it("overwrites existing config field", async () => {
        const session = await store.createSession(makeOptions());
        await store.updateConfig(session.id, { model: "gpt-3.5" });
        const updated = await store.getSession(session.id);
        expect(updated!.config.model).toBe("gpt-3.5");
      });

      it("throws NOT_FOUND for non-existent session", async () => {
        try {
          await store.updateConfig("nonexistent" as ChatId, { model: "x" });
          expect.fail("should have thrown");
        } catch (e) {
          expect(e).toBeInstanceOf(StorageError);
          expect((e as StorageError).code).toBe(ErrorCode.STORAGE_NOT_FOUND);
        }
      });
    });

    // ── Delete ──

    describe("deleteSession", () => {
      it("deletes a session", async () => {
        const session = await store.createSession(makeOptions());
        await store.deleteSession(session.id);
        const result = await store.getSession(session.id);
        expect(result).toBeNull();
      });

      it("throws NOT_FOUND for non-existent session", async () => {
        try {
          await store.deleteSession("nonexistent" as ChatId);
          expect.fail("should have thrown");
        } catch (e) {
          expect(e).toBeInstanceOf(StorageError);
          expect((e as StorageError).code).toBe(ErrorCode.STORAGE_NOT_FOUND);
        }
      });
    });

    // ── Append message ──

    describe("appendMessage", () => {
      it("adds a message to session", async () => {
        const session = await store.createSession(makeOptions());
        const msg = makeMessage({ parts: [{ type: "text" as const, text: "Hi", status: "complete" as const }] });
        await store.appendMessage(session.id, msg);
        const updated = await store.getSession(session.id);
        expect(updated!.messages).toHaveLength(1);
        expect(getMessageText(updated!.messages[0])).toBe("Hi");
      });

      it("updates messageCount metadata", async () => {
        const session = await store.createSession(makeOptions());
        await store.appendMessage(session.id, makeMessage());
        await store.appendMessage(session.id, makeMessage());
        const updated = await store.getSession(session.id);
        expect(updated!.metadata.messageCount).toBe(2);
      });

      it("updates updatedAt timestamp", async () => {
        const session = await store.createSession(makeOptions());
        const originalUpdatedAt = session.updatedAt;
        await new Promise((r) => setTimeout(r, 5));
        await store.appendMessage(session.id, makeMessage());
        const updated = await store.getSession(session.id);
        expect(updated!.updatedAt).not.toBe(originalUpdatedAt);
      });

      it("stores a deep copy of the message", async () => {
        const session = await store.createSession(makeOptions());
        const msg = makeMessage({ parts: [{ type: "text" as const, text: "Original", status: "complete" as const }] });
        await store.appendMessage(session.id, msg);
        (msg.parts[0] as { text: string }).text = "MUTATED";
        const updated = await store.getSession(session.id);
        expect(getMessageText(updated!.messages[0])).toBe("Original");
      });

      it("throws NOT_FOUND for non-existent session", async () => {
        try {
          await store.appendMessage("nonexistent" as ChatId, makeMessage());
          expect.fail("should have thrown");
        } catch (e) {
          expect(e).toBeInstanceOf(StorageError);
          expect((e as StorageError).code).toBe(ErrorCode.STORAGE_NOT_FOUND);
        }
      });
    });

    // ── Load messages (paginated) ──

    describe("loadMessages", () => {
      it("returns all messages by default", async () => {
        const session = await store.createSession(makeOptions());
        await store.appendMessage(session.id, makeMessage({ parts: [{ type: "text" as const, text: "A", status: "complete" as const }] }));
        await store.appendMessage(session.id, makeMessage({ parts: [{ type: "text" as const, text: "B", status: "complete" as const }] }));
        const result = await store.loadMessages(session.id);
        expect(result.messages).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.hasMore).toBe(false);
      });

      it("paginates with limit and offset", async () => {
        const session = await store.createSession(makeOptions());
        for (let i = 0; i < 5; i++) {
          await store.appendMessage(
            session.id,
            makeMessage({ parts: [{ type: "text" as const, text: `Msg ${i}`, status: "complete" as const }] }),
          );
        }

        const page1 = await store.loadMessages(session.id, {
          limit: 2,
          offset: 0,
        });
        expect(page1.messages).toHaveLength(2);
        expect(page1.total).toBe(5);
        expect(page1.hasMore).toBe(true);
        expect(getMessageText(page1.messages[0])).toBe("Msg 0");

        const page2 = await store.loadMessages(session.id, {
          limit: 2,
          offset: 2,
        });
        expect(page2.messages).toHaveLength(2);
        expect(page2.hasMore).toBe(true);
        expect(getMessageText(page2.messages[0])).toBe("Msg 2");

        const page3 = await store.loadMessages(session.id, {
          limit: 2,
          offset: 4,
        });
        expect(page3.messages).toHaveLength(1);
        expect(page3.hasMore).toBe(false);
      });

      it("returns deep copies of messages", async () => {
        const session = await store.createSession(makeOptions());
        await store.appendMessage(
          session.id,
          makeMessage({ parts: [{ type: "text" as const, text: "Original", status: "complete" as const }] }),
        );
        const result = await store.loadMessages(session.id);
        (result.messages[0].parts[0] as { text: string }).text = "MUTATED";
        const fresh = await store.loadMessages(session.id);
        expect(getMessageText(fresh.messages[0])).toBe("Original");
      });

      it("throws NOT_FOUND for non-existent session", async () => {
        try {
          await store.loadMessages("nonexistent" as ChatId);
          expect.fail("should have thrown");
        } catch (e) {
          expect(e).toBeInstanceOf(StorageError);
          expect((e as StorageError).code).toBe(ErrorCode.STORAGE_NOT_FOUND);
        }
      });
    });

    // ── Search ──

    describe("searchSessions", () => {
      it("searches by title", async () => {
        await store.createSession(makeOptions({ title: "Python Project" }));
        await store.createSession(makeOptions({ title: "JavaScript Work" }));
        const result = await store.searchSessions({ query: "python" });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Python Project");
      });

      it("searches by message content", async () => {
        const s1 = await store.createSession(makeOptions({ title: "Chat A" }));
        const s2 = await store.createSession(makeOptions({ title: "Chat B" }));
        await store.appendMessage(
          s1.id,
          makeMessage({ parts: [{ type: "text" as const, text: "Discuss TypeScript generics", status: "complete" as const }] }),
        );
        await store.appendMessage(
          s2.id,
          makeMessage({ parts: [{ type: "text" as const, text: "Plan vacation trip", status: "complete" as const }] }),
        );
        const result = await store.searchSessions({ query: "typescript" });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Chat A");
      });

      it("is case-insensitive", async () => {
        await store.createSession(makeOptions({ title: "UPPERCASE" }));
        const result = await store.searchSessions({ query: "uppercase" });
        expect(result).toHaveLength(1);
      });

      it("returns empty array for no matches", async () => {
        await store.createSession(makeOptions({ title: "Something" }));
        const result = await store.searchSessions({
          query: "nonexistent-query",
        });
        expect(result).toEqual([]);
      });

      it("respects limit", async () => {
        for (let i = 0; i < 5; i++) {
          await store.createSession(makeOptions({ title: `Match ${i}` }));
        }
        const result = await store.searchSessions({
          query: "match",
          limit: 2,
        });
        expect(result).toHaveLength(2);
      });
    });

    // ── appendMessage ──

    describe("appendMessage", () => {
      it("appends a message (same behavior as appendMessage)", async () => {
        const session = await store.createSession(makeOptions());
        const msg = makeMessage();
        await store.appendMessage(session.id, msg);
        const page = await store.loadMessages(session.id);
        expect(page.messages).toHaveLength(1);
        expect(page.messages[0].id).toBe(msg.id);
      });

      it("throws NOT_FOUND for nonexistent session", async () => {
        await expect(
          store.appendMessage("nonexistent" as ChatId, makeMessage()),
        ).rejects.toThrow("not found");
      });
    });

    // ── saveMessages (bulk) ──

    describe("saveMessages", () => {
      it("appends multiple messages at once", async () => {
        const session = await store.createSession(makeOptions());
        const msgs = [makeMessage(), makeMessage(), makeMessage()];
        await store.saveMessages(session.id, msgs);
        const page = await store.loadMessages(session.id);
        expect(page.messages).toHaveLength(3);
        expect(page.total).toBe(3);
      });

      it("no-op with empty array", async () => {
        const session = await store.createSession(makeOptions());
        await store.saveMessages(session.id, []);
        const page = await store.loadMessages(session.id);
        expect(page.messages).toHaveLength(0);
      });

      it("updates messageCount metadata", async () => {
        const session = await store.createSession(makeOptions());
        await store.saveMessages(session.id, [makeMessage(), makeMessage()]);
        const updated = await store.getSession(session.id);
        expect(updated!.metadata.messageCount).toBe(2);
      });

      it("throws NOT_FOUND for nonexistent session", async () => {
        await expect(
          store.saveMessages("nonexistent" as ChatId, [makeMessage()]),
        ).rejects.toThrow("not found");
      });
    });

    // ── loadMessages ──

    describe("loadMessages", () => {
      it("returns paginated messages (same behavior as loadMessages)", async () => {
        const session = await store.createSession(makeOptions());
        await store.appendMessage(session.id, makeMessage());
        await store.appendMessage(session.id, makeMessage());
        const page = await store.loadMessages(session.id, { limit: 1, offset: 0 });
        expect(page.messages).toHaveLength(1);
        expect(page.hasMore).toBe(true);
        expect(page.total).toBe(2);
      });
    });

    // ── Deprecated aliases ──

    describe("deprecated aliases", () => {
      it("appendMessage works", async () => {
        const session = await store.createSession(makeOptions());
        await store.appendMessage(session.id, makeMessage());
        const page = await store.loadMessages(session.id);
        expect(page.messages).toHaveLength(1);
      });

      it("loadMessages works", async () => {
        const session = await store.createSession(makeOptions());
        await store.appendMessage(session.id, makeMessage());
        const page = await store.loadMessages(session.id);
        expect(page.messages).toHaveLength(1);
      });
    });

    // ── Count / Clear ──

    describe("count and clear", () => {
      it("counts sessions", async () => {
        expect(await store.count()).toBe(0);
        await store.createSession(makeOptions());
        await store.createSession(makeOptions());
        expect(await store.count()).toBe(2);
      });

      it("clears all sessions", async () => {
        await store.createSession(makeOptions());
        await store.createSession(makeOptions());
        await store.clear();
        expect(await store.count()).toBe(0);
      });
    });
  });
}

// ─── Run shared tests for InMemorySessionStore ─────────────────

runSessionStoreTests(
  "InMemorySessionStore",
  () => new InMemorySessionStore(),
);

// ─── Run shared tests for FileSessionStore ─────────────────────

describe("FileSessionStore", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "chat-sdk-sessions-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  runSessionStoreTests(
    "FileSessionStore (shared suite)",
    () => new FileSessionStore({ directory: tempDir }),
  );

  // ── FileSessionStore-specific tests ──

  it("persists sessions across store instances", async () => {
    const store1 = new FileSessionStore({ directory: tempDir });
    const session = await store1.createSession({
      config: { model: "gpt-4", backend: "vercel-ai" },
      title: "Persistent",
    });

    const store2 = new FileSessionStore({ directory: tempDir });
    const retrieved = await store2.getSession(session.id);
    expect(retrieved).toBeTruthy();
    expect(retrieved!.title).toBe("Persistent");
  });

  it("persists messages across store instances", async () => {
    const store1 = new FileSessionStore({ directory: tempDir });
    const session = await store1.createSession({
      config: { model: "gpt-4", backend: "vercel-ai" },
    });
    await store1.appendMessage(
      session.id,
      makeMessage({ parts: [{ type: "text" as const, text: "Persisted message", status: "complete" as const }] }),
    );

    const store2 = new FileSessionStore({ directory: tempDir });
    const result = await store2.loadMessages(session.id);
    expect(result.messages).toHaveLength(1);
    expect(getMessageText(result.messages[0])).toBe("Persisted message");
  });
});
