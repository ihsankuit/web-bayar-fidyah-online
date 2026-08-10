import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    // Mirror the "@/*" path alias from tsconfig so modules under test can use
    // the same import specifiers as the rest of the app.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
