import { describe, it, expect, vi } from "vitest";
import { ListenerSet } from "../../../src/chat/listener-set.js";

describe("ListenerSet", () => {
  it("should add and notify listeners", () => {
    const set = new ListenerSet<() => void>();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    set.add(cb1);
    set.add(cb2);

    set.notify();

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("should remove listener via unsubscribe function", () => {
    const set = new ListenerSet<() => void>();
    const cb = vi.fn();
    const unsub = set.add(cb);

    unsub();
    set.notify();

    expect(cb).not.toHaveBeenCalled();
  });

  it("should pass arguments to listeners", () => {
    const set = new ListenerSet<(a: string, b: number) => void>();
    const cb = vi.fn();
    set.add(cb);

    set.notify("hello", 42);

    expect(cb).toHaveBeenCalledWith("hello", 42);
  });

  it("should isolate errors between listeners", () => {
    const set = new ListenerSet<() => void>();
    const cb1 = vi.fn(() => { throw new Error("boom"); });
    const cb2 = vi.fn();
    set.add(cb1);
    set.add(cb2);

    // Must not throw
    set.notify();

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("should clear all listeners", () => {
    const set = new ListenerSet<() => void>();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    set.add(cb1);
    set.add(cb2);

    set.clear();
    set.notify();

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  it("should report correct size", () => {
    const set = new ListenerSet<() => void>();
    expect(set.size).toBe(0);

    const unsub1 = set.add(vi.fn());
    expect(set.size).toBe(1);

    set.add(vi.fn());
    expect(set.size).toBe(2);

    unsub1();
    expect(set.size).toBe(1);

    set.clear();
    expect(set.size).toBe(0);
  });

  it("should not add duplicate references", () => {
    const set = new ListenerSet<() => void>();
    const cb = vi.fn();
    set.add(cb);
    set.add(cb);

    expect(set.size).toBe(1);
    set.notify();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("should handle notify with no listeners", () => {
    const set = new ListenerSet<(x: number) => void>();
    // Must not throw
    set.notify(1);
  });
});
