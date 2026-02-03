import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "**/*.d.ts", "**/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@commands": path.resolve(__dirname, "src/Commands"),
      "@commands/*": path.resolve(__dirname, "src/Commands"),
      "@systems": path.resolve(__dirname, "src/Systems"),
      "@systems/*": path.resolve(__dirname, "src/Systems"),
      "@middleware": path.resolve(__dirname, "src/Commands/Middleware"),
      "@middleware/*": path.resolve(__dirname, "src/Commands/Middleware"),
      "@bot": path.resolve(__dirname, "src/Bot"),
      "@bot/*": path.resolve(__dirname, "src/Bot"),
      "@database": path.resolve(__dirname, "src/Database"),
      "@database/*": path.resolve(__dirname, "src/Database"),
      "@utilities": path.resolve(__dirname, "src/Utilities"),
      "@utilities/*": path.resolve(__dirname, "src/Utilities"),
      "@shared": path.resolve(__dirname, "src/Shared"),
      "@shared/*": path.resolve(__dirname, "src/Shared"),
      "@responders": path.resolve(__dirname, "src/Responders"),
      "@responders/*": path.resolve(__dirname, "src/Responders"),
      "@events": path.resolve(__dirname, "src/Events"),
      "@events/*": path.resolve(__dirname, "src/Events"),
      "@config": path.resolve(__dirname, "src/Config"),
      "@config/*": path.resolve(__dirname, "src/Config"),
    },
  },
});
