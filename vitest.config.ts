import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The obsidian package is types-only (no runtime entry point); tests
      // resolve it to a local stub. tsc still uses the real type definitions.
      obsidian: fileURLToPath(
        new URL("./src/testing/obsidian-stub.ts", import.meta.url)
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
