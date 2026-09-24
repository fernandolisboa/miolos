# ADR-0083 — The email hedge is a second arm of the one tick

**Status:** Accepted — 2026-09-24 (issue #199)
**Depends on:** [ADR-0012](./0012-minimal-lgpd-ships-with-email-attach.md), [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md), [ADR-0064](./0064-streak-at-risk-is-a-derived-decision.md)
**Amends:** [ADR-0068](./0068-the-dispatchers-operating-decisions.md) decisions 4 and 5, and its consequence that the push reader stays untouched; [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md) decision 11, by discharging its revisit trigger

## Context

Fernando's #32 answer Q1 = 1a makes email a hedge: it reaches reminder-consent holders with no push subscription. The seams existed (the ledger's `channel` admits `'email'`, `claimNudgeSend` takes it). This slice had to choose the response shape, the tick's failure mode, the arms' order, and how a person stops the email.

## Decisions

1. **Per-channel response.** `CronNotifyResponse` is `{ push: {candidates, claimed, sent, pruned, failed}, email: {candidates, claimed, sent, failed} }`. Rejected: flat `email*` fields beside the push counters. The arms count different things (email has no prune).
2. **503 when either transport is unconfigured**, before any DB read. Rejected: running only the configured arm. That turns a missing key into a silent zero, and ADR-0068 decision 4 chose a red hourly run as the alert.
3. **Push arm first, email arm second, each reading its own candidates when it starts.** A user whose last subscription answers 404/410 is pruned, so the email arm reaches them in the same tick. They have no reachable push any more, which is what "no subscription" means under Q1 = 1a. Pinned by `T-API-S191`.
4. **The two readers share one SQL fragment** (`habitualHours`, `atRiskNow` in `packages/db/src/notify.ts`). They must change together, so `listPushNudgeCandidates` is rewritten onto it, and its tests pass unedited. The email reader also requires a verified email, which excludes merge tombstones: they keep `reminder_consent_at` but lose the address (ADR-0050 decision 8).
5. **The email send takes an address and a number, never a subject or body** (`ReminderSend`, parsed by `streakReminderSchema`). The reminder copy is the only mail this path can build.
6. **The email is stopped by a checkbox in Ajustes, never by writing an email.** Fernando's call on 2026-09-24. The checkbox and its `POST /account/reminder-consent` are #36's second pull request (ADR-0082), which records the withdrawal time. This arm reads only `reminder_consent_at IS NOT NULL`, so it needs no change when that lands. Every email links to `/ajustes`, and `List-Unsubscribe` points there too. **This arm must not reach production before that checkbox does.** Rejected: a mailbox the operator reads and acts on by hand.
7. **ADR-0050 decision 11's revisit trigger is discharged.** The server picks the recipient on a schedule: the account's own verified address, at most once per SP day. No request input reaches the recipient line, so the attach flow's mail-bombing and victim-lockout compositions do not apply.

## Consequences

- ADR-0068 decision 5's concurrency trigger is now the **sum** of `push.candidates` and `email.candidates` (~150). Both arms share one serial 60 s budget, so an oversized tick drops the email arm's unclaimed tail first.
- The `cron-notify` log line nests the two counter sets under `push` and `email`.
- Decision 2 widens ADR-0068 decision 4's 503: an unset Resend key now stops push reminders too, and the hourly run goes red.
- Resend answers 429 when sends come too fast; `sendReminderEmail` waits one second and retries once before counting the send as failed.
- Renames: `isAttachConfigured` is now `isEmailConfigured` (ADR-0050 decision 10, ADR-0064 decision 4 cite the old name), and `runNotifyTick`'s `send` is now `sendPush` (ADR-0068 decision 3).
- A person who reads the email on a device without their Miolos session reaches Ajustes as a different anonymous account. The magic link recovers theirs. A signed one-click link in the email (#267) would remove that step.
