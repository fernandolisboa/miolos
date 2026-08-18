# Handoff 050 — #114 merged, #110 closed, and the box that changed underneath the diagnosis

**Point-in-time snapshot, 2026-08-17.** `main` at `f684447`. Not a living document.

---

## 1. Where things stand

| | state |
|---|---|
| **#117** | Merged (`ea2ac36`) — the fan-out cap, the boot instrument, the comment consolidation, ADR-0057 |
| **#118** | Merged (`f684447`) — a same-day correction to #117's own shipped prose |
| **#110** | **Closed**, delivered-by-#114 |
| **#114** | **Open** — waiting on Fernando's confirmation of the acceptance re-reading, nothing else |
| **#107** | **Open** — same, its AC1 has the identical wording problem |
| **#116** | Open — the ADR `Status:` field gap, untouched here |
| **#109** | Open — its third residual (`T-WEB-S43`) is now measurable again on the local axis |

**Neither #114 nor #107 is blocked on work.** Both are blocked on one decision, stated in [#114's comment](https://github.com/fernandolisboa/miolos/issues/114#issuecomment-5321815467) and repeated in #107's. If Fernando confirms, both close with no further code.

---

## 2. The thing that matters most, and it is not the cap

**The developer box was enlarged mid-ticket, from outside the ticket, in response to the same failures the ticket was diagnosing.** `.wslconfig` went from the default 50 % split to `memory=24GB`, `swap=24GB`, `autoMemoryReclaim=gradual`, `processors=8`. The kernel now reports `MemTotal` 23.5 GB and `SwapTotal` 24.0 GB against the old 15 545 MB / 4 GB.

**Every figure ADR-0057 was drafted against came from the old box.** That was caught before merge and the artifacts were rewritten rather than left to rot, but a reader who skims will still find pre-change prose in plan 049 §2.1–2.6, which is a snapshot class and was deliberately **not** rewritten — it carries a pointer to §2.7 instead.

What the re-measurement found, nine runs, three at each fan-out, all green, zero swap:

| `--concurrency` | used peak | elapsed | max PGlite boot |
|---|---|---|---|
| 10 (uncapped) | 16.8–17.7 GB | 53–55 s | 8 597.1–**10 283.1** ms |
| 4 | 11.7–12.8 GB | 50–53 s | 4 959.8–5 690.3 ms |
| **2 (shipped)** | **9.6–9.8 GB** | **40–41 s** | **2 961.1–3 033.5 ms** |
| 1 | 9.8 GB | 69 s | — |

**Three conclusions were reversed**, and they are the kind that would have shipped as false claims:

1. **Uncapped is not red.** The ticket's headline was "0 green in 6". On the enlarged box it is green every time. **The RAM fixed the symptom, not the cap.**
2. **`TC=4` is not faster than `TC=2`.** Two wins on both axes now. The memory-versus-speed trade the plan argues about does not exist here.
3. **The hook budget has an eligible local anchor**, where ADR-0057 decision 5 had argued at length that none existed.

**What survives, and is now the cap's entire warrant:** six packages × `cpus-1` still puts up to 42 processes on 8 cores. That is why full fan-out is still the *slowest* setting with 6 GB to spare. Adding RAM removed the symptom and left the arithmetic.

> **If you take one thing from this handoff:** the cap is retained because it is **fastest**, not because the machine runs out of memory. Anyone who reads "the memory problem is solved" and raises the fan-out will get a slower suite and a boot that clears vitest's bare hook default.

---

## 3. What to read first, in order

1. [`docs/adr/0057-…`](../adr/0057-the-test-suites-memory-model-and-a-cap-that-binds-locally.md) — the header paragraph on the box change, then decisions 1, 2 and 5. The Rejected list is where the `--maxWorkers` question is settled.
2. The comment block at `createTestDb` in `packages/db/src/testing.ts`. Every local figure is labelled `[15.5 GB]` or `[23.5 GB]`; that labelling is load-bearing and must not be dropped.
3. [`docs/plans/049-…`](../plans/049-issue-114-plan-the-fan-out-cap-and-the-pglite-hook.md) **§2.7 first**, then §2.1–2.6 as history.
4. [#114's acceptance comment](https://github.com/fernandolisboa/miolos/issues/114#issuecomment-5321815467) — the only open decision.

---

## 4. Landmines

- **`pnpm test` is capped; CI is not.** Pre-commit and the gate deliberately run different commands. Three places record it — ADR-0057, `ci.yml`'s comment, and `apps/web/test/fanout-cap.test.ts` — because `package.json` and `turbo.json` cannot carry comments.
- **`T-WEB-S225` asserts exactly one script carries `TURBO_CONCURRENCY`.** It fired this session on a real change (`TURBO_CONCURRENCY=3` added to `build` and `typecheck`), which is the only evidence we have that these guards work on anything but their own fixture. **Do not add the variable to another script without changing the guard deliberately.**
- **Capping `build` or `typecheck` is pointless.** Measured: `build` has only **2 tasks in its whole graph**, so a cap of 3 can never bind; `typecheck`'s 6 finish in 6 s at ~1 GB. Both were reverted.
- **`--maxWorkers` is the tighter knob and is deliberately not shipped.** `--concurrency=2 -- --maxWorkers=4` measures 6 781 MB against the shipped 9 626 MB for ~1 s. It is rejected because the root script is shared with CI, where vitest already computes one worker — hard-coding it would *multiply* the gate's workers on the one runner that is uncapped. If a future box needs it, the shape is `poolOptions.maxForks` in a `packages/db/vitest.config.ts`, not a flag on the shared script.
- **A CI hook figure must be a measurement, not a replay.** Turbo replays cached stdout byte-for-byte, epoch stamps included. A figure counts only when `@miolos/db:test` reads `cache miss, executing` or `cache bypass`. Both gate readings on record were checked this way.
- **`grep -c "Test timed out"` is not a test count.** Two failures can share one error block. Use vitest's own `Failed Tests N` header.
- **The anchor arithmetic disagrees with itself by one step, on purpose.** CI's two readings give 40 000 ms; the local half's six give 45 000. Decision 2 prefers CI. The budget stays at 30 000 on decision 4. **Do not tidy this into a single number** — ADR-0057 records it as a tension because the next ticket should find the disagreement.
- **The local maximum drifted from 9 146.4 to 10 283.1 ms on three extra runs.** Heavy-tailed sample. Never move this budget on one reading.
- **`pgrep -af "vitest|next dev|…"` matches its own wrapper shell** under this harness. Filter `shell-snapshots` out or the idle assertion is a false positive.
- **Plans and handoffs are snapshot classes.** Plan 049 §2 was superseded and got an appended §2.7 plus a pointer, not a rewrite.

---

## 5. Environment gotchas

- `.wslconfig` changes need a full WSL restart. Verify with `awk '/^MemTotal|^SwapTotal/' /proc/meminfo` rather than trusting the file.
- `/tmp` does not survive a WSL reboot. Durable measurement logs went to `~/miolos-114-logs/`, which is outside the repo and untracked. Nothing in the tree depends on it.
- The sampler in `~/miolos-114-logs/sample-mem.sh` reads **only** `/proc/meminfo` and `/proc/loadavg`. Per-process `ps` accounting silently reports near-zero under this shell's restricted `/proc` — an earlier version of that script did exactly that and produced a "4 MB peak" for a 3 GB process.
- `pkill -f <pattern>` can match and kill the harness's own wrapper shell. Kill by explicit PID.

---

## 6. Exit criteria for the next session

1. **Get Fernando's answer on the acceptance re-reading.** If confirmed: close #114 and #107, nothing else needed.
2. If he wants the literal AC instead, say plainly that a literal pass on this box is the RAM's doing and would re-fail on a smaller machine.
3. **Do not re-open the cap question** without a new measurement on a specific box. The sweep is done, three times over.

Candidate next work, none blocked: **#109** (its local-axis residual is measurable again), **#116** (the ADR `Status:` field gap — it owns the set as it stands when worked, not the membership ADR-0057 lists).

---

## 7. Kickoff prompt for the next session

```
Read docs/handoffs/050-handoff-114-merged-and-the-box-that-changed.md and go from there.

State: main is at f684447. #117 and #118 are merged, #110 is closed. #114 and
#107 are open and blocked on ONE decision from me — the acceptance re-reading
proposed at
https://github.com/fernandolisboa/miolos/issues/114#issuecomment-5321815467
— not on any work.

Start by asking me to confirm or reject that re-reading, and say in one
paragraph what each answer costs. If I confirm, close both issues. Do not
re-run the concurrency sweep; it is done and recorded in ADR-0057 and plan
049 §2.7.

The one thing to internalise before touching anything: the developer box was
enlarged mid-ticket (15.5 GB -> 23.5 GB), so the turbo cap at 2 is retained
because it is the FASTEST setting, not because the machine runs out of
memory. Raising the fan-out gives a slower suite and a PGlite boot that
clears vitest's bare 10 000 ms hook default.

If I have nothing for you on #114/#107, the unblocked candidates are #109
(its third residual, T-WEB-S43, is measurable again on the local axis) and
#116 (the ADR Status: field gap).
```
