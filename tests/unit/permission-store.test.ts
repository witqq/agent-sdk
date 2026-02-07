import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { z } from "zod";
import type {
  AgentConfig,
  PermissionRequest,
  PermissionDecision,
} from "../../src/types.js";
import { ToolExecutionError } from "../../src/errors.js";
import {
  InMemoryPermissionStore,
  FilePermissionStore,
  CompositePermissionStore,
  createDefaultPermissionStore,
} from "../../src/permission-store.js";
import type { IPermissionStore } from "../../src/permission-store.js";

// ─── InMemoryPermissionStore ────────────────────────────────────

describe("InMemoryPermissionStore", () => {
  let store: InMemoryPermissionStore;

  beforeEach(() => {
    store = new InMemoryPermissionStore();
  });

  it("should return false for unapproved tool", async () => {
    expect(await store.isApproved("unknown-tool")).toBe(false);
  });

  it("should approve and check tool", async () => {
    await store.approve("my-tool", "session");
    expect(await store.isApproved("my-tool")).toBe(true);
  });

  it("should not persist 'once' scope", async () => {
    await store.approve("my-tool", "once");
    expect(await store.isApproved("my-tool")).toBe(false);
  });

  it("should persist 'session' scope", async () => {
    await store.approve("my-tool", "session");
    expect(await store.isApproved("my-tool")).toBe(true);
  });

  it("should persist 'project' scope", async () => {
    await store.approve("my-tool", "project");
    expect(await store.isApproved("my-tool")).toBe(true);
  });

  it("should persist 'always' scope", async () => {
    await store.approve("my-tool", "always");
    expect(await store.isApproved("my-tool")).toBe(true);
  });

  it("should revoke approval", async () => {
    await store.approve("my-tool", "session");
    expect(await store.isApproved("my-tool")).toBe(true);
    await store.revoke("my-tool");
    expect(await store.isApproved("my-tool")).toBe(false);
  });

  it("should clear all approvals", async () => {
    await store.approve("tool-a", "session");
    await store.approve("tool-b", "always");
    await store.clear();
    expect(await store.isApproved("tool-a")).toBe(false);
    expect(await store.isApproved("tool-b")).toBe(false);
  });

  it("should handle dispose gracefully", async () => {
    await store.approve("tool-a", "session");
    await store.dispose();
    expect(await store.isApproved("tool-a")).toBe(false);
  });

  it("should handle multiple tools independently", async () => {
    await store.approve("tool-a", "session");
    await store.approve("tool-b", "project");
    expect(await store.isApproved("tool-a")).toBe(true);
    expect(await store.isApproved("tool-b")).toBe(true);
    expect(await store.isApproved("tool-c")).toBe(false);
  });
});

// ─── FilePermissionStore ────────────────────────────────────────

describe("FilePermissionStore", () => {
  let tmpDir: string;
  let store: FilePermissionStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-sdk-test-"));
    store = new FilePermissionStore(path.join(tmpDir, "permissions.json"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return false when file does not exist", async () => {
    expect(await store.isApproved("unknown")).toBe(false);
  });

  it("should write and read back approvals", async () => {
    await store.approve("my-tool", "project");
    expect(await store.isApproved("my-tool")).toBe(true);
  });

  it("should not persist 'once' scope", async () => {
    await store.approve("my-tool", "once");
    expect(await store.isApproved("my-tool")).toBe(false);
  });

  it("should persist across separate store instances", async () => {
    const filePath = path.join(tmpDir, "permissions.json");
    const store1 = new FilePermissionStore(filePath);
    await store1.approve("my-tool", "always");

    const store2 = new FilePermissionStore(filePath);
    expect(await store2.isApproved("my-tool")).toBe(true);
  });

  it("should write valid JSON to file", async () => {
    await store.approve("my-tool", "project");
    const filePath = path.join(tmpDir, "permissions.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.approvals["my-tool"]).toBeDefined();
    expect(parsed.approvals["my-tool"].scope).toBe("project");
    expect(typeof parsed.approvals["my-tool"].timestamp).toBe("number");
  });

  it("should revoke approval from file", async () => {
    await store.approve("my-tool", "project");
    expect(await store.isApproved("my-tool")).toBe(true);
    await store.revoke("my-tool");
    expect(await store.isApproved("my-tool")).toBe(false);
  });

  it("should clear all approvals from file", async () => {
    await store.approve("tool-a", "project");
    await store.approve("tool-b", "always");
    await store.clear();
    expect(await store.isApproved("tool-a")).toBe(false);
    expect(await store.isApproved("tool-b")).toBe(false);
  });

  it("should create parent directories if needed", async () => {
    const deepPath = path.join(tmpDir, "nested", "dir", "permissions.json");
    const deepStore = new FilePermissionStore(deepPath);
    await deepStore.approve("my-tool", "always");
    expect(await deepStore.isApproved("my-tool")).toBe(true);
    expect(fs.existsSync(deepPath)).toBe(true);
  });

  it("should handle corrupted file gracefully", async () => {
    const filePath = path.join(tmpDir, "permissions.json");
    fs.writeFileSync(filePath, "not-json!", "utf-8");
    expect(await store.isApproved("anything")).toBe(false);
    // Should still be able to write
    await store.approve("my-tool", "project");
    expect(await store.isApproved("my-tool")).toBe(true);
  });

  it("should handle concurrent writes (last write wins)", async () => {
    const filePath = path.join(tmpDir, "permissions.json");
    const storeA = new FilePermissionStore(filePath);
    const storeB = new FilePermissionStore(filePath);

    await storeA.approve("tool-a", "project");
    await storeB.approve("tool-b", "always");

    // storeB's write overwrites storeA because it read before storeA wrote tool-a,
    // but after storeA wrote tool-a is already there, storeB will read-modify-write
    // Actually: storeB reads fresh each time, so it should see tool-a
    const storeC = new FilePermissionStore(filePath);
    expect(await storeC.isApproved("tool-a")).toBe(true);
    expect(await storeC.isApproved("tool-b")).toBe(true);
  });

  it("should dispose without error", async () => {
    await store.approve("my-tool", "project");
    await store.dispose();
    // File should still exist after dispose
    expect(await store.isApproved("my-tool")).toBe(true);
  });
});

// ─── CompositePermissionStore ───────────────────────────────────

describe("CompositePermissionStore", () => {
  let sessionStore: InMemoryPermissionStore;
  let projectStore: InMemoryPermissionStore;
  let userStore: InMemoryPermissionStore;
  let composite: CompositePermissionStore;

  beforeEach(() => {
    sessionStore = new InMemoryPermissionStore();
    projectStore = new InMemoryPermissionStore();
    userStore = new InMemoryPermissionStore();
    composite = new CompositePermissionStore(sessionStore, projectStore, userStore);
  });

  it("should route 'session' scope to session store", async () => {
    await composite.approve("my-tool", "session");
    expect(await sessionStore.isApproved("my-tool")).toBe(true);
    expect(await projectStore.isApproved("my-tool")).toBe(false);
    expect(await userStore.isApproved("my-tool")).toBe(false);
  });

  it("should route 'project' scope to project store", async () => {
    await composite.approve("my-tool", "project");
    expect(await sessionStore.isApproved("my-tool")).toBe(false);
    expect(await projectStore.isApproved("my-tool")).toBe(true);
    expect(await userStore.isApproved("my-tool")).toBe(false);
  });

  it("should route 'always' scope to user store", async () => {
    await composite.approve("my-tool", "always");
    expect(await sessionStore.isApproved("my-tool")).toBe(false);
    expect(await projectStore.isApproved("my-tool")).toBe(false);
    expect(await userStore.isApproved("my-tool")).toBe(true);
  });

  it("should not persist 'once' scope to any store", async () => {
    await composite.approve("my-tool", "once");
    expect(await sessionStore.isApproved("my-tool")).toBe(false);
    expect(await projectStore.isApproved("my-tool")).toBe(false);
    expect(await userStore.isApproved("my-tool")).toBe(false);
  });

  it("should check all stores for isApproved", async () => {
    await sessionStore.approve("tool-a", "session");
    await projectStore.approve("tool-b", "project");
    await userStore.approve("tool-c", "always");

    expect(await composite.isApproved("tool-a")).toBe(true);
    expect(await composite.isApproved("tool-b")).toBe(true);
    expect(await composite.isApproved("tool-c")).toBe(true);
    expect(await composite.isApproved("tool-d")).toBe(false);
  });

  it("should revoke from all stores", async () => {
    await sessionStore.approve("my-tool", "session");
    await projectStore.approve("my-tool", "project");
    await userStore.approve("my-tool", "always");
    await composite.revoke("my-tool");
    expect(await sessionStore.isApproved("my-tool")).toBe(false);
    expect(await projectStore.isApproved("my-tool")).toBe(false);
    expect(await userStore.isApproved("my-tool")).toBe(false);
  });

  it("should clear all stores", async () => {
    await sessionStore.approve("tool-a", "session");
    await projectStore.approve("tool-b", "project");
    await userStore.approve("tool-c", "always");
    await composite.clear();
    expect(await sessionStore.isApproved("tool-a")).toBe(false);
    expect(await projectStore.isApproved("tool-b")).toBe(false);
    expect(await userStore.isApproved("tool-c")).toBe(false);
  });

  it("should dispose all stores", async () => {
    const disposeSpy1 = vi.spyOn(sessionStore, "dispose");
    const disposeSpy2 = vi.spyOn(projectStore, "dispose");
    const disposeSpy3 = vi.spyOn(userStore, "dispose");
    await composite.dispose();
    expect(disposeSpy1).toHaveBeenCalledOnce();
    expect(disposeSpy2).toHaveBeenCalledOnce();
    expect(disposeSpy3).toHaveBeenCalledOnce();
  });
});

// ─── CompositePermissionStore with FilePermissionStore ───────────

describe("CompositePermissionStore with file backend", () => {
  let tmpDir: string;
  let composite: CompositePermissionStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-sdk-composite-"));
    const sessionStore = new InMemoryPermissionStore();
    const projectStore = new FilePermissionStore(path.join(tmpDir, "project-perms.json"));
    const userStore = new FilePermissionStore(path.join(tmpDir, "user-perms.json"));
    composite = new CompositePermissionStore(sessionStore, projectStore, userStore);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should persist 'project' to project file, 'always' to user file, 'session' to memory", async () => {
    await composite.approve("tool-a", "session");
    await composite.approve("tool-b", "project");
    await composite.approve("tool-c", "always");

    expect(await composite.isApproved("tool-a")).toBe(true);
    expect(await composite.isApproved("tool-b")).toBe(true);
    expect(await composite.isApproved("tool-c")).toBe(true);

    // tool-b should be in project file only
    const projectFile = path.join(tmpDir, "project-perms.json");
    const projectParsed = JSON.parse(fs.readFileSync(projectFile, "utf-8"));
    expect(projectParsed.approvals["tool-a"]).toBeUndefined();
    expect(projectParsed.approvals["tool-b"]).toBeDefined();
    expect(projectParsed.approvals["tool-c"]).toBeUndefined();

    // tool-c should be in user file only
    const userFile = path.join(tmpDir, "user-perms.json");
    const userParsed = JSON.parse(fs.readFileSync(userFile, "utf-8"));
    expect(userParsed.approvals["tool-b"]).toBeUndefined();
    expect(userParsed.approvals["tool-c"]).toBeDefined();
  });
});

// ─── createDefaultPermissionStore ───────────────────────────────

describe("createDefaultPermissionStore", () => {
  it("should create a CompositePermissionStore", () => {
    const store = createDefaultPermissionStore("/tmp/test-project");
    expect(store).toBeInstanceOf(CompositePermissionStore);
  });

  it("should work without projectDir (uses home dir)", () => {
    const store = createDefaultPermissionStore();
    expect(store).toBeInstanceOf(CompositePermissionStore);
  });
});

// ─── Integration: Auto-approval with Vercel AI backend ──────────

describe("VercelAI auto-approval with permissionStore", () => {
  // Using dynamic imports to get the mock injection helpers
  let _injectSDK: typeof import("../../src/backends/vercel-ai.js")["_injectSDK"];
  let _injectCompat: typeof import("../../src/backends/vercel-ai.js")["_injectCompat"];
  let _resetSDK: typeof import("../../src/backends/vercel-ai.js")["_resetSDK"];
  let createVercelAIService: typeof import("../../src/backends/vercel-ai.js")["createVercelAIService"];

  beforeEach(async () => {
    const mod = await import("../../src/backends/vercel-ai.js");
    _injectSDK = mod._injectSDK;
    _injectCompat = mod._injectCompat;
    _resetSDK = mod._resetSDK;
    createVercelAIService = mod.createVercelAIService;
  });

  afterEach(() => {
    _resetSDK();
  });

  function createMockSDK() {
    return {
      generateText: vi.fn(async () => ({
        text: "ok",
        toolCalls: [],
        toolResults: [],
        steps: [{ text: "ok", toolCalls: [], toolResults: [], usage: { inputTokens: 10, outputTokens: 5 }, finishReason: "stop" }],
        totalUsage: { inputTokens: 10, outputTokens: 5 },
        finishReason: "stop",
        response: { messages: [] },
      })),
      streamText: vi.fn(() => ({
        fullStream: { [Symbol.asyncIterator]: () => ({ async next() { return { done: true, value: undefined }; } }) },
        totalUsage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
        text: Promise.resolve(""),
      })),
      generateObject: vi.fn(async () => ({ object: {}, usage: { inputTokens: 0, outputTokens: 0 } })),
      tool: vi.fn((opts: Record<string, unknown>) => ({
        description: opts.description,
        parameters: opts.parameters,
        execute: opts.execute,
        needsApproval: opts.needsApproval,
      })),
      jsonSchema: vi.fn((s: unknown) => s),
    };
  }

  function createMockCompat() {
    return {
      createOpenAICompatible: vi.fn(() => ({
        chatModel: vi.fn(() => ({ modelId: "test", provider: "test" })),
        languageModel: vi.fn(() => ({ modelId: "test", provider: "test" })),
      })),
    };
  }

  it("should auto-approve via store without calling onPermission", async () => {
    const sdk = createMockSDK();
    _injectSDK(sdk);
    _injectCompat(createMockCompat());

    const store = new InMemoryPermissionStore();
    await store.approve("read-file", "session");

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({ allowed: true, scope: "session" }),
    );

    const tool = {
      name: "read-file",
      description: "Read a file",
      parameters: z.object({ path: z.string() }),
      needsApproval: true,
      execute: vi.fn(async (args: { path: string }) => `Content of ${args.path}`),
    };

    const service = createVercelAIService({ apiKey: "test" });
    const agent = service.createAgent({
      systemPrompt: "test",
      tools: [tool],
      supervisor: { onPermission },
      permissionStore: store,
    });

    await agent.run("Read file");
    const toolDef = sdk.tool.mock.results[0].value;
    await toolDef.execute({ path: "a.txt" });

    // onPermission should NOT have been called — store already approved
    expect(onPermission).not.toHaveBeenCalled();
    expect(tool.execute).toHaveBeenCalledWith({ path: "a.txt" });
  });

  it("should persist approval to store after onPermission grants", async () => {
    const sdk = createMockSDK();
    _injectSDK(sdk);
    _injectCompat(createMockCompat());

    const store = new InMemoryPermissionStore();

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({ allowed: true, scope: "session" }),
    );

    const tool = {
      name: "write-file",
      description: "Write a file",
      parameters: z.object({ path: z.string() }),
      needsApproval: true,
      execute: vi.fn(async (args: { path: string }) => `Wrote ${args.path}`),
    };

    const service = createVercelAIService({ apiKey: "test" });
    const agent = service.createAgent({
      systemPrompt: "test",
      tools: [tool],
      supervisor: { onPermission },
      permissionStore: store,
    });

    await agent.run("Write file");
    const toolDef = sdk.tool.mock.results[0].value;

    // First call — asks permission, persists to store
    await toolDef.execute({ path: "a.txt" });
    expect(onPermission).toHaveBeenCalledTimes(1);

    // Second call — auto-approved via store
    await toolDef.execute({ path: "b.txt" });
    expect(onPermission).toHaveBeenCalledTimes(1); // not called again
  });

  it("should not auto-approve 'once' scope via store", async () => {
    const sdk = createMockSDK();
    _injectSDK(sdk);
    _injectCompat(createMockCompat());

    const store = new InMemoryPermissionStore();

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({ allowed: true, scope: "once" }),
    );

    const tool = {
      name: "exec",
      description: "Execute",
      parameters: z.object({ cmd: z.string() }),
      needsApproval: true,
      execute: vi.fn(async (args: { cmd: string }) => `Ran ${args.cmd}`),
    };

    const service = createVercelAIService({ apiKey: "test" });
    const agent = service.createAgent({
      systemPrompt: "test",
      tools: [tool],
      supervisor: { onPermission },
      permissionStore: store,
    });

    await agent.run("Run command");
    const toolDef = sdk.tool.mock.results[0].value;

    await toolDef.execute({ cmd: "ls" });
    expect(onPermission).toHaveBeenCalledTimes(1);

    await toolDef.execute({ cmd: "pwd" });
    expect(onPermission).toHaveBeenCalledTimes(2); // called again
  });
});

// ─── Integration: Auto-approval with Copilot backend ────────────

describe("Copilot auto-approval with permissionStore", () => {
  let _injectSDK: typeof import("../../src/backends/copilot.js")["_injectSDK"];
  let _resetSDK: typeof import("../../src/backends/copilot.js")["_resetSDK"];
  let createCopilotService: typeof import("../../src/backends/copilot.js")["createCopilotService"];

  beforeEach(async () => {
    const mod = await import("../../src/backends/copilot.js");
    _injectSDK = mod._injectSDK;
    _resetSDK = mod._resetSDK;
    createCopilotService = mod.createCopilotService;
  });

  afterEach(() => {
    _resetSDK();
  });

  function createMockCopilotSDK() {
    let permissionHandler: ((req: any, ctx: any) => Promise<any>) | undefined;

    const mockSession = {
      sessionId: "test-session",
      on: vi.fn(() => () => {}),
      send: vi.fn(async () => "test-id"),
      sendAndWait: vi.fn(async () => ({
        type: "assistant.message",
        data: { messageId: "m1", content: "Done" },
      })),
      destroy: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    };

    const mockClient = {
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => []),
      getState: vi.fn(() => "running"),
      createSession: vi.fn(async (config: any) => {
        permissionHandler = config?.onPermissionRequest;
        return mockSession;
      }),
      listModels: vi.fn(async () => []),
      getAuthStatus: vi.fn(async () => ({ isAuthenticated: true })),
    };

    return {
      CopilotClient: vi.fn(() => mockClient),
      _client: mockClient,
      _session: mockSession,
      getPermissionHandler: () => permissionHandler,
    };
  }

  it("should auto-approve via store in permission handler", async () => {
    const sdk = createMockCopilotSDK();
    _injectSDK(sdk as any);

    const store = new InMemoryPermissionStore();
    await store.approve("read_file", "session");

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({ allowed: true, scope: "session" }),
    );

    const service = createCopilotService({});
    const agent = service.createAgent({
      systemPrompt: "test",
      tools: [],
      supervisor: { onPermission },
      permissionStore: store,
    });

    await agent.run("Test");

    // Get the permission handler that was passed to createSession
    const handler = sdk.getPermissionHandler();
    expect(handler).toBeDefined();

    // Call with an already-approved tool
    const result = await handler!({ kind: "read_file" }, { sessionId: "s1" });
    expect(result.kind).toBe("approved");
    expect(onPermission).not.toHaveBeenCalled();
  });

  it("should persist approval to store after permission granted", async () => {
    const sdk = createMockCopilotSDK();
    _injectSDK(sdk as any);

    const store = new InMemoryPermissionStore();

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({ allowed: true, scope: "project" }),
    );

    const service = createCopilotService({});
    const agent = service.createAgent({
      systemPrompt: "test",
      tools: [],
      supervisor: { onPermission },
      permissionStore: store,
    });

    await agent.run("Test");
    const handler = sdk.getPermissionHandler()!;

    // First call — asks permission
    await handler({ kind: "write_file" }, { sessionId: "s1" });
    expect(onPermission).toHaveBeenCalledTimes(1);

    // Check store was updated
    expect(await store.isApproved("write_file")).toBe(true);

    // Second call — auto-approved
    await handler({ kind: "write_file" }, { sessionId: "s1" });
    expect(onPermission).toHaveBeenCalledTimes(1); // not called again
  });
});

// ─── Integration: Auto-approval with Claude backend ─────────────

describe("Claude auto-approval with permissionStore", () => {
  let _injectSDK: typeof import("../../src/backends/claude.js")["_injectSDK"];
  let _resetSDK: typeof import("../../src/backends/claude.js")["_resetSDK"];
  let createClaudeService: typeof import("../../src/backends/claude.js")["createClaudeService"];

  beforeEach(async () => {
    const mod = await import("../../src/backends/claude.js");
    _injectSDK = mod._injectSDK;
    _resetSDK = mod._resetSDK;
    createClaudeService = mod.createClaudeService;
  });

  afterEach(() => {
    _resetSDK();
  });

  function createMockClaudeSDK() {
    let canUseToolFn: ((...args: any[]) => Promise<any>) | undefined;

    return {
      query: vi.fn((params: any) => {
        canUseToolFn = params.options?.canUseTool;
        const messages = [
          {
            type: "result",
            subtype: "success",
            result: "Done",
            num_turns: 1,
            total_cost_usd: 0.01,
            usage: {},
            modelUsage: { "claude-sonnet": { inputTokens: 100, outputTokens: 50 } },
            session_id: "s1",
          },
        ];
        let idx = 0;
        return {
          next: async () => {
            if (idx < messages.length) return { value: messages[idx++], done: false };
            return { value: undefined, done: true };
          },
          return: async () => ({ value: undefined, done: true }),
          throw: async (e: any) => ({ value: undefined, done: true }),
          [Symbol.asyncIterator]() { return this; },
          close: vi.fn(),
          interrupt: vi.fn(async () => {}),
          supportedModels: vi.fn(async () => []),
        };
      }),
      createSdkMcpServer: vi.fn(() => ({
        type: "sdk",
        name: "test",
        instance: {},
      })),
      tool: vi.fn((name: string, desc: string, schema: any, handler: any) => ({
        name, description: desc, inputSchema: schema, handler,
      })),
      getCanUseTool: () => canUseToolFn,
    };
  }

  it("should auto-approve via store in canUseTool", async () => {
    const sdk = createMockClaudeSDK();
    _injectSDK(sdk as any);

    const store = new InMemoryPermissionStore();
    await store.approve("bash", "always");

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({ allowed: true, scope: "always" }),
    );

    const service = createClaudeService({});
    const agent = service.createAgent({
      systemPrompt: "test",
      tools: [],
      supervisor: { onPermission },
      permissionStore: store,
    });

    await agent.run("Test");

    const canUseTool = sdk.getCanUseTool();
    expect(canUseTool).toBeDefined();

    const signal = new AbortController().signal;
    const result = await canUseTool!("bash", { command: "ls" }, {
      signal,
      toolUseID: "tu-1",
      suggestions: [],
    });

    expect(result.behavior).toBe("allow");
    expect(onPermission).not.toHaveBeenCalled();
  });

  it("should persist approval to store after canUseTool grants", async () => {
    const sdk = createMockClaudeSDK();
    _injectSDK(sdk as any);

    const store = new InMemoryPermissionStore();

    const onPermission = vi.fn(
      async (): Promise<PermissionDecision> => ({ allowed: true, scope: "project" }),
    );

    const service = createClaudeService({});
    const agent = service.createAgent({
      systemPrompt: "test",
      tools: [],
      supervisor: { onPermission },
      permissionStore: store,
    });

    await agent.run("Test");
    const canUseTool = sdk.getCanUseTool()!;
    const signal = new AbortController().signal;

    // First call — asks permission
    await canUseTool("edit", { file: "a.ts" }, { signal, toolUseID: "tu-1", suggestions: [] });
    expect(onPermission).toHaveBeenCalledTimes(1);
    expect(await store.isApproved("edit")).toBe(true);

    // Second call — auto-approved via store
    await canUseTool("edit", { file: "b.ts" }, { signal, toolUseID: "tu-2", suggestions: [] });
    expect(onPermission).toHaveBeenCalledTimes(1); // not called again
  });
});
