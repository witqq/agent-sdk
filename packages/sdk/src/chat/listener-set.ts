/**
 * Generic listener set utility for subscribe/notify patterns.
 *
 * Encapsulates the recurring pattern of:
 * - Set<callback> storage
 * - add(callback) → unsubscribe function
 * - notify(...args) with try/catch per listener
 * - clear() for disposal
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ListenerSet<T extends (...args: any[]) => void> {
  private readonly _listeners = new Set<T>();

  /** Add a listener. Returns an unsubscribe function. */
  add(callback: T): () => void {
    this._listeners.add(callback);
    return () => { this._listeners.delete(callback); };
  }

  /** Notify all listeners with the given arguments. Errors are isolated per listener. */
  notify(...args: Parameters<T>): void {
    for (const cb of this._listeners) {
      try { cb(...args); } catch { /* listener errors must not propagate */ }
    }
  }

  /** Remove all listeners. */
  clear(): void {
    this._listeners.clear();
  }

  /** Current number of listeners. */
  get size(): number {
    return this._listeners.size;
  }
}
