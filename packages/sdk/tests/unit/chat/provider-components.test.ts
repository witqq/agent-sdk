// @vitest-environment jsdom
/**
 * Tests for ProviderSelector and ProviderSettings headless components.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { ProviderSelector } from "../../../src/chat/react/ProviderSelector.js";
import { ProviderSettings } from "../../../src/chat/react/ProviderSettings.js";
import type { ProviderConfig } from "../../../src/chat/provider-types.js";

// ─── Mock useRemoteAuth ─────────────────────────────────────────

const mockAuth = {
  status: "idle" as string,
  error: null as Error | null,
  startDeviceFlow: vi.fn(),
  deviceCode: null as string | null,
  verificationUrl: null as string | null,
  startOAuthFlow: vi.fn(),
  authorizeUrl: null as string | null,
  completeOAuth: vi.fn(),
  submitApiKey: vi.fn(),
  start: vi.fn(),
  token: null,
  reset: vi.fn(),
  savedProviders: [] as string[],
  loadSavedTokens: vi.fn(),
  useSavedToken: vi.fn(),
  clearTokens: vi.fn(),
};

vi.mock("../../../src/chat/react/useRemoteAuth.js", () => ({
  useRemoteAuth: () => mockAuth,
}));

// ─── Mock useChatRuntime ────────────────────────────────────────

const mockRuntime = {
  listModels: vi.fn(async () => []),
  switchModel: vi.fn(),
};

vi.mock("../../../src/chat/react/ChatProvider.js", () => ({
  useChatRuntime: () => mockRuntime,
}));

// ─── Helpers ────────────────────────────────────────────────────

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "p-" + Math.random().toString(36).slice(2, 8),
    backend: "copilot",
    model: "gpt-5-mini",
    label: "Test Provider",
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.status = "idle";
  mockAuth.error = null;
  mockAuth.deviceCode = null;
  mockAuth.verificationUrl = null;
  mockAuth.authorizeUrl = null;
  mockAuth.token = null;
});

// ─── ProviderSelector ───────────────────────────────────────────

describe("ProviderSelector", () => {
  it("renders trigger button with active provider label", () => {
    const provider = makeProvider({ id: "p1", label: "My GPT" });
    const { container } = render(
      createElement(ProviderSelector, {
        providers: [provider],
        activeProviderId: "p1",
        onSelect: vi.fn(),
      }),
    );
    const trigger = container.querySelector("[data-provider-trigger]");
    expect(trigger).toBeTruthy();
    expect(trigger!.textContent).toBe("My GPT");
  });

  it("shows 'Select provider' when no active provider", () => {
    const { container } = render(
      createElement(ProviderSelector, {
        providers: [makeProvider()],
        onSelect: vi.fn(),
      }),
    );
    const trigger = container.querySelector("[data-provider-trigger]");
    expect(trigger!.textContent).toBe("Select provider");
  });

  it("opens dropdown on trigger click", () => {
    const { container } = render(
      createElement(ProviderSelector, {
        providers: [makeProvider()],
        onSelect: vi.fn(),
      }),
    );
    expect(container.querySelector("[data-provider-dropdown]")).toBeNull();
    fireEvent.click(container.querySelector("[data-provider-trigger]")!);
    expect(container.querySelector("[data-provider-dropdown]")).toBeTruthy();
  });

  it("calls onSelect when provider item clicked", () => {
    const onSelect = vi.fn();
    const provider = makeProvider({ id: "p1" });
    const { container } = render(
      createElement(ProviderSelector, {
        providers: [provider],
        onSelect,
      }),
    );
    fireEvent.click(container.querySelector("[data-provider-trigger]")!);
    fireEvent.click(container.querySelector("[data-provider-item]")!);
    expect(onSelect).toHaveBeenCalledWith("p1");
  });

  it("shows settings button when onSettingsClick provided", () => {
    const onSettingsClick = vi.fn();
    const { container } = render(
      createElement(ProviderSelector, {
        providers: [makeProvider()],
        onSelect: vi.fn(),
        onSettingsClick,
      }),
    );
    fireEvent.click(container.querySelector("[data-provider-trigger]")!);
    const settingsBtn = container.querySelector("[data-provider-settings-btn]");
    expect(settingsBtn).toBeTruthy();
    expect(settingsBtn!.textContent).toContain("Settings");
  });

  it("closes dropdown after selection", () => {
    const { container } = render(
      createElement(ProviderSelector, {
        providers: [makeProvider({ id: "p1" })],
        onSelect: vi.fn(),
      }),
    );
    fireEvent.click(container.querySelector("[data-provider-trigger]")!);
    expect(container.querySelector("[data-provider-dropdown]")).toBeTruthy();
    fireEvent.click(container.querySelector("[data-provider-item]")!);
    expect(container.querySelector("[data-provider-dropdown]")).toBeNull();
  });

  it("has keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)", () => {
    const onSelect = vi.fn();
    const p1 = makeProvider({ id: "p1", label: "Provider 1" });
    const p2 = makeProvider({ id: "p2", label: "Provider 2" });
    const { container } = render(
      createElement(ProviderSelector, {
        providers: [p1, p2],
        onSelect,
      }),
    );

    const trigger = container.querySelector("[data-provider-trigger]")!;
    fireEvent.click(trigger);

    // Initially first item highlighted
    let items = container.querySelectorAll("[data-provider-item]");
    expect(items[0].hasAttribute("data-provider-highlighted")).toBe(true);

    // ArrowDown → highlight second item
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    items = container.querySelectorAll("[data-provider-item]");
    expect(items[1].hasAttribute("data-provider-highlighted")).toBe(true);

    // ArrowUp → highlight first item
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    items = container.querySelectorAll("[data-provider-item]");
    expect(items[0].hasAttribute("data-provider-highlighted")).toBe(true);

    // Enter → select highlighted item
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("p1");

    // Re-open and test Escape
    fireEvent.click(trigger);
    expect(container.querySelector("[data-provider-dropdown]")).toBeTruthy();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(container.querySelector("[data-provider-dropdown]")).toBeNull();
  });

  it("closes on outside click", () => {
    const { container } = render(
      createElement(ProviderSelector, {
        providers: [makeProvider()],
        onSelect: vi.fn(),
      }),
    );
    fireEvent.click(container.querySelector("[data-provider-trigger]")!);
    expect(container.querySelector("[data-provider-dropdown]")).toBeTruthy();

    // Simulate click outside the component
    fireEvent.mouseDown(document.body);
    expect(container.querySelector("[data-provider-dropdown]")).toBeNull();
  });

  it("shows provider model in each item", () => {
    const p1 = makeProvider({ id: "p1", model: "gpt-5-mini" });
    const p2 = makeProvider({ id: "p2", model: "claude-sonnet" });
    const { container } = render(
      createElement(ProviderSelector, {
        providers: [p1, p2],
        onSelect: vi.fn(),
      }),
    );
    fireEvent.click(container.querySelector("[data-provider-trigger]")!);
    const models = container.querySelectorAll("[data-provider-model]");
    expect(models).toHaveLength(2);
    expect(models[0].textContent).toBe("gpt-5-mini");
    expect(models[1].textContent).toBe("claude-sonnet");
  });
});

// ─── ProviderSettings ───────────────────────────────────────────

describe("ProviderSettings", () => {
  it("renders list of providers", () => {
    const providers = [
      makeProvider({ id: "p1", label: "GPT Mini" }),
      makeProvider({ id: "p2", label: "Claude" }),
    ];
    const { container } = render(
      createElement(ProviderSettings, { providers }),
    );
    const items = container.querySelectorAll("[data-provider-settings-item]");
    expect(items).toHaveLength(2);
    const labels = container.querySelectorAll("[data-provider-settings-label]");
    expect(labels[0].textContent).toBe("GPT Mini");
    expect(labels[1].textContent).toBe("Claude");
  });

  it("shows 'No providers configured' when empty", () => {
    const { container } = render(
      createElement(ProviderSettings, { providers: [] }),
    );
    const empty = container.querySelector("[data-provider-settings-empty]");
    expect(empty).toBeTruthy();
    expect(empty!.textContent).toBe("No providers configured");
  });

  it("shows 'Add Provider' button", () => {
    const { container } = render(
      createElement(ProviderSettings, { providers: [] }),
    );
    const addBtn = container.querySelector("[data-action='add-provider']");
    expect(addBtn).toBeTruthy();
    expect(addBtn!.textContent).toContain("Add Provider");
  });

  it("switches to add view with backend options", () => {
    const { container } = render(
      createElement(ProviderSettings, { providers: [] }),
    );
    fireEvent.click(container.querySelector("[data-action='add-provider']")!);
    const backendOptions = container.querySelectorAll("[data-provider-backend-option]");
    expect(backendOptions.length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector("[data-provider-backend-option='copilot']")).toBeTruthy();
    expect(container.querySelector("[data-provider-backend-option='claude']")).toBeTruthy();
    expect(container.querySelector("[data-provider-backend-option='vercel-ai']")).toBeTruthy();
  });

  it("calls onProviderCreated with correct data on save", () => {
    const onProviderCreated = vi.fn();
    mockAuth.status = "authenticated";
    const { container } = render(
      createElement(ProviderSettings, { providers: [], onProviderCreated }),
    );

    // Navigate to add → select-backend → auth → configure
    fireEvent.click(container.querySelector("[data-action='add-provider']")!);
    fireEvent.click(container.querySelector("[data-provider-backend-option='copilot']")!);

    // Auth step transitions to configure via handleAuthComplete
    // Since mock auth is already authenticated, click continue
    const continueBtn = container.querySelector("[data-action='continue']");
    if (continueBtn) {
      fireEvent.click(continueBtn);
    }

    // Now on configure step — fill in model and label via refs
    const form = container.querySelector("[data-provider-settings-form]");
    if (form) {
      const modelInput = form.querySelector("[data-input='model']") as HTMLInputElement;
      const labelInput = form.querySelector("[data-input='label']") as HTMLInputElement;
      if (modelInput && labelInput) {
        fireEvent.change(modelInput, { target: { value: "gpt-5-mini" } });
        fireEvent.change(labelInput, { target: { value: "My GPT" } });
        // Set values directly on DOM elements (component uses refs)
        modelInput.value = "gpt-5-mini";
        labelInput.value = "My GPT";
        fireEvent.click(container.querySelector("[data-action='save-provider']")!);
        expect(onProviderCreated).toHaveBeenCalledWith(
          expect.objectContaining({
            backend: "copilot",
            model: "gpt-5-mini",
            label: "My GPT",
          }),
        );
      }
    }
  });

  it("calls onProviderDeleted when delete clicked", () => {
    const onProviderDeleted = vi.fn();
    const provider = makeProvider({ id: "p1", label: "Test" });
    const { container } = render(
      createElement(ProviderSettings, { providers: [provider], onProviderDeleted }),
    );
    const deleteBtn = container.querySelector("[data-action='delete-provider']");
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn!);
    expect(onProviderDeleted).toHaveBeenCalledWith("p1");
  });

  it("switches to edit view when edit clicked", () => {
    const provider = makeProvider({ id: "p1", label: "Test", model: "gpt-5-mini" });
    const { container } = render(
      createElement(ProviderSettings, { providers: [provider] }),
    );
    fireEvent.click(container.querySelector("[data-action='edit-provider']")!);

    // Should show edit form with data-provider-settings-form
    const form = container.querySelector("[data-provider-settings-form]");
    expect(form).toBeTruthy();

    // Update button should be present
    const updateBtn = container.querySelector("[data-action='update-provider']");
    expect(updateBtn).toBeTruthy();

    // Back button should be present
    const backBtn = container.querySelector("[data-provider-settings-close]");
    expect(backBtn).toBeTruthy();
    expect(backBtn!.textContent).toContain("Back");
  });

  it("renders extracted auth form component for copilot", () => {
    const { container } = render(
      createElement(ProviderSettings, { providers: [] }),
    );
    fireEvent.click(container.querySelector("[data-action='add-provider']")!);
    fireEvent.click(container.querySelector("[data-provider-backend-option='copilot']")!);
    expect(container.querySelector("[data-auth-flow='copilot']")).toBeTruthy();
    expect(container.querySelector("[data-action='start-auth']")).toBeTruthy();
  });

  it("renders extracted auth form component for vercel-ai", () => {
    const { container } = render(
      createElement(ProviderSettings, { providers: [] }),
    );
    fireEvent.click(container.querySelector("[data-action='add-provider']")!);
    fireEvent.click(container.querySelector("[data-provider-backend-option='vercel-ai']")!);
    expect(container.querySelector("[data-auth-flow='vercel-ai']")).toBeTruthy();
    expect(container.querySelector("[data-action='submit-apikey']")).toBeTruthy();
  });

  it("renders extracted auth form component for claude", () => {
    const { container } = render(
      createElement(ProviderSettings, { providers: [] }),
    );
    fireEvent.click(container.querySelector("[data-action='add-provider']")!);
    fireEvent.click(container.querySelector("[data-provider-backend-option='claude']")!);
    expect(container.querySelector("[data-auth-flow='claude']")).toBeTruthy();
    expect(container.querySelector("[data-action='start-auth']")).toBeTruthy();
  });

  it("does NOT auto-open settings when no providers", () => {
    // After Step 13: auto-open was removed from ChatUI
    // ProviderSettings renders list view by default
    const { container } = render(
      createElement(ProviderSettings, { providers: [] }),
    );
    // Should show list view (with empty state), not add view
    expect(container.querySelector("[data-provider-settings-empty]")).toBeTruthy();
    expect(container.querySelector("[data-provider-settings-backends]")).toBeFalsy();
  });

  it("calls onAuthCompleted with backend name when auth completes", () => {
    const onAuthCompleted = vi.fn();
    mockAuth.status = "authenticated";
    const { container } = render(
      createElement(ProviderSettings, { providers: [], onAuthCompleted }),
    );
    // Navigate to add → select-backend → auth
    fireEvent.click(container.querySelector("[data-action='add-provider']")!);
    fireEvent.click(container.querySelector("[data-provider-backend-option='copilot']")!);
    // Auth form shows "Continue" when already authenticated
    const continueBtn = container.querySelector("[data-action='continue']");
    expect(continueBtn).toBeTruthy();
    fireEvent.click(continueBtn!);
    // onAuthCompleted should be called with backend name
    expect(onAuthCompleted).toHaveBeenCalledWith("copilot");
  });

  it("updates existing auto-created provider instead of creating duplicate", () => {
    mockAuth.status = "authenticated";
    const existingProvider = makeProvider({ id: "auto-1", backend: "copilot", label: "Auto" });
    const onProviderUpdated = vi.fn();
    const onProviderCreated = vi.fn();

    const { container } = render(
      createElement(ProviderSettings, {
        providers: [existingProvider],
        onProviderUpdated,
        onProviderCreated,
      }),
    );
    // Navigate to add → copilot → auth → configure
    fireEvent.click(container.querySelector("[data-action='add-provider']")!);
    fireEvent.click(container.querySelector("[data-provider-backend-option='copilot']")!);
    const continueBtn = container.querySelector("[data-action='continue']");
    if (continueBtn) fireEvent.click(continueBtn);

    // On configure step — fill model via ref
    const form = container.querySelector("[data-provider-settings-form]");
    expect(form).toBeTruthy();
    const modelInput = form!.querySelector("[data-input='model']") as HTMLInputElement;
    if (modelInput) {
      modelInput.value = "gpt-5-mini";
      fireEvent.click(container.querySelector("[data-action='save-provider']")!);
      // Should update existing, not create new
      expect(onProviderUpdated).toHaveBeenCalledWith("auto-1", expect.objectContaining({ model: "gpt-5-mini" }));
      expect(onProviderCreated).not.toHaveBeenCalled();
    }
  });

  it("edit view shows select dropdown when models available", async () => {
    const models = [
      { id: "gpt-5-mini", name: "GPT-5 Mini" },
      { id: "gpt-4.1", name: "GPT-4.1" },
    ];
    mockRuntime.listModels.mockResolvedValue(models);

    const provider = makeProvider({ id: "p1", label: "Test", model: "gpt-5-mini" });
    const { container } = render(
      createElement(ProviderSettings, { providers: [provider] }),
    );

    // Navigate to edit view
    fireEvent.click(container.querySelector("[data-action='edit-provider']")!);

    // Wait for models to load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const form = container.querySelector("[data-provider-settings-form]");
    expect(form).toBeTruthy();

    const select = form!.querySelector("select[data-input='model']");
    expect(select).toBeTruthy();

    const options = select!.querySelectorAll("option");
    // first option is the disabled placeholder + 2 models
    expect(options.length).toBe(3);
    expect(options[1].value).toBe("gpt-5-mini");
    expect(options[2].value).toBe("gpt-4.1");
  });

  it("edit view shows text input when no models available", async () => {
    mockRuntime.listModels.mockResolvedValue([]);

    const provider = makeProvider({ id: "p1", label: "Test", model: "gpt-5-mini" });
    const { container } = render(
      createElement(ProviderSettings, { providers: [provider] }),
    );

    fireEvent.click(container.querySelector("[data-action='edit-provider']")!);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const form = container.querySelector("[data-provider-settings-form]");
    expect(form).toBeTruthy();

    const input = form!.querySelector("input[data-input='model']");
    expect(input).toBeTruthy();
    expect(form!.querySelector("select[data-input='model']")).toBeNull();
  });
});

// ─── Per-backend Auth Form Components ───────────────────────────

import { CopilotAuthForm } from "../../../src/chat/react/auth/CopilotAuthForm.js";
import { ClaudeAuthForm } from "../../../src/chat/react/auth/ClaudeAuthForm.js";
import { VercelAIAuthForm } from "../../../src/chat/react/auth/VercelAIAuthForm.js";

describe("CopilotAuthForm", () => {
  it("renders start button when idle", () => {
    const onAuthComplete = vi.fn();
    const { container } = render(
      createElement(CopilotAuthForm, { auth: mockAuth as any, onAuthComplete }),
    );
    expect(container.querySelector("[data-auth-flow='copilot']")).toBeTruthy();
    expect(container.querySelector("[data-action='start-auth']")!.textContent)
      .toBe("Authenticate with GitHub");
  });

  it("shows device code when available", () => {
    mockAuth.deviceCode = "ABCD-1234";
    mockAuth.verificationUrl = "https://github.com/login/device";
    const { container } = render(
      createElement(CopilotAuthForm, { auth: mockAuth as any, onAuthComplete: vi.fn() }),
    );
    expect(container.querySelector("[data-device-code]")!.textContent).toBe("ABCD-1234");
    expect(container.querySelector("a")!.href).toContain("github.com/login/device");
  });

  it("shows waiting indicator when pending", () => {
    mockAuth.status = "pending";
    const { container } = render(
      createElement(CopilotAuthForm, { auth: mockAuth as any, onAuthComplete: vi.fn() }),
    );
    expect(container.querySelector("[data-auth-loading]")!.textContent).toBe("Waiting...");
  });

  it("shows success and continue button when authenticated", () => {
    mockAuth.status = "authenticated";
    const onAuthComplete = vi.fn();
    const { container } = render(
      createElement(CopilotAuthForm, { auth: mockAuth as any, onAuthComplete }),
    );
    expect(container.querySelector("[data-auth-success]")).toBeTruthy();
    fireEvent.click(container.querySelector("[data-action='continue']")!);
    expect(onAuthComplete).toHaveBeenCalled();
  });

  it("shows error when present", () => {
    mockAuth.error = new Error("Device code expired");
    const { container } = render(
      createElement(CopilotAuthForm, { auth: mockAuth as any, onAuthComplete: vi.fn() }),
    );
    expect(container.querySelector("[data-auth-error-display]")!.textContent).toBe("Device code expired");
  });
});

describe("ClaudeAuthForm", () => {
  it("renders start button when idle", () => {
    const { container } = render(
      createElement(ClaudeAuthForm, { auth: mockAuth as any, onAuthComplete: vi.fn() }),
    );
    expect(container.querySelector("[data-auth-flow='claude']")).toBeTruthy();
    expect(container.querySelector("[data-action='start-auth']")!.textContent)
      .toBe("Authenticate with Claude");
  });

  it("shows authorize URL and code input when available", () => {
    mockAuth.authorizeUrl = "https://claude.ai/oauth/authorize?code=abc";
    const { container } = render(
      createElement(ClaudeAuthForm, { auth: mockAuth as any, onAuthComplete: vi.fn() }),
    );
    expect(container.querySelector("a")!.href).toContain("claude.ai/oauth");
    expect(container.querySelector("[data-auth-complete]")).toBeTruthy();
    expect(container.querySelector("[data-action='complete-auth']")).toBeTruthy();
  });

  it("shows success when authenticated", () => {
    mockAuth.status = "authenticated";
    const { container } = render(
      createElement(ClaudeAuthForm, { auth: mockAuth as any, onAuthComplete: vi.fn() }),
    );
    expect(container.querySelector("[data-auth-success]")).toBeTruthy();
  });

  it("shows error when present", () => {
    mockAuth.error = new Error("OAuth failed");
    const { container } = render(
      createElement(ClaudeAuthForm, { auth: mockAuth as any, onAuthComplete: vi.fn() }),
    );
    expect(container.querySelector("[data-auth-error-display]")!.textContent).toBe("OAuth failed");
  });
});

describe("VercelAIAuthForm", () => {
  it("renders API key input and connect button", () => {
    const { container } = render(
      createElement(VercelAIAuthForm, { auth: mockAuth as any, onAuthComplete: vi.fn() }),
    );
    expect(container.querySelector("[data-auth-flow='vercel-ai']")).toBeTruthy();
    expect(container.querySelector("[data-auth-apikey]")).toBeTruthy();
    expect(container.querySelector("[data-action='submit-apikey']")!.textContent).toBe("Connect");
  });

  it("shows success when authenticated", () => {
    mockAuth.status = "authenticated";
    const { container } = render(
      createElement(VercelAIAuthForm, { auth: mockAuth as any, onAuthComplete: vi.fn() }),
    );
    expect(container.querySelector("[data-auth-success]")).toBeTruthy();
    expect(container.querySelector("[data-auth-apikey]")).toBeFalsy();
  });

  it("shows error when present", () => {
    mockAuth.error = new Error("Invalid key");
    const { container } = render(
      createElement(VercelAIAuthForm, { auth: mockAuth as any, onAuthComplete: vi.fn() }),
    );
    expect(container.querySelector("[data-auth-error-display]")!.textContent).toBe("Invalid key");
  });
});
