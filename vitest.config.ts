import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@/generated": path.resolve(__dirname, "src/generated"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov"],
      include: [
        "src/shared/lib/**/*.ts",
        "src/shared/constants/**/*.ts",
        "src/shared/types/**/*.ts",
        "src/modules/**/services/**/*.ts",
        "src/modules/formats/data/**/*.ts",
        "src/modules/llm/services/**/*.ts",
        "src/modules/data-pipeline/**/*.ts",
      ],
      exclude: [
        "src/test/**",
        "src/generated/**",
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/**/index.ts",
        "src/shared/services/prisma.ts",
        "src/modules/data-pipeline/cli/**",
      ],
    },
  },
});
