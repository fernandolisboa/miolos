import { defineConfig } from "vitest/config";

// The worker bound lives once, at the repo root: see `vitest.shared.ts` for
// why the default `cpus - 1` is what made a developer box unusable (#114).
import { maxWorkers } from "../../vitest.shared";

export default defineConfig({ test: { maxWorkers } });
