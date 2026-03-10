/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { Thread } from "../../../src/chat/react/Thread.js";
import { PermissionDialog } from "../../../src/chat/react/PermissionDialog.js";
import type { ChatMessage, PartStatus } from "../../../src/chat/core.js";
import type { PendingToolRequest } from "../../../src/chat/react/useToolApproval.js";

// jsdom doesn't implement scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// ─── Helpers ──────────────────────────────────────────────────

function makeMsg(id: string, text = "hello"): ChatMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text, status: "complete" as PartStatus }],
    status: "complete",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeManyMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => makeMsg(`msg-${i}`, `Message ${i}`));
}

function makeRequest(id: string, name = "search"): PendingToolRequest {
  return { toolCallId: id, toolName: name, toolArgs: { q: "test" }, messageId: "m1" };
}

// ─── Thread Virtualization ────────────────────────────────────

describe("Thread virtualization", () => {
  it("renders data-thread-virtualized when virtualize=true", () => {
    const { container } = render(
      createElement(Thread, { messages: [], virtualize: true }),
    );
    expect(container.querySelector("[data-thread-virtualized]")).toBeTruthy();
  });

  it("does NOT set data-thread-virtualized by default", () => {
    const { container } = render(
      createElement(Thread, { messages: [] }),
    );
    expect(container.querySelector("[data-thread-virtualized]")).toBeNull();
  });

  it("renders all messages when not virtualized", () => {
    const msgs = makeManyMessages(50);
    const { container } = render(
      createElement(Thread, { messages: msgs }),
    );
    const rendered = container.querySelectorAll("[data-thread-message]");
    expect(rendered.length).toBe(50);
  });

  it("accepts virtualize options object", () => {
    const msgs = makeManyMessages(5);
    const { container } = render(
      createElement(Thread, {
        messages: msgs,
        virtualize: { estimatedItemHeight: 100, overscan: 2 },
      }),
    );
    expect(container.querySelector("[data-thread-virtualized]")).toBeTruthy();
    // Still renders messages (all fit because container height = 0 in jsdom fallback)
    expect(container.querySelectorAll("[data-thread-message]").length).toBeGreaterThan(0);
  });

  it("preserves empty state with virtualization", () => {
    const { container } = render(
      createElement(Thread, { messages: [], virtualize: true }),
    );
    expect(container.querySelector("[data-thread-empty]")).toBeTruthy();
  });

  it("preserves loading indicator with virtualization", () => {
    const { container } = render(
      createElement(Thread, { messages: [], isGenerating: true, virtualize: true }),
    );
    expect(container.querySelector("[data-thread-loading-indicator]")).toBeTruthy();
  });

  it("renders sentinel element with virtualization", () => {
    const msgs = makeManyMessages(3);
    const { container } = render(
      createElement(Thread, { messages: msgs, virtualize: true }),
    );
    // Sentinel is the last child div before potential scroll button
    const divs = container.querySelectorAll("[data-thread] > div");
    expect(divs.length).toBeGreaterThan(0);
  });
});

// ─── PermissionDialog ─────────────────────────────────────────

describe("PermissionDialog", () => {
  it("returns null when no requests", () => {
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [],
        onApprove: vi.fn(),
        onDeny: vi.fn(),
      }),
    );
    expect(container.querySelector("[data-permission-dialog]")).toBeNull();
  });

  it("renders a dialog for pending requests", () => {
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [makeRequest("tc-1", "read_file")],
        onApprove: vi.fn(),
        onDeny: vi.fn(),
      }),
    );
    const dialog = container.querySelector("[data-permission-dialog]");
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute("role")).toBe("dialog");
  });

  it("renders tool name and args for each request", () => {
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [makeRequest("tc-1", "search_web")],
        onApprove: vi.fn(),
        onDeny: vi.fn(),
      }),
    );
    const nameEl = container.querySelector("[data-permission-tool-name]");
    expect(nameEl?.textContent).toBe("search_web");

    const argsEl = container.querySelector("[data-permission-tool-args] pre");
    expect(argsEl?.textContent).toContain('"q"');
  });

  it("calls onApprove when Allow is clicked", () => {
    const onApprove = vi.fn();
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [makeRequest("tc-1")],
        onApprove,
        onDeny: vi.fn(),
      }),
    );
    const btn = container.querySelector("[data-action='approve']") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onApprove).toHaveBeenCalledWith("tc-1");
  });

  it("calls onDeny when Deny is clicked", () => {
    const onDeny = vi.fn();
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [makeRequest("tc-2")],
        onApprove: vi.fn(),
        onDeny,
      }),
    );
    const btn = container.querySelector("[data-action='deny']") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onDeny).toHaveBeenCalledWith("tc-2");
  });

  it("renders multiple requests", () => {
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [makeRequest("tc-1", "tool_a"), makeRequest("tc-2", "tool_b")],
        onApprove: vi.fn(),
        onDeny: vi.fn(),
      }),
    );
    const items = container.querySelectorAll("[data-permission-request]");
    expect(items.length).toBe(2);
    expect(items[0].getAttribute("data-tool-name")).toBe("tool_a");
    expect(items[1].getAttribute("data-tool-name")).toBe("tool_b");
  });

  it("renders bulk actions when multiple requests and handlers provided", () => {
    const onApproveAll = vi.fn();
    const onDenyAll = vi.fn();
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [makeRequest("tc-1"), makeRequest("tc-2")],
        onApprove: vi.fn(),
        onDeny: vi.fn(),
        onApproveAll,
        onDenyAll,
      }),
    );
    const approveAll = container.querySelector("[data-action='approve-all']") as HTMLButtonElement;
    const denyAll = container.querySelector("[data-action='deny-all']") as HTMLButtonElement;
    expect(approveAll).toBeTruthy();
    expect(denyAll).toBeTruthy();

    fireEvent.click(approveAll);
    expect(onApproveAll).toHaveBeenCalledOnce();

    fireEvent.click(denyAll);
    expect(onDenyAll).toHaveBeenCalledOnce();
  });

  it("does NOT render bulk actions for single request", () => {
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [makeRequest("tc-1")],
        onApprove: vi.fn(),
        onDeny: vi.fn(),
        onApproveAll: vi.fn(),
        onDenyAll: vi.fn(),
      }),
    );
    expect(container.querySelector("[data-action='approve-all']")).toBeNull();
    expect(container.querySelector("[data-action='deny-all']")).toBeNull();
  });

  it("uses custom renderArgs when provided", () => {
    const renderArgs = (args: Record<string, unknown>) =>
      createElement("span", { "data-custom-args": "true" }, JSON.stringify(args));
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [makeRequest("tc-1")],
        onApprove: vi.fn(),
        onDeny: vi.fn(),
        renderArgs,
      }),
    );
    expect(container.querySelector("[data-custom-args]")).toBeTruthy();
    expect(container.querySelector("pre")).toBeNull(); // default pre is replaced
  });

  it("passes className to container", () => {
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [makeRequest("tc-1")],
        onApprove: vi.fn(),
        onDeny: vi.fn(),
        className: "my-dialog",
      }),
    );
    const dialog = container.querySelector("[data-permission-dialog]");
    expect(dialog?.className).toBe("my-dialog");
  });

  it("has aria-label on approve/deny buttons", () => {
    const { container } = render(
      createElement(PermissionDialog, {
        requests: [makeRequest("tc-1", "run_code")],
        onApprove: vi.fn(),
        onDeny: vi.fn(),
      }),
    );
    const approve = container.querySelector("[data-action='approve']");
    const deny = container.querySelector("[data-action='deny']");
    expect(approve?.getAttribute("aria-label")).toBe("Approve run_code");
    expect(deny?.getAttribute("aria-label")).toBe("Deny run_code");
  });
});
