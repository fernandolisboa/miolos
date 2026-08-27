import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { maxWorkers } from "../../vitest.shared";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    maxWorkers,
  },
});
