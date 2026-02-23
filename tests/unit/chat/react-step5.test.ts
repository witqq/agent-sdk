// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { useAuth } from "../../../src/chat/react/useAuth.js";
import { AuthDialog } from "../../../src/chat/react/AuthDialog.js";
import type { AuthBackend } from "../../../src/chat/react/useAuth.js";

// ─── Mocks ────────────────────────────────────────────────────

const mockWaitForToken = vi.fn();
const mockStartDeviceFlow = vi.fn();
const mockStartOAuthFlow = vi.fn();
const mockCompleteAuth = vi.fn();

// Override _authLoaders directly — it's a mutable object, no vi.mock needed.
// This avoids vi.mock unreliability with dynamic imports in vitest threads mode.
import { _authLoaders } from "../../../src/chat/react/useAuth.js";
_authLoaders.loadCopilotAuth = async () =>
  class MockCopilotAuth { startDeviceFlow = mockStartDeviceFlow; } as any;
_authLoaders.loadClaudeAuth = async () =>
  class MockClaudeAuth { startOAuthFlow = mockStartOAuthFlow; } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockStartDeviceFlow.mockResolvedValue({
    userCode: "ABCD-1234",
    verificationUrl: "https://github.com/login/device",
    waitForToken: mockWaitForToken,
  });
  mockWaitForToken.mockResolvedValue({
    accessToken: "gho_test",
    tokenType: "bearer",
    obtainedAt: Date.now(),
  });
  mockStartOAuthFlow.mockReturnValue({
    authorizeUrl: "https://claude.ai/oauth/authorize?test=1",
    completeAuth: mockCompleteAuth,
  });
  mockCompleteAuth.mockResolvedValue({
    accessToken: "sk-ant-test",
    tokenType: "bearer",
    obtainedAt: Date.now(),
    refreshToken: "rt-test",
    scopes: ["user:inference"],
  });
});

// ─── useAuth ──────────────────────────────────────────────────

describe("useAuth", () => {
  it("starts in idle status", () => {
    const { result } = renderHook(() => useAuth({ backend: "copilot" }));
    expect(result.current.status).toBe("idle");
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.deviceCode).toBeNull();
    expect(result.current.verificationUrl).toBeNull();
    expect(result.current.authorizeUrl).toBeNull();
  });

  it("startDeviceFlow transitions to pending and sets deviceCode/verificationUrl", async () => {
    // Make waitForToken hang so we can observe pending state
    mockWaitForToken.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth({ backend: "copilot" }));

    await act(async () => {
      // Don't await - it will hang intentionally
      result.current.startDeviceFlow();
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.status).toBe("pending");
    expect(result.current.deviceCode).toBe("ABCD-1234");
    expect(result.current.verificationUrl).toBe("https://github.com/login/device");
  });

  it("startDeviceFlow completes to authenticated with token", async () => {
    const onAuthenticated = vi.fn();
    const { result } = renderHook(() =>
      useAuth({ backend: "copilot", onAuthenticated }),
    );

    await act(async () => {
      await result.current.startDeviceFlow();
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.token).not.toBeNull();
    expect(result.current.token!.accessToken).toBe("gho_test");
    expect(onAuthenticated).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "gho_test" }),
    );
  });

  it("startOAuthFlow sets authorizeUrl", async () => {
    const { result } = renderHook(() => useAuth({ backend: "claude" }));

    await act(async () => {
      await result.current.startOAuthFlow();
    });

    expect(result.current.status).toBe("pending");
    expect(result.current.authorizeUrl).toBe("https://claude.ai/oauth/authorize?test=1");
  });

  it("completeOAuth transitions to authenticated", async () => {
    const onAuthenticated = vi.fn();
    const { result } = renderHook(() =>
      useAuth({ backend: "claude", onAuthenticated }),
    );

    await act(async () => {
      await result.current.startOAuthFlow();
    });

    await act(async () => {
      await result.current.completeOAuth("test-code");
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.token).not.toBeNull();
    expect(result.current.token!.accessToken).toBe("sk-ant-test");
    expect(onAuthenticated).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "sk-ant-test" }),
    );
  });

  it("submitApiKey transitions to authenticated", () => {
    const onAuthenticated = vi.fn();
    const { result } = renderHook(() =>
      useAuth({ backend: "api-key", onAuthenticated }),
    );

    act(() => {
      result.current.submitApiKey("sk-my-api-key");
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.token).not.toBeNull();
    expect(result.current.token!.accessToken).toBe("sk-my-api-key");
    expect(onAuthenticated).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "sk-my-api-key" }),
    );
  });

  it("reset returns to idle", async () => {
    const { result } = renderHook(() => useAuth({ backend: "copilot" }));

    await act(async () => {
      await result.current.startDeviceFlow();
    });

    expect(result.current.status).toBe("authenticated");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.deviceCode).toBeNull();
    expect(result.current.verificationUrl).toBeNull();
    expect(result.current.authorizeUrl).toBeNull();
  });

  it("error state on failed device flow", async () => {
    mockStartDeviceFlow.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth({ backend: "copilot" }));

    await act(async () => {
      await result.current.startDeviceFlow();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.message).toBe("Network error");
  });

  it("error resets to idle via reset", async () => {
    mockStartDeviceFlow.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useAuth({ backend: "copilot" }));

    await act(async () => {
      await result.current.startDeviceFlow();
    });

    expect(result.current.status).toBe("error");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("submitApiKey with empty key sets error", () => {
    const { result } = renderHook(() => useAuth({ backend: "api-key" }));

    act(() => {
      result.current.submitApiKey("");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error!.message).toBe("API key cannot be empty");
  });
});

// ─── AuthDialog ───────────────────────────────────────────────

describe("AuthDialog", () => {
  it("renders backend selector buttons", () => {
    const { container } = render(
      createElement(AuthDialog, {
        backends: ["copilot", "claude", "api-key"] as AuthBackend[],
      }),
    );
    const buttons = container.querySelectorAll("[data-auth-backend]");
    expect(buttons).toHaveLength(3);
    expect(buttons[0].getAttribute("data-auth-backend")).toBe("copilot");
    expect(buttons[1].getAttribute("data-auth-backend")).toBe("claude");
    expect(buttons[2].getAttribute("data-auth-backend")).toBe("api-key");
  });

  it("marks selected backend with data-auth-selected=true", () => {
    const { container } = render(
      createElement(AuthDialog, {
        backends: ["copilot", "claude"] as AuthBackend[],
        selectedBackend: "claude" as AuthBackend,
      }),
    );
    const buttons = container.querySelectorAll("[data-auth-backend]");
    expect(buttons[0].getAttribute("data-auth-selected")).toBe("false");
    expect(buttons[1].getAttribute("data-auth-selected")).toBe("true");
  });

  it("renders copilot flow when selected", () => {
    const { container } = render(
      createElement(AuthDialog, {
        backends: ["copilot"] as AuthBackend[],
        selectedBackend: "copilot" as AuthBackend,
      }),
    );
    const flow = container.querySelector("[data-auth-flow='copilot']");
    expect(flow).not.toBeNull();
    const startBtn = container.querySelector("[data-action='start-device-flow']");
    expect(startBtn).not.toBeNull();
  });

  it("renders claude flow when selected", () => {
    const { container } = render(
      createElement(AuthDialog, {
        backends: ["claude"] as AuthBackend[],
        selectedBackend: "claude" as AuthBackend,
      }),
    );
    const flow = container.querySelector("[data-auth-flow='claude']");
    expect(flow).not.toBeNull();
    const startBtn = container.querySelector("[data-action='start-oauth-flow']");
    expect(startBtn).not.toBeNull();
  });

  it("renders api-key flow when selected", () => {
    const { container } = render(
      createElement(AuthDialog, {
        backends: ["api-key"] as AuthBackend[],
        selectedBackend: "api-key" as AuthBackend,
      }),
    );
    const flow = container.querySelector("[data-auth-flow='api-key']");
    expect(flow).not.toBeNull();
  });

  it("uses custom render props when provided", () => {
    const renderCopilotFlow = vi.fn(
      (_state: { deviceCode: string; verificationUrl: string; status: string }) =>
        createElement("div", { "data-custom-copilot": "true" }, "Custom Copilot"),
    );

    const renderClaudeFlow = vi.fn(
      (_state: { authorizeUrl: string | null; status: string; completeOAuth: (code: string) => Promise<void> }) =>
        createElement("div", { "data-custom-claude": "true" }, "Custom Claude"),
    );

    const renderApiKeyFlow = vi.fn(
      (_state: { submitApiKey: (key: string) => void; status: string }) =>
        createElement("div", { "data-custom-apikey": "true" }, "Custom API Key"),
    );

    // Test claude render prop
    const { container } = render(
      createElement(AuthDialog, {
        backends: ["claude"] as AuthBackend[],
        selectedBackend: "claude" as AuthBackend,
        renderClaudeFlow,
      }),
    );

    // Claude render prop should be called since it's always available (authorizeUrl can be null)
    expect(renderClaudeFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizeUrl: null,
        status: "idle",
      }),
    );
    const customClaude = container.querySelector("[data-custom-claude]");
    expect(customClaude).not.toBeNull();

    // Test api-key render prop
    const { container: container2 } = render(
      createElement(AuthDialog, {
        backends: ["api-key"] as AuthBackend[],
        selectedBackend: "api-key" as AuthBackend,
        renderApiKeyFlow,
      }),
    );

    expect(renderApiKeyFlow).toHaveBeenCalledWith(
      expect.objectContaining({ status: "idle" }),
    );
    const customApiKey = container2.querySelector("[data-custom-apikey]");
    expect(customApiKey).not.toBeNull();
  });

  it("switches backend on button click", () => {
    const onBackendChange = vi.fn();
    const { container } = render(
      createElement(AuthDialog, {
        backends: ["copilot", "claude"] as AuthBackend[],
        onBackendChange,
      }),
    );

    const claudeBtn = container.querySelector("[data-auth-backend='claude']")!;
    fireEvent.click(claudeBtn);
    expect(onBackendChange).toHaveBeenCalledWith("claude");
  });

  it("shows data-auth-status attribute", () => {
    const { container } = render(
      createElement(AuthDialog, {
        backends: ["copilot"] as AuthBackend[],
      }),
    );
    const content = container.querySelector("[data-auth-content]");
    expect(content).not.toBeNull();
    expect(content!.getAttribute("data-auth-status")).toBe("idle");
  });
});
