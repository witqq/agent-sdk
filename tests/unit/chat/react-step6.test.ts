/**
 * Tests for ProviderModelSelector unified component and useProviders feature detection.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProviderModelSelector } from "../../../src/chat/react/ProviderModelSelector.js";
import { ModelSelector } from "../../../src/chat/react/ModelSelector.js";
import type { ProviderConfig } from "../../../src/chat/provider-types.js";
import type { ModelOption } from "../../../src/chat/react/useModels.js";

function render(element: any): string {
  return renderToStaticMarkup(element);
}

const mockProviders: ProviderConfig[] = [
  { id: "p1", backend: "copilot", model: "gpt-5-mini", label: "GPT Mini", createdAt: Date.now() },
  { id: "p2", backend: "claude", model: "claude-haiku", label: "Claude Haiku", createdAt: Date.now() },
];

const mockModels: ModelOption[] = [
  { id: "gpt-5-mini", name: "GPT-5 Mini" },
  { id: "claude-haiku", name: "Claude Haiku", tier: "fast" },
];

describe("ProviderModelSelector", () => {
  it("renders in provider mode when providers are present", () => {
    const html = render(
      createElement(ProviderModelSelector, {
        providers: mockProviders,
        activeProviderId: "p1",
        onSelectProvider: vi.fn(),
      }),
    );
    expect(html).toContain('data-pms-mode="provider"');
    expect(html).toContain("GPT Mini");
  });

  it("renders in model mode when no providers", () => {
    const html = render(
      createElement(ProviderModelSelector, {
        models: mockModels,
        selectedModel: "gpt-5-mini",
        onSelectModel: vi.fn(),
      }),
    );
    expect(html).toContain('data-pms-mode="model"');
    expect(html).toContain("GPT-5 Mini");
  });

  it("shows placeholder when nothing selected", () => {
    const html = render(
      createElement(ProviderModelSelector, {
        providers: [],
        models: [],
        placeholder: "Choose...",
      }),
    );
    expect(html).toContain("Choose...");
  });

  it("renders with data-provider-model-selector attribute", () => {
    const html = render(
      createElement(ProviderModelSelector, {
        providers: mockProviders,
        onSelectProvider: vi.fn(),
      }),
    );
    expect(html).toContain("data-provider-model-selector");
  });

  it("renders trigger button with data-pms-trigger", () => {
    const html = render(
      createElement(ProviderModelSelector, {
        models: mockModels,
        onSelectModel: vi.fn(),
      }),
    );
    expect(html).toContain("data-pms-trigger");
  });

  it("shows selected provider label", () => {
    const html = render(
      createElement(ProviderModelSelector, {
        providers: mockProviders,
        activeProviderId: "p2",
        onSelectProvider: vi.fn(),
      }),
    );
    expect(html).toContain("Claude Haiku");
  });

  it("shows selected model name when in model mode", () => {
    const html = render(
      createElement(ProviderModelSelector, {
        models: mockModels,
        selectedModel: "claude-haiku",
        onSelectModel: vi.fn(),
      }),
    );
    expect(html).toContain("Claude Haiku");
  });

  it("falls back to model id when model not in list", () => {
    const html = render(
      createElement(ProviderModelSelector, {
        models: [],
        selectedModel: "unknown-model",
        onSelectModel: vi.fn(),
      }),
    );
    expect(html).toContain("unknown-model");
  });
});

describe("useProviders feature detection", () => {
  it("useProviders module exports are available", async () => {
    const mod = await import("../../../src/chat/react/useProviders.js");
    expect(typeof mod.useProviders).toBe("function");
  });

  it("useProviders uses feature detection not hard cast", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("src/chat/react/useProviders.ts", "utf-8");
    // Should NOT have `as IChatClient` hard-cast
    expect(content).not.toContain("as IChatClient");
    // Should use feature detection
    expect(content).toContain("isProviderCapable");
  });
});

describe("ModelSelector hook ordering (P35 fix)", () => {
  it("renders free-text mode without hook ordering issues", () => {
    // This would crash before the fix due to hooks after conditional return
    const html = render(
      createElement(ProviderModelSelector, {
        providers: [],
        models: [],
        placeholder: "Empty",
        onSelectModel: vi.fn(),
      }),
    );
    expect(html).toBeTruthy();
  });

  it("ModelSelector renders free-text when models empty", () => {
    const html = render(
      createElement(ModelSelector, {
        models: [],
        onSelect: vi.fn(),
        allowFreeText: true,
      }),
    );
    expect(html).toContain("data-model-selector-freetext");
  });

  it("ModelSelector renders dropdown when models present", () => {
    const html = render(
      createElement(ModelSelector, {
        models: mockModels,
        onSelect: vi.fn(),
      }),
    );
    expect(html).toContain("data-model-selector-trigger");
    expect(html).not.toContain("data-model-selector-freetext");
  });
});
