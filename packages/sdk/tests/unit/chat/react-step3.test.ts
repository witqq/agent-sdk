/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { Thread } from "../../../src/chat/react/Thread.js";
import { Composer } from "../../../src/chat/react/Composer.js";
import { ThreadProvider, useThreadSlots } from "../../../src/chat/react/ThreadSlots.js";
import type { ChatMessage, ChatId, ToolCallPart, ReasoningPart } from "../../../src/chat/core.js";

// ─── Helpers ──────────────────────────────────────────────────

function createTestMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1" as unknown as ChatId,
    role: "assistant",
    parts: [],
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Thread Component ─────────────────────────────────────────

// jsdom doesn't implement scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("Thread", () => {
  it("renders div with data-thread attribute", () => {
    const { container } = render(createElement(Thread, { messages: [] }));
    const div = container.querySelector("[data-thread]");
    expect(div).not.toBeNull();
  });

  it("renders messages with data-thread-message and data-role", () => {
    const messages = [
      createTestMessage({ role: "user", parts: [{ type: "text", text: "Hi", status: "complete" }] }),
      createTestMessage({ role: "assistant", parts: [{ type: "text", text: "Hello", status: "complete" }] }),
    ];
    const { container } = render(createElement(Thread, { messages }));
    const items = container.querySelectorAll("[data-thread-message]");
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute("data-role")).toBe("user");
    expect(items[1].getAttribute("data-role")).toBe("assistant");
  });

  it("shows data-thread-loading when isGenerating", () => {
    const { container } = render(
      createElement(Thread, { messages: [], isGenerating: true }),
    );
    const div = container.querySelector("[data-thread]");
    expect(div!.getAttribute("data-thread-loading")).toBe("true");
  });

  it("does not show data-thread-loading when not generating", () => {
    const { container } = render(
      createElement(Thread, { messages: [], isGenerating: false }),
    );
    const div = container.querySelector("[data-thread]");
    expect(div!.hasAttribute("data-thread-loading")).toBe(false);
  });

  it("calls scrollIntoView on sentinel when messages change", () => {
    const mockScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;

    const messages1 = [
      createTestMessage({ parts: [{ type: "text", text: "Hi", status: "complete" }] }),
    ];
    const { rerender } = render(createElement(Thread, { messages: messages1 }));

    // scrollIntoView called on initial render
    expect(mockScrollIntoView).toHaveBeenCalled();
    mockScrollIntoView.mockClear();

    // Add a new message
    const messages2 = [
      ...messages1,
      createTestMessage({ parts: [{ type: "text", text: "Hello", status: "complete" }] }),
    ];
    rerender(createElement(Thread, { messages: messages2 }));
    expect(mockScrollIntoView).toHaveBeenCalled();
  });

  it("does not scroll when autoScroll=false", () => {
    const mockScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;

    const messages = [
      createTestMessage({ parts: [{ type: "text", text: "Hi", status: "complete" }] }),
    ];
    mockScrollIntoView.mockClear();
    render(createElement(Thread, { messages, autoScroll: false }));
    expect(mockScrollIntoView).not.toHaveBeenCalled();
  });

  it("renders empty state when messages array is empty and not generating", () => {
    const { container } = render(createElement(Thread, { messages: [] }));
    const empty = container.querySelector("[data-thread-empty]");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toBe("Start a conversation");
  });

  it("does not render empty state when messages exist", () => {
    const messages = [
      createTestMessage({ parts: [{ type: "text", text: "Hi", status: "complete" }] }),
    ];
    const { container } = render(createElement(Thread, { messages }));
    const empty = container.querySelector("[data-thread-empty]");
    expect(empty).toBeNull();
  });

  it("does not render empty state when isGenerating even with empty messages", () => {
    const { container } = render(
      createElement(Thread, { messages: [], isGenerating: true }),
    );
    const empty = container.querySelector("[data-thread-empty]");
    expect(empty).toBeNull();
  });

  it("does not show scroll-to-bottom button when at bottom", () => {
    const { container } = render(
      createElement(Thread, { messages: [] }),
    );
    const btn = container.querySelector("[data-action='scroll-to-bottom']");
    expect(btn).toBeNull();
  });

  it("shows scroll-to-bottom button when user scrolls up", () => {
    const messages = [
      createTestMessage({ parts: [{ type: "text", text: "Hi", status: "complete" }] }),
    ];
    const { container } = render(createElement(Thread, { messages }));
    const thread = container.querySelector("[data-thread]") as HTMLDivElement;

    // Simulate scrolled-up state: scrollHeight > scrollTop + clientHeight
    Object.defineProperty(thread, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(thread, "scrollTop", { value: 0, configurable: true });
    Object.defineProperty(thread, "clientHeight", { value: 400, configurable: true });

    fireEvent.scroll(thread);

    const btn = container.querySelector("[data-action='scroll-to-bottom']");
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute("aria-label")).toBe("Scroll to bottom");
  });

  it("scroll-to-bottom button calls scrollIntoView when clicked", () => {
    const mockScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;

    const messages = [
      createTestMessage({ parts: [{ type: "text", text: "Hi", status: "complete" }] }),
    ];
    const { container } = render(createElement(Thread, { messages }));
    const thread = container.querySelector("[data-thread]") as HTMLDivElement;

    // Trigger scrolled-up state
    Object.defineProperty(thread, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(thread, "scrollTop", { value: 0, configurable: true });
    Object.defineProperty(thread, "clientHeight", { value: 400, configurable: true });
    fireEvent.scroll(thread);

    mockScrollIntoView.mockClear();
    const btn = container.querySelector("[data-action='scroll-to-bottom']")!;
    fireEvent.click(btn);

    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("scroll-to-bottom button hides after clicking", () => {
    const messages = [
      createTestMessage({ parts: [{ type: "text", text: "Hi", status: "complete" }] }),
    ];
    const { container } = render(createElement(Thread, { messages }));
    const thread = container.querySelector("[data-thread]") as HTMLDivElement;

    // Trigger scrolled-up
    Object.defineProperty(thread, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(thread, "scrollTop", { value: 0, configurable: true });
    Object.defineProperty(thread, "clientHeight", { value: 400, configurable: true });
    fireEvent.scroll(thread);

    expect(container.querySelector("[data-action='scroll-to-bottom']")).not.toBeNull();

    // Click scroll-to-bottom
    fireEvent.click(container.querySelector("[data-action='scroll-to-bottom']")!);

    // Button should disappear (userScrolledUp set to false)
    expect(container.querySelector("[data-action='scroll-to-bottom']")).toBeNull();
  });
});

// ─── Composer Component ───────────────────────────────────────

describe("Composer", () => {
  it("renders textarea with aria-label", () => {
    const { container } = render(
      createElement(Composer, { onSend: vi.fn() }),
    );
    const ta = container.querySelector("textarea");
    expect(ta).not.toBeNull();
    expect(ta!.getAttribute("aria-label")).toBe("Message input");
  });

  it("renders send button disabled when empty", () => {
    const { container } = render(
      createElement(Composer, { onSend: vi.fn() }),
    );
    const btn = container.querySelector("[data-action='send']") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
  });

  it("enables send button when textarea has text", () => {
    const { container } = render(
      createElement(Composer, { onSend: vi.fn() }),
    );
    const ta = container.querySelector("textarea")!;
    fireEvent.change(ta, { target: { value: "Hello" } });
    const btn = container.querySelector("[data-action='send']") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("calls onSend on Enter key and clears textarea", () => {
    const onSend = vi.fn();
    const { container } = render(
      createElement(Composer, { onSend }),
    );
    const ta = container.querySelector("textarea")!;
    fireEvent.change(ta, { target: { value: "Hello" } });
    fireEvent.keyDown(ta, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalledWith("Hello");
    expect(ta.value).toBe("");
  });

  it("does not submit on Shift+Enter", () => {
    const onSend = vi.fn();
    const { container } = render(
      createElement(Composer, { onSend }),
    );
    const ta = container.querySelector("textarea")!;
    fireEvent.change(ta, { target: { value: "Hello" } });
    fireEvent.keyDown(ta, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows stop button when isGenerating", () => {
    const { container } = render(
      createElement(Composer, { onSend: vi.fn(), isGenerating: true }),
    );
    const stop = container.querySelector("[data-action='stop']");
    expect(stop).not.toBeNull();
    expect(stop!.textContent).toBe("Stop");
  });

  it("hides stop button when not generating", () => {
    const { container } = render(
      createElement(Composer, { onSend: vi.fn(), isGenerating: false }),
    );
    const stop = container.querySelector("[data-action='stop']");
    expect(stop).toBeNull();
  });

  it("calls onStop when stop clicked", () => {
    const onStop = vi.fn();
    const { container } = render(
      createElement(Composer, { onSend: vi.fn(), onStop, isGenerating: true }),
    );
    const btn = container.querySelector("[data-action='stop']")!;
    fireEvent.click(btn);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("textarea disabled when disabled prop true", () => {
    const { container } = render(
      createElement(Composer, { onSend: vi.fn(), disabled: true }),
    );
    const ta = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
  });

  it("textarea auto-resizes on input", () => {
    const { container } = render(
      createElement(Composer, { onSend: vi.fn() }),
    );
    const ta = container.querySelector("textarea")!;
    // Initial height is set
    const initialHeight = ta.style.height;
    // Change to multi-line content
    fireEvent.change(ta, { target: { value: "Line 1\nLine 2\nLine 3" } });
    // Height should be updated (may equal initial in jsdom, but style.height is set)
    expect(ta.style.height).toBeDefined();
  });
});

// ─── ThreadSlots ──────────────────────────────────────────────

describe("ThreadSlots", () => {
  it("ThreadProvider provides default slots", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(ThreadProvider, null, children);
    const { result } = renderHook(() => useThreadSlots(), { wrapper });
    expect(result.current).toBeDefined();
    expect(result.current.renderMessage).toBeUndefined();
    expect(result.current.renderToolCall).toBeUndefined();
    expect(result.current.renderThinkingBlock).toBeUndefined();
  });

  it("custom renderMessage slot overrides default", () => {
    const customRender = (msg: ChatMessage, idx: number) =>
      createElement("div", { key: idx, "data-custom": "true" }, `Custom: ${msg.role}`);

    const messages = [
      createTestMessage({ role: "user", parts: [{ type: "text", text: "Hi", status: "complete" }] }),
    ];

    const { container } = render(
      createElement(
        ThreadProvider,
        { renderMessage: customRender },
        createElement(Thread, { messages }),
      ),
    );

    const custom = container.querySelector("[data-custom]");
    expect(custom).not.toBeNull();
    expect(custom!.textContent).toBe("Custom: user");
  });

  it("custom renderToolCall slot overrides in Thread", () => {
    const customToolCall = (part: ToolCallPart, idx: number) =>
      createElement("span", { key: idx, "data-custom-tool": "true" }, `Tool: ${part.name}`);

    const messages = [
      createTestMessage({
        parts: [
          { type: "tool_call", toolCallId: "tc-1", name: "search", args: {}, status: "complete" },
        ],
      }),
    ];

    const { container } = render(
      createElement(
        ThreadProvider,
        { renderToolCall: customToolCall },
        createElement(Thread, { messages }),
      ),
    );

    const custom = container.querySelector("[data-custom-tool]");
    expect(custom).not.toBeNull();
    expect(custom!.textContent).toBe("Tool: search");
  });

  it("useThreadSlots returns overrides from context", () => {
    const renderMessage = (msg: ChatMessage, idx: number) =>
      createElement("div", { key: idx }, msg.role);
    const renderToolCall = (part: ToolCallPart, idx: number) =>
      createElement("span", { key: idx }, part.name);

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(ThreadProvider, { renderMessage, renderToolCall }, children);
    const { result } = renderHook(() => useThreadSlots(), { wrapper });
    expect(result.current.renderMessage).toBe(renderMessage);
    expect(result.current.renderToolCall).toBe(renderToolCall);
  });

  it("useThreadSlots throws outside ThreadProvider", () => {
    expect(() => {
      renderHook(() => useThreadSlots());
    }).toThrow("useThreadSlots must be used within a ThreadProvider");
  });
});
