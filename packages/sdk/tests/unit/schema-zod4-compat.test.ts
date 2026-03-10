/**
 * Tests for zodToJsonSchema() Zod v4 compatibility.
 *
 * Zod v4 changed its API:
 *   - schema.toJSONSchema() instead of schema.jsonSchema()
 *   - No _def.typeName in schema internals
 *
 * zodToJsonSchema() detects toJSONSchema() (v4) before jsonSchema() (v3.24+),
 * falling back to _def.typeName extraction for legacy v3.
 */
import { describe, it, expect } from "vitest";
import { zodToJsonSchema } from "../../src/utils/schema.js";

// Simulate Zod v4 schema objects — they have toJSONSchema() but no
// jsonSchema() and no _def.typeName.

function makeZodV4String() {
  return {
    _def: { type: "string" }, // v4 style _def — no typeName
    toJSONSchema: () => ({ type: "string" as const }),
  };
}

function makeZodV4Object() {
  return {
    _def: {}, // v4 has no typeName here
    shape: { query: makeZodV4String() },
    toJSONSchema: () => ({
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Search query" },
      },
      required: ["query"],
      additionalProperties: false,
    }),
  };
}

describe("zodToJsonSchema — Zod v4 compatibility", () => {
  it("converts ZodObject with toJSONSchema() to full JSON schema", () => {
    const schema = makeZodV4Object();
    const result = zodToJsonSchema(schema as any);

    expect(result).toEqual({
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
      additionalProperties: false,
    });
  });

  it("converts ZodString with toJSONSchema() to {type:'string'}", () => {
    const schema = makeZodV4String();
    const result = zodToJsonSchema(schema as any);

    expect(result).toEqual({ type: "string" });
  });

  it("prefers toJSONSchema() over jsonSchema() when both present", () => {
    const schema = {
      _def: {},
      toJSONSchema: () => ({ type: "string" as const, description: "from v4" }),
      jsonSchema: () => ({ type: "string" as const, description: "from v3" }),
    };

    const result = zodToJsonSchema(schema as any);

    expect(result).toEqual({ type: "string", description: "from v4" });
  });

  it("falls back to jsonSchema() when toJSONSchema() not present (v3.24+)", () => {
    const schema = {
      _def: {},
      jsonSchema: () => ({ type: "number" as const, minimum: 0 }),
    };

    const result = zodToJsonSchema(schema as any);

    expect(result).toEqual({ type: "number", minimum: 0 });
  });

  it("falls back to _def.typeName when neither method exists (v3 legacy)", () => {
    const schema = {
      _def: { typeName: "ZodString" },
    };

    const result = zodToJsonSchema(schema as any);

    expect(result).toEqual({ type: "string" });
  });

  it("returns {} when no conversion path available", () => {
    const schema = {
      _def: {},
    };

    const result = zodToJsonSchema(schema as any);

    expect(result).toEqual({});
  });
});

describe("zodToJsonSchema — real-world Zod v4 tool scenarios", () => {
  it("WebSearch tool parameters produce valid schema via toJSONSchema()", () => {
    const searchParams = makeZodV4Object();
    const result = zodToJsonSchema(searchParams as any);

    expect(result).toHaveProperty("type", "object");
    expect(result).toHaveProperty("properties.query");
    expect(result).toHaveProperty("required");
  });

  it("Claude tool registration gets full schema for Zod v4 params", () => {
    const toolParams = makeZodV4Object();
    const schemaForClaude = zodToJsonSchema(toolParams as any) as Record<string, unknown>;

    expect(schemaForClaude).toHaveProperty("type", "object");
    expect(schemaForClaude).toHaveProperty("properties");
    expect(schemaForClaude).toHaveProperty("required");
  });

  it("structured output schema converts correctly with Zod v4", () => {
    const outputSchema = {
      _def: {},
      toJSONSchema: () => ({
        type: "object" as const,
        properties: {
          foundNews: { type: "array" as const, items: { type: "object" as const } },
          confidenceLevel: { type: "number" as const },
        },
        required: ["foundNews", "confidenceLevel"],
      }),
    };

    const result = zodToJsonSchema(outputSchema as any);

    expect(result).toEqual({
      type: "object",
      properties: {
        foundNews: { type: "array", items: { type: "object" } },
        confidenceLevel: { type: "number" },
      },
      required: ["foundNews", "confidenceLevel"],
    });
  });
});
