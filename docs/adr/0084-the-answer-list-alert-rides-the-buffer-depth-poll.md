# ADR-0084 — The answer-list alert rides the buffer-depth poll

**Status:** Accepted — 2026-09-26 (issue #74)
**Depends on:** [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md)
**Amends:** [ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md) decision 7, by discharging its follow-up alert and making its clocks precise; [ADR-0059](./0059-the-property-proof-splits-from-the-per-pr-gate.md) decision 5, for this label only

## Context

The Termo answer list is finite and spends one answer a day. Until now the only warning was a `termo-answer-pool-low` log line that nothing reads (ADR-0040 decision 7), and `shallow` fires about three days before Termo goes dark. Refilling the list with the ADR-0015 harness takes longer than that. A kill also burns its answer (`listUsedTermoAnswers` ignores `killed_at`) while it drains the buffer, so a thin buffer and a short list are two separate conditions.

## Decisions

1. **`GET /buffer-depth` gains `termoAnswersRemaining` and `termoAnswersLow`.** Both come from `unusedTermoAnswers` and `isTermoAnswerListLow` in `apps/api/src/publishing/service.ts`, which `topUpTermoBuffer` also calls, so the alert and the top-up cannot disagree about what is left. The threshold is still `<= 30`. The total stays off the wire. Rejected: a `CRON_SECRET`-guarded route (a second secret consumer to hide one integer), a Termo-only `shallow` threshold (still days, and it changes a four-game field), and a `TERMO_ANSWERS.length` floor (it measures the list, not what is left of it).
2. **The count is public, like the depths.** It reveals no word, date, user or puzzle. This does not rest on the repo being private, and it must not move if the repo goes public.
3. **One poll, two streams, two labels.** `buffer-alert.yml` opens an `answer-list-alert` issue beside the `buffer-alert` one. Each stream has its own flag and drill input (`force_shallow`, `force_answer_list_low`), and both go through one list-then-comment-or-create helper, so a failure in one does not skip the other. Sharing a label would be broken, because the dedupe takes the first open issue with that label and ignores the title. The answer-list body names the remedy: a content PR through the ADR-0015 harness, not a cron fix.
4. **The workflow creates its own label** (`gh label create … --color … --force`) right before it uses it. ADR-0059 decision 5 keeps `property-alert` as out-of-band repo state, and that stays as it is, as does `buffer-alert`. This label is otherwise first used about a year out, so a label that could be missing then is worse than a self-creating one.
5. **The poll fails on a malformed body, and every `GITHUB_ENV` flag is written as `true` or `false` only.** A missing `termoAnswersLow` would otherwise read as false and the alert would never fire. `jq -r` unescapes, so a string value with a newline would inject a second line into a job that holds `issues: write`. `T-WEB-S414` pins both.

## Consequences

- The clocks, counted from the first poll that reads `termoAnswersLow` (bufferDepth 7, effective threshold 4): the list empties on day 30, `shallow` first shows on day 34, and day 37 is the first dark day. ADR-0040's "~30 days' notice" stands. Its "~3 days" holds for any bufferDepth of 4 or more.
- Once it fires, the issue is bumped every day until a content PR extends the list. That is intended.
- The workflow now needs the API to carry both keys. Between merge and the API deploy, a scheduled run goes red once.
- The route makes one more database trip, which reads one short string per Termo row ever written. Its cost under load is unmeasured, and `apps/api` has no rate limit.
