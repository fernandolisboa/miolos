# Plan 072 — #195: the day-truth store repairs after the mint rather than waiting for it

**Issue:** [#195](https://github.com/fernandolisboa/miolos/issues/195) (`ready-for-agent`, `tier-2`)
**Tier:** 2 (a new decision + a new module-state slot). Step 2 of the eight steps.
**Step 1:** the exploration this plan builds on is `/home/ferna/miolos-session/195-step1-explore.md` (uncommitted session scratch; every fact it supplies that this plan leans on is re-verified below).
**Base:** `main` @ **`8885844`** (#200 / PR #202, docs-only). Step 1 read
`cdce21a`; step 2 read `c7776db`; step 3 reviewed against `c7776db`; step 4 began
at `e5d0139` (#106 / PR #198) and **`main` moved again while step 4 was running** —
which is itself the argument for the re-derivation criteria below, not a footnote
to it. Re-derived at each move, against the tree and not against any earlier read:
the free-play wall still bans
`["../day/day-client", "../day/day-truth", "../day"]` by name;
`git grep -hoE "T-WEB-S[0-9]+[a-z]?" HEAD -- apps packages | sort -u | sort -t S -k2 -n | tail -1`
answers **`T-WEB-S342`**, so next free is still **`S344`** (`S343` burned at #149);
ADR-0060's last annotation is still **(i)**; **ADR-0072 is still free**. Only
`T-LINT` moved, to next free `S61`.
**Ships:** proposed **ADR-0072**, which **amends ADR-0060**.
**Step 3:** reviewed ACCEPT-WITH-FIXES; **step 4** applied every finding below and
records each fix at the point it lands. The candidate is **not** reopened.

Every record below is cited **by quoted text**, never by line number: an in-place
annotation moves every line under it, and three of the files quoted here are
edited by this same PR.

**Working-tree note for step 5.** These plan files are uncommitted, and the
checkout has moved branches under this session at least once. **Step 5 branches
from `main` at whatever `git rev-parse origin/main` answers then** — not from a
SHA quoted here — and stages deliberately, because the tree also carries a foreign
`plans/073-…` row and a foreign `docs/pending-fernando.md` edit from parallel
streams. See §6.5.

---

## 1. The decision, in one line

**Candidate (e) — fire unordered, and repair once after the mint if the answer
was empty.** `refresh()` keeps firing immediately, exactly as today; when a
fetch answers `undefined` *and the store has never held a server truth on this
page load*, the store spends a **page-lifetime one-shot**: `await ensureSession()`,
then one more `refresh()`, scheduled **after** `inFlight` has been released.

Three properties fall out, and they are the whole argument:

1. `/day` still lands at **~1 RTT** on a warm load — the overwhelmingly common one.
2. `inFlight` keeps **both** of its properties (P1 and P2, §3). No promise that
   can hang is ever awaited while the guard is held.
3. The re-mint load is **repaired** rather than accepted, at the same ~2 RTT the
   ordering candidates would have cost it.

---

## 2. Why (e), against each other candidate by name

Step 1 §7's six candidates, argued down in the order they lose.

### (a1) guard-then-mint, and (c) mint inside `day-client.ts` — **disqualified by the hanging mint**

Both hold `inFlight` across `ensureSession()`. `ensureSession()` has **no
timeout** and its cached `pending` never settles if `POST /session` hangs. That
reproduces, on a new path, precisely the harm the module's longest comment
exists to prevent:

> *"With the reset inside the `then`, one escaping rejection leaves `inFlight === true`
> for the lifetime of the page: every later trigger, `online` recovery included,
> is swallowed by the guard and there is no way back short of a reload."*
> — `apps/web/src/day/day-truth.ts`, `refresh()`'s TSDoc

A hanging mint reaches the identical end state with **no rejection at all**, so
there is nothing for `finally` to release. Today a dead mint costs the page one
401 on `/day` and every other trigger keeps working; under (a1)/(c) the store
goes silent for the page's lifetime. `T-WEB-S246` was written against exactly
this class of wedge and would not catch this one. **The brief asks for an
explicit answer for the hanging mint if either is chosen: the answer is that
neither is chosen, and this is the reason.**

(c) loses twice more. `day-client.ts`'s header — *"A line-by-line sibling of
`streak/streak-client.ts`, deliberately: three clients that read the
authenticated surface should fail the same way, and one spelling is the rule
this repo enforces hardest."* — makes a minting `/day` client the one asymmetric
one of five, and #149 deliberately put the ordering in the hooks, not the
clients. It also reds `T-WEB-S234`'s env-unset arm at `expect(errorSpy).toHaveBeenCalledTimes(1)`,
because `mintSession` logs its own skip line first.

### (b) subscribe-only — **has a trap that makes the fix worse than the bug**

As literally worded, (b) leaves `refreshDayTruth()` firing synchronously and
unordered. On a conclusion screen `useDayState`'s subscribe is hook-ordered
before the `syncOutcome` effect, so under (b) the subscribe's `refresh()` is
parked behind the mint, `inFlight` is still `false`, and the effect's
`refreshDayTruth()` fires an **unordered** `GET /day` — the #195 defect,
relocated to the conclusion — *and* sets `inFlight`, so when the mint resolves
the **ordered** mount refresh is swallowed by the guard and never fires. The
unordered path defeats the ordered one. Closing the trap means ordering
`refreshDayTruth()` too, at which point (b) is (a2) with extra branching.

### (f) first-refresh-only — **(a2) with extra state**

Same properties as (a2), plus a module boolean, plus (b)'s trap for the
first-refresh window unless `refreshDayTruth()` shares the gate. Nothing is
bought. Dropped.

### (a2) mint-then-check-and-set-the-guard — **the real runner-up, and it loses on four counts**

(a2) is safe (P2 survives; the guard never spans the mint) and it is the
straightforward reading of "order it". It loses to (e) on:

1. **It costs every warm load a round trip** on the read that decides a tile's
   *shape*. (e) costs warm loads nothing.
2. **It makes ADR-0070 consequence (h) false as written** — *"Every one of those
   is deduped to nothing by `inFlight`, because `useDayState`'s
   `useSyncExternalStore` subscribe is hook-ordered before the effect and **sets
   the guard synchronously**"* — and `T-WEB-S329`'s own comment repeats that
   sentence as the reason its first version was wrong. (a2) therefore owes an
   ADR-0070 annotation and a re-argued `T-WEB-S329`. (e) owes neither.
3. **Its rescue argument is an unverified microtask claim.** (a2)'s conclusion
   survives only if N `.then` continuations registered on the one shared
   `pending` object drain in registration order. That is probably true and it is
   exactly the kind of claim napkin § Execution 10 says must be measured before
   it enters a record. (e) needs no such claim.
4. **It is the expensive half of the test rework.** `day-truth.test.tsx` asserts
   exact `toHaveBeenCalledTimes(N)` in **30 places across 11 of its 18 cases**,
   against a `stubFetch` that is **not URL-filtered**, several read
   **synchronously right after `renderHook`**. Under (a2) those synchronous reads
   get `0` where they expect `1`, *and* every count gains a `POST /session`.
   Under (e), none of them moves — see §6, which is a verified claim, not an
   estimate.

   *(Step 4: this said "ten places". Measured at step 3 and re-measured at step 4
   — `grep -c "toHaveBeenCalledTimes" apps/web/test/day-truth.test.tsx` → **30**,
   over 11 of 18 `it` blocks. The plan cited napkin § Execution 10's own example
   — *"one shipped saying a grep 'returns exactly ten'; on that branch it returned
   twelve"* — and then reproduced it, in the same sentence shape, about the same
   kind of count. The corrected figure **strengthens** this argument against (a2).)*

### (d) accept the skew — **the honest alternative, and (e) strictly dominates it**

(d) is defensible: the loss is real but mild and self-healing (`focus`,
`visibilitychange`, `online`, the 60 s poll), and the issue explicitly leaves the
door open — *"the answer might be to order it, or might be to leave `/day` first
and accept the skew."* But (e) buys everything (d) buys — `/day` at ~1 RTT on a
warm load, P1 and P2 intact, ADR-0070 consequences (h) and (i) untouched (§7.1's
letter-hygiene rule: never a bare letter), no coupling to the
mint's liveness — and **additionally repairs the defect**, for one extra `GET /day`
on loads that were already answering 401. (d) also leaves `/day` permanently the
one unordered reader of eight, and step 1 §11 is clear that an unexplained
asymmetry of exactly that shape is what produced #149 and then #195. (e) records
the asymmetry *and* removes its consequence.

### (e-narrow) condition the repair on the mint being UNSETTLED when the fetch began — **considered at step 4, rejected, and this is the argument**

Not one of step 1 §7's six. Step 3 raised it as *"the direct answer to the
strongest objection against the chosen design"* — §4 point 3 narrows on **state**
(`payload === undefined`), never on **cause**, so the repair also fires on a 5xx,
a 429, a schema-drifted 200, an unset env var and an offline blip (H4 below, and
ADR-0072 consequence (j), §7.1, lists all five). `bootstrap.ts` runs a `.finally`
on `pending`; a module boolean flipped there plus an exported predicate would
narrow the trigger to *"the mint had not settled when this fetch started"*, which
is #195's shape exactly. It is argued down here rather than left unmentioned,
because a plan that names six alternatives owes the seventh the same treatment.

It loses on three counts:

1. **It buys almost nothing, and does not fix the case it is sold on.** The
   repair fires at most once per page load and only while the store has *never*
   held a truth, so in practice it fires on the **first** empty answer — the
   mount fetch — and at the mount fetch the mint is unsettled anyway
   (`ensureSession()` is lazy: on a first load `pending` is unstarted or in
   flight). A 5xx on the mount fetch therefore still triggers the zero-delay
   retry (ADR-0072 consequence (k)) under (e-narrow); a cookie-blocked browser's
   mint is unsettled at every hard load's mount fetch, so its per-load extra
   request is unchanged too. Meanwhile a *later* 5xx on a poll tick or `focus`
   already cannot repair, because the mount spent the one-shot. The predicate and
   the shipped design agree on nearly every trace, and disagree on none of the
   traces H4 was raised about.
2. **"Settled" is not a monotone fact, and pretending it is would be a bug.**
   `remintSession()` **replaces** the cached promise — `pending = attempt.then(() => undefined);`
   — so a flag set by `pending`'s first `.finally` describes a promise that is no
   longer the one `ensureSession()` returns. Making the predicate correct means
   re-arming it on every re-mint, which is precisely the `remintSpent` /
   `confirmSession()` / reset-on-`false` machinery whose reasoning is the longest
   TSDoc in `bootstrap.ts`. That is a second copy of the hardest state machine in
   the app, to save at most one request per page load.
3. **It widens `bootstrap.ts`'s public surface for a read path.** A new exported
   predicate makes the mint's internal settle state a thing other modules branch
   on. §7.1 decision 2's whole shape is that the day store treats the mint as an
   opaque promise it awaits once; a predicate reverses that.

**Disposal:** rejected, and the costs it would have targeted are recorded instead
as ADR-0072 consequences (j) and (k) rather than argued away. That is the review's
own "minimum fix", taken on both halves.

### The trade, restated for (e)

| | `/day` RTT, warm | `/day` RTT, re-mint | requests, re-mint | P1 | P2 | mint-liveness coupling |
|---|---|---|---|---|---|---|
| today | ~1 | ~1, **wrong** | 1 | kept | kept | none |
| (a1)/(c) | ~2 | ~2 | 1 | kept | **lost** | **wedges the store** |
| (a2)/(f) | ~2 | ~2 | 1 | **lost as text** | kept | none |
| (d) | ~1 | ~1, **wrong** | 1 | kept | kept | none |
| **(e)** | **~1** | **~2** | **2** | **kept** | **kept** | **none** |

(e)'s whole cost is the bottom-right `2`: one extra 401-answering `GET /day` on
a load that already spent one. It is bounded at **one per page load, ever**.

---

## 3. `inFlight`'s two properties, and what (e) does to each

Step 1 §4's split, which is the most useful thing this ticket has:

- **P1 — the guard is SET SYNCHRONOUSLY.** **(e) preserves it exactly.** The
  prologue `if (inFlight) { return; } inFlight = true;` is byte-identical in the
  diff. ADR-0070 consequence (h)'s sentence stays literally true;
  `T-WEB-S329`'s comment stays literally true; `T-WEB-S236`'s synchronous
  three-event dedupe stays green with no edit.
- **P2 — the guard is HELD only for the duration of one `GET /day`.** **(e)
  preserves it exactly.** The release stays in `finally`, and nothing awaitable
  is introduced between the set and the release. The repair is *scheduled from
  inside* `finally`, **after** `inFlight = false` has already run in the same
  synchronous callback body — so a hanging mint parks a dangling `.then` and
  nothing else. Every trigger keeps working.

**ADR-0060 decision 5** says only *"all deduped by an in-flight guard"* and its
**annotation (a)** says *"every tick goes through the same in-flight guard, so a
slow answer is never stacked on."* Both sentences stay true under (e), unedited.
The 60 s poll is untouched: `startPoll`, `stopPoll`, `onVisibilityChange` and
`subscribe` are byte-identical in the diff, and a poll tick that answers a
payload never reaches the repair arm at all.

Decision 5 still gains an annotation — not because a sentence became false, but
because the store gains a trigger and decision 5's trigger list is closed
(*"NOTHING ELSE."* in the module header; the ADR enumerates them). §7.

---

## 4. The change, exactly

One file: `apps/web/src/day/day-truth.ts`.

```ts
import { ensureSession } from "../session/bootstrap";

/**
 * ONE post-mint repair per page load. Spent, never refilled.
 */
let mintRepairSpent = false;

function refresh(): void {
  if (inFlight) {
    return;
  }
  inFlight = true;
  let noTruthYet = false;
  void fetchDayTruth()
    .then((next) => {
      if (next === undefined) {
        // Only while the store has NEVER held a server truth on this page
        // load — which is #195's defect shape exactly, and nothing wider.
        noTruthYet = payload === undefined;
        return;
      }
      if (payload !== undefined && samePayload(payload, next)) {
        return;
      }
      payload = next;
      for (const listener of listeners) {
        listener();
      }
    })
    .catch(() => {
      // unchanged, and deliberately NOT a repair trigger — see below
    })
    .finally(() => {
      inFlight = false;
      if (noTruthYet && !mintRepairSpent) {
        mintRepairSpent = true;
        void ensureSession().then(() => {
          refresh();
        });
      }
    });
}
```

Five things about this shape are load-bearing and must reach the TSDoc:

1. **`inFlight = false` runs FIRST, in the same synchronous callback body.** The
   repair is scheduled against an already-released guard. This is what keeps P2
   and what makes a hanging mint harmless. It is not a microtask-ordering claim:
   both statements are in one function body.
2. **The repair arm is `next === undefined` only, never `.catch`.** The `.catch`
   arm is unreachable through the shipped client (`fetchDayTruth` is total by
   construction) and `T-WEB-S246` stubs a rejecting client precisely to prove
   the guard's correctness is *local*. Wiring the repair to it would make
   `T-WEB-S246` red for the wrong reason and would couple a local guarantee to a
   sibling module's body again.
3. **`payload === undefined` narrows it further**, to "the store has no server
   truth at all". A transient blip mid-session does not spend the one-shot.
   Named residual R2, §8.
4. **The no-loop proof extends rather than breaks.** The existing proof in
   `refreshDayTruth()`'s TSDoc gains one clause: the repair edge
   `refresh → (empty, first truth) → ensureSession → refresh` fires **at most
   once per page load**, because `mintRepairSpent` is set *before* the mint is
   awaited and is never cleared; so the chain is bounded at length two and the
   second link cannot schedule a third. Both entry points (`subscribe`'s 0→1 and
   `refreshDayTruth()`) share the one flag, so this is one bound, not two.
5. **Why a PAGE-LOAD-scoped flag is right here, when the module header says
   page-load scope is wrong for the fetch.** The header warns, about the fetch:
   *"LISTENER COUNT 0 -> 1, at effect time and never during render. **Not "the
   first subscriber"**: a client-side navigation `/sudoku/concluido -> /` drops
   every subscriber and re-adds five, and a store that fetched once per page load
   would answer the most frequent way a player looks at the hub with the payload
   from the session's first mount."* `mintRepairSpent` is exactly such a
   once-per-page-load flag, and the apparent contradiction is the first thing the
   next reader will hit. It is not a contradiction, because the two flags scope
   **different facts**. The fetch's freshness is a per-view fact: a route change
   is a new view and deserves a new answer. The repair's need is a per-**identity**
   fact, and the identity is minted once per page load — `ensureSession()`'s own
   `pending` is page-load-scoped for the same reason. Matching the mint's scope is
   the point; matching the view's would re-arm a retry against a mint that cannot
   change. **The TSDoc must say this**, or the header reads as self-contradicting.

**Walls, checked, none breached.** The new edge is **outbound** from `src/day`.
`T-WEB-S244` scans **inbound** importers of `.../day/day-(truth|client)` and
excludes files under `src/day/` itself — verified by reading the test.
`test/og-image.node.test.ts` and `test/archive-day.test.tsx` (`T-WEB-S183`)
likewise constrain edges *into* `src/day`. The free-play wall bans `../day/**`
and `src/session` from free play **by name and non-transitively** (napkin
§ Domain 2); free play imports neither. **Bundle cost is expected to be zero** —
PR #196 measured `bootstrap.ts` as already in every route's client graph via
`SessionBootstrap` in the layout — but napkin § Domain 3 requires a PR touching
`/`'s client JS to publish **measured** before/after figures, so this is an
exit-criterion measurement, not an assumption (§9).

---

## 5. The hub's arrival order — the stated decision

The issue requires this be decided with the fix. It is:

> **The hub's split arrival order is left as it is, deliberately, and #195 does
> not merge the waves.** `/day` stays in the early wave; the seven mint-ordered
> reads stay in the later one.

**The warrant is the request shape, not the paint shape.** Merging the waves
means paying a round trip, on every warm load, on the read that decides whether
a tile renders as a call to action or as *Feito* — and buying nothing the later
wave does not already owe. (e) reaches the same end state as merging on the only
loads where merging would have helped, without charging the loads where it would
not.

**What this decision deliberately does NOT assert.** Step 1 §6 derives that the
`/day` wave moves no layout and the ~2 RTT wave does, and marks that derivation
**unmeasured** in those words. This plan does not promote it. What is
mechanically true, and all that reaches the record, is the *design intent* read
off `apps/web/app/page.module.css`: `.cta` and `.done` are each given
`min-height: var(--cta-box-min-height)`, and `.done`'s own comment says *"in the
same reserved box as the pending button"* — i.e. the box was reserved on purpose.
**Whether either wave actually moves layout at paint time is not claimed here,
because nothing measured it.** Per the brief's option (ii), the decision above
does not depend on it: it rests on round trips, which are counted, not on
reflow, which is not.

**No follow-up ticket is filed for the measurement.** A seeded-session CLS
measurement is out of #195's scope, `impeccable detect` cannot produce it (a
clean profile only ever shows the settled zero state — PR #196's own note), and
a tracker entry whose entire content is "go measure something, no defect known"
is the shape CLAUDE.md rule 3 refuses. ADR-0072 records the open question and its
measurement recipe instead, so the next ticket that touches hub paint inherits it.

---

## 6. The tests

### 6.1 `apps/web/test/day-truth.test.tsx` — verified NOT to need rework

This is the file step 1 §9 correctly names as the cost centre for the ordering
candidates. Under (e) it does not move, and this is a **verified** claim:

There are **four** ways a case in this file could reach the repair arm, and a
regex can only see one of them. The verification is therefore a four-part check,
not a grep — stated that way because napkin § Execution 10's own example is a
source-scan whose regex made the test's stated claim false:

1. **A non-2xx `/day` answer.** `grep -n "jsonResponse([^2]" apps/web/test/day-truth.test.tsx`
   returns only the helper's own definition line. This is the part the grep does
   cover. Every stubbed answer is a 200 or a never-settling promise
   (`stubFetch(() => new Promise<Response>(() => undefined))`, twice), and a
   never-settling answer never runs `.then` at all.
2. **A 200 whose body fails `dayResponseSchema.safeParse`.** Checked **by hand**,
   case by case: every `jsonResponse(200, …)` body is built by the file's own
   `payload()` helper or a valid override of it, so all parse, and each takes the
   `payload = next` arm — `noTruthYet` stays `false`.
3. **A `vi.doMock`ed `day-client` resolving `undefined`.** The file already uses
   `vi.doMock("../src/day/day-client", …)`, at `T-WEB-S246` and nowhere else.
   That mock's non-rejecting arm returns `Promise.resolve(payload({ sudoku: { status: "completed" } }))`
   — a valid payload. Its rejecting arm lands in `.catch`, which §4 point 2
   deliberately excludes.
4. **An unstubbed `NEXT_PUBLIC_API_URL`.** Checked: the file stubs it.

So the repair arm is **unreachable from every existing case in the file**, and
the acceptance criterion is that `day-truth.test.tsx` passes **unchanged apart
from the additions in §6.2**. If it does not, the implementation deviated from §4.

**The four acceptance-named ids hold for one reason each, and the reasons are
structural rather than per-id.** `T-WEB-S235`, `T-WEB-S259` and `T-WEB-S260` rest
on `subscribe`, `startPoll`, `stopPoll` and `onVisibilityChange`, all
**byte-identical** in the diff, plus the unreachability just proved.
`T-WEB-S236`'s synchronous three-event dedupe rests on **P1** and `T-WEB-S246` on
**P2**; `refresh()`'s prologue and its `finally` release are likewise
byte-identical, and the release is not the repair's trigger (§3). The one thing
that does change is `refreshDayTruth()`'s no-loop proof, extended by §4 point 4
and bound by `T-WEB-S346`(c).

### 6.2 Making the bootstrap immunity **designed** rather than incidental

`day-truth.test.tsx` escapes napkin § Domain Behavior Guardrails 7 only by
accident: `beforeEach` calls `vi.resetModules()` and every case re-imports
through the dynamic `loadStore()`, so a fresh `bootstrap.ts` with a fresh
`pending` is built per case and the file's two never-settling `fetch` stubs can
never become the cached mint. **Both halves are one edit from vanishing**, and
under (e) the file's store now genuinely reaches `bootstrap`.

Two additions, in that file:

1. A paragraph in the file header naming the immunity, its two load-bearing
   parts, and what breaks if either goes — written so the next editor cannot
   remove it unknowingly.
2. **`T-WEB-S347`** — a source-scan tripwire on the file's own text, the idiom
   `T-WEB-S244` and `test/og-image.node.test.ts` already establish. It asserts
   **three** things, not two:
   - `vi.resetModules()` appears in the `beforeEach`;
   - the file carries **no static top-level import** of `../src/day/day-truth`;
   - **the file contains no non-2xx `jsonResponse(` literal.**

   The third is the step-4 addition and it is what makes the section title
   honest. The immunity rests on three facts, not two: a future case adding
   `jsonResponse(401, …)` would leave a two-assertion tripwire green while a
   `POST /session` started moving the file's 30 counts — red, but noisily and in
   the wrong place. With the third assertion, `T-WEB-S347` fails first and names
   the cause. **Run the mutation on all three halves** (delete the `resetModules`
   call → red; add a static import → red; add a `jsonResponse(401, {})` stub →
   red) before believing any of the regexes, per napkin § Execution 10's
   source-scan lesson, where a missing literal dot made the guard's own claim
   false. Strip comments before scanning — napkin § Execution 2: this very
   paragraph, committed into the file header, would otherwise red the scan it
   describes.

### 6.3 New file — `apps/web/test/day-truth-mint-repair.test.tsx`

A new file rather than a new `describe`: `vi.mock` is hoisted file-wide, so
mocking `ensureSession` inside `day-truth.test.tsx` would put a mocked mint into
all thirty of its cases and change that file's character. Requirements:

- Mock with the **`importOriginal` spread**, never a bare factory (napkin
  § Domain 7's prescribed remedy), so the rest of `bootstrap.ts` stays real.
- **URL-filter every count**, `nonogram-motif-name.test.tsx`'s `dayCalls()`
  idiom, since a `POST /session` is now in play here by design.
- Re-apply `mockReturnValue` **after** each `vi.resetModules()` — `vi.mock` is
  hoisted and survives resets, the per-case deferred promise does not. Step 1 §9
  flags this; confirm it against a real run rather than by reasoning.
- **Reuse the idiom of `assertAwaitsTheMint` in `mount-mint-order.test.tsx`, not
  the helper itself.** It is a file-local helper shaped for hooks (`useHook`,
  `read`, `settled`) and a module store has no `setValue` and no `cancelled`
  flag. Cite it by name in the new file's header so the lineage is findable.

| Id | Claim |
|---|---|
| **`T-WEB-S344`** | **The repair fires, and it is ordered.** `/day` answers 401; `ensureSession` returns a deferred promise. Assert (i) the first `GET /day` already happened **before** the mint is released — the half that proves the warm path was not made to wait; (ii) **no second `GET /day` while the mint is unresolved** — the `assertAwaitsTheMint` half, and the one that kills a `Promise.all`-shaped repair; (iii) after release, a second `GET /day` lands and the payload appears. |
| **`T-WEB-S345`** | **A healthy load pays nothing.** `/day` answers 200 first try → exactly **one** `GET /day`, and the store calls `ensureSession` **not at all**. This is (e)'s `T-WEB-S340`: the assertion a future developer makes red by "simplifying" `refresh()` to `await ensureSession()`, which is the round trip this ticket exists to keep. |
| **`T-WEB-S346`** | **One-shot, from either entry point, and the hanging mint never wedges the store.** (a) Two consecutive empty answers produce exactly **two** `GET /day` and no third. (b) With an `ensureSession` that **never settles**: `inFlight` is released anyway, and a later `focus` still fetches — the property that disqualified (a1) and (c), so this is the assertion that defends the choice itself. (c) A `refreshDayTruth()` nudge whose `/day` answers empty spends the **same** page-scoped one-shot: the two entry points cannot each get a repair. Binds §4 point 4's extended no-loop proof. |

**`T-WEB-S348` is not allocated — folded into `T-WEB-S346`(c) and burned.**
Step 4's reason, from the step-3 finding: `refreshDayTruth()` is
`export function refreshDayTruth(): void { refresh(); }` — a bare delegation with
no branch — so a "second entry point" case and S346(a) exercise the same
statement through the same flag, and **no mutation reddens one and spares the
other**. Under this repo's rule an id is a distinct claim; an id whose only
defence is that it reads well is not one. The file being edited already carries
the precedent for the alternative — `day-truth.test.tsx`'s *"Widened in place
under this describe, no new id (the `T-WEB-S100` burn precedent)"*.

Reserved review-round headroom: **`T-WEB-S349`, `T-WEB-S350`** — burned if unspent.

**Total reservation: `T-WEB-S344…S350`** — S344–S347 planned, **S348 burned**
(folded, above), S349–S350 headroom. No `T-CORE`, `T-DB`, `T-API` or `T-LINT`
ids: no engine, schema, route or lint-wall change. Frontier re-derived at step 4
against `main` @ `e5d0139`, not read from `docs/agents/test-ids.md`:
`git grep -hoE "T-WEB-S[0-9]+[a-z]?" e5d0139 -- apps packages | sort -u | sort -t S -k2 -n | tail -1`
→ **`T-WEB-S342`**; the table row `| `T-WEB` | `S344` | `S342` | `T-WEB-23` |`
agrees, and `S343` is recorded burned at #149. **Re-run it at step 5 before
allocating anyway** — the frontier is a snapshot, and §6.6 records a live
collision on this exact range.

### 6.4 The neighbouring files where a repair really does fire

`apps/web/test/nonogram-motif-name.test.tsx`, inside `T-WEB-S324`'s block, has
`stubApi(() => jsonResponse(401, { error: "no-session" }))` — *"A 401 — the
cold-profile and offline case — is the same render"*. Under (e) that case gains
one extra 401-answering `GET /day` after the mint. It asserts **DOM absence
only, no call counts**, and the second answer renders identically, so it should
stay green. **Verify by running that file at step 5**; if it moves, the
implementation deviated. `T-WEB-S329`'s own stubs answer 200, so the nudge case
is untouched. `hub-day-truth.test.tsx` routes `/day` → payload and everything
else → 401, so its `/day` is never empty; `remote-conclusion.test.tsx` likewise.

**`apps/web/test/conclusion-view.test.tsx` — the one this survey missed, and the
worst of them.** Step 4 addition. Measured: it stubs `NEXT_PUBLIC_API_URL`, mocks
`ensureSession` with the `importOriginal` spread so it **resolves instantly**
(`ensureSession: vi.fn<() => Promise<void>>(() => Promise.resolve())`), installs a
**suite-default 401 stub for every fetch**
(`new Response(JSON.stringify({ error: "no-session" }), { status: 401 })`), mounts
`useDayState` — its own comment: *"this surface now also reads `GET /day`, because
`useDayState` is the…"* — and calls **`vi.resetModules()` nowhere**. So under (e)
the day store's module state, `mintRepairSpent` included, **persists across all 54
cases**: the first conclusion mount in the file spends the one-shot, and no later
case can. Every `/day` in it answers 401, so the repair arm is genuinely reached.

It should stay green — measured: `grep -c "toHaveBeenCalledTimes"` on that file
returns **0**; its assertions are `toHaveBeenCalledWith` and DOM shape, and the
second 401 renders identically. But *"should"* is what §6.4 exists to remove, so
it joins exit criterion 5's specifically-run list. Cross-case module-state
coupling of exactly this shape is what napkin § Domain 7 is about, and this file
is the repo's clearest instance of it.

**`apps/web/test/telemetry-lifecycle.test.tsx` — cleared, but it exposes a new
cross-module reach that belongs in the record.** Measured: two bare
`toHaveBeenCalledTimes`, **no `NEXT_PUBLIC_API_URL` stub** (so `mintSession`
returns on its first statement and cannot hang), and `../src/telemetry/client`
mocked wholesale. Safe. The general fact it surfaces is not: under (e) a repair
reaches `ensureSession()`, whose `.finally` calls `markSessionReady()` — *"THE
TELEMETRY GATE OPENS WHEN THE MINT SETTLES (#33, ADR-0069)"*. **The day store can
now be the thing that opens the telemetry gate** in any suite where its repair
fires before anything else calls `ensureSession()`. Recorded as **ADR-0072
consequence (m)**.

**Cleared, with the reason.** Applying napkin § Domain 7's structural triage — a
file is at risk only if it stubs `NEXT_PUBLIC_API_URL`: `archive-day.test.tsx`,
`archive-done-chip.test.tsx`, `nonogram-screen.test.tsx`, `share-text.test.ts`,
`day-state.test.ts` and `termo-state.test.ts` (no store mount, or no non-200), and
`hoje.smoke.test.tsx`, whose `expect(fetchMock).not.toHaveBeenCalled()` is safe
because it sits under `renderToStaticMarkup(<HojePage />)`, which runs no effects.

**`apps/web/test/day-client.test.ts` — cleared, and the plan owes this in writing.**
§2 disqualifies candidate (c) partly on *"It also reds `T-WEB-S234`'s env-unset
arm at `expect(errorSpy).toHaveBeenCalledTimes(1)`"*. Having made that
load-bearing against a rival, the plan must show (e) does not hit the same wall:
`T-WEB-S234` exercises `fetchDayTruth` **directly, with no store mounted**, so the
repair path is not in that file at all. It joins exit criterion 5 — one command,
and it closes an argument a step-6 lens would otherwise reopen.

### 6.5 Staging, at step 5

`docs/README.md` in the working tree already carries a **foreign row** from the
parallel #74 stream (`plans/073-issue-74-plan-termo-pool-alert.md`), and
`docs/pending-fernando.md` carries a foreign edit from the #200 stream. The #195
branch carries **only its own two `docs/README.md` rows** (§9 criterion 9) and
**no `docs/pending-fernando.md` diff at all** (criterion 16). Stage hunk by hunk;
never `git add docs/README.md` whole, and never stage
`docs/pending-fernando.md`.

### 6.6 Test-id collision with the #74 stream — resolved, not deferred

`docs/plans/073-issue-74-plan-termo-pool-alert.md` (uncommitted, parallel stream
for #74) reserves *"`T-WEB S344…S346` (3)"*. This plan reserves `T-WEB-S344…S350`.
**They collide on S344–S346**, and **neither has landed** — both plans sit
uncommitted against the same `main` @ `e5d0139` frontier, which is napkin
§ Parallel-Stream 6's predicted failure exactly: *"Re-deriving the test-id
frontier prevents a STALE allocation and cannot prevent a CONCURRENT one — two
branches collided on `T-WEB-S231` the first parallel night."*

**Resolution: plan 072 keeps `T-WEB-S344…S350`; the #74 stream moves.** The rule
is that the **unlanded** id moves and a landed one is never renumbered; here both
are unlanded, so it is a coordination call rather than a forced one, and it goes
this way because #195 is a `T-WEB`-only change whose ids sit on the behaviour
under test, while #74 is an `apps/api` ticket whose `T-WEB` ids are for a workflow
source-scan and are the cheaper three to shift. **Nothing is burned by the
collision** — each number keeps exactly one meaning. Both allocation paragraphs
stay in their plans and in `docs/agents/test-ids.md`, per the same napkin item.
Plan 073 is **not edited from this stream**; the resolution is passed to it.

**Step 5 re-derives the frontier regardless**, because whichever stream lands
first moves it for the other.

---

## 7. The records

### 7.1 New — **ADR-0072**, "The day-truth store repairs after the mint rather than waiting for it"

New ADR, **not** an ADR-0060 annotation alone. Warrant: ADR-0060 predates #149's
ordering rule entirely and says nothing about the session mint; this decides the
relationship between a `useSyncExternalStore` module store and the mint, creates
a mechanism with its own invariants, and carries an arrival-order decision that
spans eight readers rather than one. It ships **`Proposed`** with this plan and
flips to **`Accepted`** in the implementing PR's own diff, merge-dated, citing
that PR (`docs/agents/domain.md` lifecycle).

Header carries `**Amends:** [ADR-0060](...)`; ADR-0060 carries the reciprocal
`**Amended by:** [ADR-0072](...)` **plus** the in-place annotations
**(j)** and **(k)** (§7.2 — re-derived at step 4; the letters are *not* (h)/(i)),
**in the same commit** — *"`**Amends:**` on the amending ADR, the reciprocal
`**Amended by:**` plus an in-place annotation on the amended one, in the same
commit"* (`docs/agents/domain.md`). Named in §9's exit criteria.

**Letter hygiene, because three lettered series now meet in one PR.** ADR-0072's
own consequences below are lettered (a)…(m); ADR-0060's annotation series reaches
(j)/(k) with this ticket; and ADR-0060 has native Consequences lettered too. They
are different sequences that share glyphs. Every cross-reference in the ADR, the
plan and the PR body **qualifies**, on ADR-0060's own standing rule — *"a bare
'(a)' is ambiguous here, so references must qualify — 'annotation (a)' or
'consequence (a)'"* — and additionally names the document: "ADR-0060 annotation
(j)", "ADR-0060 consequence (a)", "ADR-0072 consequence (j)". A bare letter is a
review finding.

Decisions:

1. `refresh()` stays **unordered** against the mint. It fires immediately.
2. A fetch that answers `undefined` **while the store holds no server truth for
   this page load** spends a **page-lifetime one-shot** repair: `ensureSession()`,
   then one more `refresh()`, scheduled **after** the guard is released.
3. `inFlight` keeps **both** properties — set synchronously, held for exactly one
   `GET /day`. **No promise that can hang is ever awaited under the guard**, and
   that is the rule, stated generally, that (a1) and (c) violate.
4. The repair is wired to the `next === undefined` arm **only**, never `.catch`.
5. The hub's split arrival order is **left as it is** (§5).

Rejected, each with the reason from §2: (a1), (a2), (b), (c), (d), (f).

Consequences to state:

- **(a)** `/day` stays at ~1 RTT on a warm load; `day-truth` is the only reader
  of eight that is not mint-ordered, and the warrant is that it is a module store
  with page-lifetime state and six trigger sites, not a hook with a `cancelled`
  flag (step 1 §3's five structural reasons).
- **(b)** A cold or re-mint load pays one extra `GET /day`. Same ~2 RTT as
  ordering; one more request, of the kind it already pays today.
- **(c)** An offline load spends the one-shot on a second failing `/day`.
  Bounded at one per page load.
- **(d)** `src/day/day-truth.ts` gains an outbound import of
  `src/session/bootstrap`. No wall breached (§4); bundle delta measured in the PR.
- **(e)** **ADR-0070 consequence (h) stays true as written and is deliberately
  not annotated.** Its bound is *"at most one per genuine `pending → recorded`
  transition"* — per transition — while the repair is per page load and is shared
  by both entry points, so it does not enter that bound. Consequence (i)'s
  droppable-nudge residual is **not widened**, because the guard's hold is
  unchanged. Recorded here so the two ADRs agree without a second edit. *(If a
  step-6 lens reads (h) as covering total requests rather than per-transition
  ones, the fix is a one-line ADR-0070 annotation, not a design change.)*
- **(f)** Residual **R1**: the repair's own `refresh()` can be swallowed if an
  unrelated trigger takes the guard in the microtask gap after the mint resolves.
  Same family as ADR-0070 consequence (i) — *"`refresh()` discards a trigger that
  arrives while `inFlight`; it does not coalesce a trailing fetch"* — and
  self-healing on the same schedule. The swallowing trigger is itself a `GET /day`.
- **(g)** Residual **R2**: a mid-session cookie expiry, where the store already
  holds today's truth, is not repaired by the one-shot. Deliberate: `remintSession()`
  is not for read paths (its one-per-load allowance exists for write paths that
  would otherwise strand a completion), and the retained payload is ADR-0060
  decision 5's own contract.
- **(h)** ADR-0060 consequence (c)'s stated mechanism — *"`impeccable detect`
  launches a clean browser profile: no session, `/day` answers 401"* — **stays
  true** under (e), where every ordering candidate would have falsified it; a
  second, repaired `/day` then lands with four `pending`s, which is the same
  composition a freshly minted user has. *(Reasoning, **unmeasured**. It changes
  nothing the gate checks; see §9.)*
- **(i)** The open question §5 declines to answer: whether the hub's waves move
  layout at paint. Recipe recorded: a seeded session, not `detect`'s clean profile.
- **(j)** **The trigger is "any empty answer while no truth is held", which is a
  STATE, not a CAUSE — and `undefined` has five causes.** Read off
  `day-client.ts`, whose header states the contract: *"EVERY FAILURE PATH ANSWERS
  `undefined`, and `undefined` means 'no server truth, for any reason'."* The five:
  (1) `NEXT_PUBLIC_API_URL` unset; (2) **any** `!response.ok` — 401, 403, 404,
  429, 5xx alike; (3) a 200 whose body fails the schema; (4) any thrown fetch —
  offline, DNS, CORS; (5) and only *within* (2) is the 401 that #195 is about.
  The repair therefore fires on all five. That is deliberate — narrowing on cause
  is (e-narrow), rejected in §2 with four reasons — but it is stated here rather
  than left to be discovered, because "repairs after the mint" is not what the
  mechanism does on four of the five paths.
- **(k)** **Two costs follow from (j), and both are accepted with their names.**
  First, **a 5xx or 429 on `/day` degenerates the repair into a zero-delay
  retry-once against an already-failing API** — the mint is settled or resolves
  immediately, so there is no delay between the two calls. That is a ~2x
  amplification on `/day` at exactly the moment `/day` is failing. Bounded at one
  per page load, which is why it ships. Second, **a cookie-blocked browser** (ITP,
  private mode, third-party-cookie policy) discards the cookie `POST /session`
  sets, so `/day` 401s forever: for that population the extra request is not a
  rare cold-load cost but **the steady state, on every hard load, permanently**.
  Consequence (b)'s framing is the common case; this is the tail, and the two must
  be read together.
- **(l)** **The store fires the repair BLIND, and that is forced rather than
  chosen.** `ensureSession(): Promise<void>` discards `mintSession`'s boolean, so
  the store cannot tell a mint that landed an identity from one that resolved
  `false` with no `Set-Cookie` — it spends the one-shot either way, and on the
  latter the second `GET /day` is guaranteed useless. Reading the boolean means
  `remintSession()`, which decision 2 refuses for a read path (consequence (g)),
  so blind is the only shape left. One wasted request per page load, worst case.
- **(m)** **`src/day` can now open the telemetry gate.** A repair calls
  `ensureSession()`, whose `.finally` calls `markSessionReady()` — *"THE TELEMETRY
  GATE OPENS WHEN THE MINT SETTLES (#33, ADR-0069)"*. In any suite or page where
  the repair is the first thing to touch `ensureSession()`, the day store is what
  drains the telemetry buffer. Harmless — the gate is idempotent and opens on
  failure too, by design — but it is a new cross-module reach and ADR-0069 should
  be findable from here. No ADR-0069 annotation is owed: its rule is *when* the
  gate opens (mint settles), not *who* triggers the mint, and that is unchanged.

### 7.2 Amend — **ADR-0060**, two in-place annotations: **(j)** and **(k)**

**Re-derived at step 4, not read from the previous draft.** The command, so step 5
re-checks rather than trusts:

```
grep -oE "Annotation \([a-z]\)" docs/adr/0060-*.md | sort -u
```

→ `(b) (c) (d) (e) (f) (g) (h) (i)`, with (a) recorded in the header as a
decision-level amendment at #143. The series is (a) #143, (b)–(e) #141, (f)–(g)
ADR-0065, **(h) ADR-0066 (#58)** — *"**Amended by:** [ADR-0066](…) (#58) — **(h),
continuing the series.**"* — and **(i) ADR-0070 (#64)** — *"**Amended by:**
[ADR-0070](…) (#64) — **(i), continuing the series, at TWO loci under the one
letter**"*. **The next free letters are (j) and (k).**

*(Step 4: this section said **(h)** and **(i)**, and had already shipped that into
`docs/README.md`. Both are taken. Writing a second "annotation (h)" would have put
two different annotations under one letter in the one document that carries an
explicit rule against exactly that ambiguity, and would have silently overwritten
the pointers ADR-0066 and ADR-0070 each planted. **The irony is the ticket's own
lesson.** §7.3 was written to correct two records wrong **by one**; its own
enumeration was wrong **by two** — trusted rather than re-derived, in the very
section arguing that trusting an enumeration is the error class that created
#195. The re-derivation command is now an exit criterion, §9 criterion 11.)*

Both annotations are written **qualified**, on ADR-0060's own header rule —
*"references must qualify — 'annotation (a)' or 'consequence (a)'"*.

- **ADR-0060 annotation (j), decision-level, on decision 5.** The trigger list
  gains the post-mint repair. Decision 5's *"all deduped by an in-flight guard"*
  and annotation (a)'s *"every tick goes through the same in-flight guard, so a
  slow answer is never stacked on"* are **unchanged and re-affirmed**: nothing is
  deleted, and the annotation says so.
- **ADR-0060 annotation (k), on consequence (a).** The count fix, §7.3.

### 7.3 Three records whose counts are wrong — all verified, all corrected in this diff

**(1) `.claude/napkin.md` § Domain Behavior Guardrails item 7 says six; it is
seven.** Verified: `grep -rln "ensureSession" apps/web/src apps/web/app` returns
seven hooks — `use-streak`, `use-attach-state`, **`use-push-state`**,
`use-onboarding-state`, `use-medals`, `use-stats`, `use-stats-calendar` — plus
**two** non-hook callers (`play/sync.ts`, `termo/guess-client.ts`) and
`bootstrap`/`session-bootstrap` themselves. *(Step 4: this said **three** callers
and named `telemetry/client.ts` as the third. **The arrow points the other way** —
verified: `telemetry/client.ts` imports only `@miolos/core`, while
`bootstrap.ts` has `import { markSessionReady } from "../telemetry/client";`. It
is a callee, not a caller, and the grep matched only `bootstrap.ts`'s own comment.
In a section whose whole point is enumerating correctly, the direction has to be
right.)* The item's own text is *"Since
#149 **six** readers await it (`useAttachState`, `useStreak`, `useMedals`,
`useStats`, `useStatsCalendar`, `useOnboardingState`)"* — `usePushState` (#145,
ADR-0064) is missing, and it awaits with the same shape and lineage
(`void ensureSession().then(() => fetchNotificationsState())`). This is
load-bearing, not bookkeeping: the item exists to tell a test author which suites
depend on the singleton resolving, and a suite mounting the push prompt card is
one of them.

**Write the number that will be TRUE AT MERGE:** *seven hooks await it, and since
#195 the `day-truth` store also reaches it — on the repair path only, never
before its first read.* The distinction is the point: a suite mounting the store
is at risk **only in the case whose `/day` answers empty**, which is a narrower
triage than the hooks'.

**(2) ADR-0060 consequence (a) says three credentialed GETs; it is four.**
Verified against `apps/web/app/page.tsx`'s islands. The consequence reads
*"**(a) The hub now makes three credentialed GETs on a normal view** — `/streak`,
`/day` and `/attach/state` — and **four** once Termo is done"*; `/onboarding/state`
(#35, ADR-0061) postdates the ADR and is missing. Its own closing sentence is why
this matters: *"Whether these collapse into one hub read is ADR-0051 decision 3's
trigger, which is sized against this count — **so the count has to be right**."*

**Write the number that will be TRUE AT MERGE:** *four unconditional credentialed
GETs on a normal warm view — `/streak`, `/day`, `/attach/state`,
`/onboarding/state` — five once Termo is done and `TermoDoneLink` fetches
`/stats`, and one more `/day` on a cold or re-mint load, where #195's one-shot
repair spends itself.* The recurring poll term (annotation (a)) is unchanged.

**(3) The issue's own title is an undercount too, and the closing comment must not
re-publish it.** #195 is titled *"the sixth reader #149 missed"* and its body
counts five hooks — *"exactly the case #149 fixed for `useAttachState`,
`useStreak`, `useMedals`, `useStats` and `useStatsCalendar`"*. With `usePushState`
(#145, ADR-0064) the true figure is **seven hooks plus the store = eight
readers**, which is the number this plan uses throughout and which correction (1)
above proves. The store is the **eighth** reader, not the sixth. Say so when
closing #195; do not repeat "sixth".

All three are the **same class of error as the one that created this ticket** —
an enumeration trusted instead of re-derived — which is why they belong here and
not in a follow-up. **Step 4 found a fourth instance inside this very section**
(§7.2's annotation letters, wrong by two) and a fifth in §2 (the "ten places"
count, wrong by 20). The lesson is not "these three records were stale". It is
that **every enumeration in this PR is re-derived by command at step 5, including
the ones this plan already re-derived**, and §9 carries the commands.

---

## 8. Residuals, named

An index, not a second copy: each row's argument lives in the ADR-0072
consequence it names, and the ADR is the record that ships.

| | The residual | Bounded by | ADR-0072 |
|---|---|---|---|
| **R1** | The repair's own `refresh()` is swallowed by an unrelated trigger taking the guard in the microtask gap. ADR-0070 consequence (i)'s family; the swallowing trigger is itself a `GET /day` | self-healing | (f) |
| **R2** | A mid-session cookie expiry is not repaired — the store already holds a truth, so `payload === undefined` is false | deliberate; `remintSession()` is not for read paths | (g) |
| **R3** | An offline load spends the one-shot on a second failing `/day` | one per page load | (c), (j) cause 4 |
| **R4** | **A hung mint permanently burns the one-shot, and `remintSession()` can strand it.** The flag is set *before* the await — correctly, that is what bounds the chain — so a hung `POST /session` leaves the repair's `.then` never running with the one-shot spent. And `remintSession()` **replaces** the cached promise (`pending = attempt.then(() => undefined);`), so a later re-mint from `play/sync.ts` or `termo/guess-client.ts` can land a working identity while the store still awaits the dead one. Ships because the fix is the (e-narrow) machinery §2 rejects | the 60 s poll, ≤ 60 s | (k) |
| **R5** | **An early transient failure disarms the repair for the real case** — a first `/day` failing for (j) cause 3 or 4 spends the one-shot before the mint race matters | one per page load | (j) |

**Unmeasured, and labelled as such wherever it appears**: whether either hub wave
moves layout at paint (§5), and ADR-0072 consequence (h)'s `detect` behaviour.
Neither enters a record as an assertion.

---

## 9. Exit criteria — mechanical and checkable

Every one of these is a command with output, or a file that either has the row
or does not.

1. `pnpm typecheck` green, output pasted. `strict: true`, no new `any`, no
   `@ts-ignore`.
2. `pnpm lint` green, output pasted.
3. `pnpm test` green, output pasted. Acquire `scripts/gate-lock.sh acquire "195"`
   before the full-suite run and release after.
4. `apps/web/test/day-truth.test.tsx` passes **with no edit to any existing
   assertion** — only the header paragraph and `T-WEB-S347` are added (§6.1/§6.2).
   A moved count means the implementation deviated from §4.
5. **Four neighbouring files green, each run and pasted SPECIFICALLY** (§6.4):
   `apps/web/test/nonogram-motif-name.test.tsx` (one extra request predicted
   inside it), **`apps/web/test/conclusion-view.test.tsx`** (54 cases, no
   `vi.resetModules()`, file-wide 401 stub — the one-shot is spent once for the
   whole file), **`apps/web/test/telemetry-lifecycle.test.tsx`** (the
   `markSessionReady` reach, ADR-0072 consequence (m)), and
   **`apps/web/test/day-client.test.ts`** (`T-WEB-S234`, the check §2 made
   load-bearing against candidate (c)). Any that moves means the implementation
   deviated from §4.
6. The mutations run and reported. **Each must be one the shipped assertion can
   actually observe** — a mutation chosen in advance that cannot bind is worse
   than none, because it comes back green and is read as proof:
   - (i) replace `refresh()`'s body with `await ensureSession()` before the fetch
     → `T-WEB-S345` red.
   - (ii) **delete the `!mintRepairSpent` condition from the `finally`** →
     `T-WEB-S346`(a) red (every empty answer repairs, so the count reaches three
     or more). *(Step 4 replaced this criterion. It read "move
     `mintRepairSpent = true` after the mint resolves", which is **undetectable by
     construction**: the second `finally` is at minimum one task behind the mint's
     `.then` body, so under either placement — before or after the inner
     `refresh()` — the flag is already set when the second `finally` reads it.
     Two GETs, green. It would have been a napkin § Execution 10 "unbindable, not
     untested" survivor that the plan predicted red. The one-shot bound **is**
     bindable; this is the mutation that binds it.)*
   - (iii) delete `vi.resetModules()` from `day-truth.test.tsx`'s `beforeEach` →
     `T-WEB-S347` red.
   - (iv) add a static top-level import of the store to that file →
     `T-WEB-S347` red.
   - (v) add a `jsonResponse(401, {})` stub to that file → `T-WEB-S347` red
     (§6.2's third assertion).

   Run each, **then** classify — never classify in advance. Any survivor is
   *untested* or *unbindable* (napkin § Execution 10's #149 converse); say which,
   in the PR, with the run.
7. **`npx impeccable detect`: applies, and runs as the CI `Impeccable` workflow
   on the preview — no local run is owed.** Reason, stated rather than assumed:
   the diff adds no element, no style rule and no string, so there is nothing a
   local file-mode scan could see that the preview scan cannot; and the repo's
   detect gate is the `deployment_status` workflow, not a local command. Evidence
   for the PR body is the pair *"both viewport steps ran, exit 0, silent"* plus
   the run's own conclusion — never a grep for a success string, since a clean
   run prints nothing (napkin **§ Execution 8**, *"`impeccable detect` is
   per-viewport AND data-dependent"*, whose workflow comment is the silent-green
   one, and **§ Shell & Command Reliability 8**, *"Vitest's DEFAULT reporter
   suppresses `console.*` ENTIRELY — greping a plain `vitest run` for a log line
   reads a silent channel"*). *(Step 4: this cited § Execution 3, which is
   *"A vitest timeout sized off an ISOLATED local run under-shoots CI by 4-9x"* —
   a different item entirely. Every other napkin citation in this plan was checked
   at step 3 and stands.)* Read it with
   `gh run list --workflow=impeccable.yml`, then `gh run view <id> --log` filtered
   by step name.
8. **Bundle figures for `/`, measured before and after**, published in the PR body
   (napkin § Domain 3). Expected zero — `bootstrap.ts` is already in every route's
   client graph — but the figure is measured, not asserted.
9. **`docs/README.md` gains two rows in the sequenced-artifacts table**, appended
   in number order after `adr/0071-…`: one for
   `plans/072-issue-195-plan-day-truth-mint-order.md` and one for
   `adr/0072-…` — **and only those two**, staged hunk by hunk, because the working
   tree already carries a foreign `plans/073-…` row from the #74 stream (§6.5).
   *Napkin § Parallel-Stream 1: a missing `docs/README.md` row was a blocking
   review finding in four consecutive PRs. It ships in the same change, not
   after.* The plan-072 row itself was **corrected at step 4** on two counts —
   "annotations (h) and (i)" → **(j) and (k)**, and "ten exact non-URL-filtered
   call counts" → **30 across 11 of 18 cases**. Re-read it before staging.
10. **ADR-0072 flips `Proposed` → `Accepted`** in the implementing PR's own diff,
    dated the expected merge day, citing that PR.
11. **ADR-0060 carries the reciprocal `**Amended by:** [ADR-0072](…)` header line
    AND both in-place annotations, in the same docs commit as ADR-0072's
    `**Amends:**` line.** Not in a later commit, not in the PR body (napkin
    § Execution 4). **Re-derive the letters before writing them — do not trust
    §7.2, which was itself wrong once:**

    ```
    grep -oE "Annotation \([a-z]\)" docs/adr/0060-*.md | sort -u | tail -1
    ```

    Expected `Annotation (i)`, so this ticket writes **(j)** and **(k)**. If the
    command answers anything else, a sibling stream landed an annotation first:
    take the next two free letters and correct §7.2, §7.1's `**Amends:**`
    paragraph and the `docs/README.md` row together. Paste the command output in
    the PR.
12. **`.claude/napkin.md` § Domain 7 reads seven**, names `usePushState`, names
    the **two** non-hook callers (not three — `telemetry/client.ts` is a callee,
    §7.3), and carries the store's narrower triage.
13. **ADR-0060 consequence (a) reads four**, names `/onboarding/state`, and states
    the cold-load fifth (§7.3).
14. **`docs/agents/test-ids.md` reconciled at step 8**: `T-WEB-S344…S347` recorded
    as spent, **`S348` recorded as burned (folded into `T-WEB-S346`(c), §6.3)**,
    `S349`/`S350` recorded as burned if unspent, the `T-WEB` row moved to the true
    maximum, and **the #74 collision and its resolution recorded in the
    allocation paragraph** (§6.6 — napkin § Parallel-Stream 6 keeps both
    paragraphs). Re-derive by grep, never from memory.
15. **The test-id reservation `T-WEB-S344…S350` is posted as a comment on issue
    #195 before step 5**, naming the #74 collision and its resolution (§6.6). Not
    by this plan's author.
15a. **The closing comment on #195 says the store is the EIGHTH reader, not the
    sixth** (§7.3 correction 3). The issue title stays as filed; the comment
    corrects the count.
16. `docs/pending-fernando.md`: **nothing is added.** This ticket surfaces no
    credential, production action, legal question or product-scope call. State
    that explicitly in the PR body, per CLAUDE.md's *"If nothing needs him, say so
    explicitly."*
17. PR body names the tier (**Tier 2**) and carries the six step-6 lenses'
    findings, each either applied or dismissed **with a written reason**.

---

## 10. What this plan could not settle

- **Whether either hub wave moves layout at paint.** Deliberately not settled and
  deliberately not asserted (§5). The decision does not rest on it.
- **The exact microtask interleaving in `day-truth-mint-repair.test.tsx` between
  `vi.mock`'s hoisting and per-case `vi.resetModules()`.** Step 1 §9 flags it;
  it needs a real run at step 5, not an argument.
- **Whether ADR-0070 consequence (h) needs a one-line annotation.** This plan
  argues it does not (§7.1 consequence (e)) and records the argument so a step-6
  lens can check it rather than re-derive it. If the lens disagrees, the remedy is
  an annotation, not a redesign.

---

## 11. Deviations at step 5

Appended by the implementing session (napkin § Execution 4). The design shipped
unchanged; these are the places where reality did not match the plan's text.

1. **Exit criterion 6(ii) binds as a WORKER CRASH, not as a count.** The plan
   predicted deleting the `!mintRepairSpent` condition would red `T-WEB-S346`(a)
   because *"the count reaches three or more"*. Measured, it does something
   worse and more instructive: with `/day` answering 401 on every call, the
   repair re-arms on every empty answer and the chain is unbounded **inside the
   microtask queue**, so `setTimeout(0)` never fires and the vitest worker dies
   (`[vitest-pool]: Worker forks emitted error … Worker exited unexpectedly`,
   5 passed → 1 passed). The mutation **binds** — that is a red, and only
   `T-WEB-S345`, which never reaches the repair arm, survives it — but the
   signal is a crash rather than an assertion, and the fact it exposes belongs
   in the record: **the one-shot is not bounding an extra request, it is
   bounding an infinite loop.** §4 point 4's *"bounded at length two"* is the
   property that matters, and it is stronger than the plan realised.
2. **All five mutations bound; there are no survivors to classify.** (i) reds
   `T-WEB-S345` at `expect(ensureSession).not.toHaveBeenCalled()` and reds
   `S344` and `S346` besides; (ii) above; (iii), (iv) and (v) each red
   `T-WEB-S347` on their own assertion, by name. Criterion 6's *"classify the
   survivors"* clause therefore has nothing to discharge.
3. **The bundle delta for `/` is +0.1 KB raw and 0.0 KB gzip, not exactly
   zero** (840.5 → 840.6 raw, 226.7 → 226.7 gzip). The plan expected zero
   because `bootstrap.ts` is already in every route's client graph via
   `SessionBootstrap`; that is confirmed — the tenth of a kilobyte is the new
   import statement and nothing else — but the measured figure is the one
   published, per napkin § Domain 3.
4. **`T-WEB-S347`'s comment stripper is a THIRD local copy**, not a shared
   helper. `nonogram-motif-name.test.tsx` carries `withoutComments` and
   `test/css-source.ts` carries its own `stripComments`; extracting all three
   is a cross-file refactor this ticket did not plan and does not need. Stated
   here so a step-6 quality lens rules on it rather than discovering it.
5. **`pnpm build` did not dirty `apps/api/next-env.d.ts`** on this branch, so
   the `git checkout` the plan's environment note prescribes was a no-op. Left
   in the runbook; it costs nothing when it is unnecessary.
6. **ADR-0072's `**Status:**` line cites PR #203, which is a PREDICTION.** The
   implementing session commits and pushes the branch but does not open the PR
   (203 was simply the next free number: 202 was the highest issue-or-PR at the
   time). Whoever opens it **checks the real number and corrects that one line**
   before merge. `docs/agents/domain.md`'s lifecycle wants the citation to be a
   fact, and this is the only place in the diff where it is not yet one.
