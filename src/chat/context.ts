/**
 * @witqq/agent-sdk/chat/context
 *
 * Context window manager for selecting which messages fit within a token budget.
 * Stateless: takes messages in, returns trimmed messages out.
 * Three overflow strategies: truncate-oldest, sliding-window, summarize-placeholder.
 */

import type { ChatMessage, MessagePart } from "./core.js";

// ─── Token Estimation ──────────────────────────────────────────

/**
 * Options for token estimation.
 */
export interface TokenEstimationOptions {
  /**
   * Characters per token ratio.
   * Lower = more conservative (fewer messages fit).
   * @default 4
   */
  charsPerToken?: number;
}

/**
 * Estimate token count for a single chat message.
 * Uses character-based heuristic: `Math.ceil(charCount / charsPerToken)`.
 *
 * Counts:
 * - Text content (string or text parts)
 * - Serialized tool calls and tool results
 * - Thinking blocks
 * - Role overhead (~4 tokens)
 *
 * @param message - Chat message to estimate
 * @param options - Estimation options
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * const tokens = estimateTokens(message);
 * const conservative = estimateTokens(message, { charsPerToken: 3 });
 * ```
 */
export function estimateTokens(
  message: ChatMessage,
  options?: TokenEstimationOptions,
): number {
  const ratio = options?.charsPerToken ?? 4;
  let charCount = 0;

  // Role overhead
  charCount += message.role.length + 4;

  // Parts
  for (const part of message.parts) {
    charCount += estimatePartChars(part);
  }

  return Math.ceil(charCount / ratio);
}

function estimatePartChars(part: MessagePart): number {
  switch (part.type) {
    case "text":
      return part.text.length;
    case "reasoning":
      return part.text.length;
    case "tool_call":
      return JSON.stringify(part.args).length + part.name.length + 20 +
        (part.result !== undefined ? JSON.stringify(part.result).length : 0);
    case "source":
      return (part.title?.length ?? 0) + part.url.length + 10;
    case "file":
      return part.name.length + part.data.length + 20;
  }
}

// ─── Overflow Strategies ───────────────────────────────────────

/** Overflow strategy type */
export type OverflowStrategy =
  | "truncate-oldest"
  | "sliding-window"
  | "summarize-placeholder";

// ─── Context Window Configuration ──────────────────────────────

/**
 * Async summarizer function for the summarize-placeholder strategy.
 * Receives removed messages and returns a summary string.
 * When configured, replaces the static placeholder text with actual summary.
 */
export type ContextSummarizer = (removedMessages: readonly ChatMessage[]) => Promise<string>;

/**
 * Configuration for the context window manager.
 */
export interface ContextWindowConfig {
  /** Maximum token budget for the context window */
  maxTokens: number;

  /**
   * Tokens reserved for system prompt and response generation.
   * Subtracted from maxTokens to get available budget.
   * @default 0
   */
  reservedTokens?: number;

  /**
   * Strategy for handling overflow when messages exceed budget.
   * @default "truncate-oldest"
   */
  strategy?: OverflowStrategy;

  /**
   * Token estimation options.
   */
  estimation?: TokenEstimationOptions;

  /**
   * Optional async summarizer for the summarize-placeholder strategy.
   * When provided, replaces the static placeholder with a generated summary.
   * Falls back to static placeholder if summarizer throws.
   */
  summarizer?: ContextSummarizer;
}

// ─── Context Window Result ─────────────────────────────────────

/**
 * Result of context window trimming.
 */
export interface ContextWindowResult {
  /** Messages that fit within the budget */
  messages: ChatMessage[];
  /** Total estimated tokens for included messages */
  totalTokens: number;
  /** Number of messages removed */
  removedCount: number;
  /** Whether any messages were truncated */
  wasTruncated: boolean;
}

// ─── Context Stats ─────────────────────────────────────────────

/**
 * Context usage statistics for a session.
 * Returned by `IChatRuntime.getContextStats()`.
 *
 * When real usage data is available (after the first API response),
 * `realPromptTokens` and `realCompletionTokens` contain actual token counts.
 * `modelContextWindow` is the model's context window from `listModels()`.
 */
export interface ContextStats {
  /** Estimated total tokens in the trimmed context (heuristic, kept for backward compat) */
  totalTokens: number;
  /** Number of messages removed by trimming */
  removedCount: number;
  /** Whether context was truncated */
  wasTruncated: boolean;
  /** Available token budget (maxTokens − reservedTokens) */
  availableBudget: number;
  /** Real prompt tokens from the last API response (undefined before first response) */
  realPromptTokens?: number;
  /** Real completion tokens from the last API response (undefined before first response) */
  realCompletionTokens?: number;
  /** Model's context window in tokens from listModels() (undefined if not available) */
  modelContextWindow?: number;
}

// ─── Context Window Manager ────────────────────────────────────

/**
 * Stateless context window manager.
 * Takes messages and returns the subset that fits within a token budget.
 *
 * @example
 * ```typescript
 * const manager = new ContextWindowManager({
 *   maxTokens: 4096,
 *   reservedTokens: 500,
 *   strategy: "sliding-window",
 * });
 *
 * const result = manager.fitMessages(messages);
 * // result.messages — trimmed to fit budget
 * // result.totalTokens — estimated token usage
 * // result.wasTruncated — whether messages were removed
 * ```
 */
export class ContextWindowManager {
  private readonly config: Required<
    Pick<ContextWindowConfig, "maxTokens" | "reservedTokens" | "strategy">
  > &
    Pick<ContextWindowConfig, "estimation" | "summarizer">;

  constructor(config: ContextWindowConfig) {
    this.config = {
      maxTokens: config.maxTokens,
      reservedTokens: config.reservedTokens ?? 0,
      strategy: config.strategy ?? "truncate-oldest",
      estimation: config.estimation,
      summarizer: config.summarizer,
    };
  }

  /** Available token budget after reserving tokens */
  get availableBudget(): number {
    return Math.max(0, this.config.maxTokens - this.config.reservedTokens);
  }

  /**
   * Estimate tokens for a single message.
   * @param message - Message to estimate
   * @returns Estimated token count
   */
  estimateMessageTokens(message: ChatMessage): number {
    return estimateTokens(message, this.config.estimation);
  }

  /**
   * Fit messages within the token budget using the configured strategy.
   * @param messages - All messages to consider
   * @returns Result with fitted messages and metadata
   */
  fitMessages(messages: readonly ChatMessage[]): ContextWindowResult {
    if (messages.length === 0) {
      return { messages: [], totalTokens: 0, removedCount: 0, wasTruncated: false };
    }

    const budget = this.availableBudget;

    // Calculate tokens for each message
    const tokenCounts = messages.map((m) => this.estimateMessageTokens(m));
    const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);

    // All messages fit
    if (totalTokens <= budget) {
      return {
        messages: [...messages],
        totalTokens,
        removedCount: 0,
        wasTruncated: false,
      };
    }

    switch (this.config.strategy) {
      case "truncate-oldest":
        return this.truncateOldest(messages, tokenCounts, budget);
      case "sliding-window":
        return this.slidingWindow(messages, tokenCounts, budget);
      case "summarize-placeholder":
        return this.summarizePlaceholder(messages, tokenCounts, budget);
    }
  }

  /**
   * Async variant of fitMessages that supports async summarization.
   * When strategy is "summarize-placeholder" and a summarizer is configured,
   * calls the summarizer with removed messages and replaces the placeholder text.
   * Falls back to static placeholder if summarizer throws.
   * For other strategies, behaves identically to fitMessages().
   */
  async fitMessagesAsync(messages: readonly ChatMessage[]): Promise<ContextWindowResult> {
    const result = this.fitMessages(messages);

    // Only enhance if summarize-placeholder strategy, messages were removed, and summarizer is configured
    if (
      this.config.strategy !== "summarize-placeholder" ||
      !result.wasTruncated ||
      !this.config.summarizer
    ) {
      return result;
    }

    // Find removed messages (those in original but not in result)
    const keptIds = new Set(result.messages.map(m => m.id));
    const removed = messages.filter(m => !keptIds.has(m.id));
    if (removed.length === 0) return result;

    // Call async summarizer, fall back to static placeholder on error
    let summaryText: string;
    try {
      summaryText = await this.config.summarizer(removed);
    } catch {
      return result; // Keep static placeholder on summarizer failure
    }

    // Replace placeholder text with summarizer output
    const updatedMessages = result.messages.map(m => {
      if ((m.metadata as Record<string, unknown>)?.isSummary === true) {
        return {
          ...m,
          parts: [{ type: "text" as const, text: summaryText, status: "complete" as const }],
        };
      }
      return m;
    });

    return { ...result, messages: updatedMessages };
  }

  /**
   * Trim messages using real token usage data from the previous API call.
   * Uses average-based algorithm: `avgTokensPerMessage = lastPromptTokens / messageCount`.
   * Removes oldest non-system messages until freed budget brings usage under modelContextWindow.
   *
   * @param messages - All messages in the session
   * @param lastPromptTokens - Real prompt tokens from the last API response
   * @param modelContextWindow - Model's total context window size in tokens
   * @returns Result with fitted messages and metadata
   */
  fitMessagesWithUsage(
    messages: readonly ChatMessage[],
    lastPromptTokens: number,
    modelContextWindow: number,
  ): ContextWindowResult {
    if (messages.length === 0) {
      return { messages: [], totalTokens: 0, removedCount: 0, wasTruncated: false };
    }

    const budget = modelContextWindow - this.config.reservedTokens;
    if (budget <= 0 || lastPromptTokens <= budget) {
      return {
        messages: [...messages],
        totalTokens: lastPromptTokens,
        removedCount: 0,
        wasTruncated: false,
      };
    }

    // Average tokens per message from real data
    const avgTokensPerMessage = lastPromptTokens / messages.length;

    // How many tokens we need to free
    const tokensToFree = lastPromptTokens - budget;
    // How many messages to remove (ceil to be safe)
    const messagesToRemove = Math.ceil(tokensToFree / avgTokensPerMessage);

    // Separate system and non-system messages
    const systemIndices: number[] = [];
    const nonSystemIndices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "system") {
        systemIndices.push(i);
      } else {
        nonSystemIndices.push(i);
      }
    }

    // Remove oldest non-system messages (from the beginning of conversation)
    const removableCount = Math.min(messagesToRemove, nonSystemIndices.length);
    const removedIndices = new Set(nonSystemIndices.slice(0, removableCount));

    const result: ChatMessage[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (!removedIndices.has(i)) {
        result.push(messages[i]);
      }
    }

    // Estimate new total: proportional reduction
    const estimatedTokens = Math.round(
      lastPromptTokens * (result.length / messages.length),
    );

    return {
      messages: result,
      totalTokens: estimatedTokens,
      removedCount: removableCount,
      wasTruncated: removableCount > 0,
    };
  }

  /**
   * Truncate oldest: keeps system messages, removes oldest non-system messages first.
   * Always keeps the most recent user message.
   */
  private truncateOldest(
    messages: readonly ChatMessage[],
    tokenCounts: number[],
    budget: number,
  ): ContextWindowResult {
    // Separate system messages (always kept) and non-system
    const systemIndices: number[] = [];
    const nonSystemIndices: number[] = [];

    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "system") {
        systemIndices.push(i);
      } else {
        nonSystemIndices.push(i);
      }
    }

    // System messages cost
    let usedTokens = systemIndices.reduce(
      (sum, i) => sum + tokenCounts[i],
      0,
    );

    // If system messages alone exceed budget, still include them
    // (caller should configure reservedTokens properly)

    // Try to fit non-system from newest to oldest
    const includedNonSystem: number[] = [];
    for (let i = nonSystemIndices.length - 1; i >= 0; i--) {
      const idx = nonSystemIndices[i];
      if (usedTokens + tokenCounts[idx] <= budget) {
        includedNonSystem.unshift(idx);
        usedTokens += tokenCounts[idx];
      }
    }

    // Build result preserving original order
    const includedSet = new Set([...systemIndices, ...includedNonSystem]);
    const result: ChatMessage[] = [];
    let resultTokens = 0;
    for (let i = 0; i < messages.length; i++) {
      if (includedSet.has(i)) {
        result.push(messages[i]);
        resultTokens += tokenCounts[i];
      }
    }

    return {
      messages: result,
      totalTokens: resultTokens,
      removedCount: messages.length - result.length,
      wasTruncated: true,
    };
  }

  /**
   * Sliding window: keeps the most recent messages that fit within budget.
   */
  private slidingWindow(
    messages: readonly ChatMessage[],
    tokenCounts: number[],
    budget: number,
  ): ContextWindowResult {
    const result: ChatMessage[] = [];
    let usedTokens = 0;

    // Walk from newest to oldest
    for (let i = messages.length - 1; i >= 0; i--) {
      if (usedTokens + tokenCounts[i] <= budget) {
        result.unshift(messages[i]);
        usedTokens += tokenCounts[i];
      } else {
        break;
      }
    }

    return {
      messages: result,
      totalTokens: usedTokens,
      removedCount: messages.length - result.length,
      wasTruncated: true,
    };
  }

  /**
   * Summarize placeholder: replaces truncated messages with a placeholder,
   * preserving system messages and recent context.
   */
  private summarizePlaceholder(
    messages: readonly ChatMessage[],
    tokenCounts: number[],
    budget: number,
  ): ContextWindowResult {
    // First, identify system messages and recent messages
    const systemMessages: { msg: ChatMessage; tokens: number }[] = [];
    const nonSystem: { msg: ChatMessage; tokens: number; idx: number }[] = [];

    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "system") {
        systemMessages.push({ msg: messages[i], tokens: tokenCounts[i] });
      } else {
        nonSystem.push({ msg: messages[i], tokens: tokenCounts[i], idx: i });
      }
    }

    // System message cost
    let usedTokens = systemMessages.reduce((s, m) => s + m.tokens, 0);

    // Placeholder costs ~20 tokens
    const placeholderTokens = 20;
    usedTokens += placeholderTokens;

    // Fit recent non-system messages from newest
    const recentKept: typeof nonSystem = [];
    for (let i = nonSystem.length - 1; i >= 0; i--) {
      if (usedTokens + nonSystem[i].tokens <= budget) {
        recentKept.unshift(nonSystem[i]);
        usedTokens += nonSystem[i].tokens;
      } else {
        break;
      }
    }

    const removedCount =
      messages.length -
      systemMessages.length -
      recentKept.length;

    // Build result: system messages, placeholder, recent messages
    const result: ChatMessage[] = [];

    // System messages first
    for (const sm of systemMessages) {
      result.push(sm.msg);
    }

    // Placeholder if messages were removed
    if (removedCount > 0) {
      result.push({
        id: "context-placeholder" as ChatMessage["id"],
        role: "system",
        parts: [{ type: "text", text: `[${removedCount} earlier message${removedCount === 1 ? "" : "s"} omitted for context window]`, status: "complete" as const }],
        metadata: { isSummary: true },
        createdAt: new Date().toISOString(),
        status: "complete",
      });
    }

    // Recent messages
    for (const m of recentKept) {
      result.push(m.msg);
    }

    return {
      messages: result,
      totalTokens: usedTokens,
      removedCount,
      wasTruncated: true,
    };
  }
}
