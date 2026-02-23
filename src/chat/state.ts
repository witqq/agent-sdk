/**
 * @witqq/agent-sdk/chat/state
 *
 * Validated state machines for runtime, message, and tool-call lifecycles.
 * Generic StateMachine<S> with declarative transition maps.
 */

import type { RuntimeStatus, MessageStatus, ToolCallStatus } from "./core.js";
import { ChatError, ChatErrorCode } from "./errors.js";

// ─── Generic State Machine ─────────────────────────────────────

/** Map of allowed transitions: current state → set of valid next states */
export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

/**
 * Generic validated state machine.
 * Enforces that every transition is declared in the transition map.
 * Throws ChatError(INVALID_TRANSITION) on illegal moves.
 */
export class StateMachine<S extends string> {
  private _current: S;

  constructor(
    readonly initial: S,
    readonly transitions: TransitionMap<S>,
  ) {
    this._current = initial;
  }

  /** Current state */
  get current(): S {
    return this._current;
  }

  /**
   * Check whether transitioning to `next` is allowed from current state
   * @param next - Target state to check
   * @returns True if transition is allowed
   */
  canTransition(next: S): boolean {
    const allowed = this.transitions[this._current];
    return allowed !== undefined && allowed.includes(next);
  }

  /**
   * Transition to `next` state.
   * @throws ChatError(INVALID_TRANSITION) if the transition is not allowed
   */
  transition(next: S): void {
    if (!this.canTransition(next)) {
      throw new ChatError(
        `Invalid transition: ${this._current} → ${next}`,
        { code: ChatErrorCode.INVALID_TRANSITION },
      );
    }
    this._current = next;
  }

  /** Reset to initial state */
  reset(): void {
    this._current = this.initial;
  }
}

// ─── Transition Maps ───────────────────────────────────────────

/** Allowed transitions for RuntimeStatus (idle → streaming/disposed, etc.) */
export const RUNTIME_TRANSITIONS: TransitionMap<RuntimeStatus> = {
  idle: ["streaming", "disposed"],
  streaming: ["idle", "error", "disposed"],
  error: ["idle", "disposed"],
  disposed: [],
};

/** Allowed transitions for MessageStatus (pending → streaming → complete, etc.) */
export const MESSAGE_TRANSITIONS: TransitionMap<MessageStatus> = {
  pending: ["streaming", "error", "cancelled"],
  streaming: ["complete", "error", "cancelled"],
  complete: [],
  error: [],
  cancelled: [],
};

/** Allowed transitions for ToolCallStatus (pending → running → complete, etc.) */
export const TOOL_CALL_TRANSITIONS: TransitionMap<ToolCallStatus> = {
  pending: ["running", "requires_approval", "error"],
  running: ["complete", "error"],
  requires_approval: ["running", "denied", "error"],
  complete: [],
  error: [],
  denied: [],
};

// ─── Pre-configured Factories ──────────────────────────────────

/** Create a RuntimeStatus state machine starting at "idle" */
export function createRuntimeStateMachine(): StateMachine<RuntimeStatus> {
  return new StateMachine<RuntimeStatus>("idle", RUNTIME_TRANSITIONS);
}

/** Create a MessageStatus state machine starting at "pending" */
export function createMessageStateMachine(): StateMachine<MessageStatus> {
  return new StateMachine<MessageStatus>("pending", MESSAGE_TRANSITIONS);
}

/** Create a ToolCallStatus state machine starting at "pending" */
export function createToolCallStateMachine(): StateMachine<ToolCallStatus> {
  return new StateMachine<ToolCallStatus>("pending", TOOL_CALL_TRANSITIONS);
}

// ─── Reentrancy Guard ──────────────────────────────────────────

/**
 * Guards against concurrent send() calls in a chat runtime.
 * acquire() before work, release() after (use try/finally).
 * Throws ChatError(REENTRANCY) if already acquired.
 */
export class ChatReentrancyGuard {
  private _acquired = false;

  /** Whether the guard is currently held */
  get isAcquired(): boolean {
    return this._acquired;
  }

  /**
   * Acquire the guard. Throws if already acquired.
   * @throws ChatError with code REENTRANCY
   */
  acquire(): void {
    if (this._acquired) {
      throw new ChatError(
        "Concurrent operation detected: a send is already in progress",
        { code: ChatErrorCode.REENTRANCY },
      );
    }
    this._acquired = true;
  }

  /** Release the guard. Safe to call even if not acquired. */
  release(): void {
    this._acquired = false;
  }
}

// ─── Abort Controller ──────────────────────────────────────────

/**
 * Abort controller with external signal linking.
 * Wraps an AbortController and optionally links an external AbortSignal
 * so aborting either side cancels the operation.
 */
export class ChatAbortController {
  private readonly _controller: AbortController;
  private readonly _onExternalAbort?: () => void;
  private readonly _externalSignal?: AbortSignal;

  constructor(externalSignal?: AbortSignal) {
    this._controller = new AbortController();
    this._externalSignal = externalSignal;

    if (externalSignal) {
      // If external signal already aborted, abort immediately
      if (externalSignal.aborted) {
        this._controller.abort(externalSignal.reason);
      } else {
        // Link: external abort → our controller
        this._onExternalAbort = () => {
          this._controller.abort(externalSignal.reason);
        };
        externalSignal.addEventListener("abort", this._onExternalAbort, { once: true });
      }
    }
  }

  /** The AbortSignal for this controller */
  get signal(): AbortSignal {
    return this._controller.signal;
  }

  /** Whether the operation has been aborted */
  get isAborted(): boolean {
    return this._controller.signal.aborted;
  }

  /**
   * Abort the operation.
   * @param reason - Optional abort reason
   */
  abort(reason?: unknown): void {
    this._controller.abort(reason);
  }

  /** Clean up external signal listener to prevent memory leaks */
  dispose(): void {
    if (this._onExternalAbort && this._externalSignal) {
      this._externalSignal.removeEventListener("abort", this._onExternalAbort);
    }
  }
}
