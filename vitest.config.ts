import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@nasty-plot/formats/db",
        replacement: path.resolve(__dirname, "packages/formats/src/format-db.service.ts"),
      },
      {
        find: "@nasty-plot/battle-engine/db",
        replacement: path.resolve(__dirname, "packages/battle-engine/src/battle.service.ts"),
      },
      {
        find: "@nasty-plot/battle-engine/client",
        replacement: path.resolve(__dirname, "packages/battle-engine/src/client.ts"),
      },
      {
        find: "@nasty-plot/llm/browser",
        replacement: path.resolve(__dirname, "packages/llm/src/browser.ts"),
      },
      {
        find: /^@nasty-plot\/(.+)$/,
        replacement: path.resolve(__dirname, "packages/$1/src/index.ts"),
      },
      {
        find: /^#([^/]+)\/(.+)$/,
        replacement: path.resolve(__dirname, "packages/$1/src/$2"),
      },
    ],
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
  },
})
