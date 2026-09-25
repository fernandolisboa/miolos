# ADR-0081 — The reminder switch is player-started, not an ask

**Status:** Accepted — 2026-09-24
**Depends on:** [ADR-0064](./0064-streak-at-risk-is-a-derived-decision.md), [ADR-0068](./0068-the-dispatchers-operating-decisions.md), [ADR-0012](./0012-minimal-lgpd-ships-with-email-attach.md)

## Context

Issue #36 adds `/ajustes`, with a per-device reminder switch (browser push) and the account's attached email. The invariant says the reminder opt-in is *requested* after a 3-day streak; ADR-0064 decision 3 makes that threshold gate the ask (the conclusion card), never a send. ADR-0064 decision 10 annotation (b) and ADR-0068 decision 6 deferred the `pushsubscriptionchange` handler to this ticket, as the way back for an install that lost its subscription. Four calls were open: whether the switch waits for the threshold, how "off" orders its two writes, whether the worker gains the handler, and whether the email is masked.

## Decision

1. **The switch is not an ask, so it works from day one.** The player starts it; nothing prompts them. `ReminderSection` (`apps/web/app/ajustes/reminder-section.tsx`) reads `vapidPublicKey` from `GET /notifications/state` and ignores `eligible`. A null key means unsupported, as for the card.
2. **Its state is the browser's.** Feature support, `Notification.permission` and `pushManager.getSubscription()` decide unsupported, blocked, off or on. Turning on calls the same `subscribeAndStore` as the card (`apps/web/src/push/subscribe.ts`); only the card stamps `dismissPushPrompt` on a denial, because the switch is not the prompt's lifecycle.
3. **Off is `DELETE /push/subscriptions` first, then `unsubscribe()`** (`unsubscribeAndForget`). If the DELETE fails the switch stays on with an error: the browser keeps a subscription the server still holds, which is honest. If `unsubscribe()` fails after the DELETE it is retried once, then the switch reads off with an error: the server no longer sends, which is what the player asked for.
4. **No `pushsubscriptionchange` handler.** This confirms ADR-0064 decision 10 annotation (b) and ADR-0068 decision 6: T-WEB-S261's listener set stays; a granted install that lost its subscription reads off here and the player turns it on again; 404/410 pruning keeps the table honest.
5. **The attached email is shown in full** (`GET /account/state`). The session cookie already is the account and can delete it, so masking protects nothing from whoever holds the device.

## Rejected

- **Gating the switch on `eligible`.** It would hide the off switch from a subscribed player whose streak fell, and protect nobody.
- **Unsubscribe first, then DELETE.** A failed DELETE would leave a server row the dispatcher keeps sending to, with no browser left to receive or remove it until pruning.
- **A worker re-POST on `pushsubscriptionchange`.** A new credentialed network surface in a worker whose ADR-0004 argument is that it has none.

## Consequences

- The ask and the switch are separate surfaces: the card still waits for the threshold and still stamps a denial; the switch never stamps.
- A reload after a stranded unsubscribe (decision 3) can read "on" again while the server holds no row. Switching off again repairs it; the DELETE is idempotent.
- `GET /account/state` returns `{ email, reminderConsent }`; it is an authenticated read like the other state routes (`authenticatedRead`, `T-API-S183`).
- Turning the switch off deletes the row (decision 3), so turning it back on is a new consent and fires `notification_opt_in` again — correct, because ADR-0069 decision 6 fires that event on a genuine first insert, and a delete-then-reinsert is exactly that, not a re-post of an existing row.
- The switch's passive install hint — shown only when the browser itself lacks push support, on a page the player opened themselves — is not the install nagging ADR-0064 consequence (e) rules out; that consequence is about unprompted nudges toward installing, not a note on a settings page already in front of the player.
