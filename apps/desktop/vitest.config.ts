import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    isolate: false,
    include: ["src/main/db/__tests__/**/*.test.ts", "src/main/harness/__tests__/**/*.test.ts", "src/main/memory/__tests__/**/*.test.ts", "src/main/llm/__tests__/**/*.test.ts", "src/main/tools/__tests__/**/*.test.ts"]
  }
});
