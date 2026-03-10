/**
 * @witqq/agent-sdk/chat/events
 *
 * Type-safe event emitter, chat event bus, and middleware pipeline.
 * Generic TypedEventEmitter<EventMap> for arbitrary typed event maps.
 * ChatEventBus specializing TypedEventEmitter for ChatEvent types.
 * Middleware support for event interception, transformation, and suppression.
 * Utility functions for filtering and mapping event streams.
 */

import type { ChatEvent, ChatEventType } from "./core.js";

// ─── EventMap constraint ──────────────────────────────────────

/** Constraint for event maps: keys are strings, values are payloads */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventMap = Record<string, any>;

// ─── Listener types ───────────────────────────────────────────

/** Listener callback for a specific event */
export type Listener<T> = (payload: T) => void;

/** Unsubscribe function returned by on/once */
export type Unsubscribe = () => void;

// ─── TypedEventEmitter ────────────────────────────────────────

/**
 * Generic type-safe event emitter parameterized by an EventMap.
 *
 * @typeParam T - Map of event names to payload types
 *
 * @example
 * ```typescript
 * type MyEvents = {
 *   message: string;
 *   count: number;
 *   done: void;
 * };
 * const emitter = new TypedEventEmitter<MyEvents>();
 * emitter.on("message", (text) => console.log(text));
 * emitter.emit("message", "hello");
 * ```
 */
export class TypedEventEmitter<T extends EventMap> {
  private readonly listeners = new Map<keyof T, Set<Listener<unknown>>>();

  /**
   * Subscribe to an event.
   * @param event - Event name
   * @param listener - Callback receiving the event payload
   * @returns Unsubscribe function
   */
  on<K extends keyof T>(event: K, listener: Listener<T[K]>): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const fn = listener as Listener<unknown>;
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Subscribe to an event, firing the listener at most once.
   * @param event - Event name
   * @param listener - Callback receiving the event payload
   * @returns Unsubscribe function
   */
  once<K extends keyof T>(event: K, listener: Listener<T[K]>): Unsubscribe {
    const unsub = this.on(event, (payload) => {
      unsub();
      listener(payload);
    });
    return unsub;
  }

  /**
   * Remove a specific listener from an event.
   * @param event - Event name
   * @param listener - The listener to remove
   */
  off<K extends keyof T>(event: K, listener: Listener<T[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener as Listener<unknown>);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event, calling all registered listeners synchronously.
   * @param event - Event name
   * @param payload - Event payload
   */
  emit<K extends keyof T>(event: K, payload: T[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      fn(payload);
    }
  }

  /**
   * Remove all listeners for a specific event, or all events if no event specified.
   * @param event - Optional event name
   */
  removeAllListeners<K extends keyof T>(event?: K): void {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for a specific event.
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount<K extends keyof T>(event: K): number {
    const set = this.listeners.get(event);
    return set ? set.size : 0;
  }

  /**
   * Get all event names that have at least one listener.
   * @returns Array of event names
   */
  eventNames(): Array<keyof T> {
    return [...this.listeners.keys()];
  }
}

// ─── ChatEventMap ─────────────────────────────────────────────

/**
 * Map of ChatEvent type strings to their corresponding ChatEvent payloads.
 * Used to parameterize TypedEventEmitter for chat events.
 */
export type ChatEventMap = {
  [K in ChatEventType]: Extract<ChatEvent, { type: K }>;
};

// ─── Middleware ────────────────────────────────────────────────

/**
 * Context passed to middleware functions.
 * Contains the event and control methods for the middleware pipeline.
 */
export interface MiddlewareContext {
  /** The current event (may be transformed by prior middleware) */
  event: ChatEvent;
  /** Call the next middleware in the chain, or deliver to listeners if last */
  next: () => void;
  /** Suppress the event — do not deliver to listeners or subsequent middleware */
  suppress: () => void;
}

/**
 * Middleware function for intercepting, transforming, or suppressing events.
 * EventMiddleware operates at the ChatEventBus level.
 *
 * @param ctx - Middleware context with event, next(), and suppress()
 *
 * @example
 * ```typescript
 * // Logging middleware
 * const logger: EventMiddleware = (ctx) => {
 *   console.log(`Event: ${ctx.event.type}`);
 *   ctx.next();
 * };
 *
 * // Suppressing middleware
 * const filter: EventMiddleware = (ctx) => {
 *   if (ctx.event.type === "heartbeat") {
 *     ctx.suppress();
 *   } else {
 *     ctx.next();
 *   }
 * };
 * ```
 */
export type EventMiddleware = (ctx: MiddlewareContext) => void;

// ─── ChatEventBus ─────────────────────────────────────────────

/**
 * Chat event bus: a typed event emitter specialized for ChatEvent types
 * with middleware pipeline support.
 *
 * Events pass through the middleware pipeline before reaching listeners.
 * Middleware can inspect, transform, or suppress events.
 *
 * @example
 * ```typescript
 * const bus = new ChatEventBus();
 *
 * // Add middleware
 * bus.use((ctx) => {
 *   console.log(`[${ctx.event.type}]`);
 *   ctx.next();
 * });
 *
 * // Listen for events
 * bus.on("message:delta", (event) => {
 *   console.log(event.text);
 * });
 *
 * // Emit events
 * bus.emit("message:delta", { type: "message:delta", messageId: id, text: "hi" });
 * ```
 */
export class ChatEventBus extends TypedEventEmitter<ChatEventMap> {
  private readonly middlewares: EventMiddleware[] = [];

  /**
   * Register a middleware function. Middleware runs in registration order.
   * @param middleware - Middleware function
   * @returns Unsubscribe function to remove the middleware
   */
  use(middleware: EventMiddleware): Unsubscribe {
    this.middlewares.push(middleware);
    return () => {
      const idx = this.middlewares.indexOf(middleware);
      if (idx !== -1) {
        this.middlewares.splice(idx, 1);
      }
    };
  }

  /**
   * Emit a chat event through the middleware pipeline, then to listeners.
   *
   * @param event - ChatEvent type string
   * @param payload - The full ChatEvent object
   */
  override emit<K extends ChatEventType>(
    event: K,
    payload: ChatEventMap[K],
  ): void {
    if (this.middlewares.length === 0) {
      super.emit(event, payload);
      return;
    }

    let suppressed = false;
    let currentEvent: ChatEvent = payload;
    let index = 0;

    const runNext = (): void => {
      if (suppressed) return;

      if (index >= this.middlewares.length) {
        super.emit(
          currentEvent.type as K,
          currentEvent as ChatEventMap[K],
        );
        return;
      }

      const mw = this.middlewares[index++];
      const ctx: MiddlewareContext = {
        event: currentEvent,
        next: () => {
          currentEvent = ctx.event;
          runNext();
        },
        suppress: () => {
          suppressed = true;
        },
      };
      mw(ctx);
    };

    runNext();
  }

  /**
   * Replace the event in the middleware context.
   * Middleware should mutate ctx.event or create a new MiddlewareContext
   * to transform events passing through the pipeline.
   */

  /**
   * Remove all middleware functions.
   */
  clearMiddleware(): void {
    this.middlewares.length = 0;
  }

  /**
   * Get the number of registered middleware functions.
   * @returns Number of middleware
   */
  middlewareCount(): number {
    return this.middlewares.length;
  }
}

// ─── Utility: Event Filtering ─────────────────────────────────

/**
 * Create a filter function that passes only events of specified types.
 *
 * @param types - Event types to allow through
 * @returns Predicate function for filtering ChatEvents
 *
 * @example
 * ```typescript
 * const isTextEvent = eventFilter("message:start", "message:delta", "message:complete");
 * const textEvents = allEvents.filter(isTextEvent);
 * ```
 */
export function eventFilter(
  ...types: ChatEventType[]
): (event: ChatEvent) => boolean {
  const allowed = new Set<string>(types);
  return (event: ChatEvent) => allowed.has(event.type);
}

/**
 * Filter an async iterable of ChatEvents to only specified types.
 *
 * @param source - Async iterable of ChatEvents
 * @param types - Event types to keep
 * @returns Async iterable of filtered ChatEvents
 *
 * @example
 * ```typescript
 * for await (const event of filterEvents(stream, "message:delta", "message:complete")) {
 *   // only message:delta and message:complete events
 * }
 * ```
 */
export async function* filterEvents(
  source: AsyncIterable<ChatEvent>,
  ...types: ChatEventType[]
): AsyncIterable<ChatEvent> {
  const pred = eventFilter(...types);
  for await (const event of source) {
    if (pred(event)) {
      yield event;
    }
  }
}

// ─── Utility: Event Mapping ───────────────────────────────────

/**
 * Map/transform events from an async iterable.
 *
 * @param source - Async iterable of ChatEvents
 * @param transform - Function to transform each event (return null to skip)
 * @returns Async iterable of transformed values
 *
 * @example
 * ```typescript
 * // Extract text from message:delta events
 * const texts = mapEvents(stream, (event) =>
 *   event.type === "message:delta" ? event.text : null
 * );
 * ```
 */
export async function* mapEvents<R>(
  source: AsyncIterable<ChatEvent>,
  transform: (event: ChatEvent) => R | null,
): AsyncIterable<R> {
  for await (const event of source) {
    const result = transform(event);
    if (result !== null) {
      yield result;
    }
  }
}

/**
 * Collect text from message:delta events into a single string.
 *
 * @param source - Async iterable of ChatEvents
 * @returns Complete text assembled from message:delta payloads
 *
 * @example
 * ```typescript
 * const fullText = await collectText(stream);
 * ```
 */
export async function collectText(
  source: AsyncIterable<ChatEvent>,
): Promise<string> {
  const parts: string[] = [];
  for await (const event of source) {
    if (event.type === "message:delta") {
      parts.push(event.text);
    }
  }
  return parts.join("");
}
