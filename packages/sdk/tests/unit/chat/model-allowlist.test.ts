/**
 * Unit tests for the demo model allowlist enforcement.
 */
import { describe, it, expect } from "vitest";
import { createAllowlist, isModelAllowed, filterModels } from "../../../../demo/model-allowlist.js";

describe("Model Allowlist", () => {
  describe("createAllowlist", () => {
    it("defaults to gpt-5-mini when no env value", () => {
      const list = createAllowlist(undefined);
      expect(list.has("gpt-5-mini")).toBe(true);
      expect(list.size).toBe(1);
    });

    it("defaults to gpt-5-mini when empty string", () => {
      const list = createAllowlist("");
      expect(list.has("gpt-5-mini")).toBe(true);
      expect(list.size).toBe(1);
    });

    it("parses comma-separated models", () => {
      const list = createAllowlist("gpt-5-mini,claude-haiku-4-5");
      expect(list.has("gpt-5-mini")).toBe(true);
      expect(list.has("claude-haiku-4-5")).toBe(true);
      expect(list.size).toBe(2);
    });

    it("trims whitespace from model names", () => {
      const list = createAllowlist(" gpt-5-mini , claude-haiku-4-5 ");
      expect(list.has("gpt-5-mini")).toBe(true);
      expect(list.has("claude-haiku-4-5")).toBe(true);
    });

    it("filters out empty entries from trailing commas", () => {
      const list = createAllowlist("gpt-5-mini,,");
      expect(list.size).toBe(1);
    });
  });

  describe("isModelAllowed", () => {
    const allowlist = createAllowlist("gpt-5-mini");

    it("allows gpt-5-mini", () => {
      expect(isModelAllowed(allowlist, "gpt-5-mini")).toBe(true);
    });

    it("rejects gpt-4.1", () => {
      expect(isModelAllowed(allowlist, "gpt-4.1")).toBe(false);
    });

    it("rejects gpt-5", () => {
      expect(isModelAllowed(allowlist, "gpt-5")).toBe(false);
    });

    it("rejects claude-sonnet-4", () => {
      expect(isModelAllowed(allowlist, "claude-sonnet-4")).toBe(false);
    });

    it("rejects claude-opus-4", () => {
      expect(isModelAllowed(allowlist, "claude-opus-4")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isModelAllowed(allowlist, "")).toBe(false);
    });

    it("rejects substring match (not prefix)", () => {
      expect(isModelAllowed(allowlist, "gpt-5-mini-extra")).toBe(false);
    });
  });

  describe("filterModels", () => {
    const allowlist = createAllowlist("gpt-5-mini,claude-haiku-4-5");

    it("filters models by id field", () => {
      const models = [
        { id: "gpt-5-mini", name: "GPT-5 Mini" },
        { id: "gpt-4.1", name: "GPT-4.1" },
        { id: "claude-haiku-4-5", name: "Claude Haiku" },
        { id: "claude-opus-4", name: "Claude Opus" },
      ];
      const result = filterModels(allowlist, models);
      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toEqual(["gpt-5-mini", "claude-haiku-4-5"]);
    });

    it("falls back to name field when id is missing", () => {
      const models = [
        { name: "gpt-5-mini" },
        { name: "gpt-5" },
      ];
      const result = filterModels(allowlist, models);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("gpt-5-mini");
    });

    it("returns empty array when no models match", () => {
      const models = [
        { id: "gpt-5", name: "GPT-5" },
        { id: "claude-opus-4", name: "Claude Opus" },
      ];
      const result = filterModels(allowlist, models);
      expect(result).toHaveLength(0);
    });

    it("returns empty array for empty input", () => {
      expect(filterModels(allowlist, [])).toHaveLength(0);
    });

    it("preserves original model objects", () => {
      const original = { id: "gpt-5-mini", name: "GPT-5 Mini", extra: "data" };
      const result = filterModels(allowlist, [original]);
      expect(result[0]).toBe(original);
    });
  });

  describe("Integration: allowlist enforcement scenarios", () => {
    const allowlist = createAllowlist("gpt-5-mini");

    it("only gpt-5-mini passes through a typical model list", () => {
      const typicalModels = [
        { id: "gpt-5-mini" },
        { id: "gpt-5" },
        { id: "gpt-5.1" },
        { id: "gpt-4.1" },
        { id: "claude-sonnet-4" },
        { id: "claude-opus-4" },
        { id: "claude-haiku-4-5" },
      ];
      const allowed = filterModels(allowlist, typicalModels);
      expect(allowed).toHaveLength(1);
      expect(allowed[0].id).toBe("gpt-5-mini");
    });

    it("switchModel to paid model is blocked", () => {
      const paidModels = ["gpt-5", "gpt-5.1", "gpt-4.1", "claude-sonnet-4", "claude-opus-4"];
      for (const model of paidModels) {
        expect(isModelAllowed(allowlist, model)).toBe(false);
      }
    });

    it("switchModel to gpt-5-mini is allowed", () => {
      expect(isModelAllowed(allowlist, "gpt-5-mini")).toBe(true);
    });

    it("send with model override to paid model is blocked", () => {
      expect(isModelAllowed(allowlist, "claude-opus-4")).toBe(false);
    });

    it("send without model override (undefined) is not blocked", () => {
      // When no model is specified in send, there's nothing to check
      const model: string | undefined = undefined;
      const shouldBlock = model !== undefined && !isModelAllowed(allowlist, model);
      expect(shouldBlock).toBe(false);
    });
  });
});
