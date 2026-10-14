import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["node_modules", "tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(projectRoot),
    },
  },
});
