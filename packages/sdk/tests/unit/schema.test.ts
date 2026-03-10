import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToJsonSchema } from "../../src/utils/schema.js";

describe("zodToJsonSchema", () => {
  it("should convert ZodString", () => {
    expect(zodToJsonSchema(z.string())).toMatchObject({ type: "string" });
  });

  it("should convert ZodNumber", () => {
    expect(zodToJsonSchema(z.number())).toMatchObject({ type: "number" });
  });

  it("should convert ZodBoolean", () => {
    expect(zodToJsonSchema(z.boolean())).toMatchObject({ type: "boolean" });
  });

  it("should convert ZodNull", () => {
    expect(zodToJsonSchema(z.null())).toMatchObject({ type: "null" });
  });

  it("should convert ZodArray", () => {
    const result = zodToJsonSchema(z.array(z.string()));
    expect(result).toMatchObject({ type: "array" });
    expect(result).toHaveProperty("items");
  });

  it("should convert ZodEnum", () => {
    expect(zodToJsonSchema(z.enum(["a", "b", "c"]))).toMatchObject({
      enum: ["a", "b", "c"],
    });
  });

  it("should convert ZodObject with required fields", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const result = zodToJsonSchema(schema);
    expect(result).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: expect.arrayContaining(["name", "age"]),
    });
  });

  it("should convert ZodObject with optional fields", () => {
    const schema = z.object({
      name: z.string(),
      bio: z.string().optional(),
    });
    const result = zodToJsonSchema(schema);
    expect(result).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
        bio: { type: "string" },
      },
    });
    expect(result).toHaveProperty("required");
    const required = result.required as string[];
    expect(required).toContain("name");
    expect(required).not.toContain("bio");
  });

  it("should convert nested objects", () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
      }),
    });
    const result = zodToJsonSchema(schema);
    expect(result).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["user"]),
    });
    const properties = result.properties as Record<string, Record<string, unknown>>;
    expect(properties.user).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
      },
    });
  });

  it("should convert array of objects", () => {
    const schema = z.array(
      z.object({ id: z.number() }),
    );
    const result = zodToJsonSchema(schema);
    expect(result).toMatchObject({ type: "array" });
    const items = result.items as Record<string, unknown>;
    expect(items).toMatchObject({
      type: "object",
      properties: {
        id: { type: "number" },
      },
    });
  });

  it("should produce valid schema for unknown types", () => {
    const result = zodToJsonSchema(z.any());
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});
