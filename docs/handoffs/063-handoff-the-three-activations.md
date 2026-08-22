# Handoff 063 — the three activations, and the trap that ran through all of them

Session of 2026-08-21 (day/evening), Fernando present throughout. Supersedes handoff 062 and its addenda A–D, whose kickoff prompt is now false in every clause.

## What happened

Three production surfaces went from **deployed-but-dark** to **proven working**, and `docs/pending-fernando.md` NOW is **empty** for the first time since it was created.

| Surface | Was | Evidence it works |
|---|---|---|
| `CRON_SECRET` | every hourly tick 401ing since it shipped; no streak nudge ever sent | run `32477211453` — the workflow's first ever `success`; body `{"candidates":0,…}`, and the next *scheduled* tick green too |
| `POSTHOG_KEY` | telemetry deployed dormant since #176 | one `puzzle_started` in PostHog: `game: sudoku`, person = server `userId`, person-profiles **false**, GeoIP **true**, LIBRARY empty, **one entry only** |
| Resend / email attach | live-but-invisible since 2026-08-13 | first magic link (**inbox, not spam**, host `miolos.app`), first `mergeAccounts`, first account deletion |

PRs #178–#186. `main` = `622e857`.

## The one thing to carry forward

**Setting a Vercel env var does nothing until a deploy with a real diff under `apps/api` carries it into the running function.** `apps/api/vercel.json` sets `ignoreCommand: npx turbo-ignore`, so a build with no such diff is *skipped* — the ~6-second `Canceled by Ignored Build Step` rows. The dashboard's Redeploy button and a plain `vercel --prod` both fail this way, and **`vercel env ls` still lists the variable throughout**, because it reports the project, not the deployment.

This trap cost a day on `CRON_SECRET`, was caught in review on `POSTHOG_KEY`, and was sitting in the Resend wizard's final stage waiting to cost a third. It is now recorded at all three dormancy switches (`cron/auth.ts`, `telemetry/capture.ts`, `email/transport.ts`), in `apps/api/.env.example`, and in the napkin (§ Deploy 3).

The check that actually distinguishes: watch the deployment go `● Building` → `● Ready`, then exercise the feature. For attach specifically, `GET /attach/state` → `{"eligible":true}` is the only read that proves `isAttachConfigured()` is true *inside* the function.

## Landmines

- **`CRON_SECRET` is Sensitive on Vercel** — `vercel env pull` writes the literal `[SENSITIVE]`, `vercel env run` returns empty. It can never be copied between its two holders; if they drift again, **rotate** to both sides and force a redeploy. `POSTHOG_KEY` and `RESEND_API_KEY` were set non-sensitive and sensitive respectively.
- **Presence is not correctness.** `gh secret list` proves a secret *exists*; it hid a broken `CRON_SECRET` for a day. The same error wearing a disguise: `grep -c '^KEY=' file` counts the *line*, which is present even when the value is `[SENSITIVE]`. Discharge a credential only by exercising it end to end.
- **`attachStreakThreshold` is back at 5** (ADR-0003). It was 1 for the smoke test. The attach card is unreachable below a 5-day streak, so any future manual test of that flow needs it lowered again — `~/miolos-set-attach-threshold.mjs`, effective immediately, no deploy.
- **`vercel env run -e production --cwd apps/api -- node <script>`** beats `vercel env pull` for one-shot scripts: nothing touches disk. Sensitive vars arrive **empty** rather than erroring, so guard on empty.
- **This repo links Vercel at the repo level.** `apps/api/.vercel` does not exist and `vercel link` will not create it. Any script gating work behind `[[ -d .vercel ]]` skips it silently — that is exactly how the wizard never ran its `vercel env add` while reporting success. Use `--cwd`.
- **Mail DNS:** `miolos.app` sends through Resend (`send.` subdomain + `resend._domainkey`) and receives through Proton (apex MX + SPF + `protonmail{,2,3}._domainkey`). They never collide. Exactly one `v=spf1` **per hostname**. DMARC stays `p=none` until a flow is proven. Verify from the shell over DoH, not a dashboard — that is how a silently deleted apex MX was caught minutes after it happened.

## What is NOT proven

- **The `/privacidade` page.** Deletion was exercised through `POST /account/delete`; the route and cascade are proven (users row gone, 0 completions, 0 sessions). The button, its copy, and what the browser holds afterwards are untested. The AT LAUNCH item says so.
- **`login_linked`.** The fifth telemetry event should have fired during the attach tests. Nobody has looked; PostHog should now show five streams, not four.
- **Real-device rituals.** The ANY TIME list is untouched, and the push-card ritual is now the last unproven link in #146's chain.

## Records worth knowing about

- `docs/plans/066` (#64) and `067` (#32) were **rescued from scratch that was then deleted**. 066 is a complete Tier 2 step-2 plan whose own header said it was to be committed and never was — #64 therefore starts at **step 5**, not step 1.
- `scripts/gate-lock.sh` now lives **in the repo**. It was destroyed with that scratch while two committed skills still invoked it. Rebuilt, with age-based staleness — a PID check reports every held lock stale one command later, because `acquire` exits before the suite starts.
- Scratch rule, earned the hard way (napkin § Parallel 7): scratch holds only re-derivable things. A **tool** or a **plan for an open issue** goes into the repo that session.

## Exit criteria / what's next

Nothing is pending on Fernando. The frontier is ordinary agent work:

**#64** (steps 1–3 done, plan `docs/plans/066-issue-64-plan-nonogram-motif-name.md`, ships **ADR-0070**, reserve test ids on the issue, start at step 5) → **#104** → **#149** → **#155** → **#106** → **#74**. Also newly actionable: **#32**'s email-hedge slice, unblocked now that Resend is live.

---

## Addendum A — #64 shipped (2026-08-21/22, PR #188, `main` = 69e4d35)

**#64 is closed.** The daily Nonogram conclusion names its motif. Steps 5–8
ran from plan `docs/plans/066`; **ADR-0070** shipped, superseding ADR-0033
decision 1's name clause in part and annotating ADR-0033/0046/0047/0060/0065
in place. Frontier is now **#104 → #149 → #155 → #106 → #74**, plus #32's
email-hedge slice.

### The shape, in one paragraph

`motifName`, optional, on the `/day` per-game claim — ADR-0065 decision 2's
`hintsUsed` template. Post-completion **by construction**: a claim is a
projection of the user's own completion rows, so the name cannot exist on a
claim before the server judged their day. Read by
`getPublishedNonogramMotifName` on `@miolos/db/publishing` only. Rendered on
the in-place conclusion and `/nonogram/concluido`, composed once in
`nonogram-conclusion.tsx` so `ConclusionView` stays game-blind.

### Two calls that contradict instructions — both STANDING in the ledger

1. **The bundle tripwire was KEPT, not spent.** ADR-0033 consequence (d)
   predicted the grep dies the day a name ships. It was about the wrong
   thing: the grep scans `.next/static/chunks` only, and an API response is
   never a chunk. `bundle-check` is pasted in #188 proving it still armed
   **with the name live**. Warrant rewritten, markers untouched.
2. **The caption's copy register is the shipped card's**, not Fernando's
   illustrative "Você revelou: Âncora" — impersonal kicker, second person in
   the aria. Agent's call under CLAUDE.md; recorded, not asked.

Both are rows in `docs/pending-fernando.md` § STANDING. **NOW stays empty.**

### What the six lenses caught, and the two lessons worth carrying

Four blocking findings. The two that no amount of re-reading would have
found, both proved by **mutation**:

- **A test that did not test its feature.** `T-WEB-S329` stayed green with
  the refresh trigger deleted outright — it asserted a count "between 1 and
  2" (a range admitting zero) over a scenario where the nudge is *provably*
  deduped away by hook ordering. **Lesson: a range assertion whose lower
  bound is the pre-feature value is not a test.**
- **A source scan blind over 515 of 1478 lines.** Stripping block comments
  before line comments lets a `/*` inside a line comment open a block that
  runs to the next real close — and this repo writes `src/day/**`-style
  globs in prose constantly. **Lesson: comment-stripping for a source scan
  needs a character scanner, not two regexes.** Both are now recorded in the
  code that carries them.

Also: `T-DB-S86`'s game-scope assertion was vacuous (the *parse* was doing
the scoping, not the wall — a wrong-game row with parseable content is the
only fixture that proves it), and `trim()` does not strip U+200B/U+FEFF, so
a hand-edited row could have rendered an invisible name under a visible
lead.

### Landmines this session added or confirmed

- **`play-sync.test.ts`'s teardown test is a load flake**, not a defect: it
  failed alone on a PR touching neither it nor `src/play/sync.ts`, green on
  re-run and on every local run. Six real `setTimeout(…, 0)` turns race a
  2 s backoff ladder — an implicit budget is still a budget. Recorded by
  **widening** napkin § Execution 3 rather than adding a tenth item; its
  ownership clause says fix it in the ticket that owns it, never in the PR
  whose gate surfaced it.
- **ADR filenames must be read off disk, never recalled.** ADR-0070 shipped
  with seven dead links from five plausible-but-wrong slugs, and it was the
  only file in the repo with a broken ADR link. `grep -oE '\]\(\./[0-9]{4}-[a-z0-9-]+\.md\)'`
  + an existence check is the whole cure.
- **The solved conclusion is not URL-reachable**, so `impeccable detect`
  cannot see it (needs a solved day; a clean profile's `/day` 401s —
  ADR-0065 consequence (c)'s precedent). The `file://` component fixture
  does **not** reproduce the page: fonts do not resolve and the grid does
  not lay out, so it reports occlusions on the unmodified control too. Use
  it for a control diff and screenshots, never as the gate. Where a rule is
  data-dependent, pin it mechanically instead — `all-caps-body` over the
  growing motif library is `T-WEB-S330` + `packages/games/…/name-length`.

### Records worth knowing about

- Test-id frontier updated and #64's six unspent tails burned. Live maxima:
  `T-CORE-S114`, `T-DB-S87`, `T-API-S179`, `T-WEB-S330`, `T-LINT-S53`.
- `docs/evidence/64-motif-name/` holds before/after screenshots at both
  viewports and a README stating plainly what the fixture does **not**
  prove.
- The step-8 issue comment on #64 is the durable record of the three calls.

---

## Kickoff prompt for the next session

```
Read docs/handoffs/063-handoff-the-three-activations.md — including
ADDENDUM A, which supersedes the frontier above — then
docs/pending-fernando.md.

PREFLIGHT: main = 69e4d35; #188 merged; #64 CLOSED; no open PRs;
NOW EMPTY (two new STANDING rows); ADR-0070 landed. On mismatch:
stop and read the newest addendum first.

Nothing pends on Fernando — do not offer him credential work.
Frontier: #104 (tier-2, OG cards, decided), then #149, #155, #106,
#74. #32's email-hedge slice is also unblocked.
scripts/gate-lock.sh acquire "<who>" before ANY suite run, git commit
included; release after. Reserve test ids on the ISSUE before step 5.
Update docs/pending-fernando.md in the same PR on any Fernando item.
End with a handoff addendum <=120 lines + regenerated kickoff <=15.
```
