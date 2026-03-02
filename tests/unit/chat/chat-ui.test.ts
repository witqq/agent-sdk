// @vitest-environment jsdom
/**
 * Tests for ChatUI composite component.
 *
 * Covers: default rendering, slot replacement, className injection,
 * sidebar toggling, session lifecycle (create, switch, delete).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { createElement, type ReactNode, type ComponentType } from "react";
import { render, fireEvent, act } from "@testing-library/react";
import type { IChatRuntime } from "../../../src/chat/runtime.js";
import type { ChatId, ChatSession, ChatMessage, SessionInfo } from "../../../src/chat/core.js";
import { ChatUI, type ChatUIProps } from "../../../src/chat/react/ChatUI.js";

/* ─── Helpers ─────────────────────────────────────────────────────── */

function createMockSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    id: ("s-" + Math.random().toString(36).slice(2, 8)) as unknown as ChatId,
    title: "Test Session",
    messages: [],
    config: { model: "test-model", backend: "test" },
    metadata: { messageCount: 0, totalTokens: 0 },
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as ChatSession;
}

function createTestMessage(
  role: "user" | "assistant" = "assistant",
  text = "Hello",
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: ("msg-" + Math.random().toString(36).slice(2, 8)) as unknown as ChatId,
    role,
    parts: [{ type: "text", text, status: "complete" }],
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as ChatMessage;
}

function createMockRuntime(overrides: Partial<IChatRuntime> = {}): IChatRuntime {
  const sessionChangeListeners = new Set<() => void>();
  const defaultSession = createMockSession({ id: "s1" as unknown as ChatId, title: "Session 1" });

  return {
    status: "idle",
    send: vi.fn(async function* () {}),
    abort: vi.fn(),
    dispose: vi.fn(),
    createSession: vi.fn(async () => createMockSession()),
    getSession: vi.fn(async (id: string) => (id === "s1" ? defaultSession : null)),
    listSessions: vi.fn(async () => [defaultSession]),
    deleteSession: vi.fn(async () => {}),
    switchSession: vi.fn(async () => defaultSession),
    registerTool: vi.fn(),
    removeTool: vi.fn(),
    listModels: vi.fn(async () => []),
    listBackends: vi.fn(() => [
      { name: "copilot" },
      { name: "claude" },
    ]),
    listProviders: vi.fn(async () => [
      { id: "p1", backend: "copilot", model: "gpt-5-mini", label: "Copilot", isDefault: true },
    ]),
    selectProvider: vi.fn(),
    selectedProviderId: "p1",
    onSelectionChange: vi.fn(() => () => {}),
    createProvider: vi.fn(async () => ({ id: "p-new", backend: "copilot", model: "gpt-5-mini", label: "New", isDefault: false })),
    deleteProvider: vi.fn(async () => {}),
    updateProvider: vi.fn(async () => {}),
    use: vi.fn(),
    removeMiddleware: vi.fn(),
    activeSessionId: "s1",
    registeredTools: new Map(),
    getContextStats: vi.fn(() => null),
    onSessionChange: vi.fn((cb: () => void) => {
      sessionChangeListeners.add(cb);
      return () => sessionChangeListeners.delete(cb);
    }),
    ...overrides,
  } as unknown as IChatRuntime;
}

/* ─── jsdom fixups ─────────────────────────────────────────────────── */

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

/* ─── Tests ────────────────────────────────────────────────────────── */

describe("ChatUI", () => {
  describe("default rendering", () => {
    it("renders root element with data-chat-ui attribute", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      expect(container!.querySelector("[data-chat-ui]")).toBeTruthy();
    });

    it("renders Thread, Composer, and ThreadList by default", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      expect(container!.querySelector("[data-thread]")).toBeTruthy();
      expect(container!.querySelector("[data-composer]")).toBeTruthy();
      expect(container!.querySelector("[data-thread-list]")).toBeTruthy();
    });

    it("renders data-chat-main wrapper around thread and composer", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      const main = container!.querySelector("[data-chat-main]");
      expect(main).toBeTruthy();
      expect(main!.querySelector("[data-thread]")).toBeTruthy();
      expect(main!.querySelector("[data-composer]")).toBeTruthy();
    });

    it("sidebar is placed before main content", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      const root = container!.querySelector("[data-chat-ui]")!;
      const children = Array.from(root.children);
      const sidebarIdx = children.findIndex((el) => el.hasAttribute("data-thread-list"));
      const mainIdx = children.findIndex((el) => el.hasAttribute("data-chat-main"));
      expect(sidebarIdx).toBeLessThan(mainIdx);
    });
  });

  describe("className injection", () => {
    it("applies className to root element", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime, className: "my-chat" })));
      });
      const root = container!.querySelector("[data-chat-ui]")!;
      expect(root.className).toContain("my-chat");
    });
  });

  describe("sidebar toggle", () => {
    it("hides sidebar when showSidebar=false", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime, showSidebar: false })));
      });
      expect(container!.querySelector("[data-thread-list]")).toBeNull();
      // Thread and Composer still rendered
      expect(container!.querySelector("[data-thread]")).toBeTruthy();
      expect(container!.querySelector("[data-composer]")).toBeTruthy();
    });

    it("shows sidebar by default", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      expect(container!.querySelector("[data-thread-list]")).toBeTruthy();
    });
  });

  describe("placeholder", () => {
    it("passes placeholder to Composer textarea", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime, placeholder: "Ask anything..." })));
      });
      const textarea = container!.querySelector("textarea");
      expect(textarea?.getAttribute("placeholder")).toBe("Ask anything...");
    });
  });

  describe("slot replacement", () => {
    it("replaces Thread with custom component", async () => {
      const runtime = createMockRuntime();
      const CustomThread: ComponentType<any> = (props) =>
        createElement("div", { "data-custom-thread": "", "data-msg-count": String(props.messages?.length ?? 0) });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, {
          runtime,
          slots: { thread: CustomThread },
        })));
      });
      expect(container!.querySelector("[data-custom-thread]")).toBeTruthy();
      expect(container!.querySelector("[data-thread]")).toBeNull();
    });

    it("replaces Composer with custom component", async () => {
      const runtime = createMockRuntime();
      const CustomComposer: ComponentType<any> = () =>
        createElement("div", { "data-custom-composer": "" });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, {
          runtime,
          slots: { composer: CustomComposer },
        })));
      });
      expect(container!.querySelector("[data-custom-composer]")).toBeTruthy();
      expect(container!.querySelector("[data-composer]")).toBeNull();
    });

    it("replaces ThreadList with custom sidebar", async () => {
      const runtime = createMockRuntime();
      const CustomSidebar: ComponentType<any> = (props) =>
        createElement("div", { "data-custom-sidebar": "", "data-sessions": String(props.sessions?.length ?? 0) });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, {
          runtime,
          slots: { threadList: CustomSidebar },
        })));
      });
      expect(container!.querySelector("[data-custom-sidebar]")).toBeTruthy();
      expect(container!.querySelector("[data-thread-list]")).toBeNull();
    });

    it("passes renderMessage slot to ThreadProvider", async () => {
      const runtime = createMockRuntime();
      const renderMessage = vi.fn((_msg: any, _idx: number) =>
        createElement("div", { "data-custom-msg": "" }));
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, {
          runtime,
          slots: { renderMessage },
        })));
      });
      // Thread is wrapped in ThreadProvider when renderMessage is provided
      // The actual call happens when Thread renders messages
      expect(container!.querySelector("[data-thread]")).toBeTruthy();
    });

    it("can replace multiple slots simultaneously", async () => {
      const runtime = createMockRuntime();
      const CustomThread: ComponentType<any> = () => createElement("div", { "data-slot": "thread" });
      const CustomComposer: ComponentType<any> = () => createElement("div", { "data-slot": "composer" });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, {
          runtime,
          slots: { thread: CustomThread, composer: CustomComposer },
        })));
      });
      expect(container!.querySelector("[data-slot='thread']")).toBeTruthy();
      expect(container!.querySelector("[data-slot='composer']")).toBeTruthy();
      expect(container!.querySelector("[data-thread]")).toBeNull();
      expect(container!.querySelector("[data-composer]")).toBeNull();
    });
  });

  describe("session lifecycle", () => {
    it("passes activeSessionId from runtime to ThreadList", async () => {
      const runtime = createMockRuntime({ activeSessionId: "s1" });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      // ThreadList marks active session with data-session-active
      const activeItem = container!.querySelector("[data-session-active]");
      expect(activeItem).toBeTruthy();
    });

    it("calls runtime.switchSession when sidebar session is selected", async () => {
      const session1 = createMockSession({ id: "s1" as unknown as ChatId, title: "Session 1" });
      const session2 = createMockSession({ id: "s2" as unknown as ChatId, title: "Session 2" });
      const runtime = createMockRuntime({
        activeSessionId: "s1",
        listSessions: vi.fn(async () => [session1, session2]),
      });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });

      // Find session items and click the non-active one
      const sessionItems = container!.querySelectorAll("[data-session-item]");
      expect(sessionItems.length).toBeGreaterThanOrEqual(2);

      // Click session 2 (inactive)
      const session2Item = Array.from(sessionItems).find(
        (el) => el.getAttribute("data-session-active") !== "true",
      );
      expect(session2Item).toBeTruthy();
      await act(async () => {
        fireEvent.click(session2Item!);
      });
      expect(runtime.switchSession).toHaveBeenCalled();
    });

    it("calls runtime.deleteSession when delete button clicked", async () => {
      const session1 = createMockSession({ id: "s1" as unknown as ChatId, title: "Session 1" });
      const runtime = createMockRuntime({
        activeSessionId: "s1",
        listSessions: vi.fn(async () => [session1]),
      });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });

      const deleteBtn = container!.querySelector("[data-action='delete-session']");
      expect(deleteBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(deleteBtn!);
      });
      expect(runtime.deleteSession).toHaveBeenCalled();
    });

    it("sends messages via Composer", async () => {
      const session = createMockSession({ id: "s1" as unknown as ChatId });
      const runtime = createMockRuntime({
        activeSessionId: "s1",
        getSession: vi.fn(async () => session),
        createSession: vi.fn(async () => session),
      });

      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });

      const textarea = container!.querySelector("textarea")!;
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "Hello!" } });
      });

      await act(async () => {
        fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
      });

      // send() should have been called (useChat calls runtime.send)
      expect(runtime.send).toHaveBeenCalled();
    });
  });

  describe("provider wrapping", () => {
    it("wraps children in ChatProvider (useChatRuntime works inside)", async () => {
      // If ChatUI didn't wrap in ChatProvider, Thread/Composer hooks would throw
      const runtime = createMockRuntime();
      let container: HTMLElement;
      // This should not throw — proves ChatProvider is present
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      expect(container!.querySelector("[data-chat-ui]")).toBeTruthy();
    });
  });

  describe("ModelSelector integration", () => {
    it("renders model selector in header when models available and no providers", async () => {
      const runtime = createMockRuntime({
        listModels: vi.fn(async () => [
          { id: "gpt-4", name: "GPT-4" },
          { id: "claude-3", name: "Claude 3" },
        ]),
        listProviders: vi.fn(async () => []),
      });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      const header = container!.querySelector("[data-chat-header]");
      expect(header).toBeTruthy();
      expect(header!.querySelector("[data-model-selector]")).toBeTruthy();
    });

    it("does not render header when no models and single backend", async () => {
      const runtime = createMockRuntime({
        listModels: vi.fn(async () => []),
        listBackends: vi.fn(() => [{ name: "copilot" }]),
      });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      expect(container!.querySelector("[data-chat-header]")).toBeNull();
    });

    it("hides model selector when showModelSelector=false", async () => {
      const runtime = createMockRuntime({
        listModels: vi.fn(async () => [
          { id: "gpt-4", name: "GPT-4" },
        ]),
        listBackends: vi.fn(() => [{ name: "copilot" }]),
      });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime, showModelSelector: false })));
      });
      expect(container!.querySelector("[data-chat-header]")).toBeNull();
    });

    it("replaces ModelSelector with custom slot when no providers", async () => {
      const runtime = createMockRuntime({
        listModels: vi.fn(async () => [
          { id: "gpt-4", name: "GPT-4" },
        ]),
        listProviders: vi.fn(async () => []),
      });
      const CustomSelector: ComponentType<any> = () =>
        createElement("div", { "data-custom-model-selector": "" });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, {
          runtime,
          slots: { modelSelector: CustomSelector },
        })));
      });
      const header = container!.querySelector("[data-chat-header]");
      expect(header).toBeTruthy();
      expect(header!.querySelector("[data-custom-model-selector]")).toBeTruthy();
      expect(header!.querySelector("[data-model-selector]")).toBeNull();
    });

    it("uses unified ProviderModelSelector near composer when providers exist", async () => {
      const runtime = createMockRuntime({
        listModels: vi.fn(async () => [
          { id: "gpt-4", name: "GPT-4" },
          { id: "claude-3", name: "Claude 3" },
        ]),
      });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      // Unified selector should be near the composer, not in the header
      const inputArea = container!.querySelector("[data-chat-input-area]");
      expect(inputArea).toBeTruthy();
      expect(inputArea!.querySelector("[data-provider-model-selector]")).toBeTruthy();
      // No standalone ModelSelector in header when providers exist
      const header = container!.querySelector("[data-chat-header]");
      expect(header).toBeNull();
    });

    it("updates local model state via unified selector when no providers", async () => {
      const runtime = createMockRuntime({
        listModels: vi.fn(async () => [
          { id: "gpt-4", name: "GPT-4" },
          { id: "claude-3", name: "Claude 3" },
        ]),
        listProviders: vi.fn(async () => []),
      });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      // Open the dropdown
      const trigger = container!.querySelector("[data-model-selector-trigger]");
      expect(trigger).toBeTruthy();
      await act(async () => {
        fireEvent.click(trigger!);
      });
      // Click a model option
      const items = container!.querySelectorAll("[data-model-option]");
      expect(items.length).toBeGreaterThan(0);
      await act(async () => {
        fireEvent.click(items[0]);
      });
      // Model selection is local — no runtime.switchModel call needed
      // Just verify the click didn't throw
    });
  });

  describe("authDialog slot", () => {
    it("renders authDialog element when provided", async () => {
      const runtime = createMockRuntime();
      const authDialog = createElement("div", { "data-auth-overlay": "" }, "Login");
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, {
          runtime,
          slots: { authDialog },
        })));
      });
      expect(container!.querySelector("[data-auth-overlay]")).toBeTruthy();
    });

    it("does not render authDialog when not provided", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      expect(container!.querySelector("[data-auth-overlay]")).toBeNull();
    });
  });

  describe("empty state", () => {
    it("shows empty state when no providers and no messages", async () => {
      const runtime = createMockRuntime({
        listProviders: vi.fn(async () => []),
      });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      expect(container!.querySelector("[data-chat-empty-state]")).toBeTruthy();
      expect(container!.querySelector("[data-chat-empty-title]")).toBeTruthy();
      expect(container!.querySelector("[data-thread]")).toBeNull();
    });

    it("shows thread when providers exist", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      expect(container!.querySelector("[data-chat-empty-state]")).toBeNull();
      expect(container!.querySelector("[data-thread]")).toBeTruthy();
    });
  });

  describe("BackendSelector integration", () => {
    it("renders backend selector in header when showBackendSelector=true", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime, showBackendSelector: true })));
      });
      const header = container!.querySelector("[data-chat-header]");
      expect(header).toBeTruthy();
      expect(header!.querySelector("[data-backend-selector]")).toBeTruthy();
    });

    it("hides backend selector by default", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });
      expect(container!.querySelector("[data-backend-selector]")).toBeNull();
    });

    it("hides backend selector when showBackendSelector=false", async () => {
      const runtime = createMockRuntime();
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime, showBackendSelector: false })));
      });
      expect(container!.querySelector("[data-backend-selector]")).toBeNull();
    });

    it("refreshes models when backend selected", async () => {
      const listModels = vi.fn(async () => []);
      const runtime = createMockRuntime({ listModels });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime, showBackendSelector: true })));
      });
      const initialCallCount = listModels.mock.calls.length;
      const claudeBtn = container!.querySelector("[data-backend-name='claude']") as HTMLButtonElement;
      expect(claudeBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(claudeBtn);
      });
      // Backend selection now just refreshes model list
      expect(listModels.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it("replaces BackendSelector with custom slot", async () => {
      const runtime = createMockRuntime();
      const CustomBackend: ComponentType<any> = () =>
        createElement("div", { "data-custom-backend": "" });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, {
          runtime,
          showBackendSelector: true,
          slots: { backendSelector: CustomBackend },
        })));
      });
      const header = container!.querySelector("[data-chat-header]");
      expect(header).toBeTruthy();
      expect(header!.querySelector("[data-custom-backend]")).toBeTruthy();
      expect(header!.querySelector("[data-backend-selector]")).toBeNull();
    });

    it("refreshes model list after backend switch", async () => {
      const listModels = vi.fn(async () => [
        { id: "gpt-4", name: "GPT-4" },
      ]);
      const runtime = createMockRuntime({ listModels });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime, showBackendSelector: true })));
      });
      // listModels called once on mount
      const initialCallCount = listModels.mock.calls.length;

      // Click claude backend button
      const claudeBtn = container!.querySelector("[data-backend-name='claude']") as HTMLButtonElement;
      expect(claudeBtn).toBeTruthy();
      await act(async () => {
        fireEvent.click(claudeBtn);
      });

      // After backend switch, listModels should be called again (refresh)
      expect(listModels.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  describe("error display", () => {
    it("renders error with retry button and dismiss button", async () => {
      const send = vi.fn(async function* () {
        throw new Error("Test error");
      });
      const runtime = createMockRuntime({ send });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });

      // Trigger error by sending message
      const textarea = container!.querySelector("textarea") as HTMLTextAreaElement;
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "hello" } });
      });
      const sendBtn = container!.querySelector("[data-action='send']") as HTMLButtonElement;
      await act(async () => {
        fireEvent.click(sendBtn);
      });
      // Allow async effects
      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      const errorDiv = container!.querySelector("[data-chat-error]");
      expect(errorDiv).toBeTruthy();
      expect(errorDiv!.querySelector("[data-chat-error-text]")?.textContent).toContain("Test error");
      expect(errorDiv!.querySelector("[data-action='retry']")).toBeTruthy();
      expect(errorDiv!.querySelector("[data-action='dismiss-error']")).toBeTruthy();
    });

    it("dismiss button clears the error", async () => {
      const send = vi.fn(async function* () {
        throw new Error("Dismissable");
      });
      const runtime = createMockRuntime({ send });
      let container: HTMLElement;
      await act(async () => {
        ({ container } = render(createElement(ChatUI, { runtime })));
      });

      // Trigger error
      const textarea = container!.querySelector("textarea") as HTMLTextAreaElement;
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "test" } });
      });
      const sendBtn = container!.querySelector("[data-action='send']") as HTMLButtonElement;
      await act(async () => {
        fireEvent.click(sendBtn);
      });
      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      expect(container!.querySelector("[data-chat-error]")).toBeTruthy();

      // Click dismiss
      const dismissBtn = container!.querySelector("[data-action='dismiss-error']") as HTMLButtonElement;
      await act(async () => {
        fireEvent.click(dismissBtn);
      });

      expect(container!.querySelector("[data-chat-error]")).toBeNull();
    });
  });
});
