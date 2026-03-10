/**
 * Mock IChatClient factory for testing remote chat client consumers.
 */
import type { IChatClient, BackendInfo } from "../chat/runtime.js";
import type { CreateSessionOptions, SessionListOptions } from "../chat/sessions.js";
import type { ChatSession, ChatEvent, ChatId, ChatIdLike, SendMessageOptions, RuntimeStatus } from "../chat/core.js";
import type { ProviderConfig } from "../chat/provider-types.js";
import type { ModelInfo } from "../types.js";
import type { ContextStats } from "../chat/context.js";
import { createChatId, toChatId } from "../chat/core.js";
import { createMockSession, createMockMessage } from "./mock-data.js";

/** Options for createMockChatClient. */
export interface MockChatClientOptions {
  /** Pre-seeded sessions. */
  sessions?: ChatSession[];
  /** Models to return from listModels(). */
  models?: ModelInfo[];
  /** Providers to return from listProviders(). */
  providers?: ProviderConfig[];
  /** Custom send handler. */
  onSend?: (sessionId: ChatIdLike, message: string, options?: SendMessageOptions) => AsyncIterable<ChatEvent>;
}

/**
 * Create a mock IChatClient for testing React hooks that talk to RemoteChatClient.
 *
 * ```ts
 * const client = createMockChatClient({ providers: [{ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "GPT Mini", createdAt: "" }] });
 * const providers = await client.listProviders();
 * ```
 */
export function createMockChatClient(options: MockChatClientOptions = {}): IChatClient {
  const sessions = new Map<string, ChatSession>();
  const providers = new Map<string, ProviderConfig>();
  const sessionListeners = new Set<() => void>();
  const selectionListeners = new Set<(providerId: string | null) => void>();
  let activeSessionId: ChatId | null = null;
  let selectedProviderId: string | null = null;
  let status: RuntimeStatus = "idle";

  // Seed sessions
  for (const s of options.sessions ?? []) {
    sessions.set(s.id, s);
  }
  // Seed providers
  for (const p of options.providers ?? []) {
    providers.set(p.id, p);
  }

  function notifySessionChange() {
    for (const cb of sessionListeners) {
      try { cb(); } catch { /* isolated */ }
    }
  }

  const client: IChatClient = {
    get status() { return status; },
    get activeSessionId() { return activeSessionId; },

    async createSession(opts: CreateSessionOptions): Promise<ChatSession> {
      const session = createMockSession({
        title: opts.title,
        config: {
          model: opts.config?.model ?? "mock-model",
          backend: opts.config?.backend ?? "mock",
          systemPrompt: opts.config?.systemPrompt,
        },
      });
      sessions.set(session.id, session);
      activeSessionId = session.id;
      notifySessionChange();
      return session;
    },

    async getSession(id: ChatIdLike): Promise<ChatSession | null> {
      return sessions.get(toChatId(String(id))) ?? null;
    },

    async listSessions(_opts?: SessionListOptions): Promise<ChatSession[]> {
      return [...sessions.values()];
    },

    async deleteSession(id: ChatIdLike): Promise<void> {
      sessions.delete(toChatId(String(id)));
      if (activeSessionId === String(id)) activeSessionId = null;
      notifySessionChange();
    },

    async switchSession(id: ChatIdLike): Promise<ChatSession> {
      const session = sessions.get(toChatId(String(id)));
      if (!session) throw new Error(`Session ${id} not found`);
      activeSessionId = session.id;
      return session;
    },

    send(sessionId: ChatIdLike, message: string, sendOpts?: SendMessageOptions): AsyncIterable<ChatEvent> {
      if (options.onSend) return options.onSend(sessionId, message, sendOpts);
      async function* defaultStream(): AsyncIterable<ChatEvent> {
        const msgId = createChatId();
        yield { type: "message:start", messageId: msgId } as ChatEvent;
        yield { type: "message:delta", text: "Mock reply" } as ChatEvent;
        yield { type: "message:complete", messageId: msgId } as ChatEvent;
        yield { type: "done", finalOutput: "Mock reply" } as ChatEvent;
        const session = sessions.get(toChatId(String(sessionId)));
        if (session) {
          session.messages.push(createMockMessage({ role: "assistant", text: "Mock reply" }));
          session.metadata.messageCount = session.messages.length;
        }
        notifySessionChange();
      }
      return defaultStream();
    },

    abort(): void { /* no-op */ },

    // ── Provider Selection ──
    get selectedProviderId() { return selectedProviderId; },
    selectProvider(providerId: string): void {
      selectedProviderId = providerId;
      for (const cb of selectionListeners) {
        try { cb(providerId); } catch { /* isolated */ }
      }
    },
    onSelectionChange(callback: (providerId: string | null) => void): () => void {
      selectionListeners.add(callback);
      return () => { selectionListeners.delete(callback); };
    },

    async listModels(): Promise<ModelInfo[]> {
      return options.models ?? [{ id: "mock-model", name: "Mock Model" }];
    },

    async listBackends(): Promise<BackendInfo[]> {
      return [{ name: "mock" }];
    },

    onSessionChange(callback: () => void): () => void {
      sessionListeners.add(callback);
      return () => { sessionListeners.delete(callback); };
    },

    async getContextStats(_sessionId: ChatIdLike): Promise<ContextStats | null> {
      return null;
    },

    // ── Provider CRUD ──
    async listProviders(): Promise<ProviderConfig[]> {
      return [...providers.values()];
    },

    async createProvider(config: Omit<ProviderConfig, "id" | "createdAt">): Promise<ProviderConfig> {
      const provider: ProviderConfig = {
        ...config,
        id: createChatId(),
        createdAt: Date.now(),
      };
      providers.set(provider.id, provider);
      return provider;
    },

    async updateProvider(id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>): Promise<void> {
      const existing = providers.get(id);
      if (!existing) throw new Error(`Provider ${id} not found`);
      providers.set(id, { ...existing, ...changes });
    },

    async deleteProvider(id: string): Promise<void> {
      providers.delete(id);
    },

    async dispose(): Promise<void> {
      status = "disposed";
      sessions.clear();
      providers.clear();
      sessionListeners.clear();
      selectionListeners.clear();
    },
  };

  return client;
}
