// @vitest-environment jsdom
/**
 * Tests for decomposed ChatUI sub-components:
 * ChatLayout, ChatHeader, ChatInputArea, ChatSettingsOverlay.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { ChatLayout } from "../../../src/chat/react/ChatLayout.js";
import { ChatHeader } from "../../../src/chat/react/ChatHeader.js";
import { ChatInputArea } from "../../../src/chat/react/ChatInputArea.js";
import { ChatSettingsOverlay } from "../../../src/chat/react/ChatSettingsOverlay.js";
import { ChatProvider } from "../../../src/chat/react/ChatProvider.js";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

/* ─── ChatLayout ──────────────────────────────────────────────────── */

describe("ChatLayout", () => {
  it("renders data-chat-ui root with children", () => {
    const { container } = render(
      createElement(ChatLayout, {
        children: createElement("div", { "data-test": "main" }, "Main"),
      }),
    );
    const root = container.querySelector("[data-chat-ui]");
    expect(root).toBeTruthy();
    expect(root!.querySelector("[data-test='main']")).toBeTruthy();
  });

  it("renders sidebar before children", () => {
    const { container } = render(
      createElement(ChatLayout, {
        sidebar: createElement("nav", { "data-sidebar": "" }, "Sidebar"),
        children: createElement("div", { "data-main": "" }, "Main"),
      }),
    );
    const root = container.querySelector("[data-chat-ui]")!;
    const children = Array.from(root.children);
    expect(children.length).toBe(2);
    expect(children[0].getAttribute("data-sidebar")).toBe("");
    expect(children[1].getAttribute("data-main")).toBe("");
  });

  it("renders overlay before sidebar and children", () => {
    const { container } = render(
      createElement(ChatLayout, {
        overlay: createElement("div", { "data-overlay": "" }, "Overlay"),
        sidebar: createElement("nav", { "data-sidebar": "" }),
        children: createElement("div", { "data-main": "" }),
      }),
    );
    const root = container.querySelector("[data-chat-ui]")!;
    const children = Array.from(root.children);
    expect(children[0].getAttribute("data-overlay")).toBe("");
    expect(children[1].getAttribute("data-sidebar")).toBe("");
    expect(children[2].getAttribute("data-main")).toBe("");
  });

  it("accepts overlay as array of nodes", () => {
    const { container } = render(
      createElement(ChatLayout, {
        overlay: [
          createElement("div", { key: "a", "data-auth": "" }),
          createElement("div", { key: "b", "data-settings": "" }),
        ],
        children: createElement("div", null),
      }),
    );
    const root = container.querySelector("[data-chat-ui]")!;
    expect(root.querySelector("[data-auth]")).toBeTruthy();
    expect(root.querySelector("[data-settings]")).toBeTruthy();
  });

  it("applies className to root", () => {
    const { container } = render(
      createElement(ChatLayout, {
        className: "my-chat",
        children: createElement("div", null),
      }),
    );
    const root = container.querySelector("[data-chat-ui]")!;
    expect(root.className).toBe("my-chat");
  });

  it("handles null/undefined sidebar and overlay gracefully", () => {
    const { container } = render(
      createElement(ChatLayout, {
        children: createElement("div", { "data-main": "" }),
      }),
    );
    const root = container.querySelector("[data-chat-ui]")!;
    expect(root.querySelector("[data-main]")).toBeTruthy();
  });
});

/* ─── ChatHeader ──────────────────────────────────────────────────── */

describe("ChatHeader", () => {
  it("returns null when no selectors needed", () => {
    const { container } = render(
      createElement(ChatHeader, {
        showBackendSelector: false,
        showModelSelector: false,
      }),
    );
    expect(container.querySelector("[data-chat-header]")).toBeNull();
  });

  it("returns null when showModelSelector=true but hasProviders=true", () => {
    const { container } = render(
      createElement(ChatHeader, {
        showModelSelector: true,
        hasProviders: true,
        models: [{ id: "m1", name: "Model 1" }],
      }),
    );
    expect(container.querySelector("[data-chat-header]")).toBeNull();
  });

  it("returns null when showModelSelector=true but no models", () => {
    const { container } = render(
      createElement(ChatHeader, {
        showModelSelector: true,
        models: [],
      }),
    );
    expect(container.querySelector("[data-chat-header]")).toBeNull();
  });

  it("renders model selector when models available and no providers", () => {
    const { container } = render(
      createElement(ChatHeader, {
        showModelSelector: true,
        hasProviders: false,
        models: [{ id: "m1", name: "Model 1" }],
      }),
    );
    const header = container.querySelector("[data-chat-header]");
    expect(header).toBeTruthy();
    expect(header!.querySelector("[data-model-selector-trigger]")).toBeTruthy();
  });

  it("renders backend selector when showBackendSelector=true", () => {
    const onSelect = vi.fn();
    const { container } = render(
      createElement(ChatHeader, {
        showBackendSelector: true,
        backends: ["copilot", "claude"],
        onBackendSelect: onSelect,
      }),
    );
    const header = container.querySelector("[data-chat-header]");
    expect(header).toBeTruthy();
    expect(header!.querySelector("[data-backend-selector]")).toBeTruthy();
  });

  it("uses custom ModelSelector component slot", () => {
    const CustomModelSelector = () => createElement("div", { "data-custom-model": "" });
    const { container } = render(
      createElement(ChatHeader, {
        showModelSelector: true,
        hasProviders: false,
        models: [{ id: "m1", name: "M1" }],
        ModelSelectorComponent: CustomModelSelector as any,
      }),
    );
    expect(container.querySelector("[data-custom-model]")).toBeTruthy();
  });
});

/* ─── ChatInputArea ───────────────────────────────────────────────── */

describe("ChatInputArea", () => {
  it("renders data-chat-input-area container", () => {
    const { container } = render(
      createElement(ChatInputArea, { onSend: vi.fn() }),
    );
    expect(container.querySelector("[data-chat-input-area]")).toBeTruthy();
  });

  it("renders unified bordered container wrapping all controls", () => {
    const { container } = render(
      createElement(ChatInputArea, { onSend: vi.fn() }),
    );
    const bordered = container.querySelector("[data-chat-input-container]");
    expect(bordered).toBeTruthy();
    // Container is inside the outer area
    expect(bordered!.parentElement!.hasAttribute("data-chat-input-area")).toBe(true);
  });

  it("renders controls and composer inside the bordered container", () => {
    const { container } = render(
      createElement(ChatInputArea, { onSend: vi.fn() }),
    );
    const bordered = container.querySelector("[data-chat-input-container]")!;
    // Controls row inside container
    expect(bordered.querySelector("[data-chat-input-controls]")).toBeTruthy();
    // Composer inside container
    expect(bordered.querySelector("[data-composer]")).toBeTruthy();
    // ProviderModelSelector inside controls row
    expect(bordered.querySelector("[data-chat-input-controls] [data-provider-model-selector]")).toBeTruthy();
  });

  it("renders Composer and ProviderModelSelector inside", () => {
    const { container } = render(
      createElement(ChatInputArea, { onSend: vi.fn() }),
    );
    expect(container.querySelector("[data-composer]")).toBeTruthy();
    expect(container.querySelector("[data-provider-model-selector]")).toBeTruthy();
  });

  it("passes placeholder to Composer", () => {
    const { container } = render(
      createElement(ChatInputArea, { onSend: vi.fn(), placeholder: "Type here..." }),
    );
    const textarea = container.querySelector("textarea");
    expect(textarea?.placeholder).toBe("Type here...");
  });

  it("uses custom Composer component slot", () => {
    const CustomComposer = () => createElement("div", { "data-custom-composer": "" });
    const { container } = render(
      createElement(ChatInputArea, {
        onSend: vi.fn(),
        ComposerComponent: CustomComposer as any,
      }),
    );
    expect(container.querySelector("[data-custom-composer]")).toBeTruthy();
    expect(container.querySelector("[data-composer]")).toBeNull();
  });

  it("textarea and send button are inside the bordered container", () => {
    const { container } = render(
      createElement(ChatInputArea, { onSend: vi.fn() }),
    );
    const bordered = container.querySelector("[data-chat-input-container]")!;
    expect(bordered.querySelector("textarea")).toBeTruthy();
    expect(bordered.querySelector("button[data-action='send']")).toBeTruthy();
  });
});

/* ─── ChatSettingsOverlay ─────────────────────────────────────────── */

describe("ChatSettingsOverlay", () => {
  function createMinimalRuntime() {
    return {
      listModels: vi.fn(async () => []),
      onSessionChange: vi.fn(() => () => {}),
    };
  }

  function wrapWithProvider(element: any) {
    return createElement(ChatProvider, { runtime: createMinimalRuntime() as any, children: element });
  }

  it("returns null when not open", () => {
    const { container } = render(
      createElement(ChatSettingsOverlay, { open: false, onClose: vi.fn() }),
    );
    expect(container.querySelector("[data-provider-settings-overlay]")).toBeNull();
  });

  it("renders overlay when open", () => {
    const { container } = render(
      wrapWithProvider(
        createElement(ChatSettingsOverlay, { open: true, onClose: vi.fn() }),
      ),
    );
    expect(container.querySelector("[data-provider-settings-overlay]")).toBeTruthy();
  });

  it("renders ProviderSettings inside overlay", () => {
    const { container } = render(
      wrapWithProvider(
        createElement(ChatSettingsOverlay, { open: true, onClose: vi.fn() }),
      ),
    );
    expect(container.querySelector("[data-provider-settings]")).toBeTruthy();
  });

  it("uses custom ProviderSettings component slot", () => {
    const CustomSettings = () => createElement("div", { "data-custom-settings": "" });
    const { container } = render(
      createElement(ChatSettingsOverlay, {
        open: true,
        onClose: vi.fn(),
        ProviderSettingsComponent: CustomSettings as any,
      }),
    );
    expect(container.querySelector("[data-custom-settings]")).toBeTruthy();
  });

  it("calls onClose when backdrop is clicked (after close animation)", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { container } = render(
      wrapWithProvider(
        createElement(ChatSettingsOverlay, { open: true, onClose }),
      ),
    );
    const overlay = container.querySelector("[data-provider-settings-overlay]") as HTMLElement;
    fireEvent.click(overlay);
    // Close animation delay
    expect(overlay.getAttribute("data-closing")).toBe("true");
    act(() => { vi.advanceTimersByTime(200); });
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("does not close when content area is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      wrapWithProvider(
        createElement(ChatSettingsOverlay, { open: true, onClose }),
      ),
    );
    const content = container.querySelector("[data-provider-settings-content]") as HTMLElement;
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed (after close animation)", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      wrapWithProvider(
        createElement(ChatSettingsOverlay, { open: true, onClose }),
      ),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("renders with role=dialog, aria-modal, and aria-label", () => {
    const { container } = render(
      wrapWithProvider(
        createElement(ChatSettingsOverlay, { open: true, onClose: vi.fn() }),
      ),
    );
    const overlay = container.querySelector("[data-provider-settings-overlay]") as HTMLElement;
    expect(overlay.getAttribute("role")).toBe("dialog");
    expect(overlay.getAttribute("aria-modal")).toBe("true");
    expect(overlay.getAttribute("aria-label")).toBe("Provider settings");
  });

  it("renders content wrapper with data-provider-settings-content", () => {
    const { container } = render(
      wrapWithProvider(
        createElement(ChatSettingsOverlay, { open: true, onClose: vi.fn() }),
      ),
    );
    expect(container.querySelector("[data-provider-settings-content]")).toBeTruthy();
  });

  it("sets data-closing attribute during close animation", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { container } = render(
      wrapWithProvider(
        createElement(ChatSettingsOverlay, { open: true, onClose }),
      ),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    const overlay = container.querySelector("[data-provider-settings-overlay]");
    expect(overlay).toBeTruthy();
    expect(overlay!.getAttribute("data-closing")).toBe("true");
    const content = container.querySelector("[data-provider-settings-content]");
    expect(content!.getAttribute("data-closing")).toBe("true");
    act(() => { vi.advanceTimersByTime(200); });
    vi.useRealTimers();
  });

  it("traps focus: Tab at last focusable wraps to first", () => {
    const { container } = render(
      wrapWithProvider(
        createElement(ChatSettingsOverlay, { open: true, onClose: vi.fn() }),
      ),
    );
    const content = container.querySelector("[data-provider-settings-content]") as HTMLElement;
    const focusable = content.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length >= 2) {
      const last = focusable[focusable.length - 1] as HTMLElement;
      last.focus();
      fireEvent.keyDown(document, { key: "Tab" });
      expect(document.activeElement).toBe(focusable[0]);
    }
  });

  it("traps focus: Shift+Tab at first focusable wraps to last", () => {
    const { container } = render(
      wrapWithProvider(
        createElement(ChatSettingsOverlay, { open: true, onClose: vi.fn() }),
      ),
    );
    const content = container.querySelector("[data-provider-settings-content]") as HTMLElement;
    const focusable = content.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length >= 2) {
      const first = focusable[0] as HTMLElement;
      first.focus();
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(focusable[focusable.length - 1]);
    }
  });
});

/* ─── UsageBadge ─────────────────────────────────────────────────── */

import { UsageBadge } from "../../../src/chat/react/UsageBadge.js";

describe("UsageBadge", () => {
  it("renders null when usage is null", () => {
    const { container } = render(
      createElement(UsageBadge, { usage: null }),
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders data-usage-badge with three token spans", () => {
    const usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
    const { container } = render(
      createElement(UsageBadge, { usage }),
    );
    const badge = container.querySelector("[data-usage-badge]");
    expect(badge).toBeTruthy();

    const prompt = container.querySelector("[data-usage-tokens='prompt']");
    const completion = container.querySelector("[data-usage-tokens='completion']");
    const total = container.querySelector("[data-usage-tokens='total']");

    expect(prompt).toBeTruthy();
    expect(prompt!.textContent).toBe("↑100");
    expect(completion).toBeTruthy();
    expect(completion!.textContent).toBe("↓50");
    expect(total).toBeTruthy();
    expect(total!.textContent).toBe("Σ150");
  });

  it("accepts className prop", () => {
    const usage = { promptTokens: 1, completionTokens: 2, totalTokens: 3 };
    const { container } = render(
      createElement(UsageBadge, { usage, className: "my-badge" }),
    );
    const badge = container.querySelector("[data-usage-badge]");
    expect(badge!.className).toBe("my-badge");
  });
});

/* ─── ChatInputArea with usage ───────────────────────────────────── */

describe("ChatInputArea with usage", () => {
  it("renders UsageBadge when usage is provided", () => {
    const usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };
    const { container } = render(
      createElement(ChatInputArea, { onSend: vi.fn(), usage }),
    );
    const badge = container.querySelector("[data-usage-badge]");
    expect(badge).toBeTruthy();
    expect(container.querySelector("[data-usage-tokens='total']")!.textContent).toBe("Σ15");
  });

  it("does not render UsageBadge when usage is null", () => {
    const { container } = render(
      createElement(ChatInputArea, { onSend: vi.fn(), usage: null }),
    );
    expect(container.querySelector("[data-usage-badge]")).toBeNull();
  });

  it("does not render UsageBadge when usage is not provided", () => {
    const { container } = render(
      createElement(ChatInputArea, { onSend: vi.fn() }),
    );
    expect(container.querySelector("[data-usage-badge]")).toBeNull();
  });
});
