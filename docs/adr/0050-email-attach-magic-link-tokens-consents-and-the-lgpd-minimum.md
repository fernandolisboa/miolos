# ADR-0050 — Email attach: magic-link tokens, verified-email uniqueness, consents, and the LGPD minimum

**Status:** Proposed — 2026-08-13 (issue #21)
**Depends on:** ADR-0003, ADR-0009, ADR-0012, ADR-0013, ADR-0022, ADR-0025, ADR-0026, ADR-0048, ADR-0049
**Amends:** nothing — deliberately. Every decision below either resolves a
recorded silence (email uniqueness — schema.ts's "uniqueness semantics land
with the attach/merge ticket"; consent merge semantics — ADR-0049 decision 4's
explicit delegation), resolves a recorded conditional (ADR-0022's "adds the
explicit per-consent flag … if an audit trail is needed" — decided not needed
in v1, revisit trigger below), or adds a guard discharging the two security
preconditions recorded on issue #21 without contradicting any sentence of
ADR-0049. One near-miss deserves its argument written down: ADR-0012's own
consequence sentence promises a "per-consent flag plus timestamp (when it
was given or withdrawn)". Resolving ADR-0022's conditional does NOT correct
that sentence, because the resolution decides only v1 *storage* — and the
withdrawal-representability revisit trigger is exactly where ADR-0012's
fuller shape becomes true: the first withdrawal surface (settings / M4)
adds the flag columns and makes withdrawal timestamps representable, at
which point ADR-0012's sentence is satisfied as written rather than
amended. Recorded here so the step-6 ADR-adherence lens finds the argument,
not a silence.

## Context

ADR-0003 promised the magic-link attach at streak ≥ 5; ADR-0012 tied the LGPD
minimum to it; ADR-0049 built the merge and named #21 its first production
caller, owner of "everything HTTP: collision detection by email, uniqueness
semantics, consents, transport". Issue #21's comment added two security
preconditions from PR #86's review: serialize merges touching a common user
(pg_advisory_lock unavailable over neon-http), and derive both merge ids from
verified identities. Nothing about tokens, transport, uniqueness, consents,
prompting or deletion was recorded. This ADR records all of it as one design.

## Decision

1. **One flow, four verbs.** POST /attach/request (authenticated) mints a
   token and emails a link; POST /attach/confirm (driven from the /vincular
   page) claims it, merges on collision, writes the email to the winner, and
   sets a fresh session cookie. Attach, recovery, device move and
   merge-on-collision are the same flow: recovery and device move are a
   collision whose requester is a fresh, empty account. No flow variants —
   ADR-0049's one-function rule extended to HTTP.
2. **Tokens: the sessions idiom plus expiry and single use.** `attach_tokens`
   stores only the SHA-256 hex of a 32-byte Web-Crypto token (hash PK), the
   requester (FK cascade), the normalized email, the reminder-consent choice,
   and a DB-clock `created_at`. Expiry is a DB-side predicate (30 minutes) on
   the claim; single use IS the claim: one atomic
   `DELETE … RETURNING` — race-safe without a transaction. Unknown, expired
   and spent tokens are indistinguishable (410). `users.email` is written
   only at confirm, so on `users`, non-null email implies verified.
3. **The link lands on the web; the POST consumes.** The emailed URL is
   `{WEB_ORIGIN}/vincular?token=…` (pt-BR route, ADR-0013; nothing hardcodes
   the apex); the page shows one explicit button whose POST to the api —
   behind the origin guard and the JSON gate — is the only consumer. Email
   scanners prefetch GETs; a GET here consumes nothing. Possession of the
   inbox is the trust model (a forwarded link is a handed-over account);
   single-use + 30 minutes bound it.
4. **Both merge ids are verified identities (precondition 2).** The pair is
   always (token.user_id — bound by requireUserId at request time, stored
   server-side) and (the verified holder of the token's email — one DB
   lookup). The clicking browser's cookie never chooses the pair; the
   request body contains only the token. The clicking browser is
   authenticated AS the winner, never merged into it.
5. **Serialization is a winner-liveness guard (precondition 1).** Inside
   `mergeAccounts`, between winner selection and the first destructive
   statement: the selected winner must still own ≥ 1 session or ≥ 1 identity
   handle — i.e., must not be a tombstone (every live account owns a session
   by construction; only tombstones own none). On failure the operation
   throws before touching anything; the confirm route re-derives the pair
   and retries once, then 409s. Route-level single-flight was rejected:
   stateless Vercel functions share no memory, so a route lock is fiction.
   This is an addition, not an amendment: no sentence of ADR-0049 is
   contradicted; sessions are still remapped first among writes.
6. **Verified-email uniqueness, three layers.** The Zod boundary normalizes
   (trim + lowercase) every email; the flow keeps at most one verified
   holder (the merge nulls the loser's email before the winner gains it —
   no transient two-holder state exists); and a partial unique index on
   users(email) WHERE email_verified_at IS NOT NULL backstops the one race
   the flow cannot close (two concurrent confirms of the same email onto
   different winners fail loudly rather than forking the identity). The
   confirm route catches exactly that unique violation — the window where
   its holder lookup returned null — and maps it to the same 409
   request-a-new-link answer as an exhausted merge retry (decision 5); the
   token is already spent either way.
7. **Consents: timestamp-only stands.** ADR-0022's conditional is resolved:
   no explicit flag columns in v1, because no withdrawal surface exists in
   v1 — the revisit trigger is the first withdrawal surface (settings / M4
   LGPD pass). The two timestamp columns ARE the independent flags (NULL =
   not consented; a timestamp = consented then). recoveryConsent is a
   literal-true in the request contract (attaching is the recovery consent,
   ADR-0012's purpose limitation); reminderConsent is an explicit boolean
   riding the token and stamped on the winner at confirm only when true —
   an unchecked box is the absence of new consent, never a withdrawal.
   Deletion (decision 12) is v1's total-revocation path.
8. **Consent merge semantics (ADR-0049 decision 4's delegation).** The
   winner's consents stand; the loser's timestamps remain on the tombstone —
   never copied (a consent is an act at a moment, not a mergeable maximum)
   and never nulled (they are evidence). A tombstone holds no identity
   handle, so they are not reachable personal data.
9. **The prompt is server-owned and has one lifecycle per account.**
   Eligibility = streak ≥ attachStreakThreshold (remote config, default 5,
   ADR-0003) AND email IS NULL AND attach_prompt_dismissed_at IS NULL AND
   the transport is configured. Served as one boolean by GET /attach/state
   (a new strict contract — ADR-0048's growth rule; the threshold never
   ships to the client). Dismissal stamps users.attach_prompt_dismissed_at,
   permanently. localStorage was rejected: it re-prompts exactly the
   cleared-site-data user the feature serves.
10. **Transport: Resend over plain fetch, fail-closed, dormant until keyed.**
    No SDK (zero new dependencies). RESEND_API_KEY unset → the request route
    503s before any side effect AND /attach/state reports ineligible, so the
    whole feature is dormant until `vercel env add` — the grantHints posture
    applied to a flow. Plain-text mail, no pixels. pt-BR mail copy lives in
    apps/api/src/email/copy.ts — the api's one externalized-copy module.
11. **Rate limit: 3 requests per rolling hour per user AND per normalized
    email**, both counted from attach_tokens rows (multiple outstanding
    tokens are allowed precisely so the rows are the ledger). Opportunistic
    cleanup deletes rows older than the ONE-HOUR rate window, not the
    30-minute expiry — cleanup at 30 minutes would empty the band the count
    needs and silently double the limit; expired-but-recent rows serve as
    the ledger for their remaining half hour (a deliberate 30-minute
    data-hygiene cost). The per-email cap is the cheap closer for the
    bypass composition recorded honestly here: POST /session mints users
    unthrottled (ADR-0022's acceptance), so a per-user cap alone is
    per-attacker-unlimited; mail-bombing one inbox is closed, while fresh
    users × many addresses (Resend quota, sender reputation) remains the
    accepted v1 risk. Revisit: first abuse signal or #32's send
    infrastructure. The global sweep of abandoned rows joins the
    nightly-check ticket.
12. **Deletion is real, immediate, and self-service.** POST /account/delete
    (authenticated, literal confirm) cascade-deletes the user; the cookie is
    cleared; the next visit mints a fresh empty identity. Structurally
    distinct from tombstones: a tombstone owns no session, so no cookie can
    ever aim this route at one — deletion and ADR-0049's "retained forever"
    never conflict. The /privacidade page hosts the UI and publishes
    privacidade@miolos.app as the human-channel fallback (ADR-0012's
    "how to request deletion", both ways).

## Rejected

- **A signed stateless token:** ADR-0022's own reasoning — every request
  touches the DB; a signing-secret lifecycle buys nothing.
- **Tokens as users columns:** several may be outstanding, and any users
  column change re-springs the INSERT-column-list deploy trap for no gain.
- **GET-consumed links:** broken by scanner prefetch; outside the
  POST-shaped origin guard.
- **A hard unique index on email, or none:** under decision 2 (non-null ⇒
  verified) a plain unique index is materially equivalent to the partial
  one — the partial shape is kept for self-description and robustness to
  future states where unverified emails might exist on users, not for
  correctness today; no index at all leaves the concurrent-confirm fork
  open.
- **Explicit consent boolean columns now:** an audit trail without a
  withdrawal surface is dead weight; ADR-0022 named the condition and it is
  not met.
- **localStorage "exactly once", and stamp-on-first-render:** the first
  re-prompts the feature's own audience; the second burns the product's one
  ask on a glimpse.
- **Appending the threshold or eligibility to /streak:** forbidden by
  ADR-0048's strict-contract rule; a new endpoint is the recorded shape.
- **A mailto-only deletion path:** "works" would rest on an unverifiable
  inbox; the cascade already exists and testably works.
- **Merging the clicking browser's account implicitly:** no verified
  identity requested that merge; it would let a forwarded link swallow a
  bystander's history.

## Consequences

- The first production caller of `mergeAccounts` exists; handoff 030 §6's
  post-deploy smoke (the first live merge) is owed by this ticket's
  activation checklist.
- users gains its second and third UPDATE writers — attach-confirm and
  dismiss (mergeAccounts was the first; deletion is a DELETE, not an
  UPDATE, and writes no updated_at); every UPDATE sets updated_at
  explicitly — the schema comment is corrected with this ADR.
- A crash between merge and the email write leaves merged histories with no
  email and a spent token; a re-request heals it. Idempotence remains the
  recovery mechanism end to end.
- Email change for an attached account is deliberately unsupported: 409 at
  request, re-checked at confirm on the resolved winner (a still-live
  pending token for a different email cannot become a silent change — 409,
  token spent); it is a settings/M4 flow with its own safeguards.
- The reminder channel remains dormant: #21 stores consent; only #32 may
  send, and only to reminder-consent holders (ADR-0012).
- "Magic link" enters CONTEXT.md as a durable term.
