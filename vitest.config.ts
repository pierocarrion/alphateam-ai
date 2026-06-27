import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    alias: [
      { find: "@drizzle", replacement: path.resolve(__dirname, "./drizzle") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    env: {
      NEXTAUTH_SECRET: "test-secret-must-be-at-least-32-characters-long",
      NEXTAUTH_URL: "http://localhost:3000",
    },
  },
});
