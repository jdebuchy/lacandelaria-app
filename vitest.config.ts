import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      include: ["src/lib/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html"]
    },
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
