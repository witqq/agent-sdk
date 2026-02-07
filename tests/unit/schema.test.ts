import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToJsonSchema } from "../../src/utils/schema.js";

describe("zodToJsonSchema", () => {
  it("should convert ZodString", () => {
    expect(zodToJsonSchema(z.string())).toEqual({ type: "string" });
  });

  it("should convert ZodNumber", () => {
    expect(zodToJsonSchema(z.number())).toEqual({ type: "number" });
  });

  it("should convert ZodBoolean", () => {
    expect(zodToJsonSchema(z.boolean())).toEqual({ type: "boolean" });
  });

  it("should convert ZodNull", () => {
    expect(zodToJsonSchema(z.null())).toEqual({ type: "null" });
  });

  it("should convert ZodArray", () => {
    expect(zodToJsonSchema(z.array(z.string()))).toEqual({
      type: "array",
      items: { type: "string" },
    });
  });

  it("should convert ZodEnum", () => {
    expect(zodToJsonSchema(z.enum(["a", "b", "c"]))).toEqual({
      type: "string",
      enum: ["a", "b", "c"],
    });
  });

  it("should convert ZodObject with required fields", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    expect(zodToJsonSchema(schema)).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    });
  });

  it("should convert ZodObject with optional fields", () => {
    const schema = z.object({
      name: z.string(),
      bio: z.string().optional(),
    });
    expect(zodToJsonSchema(schema)).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        bio: { type: "string" },
      },
      required: ["name"],
    });
  });

  it("should convert nested objects", () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
      }),
    });
    expect(zodToJsonSchema(schema)).toEqual({
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
      },
      required: ["user"],
    });
  });

  it("should convert array of objects", () => {
    const schema = z.array(
      z.object({ id: z.number() }),
    );
    expect(zodToJsonSchema(schema)).toEqual({
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
        },
        required: ["id"],
      },
    });
  });

  it("should return empty object for unknown types", () => {
    // z.any() has typeName "ZodAny" which isn't handled
    expect(zodToJsonSchema(z.any())).toEqual({});
  });
});
