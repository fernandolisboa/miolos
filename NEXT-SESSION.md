# Do I need to do anything?

**No.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) still holds one ⚡ decision, low urgency by ~13 months. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Nothing to verify. #206 cluster 5 merged as #250; plan → plan review → re-plan → implement → 4 lenses → fix → merge ran unattended.

## Session state — #206 cluster 5 merged (#250)

Twelve per-game route files stopped carrying their own copy of the publication wall read. **436 lines → 184**, two shared modules at 98, envelope copies 12 → 2. New **ADR-0076**: the shared envelope takes a `render` callback, never a screen registry — a registry would pull four screens (and the Termo dictionary) onto every consumer's graph and *nothing in the gate would fail*. `T-WEB-S364` is that ADR's only enforcement.

**Left alone on purpose:** the 8 `opengraph-image.tsx` files (already on the `og/handlers.ts` seam; `T-WEB-S204` pins them) and the 3 free-play pages (5 lines, no wall read).

## The two lessons this ticket cost

**1. A source read is not an experiment.** The first plan claimed a re-exported `export const dynamic` is *silently* dropped and would serve a stale puzzle. The plan review read Next's source and said it only *warns*. Running the build showed **both wrong** — this repo builds with Turbopack, which hard-fails all three shapes by file and line. A test was one review round from shipping to guard a failure that cannot happen. **When a claim is about what a tool does, run the tool.**

**2. The dead assertion appeared again — inside the test written to stop dead assertions.** `route-envelopes.test.ts` asserted three arms in sequence; the archive-screen arm could never red, because every archive screen imports `../<game>/play-view` and trips the first filter, which throws first. Fourth session running, still only caught by mutation. The fix is one object assertion instead of three sequential ones. **Sequential `expect`s in one test hide every arm after the first.**

Also: two review lenses independently rejected on the **id frontier** — `T-WEB-S364` spent without `docs/agents/test-ids.md` moving. Same failure that opened the `S` series. And ADR-0076 shipped an `Amends:` line plus an in-place annotation on ADR-0029, both retired by `docs/agents/domain.md`.

## Next

**#206 cluster 14** — `conclusion-view.tsx`, 1,477 lines, 19 top-level components, two full screens. The issue notes **14 unblocks 6**, so 14 → 6 is the order.

**Also queued:** #201 (import walls walked by a mid-path `..`), #205's CSS half (~1,820 lines, NOT a sweep — `T-WEB-S102` asserts the *contents* of `termo-board.module.css`'s header), #155 (`bundle-check` into CI — ADR-0076 names it as the gap that makes `T-WEB-S364` necessary), and the Quick change filed on #206: `jsonResponse`/`stubFetch` hand-copied across ~19 `apps/web/test` files.

**One process note:** four review lenses running the suite concurrently on one box produced transient cross-module failures in files the diff never touched. Serial re-runs were green every time. Don't trust a single red from a parallel review round — re-run it alone first.
