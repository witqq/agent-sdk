import type { z } from "zod";

/** Convert a Zod schema to JSON Schema.
 *  Detection order: toJSONSchema() (Zod v4) → jsonSchema() (Zod v3.24+) → _def extraction (Zod v3 legacy). */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const schemaAny = schema as unknown as Record<string, unknown>;

  // Zod v4: toJSONSchema()
  if ("toJSONSchema" in schema && typeof schemaAny.toJSONSchema === "function") {
    return (schemaAny.toJSONSchema as () => Record<string, unknown>)();
  }

  // Zod v3.24+: jsonSchema()
  if ("jsonSchema" in schema && typeof schemaAny.jsonSchema === "function") {
    return (schemaAny.jsonSchema as () => Record<string, unknown>)();
  }

  // Zod v3 legacy: _def.typeName extraction
  return extractSchemaFromDef(schema);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractSchemaFromDef(schema: z.ZodType): Record<string, unknown> {
  const def = (schema as unknown as { _def: Record<string, any> })._def;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodNull":
      return { type: "null" };
    case "ZodArray":
      return {
        type: "array",
        items: extractSchemaFromDef(def.type as z.ZodType),
      };
    case "ZodObject": {
      const shape = (schema as unknown as { shape: Record<string, z.ZodType> }).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const valueDef = (value as unknown as { _def: Record<string, any> })._def;
        if (valueDef.typeName === "ZodOptional") {
          properties[key] = extractSchemaFromDef(valueDef.innerType as z.ZodType);
        } else {
          properties[key] = extractSchemaFromDef(value);
          required.push(key);
        }
      }

      return {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }
    case "ZodOptional":
      return extractSchemaFromDef(def.innerType as z.ZodType);
    case "ZodEnum":
      return { type: "string", enum: def.values as string[] };
    default:
      return {};
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
