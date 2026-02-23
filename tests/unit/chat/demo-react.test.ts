/**
 * Tests for the unified React demo (examples/demo/).
 * Verifies build output, server structure, and Docker config.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DEMO_DIR = path.resolve(import.meta.dirname, "../../../examples/demo");
const FRONTEND_DIR = path.join(DEMO_DIR, "frontend");
const FRONTEND_DIST = path.join(FRONTEND_DIR, "dist");

describe("Unified React Demo — Build", () => {
  it("server.ts exists and imports Chat SDK modules", () => {
    const server = fs.readFileSync(path.join(DEMO_DIR, "server.ts"), "utf-8");
    expect(server).toContain("@witqq/agent-sdk/chat/backends");
    expect(server).toContain("@witqq/agent-sdk/chat/server");
    expect(server).toContain("CopilotChatAdapter");
    expect(server).toContain("createChatHandler");
    expect(server).toContain("createAuthHandler");
    expect(server).toContain("FileTokenStore");
  });

  it("server.ts serves static files from frontend/dist", () => {
    const server = fs.readFileSync(path.join(DEMO_DIR, "server.ts"), "utf-8");
    expect(server).toContain('frontend');
    expect(server).toContain('dist');
    expect(server).toContain("serveStatic");
    expect(server).toContain("serveIndex");
  });

  it("server.ts uses SDK auth handler instead of manual routes", () => {
    const server = fs.readFileSync(path.join(DEMO_DIR, "server.ts"), "utf-8");
    // SDK auth handler replaces manual auth routes
    expect(server).toContain("createAuthHandler");
    expect(server).toContain("FileTokenStore");
    expect(server).toContain("/api/auth/");
    expect(server).toContain("/api/tokens/");
    // Runtime auto-created in onAuth callback
    expect(server).toContain("createChatHandler");
    expect(server).toContain("Runtime auto-created");
  });

  it("server.ts uses SDK chat handler for RemoteChatRuntime routes", () => {
    const server = fs.readFileSync(path.join(DEMO_DIR, "server.ts"), "utf-8");
    // SDK chat handler replaces manual RemoteChatRuntime routes
    expect(server).toContain("createChatHandler");
    expect(server).toContain("/api/chat");
    expect(server).toContain("prefix");
    expect(server).toContain("heartbeatMs");
  });

  it("server.ts has no inline HTML template literals for frontend", () => {
    const server = fs.readFileSync(path.join(DEMO_DIR, "server.ts"), "utf-8");
    expect(server).not.toContain("const HTML = `<!DOCTYPE html>");
    expect(server).not.toContain("<style>");
    expect(server).not.toContain("<script>");
  });

  it("frontend has required source files", () => {
    const requiredFiles = [
      "src/index.tsx",
      "src/App.tsx",
      "src/globals.css",
      "src/types.ts",
      "src/components/AuthDialog.tsx",
      "src/components/SessionSidebar.tsx",
      "vite.config.ts",
      "tsconfig.json",
      "package.json",
      "index.html",
    ];
    for (const file of requiredFiles) {
      expect(fs.existsSync(path.join(FRONTEND_DIR, file)), `Missing: ${file}`).toBe(true);
    }
  });

  it("frontend vite build produces dist/ with index.html and assets", () => {
    expect(fs.existsSync(FRONTEND_DIST)).toBe(true);
    const distFiles = fs.readdirSync(FRONTEND_DIST);
    expect(distFiles.some((f) => f === "index.html")).toBe(true);
    const assetsDir = path.join(FRONTEND_DIST, "assets");
    if (fs.existsSync(assetsDir)) {
      const assetFiles = fs.readdirSync(assetsDir);
      expect(assetFiles.some((f) => f.endsWith(".js"))).toBe(true);
      expect(assetFiles.some((f) => f.endsWith(".css"))).toBe(true);
    }
  });

  it("frontend index.html references built assets", () => {
    const html = fs.readFileSync(path.join(FRONTEND_DIST, "index.html"), "utf-8");
    expect(html).toContain('<div id="root">');
    expect(html).toContain(".js");
  });

  it("App.tsx uses SDK React components", () => {
    const app = fs.readFileSync(path.join(FRONTEND_DIR, "src/App.tsx"), "utf-8");
    expect(app).toContain("ChatProvider");
    expect(app).toContain("useChat");
    expect(app).toContain("Thread");
    expect(app).toContain("Composer");
    expect(app).toContain("useRemoteChat");
  });

  it("SessionSidebar uses SDK ThreadList", () => {
    const sidebar = fs.readFileSync(path.join(FRONTEND_DIR, "src/components/SessionSidebar.tsx"), "utf-8");
    expect(sidebar).toContain("ThreadList");
    expect(sidebar).toContain("useChatRuntime");
  });

  it("globals.css has SDK component styles", () => {
    const css = fs.readFileSync(path.join(FRONTEND_DIR, "src/globals.css"), "utf-8");
    expect(css).toContain("sdk-thread");
    expect(css).toContain("sdk-composer");
    expect(css).toContain("data-thread-message");
    expect(css).toContain("data-role");
    expect(css).toContain("data-part");
  });

  it("Dockerfile has multi-stage build", () => {
    const dockerfile = fs.readFileSync(path.join(DEMO_DIR, "Dockerfile"), "utf-8");
    const fromCount = (dockerfile.match(/^FROM /gm) || []).length;
    expect(fromCount).toBeGreaterThanOrEqual(3);
    expect(dockerfile).toContain("sdk-builder");
    expect(dockerfile).toContain("frontend-builder");
    expect(dockerfile).toContain("vite build");
  });

  it("docker-compose.yml exposes port 3456", () => {
    const compose = fs.readFileSync(path.join(DEMO_DIR, "docker-compose.yml"), "utf-8");
    expect(compose).toContain("3456");
    expect(compose).toContain("demo-tokens");
  });
});
