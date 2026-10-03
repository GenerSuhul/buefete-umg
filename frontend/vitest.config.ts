import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: [
    { find: /^.*\/routing\/navigation$/, replacement: "react-router-dom" },
    { find: "./testFixtures", replacement: fileURLToPath(new URL("./src/test/fixtures.ts", import.meta.url)) },
  ] },
  test: {
    environment: "jsdom",
    globals: true,
    pool: "forks",
    fileParallelism: false,
    testTimeout: 10_000,
    setupFiles: ["./src/test/setup.ts"],
  },
});
