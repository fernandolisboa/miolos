import os from "node:os";

/**
 * THE WORKER BOUND, SHARED BY ALL SIX PACKAGES.
 *
 * vitest's default is `maxWorkers = cpus - 1`, which ties memory demand to
 * CORE COUNT. Memory does not scale with cores, so on any machine with a high
 * cores-to-RAM ratio the default asks for more than the box has. That is #114:
 * six packages x 7 workers demanded ~19 GB on a 15.5 GB box, drove it into
 * swap, and made a developer machine unusable for days — the failure was
 * diagnosed from inside the repo while it was being blamed on Windows.
 *
 * `TURBO_CONCURRENCY=2` on the root `test` script bounds the OUTER axis
 * (packages at once). It is not enough on its own: it leaves the inner axis
 * tied to core count, so the same box grows the demand back the moment it
 * gains cores, and it does nothing at all for anyone who bypasses the root
 * script. This bound is the one that holds in every invocation.
 *
 * WHY min(4, cpus - 1) AND NOT A FLAT 4. The formula is what keeps CI
 * unchanged. On the 2-vCPU hosted runner `cpus - 1` is 1, so this yields 1 —
 * byte-identical to the behaviour before this file existed, verified against
 * the `pool=1` reported by all 26 boots in gate run 32081091260. A flat 4
 * would quadruple the gate's workers on a runner with two cores and 7.9 GB.
 * On the 8-core developer box it yields 4.
 *
 * MEASURED, on 8 cores / 23.5 GB, `pnpm test --force` (turbo capped at 2):
 *
 *   maxWorkers  peak RAM   wall
 *   7 (default)  9 626 MB   40 s   <- what #114 shipped
 *   4            6 861 MB   39 s   <- this file: faster AND 2.8 GB lighter
 *   2            5 209 MB   56 s
 *
 * And the bound holds where the turbo cap does not. At `--concurrency=10`,
 * which is what CI passes and what a bare `turbo run test` does, the default
 * peaks at 17 748 MB; with this file it is 12 122 MB, and at maxWorkers=2 it
 * is 7 883 MB — lower than the CAPPED default. Lower this to 2 before
 * lowering the box's RAM below ~12 GB; the cost is roughly +17 s.
 *
 * ADR-0017 permits a vitest config only where the defaults do not suffice.
 * They demonstrably do not: the default is what made the box unusable.
 *
 * The `node:os` import is not a `packages/games` dependency in the sense the
 * project invariant forbids. That invariant governs what the package SHIPS —
 * pure TypeScript, deterministic, seed in, puzzle out. A test-runner config
 * is tooling, and vitest itself is a Node process in every package already.
 *
 * A KNOWN RESIDUAL, so it is found before it breaks rather than after. Vite
 * warns that importing this file without a file extension is unsupported by
 * `configLoader: 'native'`, which it plans to make the default in a future
 * major. The extension cannot simply be added: TypeScript rejects a `.ts`
 * specifier without `allowImportingTsExtensions`, and a `.js` specifier would
 * resolve to a file that does not exist at runtime. The root `package.json`
 * carries `"type": "module"`, which clears the other half of that warning.
 * When Vite flips the default, the fix is `allowImportingTsExtensions` in
 * `tsconfig.base.json` plus a `.ts` specifier here — not deleting this file.
 *
 * This file exports the NUMBER rather than a config object, deliberately: a
 * `defineConfig` here would need `vitest/config` resolvable from the repo
 * root, and vitest is a devDependency of each package rather than of the
 * root. Exporting the number keeps every `vitest` import package-local and
 * adds no root dependency.
 */
export const maxWorkers = Math.max(1, Math.min(4, os.cpus().length - 1));
