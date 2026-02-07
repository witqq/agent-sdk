import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    external: [
      "./backends/copilot.js",
      "./backends/claude.js",
      "./backends/vercel-ai.js",
    ],
  },
  {
    entry: {
      "backends/copilot": "src/backends/copilot.ts",
      "backends/claude": "src/backends/claude.ts",
      "backends/vercel-ai": "src/backends/vercel-ai.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: [
      "@github/copilot-sdk",
      "@anthropic-ai/claude-agent-sdk",
      "ai",
      "@ai-sdk/*",
      "zod",
    ],
    splitting: false,
    treeshake: true,
  },
]);
