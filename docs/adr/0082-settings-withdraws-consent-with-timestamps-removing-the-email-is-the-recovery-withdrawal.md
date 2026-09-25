# ADR-0082 — Settings withdraws consent with timestamps; removing the email is the recovery withdrawal

**Status:** Accepted — 2026-09-25 (issue #36, second PR)
**Depends on:** [ADR-0012](./0012-minimal-lgpd-ships-with-email-attach.md), [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md), [ADR-0081](./0081-the-reminder-switch-is-player-started-not-an-ask.md)
**Amends:** [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md) decision 7 — *"no explicit flag columns in v1, because no withdrawal surface exists in v1"* and *"reminderConsent … stamped on the winner at confirm only when true"*. `/ajustes` is that withdrawal surface. The `*_consent_at` columns keep their meaning (NULL = no consent), but consent can now end after it was given, and be given again.

## Context

ADR-0050 decision 7 left `recoveryConsentAt` / `reminderConsentAt` as timestamp-only flags because nothing could withdraw them. Issue #36's second PR adds that surface: turning the email reminder off in `/ajustes`, and removing the attached email. Once consent can be withdrawn and re-granted, a single column per consent is overwritten on every change, so a past grant could no longer be proven. It must stay evidence of what was granted and when.

## Decision

1. **Live state stays on `users`.** `*_consent_at` (NULL = no consent) and two new nullable columns, `recovery_consent_withdrawn_at` and `reminder_consent_withdrawn_at`. The dispatcher and #199's email arm read `reminder_consent_at` and `email` unchanged.
2. **History is an append-only table, `consent_events`** (`user_id` FK cascade, `consent` in `recovery | reminder`, `action` in `granted | withdrawn`, DB-side `at`). Every real transition writes one row in the same statement as the state change; an idempotent repeat writes none. Writers: `attachEmailToUser` (a recovery grant, plus a reminder grant when ticked), `grantReminderConsent`, `withdrawReminderConsent`, `detachEmail`.
3. **`POST /account/reminder-consent { granted }`** sets the email-reminder consent. It is not the per-device reminder switch (ADR-0081). A withdrawal nulls `reminder_consent_at` and stamps the withdrawn column. A grant stamps `reminder_consent_at` and clears the withdrawn column, only when an email is attached; otherwise `409 no-email`.
4. **`POST /account/detach-email { confirm: true }`** nulls `email`, `email_verified_at` and both consents; stamps the withdrawn column and writes a `withdrawn` event only for a consent that was set; deletes the user's unspent attach tokens; stamps `attach_prompt_dismissed_at` if it was not already set. Sessions are kept: detaching is a consent withdrawal, not an account deletion.
5. **Attaching again is a new grant.** `attachEmailToUser` clears `recovery_consent_withdrawn_at`, and clears `reminder_consent_withdrawn_at` when the reminder is ticked.
6. **A merge moves no events.** ADR-0050 decision 8 keeps the loser's consent timestamps on the tombstone as evidence, never copied; its `consent_events` rows stay beside them.
7. **No telemetry.** ADR-0069 decision 6 keeps `notification_opt_in` for browser push only.

## Rejected

- **Last state only** (the `*_consent_at` and `*_withdrawn_at` columns alone). Each re-grant or withdrawal overwrites the one before it, so a grant followed by a withdrawal and a re-grant leaves no proof of the first grant.
- **Boolean flag columns.** They lose *when*, which the timestamp columns keep at no extra cost.

## Consequences

- Two migrations: 0012 (the withdrawn columns) and 0013 (`consent_events`). Both are additive. Both must reach production before this PR is pushed; see the ledger's Done rows for migrations 0012 and 0013.
- Removing the email withdraws both consents it carries. The email is the recovery consent's substance (ADR-0012), and the reminder has no address left.
- A player who removed the email can attach one again from the Ajustes no-email state, which renders the attach form with no eligibility read. The hub card stays dismissed. Re-attaching starts a new cycle: a fresh recovery grant, and the email reminder only if ticked.
