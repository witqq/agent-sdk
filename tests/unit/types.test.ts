import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  isToolDefinition,
  isTextContent,
  isMultiPartContent,
  getTextContent,
} from "../../src/types.js";
import type {
  ToolDeclaration,
  ToolDefinition,
  Message,
  MessageContent,
  PermissionScope,
  PermissionRequest,
  PermissionDecision,
  UserInputRequest,
  UserInputResponse,
  AgentEvent,
  AgentState,
  AgentConfig,
  AgentResult,
  SupervisorHooks,
  StructuredOutputConfig,
  ContentPart,
} from "../../src/types.js";

describe("Type Guards", () => {
  const declaration: ToolDeclaration = {
    name: "search",
    description: "Search the web",
    parameters: z.object({ query: z.string() }),
  };

  const definition: ToolDefinition = {
    ...declaration,
    execute: async (params) => ({ results: [params.query] }),
  };

  describe("isToolDefinition", () => {
    it("returns true for ToolDefinition (has execute)", () => {
      expect(isToolDefinition(definition)).toBe(true);
    });

    it("returns false for ToolDeclaration (no execute)", () => {
      expect(isToolDefinition(declaration)).toBe(false);
    });

    it("returns false for object with non-function execute", () => {
      const fake = { ...declaration, execute: "not a function" } as unknown as ToolDeclaration;
      expect(isToolDefinition(fake)).toBe(false);
    });
  });

  describe("isTextContent", () => {
    it("returns true for string content", () => {
      expect(isTextContent("hello")).toBe(true);
    });

    it("returns false for array content", () => {
      const parts: ContentPart[] = [{ type: "text", text: "hello" }];
      expect(isTextContent(parts)).toBe(false);
    });
  });

  describe("isMultiPartContent", () => {
    it("returns true for array content", () => {
      const parts: ContentPart[] = [{ type: "text", text: "hello" }];
      expect(isMultiPartContent(parts)).toBe(true);
    });

    it("returns false for string content", () => {
      expect(isMultiPartContent("hello")).toBe(false);
    });
  });

  describe("getTextContent", () => {
    it("returns string as-is", () => {
      expect(getTextContent("hello world")).toBe("hello world");
    });

    it("extracts text from multi-part content", () => {
      const content: MessageContent = [
        { type: "text", text: "hello" },
        { type: "image", data: "base64...", mimeType: "image/png" },
        { type: "text", text: "world" },
      ];
      expect(getTextContent(content)).toBe("hello\nworld");
    });

    it("returns empty string for content with no text parts", () => {
      const content: MessageContent = [
        { type: "image", data: "base64...", mimeType: "image/png" },
      ];
      expect(getTextContent(content)).toBe("");
    });
  });
});

describe("Type Consistency", () => {
  it("ToolDefinition extends ToolDeclaration", () => {
    const def: ToolDefinition<{ q: string }> = {
      name: "test",
      description: "test tool",
      parameters: z.object({ q: z.string() }),
      execute: async (params) => params.q,
    };
    // ToolDefinition should be assignable to ToolDeclaration
    const decl: ToolDeclaration<{ q: string }> = def;
    expect(decl.name).toBe("test");
  });

  it("Message discriminated union covers all roles", () => {
    const messages: Message[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi!", toolCalls: [] },
      { role: "tool", toolResults: [{ toolCallId: "1", name: "test", result: "ok" }] },
    ];
    expect(messages).toHaveLength(4);
    expect(messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "tool"]);
  });

  it("PermissionScope covers all values", () => {
    const scopes: PermissionScope[] = ["once", "session", "project", "always"];
    expect(scopes).toHaveLength(4);
  });

  it("PermissionRequest has required and optional fields", () => {
    const minimal: PermissionRequest = {
      toolName: "delete_file",
      toolArgs: { path: "/tmp/x" },
    };
    expect(minimal.toolName).toBe("delete_file");
    expect(minimal.suggestedScope).toBeUndefined();

    const full: PermissionRequest = {
      toolName: "delete_file",
      toolArgs: { path: "/tmp/x" },
      suggestedScope: "session",
      rawSDKRequest: { kind: "write" },
    };
    expect(full.suggestedScope).toBe("session");
  });

  it("PermissionDecision supports allow and deny", () => {
    const allow: PermissionDecision = {
      allowed: true,
      scope: "session",
      modifiedInput: { path: "/safe/path" },
    };
    expect(allow.allowed).toBe(true);

    const deny: PermissionDecision = {
      allowed: false,
      reason: "Too dangerous",
    };
    expect(deny.allowed).toBe(false);
  });

  it("UserInputRequest and Response work together", () => {
    const req: UserInputRequest = {
      question: "Which format?",
      choices: ["JSON", "CSV"],
      allowFreeform: true,
    };
    const res: UserInputResponse = {
      answer: "JSON",
      wasFreeform: false,
      selectedChoiceIndex: 0,
    };
    expect(req.choices).toContain(res.answer);
  });

  it("AgentState covers all valid states", () => {
    const states: AgentState[] = ["idle", "running", "streaming", "disposed"];
    expect(states).toHaveLength(4);
  });

  it("AgentEvent discriminated union type field is unique per variant", () => {
    const events: AgentEvent[] = [
      { type: "text_delta", text: "hello" },
      { type: "tool_call_start", toolName: "search", args: { q: "test" } },
      { type: "tool_call_end", toolName: "search", result: "found" },
      { type: "permission_request", request: { toolName: "x", toolArgs: {} } },
      { type: "permission_response", toolName: "x", decision: { allowed: true } },
      { type: "ask_user", request: { question: "ok?" } },
      { type: "ask_user_response", answer: "yes" },
      { type: "thinking_start" },
      { type: "thinking_end" },
      { type: "usage_update", promptTokens: 100, completionTokens: 50 },
      { type: "error", error: "oops", recoverable: false },
      { type: "done", finalOutput: "result" },
    ];
    const types = events.map((e) => e.type);
    // All types are unique
    expect(new Set(types).size).toBe(types.length);
  });

  it("AgentResult generic typing works", () => {
    // Void result (no structured output)
    const voidResult: AgentResult = {
      output: "hello",
      structuredOutput: undefined,
      toolCalls: [],
      messages: [],
    };
    expect(voidResult.structuredOutput).toBeUndefined();

    // Typed result
    interface NewsItem {
      title: string;
      url: string;
    }
    const typedResult: AgentResult<NewsItem[]> = {
      output: null,
      structuredOutput: [{ title: "News", url: "https://example.com" }],
      toolCalls: [],
      messages: [],
    };
    expect(typedResult.structuredOutput[0].title).toBe("News");
  });

  it("AgentConfig requires systemPrompt and tools", () => {
    const config: AgentConfig = {
      systemPrompt: "You are helpful",
      tools: [],
    };
    expect(config.systemPrompt).toBeDefined();
    expect(config.tools).toBeDefined();
  });

  it("SupervisorHooks are fully optional", () => {
    const empty: SupervisorHooks = {};
    expect(empty.onPermission).toBeUndefined();
    expect(empty.onAskUser).toBeUndefined();

    const withPermission: SupervisorHooks = {
      onPermission: async () => ({ allowed: true }),
    };
    expect(withPermission.onPermission).toBeDefined();
  });

  it("StructuredOutputConfig works with Zod schema", () => {
    const schema = z.object({
      title: z.string(),
      score: z.number(),
    });
    const config: StructuredOutputConfig<z.infer<typeof schema>> = {
      schema,
      name: "analysis",
      description: "Analysis result",
    };
    expect(config.name).toBe("analysis");
  });

  it("ToolDefinition with needsApproval and metadata", () => {
    const tool: ToolDefinition = {
      name: "delete_file",
      description: "Delete a file",
      parameters: z.object({ path: z.string() }),
      needsApproval: true,
      metadata: { category: "filesystem", tags: ["dangerous"] },
      execute: async () => "deleted",
    };
    expect(tool.needsApproval).toBe(true);
    expect(tool.metadata?.category).toBe("filesystem");
  });
});
