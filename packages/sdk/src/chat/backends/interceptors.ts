/**
 * @witqq/agent-sdk - Transport Interceptors
 *
 * Composable hooks that wrap any IChatTransport to intercept events
 * at the transport boundary. Use for logging, metrics, rate limiting,
 * or event transformation without modifying the transport itself.
 *
 * ```typescript
 * import { withInterceptors } from "@witqq/agent-sdk/chat/backends";
 *
 * const transport = withInterceptors(sseTransport, [
 *   loggingInterceptor(),
 *   metricsInterceptor(),
 * ]);
 * ```
 */

import type { ChatEvent } from "../core.js";
import type { IChatTransport } from "./transport.js";

// ─── Interceptor Types ─────────────────────────────────────────

/** Context passed to interceptor hooks */
export interface InterceptorContext {
  /** The event being intercepted (mutable for beforeSend) */
  event: ChatEvent;
  /** The underlying transport being wrapped */
  transport: IChatTransport;
}

/**
 * Transport interceptor with lifecycle hooks.
 * All hooks are optional — implement only what you need.
 */
export interface TransportInterceptor {
  /** Optional name for debugging */
  name?: string;

  /**
   * Called before each event is sent to the transport.
   * Return the event to send, a modified event, or null to suppress.
   */
  beforeSend?(event: ChatEvent, transport: IChatTransport): ChatEvent | null;

  /** Called after each event is sent to the transport */
  afterSend?(event: ChatEvent, transport: IChatTransport): void;

  /** Called before the transport is closed */
  beforeClose?(transport: IChatTransport): void;

  /** Called when an error is signaled on the transport */
  onError?(error: Error, transport: IChatTransport): void;
}

// ─── Intercepted Transport ─────────────────────────────────────

/**
 * Transport wrapper that applies interceptor hooks.
 * Chains multiple interceptors: beforeSend runs left-to-right,
 * afterSend/beforeClose/onError run left-to-right.
 */
class InterceptedTransport implements IChatTransport {
  private readonly _inner: IChatTransport;
  private readonly _interceptors: readonly TransportInterceptor[];

  constructor(inner: IChatTransport, interceptors: readonly TransportInterceptor[]) {
    this._inner = inner;
    this._interceptors = interceptors;
  }

  get isOpen(): boolean {
    return this._inner.isOpen;
  }

  send(event: ChatEvent): void {
    if (!this.isOpen) return;

    // beforeSend chain: each interceptor can modify or suppress the event
    let current: ChatEvent | null = event;
    for (const interceptor of this._interceptors) {
      if (!interceptor.beforeSend) continue;
      current = interceptor.beforeSend(current, this._inner);
      if (current === null) return; // suppressed
    }

    // Delegate to inner transport
    this._inner.send(current);

    // afterSend chain
    for (const interceptor of this._interceptors) {
      if (interceptor.afterSend) {
        interceptor.afterSend(current, this._inner);
      }
    }
  }

  close(): void {
    // beforeClose chain
    for (const interceptor of this._interceptors) {
      if (interceptor.beforeClose) {
        interceptor.beforeClose(this._inner);
      }
    }
    this._inner.close();
  }

  error(err: Error): void {
    // onError chain
    for (const interceptor of this._interceptors) {
      if (interceptor.onError) {
        interceptor.onError(err, this._inner);
      }
    }
    this._inner.error(err);
  }
}

// ─── Factory Function ──────────────────────────────────────────

/**
 * Wrap a transport with one or more interceptors.
 * Interceptors are applied in order: first interceptor's beforeSend runs first.
 *
 * @param transport - Base transport to wrap
 * @param interceptors - Array of interceptors to apply
 * @returns Wrapped transport with interceptor hooks
 */
export function withInterceptors(
  transport: IChatTransport,
  interceptors: TransportInterceptor[],
): IChatTransport {
  if (interceptors.length === 0) return transport;
  return new InterceptedTransport(transport, interceptors);
}
