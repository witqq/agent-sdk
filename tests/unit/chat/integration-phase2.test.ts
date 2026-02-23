/**
 * Integration tests for Chat SDK Phase 2 pipeline:
 * Storage → Sessions → Context Window Manager
 *
 * Tests the full flow: create session → add messages → context overflow → retrieve trimmed context
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemorySessionStore } from "../../../src/chat/sessions.js";
import { ContextWindowManager } from "../../../src/chat/context.js";
import type { ChatMessage, ChatSession, ChatId, SessionInfo } from "../../../src/chat/core.js";
import { getMessageText } from "../../../src/chat/core.js";

function makeMessage(
  role: ChatMessage["role"],
  content: string,
  id?: string,
): ChatMessage {
  return {
    id: id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    parts: [{ type: "text" as const, text: content, status: "complete" as const }],
    createdAt: new Date().toISOString(),
    status: "complete",
  };
}

describe("Phase 2 Integration: Storage → Sessions → Context", () => {
  let store: InMemorySessionStore;
  let contextMgr: ContextWindowManager;

  beforeEach(() => {
    store = new InMemorySessionStore();
    contextMgr = new ContextWindowManager({
      maxTokens: 50,
      strategy: "truncate-oldest",
    });
  });

  afterEach(async () => {
    await store.clear();
  });

  it("full pipeline: create session, add messages, trim context", async () => {
    const session = await store.createSession({ title: "Integration test" });

    // Add messages to session
    const msgs = [
      makeMessage("system", "You are a helpful assistant."),
      makeMessage("user", "What is TypeScript?"),
      makeMessage("assistant", "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript."),
      makeMessage("user", "How do generics work?"),
      makeMessage("assistant", "Generics allow you to write reusable components that work with any type by using type parameters."),
      makeMessage("user", "Give me an example of a generic function."),
    ];

    for (const msg of msgs) {
      await store.addMessage(session.id, msg);
    }

    // Retrieve messages
    const page = await store.getMessages(session.id, { limit: 100, offset: 0 });
    expect(page.total).toBe(6);

    // Apply context window
    const result = contextMgr.fitMessages(page.messages);
    expect(result.wasTruncated).toBe(true);
    expect(result.removedCount).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(6);

    // System message preserved
    const systemMsg = result.messages.find((m) => m.role === "system");
    expect(systemMsg).toBeDefined();
    expect(getMessageText(systemMsg!)).toBe("You are a helpful assistant.");

    // Most recent message preserved
    const lastMsg = result.messages[result.messages.length - 1];
    expect(getMessageText(lastMsg)).toBe("Give me an example of a generic function.");
  });

  it("session persistence through message cycle", async () => {
    const session = await store.createSession({
      title: "Persistent session",
      config: { model: "gpt-4", backend: "vercel-ai" },
    });

    // Round 1: add initial messages
    await store.addMessage(session.id, makeMessage("user", "Hello"));
    await store.addMessage(session.id, makeMessage("assistant", "Hi there!"));

    // Verify session metadata updated
    const updated = await store.getSession(session.id);
    expect(updated.metadata.messageCount).toBe(2);

    // Round 2: add more messages
    await store.addMessage(session.id, makeMessage("user", "Follow up"));
    await store.addMessage(session.id, makeMessage("assistant", "Sure!"));

    const final = await store.getSession(session.id);
    expect(final.metadata.messageCount).toBe(4);

    // Retrieve and verify all messages in order
    const page = await store.getMessages(session.id, { limit: 100, offset: 0 });
    expect(page.messages.map((m) => getMessageText(m))).toEqual([
      "Hello", "Hi there!", "Follow up", "Sure!",
    ]);
  });

  it("multiple sessions with independent message stores", async () => {
    const session1 = await store.createSession({ title: "Session 1" });
    const session2 = await store.createSession({ title: "Session 2" });

    await store.addMessage(session1.id, makeMessage("user", "Message in session 1"));
    await store.addMessage(session2.id, makeMessage("user", "Message in session 2"));
    await store.addMessage(session2.id, makeMessage("assistant", "Reply in session 2"));

    const page1 = await store.getMessages(session1.id, { limit: 100, offset: 0 });
    const page2 = await store.getMessages(session2.id, { limit: 100, offset: 0 });

    expect(page1.total).toBe(1);
    expect(page2.total).toBe(2);
    expect(getMessageText(page1.messages[0])).toBe("Message in session 1");
  });

  it("context window with summarize-placeholder strategy", async () => {
    const mgr = new ContextWindowManager({
      maxTokens: 30,
      strategy: "summarize-placeholder",
    });

    const session = await store.createSession({ title: "Summary test" });
    const msgs = [
      makeMessage("system", "Be helpful."),
      makeMessage("user", "First question about programming"),
      makeMessage("assistant", "Here is a long answer about programming concepts"),
      makeMessage("user", "Second question about TypeScript generics"),
      makeMessage("assistant", "Generics provide type safety with flexibility"),
      makeMessage("user", "Third question"),
    ];

    for (const msg of msgs) {
      await store.addMessage(session.id, msg);
    }

    const page = await store.getMessages(session.id, { limit: 100, offset: 0 });
    const result = mgr.fitMessages(page.messages);

    expect(result.wasTruncated).toBe(true);

    // Should have placeholder message
    const placeholder = result.messages.find((m) => (m.metadata as Record<string, unknown>)?.isSummary === true);
    expect(placeholder).toBeDefined();
    expect(getMessageText(placeholder!)).toContain("omitted");
  });

  it("sliding-window strategy keeps only recent context", async () => {
    const mgr = new ContextWindowManager({
      maxTokens: 20,
      strategy: "sliding-window",
    });

    const session = await store.createSession({ title: "Sliding test" });
    const msgs = [
      makeMessage("user", "Very old message that should be dropped"),
      makeMessage("assistant", "Very old reply that should also be dropped"),
      makeMessage("user", "Recent message"),
      makeMessage("assistant", "Recent reply"),
    ];

    for (const msg of msgs) {
      await store.addMessage(session.id, msg);
    }

    const page = await store.getMessages(session.id, { limit: 100, offset: 0 });
    const result = mgr.fitMessages(page.messages);

    expect(result.wasTruncated).toBe(true);
    expect(result.messages.length).toBeLessThan(4);

    // Last message always included
    const lastMsg = result.messages[result.messages.length - 1];
    expect(getMessageText(lastMsg)).toBe("Recent reply");
  });

  it("session search across multiple sessions", async () => {
    await store.createSession({ title: "TypeScript session" });
    await store.createSession({ title: "Python session" });
    await store.createSession({ title: "Rust session" });

    const tsResults = await store.searchSessions({ query: "TypeScript" });
    expect(tsResults.length).toBe(1);
    expect(tsResults[0].title).toBe("TypeScript session");
  });

  it("paginated message retrieval", async () => {
    const session = await store.createSession({ title: "Pagination test" });

    // Add 10 messages
    for (let i = 0; i < 10; i++) {
      await store.addMessage(
        session.id,
        makeMessage(i % 2 === 0 ? "user" : "assistant", `Message ${i}`),
      );
    }

    // Page 1
    const page1 = await store.getMessages(session.id, { limit: 3, offset: 0 });
    expect(page1.messages.length).toBe(3);
    expect(page1.total).toBe(10);
    expect(page1.hasMore).toBe(true);

    // Page 2
    const page2 = await store.getMessages(session.id, { limit: 3, offset: 3 });
    expect(page2.messages.length).toBe(3);
    expect(page2.hasMore).toBe(true);

    // Last page
    const page4 = await store.getMessages(session.id, { limit: 3, offset: 9 });
    expect(page4.messages.length).toBe(1);
    expect(page4.hasMore).toBe(false);
  });

  it("context trimming returns new array (not same reference)", async () => {
    const session = await store.createSession({ title: "Array ref test" });
    const original = makeMessage("user", "Original content");
    await store.addMessage(session.id, original);

    const page = await store.getMessages(session.id, { limit: 100, offset: 0 });
    const result = contextMgr.fitMessages(page.messages);

    // Result array is different reference from input
    expect(result.messages).not.toBe(page.messages);
    expect(getMessageText(result.messages[0])).toBe("Original content");
  });

  it("empty session returns no-truncation result", async () => {
    const session = await store.createSession({ title: "Empty" });
    const page = await store.getMessages(session.id, { limit: 100, offset: 0 });

    const result = contextMgr.fitMessages(page.messages);
    expect(result.messages).toEqual([]);
    expect(result.wasTruncated).toBe(false);
    expect(result.removedCount).toBe(0);
    expect(result.totalTokens).toBe(0);
  });
});

describe("Phase 2 Integration: ChatSession subscribe/getSnapshot & SessionInfo", () => {
  it("ChatSession accepts optional subscribe and getSnapshot methods", () => {
    const session: ChatSession = {
      id: "test-id" as ChatId,
      title: "Test",
      messages: [],
      config: { model: "gpt-4", backend: "copilot" },
      metadata: { messageCount: 0, totalTokens: 0 },
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Plain data session — no subscribe/getSnapshot
    expect(session.subscribe).toBeUndefined();
    expect(session.getSnapshot).toBeUndefined();
    expect(session.lastMessage).toBeUndefined();
  });

  it("ChatSession with subscribe/getSnapshot works as reactive source", () => {
    const listeners = new Set<() => void>();
    const msg = makeMessage("user", "Hello");

    const session: ChatSession = {
      id: "reactive-id" as ChatId,
      messages: [msg],
      config: { model: "gpt-4", backend: "copilot" },
      metadata: { messageCount: 1, totalTokens: 10 },
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subscribe(callback: () => void) {
        listeners.add(callback);
        return () => { listeners.delete(callback); };
      },
      getSnapshot() {
        return session;
      },
      get lastMessage() {
        return this.messages[this.messages.length - 1];
      },
    };

    // subscribe works
    let called = false;
    const unsub = session.subscribe!(() => { called = true; });
    expect(listeners.size).toBe(1);

    // Simulate notification
    for (const cb of listeners) cb();
    expect(called).toBe(true);

    // getSnapshot returns the session itself
    expect(session.getSnapshot!()).toBe(session);

    // lastMessage
    expect(session.lastMessage).toBe(msg);

    // Unsubscribe works
    unsub();
    expect(listeners.size).toBe(0);
  });

  it("SessionInfo provides lightweight session data for listing", () => {
    const info: SessionInfo = {
      id: "info-id" as ChatId,
      title: "My chat",
      status: "active",
      messageCount: 42,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(info.id).toBe("info-id");
    expect(info.messageCount).toBe(42);
    expect(info.lastMessage).toBeUndefined();
    expect(info.status).toBe("active");
  });

  it("SessionInfo with lastMessage", () => {
    const lastMsg = makeMessage("assistant", "Here is the answer");
    const info: SessionInfo = {
      id: "info-2" as ChatId,
      status: "archived",
      messageCount: 5,
      lastMessage: lastMsg,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(info.lastMessage).toBe(lastMsg);
    expect(info.status).toBe("archived");
    expect(info.title).toBeUndefined();
  });
});
