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
  it("server.ts uses createChatServer with backend adapters", () => {
    const server = fs.readFileSync(path.join(DEMO_DIR, "server.ts"), "utf-8");
    expect(server).toContain("@witqq/agent-sdk/chat/backends");
    expect(server).toContain("@witqq/agent-sdk/chat/server");
    expect(server).toContain("CopilotChatAdapter");
    expect(server).toContain("ClaudeChatAdapter");
    expect(server).toContain("VercelAIChatAdapter");
    expect(server).toContain("createChatServer");
    expect(server).toContain("createSQLiteStorage");
  });

  it("server.ts configures chat, auth, and static file serving", () => {
    const server = fs.readFileSync(path.join(DEMO_DIR, "server.ts"), "utf-8");
    expect(server).toContain("chatPrefix");
    expect(server).toContain("authPrefix");
    expect(server).toContain("staticDir");
    expect(server).toContain("heartbeatMs");
    expect(server).toContain("createChatRuntime");
  });

  it("server.ts has health endpoint and model allowlist", () => {
    const server = fs.readFileSync(path.join(DEMO_DIR, "server.ts"), "utf-8");
    expect(server).toContain("filterModels");
    expect(server).toContain("onModelSwitch");
    expect(server).toContain("createAllowlist");
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

  it("App.tsx uses ChatUI and RemoteChatClient", () => {
    const app = fs.readFileSync(path.join(FRONTEND_DIR, "src/App.tsx"), "utf-8");
    expect(app).toContain("ChatUI");
    expect(app).toContain("RemoteChatClient");
    expect(app).toContain("@witqq/agent-sdk/chat/react");
  });

  it("globals.css imports SDK theme", () => {
    const css = fs.readFileSync(path.join(FRONTEND_DIR, "src/globals.css"), "utf-8");
    expect(css).toContain("theme.css");
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
    expect(compose).toContain("./data:/data");
  });
});
