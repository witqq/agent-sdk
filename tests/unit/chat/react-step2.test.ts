/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Message } from "../../../src/chat/react/Message.js";
import { ThinkingBlock } from "../../../src/chat/react/ThinkingBlock.js";
import { ToolCallView } from "../../../src/chat/react/ToolCallView.js";
import { useToolApproval } from "../../../src/chat/react/useToolApproval.js";
import { MarkdownRenderer } from "../../../src/chat/react/MarkdownRenderer.js";
import type {
  ChatMessage,
  ChatId,
  TextPart,
  ReasoningPart,
  ToolCallPart,
  SourcePart,
  FilePart,
} from "../../../src/chat/core.js";

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

// ─── Message Component ────────────────────────────────────────

describe("Message", () => {
  it("renders with data-role and data-status attributes", () => {
    const msg = createTestMessage({
      role: "user",
      status: "streaming",
      parts: [{ type: "text", text: "Hello", status: "complete" }],
    });
    const { container } = render(createElement(Message, { message: msg }));
    const div = container.firstElementChild!;
    expect(div.getAttribute("data-role")).toBe("user");
    expect(div.getAttribute("data-status")).toBe("streaming");
  });

  it("renders text part with default renderer", () => {
    const msg = createTestMessage({
      parts: [{ type: "text", text: "Hello world", status: "complete" }],
    });
    const { container } = render(createElement(Message, { message: msg }));
    const span = container.querySelector("[data-part='text']");
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("Hello world");
  });

  it("renders reasoning part with default renderer", () => {
    const msg = createTestMessage({
      parts: [{ type: "reasoning", text: "Let me think...", status: "complete" }],
    });
    const { container } = render(createElement(Message, { message: msg }));
    const span = container.querySelector("[data-part='reasoning']");
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("Let me think...");
  });

  it("renders tool_call part with default renderer", () => {
    const msg = createTestMessage({
      parts: [{
        type: "tool_call",
        toolCallId: "tc-1",
        name: "search",
        args: { q: "test" },
        status: "complete",
      }],
    });
    const { container } = render(createElement(Message, { message: msg }));
    const span = container.querySelector("[data-part='tool_call']");
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("search");
    expect(span!.getAttribute("data-tool-name")).toBe("search");
  });

  it("renders source part with default renderer", () => {
    const msg = createTestMessage({
      parts: [{ type: "source", url: "https://example.com", title: "Example", status: "complete" }],
    });
    const { container } = render(createElement(Message, { message: msg }));
    const a = container.querySelector("[data-part='source']");
    expect(a).not.toBeNull();
    expect(a!.getAttribute("href")).toBe("https://example.com");
    expect(a!.textContent).toBe("Example");
  });

  it("renders source part without title using URL", () => {
    const msg = createTestMessage({
      parts: [{ type: "source", url: "https://example.com", status: "complete" }],
    });
    const { container } = render(createElement(Message, { message: msg }));
    const a = container.querySelector("[data-part='source']");
    expect(a!.textContent).toBe("https://example.com");
  });

  it("renders file part with default renderer", () => {
    const msg = createTestMessage({
      parts: [{ type: "file", name: "doc.pdf", mimeType: "application/pdf", data: "base64==", status: "complete" }],
    });
    const { container } = render(createElement(Message, { message: msg }));
    const span = container.querySelector("[data-part='file']");
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("doc.pdf");
  });

  it("renders all 5 part types together", () => {
    const msg = createTestMessage({
      parts: [
        { type: "text", text: "Hello", status: "complete" },
        { type: "reasoning", text: "thinking", status: "complete" },
        { type: "tool_call", toolCallId: "tc-1", name: "search", args: {}, status: "complete" },
        { type: "source", url: "https://x.com", status: "complete" },
        { type: "file", name: "f.txt", mimeType: "text/plain", data: "", status: "complete" },
      ],
    });
    const { container } = render(createElement(Message, { message: msg }));
    expect(container.querySelectorAll("[data-part]")).toHaveLength(5);
  });

  it("uses renderText override", () => {
    const msg = createTestMessage({
      parts: [{ type: "text", text: "Hello", status: "complete" }],
    });
    const renderText = (part: TextPart, idx: number) =>
      createElement("b", { key: idx }, part.text.toUpperCase());
    const { container } = render(createElement(Message, { message: msg, renderText }));
    const b = container.querySelector("b");
    expect(b!.textContent).toBe("HELLO");
  });

  it("uses renderReasoning override", () => {
    const msg = createTestMessage({
      parts: [{ type: "reasoning", text: "think", status: "complete" }],
    });
    const renderReasoning = (part: ReasoningPart, idx: number) =>
      createElement("i", { key: idx }, `R:${part.text}`);
    const { container } = render(createElement(Message, { message: msg, renderReasoning }));
    expect(container.querySelector("i")!.textContent).toBe("R:think");
  });

  it("uses renderToolCall override", () => {
    const msg = createTestMessage({
      parts: [{ type: "tool_call", toolCallId: "tc-1", name: "run", args: {}, status: "complete" }],
    });
    const renderToolCall = (part: ToolCallPart, idx: number) =>
      createElement("div", { key: idx, id: "custom-tool" }, `Tool:${part.name}`);
    const { container } = render(createElement(Message, { message: msg, renderToolCall }));
    expect(container.querySelector("#custom-tool")!.textContent).toBe("Tool:run");
  });

  it("uses renderSource override", () => {
    const msg = createTestMessage({
      parts: [{ type: "source", url: "https://x.com", title: "X", status: "complete" }],
    });
    const renderSource = (part: SourcePart, idx: number) =>
      createElement("span", { key: idx, id: "custom-src" }, part.title);
    const { container } = render(createElement(Message, { message: msg, renderSource }));
    expect(container.querySelector("#custom-src")!.textContent).toBe("X");
  });

  it("uses renderFile override", () => {
    const msg = createTestMessage({
      parts: [{ type: "file", name: "a.txt", mimeType: "text/plain", data: "", status: "complete" }],
    });
    const renderFile = (part: FilePart, idx: number) =>
      createElement("span", { key: idx, id: "custom-file" }, `File:${part.name}`);
    const { container } = render(createElement(Message, { message: msg, renderFile }));
    expect(container.querySelector("#custom-file")!.textContent).toBe("File:a.txt");
  });
});

// ─── ThinkingBlock Component ──────────────────────────────────

describe("ThinkingBlock", () => {
  it("renders details/summary structure", () => {
    const { container } = render(createElement(ThinkingBlock, { text: "content" }));
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    const summary = details!.querySelector("summary");
    expect(summary).not.toBeNull();
  });

  it("has data-thinking attribute", () => {
    const { container } = render(createElement(ThinkingBlock, { text: "content" }));
    const details = container.querySelector("details");
    expect(details!.getAttribute("data-thinking")).toBe("true");
  });

  it("shows 'Reasoning' summary when not streaming", () => {
    const { container } = render(createElement(ThinkingBlock, { text: "done" }));
    const summary = container.querySelector("summary");
    expect(summary!.textContent).toBe("Reasoning");
  });

  it("shows 'Thinking...' summary when streaming", () => {
    const { container } = render(
      createElement(ThinkingBlock, { text: "in progress", isStreaming: true }),
    );
    const summary = container.querySelector("summary");
    expect(summary!.textContent).toBe("Thinking...");
  });

  it("has data-streaming attribute when streaming", () => {
    const { container } = render(
      createElement(ThinkingBlock, { text: "x", isStreaming: true }),
    );
    const details = container.querySelector("details");
    expect(details!.getAttribute("data-streaming")).toBe("true");
  });

  it("does not have data-streaming when not streaming", () => {
    const { container } = render(createElement(ThinkingBlock, { text: "x" }));
    const details = container.querySelector("details");
    expect(details!.hasAttribute("data-streaming")).toBe(false);
  });

  it("sets open attribute when defaultOpen is true", () => {
    const { container } = render(
      createElement(ThinkingBlock, { text: "x", defaultOpen: true }),
    );
    const details = container.querySelector("details");
    expect(details!.hasAttribute("open")).toBe(true);
  });

  it("renders text content", () => {
    const { container } = render(createElement(ThinkingBlock, { text: "My reasoning" }));
    expect(container.textContent).toContain("My reasoning");
  });
});

// ─── ToolCallView Component ──────────────────────────────────

describe("ToolCallView", () => {
  const basePart: ToolCallPart = {
    type: "tool_call",
    toolCallId: "tc-1",
    name: "search",
    args: { query: "test" },
    status: "complete",
  };

  it("displays tool name", () => {
    const { container } = render(createElement(ToolCallView, { part: basePart }));
    const nameEl = container.querySelector("[data-tool-label='name']");
    expect(nameEl!.textContent).toBe("search");
  });

  it("has data-tool-status attribute", () => {
    const { container } = render(createElement(ToolCallView, { part: basePart }));
    const div = container.firstElementChild!;
    expect(div.getAttribute("data-tool-status")).toBe("complete");
  });

  it("has data-tool-name attribute", () => {
    const { container } = render(createElement(ToolCallView, { part: basePart }));
    const div = container.firstElementChild!;
    expect(div.getAttribute("data-tool-name")).toBe("search");
  });

  it("renders args as JSON by default", () => {
    const { container } = render(createElement(ToolCallView, { part: basePart }));
    const argsEl = container.querySelector("[data-tool-label='args']");
    expect(argsEl).not.toBeNull();
    expect(argsEl!.textContent).toContain('"query"');
  });

  it("renders result when present", () => {
    const part: ToolCallPart = { ...basePart, result: { data: 42 } };
    const { container } = render(createElement(ToolCallView, { part }));
    const resultEl = container.querySelector("[data-tool-label='result']");
    expect(resultEl).not.toBeNull();
    expect(resultEl!.textContent).toContain("42");
  });

  it("renders error when present", () => {
    const part: ToolCallPart = { ...basePart, status: "error", error: "Something failed" };
    const { container } = render(createElement(ToolCallView, { part }));
    const errorEl = container.querySelector("[data-tool-label='error']");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toBe("Something failed");
    expect(errorEl!.getAttribute("role")).toBe("alert");
  });

  it("shows approve/deny buttons when status is requires_approval", () => {
    const part: ToolCallPart = { ...basePart, status: "requires_approval" };
    const { container } = render(createElement(ToolCallView, { part }));
    const approveBtn = container.querySelector("[data-action='approve']");
    const denyBtn = container.querySelector("[data-action='deny']");
    expect(approveBtn).not.toBeNull();
    expect(denyBtn).not.toBeNull();
    expect(approveBtn!.textContent).toBe("Approve");
    expect(denyBtn!.textContent).toBe("Deny");
  });

  it("does not show approve/deny buttons for completed status", () => {
    const { container } = render(createElement(ToolCallView, { part: basePart }));
    expect(container.querySelector("[data-action='approve']")).toBeNull();
    expect(container.querySelector("[data-action='deny']")).toBeNull();
  });

  it("calls onApprove when approve button clicked", () => {
    const part: ToolCallPart = { ...basePart, status: "requires_approval" };
    const onApprove = vi.fn();
    const { container } = render(createElement(ToolCallView, { part, onApprove }));
    fireEvent.click(container.querySelector("[data-action='approve']")!);
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("calls onDeny when deny button clicked", () => {
    const part: ToolCallPart = { ...basePart, status: "requires_approval" };
    const onDeny = vi.fn();
    const { container } = render(createElement(ToolCallView, { part, onDeny }));
    fireEvent.click(container.querySelector("[data-action='deny']")!);
    expect(onDeny).toHaveBeenCalledTimes(1);
  });

  it("uses custom renderArgs", () => {
    const renderArgs = (args: unknown) =>
      createElement("div", { id: "custom-args" }, `Args: ${JSON.stringify(args)}`);
    const { container } = render(createElement(ToolCallView, { part: basePart, renderArgs }));
    expect(container.querySelector("#custom-args")).not.toBeNull();
  });

  it("uses custom renderResult", () => {
    const part: ToolCallPart = { ...basePart, result: "ok" };
    const renderResult = (result: unknown) =>
      createElement("div", { id: "custom-result" }, `Result: ${result}`);
    const { container } = render(createElement(ToolCallView, { part, renderResult }));
    expect(container.querySelector("#custom-result")!.textContent).toBe("Result: ok");
  });
});

// ─── useToolApproval Hook ─────────────────────────────────────

describe("useToolApproval", () => {
  it("returns empty pendingRequests when no tool calls require approval", () => {
    const messages: ChatMessage[] = [
      createTestMessage({
        parts: [
          { type: "tool_call", toolCallId: "tc-1", name: "search", args: {}, status: "complete" },
        ],
      }),
    ];
    const { result } = renderHook(() => useToolApproval(messages));
    expect(result.current.pendingRequests).toHaveLength(0);
  });

  it("tracks tool calls with requires_approval status", () => {
    const messages: ChatMessage[] = [
      createTestMessage({
        id: "msg-A" as unknown as ChatId,
        parts: [
          { type: "tool_call", toolCallId: "tc-1", name: "delete_file", args: { path: "/tmp" }, status: "requires_approval" },
        ],
      }),
    ];
    const { result } = renderHook(() => useToolApproval(messages));
    expect(result.current.pendingRequests).toHaveLength(1);
    expect(result.current.pendingRequests[0]).toEqual({
      toolCallId: "tc-1",
      toolName: "delete_file",
      toolArgs: { path: "/tmp" },
      messageId: "msg-A",
    });
  });

  it("tracks multiple pending requests across messages", () => {
    const messages: ChatMessage[] = [
      createTestMessage({
        id: "msg-A" as unknown as ChatId,
        parts: [
          { type: "tool_call", toolCallId: "tc-1", name: "a", args: {}, status: "requires_approval" },
        ],
      }),
      createTestMessage({
        id: "msg-B" as unknown as ChatId,
        parts: [
          { type: "tool_call", toolCallId: "tc-2", name: "b", args: {}, status: "requires_approval" },
          { type: "tool_call", toolCallId: "tc-3", name: "c", args: {}, status: "complete" },
        ],
      }),
    ];
    const { result } = renderHook(() => useToolApproval(messages));
    expect(result.current.pendingRequests).toHaveLength(2);
    expect(result.current.pendingRequests[0].toolCallId).toBe("tc-1");
    expect(result.current.pendingRequests[1].toolCallId).toBe("tc-2");
  });

  it("calls onApprove callback when approve is called", () => {
    const onApprove = vi.fn();
    const messages: ChatMessage[] = [
      createTestMessage({
        parts: [
          { type: "tool_call", toolCallId: "tc-1", name: "x", args: {}, status: "requires_approval" },
        ],
      }),
    ];
    const { result } = renderHook(() => useToolApproval(messages, onApprove));
    result.current.approve("tc-1");
    expect(onApprove).toHaveBeenCalledWith("tc-1");
  });

  it("calls onDeny callback when deny is called", () => {
    const onDeny = vi.fn();
    const messages: ChatMessage[] = [
      createTestMessage({
        parts: [
          { type: "tool_call", toolCallId: "tc-1", name: "x", args: {}, status: "requires_approval" },
        ],
      }),
    ];
    const { result } = renderHook(() => useToolApproval(messages, undefined, onDeny));
    result.current.deny("tc-1");
    expect(onDeny).toHaveBeenCalledWith("tc-1");
  });

  it("ignores non-tool_call parts", () => {
    const messages: ChatMessage[] = [
      createTestMessage({
        parts: [
          { type: "text", text: "Hello", status: "complete" },
          { type: "reasoning", text: "think", status: "complete" },
        ],
      }),
    ];
    const { result } = renderHook(() => useToolApproval(messages));
    expect(result.current.pendingRequests).toHaveLength(0);
  });
});

// ─── MarkdownRenderer Component ──────────────────────────────

describe("MarkdownRenderer", () => {
  it("renders a root div with data-md-root", () => {
    const { container } = render(createElement(MarkdownRenderer, { content: "Hello" }));
    const root = container.querySelector("[data-md-root]");
    expect(root).not.toBeNull();
  });

  it("renders headings h1-h6", () => {
    const md = "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    for (let i = 1; i <= 6; i++) {
      const heading = container.querySelector(`h${i}`);
      expect(heading).not.toBeNull();
      expect(heading!.textContent).toBe(`H${i}`);
      expect(heading!.hasAttribute("data-md-heading")).toBe(true);
    }
  });

  it("renders paragraphs", () => {
    const md = "First paragraph\n\nSecond paragraph";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const paragraphs = container.querySelectorAll("[data-md-paragraph]");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe("First paragraph");
    expect(paragraphs[1].textContent).toBe("Second paragraph");
  });

  it("renders bold text", () => {
    const md = "This is **bold** text";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe("bold");
  });

  it("renders italic text with asterisks", () => {
    const md = "This is *italic* text";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const em = container.querySelector("em");
    expect(em).not.toBeNull();
    expect(em!.textContent).toBe("italic");
  });

  it("renders italic text with underscores", () => {
    const md = "This is _italic_ text";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const em = container.querySelector("em");
    expect(em).not.toBeNull();
    expect(em!.textContent).toBe("italic");
  });

  it("renders inline code with data-md-inline-code", () => {
    const md = "Use `console.log` here";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const code = container.querySelector("[data-md-inline-code]");
    expect(code).not.toBeNull();
    expect(code!.textContent).toBe("console.log");
    expect(code!.tagName.toLowerCase()).toBe("code");
  });

  it("renders code blocks with language class and data-md-code-block", () => {
    const md = "```typescript\nconst x = 1;\n```";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const pre = container.querySelector("[data-md-code-block]");
    expect(pre).not.toBeNull();
    const code = pre!.querySelector("code");
    expect(code).not.toBeNull();
    expect(code!.className).toBe("language-typescript");
    expect(code!.textContent).toBe("const x = 1;");
  });

  it("renders code blocks without language", () => {
    const md = "```\nhello\n```";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const pre = container.querySelector("[data-md-code-block]");
    expect(pre).not.toBeNull();
    const code = pre!.querySelector("code");
    expect(code!.className).toBe("");
  });

  it("renders links", () => {
    const md = "Visit [Google](https://google.com) now";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const a = container.querySelector("a");
    expect(a).not.toBeNull();
    expect(a!.getAttribute("href")).toBe("https://google.com");
    expect(a!.textContent).toBe("Google");
  });

  it("renders blockquotes with data-md-blockquote", () => {
    const md = "> This is a quote";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const bq = container.querySelector("[data-md-blockquote]");
    expect(bq).not.toBeNull();
    expect(bq!.textContent).toBe("This is a quote");
  });

  it("renders unordered lists with data-md-list", () => {
    const md = "- Item 1\n- Item 2\n- Item 3";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const ul = container.querySelector("ul[data-md-list]");
    expect(ul).not.toBeNull();
    const items = ul!.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe("Item 1");
  });

  it("renders ordered lists with data-md-list", () => {
    const md = "1. First\n2. Second\n3. Third";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const ol = container.querySelector("ol[data-md-list]");
    expect(ol).not.toBeNull();
    const items = ol!.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe("First");
  });

  it("uses renderCode override for code blocks", () => {
    const md = "```js\nalert(1)\n```";
    const renderCode = (code: string, lang?: string) =>
      createElement("div", { id: "custom-code" }, `${lang}: ${code}`);
    const { container } = render(createElement(MarkdownRenderer, { content: md, renderCode }));
    const custom = container.querySelector("#custom-code");
    expect(custom).not.toBeNull();
    expect(custom!.textContent).toBe("js: alert(1)");
  });

  it("renders multi-line blockquotes", () => {
    const md = "> Line 1\n> Line 2";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const bq = container.querySelector("[data-md-blockquote]");
    expect(bq).not.toBeNull();
    expect(bq!.textContent).toContain("Line 1");
    expect(bq!.textContent).toContain("Line 2");
  });

  it("handles empty content", () => {
    const { container } = render(createElement(MarkdownRenderer, { content: "" }));
    const root = container.querySelector("[data-md-root]");
    expect(root).not.toBeNull();
    expect(root!.children).toHaveLength(0);
  });

  it("renders asterisk-based unordered lists", () => {
    const md = "* A\n* B";
    const { container } = render(createElement(MarkdownRenderer, { content: md }));
    const ul = container.querySelector("ul[data-md-list]");
    expect(ul).not.toBeNull();
    const items = ul!.querySelectorAll("li");
    expect(items).toHaveLength(2);
  });
});
