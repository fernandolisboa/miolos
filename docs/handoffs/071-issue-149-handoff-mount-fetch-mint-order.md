# Handoff 071 — #149 shipped: four mount-fetch hooks stop racing the mint

Session of 2026-08-22. The newest handoff; start here. Follows handoff 070 (#104).
Nothing pends on Fernando; `docs/pending-fernando.md` NOW is still empty and is unchanged by this session.

**State at close:** `main` = `3e30e43` (#149 via PR #196); this handoff's own records PR lands on top.
#149 closed. **#195 opened** by the review. No other open PRs.
Frontier: **#155 → #106 → #74**, plus #32's email-hedge slice, plus **#195**.

## What shipped

`useAttachState`, `useStreak`, `useMedals`, `useStats` and `useStatsCalendar` now
`await ensureSession()` before their read — the shape `play/sync.ts`,
`termo/guess-client.ts` and `onboarding/use-onboarding-state.ts` (#35) already had.
Tier 1: reproduce-first, one correctness reviewer, no plan, no ADR.

**The defect is the re-mint load, not the cold first visit.** A returning player
whose cookie expired is minted afresh by the layout on that page load; a bare
mount fetch races it and takes the 401 branch. For that load the eligible player
sees no attach card, the stamp reads **0 against a real streak**, and the medals
and stats sections stay empty. The "attach needs a streak of 5, so the account is
weeks old" reasoning is right about a first visit and wrong about this one.

New `apps/web/test/mount-mint-order.test.tsx` — `T-WEB-S339…S342`, one suite per
hook. `T-WEB-S343` burned; frontier row updated in the same commit.

## What to read first, in order

1. `apps/web/src/attach/use-attach-state.ts` — carries the full reasoning; the
   other three cite it rather than repeating it.
2. `apps/web/test/mount-mint-order.test.tsx` — `assertAwaitsTheMint`, the
   deferred-mint helper, and why its second half exists.
3. PR #196's body — the mutation table, the RTT trade, the `detect` limits.

## Non-negotiables this surface carries

- **`ensureSession` buys ORDERING, never identity.** It never rejects and
  resolves whether or not the mint succeeded; a failed mint still reaches the
  same honest absent state. Never reach for `remintSession` here — its
  one-per-load allowance exists for WRITE paths that would otherwise strand a
  completion, and a card that renders nothing must not burn it.
- **Never `Promise.all([ensureSession(), fetchX()])`.** It is the obvious way to
  win the round trip back and it reintroduces the exact bug. `T-WEB-S340` kills
  it; that is the single most valuable assertion in the new file.
- **The three-state contract is unchanged**: `undefined` unsettled, `null`
  settled-without-a-value, or the response. First paint and SSR are untouched —
  every hook still initialises to `undefined` and fetches only in a mount effect.

## Landmines

- **`ensureSession` caches a module-level promise scoped to ONE PAGE LOAD; a
  vitest file is N.** A never-settling `fetch` stub in a file's first case
  becomes the cached mint for the whole file. That is why `hub-streak.test.tsx`
  mocks it (**load-bearing — 4 tests red without it**) and why
  `conclusion-view.test.tsx` does too (**not** load-bearing — 54/54 pass without
  it; kept as reorder-proofing, and its comment says exactly that). Triage is
  structural: a file is at risk only if it stubs `NEXT_PUBLIC_API_URL`, since
  without it `mintSession` returns on its first statement and never reaches
  `fetch`. `grep -rln NEXT_PUBLIC_API_URL apps/web/test` is the whole check.
- **Two guards are unbindable, not untested, and the PR says so.** Under React
  18+ a `setState` on an unmounted component is a silent no-op, so nothing can
  distinguish a hook that drops its `cancelled` flag; and the four `.catch` arms
  are unreachable because every shipped client is total. Do not "fix" this with
  a test — it would be green by construction. That is why the tail burned.
- **Every load now pays ~2 RTT instead of ~1** for these four reads, because
  `SessionBootstrap` posts `/session` on every load, not just cold ones. Correct
  trade, stated as a decision in PR #196 rather than absorbed silently.
- **`GET /day` is still unordered** — the sixth reader, missed by #149's list of
  five, found by the review. It is **#195**, deliberately not folded in: it is a
  `useSyncExternalStore` store whose `inFlight` guard would then span the mint,
  changing the dedupe semantics ADR-0060 decision 5 and the 60 s poll rest on.
  #195 also carries the **split arrival order** #149 created on the hub — `/day`
  at 1 RTT, the stamp at 2 — so decide the two together, not `/day` by reflex.
- **`pnpm build` dirties the committed `apps/api/next-env.d.ts`** (dev vs prod
  rewrite the import line). `git checkout` it after any measurement build.
- **Vitest's default reporter suppresses `console.*` entirely** — measured 0 vs 1
  against `--reporter=verbose`. A log-grep over a plain `vitest run` reads a
  silent channel.
- Live test-id maxima: `T-CORE-S114`, `T-DB-S87`, `T-API-S179`, **`T-WEB-S342`**,
  `T-LINT-S54`. `T-WEB-S343` burned; `S337`/`S338` and `T-LINT-S55` still burned
  from #104.

## The one lesson worth carrying

**A ticket's own enumeration is a claim, and the cheapest review finding is
re-deriving it from the code.** #149's body listed five readers with a table and
a confident "four still do". It was wrong — there is a sixth, and the reviewer
found it by grepping `fetch(` across `apps/web/src` and cross-referencing every
`ensureSession` caller rather than trusting the table. Napkin § Execution 10
already says an unmeasured claim propagates into every record; this is the same
rule pointed at the *ticket*, which is the one record nobody re-checks because it
is where the work started. The corollary that made it cheap: the reviewer also
classified what it found, and correctly refused to fold #195 in — a Tier 1 that
absorbs a new decision is how a tier claim quietly becomes false.

Second lesson: **run the mutation, then classify the survivors.** *Untested* is
a finding to fix; *unbindable* is a finding to state and a tail to burn.

---

## Kickoff prompt for the next session

```
Preflight: `main` is at or past 3e30e43; #149 and #104 CLOSED; #195 OPEN
(ready-for-agent, tier-2); docs/pending-fernando.md NOW empty. If any of
that does not match, stop and read the newest handoff/addendum first.

Read docs/handoffs/071-issue-149-handoff-mount-fetch-mint-order.md, then
docs/pending-fernando.md. Check live state with gh/git and trust that
over anything written here.

Nothing pends on Fernando — do not offer him credential work.
Frontier: #155, #106, #74, #195, plus #32's email-hedge slice.
scripts/gate-lock.sh acquire "<who>" before ANY suite run, git commit
included; release after. Reserve test ids on the ISSUE before step 5.
Cite records by quoted text, never by line number alone.
Measure any claim about framework behaviour before it enters a record,
and re-derive the ticket's own enumeration from the code — #149's was
wrong by one, which is what #195 is.
Close the session with its OWN numbered handoff in docs/handoffs/.
```
