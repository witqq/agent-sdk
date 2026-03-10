/**
 * Usage Tracking Middleware
 *
 * ChatMiddleware that counts tokens from usage events and persists
 * cumulative usage data per session. Demonstrates the runtime's
 * middleware hooks for cross-cutting concerns.
 *
 * @example
 * ```typescript
 * import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
 * import { createUsageMiddleware, InMemoryUsageStore } from "./usage-middleware";
 *
 * const usageStore = new InMemoryUsageStore();
 * const runtime = createChatRuntime({
 *   middleware: [createUsageMiddleware(usageStore)],
 *   // ...
 * });
 *
 * // After conversations:
 * const stats = await usageStore.getUsage("session-id");
 * // { promptTokens: 150, completionTokens: 80, totalTokens: 230, requestCount: 3 }
 * ```
 */

import type { ChatMiddleware, ChatMiddlewareContext, ChatEvent, ChatId } from "@witqq/agent-sdk/chat/core";

// ─── Usage Data Types ──────────────────────────────────────────

/** Accumulated usage statistics for a session */
export interface SessionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
  lastModel?: string;
  lastBackend?: string;
}

/** Storage interface for persisting usage data */
export interface IUsageStore {
  /** Get usage for a session. Returns null if no usage recorded. */
  getUsage(sessionId: ChatId): Promise<SessionUsage | null>;
  /** Record usage data for a session (additive). */
  recordUsage(sessionId: ChatId, usage: UsageRecord): Promise<void>;
  /** Get total usage across all sessions. */
  getTotalUsage(): Promise<SessionUsage>;
  /** List all sessions with usage data. */
  listSessions(): Promise<Array<{ sessionId: ChatId; usage: SessionUsage }>>;
  /** Clear all usage data. */
  clear(): Promise<void>;
}

/** Single usage event record */
export interface UsageRecord {
  promptTokens: number;
  completionTokens: number;
  model?: string;
  /**
   * Backend identifier. Not populated from standard ChatEvent — must be
   * set manually or via a custom middleware that injects backend info.
   */
  backend?: string;
}

// ─── In-Memory Store ───────────────────────────────────────────

/** In-memory usage store for development and testing. */
export class InMemoryUsageStore implements IUsageStore {
  private readonly data = new Map<string, SessionUsage>();

  async getUsage(sessionId: ChatId): Promise<SessionUsage | null> {
    return this.data.get(sessionId) ?? null;
  }

  async recordUsage(sessionId: ChatId, record: UsageRecord): Promise<void> {
    const existing = this.data.get(sessionId) ?? {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      requestCount: 0,
    };

    existing.promptTokens += record.promptTokens;
    existing.completionTokens += record.completionTokens;
    existing.totalTokens += record.promptTokens + record.completionTokens;
    existing.requestCount += 1;
    if (record.model) existing.lastModel = record.model;
    if (record.backend) existing.lastBackend = record.backend;

    this.data.set(sessionId, existing);
  }

  async getTotalUsage(): Promise<SessionUsage> {
    const total: SessionUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      requestCount: 0,
    };
    for (const usage of this.data.values()) {
      total.promptTokens += usage.promptTokens;
      total.completionTokens += usage.completionTokens;
      total.totalTokens += usage.totalTokens;
      total.requestCount += usage.requestCount;
    }
    return total;
  }

  async listSessions(): Promise<Array<{ sessionId: ChatId; usage: SessionUsage }>> {
    return Array.from(this.data.entries()).map(([sessionId, usage]) => ({
      sessionId: sessionId as ChatId,
      usage,
    }));
  }

  async clear(): Promise<void> {
    this.data.clear();
  }
}

// ─── Middleware Factory ────────────────────────────────────────

/**
 * Create a ChatMiddleware that tracks token usage per session.
 *
 * Listens for `usage` events in `onEvent` and accumulates token counts
 * in the provided store. Also increments request count on `done` events.
 *
 * @param store - Storage backend for usage data
 * @returns ChatMiddleware instance
 */
export function createUsageMiddleware(store: IUsageStore): ChatMiddleware {
  // Track pending usage per request (between message:start and done)
  let pendingUsage: UsageRecord | null = null;
  let currentSessionId: ChatId | null = null;

  return {
    onBeforeSend(message, context) {
      // Reset tracking for new request
      pendingUsage = null;
      currentSessionId = context.sessionId;
      return message;
    },

    onEvent(event: ChatEvent, context: ChatMiddlewareContext) {
      currentSessionId = context.sessionId;

      if (event.type === "usage") {
        const usage = event as { type: "usage"; promptTokens?: number; completionTokens?: number; model?: string };
        pendingUsage = {
          promptTokens: usage.promptTokens ?? 0,
          completionTokens: usage.completionTokens ?? 0,
          model: usage.model,
        };
      }

      if (event.type === "done" && currentSessionId) {
        // Persist accumulated usage
        const record = pendingUsage ?? { promptTokens: 0, completionTokens: 0 };
        // Fire and forget — don't block the event pipeline
        store.recordUsage(currentSessionId, record).catch(() => {
          // Silently ignore storage errors in middleware
        });
        pendingUsage = null;
      }

      return event;
    },
  };
}
