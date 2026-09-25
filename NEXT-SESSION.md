# Do I need to do anything?

**No.** Migrations 0012 and 0013 are applied and in the ledger's Done table. The ⚡ decision on #200 is still open and still low urgency. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Nothing to verify. #36 is closed: PR A shipped the theme (ADR-0079, ADR-0080), the settings screen with the reminder switch (ADR-0081) and `GET /account/state`; PR B shipped consent withdrawal (**ADR-0082**, now Accepted).

## Session state

**Ajustes withdraws consent.** With an email attached, the account section shows the email-reminder checkbox (the attach form's label, ADR-0012) and *Remover e-mail* with an in-page confirm. `POST /account/reminder-consent` withdraws or re-grants; a grant with no email is a 409 `no-email`. `POST /account/detach-email` nulls the email and both consents in one UPDATE, stamps `*_consent_withdrawn_at` only where a consent was set, stamps the attach dismissal, and keeps the sessions. #199's email arm reads `reminder_consent_at` and `email` unchanged, so both paths stop the reminder email (`T-API-S208`). Every real grant or withdrawal also writes a row to the append-only `consent_events` table in the same statement; a merge moves none (ADR-0050 decision 8). With no email, Ajustes shows the shared attach form (`src/attach/attach-form.tsx`), so a detached player can attach again.

**`writePreamble` lives in `apps/api/src/http/write-preamble.ts`** (origin guard, JSON gate, session, Zod parse). Its callers are the push route and the two new account routes. Its optional `unavailable` hook keeps the push route's 503 after the origin guard. The other write routes still carry their own copy; moving them is follow-up work, not started.

**Shared web pieces:** `ConfirmAction` (`src/components/confirm-action.tsx`) is the one confirm step behind *Excluir minha conta* and *Remover e-mail*. `apiPostParsed` and `parseJsonResponse` joined `src/api/client.ts`.

**The email hedge shipped** (#199, **ADR-0083**): reminder-consent holders with a verified email and no push subscription get one pt-BR text email at their habitual hour.

## Dependabot npm PRs cannot be merged as opened

Dependabot's npm PRs here change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails, and they bump a package in only one of the workspaces that pin it. Land them as one hand-made bump across every pin, and stay outside `minimumReleaseAge` (7 days): `pnpm install` refuses anything newer.

## Next

**#206 cluster 9** — re-derive the audit's numbers first, as clusters 1, 4, 7 and 8 had to.

**Also queued:** the telemetry opt-out UI (ADR-0069 decision 5) did not ship in #36 and belongs to #37; moving the remaining write routes onto `writePreamble`; the Binairo `validate.test.ts` uniqueness property has no explicit timeout and hit the 5 s default under CI load on #264; #254 (the remote conclusion announces its body sentence twice); #205's CSS half (~1,820 lines, NOT a sweep); #155 (`bundle-check` into CI); the `jsonResponse`/`stubFetch` Quick change; folding `T-WEB-S183`'s duplicate module walker in `archive-day.test.tsx` onto `module-graph.ts`.
