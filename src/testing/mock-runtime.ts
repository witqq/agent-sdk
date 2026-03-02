/**
 * Mock IChatRuntime factory for testing chat runtime consumers.
 */
import type { IChatRuntime, BackendInfo } from "../chat/runtime.js";
import type { CreateSessionOptions, SessionListOptions } from "../chat/sessions.js";
import type { ChatSession, ChatEvent, ChatIdLike, ChatMiddleware, RuntimeStatus } from "../chat/core.js";
import type { RuntimeSendOptions } from "../chat/types.js";
import type { ContextStats } from "../chat/context.js";
import type { ToolDefinition, ModelInfo } from "../types.js";
import { createChatId, toChatId } from "../chat/core.js";
import { createMockSession, createMockMessage } from "./mock-data.js";

/** Options for createMockRuntime. */
export interface MockRuntimeOptions {
  /** Default backend name. Default: "mock". */
  defaultBackend?: string;
  /** Default model. */
  defaultModel?: string;
  /** Pre-seeded sessions. */
  sessions?: ChatSession[];
  /** Models to return from listModels(). */
  models?: ModelInfo[];
  /** Custom send handler. When not provided, yields a single text_delta + done event. */
  onSend?: (sessionId: ChatIdLike, message: string, options?: RuntimeSendOptions) => AsyncIterable<ChatEvent>;
}

/**
 * Create a mock IChatRuntime for testing chat UI hooks and components.
 *
 * ```ts
 * const runtime = createMockRuntime({ defaultModel: "gpt-5-mini" });
 * const session = await runtime.createSession({});
 * ```
 */
export function createMockRuntime(options: MockRuntimeOptions = {}): IChatRuntime {
  const sessions = new Map<string, ChatSession>();
  const tools = new Map<string, ToolDefinition>();
  const middleware: ChatMiddleware[] = [];
  const sessionListeners = new Set<() => void>();
  let currentBackend = options.defaultBackend ?? "mock";
  let status: RuntimeStatus = "idle";

  // Seed initial sessions
  for (const s of options.sessions ?? []) {
    sessions.set(s.id, s);
  }

  function notifySessionChange() {
    for (const cb of sessionListeners) {
      try { cb(); } catch { /* isolated */ }
    }
  }

  const runtime: IChatRuntime = {
    get status() { return status; },
    get registeredTools() { return tools as ReadonlyMap<string, ToolDefinition>; },

    async createSession(opts: CreateSessionOptions): Promise<ChatSession> {
      const session = createMockSession({
        title: opts.title,
        config: {
          model: opts.config?.model ?? "mock-model",
          backend: opts.config?.backend ?? currentBackend,
          systemPrompt: opts.config?.systemPrompt,
        },
        metadata: opts.custom as Record<string, unknown>,
      });
      sessions.set(session.id, session);
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
      notifySessionChange();
    },

    send(sessionId: ChatIdLike, message: string, sendOpts?: RuntimeSendOptions): AsyncIterable<ChatEvent> {
      if (options.onSend) return options.onSend(sessionId, message, sendOpts);
      // Default: yield a simple response
      async function* defaultStream(): AsyncIterable<ChatEvent> {
        const msgId = createChatId();
        yield { type: "message:start", messageId: msgId } as ChatEvent;
        yield { type: "message:delta", text: "Mock reply" } as ChatEvent;
        yield { type: "message:complete", messageId: msgId } as ChatEvent;
        yield { type: "done", finalOutput: "Mock reply" } as ChatEvent;
        // Add assistant message to session
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

    async listModels(): Promise<ModelInfo[]> {
      return options.models ?? [{ id: "mock-model", name: "Mock Model" }];
    },

    async listBackends(): Promise<BackendInfo[]> {
      return [{ name: currentBackend }];
    },

    onSessionChange(callback: () => void): () => void {
      sessionListeners.add(callback);
      return () => { sessionListeners.delete(callback); };
    },

    registerTool(tool: ToolDefinition): void {
      tools.set(tool.name, tool);
    },

    removeTool(name: string): void {
      tools.delete(name);
    },

    use(mw: ChatMiddleware): void {
      middleware.push(mw);
    },

    removeMiddleware(mw: ChatMiddleware): void {
      const idx = middleware.indexOf(mw);
      if (idx >= 0) middleware.splice(idx, 1);
    },

    async getContextStats(_sessionId: ChatIdLike): Promise<ContextStats | null> {
      return null;
    },

    async dispose(): Promise<void> {
      status = "disposed";
      sessions.clear();
      tools.clear();
      middleware.length = 0;
      sessionListeners.clear();
    },
  };

  return runtime;
}
