# Plan 057 — issue #35, M4 Onboarding

**Tier 2** (ADR-0058): new surface, schema change, new API contract, an ADR.
The eight steps unchanged. This document is steps 1–2 **as revised at step 4**
against the step-3 review (`ACCEPT WITH FIXES`, three blocking findings). Every
finding's disposition is in §14; where the revision contradicts the original
draft, the revision is what step 5 builds. **Two figures the original stated
were wrong and are corrected throughout: the mobile slack (§4) and the count of
budgeted routes (§1.5, §8, §12).**

**Worktree** `/home/ferna/projects/miolos-35`, branch `feat/35-onboarding`,
based on `main` at `6b81cae`. The branch has **not been pushed** — §9 step 0
depends on that still being true.

**Issue:** https://github.com/fernandolisboa/miolos/issues/35

> A first-time visitor understands the ritual in seconds and is playing
> immediately: a calm, skippable first-visit introduction — the four dailies,
> the streak, the midnight flip — with no account wall anywhere (ADR-0003).
> Per-game rules already live where each game is played; onboarding sells the
> ritual, not the rules.

Acceptance, verbatim:

1. First visit shows the introduction once; it is skippable and never blocks
   reaching a puzzle.
2. Returning visitors never see it again (per identity, surviving
   attach/merge).
3. Copy is pt-BR, externalized; design fits the editorial system;
   `npx impeccable detect` green.
4. Reduced-motion preference respected in any onboarding animation.

---

## 0. Numbering taken

- **Plan `057`.** `054` is the highest on disk (`docs/plans/054-triage-the-open-tracker.md`);
  `055` and `056` are taken tonight by #126 and #83. `057` is the next free.
  Its `docs/README.md` row ships in this PR (§10 R1).
- **ADR `0061`.** `0058` is the highest on disk; `0059` and `0060` are being
  taken tonight. **Re-derive with `ls docs/adr | tail -3` at step 5 and take
  the next genuinely free number** — this reservation is a snapshot, and the
  two siblings may land in either order.

---

## 1. What the exploration found that changes the shape of this ticket

Five facts, each of which would have produced a wrong plan if missed. They are
stated up front because the decisions in §2–§7 are downstream of them.

### 1.1 There is already a shipped, nine-file precedent for exactly this feature

`users.attach_prompt_dismissed_at` (#21, ADR-0050 decision 9) is a per-identity
"the player has done X once" fact, stamped server-side, read back through a
one-boolean endpoint, and rendered by a dismissible in-flow paper card on the
hub. Its stack:

| Layer | File |
|---|---|
| Column | `packages/db/src/schema.ts` → `attachPromptDismissedAt` |
| Migration | `packages/db/migrations/0004_optimal_roulette.sql` |
| Service | `apps/api/src/attach/service.ts` → `dismissAttachPrompt`, `getAttachAccountState` |
| Read route | `apps/api/app/attach/state/route.ts` |
| Write route | `apps/api/app/attach/dismiss/route.ts` |
| Contract | `packages/core/src/contracts/attach.ts` → `attachStateResponseSchema`, `attachDismissSchema`, `attachDismissResponseSchema` |
| Client transport | `apps/web/src/attach/attach-client.ts` |
| Hook | `apps/web/src/attach/use-attach-state.ts` |
| Island | `apps/web/app/hub-attach.tsx` + `hub-attach.module.css` |

**This plan builds the same nine layers for onboarding.** Nothing below is a
new pattern; where it departs from the attach stack it says so and why.

The schema comment on `attachPromptDismissedAt` also states the reason this
design exists at all, in words this ticket reuses without change:

> the prompt's one lifecycle per account **survives cleared site data** — the
> exact user the feature serves.

That sentence is the answer to "why not `localStorage`", and it is stronger
here than it was there: the acceptance says *per identity, surviving
attach/merge*, and a device store survives neither.

**The precedent is defective in exactly the respect AC 2 names, and the
original draft leaned on it without noticing** (step-3 finding B-3).
`packages/db/src/merge.ts` has **no statement for `attachPromptDismissedAt`** —
statement 6 (`:267-286`) nulls only the four identity handles, and nothing
folds the column onto the winner. So a player who dismissed the attach prompt
on device A, attaches an email on device B and merges **gets the attach prompt
back** whenever the winner's column is NULL. The schema comment at
`schema.ts:57-70` answers the tombstone question and is silent on the
merge-forward one.

The nine layers below are still the template for the nine this ticket builds.
What is **not** inherited is the merge behaviour: this ticket writes the merge
duty the precedent never had, and closes the precedent's own gap in the same
statement (D2). The gap is filed as a tracker issue in its own right —
**[#134](https://github.com/fernandolisboa/miolos/issues/134)** — so it survives
as a record even if step 5 takes the fallback in D2.

### 1.2 `apps/web` never reads the session cookie — the fact is unreachable at render

`grep` for `miolos_session` / `cookies()` in `apps/web` returns **zero hits**
in shipped code. `apps/web` reaches the database only through the narrowed
root `@miolos/db` entry for *public content* (ADR-0014), and every
user-specific server fact is fetched from `apps/api` by a client island
(ADR-0031 decision 4; ADR-0048 decision 4). `/` is a `force-dynamic` **server**
component and cannot take `"use client"` (CSS Modules hash per file — which is
precisely why `hub-streak.tsx`, `hub-day-state.tsx` and `hub-attach.tsx` exist
as separate files beside `page.tsx`).

**Consequence:** the onboarding surface is a client island that fetches on
mount. There is no server-rendered variant available, and asking for one would
mean widening ADR-0014's direct-read scope — which ADR-0031 decision 4
explicitly refuses to do.

### 1.3 On a genuinely first visit there is no user row yet, and that is a race this ticket must close

`RootLayout` → `<SessionBootstrap />` → `ensureSession()`
(`apps/web/src/session/bootstrap.ts`) → `POST /session` → `mintSession` does
`db.insert(users).values({}).returning()`. **The user row exists only after a
post-hydration round trip.** `requireUserId` never mints.

A naive mount-effect fetch — the `useAttachState` shape copied literally —
races that mint and takes the 401 branch on the one visit the whole ticket is
about. The attach prompt does not care (it needs streak ≥ 5, so the account is
weeks old); **onboarding cares more than any surface in the repo.**

The fix is already built and already has two callers. `bootstrap.ts`'s header:

> extracted from `components/session-bootstrap.tsx` so the completion flush can
> await the same mint (plan 017 §9.2). Without that ordering, a fast solve on a
> cold first visit reliably races the in-flight mint and takes the 401 branch.

`ensureSession()` is a module-level shared promise, fire-once per page load,
StrictMode-safe, and never rejects. `apps/web/src/play/sync.ts:174` and
`apps/web/src/termo/guess-client.ts:149` both `await` it. **The onboarding hook
awaits it too** (D6). This is the single most important mechanical decision in
the plan.

### 1.4 The credentialed call is anonymous on every `*.vercel.app` preview

ADR-0048's rejected section, measured and recorded:

> on `*.vercel.app` previews EVERY credentialed call is anonymous either way
> (the cookie is `SameSite=Lax` and `vercel.app` is on the Public Suffix List,
> so preview web→api is cross-site and the Lax cookie neither travels nor
> sets).

So on a preview deployment `GET /onboarding/state` 401s and the card renders
nothing — exactly as `HubAttach` does today. **The CI `impeccable detect` job
therefore scans `/` *without* the onboarding card**, at both viewports, and its
green is evidence about the hub, not about this ticket's surface.

This is not a defect to route around; it is the shipped preview reality for
every authenticated surface. It has two consequences this plan owns:

- The visual gate for the card itself is a **`file://` fixture scan** over the
  real component markup plus the real stylesheets and the real `@font-face`
  rules, at both viewports, read as a **delta** against the same fixture without
  the card — the **plan 043 §11** procedure (`docs/plans/043-issue-96-plan-archive-done-chip.md:1021-1119`),
  executed there for the archive done chip for the same reason. §8 states it in
  full, including the proof-of-life clause the original draft dropped.
- **Fernando cannot see this feature on a preview deploy.** This is the **first
  line of the PR body**, not a consequence a reader assembles (§8's PR-body
  template). Locally the flow does work end to end: `localhost:3000` →
  `localhost:3001` is same-site for `SameSite=Lax` purposes, so `pnpm dev` shows
  the real thing — and **that, screenshotted at both viewports, is the strongest
  evidence available**, ahead of the fixture. The PR body carries both.

### 1.5 `/` is the client-JS budget's denominator, and this ticket grows it

`apps/web/scripts/route-client-js.mjs` measures every budgeted route as
`entry.raw - home.raw`. `/` has no budget of its own; it is the baseline. The
script's own doc comment:

> the DELTA can move on a ticket that touches no grid route at all: #19 grew
> `/` (the BASELINE, hub-streak) AND the game routes … #34 then moved all three
> UP by ~2.0 KB … WITHOUT TOUCHING A GRID ROUTE.

Current headroom, re-measured at #96: binairo **35.4**, sudoku **31.6**,
nonogram **37.5** KB against a 40 KB budget — *"the noisiest clean route has
2.5 KB of slack, not 20."*

**Growing `/` makes all 20 budgeted deltas shrink and every budget look
healthier. That is not headroom.** §8 says exactly what this ticket owes.

**The number is 20, not 23** (step-3 finding F-2). `BUDGETED` in
`apps/web/scripts/route-client-js.mjs:204-273` has exactly **20** entries. The
script *prints* a delta for every route in the stats file, which is more than 20
and includes `/privacidade`, `/vincular` and `/_not-found` — so "23" was a count
of printed rows wearing the words "budgeted routes". The correction binds in
three places: here, §8 and §12 landmine 6, and the PR body quotes it in those
words.

---

## 2. D1 — Where "seen onboarding" lives

**Decision: a nullable `timestamptz` column `users.onboarding_seen_at`.**
NULL = never seen; a timestamp = the moment the introduction was acknowledged
and it never returns.

```ts
// packages/db/src/schema.ts, in the users table, beside attachPromptDismissedAt
onboardingSeenAt: timestamptz("onboarding_seen_at"),
```

### Why a column and not a table

A separate table (`onboarding_views`, or a generic `user_flags`) buys nothing
and costs three things. ADR-0049 decision 6 makes `mergeAccounts` "the single
place account-scoped tables acquire merge duties" and decision 4's tombstone
rule requires that **no row of any account-scoped table keeps referencing the
tombstone** — so a new table would need a union statement *and* a delete
statement, plus a join on every read. A column on the row that already exists
needs one `UPDATE` and no join. `hint_grants` and `medal_grants` are tables
because they are multi-row per user; this fact is one bit per user forever.

### Why a timestamp and not a boolean

1. **It is the repo's shipped idiom for this exact class.** `email_verified_at`,
   `recovery_consent_at`, `reminder_consent_at` and `attach_prompt_dismissed_at`
   are all timestamp-only with NULL = not-yet. ADR-0022's consequence records
   the reasoning: *"the flag is derivable, the timestamp is the evidence."*
2. **It makes the merge rule identical to every other merge rule in the
   codebase.** Completions dedupe earliest-wins (ADR-0026/ADR-0049 decision 2);
   curated medal grants dedupe earliest-wins (ADR-0009, ADR-0052). A boolean's
   merge would be `OR` — correct, but a fourth idiom for the same semantics.
3. `LEAST` over a timestamp expresses "if either side has seen it, the merged
   identity has" **and** keeps the honest date, at no extra cost.

### D2 — What `mergeAccounts` must do with it

**A new statement 5d in `packages/db/src/merge.ts`, between the medal-grant
block (5b/5c) and the tombstone-emptying UPDATE (statement 6).** The shape is
statement 5b's `least()` idiom, adapted from a conflict arm to a
self-join `UPDATE` — and it carries **two columns, not one** (step-3 finding
B-3): `onboarding_seen_at`, which this ticket introduces, and
`attach_prompt_dismissed_at`, which has been shipped and unmerged since #21
([#134](https://github.com/fernandolisboa/miolos/issues/134)).

```sql
update users w
   set onboarding_seen_at =
         least(w.onboarding_seen_at, l.onboarding_seen_at),
       attach_prompt_dismissed_at =
         least(w.attach_prompt_dismissed_at, l.attach_prompt_dismissed_at),
       updated_at = now()
  from users l
 where w.id = ${winnerId}::uuid
   and l.id = ${loserId}::uuid
   and (
         (l.onboarding_seen_at is not null
          and (w.onboarding_seen_at is null
               or l.onboarding_seen_at < w.onboarding_seen_at))
      or (l.attach_prompt_dismissed_at is not null
          and (w.attach_prompt_dismissed_at is null
               or l.attach_prompt_dismissed_at < w.attach_prompt_dismissed_at))
       )
```

**Why both columns, in the statement this ticket was already writing.** They are
twins: two once-per-account `timestamptz`es on `users`, NULL = not-yet, each
read back through a one-boolean endpoint, each rendered by a dismissible in-flow
card on the hub. Merging one and not the other would leave the tree carrying two
identical facts with opposite merge behaviour and nothing explaining the
asymmetry — the falsified-record failure napkin item 5 exists to stop. The cost
is one extra `least()` and one extra `OR` arm in a guard already being written,
plus one test arm. This is not scope creep; it is the same statement.

Because both columns ride one `SET`, the guard is an **`OR` over the two
per-column conditions**, and `least()` on the column whose arm did not fire is a
no-op: `least(x, NULL) = x` and `least(x, y≥x) = x`. The statement therefore
never moves a value backwards, and a row where neither arm fires is not matched
at all.

**Fallback, if step 5 finds this costs more than the ~6 lines above** — a second
statement, a second migration, a merge-order question, anything: drop
`attach_prompt_dismissed_at` from 5d, leave it to
[#134](https://github.com/fernandolisboa/miolos/issues/134), and **write the
asymmetry onto `schema.ts`'s `attachPromptDismissedAt` block in this PR** naming
the issue. Silence is not one of the options.

Four properties, each load-bearing and each with a test in §7:

- **Either side suffices.** Postgres `LEAST` ignores NULL arguments, so it
  returns the non-null value when only one side has one. If the winner has
  never seen it and the loser has, the winner takes the loser's timestamp.
  **This is the semantic that actually matters**, because nothing reads the
  value (below).
- **Earliest wins.** Both non-null → the earlier survives, matching ADR-0009's
  union-and-dedupe posture and statement 5b's `least(granted_at, …)`. **Chosen
  for the evidence property and for idiom-consistency, not because a consumer
  depends on it** (step-3 finding B-4): nothing reads `onboarding_seen_at`'s
  value — `GET /onboarding/state` compares it to `null` (D5) and
  `POST /onboarding/seen` guards on `IS NULL` — and under the `is not null` +
  strict `<` guard `least()` can only ever return the loser's value anyway. The
  analogy to completions and medal grants holds for the honest-date property
  only; for those two the value *is* read, here it is not. That is why §10 folds
  the earliest-wins arm into `T-DB-S60` rather than spending an id on it.
- **Idempotent.** The `is not null` + strict `<` guard means a re-run matches
  **zero rows** and never re-bumps `updated_at`. This is not decoration:
  `T-DB-S20` is a full-state double-run snapshot and would go red without it,
  and ADR-0049 decision 5 makes idempotence the recovery mechanism for a
  transactionless multi-statement operation.
- **`updated_at` set explicitly to DB-side `now()`**, per `schema.ts`'s own
  instruction (no trigger maintains it). Note this bumps the **winner's**
  `updated_at`, where statement 6 bumps the **loser's** — both are legal, both
  are guarded, neither fires on a re-run. **5d is the first statement in
  `mergeAccounts` that writes the winner's `updated_at` at all** (step-3 finding
  B-5), so it is a new *class* of write: a future reader of a winner's
  `updated_at` now sees merge activity where before they saw only attach-confirm
  and dismiss. `schema.ts:72-79` enumerates that column's writers as a committed
  record and this ticket falsifies it — **`mergeAccounts` statement 5d joins the
  list in this PR** (§10 R8).

**The loser's own value is deliberately NOT nulled.** It is not an identity
handle, so it stays out of statement 6's `SET` — verbatim the reasoning already
written on `attachPromptDismissedAt`, and the same posture ADR-0049 decision 4
takes for the consent timestamps. The tombstone is unresurrectable because it
has no session and no handle; a timestamp on it resolves to nobody.

**Ordering rationale.** 5d reads the loser's row, so it must run before any
statement that could clear it. Statement 6 does not clear it — but placing 5d
before 6 keeps the file's existing narrative ("fold every account-scoped fact
into the winner, then empty the shell") and is crash-prefix-safe either way.

**The record ADR-0049 is owed — adjudicated at step 3, settled.** This is the
**first `users`-column merge duty in the repo.** ADR-0049 decision 6 reads
*"`mergeAccounts` is the single place account-scoped tables acquire merge
duties"*; statement 5d does not falsify it, because the duty is still acquired
in `mergeAccounts` and the sentence governs *where*, not *what*. The
falsified-record standard (napkin item 5) binds on a committed statement going
**false**, and nothing here does.

So `**Amended by:**` is **wrong** — that form is reserved for a decision that
changes or a statement that goes false (the 0033↔0047, 0031/0041↔0048,
0026↔0049 idiom). The correct record is an **in-place annotation on ADR-0049
decision 6**, one sentence, naming the new class:

> #35 added the first `users`-column merge duty (statement 5d,
> `onboarding_seen_at` and `attach_prompt_dismissed_at`); the decision's
> "tables" names the seat, not the shape of the fact.

**And the reciprocal in ADR-0061 is not owed.** The ADR-0055↔0057 reciprocal
idiom governs *amendments*; an annotation is one-way. §10 R4 is rewritten
accordingly.

### D3 — Migration, and the Neon-before-push obligation

**Yes, a migration is needed: `0006`**, generated with
`pnpm --filter @miolos/db db:generate`.

The column is nullable with no default, so every existing row satisfies it
immediately and the ALTER is instant. **That is not the hazard.** The hazard is
recorded verbatim on the sibling column:

> adding ANY users column changes the INSERT column list drizzle emits for
> every writer, `mintSession`'s `insert(users).values({})` included, so 0004
> reaches Neon BEFORE the branch is first pushed (ADR-0038 (h); preview deploys
> share the production database).

Drizzle builds INSERT column lists from the **table object**, not from the
values object. So the moment this branch's first push triggers a preview
deploy, that preview — running against the **production** Neon database —
issues `insert into users (id, email, …, onboarding_seen_at, created_at,
updated_at)`. If the column is not there yet, **every anonymous session mint in
production-adjacent traffic fails**, which is ADR-0003's named worst failure
reached through the deploy pipeline.

**Therefore: §9 step 0 applies `0006` to Neon by hand, confirms it, and only
then is anything pushed.** The branch is currently unpushed
(`git branch -vv` shows `feat/35-onboarding … [origin/main: behind 1]`, no
tracking branch of its own) — verify that is still true before starting.

**The exact ordering. No step reordered, no step skipped** (step-3 finding B-6,
which verified the hazard and tightened the procedure in three places this repo
has been burned by before):

1. `git ls-remote origin feat/35-onboarding` → **must be empty.** If it is not,
   stop and escalate: a preview may already be live.
2. Add `onboardingSeenAt: timestamptz("onboarding_seen_at")` to
   `packages/db/src/schema.ts`, beside `attachPromptDismissedAt`, with the doc
   block including its own migration note.
3. **Re-derive the migration number immediately before generating.** #83 is in
   flight tonight and may also touch the schema, so `0006` is a snapshot, not a
   reservation. Then `pnpm --filter @miolos/db db:generate`, and confirm it
   emits exactly one `ALTER TABLE … ADD COLUMN`, nullable, no default, and that
   `migrations/meta/_journal.json` gained the entry you expected and not the
   next one up.
4. `vercel env pull <abs-path-outside-repo>/prod.env --environment=production`,
   run from the app directory. **Outside the repo** — `vercel env pull` appends
   `.env*` to `.gitignore` (napkin, §Shell & Command Reliability item 2).
5. Temp script, also outside the repo, importing the **absolute** path
   `<repo>/packages/db/node_modules/@neondatabase/serverless/index.mjs` and
   running each statement split on `--> statement-breakpoint` via
   `neon(url).query(...)`. `sql.query()` returns a plain row **array**, not
   `{rows}` (#30 precedent).
6. **Verify, do not assume.** Query `information_schema.columns` for
   `table_name='users' AND column_name='onboarding_seen_at'` and paste the row.
   `\d users` is **not** available — there is no `psql` on this box, and the
   original draft's exit criterion said otherwise.
7. Delete the temp script **and** the pulled env file.
8. **Only now** `git push -u origin feat/35-onboarding`.

**`pnpm --filter @miolos/db db:migrate` must never be pointed at Neon** — the
schema's own doc block says so.

**Why production `main` stays safe between steps 6 and 8.** Production runs
`main`'s table object, which does not know the column, so its INSERT omits it
and the nullable column takes NULL; its `.returning()` projects a subset. Both
are harmless. That is what makes step 0 obviously safe rather than merely
mandated.

**The rollback, so nobody invents one.** If step 6 fails or the branch is
abandoned, the column stays in production forever. It is nullable and
unreferenced by `main`, so it is inert. This repo has no down-migration
mechanism and does not need one here.

---

## 3. D4 — The contracts

Two schemas in a new `packages/core/src/contracts/onboarding.ts`, exported from
`packages/core/src/index.ts`, in the `attach.ts` register — **strict on both
ends**, so future payload growth arrives as a new endpoint rather than an
appended field (ADR-0048 decision 3).

```ts
/** Response of GET /onboarding/state — one derived boolean, nothing else. */
export const onboardingStateResponseSchema = z.strictObject({
  show: z.boolean(),
});
export type OnboardingStateResponse = z.infer<typeof onboardingStateResponseSchema>;

/** Body of POST /onboarding/seen — the strict EMPTY object (attach/dismiss's shape). */
export const onboardingSeenSchema = z.strictObject({});
export type OnboardingSeenRequest = z.infer<typeof onboardingSeenSchema>;

export const onboardingSeenResponseSchema = z.strictObject({
  seen: z.literal(true),
});
export type OnboardingSeenResponse = z.infer<typeof onboardingSeenResponseSchema>;
```

`show`, not `seen`, on the read: the server owns the whole decision and the
client is a dumb renderer — `GET /attach/state`'s `eligible` in the same
posture. The timestamp itself **never ships to the client**; there is nothing a
client can do with it and ADR-0048 decision 3's rule is that the endpoint
serves the derived answer.

### D5 — The two routes

Both in `apps/api`, both `export const dynamic = "force-dynamic"`, both copying
their sibling's conventions exactly.

**`GET /onboarding/state`** — modelled on `apps/api/app/attach/state/route.ts`:
no OPTIONS handler (a credentialed GET with no custom header never
preflights), no origin guard, `Cache-Control: no-store` on every branch, the
whole body inside one `try` so no branch can escape without the CORS grant.
`requireUserId` first; **401 `no-session` when there is no session — never
mint.** Then one read:

```ts
const account = await getOnboardingState(db, userId);   // apps/api/src/onboarding/service.ts
return stateResponse(account !== undefined && account.onboardingSeenAt === null);
```

An unknown user id resolves `undefined` → `show: false`. Fail closed: an
identity we cannot read is never nagged.

**`POST /onboarding/seen`** — modelled on
`apps/api/app/attach/dismiss/route.ts`: `warnIfGuardDegraded()`,
`isCrossSiteWrite` → 403, `isJsonContentType` → 415, `requireUserId` → 401,
`onboardingSeenSchema.safeParse` on a literal `{}` → 400 on any key, then

```ts
await db.update(users)
  .set({ onboardingSeenAt: sql`now()`, updatedAt: sql`now()` })
  .where(and(eq(users.id, userId), isNull(users.onboardingSeenAt)));
```

Guarded on `IS NULL`, so a re-post touches zero rows, never re-bumps
`updated_at`, and never moves the recorded moment. Response
`{ seen: true }` — a literal, like `{ dismissed: true }`.

**Why a new endpoint rather than a field on `GET /streak` or `/attach/state`.**
ADR-0048 decision 3: *"Future payload growth is a NEW endpoint/contract, never
fields appended to a strict schema deployed clients parse."* An appended field
fails every deployed client's parse. Not negotiable and not re-litigated here.

**And the two endpoints are the minimum, not a split** — step 3 asked whether
they could be collapsed and answered no: a read cannot ride a write, and
decision 3 forbids appending to `/streak`'s or `/attach/state`'s strict schema.
One consequence worth stating rather than discovering: the hub now issues
**three** credentialed GETs on one visit — `/streak`, `/attach/state`,
`/onboarding/state`. Three parallel post-hydration requests to the same origin,
none blocking paint, none blocking each other. Not a defect; named so a step-6
reviewer does not have to ask.

---

## 4. D6 — The surface

### What it is

**One in-flow paper card on the hub, in the `HubAttach` slot — after the game
cards, before the secondary links.** Not a route, not an overlay, not an
interstitial, not a modal, not a carousel. A dismissible `<section>` with an
accessible name, in the hub's own register, rendering `null` until the server
says `show: true`.

*(Both of those moved at step 4: the original draft said "above the game cards"
and `<aside>`. Findings A-1 and C-1 moved the placement; finding E-3 changed the
element. See "Placement" below and D6a.)*

New island `apps/web/app/hub-onboarding.tsx` + `hub-onboarding.module.css` —
the hub's **fifth** client fragment, beside `hub-streak.tsx`, `hub-day-state.tsx`
and `hub-attach.tsx`, and for the same mechanical reason (CSS Modules hash per
file; `page.tsx` cannot carry `"use client"`).

Anatomy, all four Ateliê idioms, none invented:

| Element | Treatment | Source |
|---|---|---|
| Card | `background: var(--paper-card)`, `border: 1px solid var(--line)`, `border-radius: var(--radius)` | `page.module.css` `.card`; `hub-attach.module.css` `.card` |
| Shadow | `box-shadow: var(--shadow-md) color-mix(in srgb, var(--accent-app) 25%, transparent)` — hard, blur 0 | `hub-attach.module.css` `.card`; DESIGN.md §Shape |
| Washi tape | `aria-hidden` div, `color-mix(… var(--accent-app) 32% …)`, `border-radius: var(--radius-tape)`, rotated within ±3–5deg | `page.module.css` `.tape`; `hub-attach.module.css` `.tape`; DESIGN.md §Shape |
| Rotation | `transform: rotate(-0.5deg)` — **static, never animated** | `hub-attach.module.css` `.card`; DESIGN.md §Shape (±0.3–2.4deg) |
| Invitation line | `var(--font-display)`, italic, 550, 24px — the app's human voice. **An `<h2>`, not a `<p>`** (D6a) | `hub-attach.module.css` `.invitation` |
| Body lines | `var(--text-body)`, `var(--ink-2)` | `page.module.css` `.cardDescription` |
| Dismiss | text button, `var(--ink)` on paper with a `var(--line)` hairline, `min-height: var(--touch-target-min)` | `hub-attach.module.css` `.dismiss` |

Two entries in that table are **choices, not copies**, and step 3 was right to
say the draft implied otherwise (finding C-3):

- **Shadow at 25%.** The hub's own game cards ship `22%` — `5px 5px 0 …
  --accent 22%` on desktop (`page.module.css:100-102`, with a comment explaining
  the deliberately tokenless offset) and `var(--shadow-md) … 22%` on mobile
  (`:350-351`). The attach card and the streak stamp are both `25%`
  (`hub-attach.module.css:17-18`, `page.module.css:48-49`). All four are inside
  DESIGN.md's `0.2–0.3` band. **25% is chosen** because this is an app-accent
  surface and it joins the two other app-accent surfaces on the page, not
  because it copies the hub's register.
- **`--text-body`.** Neither hub sheet uses the token today — both write
  `14px/1.5` longhand. This card would be **its first consumer** on the hub.
  That is fine (the token is `400 14px/1.5 var(--font-ui)`, identical to the
  longhand), and it is worth knowing it is a first rather than a copy.

**Geometry, stated rather than inherited** (finding C-4). The card takes
`margin-top: var(--space-8)` and `max-width: 560px`, which is `hub-attach`'s
geometry **because it takes `hub-attach`'s slot** — below a full-width grid, a
560px left-aligned card is a sibling of the attach card in the same column, not
a fragment floating over a four-column grid. Had the card stayed above the grid,
the 32px margin would have stacked against `.games { margin-top: 52px }`
(`page.module.css:80`; 26px mobile at `:341`) and the 560px cap would have read
as a fragment on desktop. Below the grid the question does not arise, which is
one more small argument for the slot.

Accent colours a shape (tape, shadow) and never a word — ADR-0041 decision 1,
DESIGN.md §Color. Every text run is `--ink` or `--ink-2` on paper, so **no
contrast measurement is owed** and the wildcard `low-contrast` ignore in
`.impeccable/config.json` (§1.4, issue #51) cannot hide anything here. If a
step-5 revision wants `var(--accent-app)` on a word, it owes the measured ratio
in a comment before it ships.

**Anti-reference audit** (DESIGN.md §Anti-references, hard law): no gradient;
no glassmorphism; **no card inside a card** — the card's `<section>` is a
*sibling* of `<section class="games">`, not nested in it; no grey text on a coloured
background (ink on paper); no icon-above-heading tile; no mascot; **no
decorative emoji**; no diffuse shadow (blur is 0); no banned font. Text is
≥11px throughout (`page.module.css` refuses F2's 10px twice on exactly this
ground).

### Which reference frames this is designed against, and what they establish

**F1 (`f1-hoje-desktop.dc.html`) and F2 (`f2-hoje-mobile.dc.html`)** are the
relevant frames — the Hoje hub at 1440×900 and 390×844, the two viewports
`impeccable detect` scans. They are visual specs and never production code.

What they establish for a first-visit surface:

- **The register a new hub card must join**: `#FBF7EF` paper, 1px `#D8D0C2`
  border, 6px radius, a hard offset shadow in an accent at 0.22–0.25, a
  78×26px (desktop) / 54×18px (mobile) washi tape over the top edge at ±3–4deg,
  and a static card rotation in the ±0.3–0.6deg band the hub actually uses.
  **Two facts about F2 that step 3 corrected** (finding C-6): F2's links row
  holds **three** links (Arquivo, Modo livre, Estatísticas) where the shipped hub
  ships four; and F2's own tape rotations are `-3/2/-2/3`, two of which fall
  **outside** DESIGN.md `:37`'s ±3–5deg band — the shipped mobile CSS
  deliberately uses the desktop `-4/3/-3/4` with a comment at
  `page.module.css:377-378` explaining the correction. **Anything copied from F2
  is checked against the code, never taken from the frame.**
- **The app accent for anything not owned by a game**: `#9E3B2F` sealing wax,
  which F1/F2 use for the streak stamp and the promo strip. The introduction is
  about the ritual, not about one game, so it takes `--accent-app` — the same
  choice `hub-attach.module.css` already made.
- **The mobile vertical budget, which is the real constraint — and which the
  original draft overstated by more than half** (step-3 finding C-1, then
  re-measured at step 4). F2 is an 844px flex column: masthead + streak stamp,
  four stacked game rows, the centred links row, a `flex: 1` spacer, then a 64px
  dormant promo strip pinned at the bottom.

  The draft said *"the slack is on the order of 250px"*. Step 3 summed the
  frame's declared values and got **≈188px**. Step 4 **measured the frame in a
  real browser at 390×844** (headless Chrome, `getBoundingClientRect` on every
  child of the frame's flex column) and the answer is smaller still:

  ```
  page top padding                        26.0    (0    → 26)
  header  (masthead ∥ streak stamp)      109.5    (26   → 135.5)
  games   margin-top 26 + column         402.0    (135.5→ 537.5)
  links   margin-top 26 + row             58.0    (537.5→ 595.5)
  SPACER  (flex: 1 1 0%)                 162.5    (595.5→ 758)
  promo   66 + margin-bottom 20           86.0    (758  → 844)
                                         -----
                                          844.0   exactly
  ```

  **The real slack is 162.5px.** Not 250, and not the review's hand-summed 188 —
  that sum under-counted the games column by ~25px. Two further corrections
  inside the same paragraph, both from step 3 and both confirmed:

  - **`min-height: 48px` on the mobile game rows is inert.** The measured rows
    are 83.8–84.4px, so the floor never binds and quoting it as a constraint was
    misleading.
  - **The frame's slack is not the shipped page's slack, and the shipped page
    has less.** The shipped hub carries a **fourth** secondary link
    (`page.tsx:117-119`, Privacidade — F2 draws three), uses `min-height: 100dvh`
    rather than a fixed 844, and can render `<HubAttach />` in the same column.

  Now apply the corrected number honestly. **The card as drafted measures
  319.6px at 390×844** (287.6px box + its 32px `margin-top`), measured in the
  same browser over the real `tokens.css`, the real `globals.css` and the three
  real `@font-face` files. That is **~2× the entire slack**. The draft's
  *"an introduction card taller than ~140px pushes the promo strip out of the
  first viewport"* was directionally right and numerically far too generous:
  **any card this feature can plausibly ship pushes the promo strip below the
  fold.** There is no version of this surface that fits in 162.5px.

  **That is why placement carries the decision and the first-viewport question
  is not a gate on the card's height.** In the `HubAttach` slot the card's
  height is spent against the spacer and the promo strip — precisely the
  tolerance the shipped attach card already spends, and spends much harder:
  measured the same way, **`HubAttach` costs 484.8px at 390×844**, half again
  more than this card. A dormant `AdSlot` moving below the fold on the one visit
  an introduction renders is the cheapest thing on this page to spend.

  §8 still makes this a **measurement**, not a hope — but a measurement of the
  right quantity, by the right instrument (§8 item 3, rewritten).

**There is no onboarding frame, and that is by design.** The brief, section 6,
line 88: *"As demais telas — … ajustes, onboarding — são desenhadas
just-in-time nos milestones, contra o sistema vencedor."* This surface is
composed from the system rather than recreated from a frame, and it borrows the
composition of the one hub card that already exists for a non-game purpose.

### Placement: after the game cards, in the `HubAttach` slot

**This is the step-4 reversal, and it is the plan's most consequential change**
(blocking finding A-1, with C-1 pointing the same way). The card goes after
`</section>` closing the games grid and before `<nav className={styles.secondaryLinks}>`:

```tsx
      </section>

      {/* The first-visit introduction (#35, ADR-0061). In the hub's flow
          AFTER the game cards, never a modal — the same slot and the same
          rule as HubAttach, and for a reason this ticket had to learn: the
          island materialises post-hydration, after the mint and the state
          read, so anything below it moves. Above the grid that would be the
          four "Jogar hoje" links moving out from under a first-time
          player's finger, which is the one acceptance criterion this
          surface most needs not to violate. Renders null until
          GET /onboarding/state says show, so the server render and the
          pre-hydration paint are unchanged (T-WEB-S127). */}
      <HubOnboarding />

      <nav className={styles.secondaryLinks}>
```

**The argument, in full, because the draft had it backwards.**

The island is inserted **after hydration**, once `ensureSession()` →
`GET /onboarding/state` has resolved — two *sequential* network round trips. On
a cold 3G first visit that is comfortably 400–1500 ms after paint. Whatever sits
below the insertion point moves down by the card's full height at that moment —
**319.6 px at 390×844**, measured.

Above the grid, the things that move are the four "Jogar hoje" links. The player
who "ignores it and taps Jogar hoje" — the exact player the section below and
the worked-visit row 5b describe — would be tapping a link that slides out from
under their finger, on the one visit this ticket exists for. That is a mis-tap
into the wrong game or into the masthead, and a CLS regression on the app's most
important route.

The draft noticed the reflow in the *opposite* direction and correctly called it
benign: D11's *"the component returns `null` and the game cards move up. That is
an instantaneous, **user-initiated** reflow."* The words doing the work there are
*user-initiated*. **The appearance is not user-initiated, and the draft never
applied its own test to it.**

This is exactly why `HubAttach` sits after the game cards (`app/page.tsx:101`)
and why two of the four shipped comments this plan quotes say *"after the game
cards"* in those words (D7). It is not an accident of the attach ticket; it is
the shape that makes a post-hydration island safe on this page.

**What still moves, stated honestly.** In this slot the insertion shifts the
four secondary links, the spacer and the dormant promo strip. The secondary
links *are* interactive, so the cost is not zero — but they are not the "Jogar
hoje" targets AC 1 protects, and `HubAttach` already shifts exactly the same
three things, by 484.8 px, on every eligible visit. This card spends less of a
tolerance the page already grants.

**Three alternatives, named so step 5 does not rediscover them.**

- **Above the grid.** Rejected above. It is the draft's position and Fernando's
  one-line overrule (§11 F2) — with the cost now named rather than implied.
- **Reserving the card's height server-side** so nothing shifts. Rejected: a
  permanent ~320px hole above the games for the >99% of visits that never show
  the card.
- **Below the `<nav>`, in the spacer.** This shifts *zero* interactive targets —
  strictly the best CLS answer. Rejected anyway: it puts the product's
  introduction underneath the site's secondary navigation, where it reads as a
  footnote, and it departs from the only shipped precedent for this class of
  island. Named because it is the honest best-CLS option and the reason for not
  taking it is editorial, not mechanical.

**The 200 ms settle survives the move, and the draft's own coupling argument was
wrong on mechanism** (D13, re-checked). Step 3 warned the settle *"extends the
window during which the game cards are in motion under the player's finger, from
one frame to twelve."* It does not: the transition names **`opacity` and
`transform` only** — never a layout property (D13 constraint 2) — so the card
occupies its full height in flow on the **first** frame and the reflow is a
single frame whatever the duration. Twelve frames of *fading in* is not twelve
frames of motion under a finger. The settle would not have extended the mis-tap
window above the grid either; the placement moves for the reflow itself, not for
the animation. Keep the settle, in this slot, unchanged.

### How a player who ignores it still plays — exactly

Structurally, not by policy:

1. The card is **in normal document flow**. There is no scrim, no
   `position: fixed`, no portal, no `aria-modal`, no `inert`, no scroll lock.
   Nothing is covering anything.
2. **No focus is trapped, and nothing above the card moves.** Tab order is
   document order, and in this slot the four "Jogar hoje" links come **before**
   the card's single button — so a keyboard user reaches every game before they
   reach the introduction, and the post-hydration insertion cannot move a focused
   element. (Above the grid the dismiss button would have been the *first* tab
   stop on the hub. That was defensible — DOM order would still match visual
   order, no #67-class mismatch — but it needed stating, and in this slot the
   question disappears.)
3. **Nothing is covered at either viewport.** At 1440×900 the four game cards
   are one grid row above the card and fully visible with it on screen. At
   390×844 the card is below the four stacked rows, so the games are what the
   player sees first and the introduction is what they scroll to.
4. **Dismissal is not required for anything.** No route guards on it, no state
   depends on it, no other surface reads it.
5. **A player who never dismisses it sees it again next visit** and plays
   anyway. The card never becomes a condition.

The single dismiss action is the "skippable" of AC 1. There is no second
action, no "next", nothing to complete.

### D6a — The element, the accessible name, and where focus goes

Two accessibility corrections from step 3, both taken (findings E-3 and E-2).

**`<section aria-labelledby>`, not `<aside>`.** `<aside>` means *tangentially
related*. The attach prompt genuinely is tangential — an ask the player may
ignore forever. A first-visit introduction is the **primary** content of the
screen for the one visitor who ever sees it, so `<aside>` under-describes it.
Worse, `hub-attach.tsx:93` already ships `<aside className={styles.card}>` with
no `aria-label` and no heading; a second `<aside>` would give `/` two
`complementary` landmarks, one named and one not — a landmark list a
screen-reader user cannot disambiguate. The shape is:

```tsx
<section className={styles.card} aria-labelledby="onboarding-title">
  <div aria-hidden className={styles.tape} />
  <h2 id="onboarding-title" className={styles.invitation}>
    {messages.onboarding.invitation}
  </h2>
  …
```

This buys three things at **zero visual cost** — `.invitation`'s styling is
element-agnostic, and the `<h2>` gets `margin: 0` like the `<p>` did:

- a real accessible name **from visible text**, which cannot drift from the copy
  the way an invisible `aria-label` can;
- an entry in the heading outline, which today runs `h1` (the wordmark,
  `page.tsx:67`) → four `h2` (the game card titles, `:84`). A fifth `h2` after
  them skips nothing, so impeccable's `skipped-heading` rule stays quiet;
- **`messages.onboarding.aria` disappears entirely** — the copy block drops from
  six strings to five (§5), and `T-WEB-S238` asserts the accessible name comes
  from the rendered heading instead.

`hub-attach.tsx`'s own unnamed `<aside>` stays as it is: this ticket no longer
adds a second one, so it is not a regression this PR creates, and renaming a
shipped landmark is a change to a different surface. Named here rather than
silently left.

**Focus goes to the first game card's link on dismiss — it does not fall to
`<body>`.** `dismiss()` sets state, the component returns `null`, and the
focused `<button>` leaves the DOM; focus would land on `<body>` and the next Tab
would restart from the top of the document. That is a WCAG 2.4.3 focus-order
failure of exactly the class **#67** is open for, and the draft's §4 point 2
stated *"the card does not call `focus()`"* as a virtue while `T-WEB-S231` would
have **asserted** it — locking the bug into the suite. `HubAttach` has the same
defect today, which is a reason not to copy it.

```ts
// On dismiss the button leaves the DOM, so focus must be placed
// deliberately or it falls to <body> and the next Tab restarts at the
// masthead. It goes to the first game card's action, which is also the
// product intent: get out of the way and let them play.
//
// Selected by href, never by class: the CTA's class is a CSS-Modules hash.
// A comma-joined selector returns the FIRST match in document order, so
// this follows page.tsx's `gameOrder` without importing it (that const is
// module-local to a server component) and survives a reorder. Absent — a
// test rendering the island alone — nothing happens.
const firstGameLink = Object.values(playRoutes)
  .map((route) => `a[href="${route}"]`)
  .join(",");
document.querySelector<HTMLAnchorElement>(firstGameLink)?.focus();
```

`playRoutes` is exported from `apps/web/src/i18n/routes.ts:119`, and both action
variants of `HubCardAction` render an `<a href={route}>` — the pending "Jogar
hoje" link (`hub-day-state.tsx:96`) and both done tiles (`:117`, `:199`) — so the
selector resolves in every day state. Programmatic focus
following a pointer-initiated click does not match `:focus-visible`, so a touch
player sees no ring; a keyboard player lands on the first game. The alternative —
focusing the *next* element, the first secondary link — was rejected: it hands
the player the site's footer nav instead of the game they came for.

`T-WEB-S231` is rewritten accordingly (§10): it asserts focus **lands on the
first game link**, never that `focus()` is uncalled.

### D7 — Why not an overlay, and why not a route

**Overlay: rejected on repo law and on cost.** The prohibition is written in
four shipped places — `app/page.tsx:98` (*"In the hub's flow **after the game
cards**, never a modal (D15)"*), `hub-attach.tsx:6-8` (*"Quiet, in-flow paper
**after the game cards**: never a modal takeover, never floating, never
blocking"*), `conclusion-view.tsx:343-344`, and
`privacidade/delete-account.tsx:6-8` (*"No modal"*).

**Two of those four constrain *position*, not only kind** (step-3 finding C-2).
The original draft quoted them for *"never a modal"* and then placed the card
above the grid, inheriting the authority of comments that say the opposite of
its placement. With the placement corrected the departure is simply gone: this
card takes the slot those two comments describe, and it takes it on the argument
in "Placement" above rather than on their authority alone.

PRODUCT.md principle 4: *"The ritual is calm. One screen, one task; nothing
nags. The daily visit should feel like opening a notebook, not entering a
casino."* **It is principle 4, at `PRODUCT.md:34`** — `hub-attach.tsx`'s own
comment cites *"principle 3"* and is simply wrong. Quoting a known-bad citation
beside the correct one without noting it is the habit napkin item 5 exists to
stop, so this PR **fixes that one word in `hub-attach.tsx`** — a Tier 0
correction riding a Tier 2 diff (§10 R9).

And there is nothing to
build on: the repo has **no** dialog, sheet, drawer, popover, portal or
focus-trap anywhere, and no Radix / Headless UI / Floating UI / react-aria /
framer-motion in any manifest. An overlay would be the repo's first, and would
need focus management, `role="dialog"`, an Escape handler and scroll lock — all
new client JS on the one route that is the budget's denominator, to build the
thing four comments forbid.

**Route (`/bem-vindo`): rejected on architecture before product.** Redirecting
`/` → a route is the literal "blocks reaching a puzzle" failure. Not
redirecting makes it a link nobody follows. And the redirect could not be
built anyway: deciding it server-side needs the identity at render on `/`,
which `apps/web` structurally does not have (§1.2) and which ADR-0048's
rejected list refuses on a second ground — *"it forces the hub async (the
smoke-suite constraint)"*. A new route would also need three edits to
`.github/workflows/impeccable.yml` (the preflight loop and both detect
invocations) plus a `data-page` render marker, and it would acquire its own
`route-client-js.mjs` classification under ADR-0047.

### D8 — One card, no steps

**One card, ~40 words, one action.** Rationale: PRODUCT.md principle 4 (*one
screen, one task*); the content is three facts, and three facts do not need a
state machine; a stepper is gamification chrome the product has vetoed the
vocabulary of (ADR-0006); and every step costs client JS on the baseline route.
The issue itself sets the ceiling — *"onboarding sells the ritual, not the
rules"*, and per-game rules already live on the play screens.

**Settled by repo law, not a morning question** (step-3 adjudication H/F3, and
the row is gone from §11): PRODUCT.md principle 4 is explicit, the content is
three facts, and every step of a stepper is client JS on the budget's
denominator route. The three-step alternative is named and rejected here rather
than parked.

### D9 — No device storage anywhere in this feature

The fact is server-owned end to end. **No `localStorage`, no
`sessionStorage`, no cookie written by this feature.** This is not merely the
attach precedent (ADR-0050 D9, mechanically greped by `T-WEB-S136`) — it is
what AC 2 requires: `localStorage` is per-device, and a fact that must survive
attach and merge cannot live there. A hybrid "local suppressor + server truth"
was considered and rejected: it is a second source of truth for one bit, it can
disagree with the server, and ADR-0031's rejected list already refuses exactly
that shape (*"A separate `localStorage` 'done today' key … a second source of
truth for a fact the play record already holds"*).

**No new test id for this.** `T-WEB-S136` already greps sources for the browser
storage API by name; **the four onboarding files join its file list** (step-3
adjudication G-2). Widening an existing claim about the same gate takes no new
id — the `T-WEB-S100` burn precedent, cited five times in
`docs/agents/test-ids.md`. The draft's `T-WEB-S236` is not minted.

The honest cost, stated rather than hidden: a first visitor whose API call
fails sees no introduction on that visit. It appears on the next one. That is
the correct direction of failure — an unreachable server must never nag — and
it is the same rule `use-attach-state.ts` already documents.

### D10 — The hook, and the first-visit ordering

`apps/web/src/onboarding/use-onboarding-state.ts`, the `use-attach-state.ts`
shape with **one departure**: it awaits the mint first.

```ts
useEffect(() => {
  let cancelled = false;
  // The mint FIRST (§1.3). On a genuinely first visit the user row does not
  // exist until `POST /session` returns, and a bare mount fetch races it into
  // a 401 on the one visit this surface is for. `ensureSession` is the shared
  // fire-once promise `play/sync.ts` and `termo/guess-client.ts` already
  // await (plan 017 §9.2); it never rejects.
  //
  // `ensureSession` resolves whether or not a mint SUCCEEDED — it discards
  // mintSession's boolean (bootstrap.ts:49). A failed mint (env unset, 5xx,
  // offline) simply reaches the 401 branch below, which is the honest
  // absent state. Awaiting it buys ORDERING, never a guarantee of identity.
  void ensureSession()
    .then(() => fetchOnboardingState())
    .then((response) => {
      if (!cancelled) {
        setValue(response ?? null);
      }
    });
  return () => {
    cancelled = true;
  };
}, []);
```

Three honest states, verbatim from the attach hook: `undefined` — nothing
settled, render nothing, so the server markup and the pre-hydration paint agree
byte-for-byte; `null` — settled without a value (env unset, non-200, network,
parse), render nothing; a response — render only on `show: true`.

**No re-mint on 401.** `remintSession()`'s one allowance per page load exists
for a *stale* cookie on a write path that would otherwise strand a completion;
spending it on an introduction card would be a new class of identity churn for
no gain. A 401 here means "no identity yet or not any more" and the honest
answer is to render nothing.

**`ensureSession()` is imported into a module reachable from `app/page`** —
which it already is, via `SessionBootstrap` in `layout.tsx`. It adds no new
bytes to `/`; the module is already on the graph.

**Four sibling hooks have the same latent race, and this ticket names them
rather than fixing them** (step-3 finding A-2). Five hooks in `apps/web` fire a
bare mount fetch with no mint ordering, and the onboarding hook is the only one
that will not:

| Hook | File |
|---|---|
| `useAttachState` | `apps/web/src/attach/use-attach-state.ts:26-39` |
| `useStreak` | `apps/web/src/streak/use-streak.ts:32` |
| `useMedals` | `apps/web/src/medals/use-medals.ts:33` |
| `useStats` | `apps/web/src/stats/use-stats.ts` |
| `useStatsCalendar` | `apps/web/src/stats/use-stats-calendar.ts:20` |

§1.3's reasoning — *attach needs streak ≥ 5, so the account is weeks old* — is
right about the **cold first visit** and wrong about the other case. When a
returning eligible player's cookie has expired, `SessionBootstrap` mints afresh
on that load and the bare fetch races it into a 401: the eligible player sees no
attach prompt on that page load. `useStreak` has the same shape; on `/` it is
benign by luck (a first visitor's streak really is 0) but not on a re-mint load.

**This ticket deliberately does not change them.** They are shipped code, the
defect is small and real, and widening a Tier 2 surface ticket into a five-file
hook refactor is exactly the scope drift ADR-0058 §3 is a test against. The
divergence is recorded here so the next reviewer reads it as a decision rather
than an inconsistency, and a **Tier 1 successor issue** — *"four mount-fetch
hooks race the session mint on a re-mint load"*, citing `bootstrap.ts:48-51` and
the five files — is filed with this PR (§10 R10).

### D11 — Dismissal

```tsx
function dismiss(): void {
  setSeen(true);             // instant, local component state
  moveFocusToFirstGame();    // D6a — never leave focus on <body>
  void markOnboardingSeen(); // fire-and-forget POST /onboarding/seen
}
```

The card disappears on the click, before the network answers. If the POST fails
the card returns on the next visit — annoying once, never blocking, and it is
the same fire-and-forget shape `hub-attach.tsx`'s `dismiss()` already ships.
The alternative (await the POST, show a spinner, handle an error state) would
put a network round trip between a player and a button whose whole purpose is
to get out of the way.

**Layout after dismissal:** the component returns `null` and the secondary
links, the spacer and the promo strip move up. That is an instantaneous,
**user-initiated** reflow — not animated, because a height transition names a
layout property and fires impeccable's `layout-transition`. `HubAttach` does
exactly this today. *The word doing the work is user-initiated*: it is the test
this plan failed to apply to the card's **appearance** at step 2, which is what
moved the placement (see "Placement"). Nothing above the card moves in either
direction, which is what makes both reflows cheap.

**Focus after dismissal** goes to the first game card's link (D6a), not to
`<body>`. That is the one behaviour the draft got backwards and the one
`T-WEB-S231` would have asserted as correct.

---

## 5. D12 — The copy, in pt-BR, externalised from the first line

A new `onboarding` block in `apps/web/src/i18n/messages.ts`, in the `attach`
block's register and directly after it. It goes in `messages.ts` rather than
its own module: ADR-0018 makes `messages.ts` the default home, and ADR-0052's
amendment carves out only **measured bulk** copy (the 23-record medal catalog,
~2 KB, on 15 of 17 routes). This is ~250 bytes. If step 5's measurement says
otherwise, `src/medals/copy.ts` is the escape hatch and the barrel must not
re-export it.

```ts
  /**
   * The first-visit introduction (#35, ADR-0061). Sells the ritual — four
   * dailies, the streak, the virada — and nothing else: per-game rules live
   * on the play screens. Deliberately short; the card is read in seconds or
   * dismissed, and a first visitor came here to play.
   */
  onboarding: {
    invitation: "Quatro puzzles do dia, iguais para todo mundo.",
    lead: "Termo, Sudoku, Nonogram e Binairo. Resolva pelo menos um dos puzzles do dia e a sua sequência começa.",
    rollover: "A virada é à meia-noite, no horário de São Paulo.",
    noAccount: "Sem cadastro — é só jogar.",
    dismiss: "Entendi",
  },
```

Rendered, the card reads:

> *Quatro puzzles do dia, iguais para todo mundo.*
>
> Termo, Sudoku, Nonogram e Binairo. Resolva pelo menos um dos puzzles do dia
> e a sua sequência começa.
>
> A virada é à meia-noite, no horário de São Paulo. Sem cadastro — é só jogar.
>
> `[ Entendi ]`

**Four of these strings changed at step 4** (findings D-1, D-2, D-3, D-4, D-5).
Presenting Fernando a draft with known factual and house-style defects would
waste the one review that is genuinely his (§11 F4).

| String | Was | Is | Why |
|---|---|---|---|
| `invitation` | "os mesmos para todo mundo" | **"iguais para todo mundo"** | `messages.ts:109` already ships *"Um puzzle novo de cada, todos os dias, **igual para todo mundo**."* Two spellings of the daily's defining property is exactly the synonym drift `CONTEXT.md:3` forbids (D-5) |
| `lead` | "…pelo menos um e a sua sequência **continua**" | **"…pelo menos um dos puzzles do dia e a sua sequência começa"** | *continua* is **false on the only visit this card ever renders on** — a first visitor has no streak to continue; the first solve *starts* one at 1 (`streak.ts:66-72`) (D-2). And "pelo menos um" read literally pointed at the four game names, which are also the free-play and archive lineup, where solving extends nothing (ADR-0008 rule 1, ADR-0005) — so the rule carries **"do dia"** (D-3) |
| `rollover` | "no horário de **Brasília**" | **"no horário de São Paulo"** | *Brasília* is factually correct and has **zero precedent in this repo** — the only occurrences anywhere in the worktree were inside this plan. Code, docs and the glossary spell it `America/Sao_Paulo` / "São Paulo" (D-4). Flagged as a sub-choice in §11 F4: this one is style, not accuracy |
| `noAccount` | "Não precisa **criar conta**" | **"Sem cadastro — é só jogar."** | *criar conta* contradicts three shipped strings (`messages.ts:620` *"De graça, sem cadastro."*, `:763`, `:769`) and the glossary's **Vincular e-mail** (`CONTEXT.md`). Worse, `:763` tells the player *"você joga com uma **conta anônima criada** neste aparelho"* — so the product would say on one page that an account **is** created and on another that they need not create one (D-1) |
| `aria` | "Como funciona o Miolos" | **removed** | The accessible name now comes from the rendered `<h2>` via `aria-labelledby` (D6a, finding E-3). Five strings, not six |

**Why these words.**

- **41 words of prose, 42 counting the button label.** The counting rule, stated
  because the draft disagreed with itself by one and named neither: a standalone
  em dash is not a word, and `wc -w` counts it (D-7). PRODUCT.md's register is
  *editorial, warm, precise, adult*; the guide is the `attach` block's two-line
  shape, not a tour.
- **Every string is true in the state it renders in.** That is the check the
  draft did not run and `continua` failed. It is now landmine 12.
- **The three facts the issue names are each in exactly one line** — four
  dailies (`invitation` + the enumeration in `lead`), the streak (`lead`), the
  midnight flip (`rollover`).
- **Glossary-exact vocabulary** (`CONTEXT.md`, which the repo requires and which
  reviewers check): **sequência** for the streak — never "streak", never
  "ofensiva"; **virada** for the rollover — the glossary's own pt-BR term;
  **puzzle do dia** as the unit; **Nonogram**, never "Nonograma".
- **`noAccount` earns its line.** ADR-0003's promise is that the first play
  requires nothing, and a Brazilian adult meeting a new site expects to be
  asked for an email. Saying it is the difference between a claim and a
  demonstration. Verified true at step 3: `requireUserId` checks a cookie and
  nothing else, and no email gate exists in `apps/api`'s streak, stats, medals or
  archive paths.
- **Every string is composed in the module, never joined at a call site** —
  ADR-0018. The static-string precedents are `messages.ts:1105`, `:437` and
  `:668-669`; `messages.hoje.streak.aria` is **not** one of them (it is a
  `(count: number) => string` function, D-7).
- **`dismiss: "Entendi"`** — an acknowledgement, not fake navigation. The hub's
  own discipline is that a control that does not navigate must not look like
  it does (`.cta[href] { cursor: pointer }`). `HubAttach`'s lowercase
  `"agora não"` is a *deferral* and the wrong verb here. `"Começar"` was
  considered and rejected: the button starts nothing. **Not a separate morning
  row** — it is one of the five strings and lives inside §11 F4.
- **No emoji, decorative or otherwise** — DESIGN.md anti-references, hard law.
- Verified at step 3 and not to be churned: "puzzles" (not *quebra-cabeças*) is
  the shipped word, 8 occurrences; the game order `Termo, Sudoku, Nonogram e
  Binairo` matches `messages.ts:109`; terminal periods on sentences and none on
  the CTA label is house style; none of the five strings trips
  `FORBIDDEN_EVERYWHERE` in `route-client-js.mjs:369`.

**Copy is a Fernando decision (§11 F4).** These strings are a draft written in
the product's voice from `PRODUCT.md` and the shipped `attach`/`confirm` copy;
they are not a proposal he has to accept. They are here in full so he can edit
them in place.

---

## 6. D13 — Reduced motion

**What animates:** exactly one thing — the card's entrance, when the state
settles after hydration. `opacity: 0 → 1` and `transform:
rotate(-0.5deg) translateY(2px) → rotate(-0.5deg)`, over
`var(--duration-base)` (200ms) with `var(--ease-settle)`. That is DESIGN.md's
*tinta que assenta* at its smallest: an element settling into place, 150–250ms,
no bounce.

**Nothing else moves.** The static `rotate(-0.5deg)` is decoration, not motion
(`page.module.css`: *"Rotations are static transforms, never animation"*).
Dismissal is instant (D11).

**The one rule contact, quoted with its qualifier so no reviewer re-derives it**
(step-3 finding C-5). DESIGN.md `:38` says card rotations are *"static — never
animated **per interaction**"*. A mount settle is not a per-interaction
animation: it fires once, when the island's state settles, and never again for
the life of the page. The rotation itself is not what animates — it is held
constant through the transition and through the reduce block below.

**And this is settled, not a morning question** (step-3 adjudication H/F5, and
the row is gone from §11): it is free either way, invisible in the diff, and it
has no product consequence in the `HubAttach` slot. Ship the settle with its
reduce block. The draft coupled this to placement — *if F2 is overruled to
"above", drop the settle* — and that coupling is **withdrawn**: the transition
names no layout property, so it cannot extend a reflow window at any placement
(see "Placement").

**What it degrades to:**

```css
@media (prefers-reduced-motion: reduce) {
  .card {
    /* The rotation is decoration and stays; only the settle is stood down.
       Dropping the transform outright would un-rotate the card, which is a
       different design, not a calmer one. */
    transform: rotate(-0.5deg);
    transition: none;
    animation: none;
    opacity: 1;
  }
}
```

The card simply is where it is going to be, at full opacity, on the first frame
after the state settles. Four mechanical constraints, all satisfied and all
asserted in §7:

1. **The block lives in `hub-onboarding.module.css`.** CSS Modules hash per
   file, so no other module's reduce block can reach these classes. Every
   shipped module with a transition carries its own (`hub-attach.module.css`,
   `screen.module.css`, `conclusion-view.module.css`, and six more).
2. **The transition names only `opacity` and `transform`** — never `width`,
   `height`, `padding` or `margin`, which fire impeccable's
   `layout-transition`.
3. **No `@keyframes`**, so the `/bounce|elastic|wobble|jiggle|spring/i` name
   ban cannot be tripped. `--ease-settle`'s `1.05` is inside impeccable's
   allowed `[-0.1, 1.1]` band.
4. **`page.module.css` is not touched.** It has zero animation today and keeps
   it; adding a dead reduce block there would be exactly what plan 007 refused
   (*"State this in the PR rather than adding dead media queries"*).

A defensible alternative — **no entrance transition at all**, which makes AC 4
vacuously true and adds zero CSS — was considered. Rejected because a card
appearing with no transition after hydration is a visible jolt on the calmest
screen in the product, and because the acceptance criterion clearly anticipates
that something moves. It stays a one-line change in either direction, forever.

---

## 7. D14 — The no-account-wall guarantee, mechanically

ADR-0003's decision is that **the first play requires nothing**. This surface
holds that in five specific ways.

1. **It asks for nothing.** No email field, no name, no consent checkbox, no
   choice. One button whose only effect is to make the card go away. Compare
   `HubAttach`, which is the surface that *does* ask, and does so only at
   streak ≥ 5.
2. **The anonymous identity is created by the existing bootstrap, not by this
   flow.** `SessionBootstrap` in `layout.tsx` already runs on every route
   including `/`; this feature adds no mint, no second identity path, and
   crucially **does not call `POST /session` itself**. It awaits the mint the
   layout already started (D10). Adding a second minter would risk the
   two-cookieless-mints class `bootstrap.ts`'s header describes at length —
   the identity-overwrite failure ADR-0003 calls the worst the product can
   produce.
3. **If the identity does not exist yet, the introduction is absent, not
   blocking.** `requireUserId` never mints; a 401 resolves the hook to `null`
   and the card renders nothing. The hub is fully playable in that state, as it
   is today.
4. **If the identity write fails, nothing is gated.** `dismiss()` hides the card
   on the click and the POST is fire-and-forget. A failed POST costs the player
   one more sighting on a later visit. There is no retry loop, no error state,
   no blocking spinner, and no path on which a failed write leaves a control
   disabled.
5. **Nothing anywhere reads this fact except this card.** No route guard, no
   redirect, no middleware. `onboarding_seen_at` has exactly two writers (the
   POST route and merge statement 5d) and exactly one reader (the GET route) —
   and the reader compares it to `null` and never ships the value (D2, D4).

**Worked first visit, end to end:**

| # | What happens |
|---|---|
| 1 | Cold browser, no cookie. `/` renders on the server: masthead, streak stamp at 0, four pending game cards, links, promo zone. **No onboarding markup** — the island renders `null` before hydration, so `T-WEB-S17`/`S127` hold. |
| 2 | Hydration. `SessionBootstrap` calls `ensureSession()` → `POST /session` → `mintSession` inserts the `users` row (`onboarding_seen_at` NULL) and the session row; `Set-Cookie: miolos_session`. |
| 3 | `useOnboardingState` awaits that same shared promise, then `GET /onboarding/state` with `credentials: "include"` → `{ show: true }`. |
| 4 | The card settles in **after** the game cards (200ms fade, or instantly under reduced motion). The player can already play — steps 1–3 changed nothing about the game cards, and the insertion moves only the secondary links, the spacer and the dormant promo strip. |
| 5a | Player presses **Entendi** → card gone, focus moves to the first game card's link (D6a) → `POST /onboarding/seen` stamps `now()`. |
| 5b | Or the player ignores it, taps **Jogar hoje**, and plays. The card is still unstamped and appears again next visit — correct: it has not been acknowledged. |
| 6 | Next visit, any device carrying this identity: `{ show: false }`, card never renders. |
| 7 | Later, the player attaches an email on a second device and the accounts merge: statement 5d folds the earliest `onboarding_seen_at` **and `attach_prompt_dismissed_at`** onto the winner, and every loser session is remapped to it — so both devices now resolve to an identity that has seen the introduction and dismissed the attach ask. |

---

## 8. D15 — Rendering strategy and the client-JS budget

**Client, and it must be** (§1.2). The server render of `/` is byte-identical
to today's: the island returns `null` for `undefined` state, and the mount
effect is the only thing that fetches.

**`T-WEB-S17` and `T-WEB-S127` must stay green unamended.** They spy on
`Storage.prototype.getItem`, `Date.now` and `fetch` across
`renderToStaticMarkup(<HojePage />)` and assert none is called. This design
satisfies them by construction — D9 removes storage entirely, nothing reads a
clock, and the fetch is inside `useEffect`. **If either test needs an
amendment, the design is wrong, not the test.**

### This ticket owes fresh before/after figures. Explicitly, yes.

`/` is the budget's denominator (§1.5), and the napkin's Domain Behavior item 3
is unambiguous: *"any PR adding client JS to `/` publishes fresh measured
before/after figures (incl. `/` itself) in the PR body and never retunes budgets
to absorb it."*

Procedure, twice — once on `main` at `6b81cae`, once on the branch:

```
rm -rf apps/web/.next
cd apps/web && pnpm build && pnpm bundle-check
```

`bundle-check` **must be run from `apps/web`** — from the root it exits 0
silently (napkin, Execution item 2). And `rm -rf .next` is required before
`pnpm typecheck` but deletes the stats file `bundle-check` reads, so the
ordering is build → bundle-check, never the reverse.

### The PR body's opening, which is not negotiable

**The first lines of the PR body, before anything else** (step-3 finding F-4 —
the draft buried this in §1.4 and then listed screenshots as gate item 4):

> **Fernando cannot see this feature on the preview deploy.** On `*.vercel.app`
> every credentialed call is anonymous — the `miolos_session` cookie is
> `SameSite=Lax` and `vercel.app` is on the Public Suffix List, so preview
> web→api is cross-site and the cookie neither travels nor sets (ADR-0048
> `:76-84`). `GET /onboarding/state` therefore 401s on every preview and the
> card never renders there. **The CI `impeccable detect` job cannot see this
> surface either**: it authenticates only with `VERCEL_AUTOMATION_BYPASS_SECRET`,
> a deployment-protection bypass and never a session
> (`.github/workflows/impeccable.yml:35`, `:48-51`), so every page it scans is an
> anonymous cold profile. Its green is evidence about the hub, not about this
> card. The evidence for the card is below, in order of strength.

Then the evidence, **in this order** — the draft led with the fixture and
under-sold the strongest item:

1. **`pnpm dev` locally, screenshotted at 1440×900 and 390×844.**
   `localhost:3000` → `localhost:3001` is same-site for `SameSite=Lax`, so the
   real flow works end to end. This is the real thing, not a fixture, and it is
   the strongest evidence available.
2. The `file://` fixture delta at both viewports, with its proof-of-life stated
   (below).
3. The direct measured heights: the card's own box and the promo strip's bottom
   edge at 390×844, against the corrected 162.5 px of slack (§4).
4. The CI job green, explicitly labelled as evidence about the hub only.

### The budget tables

The PR body also carries:

- the full before and after tables, including `/`'s own raw/gzip figure;
- a sentence saying, in these words, that **every budgeted route's delta
  shrank because the baseline grew, and that is not headroom** — over the
  **20** budgeted routes `BUDGETED` actually lists
  (`route-client-js.mjs:204-273`), not the 23 printed rows the draft counted;
- the three grid-route figures re-measured (they were 35.4 / 31.6 / 37.5 KB at
  #96, nonogram with 2.5 KB of slack);
- **an edit to `route-client-js.mjs`'s own doc comment**, which names those
  figures and instructs that they be *"re-measure[d] rather than quote[d]"*.

`MAX_DELTA_BYTES` is **not** raised, and no route is added to
`PER_ROUTE_BUDGET`. No new route means no ADR-0047 classification is owed and
no marker array changes — but note that three `EXPECTED_DAILY_SCOPE` markers
are literal strings from `messages.ts`, so the onboarding block must not be
placed anywhere that reorders or edits them.

**Expected size.** One component, one hook, one fetch module, three zod
schemas, no dependency, no state machine, no focus management, no portal.
On the order of 1 KB gzipped. If the measurement lands materially above that,
step 5 stops and re-reads this section rather than absorbing it.

### `impeccable detect` — where, and on what

Owed on **two** surfaces, because the CI job cannot see this one (§1.4). Item 3
was **vacuous as drafted and is replaced** (blocking finding F-1).

1. **The CI job, `/` at 1440×900 and 390×844.** Both steps of the job are read
   (napkin item 9: `/estatisticas` failed mobile-only). Green here proves the
   hub is unregressed. It **does not** prove anything about the card, and the
   PR body says so instead of letting a green be over-read.

2. **A `file://` fixture scan of the card, at both viewports** — the **plan 043
   §11** procedure (`docs/plans/043-issue-96-plan-archive-done-chip.md:1021-1119`;
   the draft cited *"the plan 043 § procedure"* with the number missing). The
   fixture carries **all of the following, or the run does not answer the
   question it is being asked**:

   - the real rendered markup, emitted through a temporary vitest config with
     `css: { modules: { classNameStrategy: "non-scoped" } }` — without it the
     class names are hashed, the stylesheet matches nothing and the scan is over
     unstyled markup (plan 043 §11 measured this);
   - `<link>` to `packages/ui/tokens.css`, to `apps/web/app/hub-onboarding.module.css`,
     **and to `apps/web/app/globals.css`** — the third was **missing from the
     draft**. Plan 043 `:1074` and plan 046 `:209` both make it mandatory in
     these words: *"without it the fixture paints cards on **white** with
     UA-default link blue, changing `cream-palette` (the plan's own expected
     baseline finding)"*. `globals.css` is where `body { background:
     var(--paper-desk); … }`, `a { color: var(--ink) }` and the
     `--font-display` / `--font-ui` bindings live;
   - **real `@font-face` rules** for the three committed faces —
     `apps/web/assets/fonts/InstrumentSans-400.ttf`, `InstrumentSans-600.ttf`,
     `Fraunces-36pt-500.ttf` — bound to `--font-fraunces` and
     `--font-instrument-sans`, which `next/font` supplies at runtime and
     `file://` does not. **Also missing from the draft**, and text metrics are
     the entire subject of a height measurement. Stated limit, as plan 043
     states it: the committed Fraunces is weight 500 and `.invitation` ships
     550, so the invitation's measured width is a lower bound.

   Scanned **with and without the card, read as the delta.** Any finding the
   card's presence adds is a finding this ticket introduced. The config's
   `low-contrast` and `cream-palette` ignores are URL-scoped to `localhost` and
   `vercel.app`, so a `file://` target matches neither: a `file://` red is **not
   automatically a regression**, and the delta is the evidence in both
   directions.

   **Proof of life, adopted verbatim from plan 043 §11 (`:1114`) — the clause
   the draft dropped:** *the scan must contain `cream-palette`. If it does not,
   the fixture did not load, the run is vacuous, and no conclusion may be drawn
   from its silence.* Confirmed still true at step 4 on this tree: three
   throwaway `file://` fixtures each emitted exactly `cream-palette`.

   **Run every scan as a separate command, never chained with `&&`** — a scan
   that finds something **exits 2**, so a chain stops at the first finding and
   the rest silently never run (plan 043 `:1094`). Paste each scan's exit code
   with its output; a `2` means "this scan found something", never "the
   procedure failed".

3. **The mobile first-viewport check — a direct measurement, because
   `first-viewport-column-overflow` cannot answer this question.** The draft's
   gate was *"assert `first-viewport-column-overflow` does not fire"*. Step 3
   could not make the rule fire and reported the rule id absent from the
   detector's rule list. Step 4 settled it, and the answer is more specific than
   either:

   - **The rule does exist**, in the detector `npx impeccable detect` actually
     runs — `node_modules/impeccable/cli/engine/rules/checks.mjs:5417`
     (impeccable **3.4.0**), keyed `type:` rather than `id:`. Step 3 grepped
     `.claude/skills/impeccable/scripts/detector/rules/checks.mjs`, a **vendored
     reference copy carrying 36 rules** which is not what the CLI executes. That
     correction matters beyond this gate: *the vendored skill copy is not the
     instrument.*
   - **It fires happily on a `file://` target.** Positive control built and run
     at step 4 — a two-column grid, one column 2000px of content, its sibling
     300px, at 1440×900:

     ```
     [first-viewport-column-overflow] div.wrap opens the page with one column
     running 222% of the viewport tall while a sibling fits in 33% — the fold
     falls deep inside the section
     ```

   - **And it is structurally incapable of firing on the mobile hub, at any
     card height.** Read at `:5372-5410`: the rule requires a `grid`/`flex`
     container ≥50% of the viewport width with **two or more side-by-side
     children**, each holding a width share between **0.25 and 0.9**, sharing
     the top row, one running past `1.4 × vh` while the shortest fits inside
     `vh`. The mobile hub is a single stacked column — `.page` is
     `flex-direction: column` and `.games` becomes `flex-direction: column` at
     `max-width: 768px` (`page.module.css:298`, `:337-341`), so every child is
     full-bleed (share ≈ 1.0 > 0.9) and the rule `continue`s before it examines
     a single height. Measured: a deliberately 2800px-overflowing single-column
     mobile fixture at 390×844 produced **only `cream-palette`**. (At 1440×900
     the four grid cards are ~0.24 each, below the 0.25 floor, so the desktop
     hub is out of the rule's reach too.) The `/estatisticas` firing the napkin
     records was a genuinely multi-column composition; this page is not one.

   **So the gate is a direct measurement, not a silence.** In the same headless
   browser the fixture is scanned in, at 390×844 and 1440×900:

   ```js
   // Against the fixture WITH the card. The two data attributes are the
   // fixture's own markers, added to the emitted shell — not to product code.
   document.querySelector('[data-fx-promo]').getBoundingClientRect().bottom
   document.querySelector('[data-fx-card]').getBoundingClientRect().height
   ```

   Both numbers go in the PR body against the §4 baseline — **162.5px of
   measured slack, a 319.6px card, an 844px viewport** — with the expected
   result stated in advance rather than discovered: *the promo strip lands below
   the fold when the card renders, by roughly the card's height minus the slack,
   and that is the tolerance `HubAttach` already spends at 484.8px.* A number
   materially worse than that expectation is the signal; a silence is not
   evidence of anything.

   **Mitigations, if the measured card is materially larger than 319.6px**, in
   order: tighten the copy; set `rollover` and `noAccount` in one paragraph
   rather than two; step the card's vertical padding down one stop on the 4pt
   scale. Moving the card is **not** on that list — it is already in the slot
   the reflow argument requires (§4 Placement).

4. **Screenshots at both viewports in the PR body** — from `pnpm dev`, the real
   surface, with the fixture's beside them, because no preview deploy can show
   Fernando this feature.

---

## 9. Build sequence

**Step 0 is a hard gate on everything else.**

| # | Work | Notes |
|---|---|---|
| **0** | **D3's eight-step ordering, in order, no step skipped.** Confirm unpushed → column → **re-derive the migration number** (#83 is in flight) → generate → `vercel env pull` outside the repo → apply to production Neon by hand → **verify via `information_schema.columns` and paste the row** → delete the script and the env file → only then push. | D3. Until the verification row is pasted, **nothing is pushed** — the first push deploys a preview against the production database with a drizzle INSERT column list the table does not have, and every anonymous mint fails. `\d users` is **not** available: there is no `psql` on this box. |
| 1 | `packages/db`: the column comment (the `attachPromptDismissedAt` block is the template, including its migration note), merge statement 5d **over both columns**, the `updated_at` writer list at `schema.ts:72-79`, tests. | D1, D2 |
| 2 | `packages/core`: `contracts/onboarding.ts`, barrel exports, tests. | D4 |
| 3 | `apps/api`: `src/onboarding/service.ts` (`getOnboardingState`, `markOnboardingSeen`), `app/onboarding/state/route.ts`, `app/onboarding/seen/route.ts`, tests. | D5 |
| 4 | `apps/web` copy: the `messages.onboarding` block. | D12 |
| 5 | `apps/web` transport + hook: `src/onboarding/onboarding-client.ts`, `src/onboarding/use-onboarding-state.ts`. | D10 |
| 6 | `apps/web` island: `app/hub-onboarding.tsx`, `app/hub-onboarding.module.css`, and the insertion in `app/page.tsx` **after `</section>` closing the games grid, before `<nav className={styles.secondaryLinks}>`**. | D6, D6a, D13 |
| 7 | Root `eslint.config.mjs`: the free-play wall. `**/onboarding`, `**/onboarding/**`, `**/hub-onboarding` join the static `group` beside the attach entries; `onboarding(\\/\|$)\|hub-onboarding` joins the dynamic-import regex. Wall probes. | §10 R5 |
| 8 | Tests across all four areas (§7 table below). | |
| 9 | Records: ADR-0061 (**~60 lines, D1/D2/D9 only**), `docs/README.md` rows, test-id frontier, `CONTEXT.md` row, the ADR-0049 **annotation** (no reciprocal), the two falsified fragment-count doc blocks, `schema.ts`'s writer list, `hub-attach.tsx`'s principle number, and the sibling-hooks issue. | §10 R1–R10 |
| 10 | Gates: `pnpm typecheck`, `pnpm lint`, `pnpm test --force`, `pnpm build` + `bundle-check` before/after, impeccable file-mode + CI job. | §8 |

The `eslint.config.mjs` step is easy to forget and is a blocking review finding
when missed (napkin, Domain item 2): `app/page` is a walled value since #19, so
`hub-onboarding.tsx` and everything it imports become one hop from it and must
be banned **by name** in both the static group and the dynamic regex, with
probes proving both arms fire.

---

## 10. Test plan, with ids allocated from the real frontier

**Frontier re-derived by grep on this branch** (the document's own instruction:
*"re-run the grep before allocating"*), against `docs/agents/test-ids.md`'s
burned slots:

| Area | Highest in use (grep) | Next free (doc) | Reserved here |
|---|---|---|---|
| `T-CORE` | `S84` | `S86` | `S86` |
| `T-DB` | `S58` | `S59` | `S59–S61` |
| `T-API` | `S107a` | `S109` | `S109–S114` |
| `T-WEB` | `S229` | `S230` | `S230–S238` |
| `T-LINT` | `S46` | `S47` | `S47–S48` |

**Twenty-one ids, not the draft's twenty-four** (step-3 adjudication G-2, taken
as written). Three were cut and the tails renumbered so nothing is reserved and
unspent:

- **`T-CORE-S87` cut** — the round-trip test (what the route emits, the client
  parses) over a `{ show: boolean }` schema, with `T-CORE-S86` already proving
  strictness, proves nothing a type does not. Ceremony.
- **`T-DB-S61` folded into `T-DB-S60`** as a second arm (D2's B-4 paragraph:
  nothing reads the timestamp's value). The draft's `S62` becomes `S61`.
- **`T-WEB-S236` not minted** — `T-WEB-S136` already greps sources for the
  browser storage API; the four onboarding files join its file list. Widening an
  existing claim about the same gate takes no new id (the `T-WEB-S100` burn
  precedent, cited five times in `docs/agents/test-ids.md`). The draft's `S237`,
  `S238` and `S239` become `S236`, `S237` and `S238`.

The remaining 21 are proportionate: the merge arms, the race test, the
reduced-motion pair and the two lint probes are all load-bearing.

**These reservations are a snapshot and two siblings are running tonight**
(#126 and #83). **Re-run the grep at step 5 before writing a single id**, and
re-derive the frontier at step 8. Reserved-but-unspent tails are **burned**, per
the document's rule — this plan reserves exactly what §10 lists and no review
headroom.

`apps/web` puts its ids on `describe(...)`; `packages/core`, `packages/db` and
`apps/api` put them on `it(...)`. That divergence is the shipped convention.

### The five acceptance rules, and the test that holds each

| Rule | Id | Where | Assertion |
|---|---|---|---|
| **Once only** | `T-API-S110` | `apps/api/test/onboarding-state.test.ts` | `onboarding_seen_at` NULL → `{show: true}`; stamped → `{show: false}` |
| | `T-API-S112` | `apps/api/test/onboarding-seen.test.ts` | POST stamps once; a second POST touches zero rows, does not move the timestamp and does not re-bump `updated_at` |
| | `T-WEB-S234` | `apps/web/test/hub-onboarding.test.tsx` | pressing dismiss removes the card and posts exactly once |
| **Merge survival** | `T-DB-S60` | `packages/db/test/merge.test.ts` | **three arms.** (a) either side stamped → the winner ends stamped, in both argument orders; (b) both stamped → the **earlier** survives (the folded `S61`); (c) the same two, for `attach_prompt_dismissed_at`, including the mixed case where only one column's arm fires and the other is left untouched |
| | `T-DB-S61` | same | the merge is a no-op on re-run (zero rows, no `updated_at` re-bump) and the **loser's** values are untouched by the tombstone `SET` |
| **Never blocks** | `T-WEB-S230` | `apps/web/test/hub-onboarding.test.tsx` | `renderToStaticMarkup(<HubOnboarding />)` is `""` — the server render carries no onboarding markup at all |
| | `T-WEB-S231` | `apps/web/test/hoje.smoke.test.tsx` | with the card rendered: all four "Jogar hoje" links present and **preceding** the card in document order; the card sets no `aria-modal`, `role="dialog"` or `inert`; and **after dismiss, `document.activeElement` is the first game card's link** — never `<body>`. **Rewritten at step 4** (finding E-2): the draft asserted that `focus()` is never called, which would have written the focus-loss bug into the suite |
| | `T-WEB-S232` | `apps/web/test/hub-onboarding.test.tsx` | `undefined` and `null` states both render nothing (an unreachable server never nags) — with the positive control beside it |
| | `T-API-S109` | `apps/api/test/onboarding-state.test.ts` | no session → 401 `no-session`, **and no `users` row is created** (the route never mints) |
| **The first-visit race** | `T-WEB-S233` | `apps/web/test/hub-onboarding.test.tsx` | the state fetch is **not issued until `ensureSession()` resolves** — the mint-then-read ordering of D10, with a deferred `ensureSession` proving the fetch is still unissued |
| **Reduced motion** | `T-WEB-S236` | `apps/web/test/hub-onboarding.test.tsx` | `bodyOf(css, "@media (prefers-reduced-motion: reduce)")` exists in `hub-onboarding.module.css`, stands down `transition`, **and preserves the static `rotate(-0.5deg)`** |
| | `T-WEB-S237` | same | the card's `transition` names only `opacity` and `transform` — never a layout property — and the module declares no `@keyframes` |
| **i18n externalisation** | `T-WEB-S235` | `apps/web/test/hub-onboarding.test.tsx` | every rendered string is `messages.onboarding.*`; the component source carries no pt-BR string literal (source scan, run through the repo's comment stripper — napkin item 3) |
| | `T-WEB-S238` | same | the card is a `<section>` whose **accessible name comes from the rendered `<h2>`** via `aria-labelledby`, and that heading's text is `messages.onboarding.invitation` — not an `aria-label`, and not joined at the call site (D6a) |

Remaining reserved ids:

- `T-CORE-S86` — the three onboarding schemas are strict: an extra key fails.
- `T-DB-S59` — `onboarding_seen_at` exists on `users`, is nullable, defaults
  NULL, and a freshly minted user has it NULL.
- `T-API-S111` — an unknown/deleted user id resolves `{show: false}` (fail
  closed), not a 500.
- `T-API-S113` — `POST /onboarding/seen` rejects a non-empty body with 400, a
  non-JSON content type with 415, and a cross-site write with 403.
- `T-API-S114` — every branch of both routes carries the CORS grant, and the
  GET carries `Cache-Control: no-store`.
- `T-LINT-S47` — `apps/web/src/free-play/**` and `app/modo-livre/**` cannot
  statically import the onboarding modules; the probe proves the rule fires.
- `T-LINT-S48` — the same for dynamic import, via the regex arm.

**Widened, not minted:** `T-WEB-S136`'s file list gains the four onboarding
source files (D9). No new id, per the `T-WEB-S100` burn precedent.

### Records owed in this PR (the falsified-record standard)

| # | Record | Why |
|---|---|---|
| R1 | `docs/README.md` rows for `plans/057-…` and `adr/0061-…` | The numbering rule; a blocking review finding in four consecutive PRs |
| R2 | **ADR-0061, roughly 60 lines covering D1, D2 and D9 only.** `**Status:** Proposed — <day> (issue #35)` in the plan PR, flipped to `Accepted — <merge day> (issue #35, shipped in #PR)` **in this PR's own diff at step 5** | `docs/agents/domain.md` lifecycle; owner is the agent driving the PR. **Scope cut at step 4** (adjudication G-3): the genuinely new decisions are the fact's seat (a nullable `users` timestamp, not a table and not device storage), the first `users`-column merge duty, and no-device-storage with AC 2 as the reason. **D6, D7 and D8 are not ADR material** — each is an *application* of settled law (PRODUCT.md principle 4, ADR-0002, four shipped comments), and an ADR that restates settled law dilutes the set |
| R3 | `docs/agents/test-ids.md` — frontier rows re-derived at step 8, a §-paragraph for #35's spends, and any reserved-unspent tail marked burned | The document's own instruction |
| R4 | An **in-place annotation** on **ADR-0049 decision 6** naming the first `users`-column merge duty. **No reciprocal in ADR-0061** | §2 D2, adjudicated at step 3 and settled: decision 6's sentence does not go false, so `**Amended by:**` is the wrong form, and the ADR-0055↔0057 reciprocal idiom governs amendments only — an annotation is one-way |
| R5 | `CONTEXT.md` — an `Onboarding \| — \| ` row for the first-visit introduction | The glossary has no term for this surface, and issue titles and test names are required to use one |
| R6 | `route-client-js.mjs` doc-comment figures re-measured | §8; the file instructs it |
| R7 | A §14 deviation register on this plan, appended after every step-7 fix | Napkin item 5 — a plan whose prescriptions went false is a rejectable finding. **The step-4 changes are already recorded there** |
| R8 | `schema.ts:72-79`'s `updated_at` writer list gains `mergeAccounts` statement 5d | §2 D2 (finding B-5): 5d is the first statement that writes the **winner's** `updated_at`, so a committed enumeration goes false |
| R9 | Two falsified doc blocks, and one wrong citation: `hub-streak.tsx:4-5` (*"the third client fragment"*) and `hub-attach.tsx:4-5` (*"the fourth"*) are re-counted for the fifth; and `hub-attach.tsx`'s *"PRODUCT.md principle 3"* becomes **principle 4** (`PRODUCT.md:34`) | Findings F-5 and D-7. The repo counts *fragments* (four today across three files), so "fifth" is correct by its own rule — and correct-by-rule still falsifies two committed sentences |
| R10 | A **Tier 1 issue**: *"four mount-fetch hooks race the session mint on a re-mint load"*, citing `bootstrap.ts:48-51` and the five files in D10's table | Finding A-2. Shipped-code defect, deliberately out of this ticket's scope, and recorded rather than left as an unexplained divergence |

---

## 11. What needs Fernando

He is asleep. Each row states the assumption the build proceeds under, so
nothing is blocked, and each is one line to overturn.

**Two rows, not the draft's eight.** Step 3 adjudicated six of them as repo law
or as free-either-way, and a list of eight is not reviewable over coffee: burying
the two real choices among six settled ones is how the two real ones get skimmed.
The six moved into the body with the law that decides each, listed below the
table so nothing was quietly dropped.

| # | Decision | Proceeding under | Cost to change later |
|---|---|---|---|
| **F2** | **After the game cards, or above them?** | **After them, in the `HubAttach` slot** (§4 "Placement"). Inverted at step 4: the island materialises after two sequential round trips, and above the grid that shift moves all four "Jogar hoje" links out from under a first-time player's finger — the one acceptance criterion this surface most needs not to violate. The measured slack was also 162.5px, not the draft's "~250px", against a 319.6px card, so "above" never fit either. | **One line** — moving the `<HubOnboarding />` JSX up. The cost, named: a ~320px post-hydration shift over the four primary tap targets on the visit the feature exists for, plus a CLS regression on the app's most important route. Re-measure at 390×844 after. |
| **F4** | **The copy** (§5, drafted in full — the row he will most want) | The **five** strings as written, corrected at step 4 for two factual defects and two house-style collisions (§5's table). One open sub-choice inside this row: `rollover` now says **"no horário de São Paulo"**, because *"Brasília"* — though factually correct, DST having been abolished in 2019 — has **zero precedent anywhere in this repo**, where code, docs and the glossary all spell it São Paulo. If he prefers "Brasília" for a lay reader, that is his call and it is one string. The dismiss word `"Entendi"` is inside this row, not a row of its own. | **Free.** One `messages.ts` edit, no code change. Every assertion goes through `messages`, so no test moves. |

**The six that were settled, and by what** — each is one line in the body:

- **Overlay, route, or in-flow card** (was F1) → **in-flow card.** Four shipped
  comments forbid a modal, product code has zero dialog/portal/focus-trap
  primitives and seven manifests have zero overlay libraries, PRODUCT.md
  principle 4, and the route variant needs an identity `apps/web` structurally
  does not have (§1.2, D7). There is no version of this where the answer differs;
  it is stated as a finding in the PR body instead of as a question.
- **How many steps** (was F3) → **one card, one action.** PRODUCT.md principle 4;
  three facts do not need a state machine; every step is client JS on the
  budget's denominator (D8).
- **Does anything animate** (was F5) → **yes, one 200 ms settle with its reduce
  block.** Free either way, invisible in the diff, no product consequence in this
  slot (D13).
- **The dismiss word** (was F6) → **not a separate decision.** It is one of the
  five strings; folded into F4 (§5).
- **`--accent-app` for the tape** (was F7) → **yes.** `tokens.css:13` comments
  the token as *"sealing-wax red: streak, promo"*, F1/F2 use it for everything not
  owned by a game, and `hub-attach.module.css` already made this exact choice (§4).
- **Should the introduction ever return** (was F8) → **not in this ticket.** One
  lifecycle per account, like the attach prompt. #36 owns settings and gains one
  line saying it may add a "ver de novo" there.

---

## 12. Landmines

1. **Push before the Neon migration and production mints break.** §9 step 0. The
   single highest-severity item in this plan.
2. **A bare mount fetch races the first mint** and the one visit the ticket
   exists for takes the 401 branch. `ensureSession()` first, always (D10,
   `T-WEB-S233`). Copying `use-attach-state.ts` literally is the way this bug
   ships.
3. **Merge statement 5d without the `is not null` + `<` guard** reds
   `T-DB-S20`'s double-run snapshot by re-bumping `updated_at` on a re-run. With
   two columns in one `SET`, the guard is an **`OR` over both per-column
   conditions** — a single-column guard would skip rows the other column needs.
4. **`T-WEB-S17` / `T-WEB-S127` amended instead of satisfied.** If the first-paint
   contract needs to move, the design is wrong.
5. **Reading the CI impeccable green as evidence about the card.** It cannot
   see it (§1.4). The `pnpm dev` screenshots and the file-mode delta are the
   evidence.
6. **Selling the shrunken budget deltas as headroom.** Growing `/` shrinks all
   **20 budgeted** deltas (§8; `BUDGETED` has 20 entries — the script *prints*
   more). Say so in the PR in those words.
7. **`bundle-check` from the repo root exits 0 silently.** Run it from
   `apps/web`, and build before it, not after `rm -rf .next`.
8. **A source-scan assertion over `hub-onboarding.tsx` will hit its own doc
   comment.** Run the file through the repo's comment stripper (the `code()`
   helper in `eslint-db-wall.test.ts`, cited by symbol) before any
   `toContain` / `not.toContain` — this repo writes long doc blocks and the
   false hit is the norm (napkin item 3; #34 hit it three times).
9. **The free-play ESLint wall.** `app/page` is a walled value; a new module one
   hop from it must be banned by name in **both** arms, with probes.
10. **Asserting that `first-viewport-column-overflow` "does not fire" and calling
    that a mobile gate.** The rule requires **two or more side-by-side columns**
    and cannot fire on the stacked mobile hub at any card height (§8 item 3,
    measured). A silence from an instrument that cannot speak is not evidence.
    The gate is a **direct measurement** of the promo strip's bottom edge.
    Related: `.claude/skills/impeccable/scripts/detector/rules/checks.mjs` is a
    **vendored reference copy** and is *not* what `npx impeccable detect` runs —
    grep `node_modules/impeccable/cli/engine/rules/` when a rule's existence is
    the question.
11. **A `file://` fixture without `apps/web/app/globals.css` and the three real
    `@font-face` rules.** It paints on white with UA-default link blue and wrong
    text metrics, and every height it reports is fiction (plan 043 §11). The
    proof-of-life clause — **the scan must contain `cream-palette`** — is what
    makes a silence readable at all.
12. **A string that is false in the state it renders in.** `lead` said the
    sequência *continua* on a card that only ever renders for a player who has no
    sequência. Every string is checked against the one state its surface appears
    in, not against the product in general (§5).
13. **Three `EXPECTED_DAILY_SCOPE` markers in `route-client-js.mjs` are literal
    `messages.ts` strings.** Editing or reordering around them reds the script.
    Adding a `messages.onboarding` block does not touch them — one of the three,
    `"Revele a figura escondida pelos números."` (`messages.ts:1021`), is
    `games.nonogram.description`, which `app/page.tsx:86` renders on the hub
    itself.

---

## 13. Exit criteria

- [ ] The migration applied to Neon **and confirmed by a pasted
      `information_schema.columns` row** before the first push. Migration number
      re-derived immediately before generating (#83 is in flight).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test --force` green, output pasted.
- [ ] `pnpm build` + `bundle-check` run from `apps/web` on **both** `main` and
      the branch; both tables in the PR body; the "shrunken deltas are not
      headroom" sentence present over **20 budgeted routes**;
      `route-client-js.mjs`'s doc figures updated.
- [ ] `impeccable detect` CI job green at **both** viewports, read as evidence
      about the hub only, with that limitation stated.
- [ ] `impeccable detect` file-mode delta over the card's fixture at 1440×900
      and 390×844 — empty delta, or every finding explained — with the fixture
      carrying `globals.css` and the three `@font-face` rules, **each scan
      containing `cream-palette` or the run is vacuous**, and every scan run as
      a separate command with its exit code pasted.
- [ ] The mobile first-viewport **measurement** pasted: the card's own height
      and the promo strip's bottom edge at 390×844, against 162.5px of slack in
      an 844px viewport. Not a `first-viewport-column-overflow` silence.
- [ ] Screenshots at both viewports in the PR body, **from `pnpm dev`** (the
      real surface) with the fixture's beside them.
- [ ] All **21** reserved ids either spent or explicitly burned; `T-WEB-S136`
      widened rather than a new id minted; the frontier re-derived by grep and
      updated.
- [ ] ADR-0061 `Accepted`, dated the expected merge day, citing the PR, **~60
      lines over D1/D2/D9 only**; the ADR-0049 **annotation** in place (and **no**
      reciprocal); `docs/README.md` rows; the `CONTEXT.md` row; R8, R9 and R10
      discharged.
- [ ] `T-WEB-S17` and `T-WEB-S127` green **and unamended**.
- [ ] The PR body **opens** with the preview blind spot (§8), names the tier
      (Tier 2, ADR-0058), and lists **F2 and F4** as the decisions Fernando may
      overturn, with the cost of each.

---

## 14. Deviation register

A plan whose prescriptions went false and said nothing is a rejectable finding
(napkin item 5). This section records every departure from the section above it,
with the reason. It is appended to — never rewritten — at steps 4, 5 and 7.

### Step-4 changes (from the step-3 review, `ACCEPT WITH FIXES`)

Every finding in the review, and what changed. Three blocking, eight major, the
rest minor or adjudications. **Nothing was dismissed.**

| Finding | Disposition | What changed |
|---|---|---|
| **A-1** (blocking) | **Taken** | The card moves from above the game cards to the `HubAttach` slot, after them. §4 "Placement" rewritten around the post-hydration shift over live tap targets; §9 step 6, §7 worked-visit row 4, D11 and the D6 opening all follow it. §11 F2 inverted, with the cost of overruling it named |
| **A-2** (major) | **Taken — named, not fixed** | D10 gains the five-hook table (`use-attach-state`, `use-streak`, `use-medals`, `use-stats`, `use-stats-calendar`), the re-mint case §1.3 missed, and the reason this ticket does not widen. Successor Tier 1 issue owed as R10 |
| **A-3** (minor) | **Taken** | D10's hook comment gains the clause that `ensureSession` resolves whether or not the mint succeeded, and that awaiting it buys ordering, never identity |
| **A-4** | No finding | — |
| **B-1** | No finding | Column-vs-table reasoning stands as written |
| **B-2** (adjudication) | **Adopted as written** | ADR-0049 gets an **in-place annotation**, not `**Amended by:**`; the ADR-0061 reciprocal is **not owed** and is dropped. §2 D2's note rewritten from a request-for-adjudication into the settled record; R4 rewritten |
| **B-3** (major) | **Taken — option 1, merge both** | Statement 5d carries `attach_prompt_dismissed_at` as well, under an `OR`-ed guard. §1.1 states the precedent's defect instead of leaning on it. Fallback written in (drop to the issue + a `schema.ts` sentence) if step 5 finds it costs more than ~6 lines. Filed as **[#134](https://github.com/fernandolisboa/miolos/issues/134)** either way |
| **B-4** (minor) | **Taken** | D2 states that no consumer reads the value and that earliest-wins is chosen for the evidence property and idiom-consistency. `T-DB-S61` folded into `T-DB-S60` as an arm |
| **B-5** (minor) | **Taken** | D2 names 5d as the first write to the **winner's** `updated_at`; `schema.ts:72-79`'s writer list joins the records table as R8 |
| **B-6** (major) | **Taken verbatim** | D3 carries the eight-step ordering, the `information_schema` verification (there is no `psql`), the migration-number collision check against #83, why production `main` is safe in the interval, and the no-down-migration note. §9 step 0 and §13 follow |
| **C-1** (blocking) | **Taken, and re-measured** | The draft's "~250px" and the review's hand-summed "≈188px" are both replaced by a **browser measurement: 162.5px**, with the full child-by-child table summing to 844.0 exactly. `min-height: 48px` recorded as inert (rows measure 83.8–84.4px); the shipped page recorded as having less than the frame. The card itself measured at **319.6px**, and `HubAttach` at **484.8px** for the tolerance comparison. The "~140px" threshold is replaced by the honest conclusion: no version of this card fits above the fold, which is why placement carries the decision |
| **C-2** (major) | **Taken** | D7 states that two of the four shipped comments constrain *position* as well as kind, and that with A-1 applied the departure is gone rather than argued |
| **C-3** (minor) | **Taken** | The anatomy table gains the note that 25% and `--text-body` are **choices** — the hub's game cards ship 22%, and neither hub sheet uses the token today |
| **C-4** (minor) | **Taken** | D6 states the card's geometry and why it is `hub-attach`'s: it takes `hub-attach`'s slot. The stacked-margin and 560px-fragment hazards named as what the old placement would have cost |
| **C-5** | No finding, note taken | D13 quotes DESIGN.md `:38`'s *"never animated **per interaction**"* qualifier so no step-6 reviewer re-derives it |
| **C-6** (nit) | **Taken** | F2 holds three links, not four; F2's tape rotations `-3/2/-2/3` fall outside DESIGN.md's band and the shipped CSS deliberately corrects them (`page.module.css:377-378`). "Check the code, never the frame" written in |
| **C-7** | No finding | D7's no-overlay claim stands |
| **D-1** (major) | **Taken** | `noAccount` → **"Sem cadastro — é só jogar."** |
| **D-2** (major) | **Taken** | `lead` → *"…e a sua sequência **começa**"*, true on the only visit the card renders on |
| **D-3** (minor) | **Taken** | `lead` carries **"dos puzzles do dia"**, so the rule cannot read as pointing at free play or the archive |
| **D-4** (minor) | **Taken** | `rollover` → **"no horário de São Paulo"**, and "Brasília" surfaced as an explicit sub-choice inside §11 F4 rather than presented as neutral |
| **D-5** (minor) | **Taken** | `invitation` → **"iguais para todo mundo"**, matching `messages.ts:109` |
| **D-6** | No finding | The ADR-0003 promise is true; only the wording was wrong |
| **D-7** (nit) | **Taken, all three** | The word count is stated as 41 prose / 42 with the button label, with the counting rule; the `aria` precedent is corrected to `messages.ts:1105`, `:437`, `:668-669` (the `streak.aria` cite is a function, and the string is gone anyway under E-3); `hub-attach.tsx`'s *"principle 3"* is fixed to **4** in this PR (R9) |
| **E-1** | Partly delivered → **closed by A-1** | The never-blocks enumeration now includes the target still being where the player aimed |
| **E-2** (major) | **Taken** | D6a gives dismiss a focus destination — the first game card's link, selected by href because the CTA's class is a CSS-Modules hash. `T-WEB-S231` rewritten to assert focus **lands** somewhere sensible instead of asserting that `focus()` is never called |
| **E-3** (major) | **Taken** | `<section aria-labelledby="onboarding-title">` with the invitation as an `<h2>`. `messages.onboarding.aria` **deleted** — five strings, not six. `T-WEB-S238` (was `S239`) asserts the name comes from the rendered heading. `hub-attach.tsx`'s unnamed `<aside>` named as pre-existing and out of scope, since this PR no longer adds a second one |
| **E-4** (minor) | **Taken** | Stated, and dissolved by the move: in this slot the four "Jogar hoje" links precede the card, so the dismiss button is not the hub's first tab stop |
| **E-5** | No finding | — |
| **F-1** (blocking) | **Taken, and sharpened** | The fixture spec gains `apps/web/app/globals.css`, the three real `@font-face` rules, the `classNameStrategy: "non-scoped"` requirement, plan 043's **§11** number, its `cream-palette` proof-of-life clause verbatim, the never-chain-with-`&&` rule and the both-directions delta note. On the rule itself, step 4 went further than the review: **it exists** (`node_modules/impeccable/cli/engine/rules/checks.mjs:5417`, impeccable 3.4.0 — the review grepped the vendored reference copy, which is not what the CLI runs); **it fires on `file://`** (positive control built and run, output quoted); and **it is structurally incapable of firing on this page**, because it requires ≥2 side-by-side columns at 0.25–0.9 width share and the mobile hub is a single stacked column. The gate is therefore replaced by a **direct measurement** of the promo strip's bottom edge, with the expected result stated in advance |
| **F-2** (major) | **Taken** | 23 → **20** in all three places (§1.5, §8, §12 landmine 6), with the reason the wrong number looked right |
| **F-3** | No finding | The budget obligation stands as written |
| **F-4** (minor) | **Taken** | The preview blind spot is now the PR body's **first lines**, with a drafted paragraph, and the evidence is ordered strongest-first — `pnpm dev` screenshots ahead of the fixture, which the draft had backwards |
| **F-5** (minor) | **Taken** | R9 covers the two falsified fragment-count doc blocks |
| **F-6** | No finding | — |
| **G-1** (adjudication) | **Adopted as written** | Both endpoints kept, forced by ADR-0048 decision 3. D4 gains the observation that the hub now issues three credentialed GETs on one visit |
| **G-2** (adjudication) | **Adopted as written** | 24 → **21**: `T-CORE-S87` cut, `T-DB-S61` folded into `S60`, `T-WEB-S136` widened instead of minting `S236`. Tails renumbered so nothing is reserved-and-unspent |
| **G-3** (adjudication) | **Adopted as written** | ADR-0061 scoped to **~60 lines over D1/D2/D9 only**; D6/D7/D8 are applications of settled law and stay in the plan and the code comments (R2) |
| **G-4** | No finding | The eslint wall, the `CONTEXT.md` row and the frontier update are all work; all three kept |
| **G-5** (optional) | **Declined, with the reason** | The `docs/README.md` row stays a single dense sentence. It matches the 052/053 house style, the row is the repo's index entry and not a summary anyone reads twice, and rewriting the convention on this ticket would make one row inconsistent with fifty-six. The row **is** rewritten for accuracy — the draft's row said "above the game cards", named no merge duty for the twin column, and described a gate that cannot fire |
| **H** (adjudication) | **Adopted as written** | §11 cut from eight rows to **F2 and F4**. The other six moved into the body as decided-by-repo-law, each with one line naming the law, listed under the table so none was quietly dropped |

**Two things step 4 changed that no finding asked for**, both consequences of
the above rather than new decisions:

1. **D13's coupling to placement is withdrawn.** The review warned that the
   200 ms settle extends the mis-tap window "from one frame to twelve". It does
   not: the transition names `opacity` and `transform` only, so the card holds
   its full height in flow from the first frame and the reflow is one frame at
   any duration. The settle survives the move unchanged, and it would not have
   extended the window above the grid either. Recorded because it is a
   correction *to the review*, and a step-6 reviewer will otherwise re-raise it.
2. **A third alternative placement is named and rejected** — below the `<nav>`,
   in the spacer, which shifts zero interactive targets and is strictly the best
   CLS answer. Rejected on editorial grounds (the introduction would sit under
   the site's secondary navigation) rather than mechanical ones, and named so
   step 5 does not rediscover it and think it was missed.

**On this document's length, since the review raised it.** The plan went from
1034 lines to roughly 1790. That is the cost of applying three blocking findings
and thirty-odd others without dismissing any of them, and of replacing two
asserted figures with measured ones. **The artifacts the review actually asked
to cut all shrank**: the ADR from ~200 lines to ~60, the test ids from 24 to 21,
the morning decision list from eight rows to two. If step 5 wants a shorter
document, §14 is the section to read first and §§2–8 are the sections it makes
safe to skim — but nothing here is padding, and the two figures the draft got
wrong were both figures somebody had asserted instead of measuring.

### Step-5 changes

*(appended during implementation)*

### Step-7 changes

*(appended after the step-6 reviews)*
