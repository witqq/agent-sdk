/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { ThreadList } from "../../../src/chat/react/ThreadList.js";
import { useSSE } from "../../../src/chat/react/useSSE.js";
import { useModels } from "../../../src/chat/react/useModels.js";
import type { ModelOption } from "../../../src/chat/react/useModels.js";
import { ModelSelector } from "../../../src/chat/react/ModelSelector.js";
import { BackendSelector } from "../../../src/chat/react/BackendSelector.js";
import { ChatProvider } from "../../../src/chat/react/ChatProvider.js";
import type { IChatRuntime } from "../../../src/chat/runtime.js";
import type { SessionInfo, ChatId } from "../../../src/chat/core.js";
import type { ModelOption } from "../../../src/chat/react/useModels.js";

// ─── Helpers ──────────────────────────────────────────────────

function createMockSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    id: "session-1" as unknown as ChatId,
    title: "Test Session",
    status: "active",
    messageCount: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockRuntime(overrides: Partial<IChatRuntime> = {}): IChatRuntime {
  return {
    status: "idle",
    send: vi.fn(() => (async function* () {})()),
    abort: vi.fn(),
    dispose: vi.fn(),
    createSession: vi.fn(async () => ({
      id: "s1" as unknown as ChatId,
      title: "",
      messages: [],
      config: { model: "", backend: "" },
      metadata: { messageCount: 0, totalTokens: 0 },
      status: "active" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    getSession: vi.fn(async () => null),
    listSessions: vi.fn(async () => []),
    deleteSession: vi.fn(async () => {}),
    switchSession: vi.fn(async () => ({
      id: "s1" as unknown as ChatId,
      title: "",
      messages: [],
      config: { model: "", backend: "" },
      metadata: { messageCount: 0, totalTokens: 0 },
      status: "active" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    registerTool: vi.fn(),
    removeTool: vi.fn(),
    switchModel: vi.fn(),
    listModels: vi.fn(async () => []),
    use: vi.fn(),
    removeMiddleware: vi.fn(),
    ...overrides,
  } as unknown as IChatRuntime;
}

function runtimeWrapper(runtime: IChatRuntime) {
  return ({ children }: { children: ReactNode }) =>
    createElement(ChatProvider, { runtime }, children);
}

// ─── ThreadList ───────────────────────────────────────────────

describe("ThreadList", () => {
  it("renders sessions with data-session-item", () => {
    const sessions = [
      createMockSession({ id: "s1" as unknown as ChatId, title: "Session One" }),
      createMockSession({ id: "s2" as unknown as ChatId, title: "Session Two" }),
    ];
    const { container } = render(
      createElement(ThreadList, { sessions, onSelect: vi.fn() }),
    );
    const items = container.querySelectorAll("[data-session-item]");
    expect(items).toHaveLength(2);
  });

  it("marks active session with data-session-active", () => {
    const sessions = [
      createMockSession({ id: "s1" as unknown as ChatId }),
      createMockSession({ id: "s2" as unknown as ChatId }),
    ];
    const { container } = render(
      createElement(ThreadList, {
        sessions,
        activeSessionId: "s1",
        onSelect: vi.fn(),
      }),
    );
    const items = container.querySelectorAll("[data-session-item]");
    expect(items[0].getAttribute("data-session-active")).toBe("true");
    expect(items[1].getAttribute("data-session-active")).toBe("false");
  });

  it("calls onSelect when session clicked", () => {
    const onSelect = vi.fn();
    const sessions = [
      createMockSession({ id: "s1" as unknown as ChatId, title: "Click Me" }),
    ];
    const { container } = render(
      createElement(ThreadList, { sessions, onSelect }),
    );
    const item = container.querySelector("[data-session-item]")!;
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("calls onDelete when delete button clicked", () => {
    const onDelete = vi.fn();
    const onSelect = vi.fn();
    const sessions = [
      createMockSession({ id: "s1" as unknown as ChatId }),
    ];
    const { container } = render(
      createElement(ThreadList, { sessions, onSelect, onDelete }),
    );
    const deleteBtn = container.querySelector('[data-action="delete-session"]')!;
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith("s1");
    // Should not call onSelect from stopPropagation
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onCreate when create button clicked", () => {
    const onCreate = vi.fn();
    const { container } = render(
      createElement(ThreadList, { sessions: [], onSelect: vi.fn(), onCreate }),
    );
    const createBtn = container.querySelector('[data-action="create-session"]')!;
    fireEvent.click(createBtn);
    expect(onCreate).toHaveBeenCalled();
  });

  it("filters sessions by search query", () => {
    const sessions = [
      createMockSession({ id: "s1" as unknown as ChatId, title: "Alpha Project" }),
      createMockSession({ id: "s2" as unknown as ChatId, title: "Beta Task" }),
      createMockSession({ id: "s3" as unknown as ChatId, title: "alpha lowercase" }),
    ];
    const { container } = render(
      createElement(ThreadList, {
        sessions,
        onSelect: vi.fn(),
        searchQuery: "alpha",
      }),
    );
    const items = container.querySelectorAll("[data-session-item]");
    expect(items).toHaveLength(2);
  });

  it("renders data-thread-list-header with search and create button", () => {
    const onCreate = vi.fn();
    const { container } = render(
      createElement(ThreadList, { sessions: [], onSelect: vi.fn(), onCreate }),
    );
    const header = container.querySelector("[data-thread-list-header]");
    expect(header).not.toBeNull();
    expect(header!.querySelector("[data-thread-list-search]")).not.toBeNull();
    expect(header!.querySelector("[data-action='create-session']")).not.toBeNull();
  });

  it("renders data-session-title for each session", () => {
    const sessions = [
      createMockSession({ id: "s1" as unknown as ChatId, title: "My Chat" }),
    ];
    const { container } = render(
      createElement(ThreadList, { sessions, onSelect: vi.fn() }),
    );
    const titleEl = container.querySelector("[data-session-title]");
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toBe("My Chat");
  });

  it("renders data-session-time with relative timestamp", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const sessions = [
      createMockSession({ id: "s1" as unknown as ChatId, updatedAt: fiveMinAgo }),
    ];
    const { container } = render(
      createElement(ThreadList, { sessions, onSelect: vi.fn() }),
    );
    const timeEl = container.querySelector("[data-session-time]");
    expect(timeEl).not.toBeNull();
    expect(timeEl!.textContent).toBe("5m");
  });
});

// ─── useSSE ───────────────────────────────────────────────────

describe("useSSE", () => {
  it("starts in idle status when url is null", () => {
    const { result } = renderHook(() => useSSE(null));
    expect(result.current.status).toBe("idle");
    expect(result.current.lastEvent).toBeNull();
  });

  it("parses single-line SSE data", async () => {
    const events: Array<{ type: string }> = [];
    const sseData = 'data: {"type":"message:delta","messageId":"m1","text":"hello"}\n\n';

    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseData));
          controller.close();
        },
      }),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse as unknown as Response,
    );

    const { result } = renderHook(() =>
      useSSE("http://test.local/sse", {
        onEvent: (e) => events.push(e),
      }),
    );

    await act(async () => {
      result.current.connect();
      // Allow microtasks to complete
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("message:delta");
    expect(result.current.lastEvent).not.toBeNull();

    fetchSpy.mockRestore();
  });

  it("parses multi-line SSE data (concatenated with \\n)", async () => {
    const events: Array<Record<string, unknown>> = [];
    // Multi-line data: two data: lines before empty line
    const sseData = 'data: {"type":"message:delta",\ndata: "messageId":"m1","text":"hi"}\n\n';

    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseData));
          controller.close();
        },
      }),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse as unknown as Response,
    );

    const { result } = renderHook(() =>
      useSSE("http://test.local/sse", {
        onEvent: (e) => events.push(e as Record<string, unknown>),
      }),
    );

    await act(async () => {
      result.current.connect();
      await new Promise((r) => setTimeout(r, 50));
    });

    // Multi-line data concatenated with \n and parsed as JSON
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("message:delta");

    fetchSpy.mockRestore();
  });

  it("handles event: type field", async () => {
    const events: Array<Record<string, unknown>> = [];
    const sseData = 'event: custom\ndata: {"type":"done"}\n\n';

    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseData));
          controller.close();
        },
      }),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse as unknown as Response,
    );

    const { result } = renderHook(() =>
      useSSE("http://test.local/sse", {
        onEvent: (e) => events.push(e as Record<string, unknown>),
      }),
    );

    await act(async () => {
      result.current.connect();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("done");

    fetchSpy.mockRestore();
  });

  it("transitions to connecting then open status", async () => {
    let resolveResponse: (value: unknown) => void;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });

    const mockResponse = {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      }),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => {
        // Return a promise that we control — lets us observe "connecting"
        return responsePromise as Promise<Response>;
      },
    );

    const { result } = renderHook(() => useSSE("http://test.local/sse"));

    expect(result.current.status).toBe("idle");

    // Start connecting — status goes to "connecting" synchronously
    act(() => {
      result.current.connect();
    });

    expect(result.current.status).toBe("connecting");

    // Now resolve the fetch
    await act(async () => {
      resolveResponse!(mockResponse);
      await new Promise((r) => setTimeout(r, 50));
    });

    // After stream completes: closed
    expect(["open", "closed"]).toContain(result.current.status);

    fetchSpy.mockRestore();
  });

  it("disconnect sets status to closed", async () => {
    const { result } = renderHook(() => useSSE("http://test.local/sse"));

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.status).toBe("closed");
  });

  it("reconnects after error when reconnect is true", async () => {
    let fetchCallCount = 0;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        return Promise.reject(new Error("Connection failed"));
      }
      // Second call succeeds
      return Promise.resolve({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: {"type":"done"}\n\n'));
            controller.close();
          },
        }),
      } as unknown as Response);
    });

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useSSE("http://test.local/sse", { reconnect: true, reconnectInterval: 50, onError }),
    );

    await act(async () => {
      result.current.connect();
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.status).toBe("error");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(fetchCallCount).toBe(1);

    // Wait for reconnect timer (50ms interval)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(fetchCallCount).toBe(2);

    fetchSpy.mockRestore();
  });

  it("does not reconnect when reconnect is false", async () => {
    let fetchCallCount = 0;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      fetchCallCount++;
      return Promise.reject(new Error("Connection failed"));
    });

    const { result } = renderHook(() =>
      useSSE("http://test.local/sse", { reconnect: false }),
    );

    await act(async () => {
      result.current.connect();
      await Promise.resolve();
    });

    expect(result.current.status).toBe("error");
    expect(fetchCallCount).toBe(1);

    // Wait a bit — should NOT reconnect
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(fetchCallCount).toBe(1);

    fetchSpy.mockRestore();
  });
});

// ─── useModels ────────────────────────────────────────────────

describe("useModels", () => {
  it("returns empty models initially while loading", () => {
    const runtime = createMockRuntime({
      listModels: vi.fn(() => new Promise(() => {})), // Never resolves
    });

    const { result } = renderHook(() => useModels(), {
      wrapper: runtimeWrapper(runtime),
    });

    expect(result.current.models).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("returns models after load", async () => {
    const runtime = createMockRuntime({
      listModels: vi.fn(async () => [
        { id: "gpt-4", name: "GPT-4" },
        { id: "claude-3", name: "Claude 3" },
      ]),
    });

    const { result } = renderHook(() => useModels(), {
      wrapper: runtimeWrapper(runtime),
    });

    // Wait for async load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.models).toHaveLength(2);
    expect(result.current.models[0]).toEqual({ id: "gpt-4", name: "GPT-4", tier: undefined });
    expect(result.current.isLoading).toBe(false);
  });

  it("search filters by name", async () => {
    const runtime = createMockRuntime({
      listModels: vi.fn(async () => [
        { id: "gpt-4", name: "GPT-4" },
        { id: "claude-3", name: "Claude 3" },
        { id: "gpt-3.5", name: "GPT-3.5 Turbo" },
      ]),
    });

    const { result } = renderHook(() => useModels(), {
      wrapper: runtimeWrapper(runtime),
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const gptModels = result.current.search("gpt");
    expect(gptModels).toHaveLength(2);
    expect(gptModels.every((m) => m.name.toLowerCase().includes("gpt"))).toBe(true);
  });

  it("refresh refetches models", async () => {
    let callCount = 0;
    const runtime = createMockRuntime({
      listModels: vi.fn(async () => {
        callCount++;
        return [{ id: `model-${callCount}`, name: `Model ${callCount}` }];
      }),
    });

    const { result } = renderHook(() => useModels(), {
      wrapper: runtimeWrapper(runtime),
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.models[0].id).toBe("model-1");

    await act(async () => {
      result.current.refresh();
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.models[0].id).toBe("model-2");
  });
});

// ─── ModelSelector ────────────────────────────────────────────

describe("ModelSelector", () => {
  const testModels: ModelOption[] = [
    { id: "gpt-4", name: "GPT-4", tier: "premium" },
    { id: "gpt-3.5", name: "GPT-3.5 Turbo", tier: "standard" },
    { id: "claude-3", name: "Claude 3 Sonnet", tier: "premium" },
  ];

  it("renders with placeholder when no selection", () => {
    const { container } = render(
      createElement(ModelSelector, {
        models: testModels,
        onSelect: vi.fn(),
        placeholder: "Pick a model",
      }),
    );
    const trigger = container.querySelector("[data-model-selector-trigger]")!;
    expect(trigger.textContent).toBe("Pick a model");
  });

  it("shows selected model name", () => {
    const { container } = render(
      createElement(ModelSelector, {
        models: testModels,
        selectedModel: "gpt-4",
        onSelect: vi.fn(),
      }),
    );
    const trigger = container.querySelector("[data-model-selector-trigger]")!;
    expect(trigger.textContent).toBe("GPT-4");
  });

  it("opens dropdown on click", () => {
    const { container } = render(
      createElement(ModelSelector, {
        models: testModels,
        onSelect: vi.fn(),
      }),
    );
    expect(container.querySelector("[data-model-selector-dropdown]")).toBeNull();

    const trigger = container.querySelector("[data-model-selector-trigger]")!;
    fireEvent.click(trigger);

    expect(container.querySelector("[data-model-selector-dropdown]")).not.toBeNull();
    const options = container.querySelectorAll("[data-model-option]");
    expect(options).toHaveLength(3);
  });

  it("navigates with ArrowDown/ArrowUp", () => {
    const { container } = render(
      createElement(ModelSelector, {
        models: testModels,
        onSelect: vi.fn(),
      }),
    );

    // Open dropdown
    const trigger = container.querySelector("[data-model-selector-trigger]")!;
    fireEvent.click(trigger);

    const searchInput = container.querySelector("[data-model-selector-search]")!;

    // First item highlighted by default
    let highlighted = container.querySelectorAll("[data-model-highlighted]");
    expect(highlighted).toHaveLength(1);

    // ArrowDown
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    highlighted = container.querySelectorAll("[data-model-highlighted]");
    expect(highlighted).toHaveLength(1);

    // ArrowUp back to first
    fireEvent.keyDown(searchInput, { key: "ArrowUp" });
    highlighted = container.querySelectorAll("[data-model-highlighted]");
    expect(highlighted).toHaveLength(1);
  });

  it("selects on Enter", () => {
    const onSelect = vi.fn();
    const { container } = render(
      createElement(ModelSelector, {
        models: testModels,
        onSelect,
      }),
    );

    // Open dropdown
    const trigger = container.querySelector("[data-model-selector-trigger]")!;
    fireEvent.click(trigger);

    const searchInput = container.querySelector("[data-model-selector-search]")!;

    // Navigate to second item
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("gpt-3.5");
    // Dropdown should close
    expect(container.querySelector("[data-model-selector-dropdown]")).toBeNull();
  });

  it("closes on Escape", () => {
    const { container } = render(
      createElement(ModelSelector, {
        models: testModels,
        onSelect: vi.fn(),
      }),
    );

    // Open dropdown
    const trigger = container.querySelector("[data-model-selector-trigger]")!;
    fireEvent.click(trigger);
    expect(container.querySelector("[data-model-selector-dropdown]")).not.toBeNull();

    const searchInput = container.querySelector("[data-model-selector-search]")!;
    fireEvent.keyDown(searchInput, { key: "Escape" });

    expect(container.querySelector("[data-model-selector-dropdown]")).toBeNull();
  });

  it("filters models in dropdown search", () => {
    const { container } = render(
      createElement(ModelSelector, {
        models: testModels,
        onSelect: vi.fn(),
      }),
    );

    // Open dropdown
    const trigger = container.querySelector("[data-model-selector-trigger]")!;
    fireEvent.click(trigger);

    const searchInput = container.querySelector("[data-model-selector-search]")!;
    fireEvent.change(searchInput, { target: { value: "gpt" } });

    const options = container.querySelectorAll("[data-model-option]");
    expect(options).toHaveLength(2);
  });

  it("renders free-text input when models list is empty", () => {
    const onSelect = vi.fn();
    const { container } = render(
      createElement(ModelSelector, {
        models: [],
        onSelect,
      }),
    );

    expect(container.querySelector("[data-model-selector-freetext]")).not.toBeNull();
    expect(container.querySelector("[data-model-input]")).not.toBeNull();
    expect(container.querySelector("[data-action='apply-model']")).not.toBeNull();
    // No trigger or dropdown
    expect(container.querySelector("[data-model-selector-trigger]")).toBeNull();
  });

  it("free-text input calls onSelect on Apply click", () => {
    const onSelect = vi.fn();
    const { container } = render(
      createElement(ModelSelector, {
        models: [],
        onSelect,
      }),
    );

    const input = container.querySelector("[data-model-input]") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "gpt-5-turbo" } });

    const apply = container.querySelector("[data-action='apply-model']")!;
    fireEvent.click(apply);

    expect(onSelect).toHaveBeenCalledWith("gpt-5-turbo");
  });

  it("free-text input calls onSelect on Enter", () => {
    const onSelect = vi.fn();
    const { container } = render(
      createElement(ModelSelector, {
        models: [],
        onSelect,
      }),
    );

    const input = container.querySelector("[data-model-input]") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "claude-3" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("claude-3");
  });

  it("free-text does not call onSelect with empty value", () => {
    const onSelect = vi.fn();
    const { container } = render(
      createElement(ModelSelector, {
        models: [],
        onSelect,
      }),
    );

    const apply = container.querySelector("[data-action='apply-model']")!;
    fireEvent.click(apply);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("disables free-text when allowFreeText=false", () => {
    const { container } = render(
      createElement(ModelSelector, {
        models: [],
        onSelect: vi.fn(),
        allowFreeText: false,
      }),
    );

    expect(container.querySelector("[data-model-selector-freetext]")).toBeNull();
    // Should render normal trigger with placeholder
    expect(container.querySelector("[data-model-selector-trigger]")).not.toBeNull();
  });

  it("shows provider context when multiple providers present", () => {
    const models: ModelOption[] = [
      { id: "gpt-5", name: "GPT-5", provider: "copilot" },
      { id: "claude-4", name: "Claude 4", provider: "claude" },
    ];
    const { container } = render(
      createElement(ModelSelector, { models, onSelect: vi.fn() }),
    );
    // Open dropdown
    const trigger = container.querySelector("[data-model-selector-trigger]")!;
    fireEvent.click(trigger);

    const options = container.querySelectorAll("[data-model-option]");
    expect(options[0].getAttribute("data-model-provider")).toBe("copilot");
    expect(options[0].textContent).toContain("(copilot)");
    expect(options[1].getAttribute("data-model-provider")).toBe("claude");
    expect(options[1].textContent).toContain("(claude)");
  });

  it("hides provider context when single provider", () => {
    const models: ModelOption[] = [
      { id: "gpt-5", name: "GPT-5", provider: "copilot" },
      { id: "gpt-4", name: "GPT-4", provider: "copilot" },
    ];
    const { container } = render(
      createElement(ModelSelector, { models, onSelect: vi.fn() }),
    );
    const trigger = container.querySelector("[data-model-selector-trigger]")!;
    fireEvent.click(trigger);

    const options = container.querySelectorAll("[data-model-option]");
    expect(options[0].getAttribute("data-model-provider")).toBeNull();
    expect(options[0].textContent).toBe("GPT-5");
  });
});

// ─── ThreadList with ChatSession[] ──────────────────────────

describe("ThreadList with ChatSession objects", () => {
  it("accepts ChatSession[] and normalizes to SessionInfo", () => {
    const chatSessions = [
      {
        id: "s-1",
        title: "Full Session",
        messages: [
          { id: "m1", role: "user", parts: [], status: "complete", createdAt: new Date() },
          { id: "m2", role: "assistant", parts: [], status: "complete", createdAt: new Date() },
        ],
        config: { model: "gpt-4", backend: "test" },
        metadata: { messageCount: 2, custom: {} },
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const onSelect = vi.fn();
    const { container } = render(
      createElement(ThreadList, { sessions: chatSessions as any, onSelect }),
    );

    const items = container.querySelectorAll("[data-session-item]");
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("Full Session");
  });

  it("mixes SessionInfo and ChatSession objects", () => {
    const mixed = [
      { id: "info-1", title: "Info Session", updatedAt: new Date(), messageCount: 5 },
      {
        id: "full-1",
        title: "Full Session",
        messages: [],
        config: { model: "m", backend: "b" },
        metadata: { messageCount: 0, custom: {} },
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const { container } = render(
      createElement(ThreadList, { sessions: mixed as any, onSelect: vi.fn() }),
    );

    expect(container.querySelectorAll("[data-session-item]")).toHaveLength(2);
  });
});

// ─── BackendSelector ────────────────────────────────────────────

describe("BackendSelector", () => {
  const testBackends = [
    { name: "copilot" },
    { name: "claude" },
    { name: "openai" },
  ];

  it("renders all backends with data attributes", () => {
    const { container } = render(
      createElement(BackendSelector, {
        backends: testBackends,
        onSelect: vi.fn(),
      }),
    );

    expect(container.querySelector("[data-backend-selector]")).not.toBeNull();
    const items = container.querySelectorAll("[data-backend-item]");
    expect(items).toHaveLength(3);
  });

  it("calls onSelect when backend clicked", () => {
    const onSelect = vi.fn();
    const { container } = render(
      createElement(BackendSelector, {
        backends: testBackends,
        onSelect,
      }),
    );

    const claudeBtn = container.querySelector('[data-backend-name="claude"]')!;
    fireEvent.click(claudeBtn);

    expect(onSelect).toHaveBeenCalledWith("claude");
  });

  it("renders backend names as button text", () => {
    const { container } = render(
      createElement(BackendSelector, {
        backends: testBackends,
        onSelect: vi.fn(),
      }),
    );

    const items = container.querySelectorAll("[data-backend-item]");
    const names = Array.from(items).map((i) => i.textContent);
    expect(names).toEqual(["copilot", "claude", "openai"]);
  });

  it("renders empty when no backends", () => {
    const { container } = render(
      createElement(BackendSelector, {
        backends: [],
        onSelect: vi.fn(),
      }),
    );

    expect(container.querySelector("[data-backend-selector]")).not.toBeNull();
    expect(container.querySelectorAll("[data-backend-item]")).toHaveLength(0);
  });
});

// ─── ContextStatsDisplay ──────────────────────────────────────

import { ContextStatsDisplay } from "../../../src/chat/react/ContextStatsDisplay.js";

describe("ContextStatsDisplay", () => {
  it("renders null when stats is null", () => {
    const { container } = render(createElement(ContextStatsDisplay, { stats: null }));
    expect(container.querySelector("[data-context-stats]")).toBeNull();
  });

  it("renders null when real data is not available", () => {
    const stats = { totalTokens: 500, availableBudget: 3500, removedCount: 0, wasTruncated: false };
    const { container } = render(createElement(ContextStatsDisplay, { stats }));
    expect(container.querySelector("[data-context-stats]")).toBeNull();
  });

  it("renders real token count and budget", () => {
    const stats = {
      totalTokens: 500, availableBudget: 3500, removedCount: 0, wasTruncated: false,
      realPromptTokens: 500, realCompletionTokens: 100, modelContextWindow: 4000,
    };
    const { container } = render(createElement(ContextStatsDisplay, { stats }));
    expect(container.querySelector("[data-context-stats]")).not.toBeNull();
    expect(container.querySelector("[data-context-tokens]")?.textContent).toContain("500 tokens");
    expect(container.querySelector("[data-context-budget]")?.textContent).toContain("3.5k available");
  });

  it("shows truncation status", () => {
    const stats = {
      totalTokens: 3000, availableBudget: 1000, removedCount: 5, wasTruncated: true,
      realPromptTokens: 3000, realCompletionTokens: 500, modelContextWindow: 4000,
    };
    const { container } = render(createElement(ContextStatsDisplay, { stats }));
    expect(container.querySelector("[data-context-stats]")?.getAttribute("data-context-truncated")).toBe("true");
    expect(container.querySelector("[data-context-removed]")?.textContent).toContain("5 trimmed");
  });

  it("hides removed count when zero", () => {
    const stats = {
      totalTokens: 100, availableBudget: 900, removedCount: 0, wasTruncated: false,
      realPromptTokens: 100, realCompletionTokens: 50, modelContextWindow: 1000,
    };
    const { container } = render(createElement(ContextStatsDisplay, { stats }));
    expect(container.querySelector("[data-context-removed]")).toBeNull();
  });

  it("shows usage percentage from real data", () => {
    const stats = {
      totalTokens: 750, availableBudget: 250, removedCount: 0, wasTruncated: false,
      realPromptTokens: 3000, realCompletionTokens: 200, modelContextWindow: 4000,
    };
    const { container } = render(createElement(ContextStatsDisplay, { stats }));
    expect(container.querySelector("[data-context-usage]")?.textContent).toBe("75%");
  });
});


