import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
const dataDir = path.join(os.tmpdir(), `redesign-ai-vitest-${process.pid}`);

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    env: {
      NEXTAUTH_SECRET: "vitest-secret-that-is-at-least-32-characters-long",
      REDESIGN_DATA_DIR: dataDir,
      DURABLE_FILE_STORAGE: "true",
      GEMINI_REQUEST_TIMEOUT_MS: "5000",
    },
  },
});
