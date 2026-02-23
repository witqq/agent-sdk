/**
 * Tests for SQLite and Drizzle session store examples.
 *
 * Both adapters run against in-memory SQLite — no external DB needed.
 * Tests verify the full IChatSessionStore contract: CRUD, pagination,
 * search, archive, error handling.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SQLiteSessionStore } from "../../../examples/sqlite-storage/sqlite-session-store.js";
import { DrizzleSessionStore } from "../../../examples/drizzle-storage/drizzle-session-store.js";
import type { IChatSessionStore } from "../../../src/chat/sessions.js";
import type { ChatMessage, ChatId } from "../../../src/chat/core.js";
import { createChatId } from "../../../src/chat/core.js";


function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: createChatId(),
    role: "user",
    parts: [{ type: "text", text: "Hello world", status: "complete" }],
    status: "complete",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Shared test suite exercising IChatSessionStore contract.
 * Called once per adapter implementation.
 */
function sessionStoreTests(name: string, factory: () => IChatSessionStore) {
  describe(`${name} — IChatSessionStore`, () => {
    let store: IChatSessionStore;

    beforeEach(() => {
      store = factory();
    });

    // ── Session CRUD ──────────────────────────────────────────

    it("should create a session with defaults", async () => {
      const session = await store.createSession({});
      expect(session.id).toBeTruthy();
      expect(session.status).toBe("active");
      expect(session.messages).toEqual([]);
      expect(session.metadata.messageCount).toBe(0);
      expect(session.config.model).toBe("default");
    });

    it("should create a session with title and config", async () => {
      const session = await store.createSession({
        title: "Test Chat",
        config: { model: "gpt-4", backend: "vercel-ai" },
      });
      expect(session.title).toBe("Test Chat");
      expect(session.config.model).toBe("gpt-4");
      expect(session.config.backend).toBe("vercel-ai");
    });

    it("should get session by id", async () => {
      const created = await store.createSession({ title: "Find Me" });
      const found = await store.getSession(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe("Find Me");
    });

    it("should return null for non-existent session", async () => {
      const result = await store.getSession(createChatId());
      expect(result).toBeNull();
    });

    it("should list sessions", async () => {
      await store.createSession({ title: "A" });
      await store.createSession({ title: "B" });
      const list = await store.listSessions();
      expect(list).toHaveLength(2);
    });

    it("should list sessions with limit and offset", async () => {
      for (let i = 0; i < 5; i++) {
        await store.createSession({ title: `S${i}` });
      }
      const page = await store.listSessions({ limit: 2, offset: 1 });
      expect(page).toHaveLength(2);
    });

    it("should update session title", async () => {
      const session = await store.createSession({ title: "Old" });
      await store.updateTitle(session.id, "New");
      const updated = await store.getSession(session.id);
      expect(updated!.title).toBe("New");
    });

    it("should throw NOT_FOUND when updating title of non-existent session", async () => {
      await expect(store.updateTitle(createChatId(), "X"))
        .rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("should update session config", async () => {
      const session = await store.createSession({ config: { model: "gpt-4", backend: "vercel-ai" } });
      await store.updateConfig(session.id, { model: "gpt-5" });
      const updated = await store.getSession(session.id);
      expect(updated!.config.model).toBe("gpt-5");
      expect(updated!.config.backend).toBe("vercel-ai"); // preserved
    });

    it("should delete session", async () => {
      const session = await store.createSession({});
      await store.deleteSession(session.id);
      const found = await store.getSession(session.id);
      expect(found).toBeNull();
    });

    it("should throw NOT_FOUND when deleting non-existent session", async () => {
      await expect(store.deleteSession(createChatId()))
        .rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    // ── Messages ──────────────────────────────────────────────

    it("should append and load messages", async () => {
      const session = await store.createSession({});
      const msg = makeMessage();
      await store.appendMessage(session.id, msg);

      const page = await store.loadMessages(session.id);
      expect(page.messages).toHaveLength(1);
      expect(page.messages[0].id).toBe(msg.id);
      expect(page.total).toBe(1);
      expect(page.hasMore).toBe(false);
    });

    it("should preserve message parts through serialization", async () => {
      const session = await store.createSession({});
      const msg = makeMessage({
        parts: [
          { type: "text", text: "Hello", status: "complete" },
          { type: "tool_call", toolCallId: "tc1", toolName: "search", args: { q: "test" }, status: "complete" },
        ],
      });
      await store.appendMessage(session.id, msg);

      const page = await store.loadMessages(session.id);
      expect(page.messages[0].parts).toHaveLength(2);
      expect(page.messages[0].parts[0].type).toBe("text");
      expect(page.messages[0].parts[1].type).toBe("tool_call");
    });

    it("should preserve message metadata through serialization", async () => {
      const session = await store.createSession({});
      const msg = makeMessage({ metadata: { model: "gpt-4", custom: { key: "value" } } });
      await store.appendMessage(session.id, msg);

      const page = await store.loadMessages(session.id);
      expect((page.messages[0].metadata as Record<string, unknown>).model).toBe("gpt-4");
    });

    it("should paginate messages", async () => {
      const session = await store.createSession({});
      for (let i = 0; i < 10; i++) {
        await store.appendMessage(session.id, makeMessage({
          parts: [{ type: "text", text: `Message ${i}`, status: "complete" }],
        }));
      }

      const page1 = await store.loadMessages(session.id, { limit: 3, offset: 0 });
      expect(page1.messages).toHaveLength(3);
      expect(page1.total).toBe(10);
      expect(page1.hasMore).toBe(true);

      const page2 = await store.loadMessages(session.id, { limit: 3, offset: 9 });
      expect(page2.messages).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it("should maintain message ordering", async () => {
      const session = await store.createSession({});
      const msgs = ["first", "second", "third"].map((text) =>
        makeMessage({ parts: [{ type: "text", text, status: "complete" }] }),
      );
      for (const msg of msgs) {
        await store.appendMessage(session.id, msg);
      }

      const page = await store.loadMessages(session.id);
      expect(page.messages.map((m) => (m.parts[0] as { text: string }).text)).toEqual(["first", "second", "third"]);
    });

    it("should save multiple messages in bulk", async () => {
      const session = await store.createSession({});
      const msgs = [makeMessage(), makeMessage(), makeMessage()];
      await store.saveMessages(session.id, msgs);

      const page = await store.loadMessages(session.id);
      expect(page.messages).toHaveLength(3);
      expect(page.total).toBe(3);
    });

    it("should no-op for empty saveMessages", async () => {
      const session = await store.createSession({});
      await store.saveMessages(session.id, []);
      const page = await store.loadMessages(session.id);
      expect(page.messages).toHaveLength(0);
    });

    it("should throw NOT_FOUND when appending to non-existent session", async () => {
      await expect(store.appendMessage(createChatId(), makeMessage()))
        .rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("should throw NOT_FOUND when loading messages from non-existent session", async () => {
      await expect(store.loadMessages(createChatId()))
        .rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("should update message count after append", async () => {
      const session = await store.createSession({});
      await store.appendMessage(session.id, makeMessage());
      await store.appendMessage(session.id, makeMessage());

      const updated = await store.getSession(session.id);
      expect(updated!.metadata.messageCount).toBe(2);
    });

    // ── Archive ───────────────────────────────────────────────

    it("should archive and unarchive session", async () => {
      const session = await store.createSession({});
      expect(session.status).toBe("active");

      await store.archiveSession(session.id);
      const archived = await store.getSession(session.id);
      expect(archived!.status).toBe("archived");

      await store.unarchiveSession(session.id);
      const active = await store.getSession(session.id);
      expect(active!.status).toBe("active");
    });

    it("should throw NOT_FOUND when archiving non-existent session", async () => {
      await expect(store.archiveSession(createChatId()))
        .rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    // ── Search ────────────────────────────────────────────────

    it("should search sessions by title", async () => {
      await store.createSession({ title: "Python Tutorial" });
      await store.createSession({ title: "JavaScript Guide" });
      await store.createSession({ title: "Rust Basics" });

      const results = await store.searchSessions({ query: "python" });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Python Tutorial");
    });

    it("should search sessions by message content", async () => {
      const s1 = await store.createSession({ title: "Chat 1" });
      const s2 = await store.createSession({ title: "Chat 2" });

      await store.appendMessage(s1.id, makeMessage({
        parts: [{ type: "text", text: "How to use SQLite?", status: "complete" }],
      }));
      await store.appendMessage(s2.id, makeMessage({
        parts: [{ type: "text", text: "Regular topic", status: "complete" }],
      }));

      const results = await store.searchSessions({ query: "SQLite" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((s) => s.id === s1.id)).toBe(true);
    });

    // ── Count & Clear ─────────────────────────────────────────

    it("should count sessions", async () => {
      expect(await store.count()).toBe(0);
      await store.createSession({});
      await store.createSession({});
      expect(await store.count()).toBe(2);
    });

    it("should clear all sessions", async () => {
      await store.createSession({});
      await store.createSession({});
      await store.clear();
      expect(await store.count()).toBe(0);
    });

    // ── getSession loads messages ─────────────────────────────

    it("should load messages when getting session", async () => {
      const session = await store.createSession({});
      await store.appendMessage(session.id, makeMessage());
      await store.appendMessage(session.id, makeMessage());

      const loaded = await store.getSession(session.id);
      expect(loaded!.messages).toHaveLength(2);
    });

    // ── Deprecated aliases ────────────────────────────────────

    it("should support deprecated addMessage alias", async () => {
      const session = await store.createSession({});
      await store.addMessage(session.id, makeMessage());
      const page = await store.loadMessages(session.id);
      expect(page.messages).toHaveLength(1);
    });

    it("should support deprecated getMessages alias", async () => {
      const session = await store.createSession({});
      await store.appendMessage(session.id, makeMessage());
      const page = await store.getMessages(session.id);
      expect(page.messages).toHaveLength(1);
    });
  });
}

// ── Run for both adapters ──────────────────────────────────────

sessionStoreTests("SQLiteSessionStore", () => {
  const db = new Database(":memory:");
  return new SQLiteSessionStore(db);
});

sessionStoreTests("DrizzleSessionStore", () => {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);
  return new DrizzleSessionStore(db);
});
