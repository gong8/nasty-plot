import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^#([^/]+)\/(.+)$/,
        replacement: path.resolve(__dirname, "packages/$1/src/$2"),
      },
    ],
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
