# ADR-0082 — Settings withdraws consent with timestamps; removing the email is the recovery withdrawal

**Status:** Proposed — 2026-09-24 (issue #36, second PR)
**Depends on:** [ADR-0012](./0012-minimal-lgpd-ships-with-email-attach.md), [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md), [ADR-0081](./0081-the-reminder-switch-is-player-started-not-an-ask.md)
**Amends:** [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md) decision 7 — *"no explicit flag columns in v1, because no withdrawal surface exists in v1"* and *"reminderConsent … stamped on the winner at confirm only when true"*. `/ajustes` is that withdrawal surface; the *_consent_at columns keep their meaning (NULL = no consent) unchanged, but consent can now also end after having been given, which needs its own timestamp.

## Context

ADR-0050 decision 7 left `recoveryConsentAt` / `reminderConsentAt` as timestamp-only flags because nothing could withdraw them. Issue #36's second PR adds that surface: turning the reminder switch off, and removing the attached email. Both need a "when withdrawn" fact the dispatcher and #199's email hedge do not currently have any column for, and neither may lose the original consent instant — it stays evidence of what was granted and when.

## Decision

1. **Two nullable columns on `users`:** `recovery_consent_withdrawn_at`, `reminder_consent_withdrawn_at`. `*_consent_at` keeps meaning NULL = no consent; the dispatcher and #199 read it unchanged.
2. **`POST /account/reminder-consent { granted: boolean }`** toggles the reminder switch server-side. `granted: false` nulls `reminder_consent_at` and stamps `reminder_consent_withdrawn_at`. `granted: true` re-grants — stamps `reminder_consent_at`, clears the withdrawn column — only when an email is attached; with no attached email it answers `409`, since a reminder consent needs an address to send to.
3. **`POST /account/detach-email`** nulls `email`, `email_verified_at`, `recovery_consent_at` and `reminder_consent_at`; stamps `recovery_consent_withdrawn_at` and `reminder_consent_withdrawn_at`, but only the columns whose consent was actually set — detaching an email that never carried a reminder consent does not fabricate a withdrawal instant for one. It also stamps `attach_prompt_dismissed_at`, so the attach prompt does not return for a player who just removed the email on purpose. Sessions are kept: detaching is a consent withdrawal, not an account deletion.
4. **Withdrawal is a new consent event, not idempotent quiet.** Re-granting after a withdrawal is a genuine new grant (fresh `reminder_consent_at`), and it fires `notification_opt_in` again through the same seam ADR-0081 consequence added — the delete-then-reinsert pattern the reminder switch already uses.

## Rejected

- **Boolean flag columns (`recoveryConsentWithdrawn: boolean`).** Loses *when* — the dispatcher and any future audit need the instant, not just the fact, and a boolean throws away exactly the information a timestamp column costs nothing extra to keep.
- **Deleting the consent history on withdrawal.** Overwriting `*_consent_at` to NULL without a withdrawn timestamp would make a past grant unprovable later, which is worse for an LGPD-facing record than keeping both.

## Consequences

- The migration adds two nullable columns; nothing reads them until this PR ships, so it is safe to apply ahead of the PR (`docs/pending-fernando.md` §2).
- `POST /account/detach-email` is the recovery-consent withdrawal path in full: no separate "remove just the reminder" and "remove just the email" split — the email is the recovery consent's substance (ADR-0012), so removing it withdraws both consents it carries.
- A player who re-attaches an email after detaching starts a clean consent cycle: new `recovery_consent_at`, and the reminder switch reads off until turned on again.
