# Implementation plan — Issue #116: the ADR status lifecycle

**Issue:** [#116](https://github.com/fernandolisboa/miolos/issues/116) — *Records: flip the eight shipped ADRs off Proposed, and write the status lifecycle rule* (the issue's title, quoted; the set is nine — §0.1)
**Branch:** `docs/116-adr-status-lifecycle` (off `main` @ `8650cf9`)
**ADR:** none new. Nine status flips, six status-line normalizations, two reciprocal supersession headers, one tense parenthetical — all header lines except the parenthetical, all listed by file in §5.
**Test ids:** none. No test file is created or edited; the `docs/agents/test-ids.md` frontier does not move.
**Revision:** step 4 — the step-3 review (ACCEPT WITH FIXES) applied in full; §12.9 lists every change by finding id. §12 is the deviation register.

Every count and date in this plan was produced on this tree at `8650cf9` by the command printed beside it. None is copied from the issue, from ADR-0057 consequence (e) or from plan 049 §8 R2 — the issue itself asks for the list to be re-derived rather than trusted, and the re-derivation changed it (§0.1).

---

## 0. What this plan inherits, and what it corrects

### 0.1 Corrections to the issue, re-derived on this tree

1. **The set is nine, not eight.** ADR-0057 sits at `Proposed` and its code shipped in #117 on 2026-08-17. The issue's "eight" is a snapshot taken before #117 merged; ADR-0057 consequence (e) predicted exactly this decay and named itself as the ninth. The issue's own scope item 3 ("re-derive rather than trust this list") is what makes this a correction rather than a contradiction.

   ```
   grep -h "^\*\*Status" docs/adr/*.md | sed 's/ —.*//' | sort | uniq -c
        42 **Status:** Accepted
         9 **Status:** Proposed
   ```

2. **Six ADRs have no `**Status:**` line at all.** `0019`, `0020`, `0021`, `0023`, `0024`, `0025` carry `Status: accepted` (0021: `- Status: accepted`) plus a separate `Date:` line. They are outside the flip set (they are accepted) but **the acceptance criterion's own grep is blind to them** — `grep -H "^\*\*Status" docs/adr/*.md` sees 51 files, not 57. That is a second instance of "the field is misleading in both directions" (§3 D3).

   ```
   grep -h "^-\? *Status:" docs/adr/*.md | sort | uniq -c
         1 - Status: accepted
         5 Status: accepted
   ```

3. **Every accepted ADR carries the date it was drafted and was born accepted in its adding commit — but not every one was born with code.** The mapping, by adding commit (`git log --diff-filter=A --format=%h -- <file>`, then `git show --name-only`): **ADR-0001–0015 were born `Accepted` in docs-only decision PRs** — #2 (`1c14f06`: ADR-0001/0002, two research docs, `.gitignore`), #5 (`fc0864b`: ADR-0003–0007, `CLAUDE.md`, `README.md`, the design brief) and #8 (`7f8a70f`: ADR-0008–0015, `CONTEXT.md`, the skills tree) — grilling and spec decisions with no implementing code at all; **ADR-0016 onward were all born accepted in the feature or fix PR that carried their code** — 27 with `**Status:** Accepted` and the six lowercase ones of §0.1.2 (`git show <adding commit> | grep '^+\*\*Status'` on `e52c501`, `0c5d5d5`, `b308349`, `a166401`, `39b0341`: all `+**Status:** Accepted — …`; every adding commit from 0016 on touches `apps/`, `packages/` or `.github/`); the nine of §0.1.1 are `Proposed`. The drafted date equals the merge date except where drafting spilled past midnight (0025, 0036, 0044: file −1 day). So the tree already has one date meaning — the day the ADR reached its status — with a known ≤1-day drift on pre-rule files, and two populations the rule must define `Accepted` for: ADRs with implementing code and decision-only ADRs. §3 D2, D10 and §4 do both explicitly rather than by accident.

4. **No commit in the repo has ever changed a `**Status:**` value.** `git log -p --format='COMMIT %h %s' -- docs/adr | grep -E "^-\*\*Status"` is empty. #116 makes the first status transition in 57 ADRs; there is no precedent to copy, which is why the rule (§4) is written before the flips (§11).

### 0.2 What the tree already does that the rule codifies

The trigger the issue proposes — *"the pull request that merges the implementing code flips it in the same commit"* — is what every ADR from 0016 on already did, in the degenerate form "born Accepted in the code's PR"; ADR-0001–0015 did the decision-only variant — born `Accepted` in the docs-only PR that carried them, there being no code to wait for (§0.1.3). The nine are the anomaly: ADRs drafted as `Proposed` at steps 2–4 of the flow and never revisited before their PR merged. The rule therefore mostly writes down majority behaviour; the genuinely new claims are (i) what `Accepted` means for a flip made after the fact and for a decision-only ADR (D2, D10, D11), (ii) Superseded/Withdrawn, which have zero instances, and (iii) who checks.

Amendment already has a strict reciprocal idiom (`**Amends:**` ↔ `**Amended by:**`, `.claude/napkin.md` Execution #5; worked example ADR-0055 ↔ ADR-0057). Supersession has a one-way idiom only: `docs/adr/0001-web-is-the-launch-platform.md:4` says `**Superseded in part by:** ADR-0003 (identity), ADR-0004 (offline caching)` while ADR-0003 and ADR-0004 carry no back-pointer, and ADR-0001's status stays `Accepted`. §3 D5 reconciles the rule with that.

---

## 1. Scope & non-goals

### In scope

- The nine flips, each with the merge date and the shipping PR (D1, D2).
- The lifecycle rule in `docs/agents/domain.md`, drafted in full in §4: what each status means (for ADRs with code and for decision-only ADRs), who flips, on what trigger and when in the flow, what supersession and withdrawal do, what amendment does not do, who checks (D4–D6, D8, D10, D11).
- Normalizing the six lowercase status lines to the bold form so the field has one shape and one grep (D3).
- The reciprocal `**Supersedes in part:**` lines on ADR-0003 and ADR-0004 that the rule's reciprocity clause requires (D5).
- The one record the rule falsifies — ADR-0057 consequence (e)'s present-tense "Nothing in `docs/agents/domain.md`… names a lifecycle" — corrected with a bracketed parenthetical (D7, §6).
- A one-sentence pointer in `CLAUDE.md` and a one-clause addition to `.claude/napkin.md` Execution #5, so the rule is reachable from the two places an agent actually reads (D9).
- This plan and its `docs/README.md` row (napkin Parallel-Stream #1).

### Explicitly out of scope, with reasons

- **Re-opening any decision.** Only status lines, header cross-reference lines and one parenthetical move; no decision text is touched. §12 item 1 states where this plan deviates from the literal wording "no ADR body changes" and why.
- **Re-dating the 42 pre-rule Accepted ADRs.** Their drafted dates are within one day of their merges; a 42-file diff to move three dates by one day buys nothing the rule's grandfather clause (§4) does not already state.
- **Normalizing the five `# NNNN —` H1s** (`0019`, `0020`, `0023`, `0024`, `0025` — `# 0019 —` rather than `# ADR-0019 —`; `grep -L "^# ADR-" docs/adr/*.md`). The H1 carries no lifecycle claim and no acceptance grep reads it. Recorded as a known residual (§12 item 4), not fixed.
- **A mechanical checker.** Declined with reasons (D8), and the reason is written into the rule so nobody re-derives it.
- **The ten `docs/README.md` plan rows saying "recorded as proposed ADR-00NN"** — accurate descriptions of what each plan contains (§6).
- **Any snapshot document** — plans, handoffs, review-round findings — per `docs/README.md:21` (§6).

---

## 2. The facts this plan turns on

### 2.1 The nine, with provenance

"Merge date" is the author date of the squash-merge commit on `main`, `-0300`. Cross-checked against `gh pr view <PR> --json mergedAt` (UTC): #112 → `2026-08-16T14:30:51Z` = `0157689` `2026-08-16 11:30:51 -0300`; #94 → `2026-08-14T15:25:56Z`; #95 → `2026-08-14T19:02:29Z`.

```
for n in 0046 0047 0050 0052 0053 0054 0055 0056 0057; do
  f=$(ls docs/adr/$n*.md)
  echo "$n $(git log --diff-filter=A --format='%h %ad %s' --date=format:'%Y-%m-%d %H:%M %z' -- "$f")"
done
```

| ADR | Drafted date in file | Adding commit | Shipping PR (issue) | Merge date (SP) | Code in the same PR? |
|---|---|---|---|---|---|
| 0046 | 2026-08-12 | `f348aa1` | #81 (#28) | 2026-08-12 23:05 | Yes — `apps/web/app/modo-livre/**` |
| 0047 | 2026-08-12 | `f348aa1` | #81 (#28) | 2026-08-12 23:05 | Yes — bundle-marker tests, `route-client-js.mjs` |
| 0050 | 2026-08-13 | `878a919` | #88 (#21) | 2026-08-13 18:04 | Yes — `apps/api/app/attach/**`, migration |
| 0052 | 2026-08-14 | `7817519` | #92 (#30) | 2026-08-14 01:13 | Yes — `apps/api/app/medals/route.ts`, grants table |
| 0053 | 2026-08-14 | `d4d8655` | **#94 and #95** (#31) | 2026-08-14 12:25 / 16:02 | **Split by design** — #94 the write window and the ADR, #95 the `/arquivo` routes; the ADR's own decision records the two-PR ordering |
| 0054 | 2026-08-15 | `9368518` | #105 (#34) | 2026-08-15 10:48 | Yes — OG routes, share composer |
| 0055 | **2026-08-15** | `0157689` | #112 (#107) | **2026-08-16** 11:30 | Yes — the three ESLint wall suites, Binairo generate test. **The one ADR whose date changes.** |
| 0056 | 2026-08-16 | `aa2fac2` | #113 (#96) | 2026-08-16 13:01 | Yes — `apps/web/app/arquivo/day-card.tsx`, `day-view.tsx` |
| 0057 | 2026-08-17 | `ea2ac36` | **#117** (#114, absorbing #110) | 2026-08-17 20:53 | Yes — `turbo.json`, `ci.yml`, `packages/db/src/testing.ts`. Corrected the same evening by #118 (`f684447`, 21:15) and #120 (`36b82b2`, 23:12), both of which annotated this ADR's body and neither of which touched its status line |

### 2.2 The six lowercase-status ADRs

| ADR | Lines 3–4 today (0021: 3–6) | H1 | Merge date |
|---|---|---|---|
| 0019 | `Status: accepted` / `Date: 2026-07-31` | `# 0019 —` | 2026-07-31 |
| 0020 | same | `# 0020 —` | 2026-07-31 |
| 0021 | `- Status: accepted` / `- Date: 2026-07-31` / `- Issue: [#24](…)` / `- Plan: [docs/plans/012-…](…)` | `# ADR-0021 —` | 2026-07-31 |
| 0023 | `Status: accepted` / `Date: 2026-07-31` | `# 0023 —` | 2026-07-31 |
| 0024 | `Status: accepted` / `Date: 2026-07-31`, then `**Amended by:** ADR-0053` on line 5 | `# 0024 —` | 2026-08-01 01:41 (file −1 day) |
| 0025 | `Status: accepted` / `Date: 2026-07-31` | `# 0025 —` | 2026-08-01 01:41 (file −1 day) |

### 2.3 Guards

None reads `docs/adr`. `docs/` is in `.prettierignore`; ESLint has no markdown processor; no test under `apps/*/test` or `packages/*/test` opens an ADR (`grep -rn "docs/adr" --include='*.ts' --include='*.tsx' --include='*.mjs'` → one TSDoc citation in `packages/games/src/termo/index.ts`, one alert string in `.github/workflows/buffer-alert.yml`). The CI `gate` has no `paths:` filter and runs the full typecheck/test/build/lint on a docs-only PR (7m04s on #121); it must be green, and it will be, because nothing it runs reads what changes.

---

## 3. Decisions register

### D1 — The set is nine, named, and ADR-0057 is in it

0046, 0047, 0050, 0052, 0053, 0054, 0055, 0056, **0057**. Named as a mapping in §5, never as a count, because ADR-0057's own header insists on it and because the count is exactly what rotted between the issue and this plan. ADR-0057 is the ADR whose consequence (e) declined the single flip; flipping it *with* the other eight is what that consequence asked for, so its status line moves in the same commit that leaves its (e) bullet's decision standing (§6 states the asymmetry).

### D2 — The Accepted line carries the merge date **and the shipping PR**; `(issue #N)` survives

The one form, for the nine and for every `Accepted` line written under the rule from now on — after-the-fact flips and born-`Accepted` ADRs alike (D11):

```
**Status:** Accepted — <YYYY-MM-DD, America/Sao_Paulo merge date> (issue #N, shipped in #PR)
```

Reasons, in order of weight:

1. **Provenance, in one token.** The issue asks for the shipped date; `shipped in #PR` names the PR whose merge *is* that date, so the line is auditable in one command — `gh pr view <PR> --json mergedAt` — for about fifteen characters. It is not what disambiguates a date *semantics*: under the rule's own sentence the date has one meaning (the day the ADR reached that status), and a pre-rule born-Accepted ADR's drafted date already carries that meaning, with a known ≤1-day drift on three files (§0.1.3, grandfathered in §4). What a bare date cannot say is *which PR* — and for 0053, *which two*.
2. **It disambiguates the two split ships without prose.** 0053 says `shipped in #94 and #95`; 0057 says `shipped in #117`. A reader who wants to know why does not have to find this plan.
3. **`(issue #N)` stays.** It costs nothing; the 42 lack it only because nobody thought to add it, not because a rule forbids it; and losing provenance on a flip would be a records ticket deleting a record.
4. **It makes a future checker cheap, should D8 ever be reversed**: every `Accepted` line written under the rule carries `shipped in #` — born-`Accepted` lines included (D11) — so the post-rule population is one and greppable, and its provenance is one `gh` call away.

Rejected alternatives: **(a)** bare `Accepted — <merge date>` matching the 42 — the same status, but 0053's two-PR fact and 0057's #117-not-#118 fact would then live only in this plan, and D8's reversal trigger would have nothing to grep; **(b)** `Accepted — <drafted date> (issue #N)`, keeping the 42's convention — contradicts the issue's scope item 1 outright and would leave 0055 with a date a day before its own code existed on `main`.

**Per-ADR citation, decided:**

- **0053 → `2026-08-14 (issue #31, shipped in #94 and #95)`.** "Accepted" means the implementing code is on `main`; for a ticket that ships in two PRs by the ADR's own decision, that is not true until the second one. Both PRs are cited because both carried the code; the date is the same either way. This is also the worked example the rule gives for split ships.
- **0057 → `2026-08-17 (issue [#114](…), absorbing [#110](…), shipped in #117)`.** #117's merge is the commit that put the cap, the instrument and the ADR on `main`; #118 and #120 are corrections to that decision, and each already annotated the ADR's body in place — which is amendment, and **amendment does not move the Accepted date** (§4). Citing #117 alone is the rule applied, not an omission; the plan and the PR body say so once. The existing markdown-link style of 0057's issue references is kept as-is (minimal diff); the PR reference is bare `#117` like the other eight.
- **0055 → `2026-08-16 (issue #107, shipped in #112)`.** The only flip that changes the date (file says 08-15; merged 08-16). Its `**Amended by:** ADR-0057` header at line 4 and the (a)–(i) mapping at lines 5–13 are untouched — an amended Proposed ADR flips on its own code, which shipped in #112, and its later amendment by #117 neither blocks nor moves that.
- The other six carry the merge date, which equals their drafted date.

**The pre-rule ADRs are grandfathered, in writing.** The rule (§4) says the 42 bold and the six normalized carry the drafting date, within one day of the merge, and are not re-dated and carry no `shipped in`; ADR-0001–0015 are `Accepted` because the docs-only PR that carried them merged (D10) — no re-labelling. Not touched here.

### D3 — Normalize the six lowercase status lines — the status line only

`Status: accepted` + `Date: YYYY-MM-DD` (and 0021's bulleted variant) become one line, `**Status:** Accepted — YYYY-MM-DD`, at line 3. H1s and bodies untouched. Reason, in order of weight: **first**, the rule's own shape clause — "line 3 is the status line, in this shape, and no separate `Date:` line" — would be false of six files the moment it landed, in the very PR that cites the falsified-record standard; **second**, the acceptance criterion's grep, `grep -H "^\*\*Status" docs/adr/*.md`, silently omits those six on today's tree, so a criterion meant to prove "the field now means something" would be proved over 51 of 57 files — the same failure the issue describes, a field that reads as complete and is not. (The grep passes literally either way, since the six are accepted; it is the shape clause that forces the fix.) Six one-for-two line swaps close both.

Semantics are unchanged: these six keep the drafted date under the grandfather clause (no `shipped in`), because normalization changes shape, not meaning. 0025's date stays `2026-07-31` (merged 08-01 01:41) for the same reason 0036 and 0044 keep theirs.

**Is this a body change?** No — it is the header, and the issue's non-goal is about not re-opening decisions. Stated in §12 item 2 so the reviewer sees it was weighed. Step 3 accepted this (review B3, with the reordering of reasons above); had it not, the fallback was to leave the six and add a sentence to the rule saying they are pre-rule shape — the fix is smaller than the sentence.

0021's four bullets fold into two bold lines (issue into the status line's parenthesis, plan onto its own `**Plan:**` line), so no information is lost and the file's line 3 is its status line like every other ADR (§5 gives the exact text).

### D4 — The rule lives in `docs/agents/domain.md`, as a new section after "Flag ADR conflicts"

`CLAUDE.md:21` already routes "Domain docs" to `docs/agents/domain.md`, and that file is the one every step-1 agent reads before touching an ADR. It is the shortest living doc (37 lines) and the new section is proportionally large; that is acceptable because it is the first repo-specific ADR rule the file carries and the file's other sections are generic skill-consumption guidance. Not `CLAUDE.md` (a pointer only, D9), not `docs/README.md` (it classifies documents, it does not govern their fields), not a new `docs/adr/README.md` (would create a third home and a new file to keep in sync).

### D5 — Superseded: whole flips the status, partial adds a header line; both are reciprocal

- **Full supersession** flips the status: `**Status:** Superseded — <date> (issue #N; by [ADR-NNNN](…), shipped in #PR)` — `(issue #N)` survives, as on every other status, because a flip that drops the provenance would be a records ticket deleting a record — made by the PR that ships the superseding ADR; the superseding ADR carries `**Supersedes:** [ADR-MMMM](…)`.
- **Partial supersession keeps `Accepted`** and adds `**Superseded in part by:** [ADR-NNNN](…) (<which part>)` on the older ADR — which is what ADR-0001 already does — and the newer ADR carries the reciprocal `**Supersedes in part:** [ADR-MMMM](…) — <which part>`.
- **The reciprocals for the one existing case are added now**: ADR-0003 and ADR-0004 each gain one `**Supersedes in part:**` header line pointing at ADR-0001. Reason: the rule's reciprocity clause is the amendment idiom's (napkin Execution #5) applied to supersession, and a records ticket that writes "reciprocal" while the tree's only instance is one-way ships a rule the tree violates on day one. Two header lines, in the existing `**Amends:**` idiom (target, one dash, the part — the part named by ADR-0001's own Consequences bullet, since 0001 has no "identity line" as such: line 28 *"Resolved by ADR-0003"*, line 29 *"narrowed by ADR-0004"*); they mirror ADR-0001's header rather than re-adjudicating whether "superseded in part" was the right verb in July — that is not this ticket's question. **The rule's worked example cites ADR-0003 alone**: identity was replaced wholesale, which is what the rule's own Amended-vs-Superseded test calls supersession; by that same test ADR-0004's "narrowed" is closer to an amendment, so ADR-0001's 0004 pointer is named in the rule as a pre-rule label kept as written, and 0004's reciprocal mirrors that label. This is the one item in §5 a reviewer may strike without touching the acceptance criteria (step 3 kept it, review E1); if struck, the rule gains "ADR-0001's pre-rule pointer is one-way and grandfathered".
- `Superseded` is not used for a partial change; that is what `**Amended by:**` is for when the older decision stays in force with a narrowed sentence, and `**Superseded in part by:**` when one of its decisions is replaced outright. The rule says so in one line so the two are not confused.

### D6 — Withdrawn: Proposed only, flipped by the PR that abandons it, reason inline

`**Status:** Withdrawn — <date> (issue #N; <one-line reason>)`, made by the PR that abandons the code — the plan dropped, the decision measured and rejected — or, when the ticket closes with no PR at all, by a docs-only PR opened for the purpose: a session cannot flip anything on `main`, only a PR can. The file is kept: a recorded rejection is a decision too (ADR-0057's teardown-registry bullet is the in-body precedent for keeping a rejected proposal on record). Withdrawn is not for an Accepted decision that is later reversed — that is Superseded by the reversing ADR. Zero instances today; pure forward-looking text, kept to four sentences.

### D7 — ADR-0057 consequence (e) gets one bracketed parenthetical; nothing else in any ADR body moves

The clause *"Nothing in `docs/agents/domain.md`, `docs/README.md`, `CLAUDE.md` or the napkin names a lifecycle, an owner for the flip or a trigger"* is a present-tense claim about the tree, in a **living** document (`docs/README.md:15`), and #116 makes it false. The falsified-record standard (napkin Execution #5) is a repo rule: the correcting record is owed in the same round. The issue's non-goal "no ADR body changes" exists to keep decisions closed, not to keep a consequence bullet wrong; a bracketed tense parenthetical is a record correction, not a decision change, and it is the idiom this repo already uses on living records (ADR-0014:7's *"(ADR-0053 landed in #31's first pull request…)"*, ADR-0055 (a)–(i) "annotated in place; nothing is deleted"). Weighed and taken. Exact text in §5; deviation stated in §12 item 1.

Everything else in (e) stays true after #116 and is left: *"untouched **here**"* refers to #114; the membership list is self-dated ("a snapshot with a known decay") and, re-derived, correct — nine including 0057; *"every ADR filed between this one and #116 joins it"* — none was, and the sentence is true vacuously.

### D8 — No mechanical checker; the step-6 ADR reviewer owns it, and the trigger for reversing this is written down

Declined, for four reasons that are all evidence rather than preference:

1. **"Shipped" is not derivable from the file.** The honest mechanical form is a git query — "no ADR whose adding commit is an ancestor of `main` may be `Proposed`" — and that query is **wrong on exactly the cases the rule makes legitimate**: a two-PR ticket's first PR (0053's shape) and a decision recorded ahead of its ticket. A checker that needs an allowlist to pass on the legitimate cases is a text scan with a judgment call bolted on, and the judgment call is the whole check.
2. **The transition has misfired once in 57 ADRs, systemically, not stochastically.** Nine ADRs went stale for one reason — no rule said whose job the flip was — and every one of them was drafted after the eight-step flow began writing ADRs at step 2. Once the rule names the owner (the agent driving the shipping PR, writing the flip into that PR's reviewed diff at step 5, with the code — D11) and the reviewer (step 6's ADR-adherence lens), the cause is removed rather than guarded.
3. **There is nowhere for it to live.** No test reads `docs/adr`; `docs/` is Prettier-ignored; ESLint has no markdown processor. The first doc-scanning test would be built for a check that fires on a docs field.
4. **The ADR-0047 precedent (napkin) is for mechanical inputs** — a bundle marker either is or is not in a chunk. "This ADR's code is on `main`" is not that kind of input.

**What would change the decision:** a second records sweep finding a shipped ADR still `Proposed` after the rule exists. At that point the cheapest honest checker is the D2 form's own grep — every `Accepted` line written under the rule carries `shipped in #` — plus a `Proposed`-older-than-N-days allowlisted scan; both are cheap because D2 made the field carry its own evidence. The rule (§4) records the decline in one sentence and this trigger in one clause, so the next person does not re-derive it.

### D9 — One sentence in `CLAUDE.md`, one clause in `.claude/napkin.md`; nothing else

- **`CLAUDE.md`, "When in doubt", the line *"New technical decision of any weight → propose an ADR before implementing, even a short one."*** is the sentence that opens the loop (it is where `Proposed` comes from) and the only place in `CLAUDE.md` that mentions proposing. One sentence appended closes it: it stays `Proposed` until the PR that ships its code flips it to `Accepted` in that same diff; owner, forms and edge cases in `docs/agents/domain.md` (the timing lives only there — step 7 trimmed the pointer to the trigger word, §12 item 11). Under "When in doubt" rather than "Domain docs" because that is where the reader is when the question arises; "Domain docs" already points at the file. No change to the eight-step flow text — the line is written inside the PR's reviewed diff (D11) and step 8's merge is what discharges the trigger; the rule says so, and adding it to `CLAUDE.md`'s step list would be a second copy of the rule.
- **`.claude/napkin.md` Execution #5** (falsified-record standard) gains one clause: a `Proposed` ADR whose code ships in this PR is flipped in this PR's diff, merge-dated and citing the PR. Reason: #5 is the item that tells step-6 reviewers what to reject on records, and D8 gives the reviewer the job; the napkin is where reviewer teeth live in this repo. Placed at the **end** of the item's "Do instead" (before its closing "Reviewers reject…" sentence, which becomes "any of these"), not after "named in the plan's exit criteria" — a clause there would sit between that phrase and the "a corrected *sufficiency claim*…" clause that refers back to "the correcting record" and break the reference. One clause, no new item, no category cap touched.
- **`CONTEXT.md`, `PRODUCT.md`, `DESIGN.md`, `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, `docs/agents/test-ids.md`** — none mentions the status field (§6); nothing owed.

### D10 — A decision-only ADR is `Accepted` when the PR that carries it merges

"Accepted — the implementing code is on `main`" is undefined for an ADR that has no implementing code of its own: a product, platform or policy decision recorded from a grilling or wayfinder session — the shape of ADR-0001–0015 (§0.1.3) and the shape the monetization and native-client wayfinders will produce. Left undefined, two agents give two answers (`Proposed` forever, "no code on `main`"; or `Accepted` on merge, "the decision is adopted"). Decided: **such an ADR is `Accepted` when the pull request that carries it merges, and its `shipped in` cites that PR.** That is what ADR-0001–0015 already did in the docs-only PRs #2, #5 and #8, so the rule again writes down existing behaviour; the fifteen are grandfathered as-is (drafted date, no `shipped in`). One sentence in the rule's Accepted bullet (§4).

### D11 — Every `Accepted` line written under the rule carries `shipped in #PR`; the flip is written at step 5, with the code, and the merge discharges it

Two things the first revision left to inference, decided:

1. **One population going forward.** Every `Accepted` line written under the rule — an after-the-fact flip, a born-`Accepted` code ADR, a decision-only ADR — carries `shipped in #PR`, added once the PR number exists (it exists only after `gh pr create`), in that same PR. Otherwise the field would carry two post-rule shapes and D2 reason 4 and D8's reversal trigger ("every `Accepted` line written under the rule carries `shipped in #`") would be false. The pre-rule lines are grandfathered exactly as-is (drafted date, no `shipped in`).
2. **When the line is written.** Not at step 8: the step-6 ADR-adherence reviewer is the checker (D8), and cannot check a line that does not exist yet; and a commit pushed after "everything green" re-triggers the `pull_request` gate (napkin Execution #10 — runs auto-cancel on push), so a step-8 flip would have to re-earn the green it was waiting for. **The flip is written into the PR's own diff at step 5, with the code — dated with the day the PR is expected to merge, and re-dated on the PR's last push if that day has changed** (that correction rides the last review-fix push, not an extra one). Step 8's merge is what discharges the trigger; the step-6 reviewer checks that every ADR whose implementing code is in the PR carries the flip in the PR, and a step-6 round that finds it missing sends it to step 7 like any other finding. *(Step 7: "no later than step 7 — before the final review round" was the step-4 wording; "final review round" is decidable only after the fact, so the step is named instead — §12 item 11.)* The residual — a slip past São Paulo midnight between the last green gate and the merge click — is §12 item 6.

---

## 4. The rule text, in full

Appended to `docs/agents/domain.md` after the "Flag ADR conflicts" section (i.e. at end of file), verbatim:

````markdown
## ADR status lifecycle

Line 3 of every ADR is its status line; status and date live nowhere else (no `Date:` line, no status in the H1). The date is the `America/Sao_Paulo` day the ADR reached that status and moves only when the status moves. The four forms:

```
**Status:** Proposed — <drafting day> (issue #N)
**Status:** Accepted — <merge day> (issue #N, shipped in #PR)
**Status:** Superseded — <merge day> (issue #N; by [ADR-NNNN](…), shipped in #PR)
**Status:** Withdrawn — <merge day> (issue #N; <one-line reason>)
```

- **Proposed** — drafted with the plan (steps 2–4); its code is not on `main`. It stays `Proposed` on `main` only while that holds — the first PR of a two-PR ticket.
- **Accepted** — its code is on `main`; a decision-only ADR (no code of its own, e.g. ADR-0001–0015) when the PR carrying it merges, and a later ticket that implements it leaves its status alone. **Owner:** the agent driving that PR writes the flip into the PR's diff at step 5, with the code, dated with the day the PR is expected to merge and re-dated on the PR's last push if that day has changed. A ticket shipping as several PRs flips on the one that completes the code and cites them all (`shipped in #94 and #95`, ADR-0053).
- **Superseded** — a later ADR replaces the decision as a whole. Flipped in the PR that ships the superseding ADR (that PR is the `shipped in`; `issue #N` stays the superseded ADR's own); the superseding ADR carries `**Supersedes:** [ADR-MMMM](…)`. **Partial replacement keeps `Accepted`:** the older ADR gains `**Superseded in part by:** [ADR-NNNN](…) (<which part>)`, the newer `**Supersedes in part:** [ADR-MMMM](…) — <which part>` (ADR-0001 ↔ ADR-0003). Use `**Amended by:**` when a sentence of the older decision is narrowed or corrected and the decision stands; `**Superseded in part by:**` when one of its decisions is replaced outright.
- **Withdrawn** — a `Proposed` ADR whose code will not merge. Flipped by the PR that abandons it, or by a docs-only PR when the ticket closes with no PR; the file is kept. A reversed `Accepted` decision is `Superseded` by the reversing ADR, never `Withdrawn`.

**Amendment moves neither status nor date.** `**Amends:**` on the amending ADR, the reciprocal `**Amended by:**` plus an in-place annotation on the amended one, in the same commit (ADR-0055 ↔ ADR-0057).

**Pre-rule lines** — `Accepted` with a drafting day and no parenthetical at all (0021's `(issue #24)` aside), and ADR-0001's pointer to ADR-0004, mirrored on ADR-0004 rather than re-adjudicated — are left as written.

**Who checks:** the step-6 "adherence to the ADRs and `CONTEXT.md`" reviewer, against the PR — every ADR whose code is in the PR carries the flip; every ADR the PR amends carries the reciprocal header; anything left `Proposed` has no code on `main`. No mechanical checker; a later sweep finding a shipped ADR still `Proposed` is the trigger to add one (plan 052 D8).
````


Three properties of this text the reviewer should check rather than take on faith: (1) every claim it makes about the tree is true **after** §5 lands and false before it — line 3 (six files), reciprocity (0003/0004), the nine's form; (2) it names owner (the agent driving the shipping PR, writing the flip into that PR's diff at step 5, with the code), trigger (the merge of the implementing code — or, for a decision-only ADR, of the PR that carries it), and checker (the step-6 ADR reviewer), which is what the issue's acceptance item 2 asks for; (3) it defines `Accepted` for both populations of §0.1.3 and gives `shipped in #PR` one population going forward (D10, D11). The block above is the text as it stands after step 7 (§12 item 11); the outer fence is four backticks because the rule now carries a fenced block of its own.

---

## 5. Exact file list

Every ADR change below is a header line except the ADR-0057 parenthetical. "→" gives the exact new text; the old text is what the tree has at `8650cf9`.

### Modified — the nine flips (line 3 in each)

| File | New line 3 |
|---|---|
| `docs/adr/0046-free-play-routes-levels-and-the-ephemeral-session.md` | `**Status:** Accepted — 2026-08-12 (issue #28, shipped in #81)` |
| `docs/adr/0047-bundle-markers-are-route-scoped.md` | `**Status:** Accepted — 2026-08-12 (issue #28, shipped in #81)` |
| `docs/adr/0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md` | `**Status:** Accepted — 2026-08-13 (issue #21, shipped in #88)` |
| `docs/adr/0052-medals-are-derived-facts-plus-curated-grants.md` | `**Status:** Accepted — 2026-08-14 (issue #30, shipped in #92)` |
| `docs/adr/0053-the-archive-is-a-public-past-only-read-and-a-late-write.md` | `**Status:** Accepted — 2026-08-14 (issue #31, shipped in #94 and #95)` |
| `docs/adr/0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md` | `**Status:** Accepted — 2026-08-15 (issue #34, shipped in #105)` |
| `docs/adr/0055-test-timeouts-are-sized-against-contention.md` | `**Status:** Accepted — 2026-08-16 (issue #107, shipped in #112)` — **date changes** from the file's 08-15; lines 4–13 (`**Amended by:**` and (a)–(i)) untouched |
| `docs/adr/0056-the-record-snapshot-cache-is-per-key-and-the-done-chip-wears-the-hub-word.md` | `**Status:** Accepted — 2026-08-16 (issue #96, shipped in #113)` |
| `docs/adr/0057-the-test-suites-memory-model-and-a-cap-that-binds-locally.md` | `**Status:** Accepted — 2026-08-17 (issue [#114](https://github.com/fernandolisboa/miolos/issues/114), absorbing [#110](https://github.com/fernandolisboa/miolos/issues/110), shipped in #117)` |

### Modified — the six normalizations (D3)

| File | Old (lines 3–4; 0021: 3–6) | New |
|---|---|---|
| `docs/adr/0019-per-game-subpath-exports-in-packages-games.md` | `Status: accepted` ⏎ `Date: 2026-07-31` | `**Status:** Accepted — 2026-07-31` (one line; line 4 becomes the blank before `## Context`) |
| `docs/adr/0020-binairo-ruleset.md` | same | `**Status:** Accepted — 2026-07-31` |
| `docs/adr/0021-nonogram-pictures-are-a-curated-motif-library.md` | `- Status: accepted` ⏎ `- Date: 2026-07-31` ⏎ `- Issue: [#24](https://github.com/fernandolisboa/miolos/issues/24)` ⏎ `- Plan: [\`docs/plans/012-issue-24-plan-nonogram-engine.md\`](../plans/012-issue-24-plan-nonogram-engine.md)` | `**Status:** Accepted — 2026-07-31 (issue [#24](https://github.com/fernandolisboa/miolos/issues/24))` ⏎ `**Plan:** [\`docs/plans/012-issue-24-plan-nonogram-engine.md\`](../plans/012-issue-24-plan-nonogram-engine.md)` |
| `docs/adr/0023-proved-not-sampled-property-testing.md` | `Status: accepted` ⏎ `Date: 2026-07-31` | `**Status:** Accepted — 2026-07-31` |
| `docs/adr/0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md` | `Status: accepted` ⏎ `Date: 2026-07-31` (line 5 `**Amended by:** ADR-0053…` follows) | `**Status:** Accepted — 2026-07-31`; the `**Amended by:**` line becomes line 4, unchanged |
| `docs/adr/0025-remote-config-is-a-database-table.md` | `Status: accepted` ⏎ `Date: 2026-07-31` | `**Status:** Accepted — 2026-07-31` |

H1s (`# 0019 —`, `# 0020 —`, `# 0023 —`, `# 0024 —`, `# 0025 —`) untouched (§1, §12 item 4). Bodies untouched.

### Modified — the two reciprocal supersession headers (D5)

| File | Insert after the `**Depends on:**` line (new line 5) |
|---|---|
| `docs/adr/0003-anonymous-first-identity-with-email-recovery.md` | `**Supersedes in part:** [ADR-0001](./0001-web-is-the-launch-platform.md) — its anonymous-first "device → JWT" identity assumption (ADR-0001, Consequences: "Resolved by ADR-0003").` |
| `docs/adr/0004-no-unpublished-puzzle-reaches-the-client.md` | `**Supersedes in part:** [ADR-0001](./0001-web-is-the-launch-platform.md) — its offline-caching scope (ADR-0001, Consequences: "narrowed by ADR-0004").` (placed before the existing `**Supersedes:** the offline caching line in […handoff…]` line, so ADR-to-ADR precedes ADR-to-handoff) |

The idiom is the existing `**Amends:**` one — target, one dash, the part — with no rule commentary in the header ("ADR-0001 stays Accepted" is what the rule says, not what a header says). Inserting a line 5 shifts every later line of 0003/0004 by one; the snapshot citations into them (`docs/plans/020:1572` → `ADR-0004:27`, `022:152` → `ADR-0004:13`, `040:1312` → `0003:33`) are left as written (§6).

ADR-0001 itself: **untouched**. Its status stays `Accepted — 2026-07-29` and its line 4 is already the rule's partial-supersession form.

### Modified — the one body parenthetical (D7)

`docs/adr/0057-the-test-suites-memory-model-and-a-cap-that-binds-locally.md`, consequence (e) (line 123 today), after the sentence *"Nothing in `docs/agents/domain.md`, `docs/README.md`, `CLAUDE.md` or the napkin names a lifecycle, an owner for the flip or a trigger."* insert:

> ` *(True when written; discharged by #116 — the rule is in `docs/agents/domain.md`, and the set named above, this ADR included, is flipped; see line 3.)*`

Nothing else in (e) or anywhere in the body changes.

### Modified — living docs

| File | Change |
|---|---|
| `docs/agents/domain.md` | New section `## ADR status lifecycle` appended after `## Flag ADR conflicts`, text verbatim from §4 |
| `CLAUDE.md` | "When in doubt" bullet *"New technical decision of any weight → propose an ADR before implementing, even a short one."* becomes: `- New technical decision of any weight → propose an ADR before implementing, even a short one. It stays \`Proposed\` until the PR that ships its code flips it to \`Accepted\` in that same diff — owner, forms and edge cases in [\`docs/agents/domain.md\`](./docs/agents/domain.md).` |
| `.claude/napkin.md` | Execution #5, "Do instead:" — its last sentence *"Reviewers reject the absence of either."* is replaced by: `And a \`Proposed\` ADR whose code ships in this PR is flipped to \`Accepted\` in this PR's diff, merge-dated and citing the PR (lifecycle: \`docs/agents/domain.md\`). Reviewers reject the absence of any of these.` — i.e. the clause goes at the end of the item, not after *"named in the plan's exit criteria"* (D9). Ordering of items unchanged; no new item; item #5 stays one line |
| `docs/README.md` | One row appended to the "Current" table after the `adr/0057-…` row (text in §8 R1) |

### Created

- `docs/plans/052-issue-116-plan-the-adr-status-lifecycle.md` (this file)

### Explicitly NOT touched

`docs/adr/0001-…md` · the 42 pre-rule Accepted ADRs' status lines · every H1 · every ADR body other than 0057 (e)'s parenthetical · `docs/plans/**` other than this file (snapshots; plan 049 §8 R2 / :62 / :97 / §12.3 included) · `docs/handoffs/**` (handoff 050 :18/:91/:119 included) · `docs/README.md` rows 62–91 (the ten "recorded as proposed ADR-00NN" plan descriptions, §6) · `CONTEXT.md` · `PRODUCT.md` · `DESIGN.md` · `docs/agents/test-ids.md`, `issue-tracker.md`, `triage-labels.md` · any source, test, config or workflow file · the issue #116 body (living; a closing **comment** carries the nine, §8 R3).

---

## 6. The two-way sweep — every record, as a mapping

Direction 1: what #116 changes → which committed statements it falsifies. Direction 2: what the new rule asserts → which committed statements contradict it. Every record the step-1 sweep classified is here with a disposition; nothing is reported as a count.

| Record | What it says | Class | Disposition |
|---|---|---|---|
| `docs/adr/0057-…md:123` consequence (e), clause *"Nothing in domain.md… names a lifecycle, an owner… or a trigger"* | Present-tense claim about the tree | **(a) living, falsified** | **Corrected** — bracketed tense parenthetical (D7, §5) |
| `docs/adr/0057-…md:123` (e), the rest — *"untouched here"*, the nine named, *"a snapshot with a known decay"*, *"Filed as #116"* | Past-tense scope decision; self-dated membership | (b) stays true | Leave. Membership re-derived as correct. Its line 3 flips in the same commit that leaves the bullet's decision standing — the asymmetry is deliberate: (e) declined the *single* flip and asked for the joint one |
| `docs/adr/0057-…md:3` | `Proposed` | flip set | Flipped (D1, D2) |
| `docs/adr/0055-…md:3` | `Proposed`, on an ADR already amended by 0057 | flip set | Flipped; `**Amended by:**` and (a)–(i) untouched — amendment does not touch status (D2) |
| `docs/adr/0001-…md:4` | `**Superseded in part by:** ADR-0003, ADR-0004`; status `Accepted` | (b) — already the rule's partial form | Leave 0001; **add reciprocals** on 0003/0004 (D5) |
| `docs/adr/0003-…md`, `0004-…md` headers | No back-pointer to 0001 | contradicts the rule's reciprocity clause | One `**Supersedes in part:**` line each (D5, §5) |
| `docs/adr/0019, 0020, 0021, 0023, 0024, 0025` lines 3–4 | `Status: accepted` + `Date:` | contradicts "line 3, this shape" | Normalized (D3, §5) |
| The 42 pre-rule Accepted status lines | bare drafted date | consistent under the grandfather clause | Leave; the rule names them — the 15 decision-only (0001–0015) as `Accepted` on the merge of the docs-only PR that carried them (D10), the rest as born with their code |
| `docs/plans/020:1572` (`ADR-0004:27`), `022:152` (`ADR-0004:13`), `040:1312` (`0003:33`) | line-number citations into ADR-0003/0004, which gain a line 5 | (b) snapshots | Leave; the cited lines shift by one after §5 and the plans are never rewritten (`docs/README.md:21`). Named so the sweep is complete |
| `docs/plans/049-…md` §8 R2 (:693–699), :62, :97, §12 item 3 (:915) | "eight", "no lifecycle rule exists", "#116 … open" | (b) snapshot, true on 2026-08-17 | **Leave** — `docs/README.md:21`: plan bodies are never rewritten; the count was 8 before 0057 merged, which is the very rot 0057 (e) records. Stated so a reviewer does not file it as unswept |
| `docs/handoffs/050-…md:18` (*"#116 Open — the ADR Status: field gap, untouched here"*), :91, :119, :148 (*"Still open and unblocked: #109, #116"*) | #116 open | (b) snapshot | Leave — handoffs are snapshots by rule; #121's addendum precedent shows corrections go in a new §, and #116's closure is not a claim handoff 050 made falsely |
| `docs/README.md:62, 64, 66, 68, 71, 74, 78, 81, 82, 91` — ten plan rows *"…recorded as proposed ADR-00NN"* | describes what each plan contains | (b) living, true | **Leave** — the subject is the plan, and each plan did record its ADR as Proposed. Re-writing ten rows to say "recorded as ADR-00NN, since Accepted" would make the plan descriptions describe the tree instead of the plan. Named as the largest edit surface deliberately not taken |
| `docs/README.md` rows for `adr/0051–0057` | prose summaries, no status | unaffected | Leave |
| `docs/plans/025:658,739`, `027:636`, `029:509`, `031:594`, `010:302,345` and ~70 more hits in plans 017–049 | ADR header drafts and "proposed ADR" phrasing embedded in snapshots | (b) snapshots | Leave. Note for the PR body: `grep -rn '\*\*Status:\*\* Proposed' docs/` outside `docs/adr/` will still hit them; the acceptance grep is scoped to `docs/adr/*.md` for this reason. `027:636`/`029:509` draft ADR-0048/0049 as Proposed and both shipped Accepted — evidence the drafts were never authoritative |
| `docs/agents/test-ids.md:115` *"An earlier revision of plan 049 proposed T-DB-S59…"* | verb | (c) unrelated | Leave |
| `docs/adr/0006:9`, `0032:43`, `0057:104`, `docs/research/004:155`, `docs/handoffs/050:102` | the word "proposed" in an unrelated sense | (c) unrelated | Leave |
| `CLAUDE.md:133` *"propose an ADR before implementing"* | opens the loop, not false | (b) | One sentence appended (D9) |
| `.claude/napkin.md` | no statement about the status field | nothing falsified | One clause added to Execution #5 (D9); no other item touches status |
| `CONTEXT.md`, `PRODUCT.md`, `DESIGN.md`, `docs/agents/issue-tracker.md`, `triage-labels.md` | zero mentions | — | Nothing owed |
| Issue #116 body ("eight", "0046…0056") | living GitHub record | (a)-adjacent | Not edited; the closing comment states the nine and links this plan (issues are living documents; comments, not edits — plan 049 §8 R7 precedent) |
| Issue #114, #107 | closed | — | Nothing owed |

Direction-2 check on the rule's own claims, after §5 lands: "line 3 is the status line" — 57/57 (verification §7 line 5); "no `Date:` line" — 0/57; "reciprocal supersession" — 0001↔0003/0004; "amendment does not change status" — consistent with 0014, 0018, 0024, 0031, 0033, 0041, 0051, 0053, 0055 (all Accepted-or-flipped with `**Amended by:**`); "born Accepted allowed" — consistent with the 42; "a decision-only ADR is Accepted on the merge of the PR that carries it" — consistent with 0001–0015; "Proposed only while code has not merged" — 0/57 remain Proposed.

---

## 7. Verification

All from the worktree root, after §5 is applied and before the PR is opened. Expected output beside each; the PR body pastes the real output.

```
# Acceptance criterion 3 — the only Proposed ADRs are ones that have not shipped
grep -H "^\*\*Status" docs/adr/*.md | grep Proposed
# → (empty)

# The whole field, one shape
grep -h "^\*\*Status" docs/adr/*.md | sed 's/ —.*//' | sort | uniq -c
# →      57 **Status:** Accepted   (58 if #109's ADR-0058 has landed first, still zero Proposed — §10)

# No ADR is invisible to the acceptance grep any more
grep -L "^\*\*Status" docs/adr/*.md
# → (empty)
grep -n "^-\? *Status:\|^-\? *Date:" docs/adr/*.md
# → (empty)

# Line 3 is the status line in every file
awk 'FNR==3 && !/^\*\*Status:\*\* /{print FILENAME}' docs/adr/*.md
# → (empty)

# Exactly the nine carry the new provenance form
grep -l "^\*\*Status:\*\* Accepted — .*shipped in #" docs/adr/*.md | wc -l
# → 9   (10 if ADR-0058 has landed under the rule)
grep -h "^\*\*Status:\*\* Accepted — .*shipped in #" docs/adr/*.md
# → the nine lines of §5, verbatim

# Reciprocals, parenthetical, rule, pointer, napkin clause
grep -c "Supersedes in part" docs/adr/0003*.md docs/adr/0004*.md         # → 1 each
grep -c "discharged by #116" docs/adr/0057*.md                            # → 1
grep -n "^## ADR status lifecycle" docs/agents/domain.md                  # → one line
grep -n "lifecycle" CLAUDE.md .claude/napkin.md                           # → one line each

# The diff touches only §5's files
git diff --stat origin/main | tail -1
# → 22 files changed
git diff --name-only origin/main | sort
# → exactly the §5 list: 17 under docs/adr/ (9 flips — 0057 among them, carrying the parenthetical too — 6 normalizations, 0003, 0004),
#   docs/agents/domain.md, CLAUDE.md, .claude/napkin.md, docs/README.md, docs/plans/052-…md

# No ADR line below a "## Context" heading changed, except 0057 (e)
git diff -U0 origin/main -- docs/adr | grep '^[-+]' | grep -v '^[-+][-+]'
# → status lines, the two Supersedes-in-part lines, 0021's Plan line, the removed Status:/Date: lines, and one 0057 line
```

**Gate** (docs-only, but `gate` has no `paths:` filter and the mechanical gate binds every PR):

```
source ~/.nvm/nvm.sh && nvm use default >/dev/null && \
  pnpm typecheck --force && pnpm lint && pnpm test --force
```

`--force` on `typecheck` and `test` because both are turbo runs and a cached turbo run is a log replay, not evidence (napkin Execution #8); `lint` is bare eslint with no cache. The pre-commit hook will already have run `pnpm typecheck` and `pnpm test` at each commit. `pnpm build`/`bundle-check` and `npx impeccable detect` are not owed: no source file is touched. Napkin Execution #2's `.next` ordering trap does not apply for the same reason.

**Merge-date re-check at step 5**, before writing the nine lines (the dates in §2.1 were derived on 2026-08-18; they cannot change, but the command that produced them is the evidence):

```
for p in 81 88 92 94 95 105 112 113 117; do
  echo "#$p $(gh pr view $p --json mergedAt -q .mergedAt)"
done
# UTC; subtract 3h for America/Sao_Paulo. Cross-check with the adding-commit loop in §2.1.
```

---

## 8. Records

### R1 — `docs/README.md`: one row for this plan (napkin Parallel-Stream #1)

Appended after the `adr/0057-…` row:

```
| `plans/052-issue-116-plan-the-adr-status-lifecycle.md` | Implementation plan for #116 (the ADR status lifecycle: the set re-derived as **nine** rather than eight — ADR-0057 joins, as its own consequence (e) predicted — each flipped to `Accepted` with the merge date of the pull request that shipped it and that PR cited on the line as its provenance; the six lowercase `Status: accepted` + `Date:` headers normalized to the one bold shape so the acceptance grep sees all 57 files; the lifecycle rule for `docs/agents/domain.md` drafted in full — Proposed, Accepted (defined for ADRs with code and for decision-only ADRs, the shape of ADR-0001–0015, which are Accepted when the PR carrying them merges), Superseded whole-or-in-part reconciled with ADR-0001's existing header, Withdrawn, amendment as status-neutral, owner the agent driving the shipping PR with the flip written into that PR's diff at step 5, with the code, and the merge discharging it, checker the step-6 ADR reviewer and no mechanical checker with the reason and the reversal trigger written down; the two reciprocal `Supersedes in part` lines ADR-0003/0004 owed ADR-0001; the two-way sweep as a mapping, with ADR-0057 consequence (e) corrected by one tense parenthetical and every snapshot left as written) |
```

### R2 — PR body template

```
docs: flip the nine shipped ADRs to Accepted, and write the status lifecycle rule (#116)

Documentation only. No source, test, config or workflow file is touched.

## What changed, as a mapping

Flipped Proposed → Accepted, dated with the shipping PR's merge date (America/Sao_Paulo) and citing it:
- ADR-0046, ADR-0047 → 2026-08-12, #81 · ADR-0050 → 2026-08-13, #88 · ADR-0052 → 2026-08-14, #92
- ADR-0053 → 2026-08-14, #94 and #95 (two-PR ship by the ADR's own decision; both cited)
- ADR-0054 → 2026-08-15, #105 · ADR-0055 → 2026-08-16, #112 (the one date that moves; file said 08-15)
- ADR-0056 → 2026-08-16, #113 · ADR-0057 → 2026-08-17, #117 (#118/#120 are amendments; they do not move the date)
Nine, not the issue's eight — ADR-0057 joined between the issue and the work, as its consequence (e) said it would.

Normalized (status line only, dates unchanged, H1s and bodies untouched): ADR-0019, 0020, 0021, 0023, 0024, 0025 — `Status: accepted` + `Date:` → `**Status:** Accepted — <date>`, so the acceptance grep below sees 57 files rather than 51.

Rule: `docs/agents/domain.md` § "ADR status lifecycle" — owner (the agent driving the shipping PR; the flip is written into that PR's diff at step 5, with the code, and the merge discharges it), trigger (the merge of the implementing code — for a decision-only ADR, the merge of the PR that carries it), every `Accepted` line written under the rule carries `shipped in #PR`, Superseded whole/in part, Withdrawn, amendment status-neutral, step-6 reviewer checks it, no mechanical checker (reason inline). Pointer sentence in `CLAUDE.md` "When in doubt"; one clause in napkin Execution #5.

Reciprocals: ADR-0003 and ADR-0004 gain `**Supersedes in part:** ADR-0001`, mirroring ADR-0001's existing one-way header.

Corrected record: ADR-0057 consequence (e) — one bracketed parenthetical marking its "nothing names a lifecycle" clause as discharged. This is the one edit inside an ADR body; it is a tense correction, not a decision change (falsified-record standard).

## Deliberately left, and why
- plan 049 §8 R2 / §12.3, handoff 050 — snapshots, true when written
- docs/README.md's ten "recorded as proposed ADR-00NN" plan rows — describe the plans, which did
- ADR-0001 — already the rule's partial-supersession form (its 0004 pointer named as a pre-rule label); the pre-rule Accepted dates — grandfathered in the rule, ADR-0001–0015's decision-only PRs included
- the `# NNNN —` H1s on 0019/0020/0023/0024/0025 — no lifecycle claim; residual named in plan 052 §12

## Acceptance grep
<pasted output of the §7 block>

## Gate
<pasted: pnpm typecheck --force / pnpm lint / pnpm test --force>
No source files touched, so `npx impeccable detect` is not owed.

Nothing here needs a decision from Fernando: the one judgment call (the `shipped in #PR` form) is argued in plan 052 D2.

Closes #116
```

### R3 — Issue #116

Closed by the PR. One comment before merge: the set is nine (0057 joined), the six normalizations, the rule's location, link to plan 052 — a comment, not a body edit.

### R4 — Handoff

Not owed by this ticket unless the session ends mid-flow; a docs-only records PR that closes in one session leaves nothing a next session must re-derive. If a handoff is written for other reasons, it names #116 closed and points here.

---

## 9. Build sequence

1. Write §4 into `docs/agents/domain.md` first — the rule before the flips, so every flip is an application of a written rule rather than the precedent the rule is later fitted to.
2. The nine flips (§5), the six normalizations, the two reciprocals, the 0057 (e) parenthetical.
3. `CLAUDE.md` sentence, napkin clause, `docs/README.md` row; commit this plan.
4. If #109 has merged to `main` by now (or lands later, before this PR merges — then repeat this step), `git merge origin/main` before the gate (napkin Parallel-Stream #2) and resolve the one guaranteed conflict — the `docs/README.md` row both PRs append after `adr/0057-…` — as both rows, 051's before 052's (§10).
5. Run the §7 verification block; paste into the PR body (the only expected change after step 4 is 57 → 58 on the `uniq -c` line).
6. Run the gate with `--force`; paste.
7. Open the PR with R2's body; step 6 reviewers, one lens each — the ADR-adherence lens is asked specifically to check §4's three properties and the §6 mapping.

Commits: **two** — `docs: write the ADR status lifecycle rule into docs/agents/domain.md (#116)` and `docs: flip the nine shipped ADRs to Accepted, normalize six status lines, add plan 052 (#116)` — or one if the pre-commit's full-suite cost per commit (typecheck + test, several minutes) argues for it. Never `--no-verify`.

---

## 10. Coordination with the #109 sibling

A sibling branch for #109 (*Three tests sit at or over #107's own timeout trigger*, open) may edit `docs/adr/0055-…md`'s **body** — an in-place annotation at decision 2 — and `docs/agents/test-ids.md`. #116 touches `docs/adr/0055-…md` **line 3 only** and does not touch `test-ids.md`. Git will merge these cleanly unless #109's annotation edits line 3 or the `**Amended by:**` block immediately below it; if it does, the conflict is two independent edits and **both survive** — take #116's line 3, take #109's body edit. **The real conflict surface is `docs/README.md`, not ADR-0055**: both branches append one row to the "Current" table immediately after the `adr/0057-…` row (line 92 on `main`), so whichever lands second gets a textual conflict there — resolution is both rows, `plans/051-…` before `plans/052-…`, nothing else. Merge order does not matter otherwise; whichever lands second runs `git merge origin/main` before its gate (napkin Parallel-Stream #2) and re-runs the §7 grep, whose expected output does not change except that `uniq -c` reads 58 if #109 filed ADR-0058. If #109 also files a new ADR (0058) at `Proposed` while its code ships in the same PR, the rule says it is committed `Accepted` from the start; if it lands `Proposed`, the acceptance grep for #116 would show it — and that is correct output, not a regression, provided its code is genuinely not on `main`. `docs/plans/051` is presumed reserved for #109; 052 is this file.

---

## 11. Exit criteria

- [ ] All nine flipped with the §5 lines verbatim; `grep -H "^\*\*Status" docs/adr/*.md | grep Proposed` empty, output pasted in the PR.
- [ ] `grep -h "^\*\*Status" docs/adr/*.md | wc -l` → 57 (58 if ADR-0058 has landed, still zero Proposed); `grep -L "^\*\*Status" docs/adr/*.md` empty; no `Date:`/lowercase `Status:` line remains.
- [ ] `docs/agents/domain.md` carries §4 verbatim; it names owner, trigger and when the flip is written (at step 5, with the code; the merge discharges it), defines `Accepted` for decision-only ADRs, states that every post-rule `Accepted` line carries `shipped in #PR`, names the checker and the no-checker reason.
- [ ] ADR-0003 and ADR-0004 carry the reciprocal line; ADR-0001 unchanged.
- [ ] ADR-0057 (e) carries the parenthetical and no other body byte in any ADR changed (`git diff origin/main -- docs/adr | grep '^[-+]' | grep -v '^[-+][-+]'` shows only status lines, the four header lines, and the one parenthetical).
- [ ] `CLAUDE.md` sentence, napkin clause, `docs/README.md` row present.
- [ ] §6 mapping reproduced in the PR body as changed/left; no bare count anywhere.
- [ ] Gate green with pasted output; `git diff --stat origin/main` → 22 files, all in §5.
- [ ] Step-6 reviews satisfied; every dismissed finding has a written reason in the PR.
- [ ] PR merged; #116 closed with the nine-not-eight comment.

---

## 12. Open questions and deviation register

1. **The literal non-goal "no ADR body changes" is deviated from once, on purpose.** ADR-0057 consequence (e) receives one bracketed tense parenthetical (D7). The non-goal's purpose — not re-opening decisions — is honoured; the falsified-record standard is a repo rule and would otherwise be violated by the same PR that cites it. Step 3 accepted this (review B2: the issue's scope item 4 is the more specific instruction); had it ruled the other way, the fallback was to leave (e) untouched and state in the PR body that its "nothing names a lifecycle" clause is read in #114's tense — the plan considers that weaker, because it leaves a living ADR's present-tense sentence false and asks every future reader to know the ticket history.
2. **Header lines are not body.** The six normalizations, the two reciprocals and the nine flips are all header lines. Stated so the reviewer does not read the 17-ADR diff as decision churn: `git diff origin/main -- docs/adr` contains no line below a `## Context` heading except the (e) parenthetical.
3. **The `shipped in #PR` form is new syntax for the field** and is the plan's one real judgment call (D2). It was chosen over matching the 42's bare form because it puts the shipping PR on the line — provenance in one token, the split-ship and post-flip-correction facts (0053, 0057) without prose, and the one greppable population D8's reversal trigger needs — not because the date needs a marker to be understood: under the rule the date has one meaning, and the pre-rule drafted dates carry it with a known ≤1-day drift (D2 reason 1, restated at step 4). Reversible in nine lines if a later review prefers bare dates; the rule text would then lose two clauses and D8's trigger its grep.
4. **Residual, not fixed: five H1s read `# NNNN —` rather than `# ADR-NNNN —`** — 0019, 0020, 0023, 0024, 0025, by `grep -L "^# ADR-" docs/adr/*.md` on this tree (the step-1 report said three; the grep says five, and the step-5 agent re-runs it rather than trusting either sentence). No lifecycle claim lives in an H1; left for a cosmetic pass if anyone ever wants one.
5. **The 42 pre-rule dates are drafted dates, three of them one day early** (0025, 0036, 0044). Grandfathered in the rule text; not re-dated. Anyone who wants them exact has the §2.1 loop.
6. **A midnight slip between the last push and the merge.** The flip is written into the PR's diff at step 5, with the code, dated with the expected merge day, and re-dated on the PR's last push if that day has changed (D11) — that correction is a push, which re-triggers the gate (napkin Execution #10), so it rides the last review-fix push rather than adding one. What remains is a merge that slips past São Paulo midnight *after* the last green gate: the line is then a day early — the same class of drift the pre-rule files already carry. Not worth a correction rule; named so nobody invents one.
7. **`0021`'s `**Plan:**` header key is new** (no other ADR carries one). It exists only because folding four bullets into one line would have dropped the plan pointer; the alternative — a bold status line followed by a `- Plan:` bullet — mixes two shapes on one header. Kept; it is one file.
8. **The step-1 report's provenance table was verified, not trusted**: the nine adding commits and dates were re-run in §2.1 and match; #112/#94/#95 were additionally checked against `gh pr view --json mergedAt`.
9. **Step-4 changes** — the step-3 review's findings, each applied unless noted; step 5 and the step-6 reviewers can diff this list against the review.
   - **A2** (MAJOR) — §0.1.3, §0.2 and the rule's "Pre-rule ADRs" paragraph no longer say all 42 were born with their code; verified on this tree (`git show --name-only` on `1c14f06`, `fc0864b`, `7f8a70f`: `.gitignore`, `CLAUDE.md`, `README.md`, `CONTEXT.md`, the skills tree — no `apps/`, `packages/` or `.github/` file) and every adding commit from 0016 on does touch code. Written as a mapping: 0001–0015 docs-only decision PRs; 0016 onward born with code (27 bold + 6 lowercase); nine Proposed.
   - **C1** (MAJOR) — new D10: a decision-only ADR is `Accepted` when the PR that carries it merges; `shipped in` cites that PR. One sentence in the rule's Accepted bullet.
   - **C2** (MAJOR) — new D11 item 2: the flip is written into the PR's diff no later than step 7 (before the final review round), dated with the expected merge day, corrected in the same PR on a slip; the merge discharges the trigger; the step-6 reviewer checks it. Rule text, D8 reason 2, D9, the CLAUDE.md sentence, the napkin clause, §12 item 6, R1, R2 aligned.
   - **C3** (MAJOR) — new D11 item 1: every `Accepted` line written under the rule carries `shipped in #PR`, born-`Accepted` included, added once the PR number exists; pre-rule lines grandfathered as-is. D2 header and reason 4 aligned.
   - **B3** — D3 states the rule's shape clause first and the acceptance grep second, and admits the grep passes literally either way.
   - **B4** (nit) — the header's issue-title quote is marked as the issue's title, with the set as nine.
   - **C4** — "once in 57 ADRs" removed from the rule text ("went stale once, for one systemic reason"); the plan's own counts, being a snapshot, stay.
   - **C5** — the rule's worked example cites ADR-0003 alone; ADR-0001's 0004 pointer is named as a pre-rule label kept as written; D5 explains why (0001:29 "narrowed" is the amendment verb by the rule's own test); the July verb is not re-adjudicated.
   - **C6** — Withdrawn is flipped by the PR that abandons it, or by a docs-only PR opened for the purpose when the ticket closes with no PR (D6, rule text).
   - **C7** — the Superseded form keeps `(issue #N; …)` (D5, rule text).
   - **C8** — the rule block rewritten from 20 lines / 4 158 bytes to 18 lines / 3 627 bytes (−13% net): the "Pre-rule ADRs" paragraph condensed to three sentences, the checker-decline rationale to one sentence plus the trigger, "which is what most of this repo's ADRs did" dropped as history, every bullet tightened. Partial against the ~30% asked, with the reason: no rule was lost and three were **added** (C1, C2, C3 — roughly 500 bytes); like-for-like the cut is ~25%, and every remaining sentence is operational (owner, trigger, timing, form, checker).
   - **D1** — D2 reason 1 restated as provenance rather than date-semantics disambiguation; rejected alternative (a) and §12 item 3 restated the same way.
   - **E2** — the two `**Supersedes in part:**` lines rewritten in the `**Amends:**` idiom (target — the part, citing 0001's Consequences bullets); "ADR-0001 stays Accepted" dropped from the headers.
   - **E3** (nit) — §6 gains a row for the three snapshot line-number citations into ADR-0003/0004 that shift by one.
   - **F4** (nit, with B2's nit) — the 0057 (e) parenthetical no longer says "the nine": "the set named above, this ADR included".
   - **G2** — the napkin clause moves to the end of Execution #5's "Do instead" (before "Reviewers reject…", which becomes "any of these") so the "correcting record" back-reference is not broken.
   - **H2** — gate is `pnpm typecheck --force && pnpm lint && pnpm test --force`; R2 aligned.
   - **H3** — §7, §9, §10 and §11 state 57 (or 58 if ADR-0058 has landed first, still zero Proposed) and 9 (or 10) on the `shipped in` grep.
   - **I2** — §10 names `docs/README.md` (both PRs append after the `adr/0057-…` row) as the real conflict surface with #109; resolution both rows, 051 before 052; §9 gains the merge-from-main step (step 4, before the gate).
   - **Not applied: none.** The `docs/README.md` row for this plan is updated in the working tree to match R1 (it said "owner at step 8" and "so the date says which kind of date it is", both of which the fixes above retire).
10. **Step-5 sweep re-run — one extra snapshot line, same class, no change in disposition.** The two-way sweep re-run on the edited tree found a fourth handoff-050 line saying #116 is open (`:148`, *"Still open and unblocked: #109, #116"*), which the §6 row listed as three (`:18`, `:91`, `:119`); the row now names all four. Snapshot, left as written. Everything else the sweep returned is in §6 already: plan 049 (`:62`, `:97`, `:699`, `:915`), plan 010 (`:302`, `:345`) and plans 025/027/029/031's `**Status:** Proposed` drafts (snapshots); the word "lifecycle" in ADR-0022/0029/0034/0039/0042/0044/0046/0050/0053 (session, play, signing-secret senses — unrelated); plan 022 / handoff 023's "eight ADRs" (ADR-0038–0045, unrelated). #109 was still open with no PR at step 5 and `origin/main` was still `8650cf9`, so §9 step 4's merge-from-main was a no-op and the `uniq -c` line reads 57.
11. **Step-7 changes** — the four step-6 reviews (quality, correctness, adherence, issue; all ACCEPT WITH FIXES), every finding id mapped; step 8 can diff this list against the reviews. Where two reviews touched one sentence they were reconciled into one edit. The rule text in §4 is replaced by the final text so "verbatim" stays true.
   - **D11 item 2 changed** (quality F1, adherence A4; C2 above was the step-4 wording): "no later than step 7 — before the final review round" → **"at step 5, with the code"**. "Final review round" is decidable only after a round passes, so three agents place the flip three ways (step 5, a guessed-last step 7, or step 8 — the post-green push D11 exists to avoid); naming the step removes the guess and the step-6 reviewer's rejection carries the enforcement unchanged. D11 heading and item 2, D8 reason 2, D9, §4's "three properties", §5's CLAUDE.md and napkin rows, R1 (and the `docs/README.md` row), R2, §11 and §12 item 6 re-worded to match; "final review round" no longer appears in any living document. Adherence A4's longer alternative ("at step 5 once `gh pr create` has given the PR its number, and no later than the step-7 fix…") not taken — it re-introduces the same ambiguity in a second clause.
   - **Quality F2 / D5 last bullet** — the Amended-vs-Superseded-in-part test read "sentence narrowed → Amended; whole clause replaced → Superseded in part", and a clause is smaller than a sentence. Now: `Amended by:` when a sentence of the older decision is narrowed or corrected and the decision stands; `Superseded in part by:` when one of its decisions is replaced outright. D5's own bullet corrected the same way.
   - **Quality F3 / correctness F3** — Superseded form: `issue #N` is the superseded ADR's own; the `shipped in` PR is the superseding one. Said inline in the Superseded bullet.
   - **Quality F4** — the one bracketed template (`(issue #N[, shipped in #PR])`) replaced by the four literal forms in a fence; the "Every `Accepted` line written under this rule carries `shipped in #PR`, born-`Accepted` ADRs included" sentence and the term "born-`Accepted`" dropped from the rule (the forms carry it; the plan keeps the term as its own vocabulary, D2/D11).
   - **Quality F5–F7** — "genuinely" ×2 deleted; slip correction now names the moment ("re-dated on the PR's last push if that day has changed"); "which carries" → "the superseding ADR carries".
   - **Quality R1–R4** — Accepted tail sentence (duplicate of the Amendment paragraph, and the "#118/#120 annotated it" census adherence A5 flagged) cut; Withdrawn's "`Proposed` only" fragment cut; the "Pre-rule ADRs" paragraph reduced to one "Pre-rule lines … are left as written" sentence (membership lists and the docs-only/code split are §0.1.3's, and `grep -L "shipped in"` on line 3 answers them); "Who checks" keeps the decline and the reversal trigger, points at D8 for the reasons. R5 (ADR-0001–0015 as the decision-only example) kept, shortened. R6 (timing in three places): CLAUDE.md:133 and napkin Execution #5 now carry the trigger word and the pointer only — CLAUDE.md: "It stays `Proposed` until the PR that ships its code flips it to `Accepted` in that same diff — owner, forms and edge cases in `docs/agents/domain.md`"; napkin: "flipped to `Accepted` in this PR's diff, merge-dated and citing the PR (lifecycle: `docs/agents/domain.md`)". Section measured after: 21 lines / 2 965 bytes against 18 / 3 627 before (−18%; quality's §8 draft was 2 771 before the A3/F2/A2 clauses below were layered on).
   - **Quality P1** — the form block is fenced (the file's other block is). **P2** — `domain.md:3` intro gains "and how the ADR status field is maintained"; `docs/README.md:13` row for `agents/domain.md` per adherence A1 below.
   - **Quality E1 / adherence A2 / issue F4 / correctness F5** — ADR-0004's new `Supersedes in part:` line is **kept** (option (a): it mirrors ADR-0001's existing header; July's verb is not re-adjudicated — D5), and the rule now says so in the pre-rule sentence: "ADR-0001's pointer to ADR-0004, mirrored on ADR-0004 rather than re-adjudicated". The rule no longer argues the verb.
   - **Correctness F1** — §2.2 row 0024 merge date corrected to `2026-08-01 01:41 (file −1 day)` (same squash commit as 0025, `93b1a85`).
   - **Correctness F2 / issue F3 / adherence "47 lines"** — the pre-rule sentence says those lines carry a drafting day and **no parenthetical at all** (0021's `(issue #24)` aside), so no agent reads 47 headers as malformed against the four forms.
   - **Correctness F4** — covered without a new clause: the moment is named (last push), and the intro sentence "the date … moves only when the status moves" already forbids a post-merge re-date; the residual is §12 item 6, unchanged.
   - **Correctness F6 / issue F5** — CLAUDE.md's sentence says "the PR that ships its code" and defers the decision-only case to domain.md; accepted by both reviewers as-is, and the R6 trim makes the sentence a pointer, which is the right place for the case to live.
   - **Adherence A1** — `docs/README.md:13`: "How agents must consume `CONTEXT.md` and ADRs, and the ADR status lifecycle (statuses, owner, trigger, header forms)".
   - **Adherence A3** — the two decision-without-code shapes no longer collide: "or a decision recorded ahead of its ticket" struck from Proposed (Proposed on `main` now means only "its code is not on `main`" — the first PR of a two-PR ticket), and Accepted gains "a later ticket that implements a decision-only ADR leaves its status alone" (option (b) plus half of (a)).
   - **Adherence A5** — the "#118/#120 annotated it" census is gone with R1. **A6** — ADR-0057 (e) parenthetical now reads "discharged by #116 (PR #122)". **A7** (INFO) — not applied: the shape half being greppable is true, but the "Who checks" paragraph was cut to the decline and the trigger (R4) and a clause about what a checker could check would be the rationale R4 removed. **A8** — no action.
   - **Issue F1, F2** — PR-body obligations (AC3 output pasted, AC4 mapping carried or linked in full): step 8, per R2.
   - **Three properties re-checked against the final text**: (1) every tree claim — line 3 / no `Date:` / no status in H1 (57 files), the four forms as the only shapes written under the rule, ADR-0001 ↔ 0003 reciprocity, 0055 ↔ 0057, `shipped in #94 and #95` — true after §5 and false before; (2) owner (the agent driving the PR, at step 5), trigger (code on `main` / the carrying PR's merge for a decision-only ADR), checker (the step-6 ADR reviewer) named; (3) `Accepted` defined for both populations of §0.1.3, and `shipped in #PR` is on every post-rule `Accepted`/`Superseded` form while pre-rule lines carry no parenthetical — one population going forward.
