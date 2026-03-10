/**
 * @witqq/agent-sdk/chat/backends/base
 *
 * Abstract base class for backend adapters. Provides shared lifecycle
 * management, event bridge via adaptAgentEvents(), and tool forwarding.
 */

import type {
  ChatEvent,
  ChatSession,
  ChatMessage,
  SendMessageOptions,
} from "../core.js";
import {
  createChatId,
  adaptAgentEvents,
  toAgentMessages,
} from "../core.js";
import { ChatError, ErrorCode } from "../errors.js";
import type {
  FullAgentConfig,
  IAgent,
  IAgentService,
  Message,
  ModelInfo,
} from "../../types.js";
import type { IChatBackend, BackendAdapterOptions } from "./types.js";

/**
 * Abstract base for backend adapters implementing IChatBackend (core only).
 * Subclasses implement createService() for backend-specific service creation.
 * Resume support is NOT required — subclasses can implement IResumableBackend separately.
 */
export abstract class BaseBackendAdapter implements IChatBackend {
  readonly name: string;
  private _agentService: IAgentService | null = null;
  private _agentServiceFactory: (() => IAgentService) | null = null;
  private _disposed = false;
  protected readonly _agentConfig: FullAgentConfig;
  private _ownsService: boolean;
  // Agent lifecycle: tracks current agent and the model it was created with.
  // For persistent sessions, reused across calls when model matches.
  // For non-persistent, recreated every call.
  private _currentAgent: { instance: IAgent; model: string | undefined } | null = null;

  constructor(name: string, options: BackendAdapterOptions) {
    this.name = name;
    this._agentConfig = options.agentConfig;
    if (options.agentService) {
      this._agentService = options.agentService;
      this._ownsService = false;
    } else if (options.agentServiceFactory) {
      this._agentServiceFactory = options.agentServiceFactory;
      this._ownsService = true;
    } else {
      this._agentService = this.createService();
      this._ownsService = true;
    }
  }

  /** Subclasses create their specific IAgentService */
  protected abstract createService(): IAgentService;

  get agentService(): IAgentService {
    if (!this._agentService) {
      if (this._agentServiceFactory) {
        this._agentService = this._agentServiceFactory();
        this._agentServiceFactory = null; // factory used once
      } else {
        throw new ChatError("Agent service not available", {
          code: ErrorCode.BACKEND_NOT_INSTALLED,
        });
      }
    }
    return this._agentService;
  }

  get currentModel(): string | undefined {
    return this._agentConfig.model;
  }

  /**
   * @deprecated No-op. Tools are passed per-call via SendMessageOptions.tools.
   * Kept for backward compatibility with code that calls setTools() directly.
   */
  setTools(): void {
    // No-op — tools flow per-call via SendMessageOptions.tools
  }

  async sendMessage(
    session: ChatSession,
    message: string,
    options?: SendMessageOptions,
  ): Promise<ChatMessage> {
    this.assertNotDisposed();
    const events = this.streamMessage(session, message, options);

    let text = "";
    let lastMessage: ChatMessage | undefined;

    for await (const event of events) {
      if (event.type === "message:delta") {
        text += event.text;
      }
      if (event.type === "message:complete") {
        lastMessage = event.message;
      }
    }

    if (lastMessage) return lastMessage;

    // Construct message from accumulated text
    const messageId = createChatId();
    return {
      id: messageId,
      role: "assistant",
      parts: [{ type: "text", text, status: "complete" }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "complete",
    };
  }

  async *streamMessage(
    session: ChatSession,
    message: string,
    options?: SendMessageOptions,
  ): AsyncIterable<ChatEvent> {
    this.assertNotDisposed();

    const agent = this.getOrCreateAgent(options);

    // Convert session messages to agent format + new user message
    const messages: Message[] = session.messages.flatMap(toAgentMessages);
    messages.push({ role: "user", content: message });

    yield* this.streamAgentEvents(agent, messages, options);
  }

  /**
   * Shared streaming helper: bridges agent events to chat events.
   * Used by both streamMessage() and resume() to avoid duplication.
   */
  protected async *streamAgentEvents(
    agent: IAgent,
    messages: Message[],
    options?: SendMessageOptions,
  ): AsyncIterable<ChatEvent> {
    const messageId = createChatId();
    const model = options?.model ?? this._agentConfig.model ?? "";

    const agentEvents = agent.streamWithContext(messages, {
      model,
      signal: options?.signal,
      context: options?.context,
      tools: options?.tools,
      ...(options?.systemPrompt ? { systemMessage: options.systemPrompt } : {}),
    });

    yield { type: "message:start", messageId, role: "assistant" };

    let text = "";
    for await (const chatEvent of adaptAgentEvents(agentEvents, messageId)) {
      if (chatEvent.type === "message:delta") {
        text += chatEvent.text;
      }
      yield chatEvent;
    }

    this.captureSessionId(agent);

    yield {
      type: "message:complete",
      messageId,
      message: {
        id: messageId,
        role: "assistant",
        parts: [{ type: "text", text, status: "complete" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "complete",
      },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    this.assertNotDisposed();
    return this.agentService.listModels();
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    this.assertNotDisposed();
    return this.agentService.validate();
  }

  async dispose(): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;
    if (this._currentAgent) {
      this._currentAgent.instance.dispose();
      this._currentAgent = null;
    }
    if (this._ownsService && this._agentService && typeof this._agentService.dispose === "function") {
      await this._agentService.dispose();
    }
  }

  /** Get or create an agent. Model is passed per-call via RunOptions.
   *  Tools are passed per-call via SendMessageOptions — not baked into config.
   *  For persistent sessions, reuses agent when model matches. */
  protected getOrCreateAgent(options?: SendMessageOptions): IAgent {
    const model = options?.model ?? this._agentConfig.model;

    // For persistent session mode, reuse if model matches
    if (this._agentConfig.sessionMode === "persistent" && this._currentAgent) {
      if (this._currentAgent.model === model) {
        return this._currentAgent.instance;
      }
      // Model changed — dispose old agent, create new one below
      this._currentAgent.instance.dispose();
      this._currentAgent = null;
    }

    // Dispose previous agent to prevent leaks (P23)
    if (this._currentAgent) {
      this._currentAgent.instance.dispose();
      this._currentAgent = null;
    }

    // Create fresh agent — merge model and tools from per-call options
    const config: FullAgentConfig = {
      ...this._agentConfig,
      ...(model !== undefined && { model }),
      ...(options?.tools?.length ? { tools: options.tools } : {}),
    };
    const agent = this.agentService.createAgent(config);
    this._currentAgent = { instance: agent, model };
    return agent;
  }

  /** Subclasses capture backend session ID from agent after streaming */
  protected abstract captureSessionId(agent: IAgent): void;

  protected assertNotDisposed(): void {
    if (this._disposed) {
      throw new ChatError("Adapter is disposed", {
        code: ErrorCode.DISPOSED,
      });
    }
  }
}
