---
title: "Tools & Permissions"
description: "Define agent tools with Zod schemas and permission scoping"
---

Tools define what an agent can do. Permissions control what it is allowed to do.

## Tools

### ToolDeclaration

Declares a tool's schema without an executor. Used for validation and documentation.

```typescript
import { ToolDeclaration } from "@witqq/agent-sdk";
import { z } from "zod";

const searchDeclaration: ToolDeclaration<{ query: string }> = {
  name: "search",
  description: "Search the knowledge base",
  parameters: z.object({
    query: z.string().describe("Search query"),
  }),
  needsApproval: false,
  metadata: {
    category: "retrieval",
    tags: ["search", "read-only"],
  },
};
```

Fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | Unique tool identifier |
| `description` | `string` | yes | Shown to the LLM |
| `parameters` | `z.ZodType<T>` | yes | Zod schema for arguments |
| `needsApproval` | `boolean` | no | Triggers permission request if `true` |
| `metadata` | `{ category?, icon?, tags? }` | no | Arbitrary metadata |

### ToolDefinition

Extends `ToolDeclaration` with an `execute` function. This is what agents call.

```typescript
import { ToolDefinition, ToolContext } from "@witqq/agent-sdk";
import { z } from "zod";

const searchTool: ToolDefinition<{ query: string; limit?: number }> = {
  name: "search",
  description: "Search the knowledge base",
  parameters: z.object({
    query: z.string(),
    limit: z.number().optional().default(10),
  }),
  execute: async (params, context?: ToolContext) => {
    // context.sessionId available if passed by runtime
    const results = await db.search(params.query, params.limit);
    return results;
  },
};
```

### ToolContext

Passed as the second argument to `execute`.

```typescript
interface ToolContext {
  sessionId: string;
  custom?: Record<string, unknown>;
}
```

### ToolDefinitionLike

Union type accepting either a declaration or a definition:

```typescript
type ToolDefinitionLike<T> = ToolDeclaration<T> | ToolDefinition<T>;
```

Use `isToolDefinition()` to check if a tool has an executor:

```typescript
import { isToolDefinition } from "@witqq/agent-sdk";

if (isToolDefinition(tool)) {
  const result = await tool.execute(args);
}
```

### Providing Tools

Tools are passed via `AgentConfig.tools` (defaults for all runs) or `RunOptions.tools` (per-call override):

```typescript
const config: FullAgentConfig = {
  systemPrompt: "You are a helpful assistant.",
  tools: [searchTool, writeTool],
};

// Override per call
const result = await agent.run("Find X", {
  model: "gpt-4.1",
  tools: [searchTool], // only search available this call
});
```

### Zod Compatibility

Parameters accept Zod v3.23+ and v4.x schemas. Both work identically:

```typescript
// Zod v3
import { z } from "zod";
const params = z.object({ name: z.string() });

// Zod v4
import { z } from "zod/v4";
const params = z.object({ name: z.string() });
```

The SDK converts Zod schemas to JSON Schema internally via `zodToJsonSchema()`.

---

## Permissions

### Permission Scopes

```typescript
type PermissionScope = "once" | "session" | "project" | "always";
```

| Scope | Persistence | Use case |
|-------|------------|----------|
| `once` | Single invocation | Destructive operations |
| `session` | Current agent session | Repeated safe operations |
| `project` | Persisted to project directory | Team-shared approvals |
| `always` | Persisted to user config | Trusted tools |

### Permission Request

Generated when a tool with `needsApproval: true` is called, or by the backend itself.

```typescript
interface PermissionRequest {
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolCallId?: string;
  suggestedScope?: PermissionScope;
  rawSDKRequest?: unknown;
}
```

### Permission Decision

Returned by the permission callback.

```typescript
interface PermissionDecision {
  allowed: boolean;
  scope?: PermissionScope;
  modifiedInput?: Record<string, unknown>;
  reason?: string;
}
```

`modifiedInput` replaces the original tool arguments if provided. Use this to sanitize inputs.

### SupervisorHooks

Attach permission and user-input callbacks to an agent:

```typescript
import type { SupervisorHooks, PermissionRequest, PermissionDecision } from "@witqq/agent-sdk";

const supervisor: SupervisorHooks = {
  onPermission: async (request: PermissionRequest, signal: AbortSignal): Promise<PermissionDecision> => {
    if (request.toolName === "delete_file") {
      return { allowed: false, reason: "Destructive operations disabled" };
    }
    return { allowed: true, scope: "session" };
  },
  onAskUser: async (request, signal) => {
    const answer = await promptUser(request.question, request.choices);
    return { answer, wasFreeform: !request.choices };
  },
};

const config: FullAgentConfig = {
  systemPrompt: "Assistant with guardrails",
  supervisor,
};
```

### Tools with needsApproval

When `needsApproval` is `true`, the agent emits a `permission_request` event before executing:

```typescript
const deployTool: ToolDefinition<{ target: string }> = {
  name: "deploy",
  description: "Deploy to production",
  parameters: z.object({ target: z.string() }),
  needsApproval: true,
  execute: async (params) => {
    return await deploy(params.target);
  },
};
```

Without a `supervisor.onPermission` callback, the tool call is denied by default.

### Permission Stores

Permission stores persist approval decisions across calls.

```typescript
interface IPermissionStore {
  isApproved(toolName: string): Promise<boolean>;
  approve(toolName: string, scope: PermissionScope): Promise<void>;
  revoke(toolName: string): Promise<void>;
  clear(): Promise<void>;
  dispose(): Promise<void>;
}
```

Built-in implementations:

| Store | Import | Backing | Notes |
|-------|--------|---------|-------|
| `InMemoryPermissionStore` | `@witqq/agent-sdk` | `Map` | `"once"` scope not persisted |
| `FilePermissionStore` | `@witqq/agent-sdk` | JSON file | Atomic writes |
| `CompositePermissionStore` | `@witqq/agent-sdk` | Multiple stores | Routes by scope |

### InMemoryPermissionStore

```typescript
import { InMemoryPermissionStore } from "@witqq/agent-sdk";

const store = new InMemoryPermissionStore();
await store.approve("search", "session");
await store.isApproved("search"); // true
```

### FilePermissionStore

Persists to a JSON file. Suitable for project-level permissions.

```typescript
import { FilePermissionStore } from "@witqq/agent-sdk";

const store = new FilePermissionStore("/path/to/project/.permissions.json");
await store.approve("deploy", "project");
```

### CompositePermissionStore

Routes approvals to different stores based on scope:

```typescript
import {
  CompositePermissionStore,
  InMemoryPermissionStore,
  FilePermissionStore,
} from "@witqq/agent-sdk";

const composite = new CompositePermissionStore(
  new InMemoryPermissionStore(),     // session scope
  new FilePermissionStore("./project-perms.json"),  // project scope
  new FilePermissionStore("~/.config/agent/perms.json"), // always scope
);
```

### createDefaultPermissionStore

Factory that creates a `CompositePermissionStore` with standard paths:

```typescript
import { createDefaultPermissionStore } from "@witqq/agent-sdk";

const store = createDefaultPermissionStore("/path/to/project");
```

### Full Example: Permission Scoping

```typescript
import {
  ToolDefinition,
  InMemoryPermissionStore,
  type FullAgentConfig,
  type PermissionRequest,
  type PermissionDecision,
} from "@witqq/agent-sdk";
import { z } from "zod";

const readTool: ToolDefinition<{ path: string }> = {
  name: "read_file",
  description: "Read a file",
  parameters: z.object({ path: z.string() }),
  needsApproval: true,
  execute: async ({ path }) => readFile(path, "utf-8"),
};

const deleteTool: ToolDefinition<{ path: string }> = {
  name: "delete_file",
  description: "Delete a file",
  parameters: z.object({ path: z.string() }),
  needsApproval: true,
  execute: async ({ path }) => unlink(path),
};

const store = new InMemoryPermissionStore();

const config: FullAgentConfig = {
  systemPrompt: "File assistant",
  tools: [readTool, deleteTool],
  permissionStore: store,
  supervisor: {
    onPermission: async (req: PermissionRequest, signal: AbortSignal): Promise<PermissionDecision> => {
      // Check store first
      if (await store.isApproved(req.toolName)) {
        return { allowed: true };
      }

      // Auto-approve reads for the session
      if (req.toolName === "read_file") {
        await store.approve(req.toolName, "session");
        return { allowed: true, scope: "session" };
      }

      // Deny deletes outside /tmp
      const path = req.toolArgs.path as string;
      if (req.toolName === "delete_file" && !path.startsWith("/tmp")) {
        return { allowed: false, reason: "Can only delete files in /tmp" };
      }

      return { allowed: true, scope: "once" };
    },
  },
};
```

---

**API Reference:** [Core Exports](/api-reference/core/)
