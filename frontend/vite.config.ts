import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    // Process isolation is slower but avoids intermittent worker deadlocks on
    // Windows development and CI hosts when jsdom loads the full application.
    pool: "forks",
    fileParallelism: false,
    testTimeout: 10_000,
    setupFiles: ["./src/test/setup.ts"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
