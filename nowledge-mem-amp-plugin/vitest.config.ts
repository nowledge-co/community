import { defineConfig } from "vitest/config"

/**
 * Vitest configuration for the Amp connector unit tests.
 *
 * Coverage targets the source tree and enforces 100% line and branch coverage.
 * Platform-infeasible edges may opt out with a documented `v8 ignore`; every
 * other line and branch must be exercised by the test suite.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/types.ts"],
      reporter: ["text", "html"],
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
      all: true,
    },
  },
})
