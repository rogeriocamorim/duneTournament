import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // API tests share one database
    fileParallelism: false,
  },
});
