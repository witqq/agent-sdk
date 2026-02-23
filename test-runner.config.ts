import type { Config } from "testfold";

export default {
  artifactsDir: "./test-results",
  testsDir: "./tests",
  reporters: ["console", "json", "markdown-failures", "timing"],
  suites: [
    {
      name: "Unit",
      type: "jest",
      command: "npx vitest run --reporter=json --outputFile=test-results/unit.json",
      resultFile: "unit.json",
      timeout: 60_000,
    },
    {
      name: "E2E",
      type: "jest",
      command:
        "npx vitest run --config vitest.e2e.config.ts --reporter=json --outputFile=test-results/e2e.json",
      resultFile: "e2e.json",
      timeout: 180_000,
    },
  ],
} satisfies Config;
