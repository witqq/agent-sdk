/**
 * Tests for withStreamWatchdog() — stream inactivity timeout wrapper
 */

import { describe, it, expect, vi } from "vitest";
import { withStreamWatchdog } from "../../../src/chat/watchdog.js";
import { ChatError, ErrorCode } from "../../../src/chat/errors.js";

// ─── Helpers ───────────────────────────────────────────────────

/** Create an async iterable from an array (yields all immediately) */
async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

/** Create an async iterable that yields items with delays between them */
async function* fromArrayWithDelays<T>(
  items: T[],
  delayMs: number,
): AsyncGenerator<T> {
  for (const item of items) {
    await new Promise((r) => setTimeout(r, delayMs));
    yield item;
  }
}

/** Create an async iterable that hangs after yielding N items */
async function* hangAfter<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
  // Hang forever (simulates stalled stream)
  await new Promise(() => {});
}

/** Collect all items from an async iterable */
async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of source) {
    items.push(item);
  }
  return items;
}

// ─── Tests ─────────────────────────────────────────────────────

describe("withStreamWatchdog", () => {
  describe("normal completion", () => {
    it("passes through all events from source", async () => {
      const items = ["a", "b", "c"];
      const watched = withStreamWatchdog(fromArray(items), { timeoutMs: 5000 });

      const result = await collect(watched);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("passes through empty stream", async () => {
      const watched = withStreamWatchdog(fromArray([]), { timeoutMs: 5000 });
      const result = await collect(watched);
      expect(result).toEqual([]);
    });

    it("does not throw when stream completes before timeout", async () => {
      const items = [1, 2, 3];
      const watched = withStreamWatchdog(fromArray(items), {
        timeoutMs: 60000,
      });

      await expect(collect(watched)).resolves.toEqual([1, 2, 3]);
    });
  });

  describe("timeout behavior", () => {
    it("throws ChatError(TIMEOUT) when stream stalls", async () => {
      const watched = withStreamWatchdog(hangAfter(["first"]), {
        timeoutMs: 50,
      });

      const items: string[] = [];
      await expect(
        (async () => {
          for await (const event of watched) {
            items.push(event);
          }
        })(),
      ).rejects.toThrow(/timed out after 50ms/i);
      expect(items).toEqual(["first"]);
    });

    it("throws with TIMEOUT error code", async () => {
      const watched = withStreamWatchdog(hangAfter([]), { timeoutMs: 50 });

      try {
        await collect(watched);
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ChatError);
        expect((err as ChatError).code).toBe(ErrorCode.TIMEOUT);
      }
    });

    it("resets timer on each event", async () => {
      // Source yields events with 30ms delays, timeout is 50ms
      // Without reset: would timeout after 50ms (before 2nd event)
      // With reset: each event resets the 50ms timer, so all complete
      const items = ["a", "b", "c"];
      const watched = withStreamWatchdog(fromArrayWithDelays(items, 30), {
        timeoutMs: 50,
      });

      const result = await collect(watched);
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("uses custom timeout value", async () => {
      const watched = withStreamWatchdog(hangAfter(["x"]), {
        timeoutMs: 100,
      });

      const items: string[] = [];
      await expect(
        (async () => {
          for await (const event of watched) {
            items.push(event);
          }
        })(),
      ).rejects.toThrow(/timed out after 100ms/i);
      expect(items).toEqual(["x"]);
    });
  });

  describe("AbortSignal integration", () => {
    it("stops iteration when signal is aborted mid-stream", async () => {
      const controller = new AbortController();
      const watched = withStreamWatchdog(hangAfter(["a", "b"]), {
        timeoutMs: 60000,
        signal: controller.signal,
      });

      const items: string[] = [];
      const iter = watched[Symbol.asyncIterator]();

      // Consume first 2 events
      const r1 = await iter.next();
      if (!r1.done) items.push(r1.value);
      const r2 = await iter.next();
      if (!r2.done) items.push(r2.value);

      // Abort while hanging — next() should resolve to done
      controller.abort();
      const r3 = await iter.next();
      expect(r3.done).toBe(true);
      expect(items).toEqual(["a", "b"]);
    });

    it("exits immediately when signal already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const watched = withStreamWatchdog(fromArray(["x", "y"]), {
        timeoutMs: 5000,
        signal: controller.signal,
      });

      const result = await collect(watched);
      expect(result).toEqual([]);
    });

    it("does not throw timeout when aborted externally", async () => {
      const controller = new AbortController();
      const watched = withStreamWatchdog(hangAfter([]), {
        timeoutMs: 5000,
        signal: controller.signal,
      });

      // Abort immediately
      controller.abort();
      const result = await collect(watched);
      expect(result).toEqual([]);
    });
  });

  describe("cleanup", () => {
    it("calls iterator.return() in finally", async () => {
      const returnFn = vi.fn().mockResolvedValue({ done: true, value: undefined });
      let resolveNext: ((v: IteratorResult<string>) => void) | undefined;
      const fakeIterator: AsyncIterator<string> = {
        next: vi.fn()
          .mockImplementationOnce(() => Promise.resolve({ done: false, value: "first" }))
          .mockImplementation(() => new Promise((r) => { resolveNext = r; })),
        return: returnFn,
      };
      const fakeIterable: AsyncIterable<string> = {
        [Symbol.asyncIterator]: () => fakeIterator,
      };

      const watched = withStreamWatchdog(fakeIterable, { timeoutMs: 50 });

      try {
        await collect(watched);
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ChatError);
      }
      expect(returnFn).toHaveBeenCalled();
    });

    it("removes abort listener after completion", async () => {
      const controller = new AbortController();
      const spy = vi.spyOn(controller.signal, "removeEventListener");

      const watched = withStreamWatchdog(fromArray(["a"]), {
        timeoutMs: 5000,
        signal: controller.signal,
      });

      await collect(watched);
      expect(spy).toHaveBeenCalledWith("abort", expect.any(Function));
    });
  });

  describe("type safety", () => {
    it("preserves generic type parameter", async () => {
      interface MyEvent {
        type: string;
        data: number;
      }
      const events: MyEvent[] = [
        { type: "a", data: 1 },
        { type: "b", data: 2 },
      ];

      const watched = withStreamWatchdog(fromArray(events), {
        timeoutMs: 5000,
      });

      const result = await collect(watched);
      expect(result[0].type).toBe("a");
      expect(result[1].data).toBe(2);
    });
  });
});
