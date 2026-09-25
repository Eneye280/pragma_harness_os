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
    include: ["src/main/db/__tests__/**/*.test.ts", "src/main/harness/__tests__/**/*.test.ts", "src/main/memory/__tests__/**/*.test.ts", "src/main/llm/__tests__/**/*.test.ts", "src/main/tools/__tests__/**/*.test.ts", "src/main/workspace/__tests__/**/*.test.ts", "src/main/sandbox/__tests__/**/*.test.ts", "src/main/gates/__tests__/**/*.test.ts", "src/main/postgates/__tests__/**/*.test.ts", "src/main/chat/__tests__/**/*.test.ts", "src/main/explorer/__tests__/**/*.test.ts", "src/main/terminal/__tests__/**/*.test.ts", "src/main/settings/__tests__/**/*.test.ts", "src/main/plan/__tests__/**/*.test.ts", "src/main/context/__tests__/**/*.test.ts", "src/main/cost/__tests__/**/*.test.ts", "src/main/dreaming/__tests__/**/*.test.ts", "src/main/plugins/__tests__/**/*.test.ts", "plugins/__tests__/**/*.test.ts", "src/renderer/shell/__tests__/**/*.test.ts", "src/renderer/chat/__tests__/**/*.test.ts", "src/renderer/explorer/__tests__/**/*.test.ts"]
  }
});
