import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const themePath = resolve(__dirname, "../../../src/chat/react/theme.css");
const distThemePath = resolve(__dirname, "../../../dist/chat/react/theme.css");

describe("Theme CSS", () => {
  const css = readFileSync(themePath, "utf-8");

  describe("file structure", () => {
    it("exists at src/chat/react/theme.css", () => {
      expect(existsSync(themePath)).toBe(true);
    });

    it("is non-empty", () => {
      expect(css.length).toBeGreaterThan(1000);
    });

    it("is valid CSS (no unclosed braces)", () => {
      const opens = (css.match(/{/g) || []).length;
      const closes = (css.match(/}/g) || []).length;
      expect(opens).toBe(closes);
    });
  });

  describe("custom properties", () => {
    const requiredTokens = [
      "--agent-sdk-bg",
      "--agent-sdk-bg-secondary",
      "--agent-sdk-bg-tertiary",
      "--agent-sdk-fg",
      "--agent-sdk-fg-muted",
      "--agent-sdk-primary",
      "--agent-sdk-primary-fg",
      "--agent-sdk-primary-hover",
      "--agent-sdk-border",
      "--agent-sdk-error",
      "--agent-sdk-success",
      "--agent-sdk-warning",
      "--agent-sdk-user-bg",
      "--agent-sdk-user-fg",
      "--agent-sdk-assistant-bg",
      "--agent-sdk-code-bg",
      "--agent-sdk-code-fg",
      "--agent-sdk-font-family",
      "--agent-sdk-font-mono",
      "--agent-sdk-font-size",
      "--agent-sdk-line-height",
      "--agent-sdk-radius",
      "--agent-sdk-spacing-sm",
      "--agent-sdk-spacing-md",
      "--agent-sdk-spacing-lg",
      "--agent-sdk-shadow",
      "--agent-sdk-transition",
    ];

    for (const token of requiredTokens) {
      it(`defines ${token} with a default value`, () => {
        // Must appear in :root (light theme default)
        const regex = new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`);
        expect(css).toMatch(regex);
      });
    }

    it("all custom properties have --agent-sdk- prefix", () => {
      const customProps = css.match(/--agent-sdk-[\w-]+/g) || [];
      expect(customProps.length).toBeGreaterThan(20);
      // All should start with --agent-sdk-
      for (const prop of customProps) {
        expect(prop).toMatch(/^--agent-sdk-/);
      }
    });
  });

  describe("dark mode", () => {
    it("has explicit dark theme via [data-theme=\"dark\"]", () => {
      expect(css).toContain('[data-theme="dark"]');
    });

    it("has auto dark mode via prefers-color-scheme media query", () => {
      expect(css).toContain("prefers-color-scheme: dark");
    });

    it("respects data-theme=\"light\" override", () => {
      // The media query should not apply when data-theme is explicitly set
      expect(css).toContain(':root:not([data-theme])');
    });

    it("overrides all key tokens in dark mode", () => {
      const darkSection = css.split('[data-theme="dark"]')[1]?.split("}")[0] || "";
      expect(darkSection).toContain("--agent-sdk-bg:");
      expect(darkSection).toContain("--agent-sdk-fg:");
      expect(darkSection).toContain("--agent-sdk-primary:");
      expect(darkSection).toContain("--agent-sdk-border:");
    });
  });

  describe("component selector coverage", () => {
    // Thread component
    it("styles [data-thread]", () => {
      expect(css).toMatch(/\[data-thread\]\s*\{/);
    });

    it("styles [data-thread-message]", () => {
      expect(css).toContain("[data-thread-message]");
    });

    it("styles user messages [data-role=\"user\"]", () => {
      expect(css).toContain('[data-role="user"]');
    });

    it("styles assistant messages [data-role=\"assistant\"]", () => {
      expect(css).toContain('[data-role="assistant"]');
    });

    it("styles streaming indicator [data-thread-loading]", () => {
      expect(css).toContain("[data-thread-loading]");
    });

    // Message parts
    it("styles [data-part=\"text\"]", () => {
      expect(css).toContain('[data-part="text"]');
    });

    it("styles [data-part=\"reasoning\"]", () => {
      expect(css).toContain('[data-part="reasoning"]');
    });

    it("styles [data-part=\"tool_call\"]", () => {
      expect(css).toContain('[data-part="tool_call"]');
    });

    it("styles [data-part=\"source\"]", () => {
      expect(css).toContain('[data-part="source"]');
    });

    it("styles [data-part=\"file\"]", () => {
      expect(css).toContain('[data-part="file"]');
    });

    // Composer
    it("styles [data-composer]", () => {
      expect(css).toMatch(/\[data-composer\]\s*\{/);
    });

    it("styles send button [data-action=\"send\"]", () => {
      expect(css).toContain('[data-action="send"]');
    });

    it("styles stop button [data-action=\"stop\"]", () => {
      expect(css).toContain('[data-action="stop"]');
    });

    // ThinkingBlock
    it("styles [data-thinking]", () => {
      expect(css).toMatch(/\[data-thinking\]\s*\{/);
    });

    it("styles streaming thinking [data-streaming]", () => {
      expect(css).toContain("[data-streaming]");
    });

    // ToolCallView
    it("styles [data-tool-status]", () => {
      expect(css).toMatch(/\[data-tool-status\]\s*\{/);
    });

    it("styles all tool status variants", () => {
      const statuses = ["pending", "running", "complete", "error", "requires_approval"];
      for (const status of statuses) {
        expect(css).toContain(`[data-tool-status="${status}"]`);
      }
    });

    it("styles tool labels", () => {
      const labels = ["name", "status", "args", "result", "error"];
      for (const label of labels) {
        expect(css).toContain(`[data-tool-label="${label}"]`);
      }
    });

    it("styles approve/deny buttons", () => {
      expect(css).toContain('[data-action="approve"]');
      expect(css).toContain('[data-action="deny"]');
    });

    // ThreadList
    it("styles [data-thread-list]", () => {
      expect(css).toMatch(/\[data-thread-list\]\s*\{/);
    });

    it("styles [data-thread-list-search]", () => {
      expect(css).toContain("[data-thread-list-search]");
    });

    it("styles [data-session-item]", () => {
      expect(css).toContain("[data-session-item]");
    });

    it("styles [data-session-active]", () => {
      expect(css).toContain('[data-session-active="true"]');
    });

    it("styles create session button", () => {
      expect(css).toContain('[data-action="create-session"]');
    });

    it("styles delete session button", () => {
      expect(css).toContain('[data-action="delete-session"]');
    });

    // ModelSelector
    it("styles [data-model-selector]", () => {
      expect(css).toMatch(/\[data-model-selector\]\s*\{/);
    });

    it("styles [data-model-selector-trigger]", () => {
      expect(css).toContain("[data-model-selector-trigger]");
    });

    it("styles [data-model-selector-dropdown]", () => {
      expect(css).toContain("[data-model-selector-dropdown]");
    });

    it("styles [data-model-selector-search]", () => {
      expect(css).toContain("[data-model-selector-search]");
    });

    it("styles [data-model-option]", () => {
      expect(css).toContain("[data-model-option]");
    });

    it("styles [data-model-selected]", () => {
      expect(css).toContain("[data-model-selected]");
    });

    it("styles [data-model-highlighted]", () => {
      expect(css).toContain("[data-model-highlighted]");
    });

    it("styles tier badges [data-tier]", () => {
      expect(css).toContain("[data-tier]");
    });

    // AuthDialog
    it("styles [data-auth-dialog]", () => {
      expect(css).toMatch(/\[data-auth-dialog\]\s*\{/);
    });

    it("styles [data-auth-selector]", () => {
      expect(css).toContain("[data-auth-selector]");
    });

    it("styles [data-auth-backend]", () => {
      expect(css).toContain("[data-auth-backend]");
    });

    it("styles [data-auth-selected]", () => {
      expect(css).toContain('[data-auth-selected="true"]');
    });

    it("styles [data-auth-content]", () => {
      expect(css).toContain("[data-auth-content]");
    });

    it("styles [data-auth-flow]", () => {
      expect(css).toContain("[data-auth-flow]");
    });

    it("styles [data-device-code]", () => {
      expect(css).toContain("[data-device-code]");
    });

    it("styles [data-verification-url]", () => {
      expect(css).toContain("[data-verification-url]");
    });

    it("styles [data-auth-loading]", () => {
      expect(css).toContain("[data-auth-loading]");
    });

    it("styles [data-auth-error-display]", () => {
      expect(css).toContain("[data-auth-error-display]");
    });

    // MarkdownRenderer
    it("styles [data-md-root]", () => {
      expect(css).toMatch(/\[data-md-root\]\s*\{/);
    });

    it("styles [data-md-heading]", () => {
      expect(css).toContain("[data-md-heading]");
    });

    it("styles [data-md-paragraph]", () => {
      expect(css).toContain("[data-md-paragraph]");
    });

    it("styles [data-md-code-block]", () => {
      expect(css).toContain("[data-md-code-block]");
    });

    it("styles [data-md-inline-code]", () => {
      expect(css).toContain("[data-md-inline-code]");
    });

    it("styles [data-md-blockquote]", () => {
      expect(css).toContain("[data-md-blockquote]");
    });

    it("styles [data-md-list]", () => {
      expect(css).toContain("[data-md-list]");
    });
  });

  describe("animations", () => {
    it("defines streaming cursor blink animation", () => {
      expect(css).toContain("agent-sdk-blink");
    });

    it("defines pulse animation for thinking indicator", () => {
      expect(css).toContain("agent-sdk-pulse");
    });

    it("defines spin animation for loading states", () => {
      expect(css).toContain("agent-sdk-spin");
    });

    it("defines fade-in animation for message appearance", () => {
      expect(css).toContain("agent-sdk-fade-in");
    });
  });

  describe("package export", () => {
    it("is listed in package.json exports", () => {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../../package.json"), "utf-8"));
      expect(pkg.exports["./chat/react/theme.css"]).toBe("./dist/chat/react/theme.css");
    });

    it("exists in dist after build", () => {
      expect(existsSync(distThemePath)).toBe(true);
    });

    it("dist copy matches source", () => {
      if (existsSync(distThemePath)) {
        const distCss = readFileSync(distThemePath, "utf-8");
        expect(distCss).toBe(css);
      }
    });
  });

  describe("layout helpers", () => {
    it("defines .agent-sdk-layout class", () => {
      expect(css).toContain(".agent-sdk-layout");
    });

    it("layout uses flex column with overflow hidden", () => {
      expect(css).toMatch(/\.agent-sdk-layout\s*\{[^}]*display:\s*flex/);
      expect(css).toMatch(/\.agent-sdk-layout\s*\{[^}]*flex-direction:\s*column/);
      expect(css).toMatch(/\.agent-sdk-layout\s*\{[^}]*overflow:\s*hidden/);
    });

    it("thread inside layout gets flex: 1 and min-height: 0", () => {
      expect(css).toMatch(/\.agent-sdk-layout\s*>\s*\[data-thread\]\s*\{[^}]*flex:\s*1/);
      expect(css).toMatch(/\.agent-sdk-layout\s*>\s*\[data-thread\]\s*\{[^}]*min-height:\s*0/);
    });

    it("composer inside layout gets flex-shrink: 0", () => {
      expect(css).toMatch(/\.agent-sdk-layout\s*>\s*\[data-composer\]\s*\{[^}]*flex-shrink:\s*0/);
    });

    it("defines .agent-sdk-app class for full-page layout", () => {
      expect(css).toContain(".agent-sdk-app");
    });

    it("app layout sets height: 100vh", () => {
      expect(css).toMatch(/\.agent-sdk-app\s*\{[^}]*height:\s*100vh/);
    });
  });

  describe("box-sizing", () => {
    it("applies box-sizing: border-box to themed elements", () => {
      expect(css).toContain("box-sizing: border-box");
    });
  });

  describe("textarea overflow", () => {
    it("textarea has max-height constraint", () => {
      expect(css).toMatch(/\[data-composer\]\s*textarea\s*\{[^}]*max-height/);
    });

    it("textarea has overflow: hidden", () => {
      expect(css).toMatch(/\[data-composer\]\s*textarea\s*\{[^}]*overflow:\s*hidden/);
    });
  });

  describe("no hardcoded colors outside tokens", () => {
    it("does not use #fff outside of custom property definitions", () => {
      const lines = css.split("\n");
      for (const line of lines) {
        if (line.includes("#fff") && !line.includes("--agent-sdk-")) {
          throw new Error(`Found hardcoded #fff outside tokens: ${line.trim()}`);
        }
      }
    });
  });
});
