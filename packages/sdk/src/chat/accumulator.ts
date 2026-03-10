/**
 * @witqq/agent-sdk/chat/accumulator
 *
 * MessageAccumulator converts a stream of AgentEvent objects into a ChatMessage
 * with correct MessagePart array. Handles text, reasoning, and tool call
 * accumulation with proper status transitions.
 */

import type { AgentEvent } from "../types.js";
import type { ChatMessage, ChatId, MessagePart, TextPart, ReasoningPart, ToolCallPart } from "./core.js";
import { createChatId } from "./core.js";

/**
 * Converts a stream of AgentEvent objects into a complete ChatMessage.
 * Tracks text, reasoning, and tool call parts with proper status transitions.
 *
 * @example
 * ```typescript
 * const acc = new MessageAccumulator();
 * for await (const event of agentEvents) {
 *   acc.apply(event);
 *   renderMessage(acc.snapshot()); // in-progress UI update
 * }
 * const message = acc.finalize();
 * ```
 */
export class MessageAccumulator {
  private readonly messageId: ChatId;
  private readonly parts: MessagePart[] = [];
  private status: "pending" | "streaming" | "complete" | "error" | "cancelled" = "pending";
  private currentTextPart: TextPart | null = null;
  private currentReasoningPart: ReasoningPart | null = null;
  private toolCallParts = new Map<string, ToolCallPart>();
  private _finalized = false;

  constructor(messageId?: ChatId) {
    this.messageId = messageId ?? createChatId();
  }

  /** Get current message ID */
  get id(): ChatId { return this.messageId; }

  /**
   * Apply an AgentEvent to accumulate into the message
   * @param event - AgentEvent to process
   * @throws Error if accumulator is already finalized
   */
  apply(event: AgentEvent): void {
    if (this._finalized) throw new Error("Cannot apply events to finalized accumulator");

    if (this.status === "pending") {
      this.status = "streaming";
    }

    switch (event.type) {
      case "text_delta":
        this.handleTextDelta(event.text);
        break;
      case "thinking_start":
        this.finalizeCurrentText();
        this.currentReasoningPart = { type: "reasoning", text: "", status: "streaming" };
        this.parts.push(this.currentReasoningPart);
        break;
      case "thinking_delta":
        if (this.currentReasoningPart) {
          this.currentReasoningPart.text += event.text;
        }
        break;
      case "thinking_end":
        if (this.currentReasoningPart) {
          this.currentReasoningPart.status = "complete";
          this.currentReasoningPart = null;
        }
        break;
      case "tool_call_start": {
        this.finalizeCurrentText();
        const toolPart: ToolCallPart = {
          type: "tool_call",
          toolCallId: event.toolCallId,
          name: event.toolName,
          args: event.args,
          status: "running",
        };
        this.toolCallParts.set(event.toolCallId, toolPart);
        this.parts.push(toolPart);
        break;
      }
      case "tool_call_end": {
        const existing = this.toolCallParts.get(event.toolCallId);
        if (existing) {
          existing.result = event.result;
          existing.status = "complete";
        }
        break;
      }
      case "error":
        this.status = "error";
        break;
      case "done":
        break;
      // Other events (heartbeat, ask_user, etc.) — ignore
    }
  }

  private handleTextDelta(text: string): void {
    if (!this.currentTextPart) {
      this.currentTextPart = { type: "text", text: "", status: "streaming" };
      this.parts.push(this.currentTextPart);
    }
    this.currentTextPart.text += text;
  }

  private finalizeCurrentText(): void {
    if (this.currentTextPart) {
      this.currentTextPart.status = "complete";
      this.currentTextPart = null;
    }
  }

  /**
   * Get a snapshot of the current accumulated message (for streaming UI)
   * @returns ChatMessage with current parts and "streaming" status
   */
  snapshot(): ChatMessage {
    const now = new Date().toISOString();
    return {
      id: this.messageId,
      role: "assistant",
      parts: this.parts.map(p => ({ ...p })),
      status: this.status === "pending" ? "pending" : "streaming",
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Finalize the accumulator and return the complete ChatMessage
   * @returns Completed ChatMessage with all parts finalized
   * @throws Error if accumulator is already finalized
   */
  finalize(): ChatMessage {
    if (this._finalized) throw new Error("Accumulator already finalized");
    this._finalized = true;

    // Finalize any open parts
    this.finalizeCurrentText();
    if (this.currentReasoningPart) {
      this.currentReasoningPart.status = "complete";
      this.currentReasoningPart = null;
    }

    // Mark incomplete tool calls as error
    for (const [, toolPart] of this.toolCallParts) {
      if (toolPart.status === "running" || toolPart.status === "pending") {
        toolPart.status = "error";
      }
    }

    // Set final message status
    if (this.status !== "error" && this.status !== "cancelled") {
      this.status = "complete";
    }

    const now = new Date().toISOString();
    return {
      id: this.messageId,
      role: "assistant",
      parts: this.parts,
      status: this.status,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Check if the accumulator has been finalized */
  get finalized(): boolean { return this._finalized; }
}
