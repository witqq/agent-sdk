import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**/*.test.ts", "tests/e2e/**/*.test.ts"],
    globals: true,
    testTimeout: 10_000,
  },
});
