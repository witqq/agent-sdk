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
  toAgentMessage,
} from "../core.js";
import { ChatError, ChatErrorCode } from "../errors.js";
import type {
  AgentConfig,
  IAgent,
  IAgentService,
  Message,
  ModelInfo,
} from "../../types.js";
import type { IBackendAdapter, BackendAdapterOptions } from "./types.js";

/**
 * Abstract base for backend adapters.
 * Subclasses implement createService() and override resume behavior.
 */
export abstract class BaseBackendAdapter implements IBackendAdapter {
  readonly name: string;
  protected _agentService: IAgentService;
  protected _agent: IAgent | null = null;
  protected _disposed = false;
  protected readonly _agentConfig: AgentConfig;
  private readonly _ownsService: boolean;

  constructor(name: string, options: BackendAdapterOptions) {
    this.name = name;
    this._agentConfig = options.agentConfig;
    if (options.agentService) {
      this._agentService = options.agentService;
      this._ownsService = false;
    } else {
      this._agentService = this.createService();
      this._ownsService = true;
    }
  }

  /** Subclasses create their specific IAgentService */
  protected abstract createService(): IAgentService;

  get agentService(): IAgentService {
    return this._agentService;
  }

  abstract get backendSessionId(): string | null;
  abstract canResume(): boolean;
  abstract resume(
    session: ChatSession,
    backendSessionId: string,
    options?: SendMessageOptions,
  ): AsyncIterable<ChatEvent>;

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
    const messages: Message[] = session.messages.map(toAgentMessage);
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

    const agentEvents = agent.streamWithContext(messages, {
      signal: options?.signal,
      context: options?.context,
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
    return this._agentService.listModels();
  }

  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    this.assertNotDisposed();
    return this._agentService.validate();
  }

  async dispose(): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;
    this._agent?.dispose();
    this._agent = null;
    if (this._ownsService) {
      await this._agentService.dispose();
    }
  }

  /** Get or create an agent, applying model override from options */
  protected getOrCreateAgent(options?: SendMessageOptions): IAgent {
    const config = options?.model
      ? { ...this._agentConfig, model: options.model }
      : this._agentConfig;

    // For persistent session mode, reuse the agent
    if (this._agentConfig.sessionMode === "persistent" && this._agent) {
      return this._agent;
    }

    // Create fresh agent
    const agent = this._agentService.createAgent(config);
    if (this._agentConfig.sessionMode === "persistent") {
      this._agent = agent;
    }
    return agent;
  }

  /** Subclasses capture backend session ID from agent after streaming */
  protected abstract captureSessionId(agent: IAgent): void;

  protected assertNotDisposed(): void {
    if (this._disposed) {
      throw new ChatError("Adapter is disposed", {
        code: ChatErrorCode.DISPOSED,
      });
    }
  }
}
