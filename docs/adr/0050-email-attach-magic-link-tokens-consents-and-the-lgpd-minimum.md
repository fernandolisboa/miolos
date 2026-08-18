# ADR-0050 — Email attach: magic-link tokens, verified-email uniqueness, consents, and the LGPD minimum

**Status:** Accepted — 2026-08-13 (issue #21, shipped in #88)
**Depends on:** ADR-0003, ADR-0009, ADR-0012, ADR-0013, ADR-0022, ADR-0025, ADR-0026, ADR-0048, ADR-0049
**Amends:** the tombstoning consequence of
[ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md)
— *"the old anonymous cookie may still exist in a browser somewhere and must
map to the merged identity, not to a revived empty account"* — at the FLOW
level only: decision 13's post-merge session revocation means the loser's
original cookie resolves to nothing after a confirm-flow merge (the merged
identity is handed to the clicking browser's fresh cookie instead), and an
old device holding the dead cookie re-mints a NEW empty identity — a new
account, never the tombstone resurrected, with the merged history safe and
recoverable via the magic link. The operation-level remap inside
`mergeAccounts`, and T-API-S54's pin of it, stand untouched; the reciprocal
header line sits on ADR-0009, and #58's queued amendment there is additive.
Nothing else below amends anything: every other decision either resolves a
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

A second near-miss, same register: ADR-0049 decision 4 grounds tombstone
permanence in "no code path mints a session against an existing user" — and
`createSessionForUser` (apps/api/src/session/service.ts, the confirm
route's only session mint) is the repo's first such code path. It does not
amend that sentence, because neither derivation arm of its one argument can
ever name a tombstone: the id it receives is always decision 4's resolved
winner, which is either the verified holder of the token's email (a
verified holder has a non-null email by definition, and a tombstone's every
identity handle is null) or the token's requester after the
requester-liveness check (a requester who owns ≥ 1 session, and a tombstone
owns none — sessions are never deleted in v1 outside decision 13's
post-merge revocation, which runs only after the fresh winner session is
the guaranteed next statement). A tombstone therefore remains permanently
unresurrectable exactly as ADR-0049 argues; the mint against an *existing,
live* user is the new capability, and decision 13 below records the one
session-delete that now exists beside it. Recorded so the sentence and the
function are argued against each other rather than left to look like a
contradiction.

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
   and retries once, then 409s. The guard's throw is discriminable
   (`isWinnerLivenessError` on `@miolos/db/user`), and the retry/409 path
   is reserved for that throw ALONE: any other mid-merge failure is logged
   and rethrown into the route's 500, never flattened into a spent-token
   answer — the guard fires before any destructive statement, everything
   else may not have. Re-run healing after such a failure holds ONLY in
   the requester-is-winner arm: there the holder lost, its email survives
   until the tombstone statement, so a re-requested link re-derives the
   same pair and `mergeAccounts` re-runs. In the HOLDER-WINS arm —
   recovery and device move, where the holder is always older and
   therefore the winner — statement 1 has already remapped the requesting
   device's cookie onto the holder, so a re-requested link is minted BY
   the holder as a resend, resolves `{merged: false}`, and the merge never
   re-runs: the fresh account's post-reset completions strand permanently
   on its session-less, handle-less row (and in the crash sub-window after
   statement 2 and before statement 3, the holder's deleted later-duplicate
   days also vanish from served history until repaired). Accepted residual,
   priced: the bounded loss is the fresh account's post-reset days; the
   probability is one transient DB failure landing inside statements 2–4
   of a merge-on-collision confirm — a rare event inside a rare event.
   The repair seam is the nightly consistency check / first support
   tooling ADR-0009 already contemplates (`listCompletionsForMerge` exists
   for exactly that read), which is also this residual's revisit trigger.
   Route-level single-flight was rejected: stateless Vercel functions share
   no memory, so a route lock is fiction. This is an addition, not an
   amendment: no sentence of ADR-0049 is contradicted; sessions are still
   remapped first among writes.
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
    No SDK (zero new dependencies). The dormancy switch is ONE predicate,
    `isAttachConfigured` = RESEND_API_KEY AND WEB_ORIGIN, shared by both
    sides: unconfigured or half-configured → the request route 503s before
    any side effect AND /attach/state reports ineligible, so no environment
    can render a prompt whose submit would 503 — the whole feature is
    dormant until `vercel env add` supplies both, the grantHints posture
    applied to a flow. Plain-text mail, no pixels; the send carries a 10 s
    abort so a hung provider surfaces as the same 502 as a refusing one.
    pt-BR mail copy lives in apps/api/src/email/copy.ts — the api's one
    externalized-copy module. The sender identity
    (`Miolos <conta@miolos.app>`) is a module-private literal on purpose:
    it is bound to the Resend-verified sending domain — operational content
    like privacidade@miolos.app, not a routable origin, so ADR-0013's
    env-config rule does not cover it.
11. **Rate limit: 3 requests per rolling hour per user AND per normalized
    email**, both counted from attach_tokens rows (multiple outstanding
    tokens are allowed precisely so the rows are the ledger). Opportunistic
    cleanup deletes ALL rows older than the ONE-HOUR rate window — global,
    not per-user: a row past the hour is expired for the claim and
    invisible to both rolling-hour counts whoever owns it, so any request
    bounds the whole table and abandoned users' rows outlive the window
    only while nobody requests at all (no separate sweep is owed) — and
    never at the 30-minute expiry, which would empty the band the count
    needs and silently double the limit; expired-but-recent rows serve as
    the ledger for their remaining half hour (a deliberate 30-minute
    data-hygiene cost). The per-email cap is the cheap closer for the
    bypass composition recorded honestly here: POST /session mints users
    unthrottled (ADR-0022's acceptance), so a per-user cap alone is
    per-attacker-unlimited; mail-bombing one inbox is closed, while fresh
    users × many addresses (Resend quota, sender reputation) remains the
    accepted v1 risk. A second recorded composition cuts the other way —
    **victim lockout**: three throwaway accounts requesting an address
    exhaust its per-email cap for the hour, denying the true owner the
    attach flow while only attacker-requested links reach the inbox (the
    honest-copy warning and decision 13's revocation are what those links
    then run into). Accepted for v1 as the flip side of the mail-bombing
    closure. Revisit both compositions on the first abuse signal or #32's
    send infrastructure, whichever comes first.
12. **Deletion is real, immediate, and self-service.** POST /account/delete
    (authenticated, literal confirm) cascade-deletes the user; the cookie is
    cleared; the next visit mints a fresh empty identity. Structurally
    distinct from tombstones: a tombstone owns no session, so no cookie can
    ever aim this route at one — deletion and ADR-0049's "retained forever"
    never conflict. The /privacidade page hosts the UI and publishes
    privacidade@miolos.app as the human-channel fallback (ADR-0012's
    "how to request deletion", both ways).
13. **A cross-account merge revokes every pre-existing session on the
    winner.** At confirm, when the merge actually ran (holder ≠ requester),
    the route deletes ALL sessions owned by the winner AFTER `mergeAccounts`
    returns and BEFORE minting the clicking browser's fresh session — the
    merge's first statement remapped the loser's sessions onto the winner,
    so this one delete retires both accounts' pre-existing cookies. It
    closes the takeover the magic-link trust model would otherwise hand an
    attacker: request a token for a victim's verified email, wait for the
    victim to click, and the remap alone would leave the ATTACKER's cookie
    resolving to the victim's account. After the revocation the clicking
    browser's fresh session is the only live one. The plain-attach
    no-collision path keeps its sessions (no second account is involved).
    This does NOT contradict ADR-0049's remap-never-delete: the remap
    inside the operation is what keeps a crashed merge resolvable on re-run
    (delete there re-mints the revived empty account ADR-0009 forbids),
    while this revocation is an account-security action on a COMPLETED
    merge, taken at the confirm seam — `mergeAccounts` itself is untouched.
    Tombstone permanence is unaffected: the loser still owns no session and
    no handle, and the winner's fresh session is minted immediately.
    Accepted residual — the PRE-REVOCATION WINDOW: between the merge's
    first statement (the remap, which already put the attacker's cookie on
    the winner) and the revocation delete sit the merge's own remaining
    statements plus one more round trip, each a separate neon-http request
    — no transaction exists over neon-http (ADR-0049 decision 5), so the
    window is structural, not an ordering bug. Inside it the attacker's
    remapped cookie transiently RESOLVES to the winner: it can read the
    merged account's gameplay surface (GET /streak, GET-served completions
    state), and a sub-second blind race could land a destructive
    POST /account/delete before the delete statement runs. Accepted for v1
    at exactly that scope — a transient read plus a heavily timed race —
    because persistent takeover stays closed: the revocation lands within
    the same confirm invocation, after which the attacker holds nothing.
    Priced
    cost: in an honest device move, the OLD device's cookie dies too and
    that device re-mints a fresh anonymous account on its next visit — one
    more merge-on-collision if the player returns there, accepted as the
    cost of making "someone else asked for this link" unwinnable. The mail
    and the /vincular page carry the matching honest copy: only confirm a
    link you asked for yourself, just now.
14. **The clicking browser's own history gates the confirm client-side.**
    /vincular reads the EXISTING streak surface (useStreak — no new
    endpoint, ADR-0048's growth rule untouched) and, when this browser
    already carries a played account (streak > 0 or a counted today),
    requires an explicit switch-account acknowledgement before the POST
    arms; cookieless and zero-history browsers — the recovery user — see no
    extra step, and the button waits for the read to settle so the gate
    cannot be raced by a fast click. This is a UX guard over decision 4's
    recorded semantics (the bystander's account is never merged, only its
    cookie replaced), not an authorization boundary: the residual stands
    that an ACKNOWLEDGED switch still replaces this device's cookie, and a
    user who checks the box loses this device's anonymous account from view
    (the account and its sessions survive untouched in the DB — the browser
    simply stops presenting that cookie, and no path leads back to it). A
    second accepted residual is the LAPSED-HISTORY bystander: a player with
    real completions but streak 0 and nothing counted today evaluates the
    signal false and is NOT gated — the bound of the deliberate
    no-new-endpoint choice (the streak surface is the only signal this gate
    reads); their account likewise survives in the DB but drops from view,
    recoverable only through an attached email of its own, which an
    anonymous bystander typically lacks.

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
  request, re-checked TWICE at confirm — on the requester BEFORE any merge
  (a still-live pending token for a different email is a dead intent the
  moment the requester's verified email differs from it, and it must not
  trigger a destructive merge with that email's holder on its way to the
  409), and on the resolved winner after, as the concurrent-window
  backstop. Either way: 409, token spent, zero silent change; email change
  is a settings/M4 flow with its own safeguards.
- The reminder channel remains dormant: #21 stores consent; only #32 may
  send, and only to reminder-consent holders (ADR-0012).
- "Magic link" enters CONTEXT.md as a durable term.
