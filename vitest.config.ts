import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Run tests sequentially to avoid database conflicts
    // Vitest 4.x uses top-level options instead of poolOptions
    isolate: false,
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
  },
});
