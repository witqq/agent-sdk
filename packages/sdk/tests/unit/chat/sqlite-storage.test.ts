/**
 * Tests for SQLite storage module — session store, provider store, token store, and factory.
 *
 * All tests run against in-memory SQLite databases.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SQLiteSessionStore } from "../../../src/chat/sqlite/session-store.js";
import { SQLiteProviderStore } from "../../../src/chat/sqlite/provider-store.js";
import { SQLiteTokenStore } from "../../../src/chat/sqlite/token-store.js";
import { createSQLiteStorage } from "../../../src/chat/sqlite/factory.js";
import type { ChatMessage, ChatId } from "../../../src/chat/core.js";
import { createChatId } from "../../../src/chat/core.js";
import type { ProviderConfig } from "../../../src/chat/provider-types.js";
import type { AuthToken } from "../../../src/auth/types.js";

// ─── Helpers ───────────────────────────────────────────────────

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

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: crypto.randomUUID(),
    backend: "copilot",
    model: "gpt-5-mini",
    label: "Test Provider",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeToken(overrides: Partial<AuthToken> = {}): AuthToken {
  return {
    accessToken: "test-token-" + Math.random().toString(36).slice(2),
    tokenType: "bearer",
    obtainedAt: Date.now(),
    ...overrides,
  } as AuthToken;
}

// ─── SQLiteSessionStore ────────────────────────────────────────

describe("SQLiteSessionStore", () => {
  let db: Database.Database;
  let store: SQLiteSessionStore;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    store = new SQLiteSessionStore(db);
  });

  it("should create a session with defaults", async () => {
    const session = await store.createSession({});
    expect(session.id).toBeTruthy();
    expect(session.status).toBe("active");
    expect(session.messages).toEqual([]);
    expect(session.metadata.messageCount).toBe(0);
    expect(session.config.model).toBe("default");
  });

  it("should create a session with custom config", async () => {
    const session = await store.createSession({
      title: "My Chat",
      config: { model: "gpt-5", backend: "copilot" },
    });
    expect(session.title).toBe("My Chat");
    expect(session.config.model).toBe("gpt-5");
    expect(session.config.backend).toBe("copilot");
  });

  it("should get session by id", async () => {
    const created = await store.createSession({ title: "Findable" });
    const found = await store.getSession(created.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Findable");
  });

  it("should return null for missing session", async () => {
    const found = await store.getSession("nonexistent" as ChatId);
    expect(found).toBeNull();
  });

  it("should list sessions ordered by updated_at desc", async () => {
    const s1 = await store.createSession({ title: "First" });
    // Bump updatedAt for Second so it sorts first
    await new Promise(r => setTimeout(r, 10));
    await store.createSession({ title: "Second" });
    const sessions = await store.listSessions();
    expect(sessions.length).toBe(2);
    expect(sessions[0].title).toBe("Second");
  });

  it("should update title", async () => {
    const session = await store.createSession({ title: "Old" });
    await store.updateTitle(session.id, "New");
    const updated = await store.getSession(session.id);
    expect(updated!.title).toBe("New");
  });

  it("should throw on updateTitle for missing session", async () => {
    await expect(store.updateTitle("missing" as ChatId, "x")).rejects.toThrow("Session not found");
  });

  it("should update config", async () => {
    const session = await store.createSession({});
    await store.updateConfig(session.id, { model: "gpt-5" });
    const updated = await store.getSession(session.id);
    expect(updated!.config.model).toBe("gpt-5");
    expect(updated!.config.backend).toBe("default"); // preserved
  });

  it("should delete session", async () => {
    const session = await store.createSession({});
    await store.deleteSession(session.id);
    expect(await store.getSession(session.id)).toBeNull();
  });

  it("should throw on delete missing session", async () => {
    await expect(store.deleteSession("missing" as ChatId)).rejects.toThrow("Session not found");
  });

  it("should append and load messages", async () => {
    const session = await store.createSession({});
    const msg = makeMessage();
    await store.appendMessage(session.id, msg);
    const result = await store.loadMessages(session.id);
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].id).toBe(msg.id);
    expect(result.total).toBe(1);
  });

  it("should throw on append to missing session", async () => {
    await expect(store.appendMessage("missing" as ChatId, makeMessage())).rejects.toThrow("Session not found");
  });

  it("should save multiple messages in transaction", async () => {
    const session = await store.createSession({});
    const msgs = [makeMessage(), makeMessage({ role: "assistant" })];
    await store.saveMessages(session.id, msgs);
    const result = await store.loadMessages(session.id);
    expect(result.messages.length).toBe(2);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[1].role).toBe("assistant");
  });

  it("should paginate messages", async () => {
    const session = await store.createSession({});
    for (let i = 0; i < 5; i++) {
      await store.appendMessage(session.id, makeMessage({ id: `msg-${i}` as ChatId }));
    }
    const page1 = await store.loadMessages(session.id, { limit: 2, offset: 0 });
    expect(page1.messages.length).toBe(2);
    expect(page1.total).toBe(5);
    expect(page1.hasMore).toBe(true);

    const page3 = await store.loadMessages(session.id, { limit: 2, offset: 4 });
    expect(page3.messages.length).toBe(1);
    expect(page3.hasMore).toBe(false);
  });

  it("should search sessions by title", async () => {
    await store.createSession({ title: "React hooks tutorial" });
    await store.createSession({ title: "Vue composition API" });
    const results = await store.searchSessions({ query: "react" });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("React hooks tutorial");
  });

  it("should search sessions by message content", async () => {
    const session = await store.createSession({ title: "Chat" });
    await store.appendMessage(session.id, makeMessage({
      parts: [{ type: "text", text: "How do I use TypeScript?", status: "complete" }],
    }));
    const results = await store.searchSessions({ query: "typescript" });
    expect(results.length).toBe(1);
  });

  it("should count sessions", async () => {
    expect(await store.count()).toBe(0);
    await store.createSession({});
    await store.createSession({});
    expect(await store.count()).toBe(2);
  });

  it("should clear all data", async () => {
    const session = await store.createSession({});
    await store.appendMessage(session.id, makeMessage());
    await store.clear();
    expect(await store.count()).toBe(0);
  });

  it("should cascade delete messages when session deleted", async () => {
    const session = await store.createSession({});
    await store.appendMessage(session.id, makeMessage());
    await store.deleteSession(session.id);
    const msgCount = (db.prepare("SELECT COUNT(*) as cnt FROM messages").get() as { cnt: number }).cnt;
    expect(msgCount).toBe(0);
  });

  it("should include messages in getSession", async () => {
    const session = await store.createSession({});
    await store.appendMessage(session.id, makeMessage({ role: "user" }));
    await store.appendMessage(session.id, makeMessage({ role: "assistant" }));
    const loaded = await store.getSession(session.id);
    expect(loaded!.messages.length).toBe(2);
    expect(loaded!.messages[0].role).toBe("user");
    expect(loaded!.messages[1].role).toBe("assistant");
  });

  it("should track messageCount in metadata", async () => {
    const session = await store.createSession({});
    await store.appendMessage(session.id, makeMessage());
    await store.appendMessage(session.id, makeMessage());
    const loaded = await store.getSession(session.id);
    expect(loaded!.metadata.messageCount).toBe(2);
  });

  it("should list sessions with filter and limit", async () => {
    await store.createSession({ title: "Active 1" });
    await store.createSession({ title: "Active 2" });
    await store.createSession({ title: "Other" });

    const active = await store.listSessions({
      filter: (s) => s.title === "Active 1" || s.title === "Active 2",
      limit: 1,
    });
    expect(active.length).toBe(1);
  });
});

// ─── SQLiteProviderStore ───────────────────────────────────────

describe("SQLiteProviderStore", () => {
  let db: Database.Database;
  let store: SQLiteProviderStore;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    store = new SQLiteProviderStore(db);
  });

  it("should create and get a provider", async () => {
    const config = makeProvider();
    await store.create(config);
    const loaded = await store.get(config.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.backend).toBe("copilot");
    expect(loaded!.model).toBe("gpt-5-mini");
    expect(loaded!.label).toBe("Test Provider");
  });

  it("should return null for missing provider", async () => {
    expect(await store.get("nonexistent")).toBeNull();
  });

  it("should list providers ordered by created_at", async () => {
    const p1 = makeProvider({ label: "First", createdAt: 1000 });
    const p2 = makeProvider({ label: "Second", createdAt: 2000 });
    await store.create(p1);
    await store.create(p2);
    const list = await store.list();
    expect(list.length).toBe(2);
    expect(list[0].label).toBe("First");
    expect(list[1].label).toBe("Second");
  });

  it("should update provider fields", async () => {
    const config = makeProvider();
    await store.create(config);
    await store.update(config.id, { model: "gpt-5", label: "Updated" });
    const loaded = await store.get(config.id);
    expect(loaded!.model).toBe("gpt-5");
    expect(loaded!.label).toBe("Updated");
    expect(loaded!.backend).toBe("copilot"); // unchanged
    expect(loaded!.createdAt).toBe(config.createdAt); // immutable
  });

  it("should throw on update missing provider", async () => {
    await expect(store.update("missing", { model: "x" })).rejects.toThrow("not found");
  });

  it("should delete provider", async () => {
    const config = makeProvider();
    await store.create(config);
    await store.delete(config.id);
    expect(await store.get(config.id)).toBeNull();
  });

  it("should handle delete of missing provider gracefully", async () => {
    await expect(store.delete("missing")).resolves.not.toThrow();
  });

  it("should return empty list initially", async () => {
    expect(await store.list()).toEqual([]);
  });

  it("should preserve createdAt on update", async () => {
    const config = makeProvider({ createdAt: 1234567890 });
    await store.create(config);
    await store.update(config.id, { backend: "claude" });
    const loaded = await store.get(config.id);
    expect(loaded!.createdAt).toBe(1234567890);
  });
});

// ─── SQLiteTokenStore ──────────────────────────────────────────

describe("SQLiteTokenStore", () => {
  let db: Database.Database;
  let store: SQLiteTokenStore;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    store = new SQLiteTokenStore(db);
  });

  it("should save and load a token", async () => {
    const token = makeToken();
    await store.save("copilot", token);
    const loaded = await store.load("copilot");
    expect(loaded).not.toBeNull();
    expect(loaded!.accessToken).toBe(token.accessToken);
    expect(loaded!.tokenType).toBe("bearer");
  });

  it("should return null for missing token", async () => {
    expect(await store.load("nonexistent")).toBeNull();
  });

  it("should overwrite existing token on save", async () => {
    await store.save("copilot", makeToken({ accessToken: "old" }));
    await store.save("copilot", makeToken({ accessToken: "new" }));
    const loaded = await store.load("copilot");
    expect(loaded!.accessToken).toBe("new");
  });

  it("should clear a specific token", async () => {
    await store.save("copilot", makeToken());
    await store.save("claude", makeToken());
    await store.clear("copilot");
    expect(await store.load("copilot")).toBeNull();
    expect(await store.load("claude")).not.toBeNull();
  });

  it("should clear all tokens", async () => {
    await store.save("copilot", makeToken());
    await store.save("claude", makeToken());
    await store.clearAll();
    expect(await store.list()).toEqual([]);
  });

  it("should list provider names", async () => {
    await store.save("copilot", makeToken());
    await store.save("claude", makeToken());
    const list = await store.list();
    expect(list).toContain("copilot");
    expect(list).toContain("claude");
    expect(list.length).toBe(2);
  });

  it("should return empty list when no tokens", async () => {
    expect(await store.list()).toEqual([]);
  });

  it("should handle clear of missing token gracefully", async () => {
    await expect(store.clear("missing")).resolves.not.toThrow();
  });
});

// ─── Factory ───────────────────────────────────────────────────

describe("createSQLiteStorage", () => {
  it("should create all three stores from db instance", () => {
    const db = new Database(":memory:");
    const storage = createSQLiteStorage({ dbPath: ":memory:", db });
    expect(storage.db).toBe(db);
    expect(storage.sessionStore).toBeInstanceOf(SQLiteSessionStore);
    expect(storage.providerStore).toBeInstanceOf(SQLiteProviderStore);
    expect(storage.tokenStore).toBeInstanceOf(SQLiteTokenStore);
  });

  it("should create all stores from path string", () => {
    const storage = createSQLiteStorage(":memory:");
    expect(storage.db).toBeTruthy();
    expect(storage.sessionStore).toBeInstanceOf(SQLiteSessionStore);
    expect(storage.providerStore).toBeInstanceOf(SQLiteProviderStore);
    expect(storage.tokenStore).toBeInstanceOf(SQLiteTokenStore);
  });

  it("should share a single database across all stores", async () => {
    const storage = createSQLiteStorage(":memory:");

    // Create data via each store
    const session = await storage.sessionStore.createSession({ title: "Test" });
    await storage.providerStore.create(makeProvider());
    await storage.tokenStore.save("copilot", makeToken());

    // Verify all tables exist in one DB
    const tables = storage.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain("sessions");
    expect(tableNames).toContain("messages");
    expect(tableNames).toContain("providers");
    expect(tableNames).toContain("tokens");
  });

  it("should have WAL journal mode enabled on file-based db", () => {
    const tmpPath = "/tmp/test-sqlite-wal-" + Date.now() + ".db";
    const storage = createSQLiteStorage(tmpPath);
    const result = storage.db.pragma("journal_mode") as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe("wal");
    storage.db.close();
    // Clean up
    try { require("fs").unlinkSync(tmpPath); } catch {}
    try { require("fs").unlinkSync(tmpPath + "-wal"); } catch {}
    try { require("fs").unlinkSync(tmpPath + "-shm"); } catch {}
  });

  it("should have foreign keys enabled", () => {
    const storage = createSQLiteStorage(":memory:");
    const result = storage.db.pragma("foreign_keys") as { foreign_keys: number }[];
    expect(result[0].foreign_keys).toBe(1);
  });

  it("should work end-to-end: session + provider + token", async () => {
    const storage = createSQLiteStorage(":memory:");

    // Create a provider
    const provider = makeProvider({ backend: "copilot", model: "gpt-5-mini", label: "My Copilot" });
    await storage.providerStore.create(provider);

    // Save a token
    const token = makeToken();
    await storage.tokenStore.save("copilot", token);

    // Create a session with provider config
    const session = await storage.sessionStore.createSession({
      title: "Test Chat",
      config: { model: provider.model, backend: provider.backend },
    });

    // Add a message
    await storage.sessionStore.appendMessage(session.id, makeMessage({
      parts: [{ type: "text", text: "Hello!", status: "complete" }],
    }));

    // Verify everything
    const loadedProvider = await storage.providerStore.get(provider.id);
    expect(loadedProvider!.label).toBe("My Copilot");

    const loadedToken = await storage.tokenStore.load("copilot");
    expect(loadedToken!.accessToken).toBe(token.accessToken);

    const loadedSession = await storage.sessionStore.getSession(session.id);
    expect(loadedSession!.messages.length).toBe(1);
    expect(loadedSession!.config.model).toBe("gpt-5-mini");
  });
});

// ─── Schema Migrations ─────────────────────────────────────────

describe("Schema Migrations", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  });

  it("creates schema_version table on fresh database", async () => {
    const { getSchemaVersion } = await import("../../../src/chat/sqlite/migrations.js");
    const version = getSchemaVersion(db);
    expect(version).toBe(0);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'").all();
    expect(tables).toHaveLength(1);
  });

  it("runMigrations creates all tables on fresh database", async () => {
    const { runMigrations, getSchemaVersion } = await import("../../../src/chat/sqlite/migrations.js");
    runMigrations(db);

    expect(getSchemaVersion(db)).toBe(1);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const names = tables.map((t) => t.name).sort();
    expect(names).toContain("sessions");
    expect(names).toContain("messages");
    expect(names).toContain("providers");
    expect(names).toContain("tokens");
    expect(names).toContain("schema_version");
  });

  it("runMigrations is idempotent — second call is a no-op", async () => {
    const { runMigrations, getSchemaVersion } = await import("../../../src/chat/sqlite/migrations.js");
    runMigrations(db);
    runMigrations(db);

    expect(getSchemaVersion(db)).toBe(1);

    const versions = db.prepare("SELECT * FROM schema_version").all();
    expect(versions).toHaveLength(1);
  });

  it("detects pre-existing database and fast-forwards to v1", async () => {
    const { runMigrations, getSchemaVersion } = await import("../../../src/chat/sqlite/migrations.js");

    // Simulate a pre-migration database (tables exist but no schema_version)
    db.exec("CREATE TABLE sessions (id TEXT PRIMARY KEY)");
    db.exec("CREATE TABLE messages (id TEXT PRIMARY KEY)");

    runMigrations(db);

    expect(getSchemaVersion(db)).toBe(1);
    const row = db.prepare("SELECT description FROM schema_version WHERE version = 1").get() as { description: string };
    expect(row.description).toContain("pre-existing");
  });

  it("records applied_at timestamp for each migration", async () => {
    const { runMigrations } = await import("../../../src/chat/sqlite/migrations.js");
    runMigrations(db);

    const row = db.prepare("SELECT applied_at FROM schema_version WHERE version = 1").get() as { applied_at: string };
    expect(row.applied_at).toBeTruthy();
    expect(new Date(row.applied_at).getTime()).not.toBeNaN();
  });

  it("factory createSQLiteStorage runs migrations automatically", async () => {
    const { getSchemaVersion } = await import("../../../src/chat/sqlite/migrations.js");
    const storage = createSQLiteStorage({ db });

    expect(getSchemaVersion(storage.db)).toBe(1);
  });

  it("migrations array versions are sequential", async () => {
    const { migrations } = await import("../../../src/chat/sqlite/migrations.js");
    for (let i = 0; i < migrations.length; i++) {
      expect(migrations[i].version).toBe(i + 1);
    }
  });
});
