import { describe, it, expect } from "vitest";
import {
  StateMachine,
  RUNTIME_TRANSITIONS,
  MESSAGE_TRANSITIONS,
  TOOL_CALL_TRANSITIONS,
  createRuntimeStateMachine,
  createMessageStateMachine,
  createToolCallStateMachine,
  ChatReentrancyGuard,
  ChatAbortController,
} from "../../../src/chat/state.js";
import { ChatError, ChatErrorCode } from "../../../src/chat/errors.js";

// ─── Generic StateMachine ──────────────────────────────────────

describe("StateMachine<S>", () => {
  it("starts at initial state", () => {
    const sm = new StateMachine("a", { a: ["b"], b: [] } as const);
    expect(sm.current).toBe("a");
    expect(sm.initial).toBe("a");
  });

  it("transitions to allowed state", () => {
    const sm = new StateMachine("a", { a: ["b", "c"], b: [], c: [] } as const);
    sm.transition("b");
    expect(sm.current).toBe("b");
  });

  it("throws INVALID_TRANSITION on illegal move", () => {
    const sm = new StateMachine("a", { a: ["b"], b: [] } as const);
    expect(() => sm.transition("a")).toThrow(ChatError);
    try {
      sm.transition("a");
    } catch (e) {
      expect(e).toBeInstanceOf(ChatError);
      expect((e as ChatError).code).toBe(ChatErrorCode.INVALID_TRANSITION);
      expect((e as ChatError).message).toContain("a → a");
    }
  });

  it("canTransition returns true for allowed, false for disallowed", () => {
    const sm = new StateMachine("a", { a: ["b"], b: ["a"] } as const);
    expect(sm.canTransition("b")).toBe(true);
    expect(sm.canTransition("a")).toBe(false);
  });

  it("reset returns to initial state", () => {
    const sm = new StateMachine("a", { a: ["b"], b: [] } as const);
    sm.transition("b");
    expect(sm.current).toBe("b");
    sm.reset();
    expect(sm.current).toBe("a");
  });

  it("terminal state has no outgoing transitions", () => {
    const sm = new StateMachine("a", { a: ["b"], b: [] } as const);
    sm.transition("b");
    expect(sm.canTransition("a")).toBe(false);
    expect(sm.canTransition("b")).toBe(false);
    expect(() => sm.transition("a")).toThrow(ChatError);
  });
});

// ─── RuntimeStateMachine ───────────────────────────────────────

describe("RuntimeStateMachine", () => {
  it("starts at idle", () => {
    const sm = createRuntimeStateMachine();
    expect(sm.current).toBe("idle");
  });

  describe("valid transitions", () => {
    const cases: [string, string][] = [
      ["idle", "streaming"],
      ["idle", "disposed"],
      ["streaming", "idle"],
      ["streaming", "error"],
      ["streaming", "disposed"],
      ["error", "idle"],
      ["error", "disposed"],
    ];

    for (const [from, to] of cases) {
      it(`${from} → ${to}`, () => {
        const sm = createRuntimeStateMachine();
        // Navigate to 'from' state
        navigateRuntime(sm, from);
        sm.transition(to as any);
        expect(sm.current).toBe(to);
      });
    }
  });

  describe("invalid transitions", () => {
    const cases: [string, string][] = [
      ["idle", "error"],
      ["idle", "idle"],
      ["streaming", "streaming"],
      ["error", "error"],
      ["error", "streaming"],
      ["disposed", "idle"],
      ["disposed", "streaming"],
      ["disposed", "error"],
      ["disposed", "disposed"],
    ];

    for (const [from, to] of cases) {
      it(`${from} → ${to} throws`, () => {
        const sm = createRuntimeStateMachine();
        navigateRuntime(sm, from);
        expect(() => sm.transition(to as any)).toThrow(ChatError);
      });
    }
  });

  it("disposed is terminal", () => {
    const sm = createRuntimeStateMachine();
    sm.transition("disposed");
    for (const state of ["idle", "streaming", "error", "disposed"] as const) {
      expect(sm.canTransition(state)).toBe(false);
    }
  });
});

// ─── MessageStateMachine ───────────────────────────────────────

describe("MessageStateMachine", () => {
  it("starts at pending", () => {
    const sm = createMessageStateMachine();
    expect(sm.current).toBe("pending");
  });

  describe("valid transitions", () => {
    const cases: [string, string][] = [
      ["pending", "streaming"],
      ["pending", "error"],
      ["pending", "cancelled"],
      ["streaming", "complete"],
      ["streaming", "error"],
      ["streaming", "cancelled"],
    ];

    for (const [from, to] of cases) {
      it(`${from} → ${to}`, () => {
        const sm = createMessageStateMachine();
        navigateMessage(sm, from);
        sm.transition(to as any);
        expect(sm.current).toBe(to);
      });
    }
  });

  describe("invalid transitions", () => {
    const cases: [string, string][] = [
      ["pending", "complete"],
      ["pending", "pending"],
      ["streaming", "pending"],
      ["streaming", "streaming"],
      ["complete", "pending"],
      ["complete", "streaming"],
      ["complete", "error"],
      ["complete", "cancelled"],
      ["error", "pending"],
      ["error", "streaming"],
      ["cancelled", "pending"],
      ["cancelled", "streaming"],
    ];

    for (const [from, to] of cases) {
      it(`${from} → ${to} throws`, () => {
        const sm = createMessageStateMachine();
        navigateMessage(sm, from);
        expect(() => sm.transition(to as any)).toThrow(ChatError);
      });
    }
  });

  it("complete, error, cancelled are terminal", () => {
    for (const terminal of ["complete", "error", "cancelled"] as const) {
      const sm = createMessageStateMachine();
      navigateMessage(sm, terminal);
      for (const state of ["pending", "streaming", "complete", "error", "cancelled"] as const) {
        expect(sm.canTransition(state)).toBe(false);
      }
    }
  });
});

// ─── ToolCallStateMachine ──────────────────────────────────────

describe("ToolCallStateMachine", () => {
  it("starts at pending", () => {
    const sm = createToolCallStateMachine();
    expect(sm.current).toBe("pending");
  });

  describe("valid transitions", () => {
    const cases: [string, string][] = [
      ["pending", "running"],
      ["pending", "requires_approval"],
      ["pending", "error"],
      ["running", "complete"],
      ["running", "error"],
      ["requires_approval", "running"],
      ["requires_approval", "denied"],
      ["requires_approval", "error"],
    ];

    for (const [from, to] of cases) {
      it(`${from} → ${to}`, () => {
        const sm = createToolCallStateMachine();
        navigateToolCall(sm, from);
        sm.transition(to as any);
        expect(sm.current).toBe(to);
      });
    }
  });

  describe("invalid transitions", () => {
    const cases: [string, string][] = [
      ["pending", "complete"],
      ["pending", "denied"],
      ["pending", "pending"],
      ["running", "pending"],
      ["running", "requires_approval"],
      ["running", "running"],
      ["running", "denied"],
      ["requires_approval", "complete"],
      ["requires_approval", "pending"],
      ["complete", "pending"],
      ["complete", "running"],
      ["error", "pending"],
      ["error", "running"],
      ["denied", "pending"],
      ["denied", "running"],
    ];

    for (const [from, to] of cases) {
      it(`${from} → ${to} throws`, () => {
        const sm = createToolCallStateMachine();
        navigateToolCall(sm, from);
        expect(() => sm.transition(to as any)).toThrow(ChatError);
      });
    }
  });

  it("complete, error, denied are terminal", () => {
    for (const terminal of ["complete", "error", "denied"] as const) {
      const sm = createToolCallStateMachine();
      navigateToolCall(sm, terminal);
      for (const state of ["pending", "running", "requires_approval", "complete", "error", "denied"] as const) {
        expect(sm.canTransition(state)).toBe(false);
      }
    }
  });
});

// ─── Transition maps exported correctly ────────────────────────

describe("transition map exports", () => {
  it("RUNTIME_TRANSITIONS has all 4 statuses", () => {
    expect(Object.keys(RUNTIME_TRANSITIONS).sort()).toEqual(
      ["disposed", "error", "idle", "streaming"],
    );
  });

  it("MESSAGE_TRANSITIONS has all 5 statuses", () => {
    expect(Object.keys(MESSAGE_TRANSITIONS).sort()).toEqual(
      ["cancelled", "complete", "error", "pending", "streaming"],
    );
  });

  it("TOOL_CALL_TRANSITIONS has all 6 statuses", () => {
    expect(Object.keys(TOOL_CALL_TRANSITIONS).sort()).toEqual(
      ["complete", "denied", "error", "pending", "requires_approval", "running"],
    );
  });
});

// ─── Error codes exist ─────────────────────────────────────────

describe("new ChatErrorCode values", () => {
  it("INVALID_TRANSITION exists", () => {
    expect(ChatErrorCode.INVALID_TRANSITION).toBe("INVALID_TRANSITION");
  });

  it("REENTRANCY exists", () => {
    expect(ChatErrorCode.REENTRANCY).toBe("REENTRANCY");
  });
});

// ─── ChatReentrancyGuard ───────────────────────────────────────

describe("ChatReentrancyGuard", () => {
  it("starts not acquired", () => {
    const guard = new ChatReentrancyGuard();
    expect(guard.isAcquired).toBe(false);
  });

  it("acquire sets isAcquired to true", () => {
    const guard = new ChatReentrancyGuard();
    guard.acquire();
    expect(guard.isAcquired).toBe(true);
  });

  it("throws REENTRANCY on concurrent acquire", () => {
    const guard = new ChatReentrancyGuard();
    guard.acquire();
    expect(() => guard.acquire()).toThrow(ChatError);
    try {
      guard.acquire();
    } catch (e) {
      expect(e).toBeInstanceOf(ChatError);
      expect((e as ChatError).code).toBe(ChatErrorCode.REENTRANCY);
    }
  });

  it("release allows re-acquire", () => {
    const guard = new ChatReentrancyGuard();
    guard.acquire();
    guard.release();
    expect(guard.isAcquired).toBe(false);
    // Should not throw
    guard.acquire();
    expect(guard.isAcquired).toBe(true);
  });

  it("double release is safe (no-op)", () => {
    const guard = new ChatReentrancyGuard();
    guard.acquire();
    guard.release();
    guard.release(); // no throw
    expect(guard.isAcquired).toBe(false);
  });

  it("release without acquire is safe", () => {
    const guard = new ChatReentrancyGuard();
    guard.release(); // no throw
    expect(guard.isAcquired).toBe(false);
  });

  it("try/finally pattern works correctly", () => {
    const guard = new ChatReentrancyGuard();
    try {
      guard.acquire();
      // simulate work
    } finally {
      guard.release();
    }
    expect(guard.isAcquired).toBe(false);
    // Can acquire again
    guard.acquire();
    expect(guard.isAcquired).toBe(true);
  });
});

// ─── ChatAbortController ───────────────────────────────────────

describe("ChatAbortController", () => {
  it("creates with signal not aborted", () => {
    const ctrl = new ChatAbortController();
    expect(ctrl.isAborted).toBe(false);
    expect(ctrl.signal.aborted).toBe(false);
  });

  it("abort() sets isAborted to true", () => {
    const ctrl = new ChatAbortController();
    ctrl.abort();
    expect(ctrl.isAborted).toBe(true);
    expect(ctrl.signal.aborted).toBe(true);
  });

  it("abort() with reason propagates reason", () => {
    const ctrl = new ChatAbortController();
    ctrl.abort("user cancelled");
    expect(ctrl.signal.reason).toBe("user cancelled");
  });

  it("signal fires abort event", () => {
    const ctrl = new ChatAbortController();
    let fired = false;
    ctrl.signal.addEventListener("abort", () => { fired = true; });
    ctrl.abort();
    expect(fired).toBe(true);
  });

  it("links external signal: external abort → our signal", () => {
    const external = new AbortController();
    const ctrl = new ChatAbortController(external.signal);
    expect(ctrl.isAborted).toBe(false);
    external.abort("external reason");
    expect(ctrl.isAborted).toBe(true);
    expect(ctrl.signal.reason).toBe("external reason");
  });

  it("already-aborted external signal aborts immediately", () => {
    const external = new AbortController();
    external.abort("pre-aborted");
    const ctrl = new ChatAbortController(external.signal);
    expect(ctrl.isAborted).toBe(true);
    expect(ctrl.signal.reason).toBe("pre-aborted");
  });

  it("our abort does not throw if external not linked", () => {
    const ctrl = new ChatAbortController();
    ctrl.abort();
    expect(ctrl.isAborted).toBe(true);
  });

  it("dispose removes external listener (no memory leak)", () => {
    const external = new AbortController();
    const ctrl = new ChatAbortController(external.signal);
    ctrl.dispose();
    // After dispose, external abort should not propagate
    external.abort("after dispose");
    expect(ctrl.isAborted).toBe(false);
  });

  it("dispose is safe to call without external signal", () => {
    const ctrl = new ChatAbortController();
    ctrl.dispose(); // no throw
    expect(ctrl.isAborted).toBe(false);
  });

  it("double abort is safe", () => {
    const ctrl = new ChatAbortController();
    ctrl.abort();
    ctrl.abort(); // no throw
    expect(ctrl.isAborted).toBe(true);
  });
});

// ─── Navigation helpers ────────────────────────────────────────

function navigateRuntime(sm: StateMachine<any>, target: string): void {
  if (sm.current === target) return;
  const paths: Record<string, string[]> = {
    idle: [],
    streaming: ["streaming"],
    error: ["streaming", "error"],
    disposed: ["disposed"],
  };
  for (const step of paths[target] ?? []) {
    sm.transition(step);
  }
}

function navigateMessage(sm: StateMachine<any>, target: string): void {
  if (sm.current === target) return;
  const paths: Record<string, string[]> = {
    pending: [],
    streaming: ["streaming"],
    complete: ["streaming", "complete"],
    error: ["error"],
    cancelled: ["cancelled"],
  };
  for (const step of paths[target] ?? []) {
    sm.transition(step);
  }
}

function navigateToolCall(sm: StateMachine<any>, target: string): void {
  if (sm.current === target) return;
  const paths: Record<string, string[]> = {
    pending: [],
    running: ["running"],
    requires_approval: ["requires_approval"],
    complete: ["running", "complete"],
    error: ["error"],
    denied: ["requires_approval", "denied"],
  };
  for (const step of paths[target] ?? []) {
    sm.transition(step);
  }
}
