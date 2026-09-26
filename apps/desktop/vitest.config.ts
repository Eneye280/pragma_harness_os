import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve("src/renderer"),
      "@main": resolve("src/main"),
      "@shared": resolve("src/shared")
    }
  },
  test: {
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    isolate: false,
    include: ["src/shared/__tests__/**/*.test.ts", "src/main/db/__tests__/**/*.test.ts", "src/main/harness/__tests__/**/*.test.ts", "src/main/harness/skills/__tests__/**/*.test.ts", "src/main/memory/__tests__/**/*.test.ts", "src/main/llm/__tests__/**/*.test.ts", "src/main/tools/__tests__/**/*.test.ts", "src/main/workspace/__tests__/**/*.test.ts", "src/main/workspace-folder/__tests__/**/*.test.ts", "src/main/git/__tests__/**/*.test.ts", "src/main/sandbox/__tests__/**/*.test.ts", "src/main/gates/__tests__/**/*.test.ts", "src/main/postgates/__tests__/**/*.test.ts", "src/main/chat/__tests__/**/*.test.ts", "src/main/explorer/__tests__/**/*.test.ts", "src/main/terminal/__tests__/**/*.test.ts", "src/main/settings/__tests__/**/*.test.ts", "src/main/plan/__tests__/**/*.test.ts", "src/main/context/__tests__/**/*.test.ts", "src/main/cost/__tests__/**/*.test.ts", "src/main/dreaming/__tests__/**/*.test.ts", "src/main/sessions/__tests__/**/*.test.ts", "src/main/attachments/__tests__/**/*.test.ts", "src/main/agents/__tests__/**/*.test.ts", "src/main/bundles/__tests__/**/*.test.ts", "src/main/plugins/__tests__/**/*.test.ts", "src/main/profile/__tests__/**/*.test.ts", "src/main/updater/__tests__/**/*.test.ts", "src/main/plugins/__tests__/**/*.test.ts", "plugins/__tests__/**/*.test.ts", "src/main/graph/__tests__/**/*.test.ts", "src/main/visual/__tests__/**/*.test.ts", "src/main/diagnostics/__tests__/**/*.test.ts", "src/main/migrations/__tests__/**/*.test.ts", "src/main/hotreload/__tests__/**/*.test.ts", "src/main/security/__tests__/**/*.test.ts", "src/main/evidence/__tests__/**/*.test.ts", "src/main/usage/__tests__/**/*.test.ts", "src/main/learning/__tests__/**/*.test.ts", "src/main/licenses/__tests__/**/*.test.ts", "src/renderer/shell/__tests__/**/*.test.ts", "src/renderer/theme/__tests__/**/*.test.ts", "src/renderer/chat/__tests__/**/*.test.ts", "src/renderer/explorer/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      include: [
        "src/main/harness/**/*.ts",
        "src/main/gates/**/*.ts",
        "src/main/db/event-log.ts",
        "src/main/db/memory-event-log.ts",
        "src/main/plugins/registry.ts",
        "src/main/postgates/loop.ts",
        "src/main/postgates/phases.ts"
      ],
      exclude: ["**/*.test.ts", "**/types.ts", "**/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
