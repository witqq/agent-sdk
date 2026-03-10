import { describe, it, expect } from "vitest";
import { MessageAccumulator } from "../../../src/chat/accumulator.js";
import type { AgentEvent } from "../../../src/types.js";
import type { ChatId } from "../../../src/chat/core.js";
import { createChatId } from "../../../src/chat/core.js";

// ─── Text accumulation ─────────────────────────────────────────

describe("MessageAccumulator — text accumulation", () => {
  it("accumulates multiple text_delta events into a single TextPart", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "text_delta", text: "Hello " } as AgentEvent);
    acc.apply({ type: "text_delta", text: "world" } as AgentEvent);
    const msg = acc.finalize();

    expect(msg.parts).toHaveLength(1);
    expect(msg.parts[0]).toEqual({
      type: "text",
      text: "Hello world",
      status: "complete",
    });
  });

  it("creates separate TextParts when interrupted by tool call", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "text_delta", text: "before" } as AgentEvent);
    acc.apply({ type: "tool_call_start", toolCallId: "t1", toolName: "read", args: {} } as AgentEvent);
    acc.apply({ type: "tool_call_end", toolCallId: "t1", toolName: "read", result: "ok" } as AgentEvent);
    acc.apply({ type: "text_delta", text: "after" } as AgentEvent);
    const msg = acc.finalize();

    expect(msg.parts).toHaveLength(3);
    expect(msg.parts[0]).toMatchObject({ type: "text", text: "before", status: "complete" });
    expect(msg.parts[1]).toMatchObject({ type: "tool_call", toolCallId: "t1" });
    expect(msg.parts[2]).toMatchObject({ type: "text", text: "after", status: "complete" });
  });
});

// ─── Reasoning blocks ───────────────────────────────────────────

describe("MessageAccumulator — reasoning blocks", () => {
  it("accumulates thinking events into a ReasoningPart", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "thinking_start" } as AgentEvent);
    acc.apply({ type: "thinking_delta", text: "Let me " } as AgentEvent);
    acc.apply({ type: "thinking_delta", text: "think..." } as AgentEvent);
    acc.apply({ type: "thinking_end" } as AgentEvent);
    const msg = acc.finalize();

    expect(msg.parts).toHaveLength(1);
    expect(msg.parts[0]).toEqual({
      type: "reasoning",
      text: "Let me think...",
      status: "complete",
    });
  });

  it("finalizes open reasoning part on finalize", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "thinking_start" } as AgentEvent);
    acc.apply({ type: "thinking_delta", text: "partial" } as AgentEvent);
    // No thinking_end
    const msg = acc.finalize();

    expect(msg.parts).toHaveLength(1);
    expect(msg.parts[0]).toMatchObject({ type: "reasoning", text: "partial", status: "complete" });
  });
});

// ─── Tool calls ─────────────────────────────────────────────────

describe("MessageAccumulator — tool calls", () => {
  it("accumulates tool_call_start and tool_call_end into ToolCallPart", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "tool_call_start", toolCallId: "tc1", toolName: "bash", args: { cmd: "ls" } } as AgentEvent);
    acc.apply({ type: "tool_call_end", toolCallId: "tc1", toolName: "bash", result: "file.txt" } as AgentEvent);
    const msg = acc.finalize();

    expect(msg.parts).toHaveLength(1);
    expect(msg.parts[0]).toEqual({
      type: "tool_call",
      toolCallId: "tc1",
      name: "bash",
      args: { cmd: "ls" },
      result: "file.txt",
      status: "complete",
    });
  });

  it("handles parallel tool calls", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "tool_call_start", toolCallId: "a", toolName: "read", args: { path: "/a" } } as AgentEvent);
    acc.apply({ type: "tool_call_start", toolCallId: "b", toolName: "read", args: { path: "/b" } } as AgentEvent);
    acc.apply({ type: "tool_call_end", toolCallId: "b", toolName: "read", result: "B" } as AgentEvent);
    acc.apply({ type: "tool_call_end", toolCallId: "a", toolName: "read", result: "A" } as AgentEvent);
    const msg = acc.finalize();

    expect(msg.parts).toHaveLength(2);
    expect(msg.parts[0]).toMatchObject({ toolCallId: "a", result: "A", status: "complete" });
    expect(msg.parts[1]).toMatchObject({ toolCallId: "b", result: "B", status: "complete" });
  });

  it("leaves tool call as error if no tool_call_end", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "tool_call_start", toolCallId: "tc1", toolName: "bash", args: {} } as AgentEvent);
    const msg = acc.finalize();

    expect(msg.parts[0]).toMatchObject({ type: "tool_call", status: "error" });
  });
});

// ─── Mixed content ──────────────────────────────────────────────

describe("MessageAccumulator — mixed content", () => {
  it("handles text + thinking + tool calls in correct order", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "thinking_start" } as AgentEvent);
    acc.apply({ type: "thinking_delta", text: "reasoning" } as AgentEvent);
    acc.apply({ type: "thinking_end" } as AgentEvent);
    acc.apply({ type: "text_delta", text: "I'll help. " } as AgentEvent);
    acc.apply({ type: "tool_call_start", toolCallId: "t1", toolName: "bash", args: {} } as AgentEvent);
    acc.apply({ type: "tool_call_end", toolCallId: "t1", toolName: "bash", result: "done" } as AgentEvent);
    acc.apply({ type: "text_delta", text: "Done!" } as AgentEvent);
    const msg = acc.finalize();

    expect(msg.parts.map(p => p.type)).toEqual(["reasoning", "text", "tool_call", "text"]);
    expect(msg.parts[0]).toMatchObject({ type: "reasoning", text: "reasoning" });
    expect(msg.parts[1]).toMatchObject({ type: "text", text: "I'll help. " });
    expect(msg.parts[2]).toMatchObject({ type: "tool_call", toolCallId: "t1" });
    expect(msg.parts[3]).toMatchObject({ type: "text", text: "Done!" });
  });

  it("handles interleaved thinking blocks", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "text_delta", text: "first" } as AgentEvent);
    acc.apply({ type: "thinking_start" } as AgentEvent);
    acc.apply({ type: "thinking_delta", text: "thought1" } as AgentEvent);
    acc.apply({ type: "thinking_end" } as AgentEvent);
    acc.apply({ type: "text_delta", text: "second" } as AgentEvent);
    acc.apply({ type: "thinking_start" } as AgentEvent);
    acc.apply({ type: "thinking_delta", text: "thought2" } as AgentEvent);
    acc.apply({ type: "thinking_end" } as AgentEvent);
    acc.apply({ type: "text_delta", text: "third" } as AgentEvent);
    const msg = acc.finalize();

    expect(msg.parts.map(p => p.type)).toEqual(["text", "reasoning", "text", "reasoning", "text"]);
    expect(msg.parts[0]).toMatchObject({ text: "first", status: "complete" });
    expect(msg.parts[1]).toMatchObject({ text: "thought1", status: "complete" });
    expect(msg.parts[2]).toMatchObject({ text: "second", status: "complete" });
    expect(msg.parts[3]).toMatchObject({ text: "thought2", status: "complete" });
    expect(msg.parts[4]).toMatchObject({ text: "third", status: "complete" });
  });
});

// ─── Snapshot ───────────────────────────────────────────────────

describe("MessageAccumulator — snapshot", () => {
  it("returns streaming status for in-progress accumulation", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "text_delta", text: "partial" } as AgentEvent);
    const snap = acc.snapshot();

    expect(snap.status).toBe("streaming");
    expect(snap.role).toBe("assistant");
    expect(snap.parts).toHaveLength(1);
    expect(snap.parts[0]).toMatchObject({ type: "text", text: "partial", status: "streaming" });
  });

  it("returns pending status before any events", () => {
    const acc = new MessageAccumulator();
    const snap = acc.snapshot();

    expect(snap.status).toBe("pending");
    expect(snap.parts).toHaveLength(0);
  });

  it("returns a copy of parts array (not a reference)", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "text_delta", text: "a" } as AgentEvent);
    const snap1 = acc.snapshot();
    acc.apply({ type: "text_delta", text: "b" } as AgentEvent);
    const snap2 = acc.snapshot();

    expect(snap1.parts).toHaveLength(1);
    expect(snap2.parts).toHaveLength(1);
    // Snapshots are immutable — snap1 text must NOT be affected by subsequent apply
    expect(snap1.parts[0]).toMatchObject({ text: "a" });
    expect(snap2.parts[0]).toMatchObject({ text: "ab" });
  });
});

// ─── Finalize ───────────────────────────────────────────────────

describe("MessageAccumulator — finalize", () => {
  it("sets all parts to complete status", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "text_delta", text: "hello" } as AgentEvent);
    const msg = acc.finalize();

    expect(msg.status).toBe("complete");
    for (const part of msg.parts) {
      if ("status" in part) {
        expect(part.status).toBe("complete");
      }
    }
  });

  it("throws on double finalize", () => {
    const acc = new MessageAccumulator();
    acc.finalize();
    expect(() => acc.finalize()).toThrow("Accumulator already finalized");
  });

  it("throws on apply after finalize", () => {
    const acc = new MessageAccumulator();
    acc.finalize();
    expect(() => acc.apply({ type: "text_delta", text: "x" } as AgentEvent)).toThrow(
      "Cannot apply events to finalized accumulator",
    );
  });

  it("produces empty parts array for empty accumulator", () => {
    const acc = new MessageAccumulator();
    const msg = acc.finalize();

    expect(msg.parts).toEqual([]);
    expect(msg.status).toBe("complete");
    expect(msg.role).toBe("assistant");
  });

  it("returns finalized flag correctly", () => {
    const acc = new MessageAccumulator();
    expect(acc.finalized).toBe(false);
    acc.finalize();
    expect(acc.finalized).toBe(true);
  });
});

// ─── Error status ───────────────────────────────────────────────

describe("MessageAccumulator — error handling", () => {
  it("sets message status to error on error event", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "text_delta", text: "partial" } as AgentEvent);
    acc.apply({ type: "error", error: "something failed", recoverable: false } as AgentEvent);
    const msg = acc.finalize();

    expect(msg.status).toBe("error");
  });
});

// ─── Message ID ─────────────────────────────────────────────────

describe("MessageAccumulator — message ID", () => {
  it("uses provided message ID", () => {
    const id = createChatId();
    const acc = new MessageAccumulator(id);
    expect(acc.id).toBe(id);
    const msg = acc.finalize();
    expect(msg.id).toBe(id);
  });

  it("generates ID when none provided", () => {
    const acc = new MessageAccumulator();
    expect(typeof acc.id).toBe("string");
    expect(acc.id.length).toBeGreaterThan(0);
  });
});

// ─── Ignored events ─────────────────────────────────────────────

describe("MessageAccumulator — ignored events", () => {
  it("ignores heartbeat events without error", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "heartbeat" } as AgentEvent);
    const msg = acc.finalize();
    expect(msg.parts).toEqual([]);
  });

  it("ignores done event (status set by finalize)", () => {
    const acc = new MessageAccumulator();
    acc.apply({ type: "text_delta", text: "hi" } as AgentEvent);
    acc.apply({ type: "done", finalOutput: "hi" } as AgentEvent);
    const msg = acc.finalize();
    expect(msg.status).toBe("complete");
  });
});
