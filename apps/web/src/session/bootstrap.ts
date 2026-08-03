/**
 * Anonymous-identity bootstrap (issue #15), extracted from
 * `components/session-bootstrap.tsx` so the completion flush can await the
 * same mint (plan 017 §9.2). Without that ordering, a fast solve on a cold
 * first visit reliably races the in-flight mint and takes the 401 branch.
 *
 * No `Date` appears here or in anything it calls — the client clock is
 * never an identity input (#15 AC 5).
 */
import { sessionResponseSchema } from "@miolos/core";

// Module-level fire-once guard, now a SHARED PROMISE rather than a boolean:
// callers need to await the mint, not merely skip it. Survives React
// StrictMode's double effect and re-mounts, so one page load makes exactly
// one mint/resolve request (plan 009 D11 — the client half of the
// concurrency story).
let pending: Promise<void> | undefined;

/**
 * The forced re-mint in flight, if any, and whether the one allowance has
 * been spent. BOTH live here rather than in the callers, and that is a
 * correctness constraint rather than tidiness (#27 step-6 finding B-1).
 *
 * There are now TWO modules that re-mint on a 401 — `play/sync.ts`'s
 * completion flush and `termo/guess-client.ts`'s turn — and each used to
 * hold its own `reminted` boolean. Two booleans cannot see each other, and
 * `POST /session` MINTS A BRAND-NEW USER for any cookieless request
 * (`apps/api/app/session/route.ts`). So a stale cookie plus one unsynced
 * completion plus a live Termo turn put two cookieless mints in flight at
 * once, the browser kept whichever `Set-Cookie` landed last, and the
 * completion was written for the user that did NOT survive — write-once
 * under ADR-0026 decision 1, so a permanently lost streak day through the
 * identity-overwrite class ADR-0003 names as the worst failure.
 *
 * `reminting` is what actually fixes it: a second caller JOINS the first
 * request instead of starting a second identity, so mints are serialized and
 * the cookie a request carries is never ambiguous. Callers keep their own
 * independent decision to ASK; the mint stays singular.
 */
let reminting: Promise<boolean> | undefined;
let remintSpent = false;

/**
 * Resolve (or mint) the anonymous session, once per page load. Never
 * rejects: an offline first paint must not break the page, and every
 * caller treats "no session" as a retryable state rather than an error.
 */
export function ensureSession(): Promise<void> {
  pending ??= mintSession().then(() => undefined);
  return pending;
}

/**
 * Re-mint after a 401, at most once per page load and NEVER twice at a time.
 * The 401 means the cookie the first mint produced is gone or expired, so
 * returning `ensureSession`'s cached promise would retry the same failure
 * forever.
 *
 * THE ALLOWANCE RESETS ON EXACTLY TWO EVENTS, and "a mint answered 200" is
 * neither of them (finding B-2):
 *
 *  1. `confirmSession()` — a caller's re-post came back OK, so the fresh
 *     identity is SEEN TO WORK. Resetting on the mint itself instead would
 *     reopen B-1 sequentially, below.
 *  2. A mint that resolved `false` — the handler below. Nothing was spent,
 *     because nothing was minted (finding E-6).
 *
 * Without any reset the first spent re-mint is terminal for the rest of the
 * page load: a cookie that expires forty minutes into a session leaves
 * `guess-client.ts` falling to `held` on every subsequent 401, the board sits
 * held, `retry()` re-posts and holds again, the `online` listener keeps
 * firing the same dead retry, and only a full reload clears it.
 *
 * RESETTING ON A SUCCESSFUL MINT WOULD REOPEN B-1 SEQUENTIALLY. `POST
 * /session` mints a new user for every cookieless request, so an origin whose
 * cookies do not stick — the case where the re-post keeps 401ing — would mint
 * one junk identity per failed operation, `sync.ts`'s per-record loop
 * included, instead of one per page load. A mint the server then refuses is
 * not a success, and re-minting again cannot fix it.
 *
 * RESET 2 CANNOT REOPEN B-1, and the distinction is exactly the one above.
 * `mintSession` resolves `false` on three paths and only three — no
 * `NEXT_PUBLIC_API_URL`, a non-ok response, or a throwing `fetch` — and on
 * none of them did `POST /session` return a `Set-Cookie`, so no identity was
 * created for the browser to overwrite and no user row is left behind that a
 * completion could be written against. Re-arming there mints no junk user; it
 * only lets a 500 or a network blip cost a retry instead of the page load.
 * The FOURTH path is what makes that list exhaustive: a 200 whose body the
 * session contract refuses used to resolve `false` too, and it is the one
 * `false` that HAD minted. `mintSession` now reports it and resolves `true`
 * instead, precisely so this reset keeps the property it claims.
 *
 * Never rejects, on `ensureSession`'s rule and for the same reason.
 *
 * RESOLVES `true` ONLY WHEN A FRESH IDENTITY ACTUALLY LANDED, so a caller
 * re-posts against a cookie that changed rather than spending a second
 * request proving the same 401 twice.
 */
export function remintSession(): Promise<boolean> {
  if (reminting !== undefined) {
    return reminting;
  }
  if (remintSpent) {
    return Promise.resolve(false);
  }
  remintSpent = true;
  const attempt = mintSession()
    // NORMALIZED BEFORE ANYTHING READS IT, so nothing below depends on the
    // invariant that `mintSession` never rejects (finding E-5). It does not
    // today — both early returns are synchronous and everything else is
    // inside its `try` — but the invariant is now load-bearing three times
    // over, and a `.then`-only chain latches ALL THREE on the day it breaks:
    // `reminting` would hold a permanently rejected promise every later
    // caller adopts, `pending` below would make `ensureSession()` reject
    // forever (so `await ensureSession()` throws inside `postGuesses` and
    // `void send(next)` becomes an unhandled rejection), and `remintSpent`
    // would stay burned — a frozen board with no notice and no working retry.
    // A rejected mint is a mint that produced no identity, which is exactly
    // what `false` already means here.
    .catch(() => false)
    .then((minted) => {
      reminting = undefined;
      if (!minted) {
        remintSpent = false;
      }
      return minted;
    });
  reminting = attempt;
  // The fresh mint REPLACES the cached promise: a later `ensureSession()`
  // must await this identity, not the dead one the 401 already disproved.
  pending = attempt.then(() => undefined);
  return attempt;
}

/**
 * "The identity I re-minted is serving requests." Called by a caller whose
 * re-post came back OK, and by nobody else: it is what arms the NEXT re-mint,
 * so a cookie that expires later in the same page load is recoverable without
 * a reload (finding B-2).
 *
 * `response.ok`, AND NOT MERELY `status !== 401` (finding E-7). A 403 and a
 * 415 are decided BEFORE `requireUserId` in both routes, and a 429 or a 5xx is
 * decided without regard to it, so none of them is evidence that the fresh
 * cookie was honoured — and this function's whole claim is that it was. A 404
 * or a 422 IS such evidence, since both are reached only past auth, but
 * arming on the narrowest sufficient condition costs at most one extra 401
 * later and never arms on a response the identity never reached.
 *
 * A no-op when no re-mint has been spent, so callers may call it freely.
 */
export function confirmSession(): void {
  remintSpent = false;
}

/**
 * `true` only when AN IDENTITY WAS ACTUALLY MINTED — which is a claim about
 * the cookie, not about the body.
 *
 * That distinction is load-bearing since `remintSession` re-arms its one
 * allowance on `false` (finding E-6): every `false` below has to mean "the
 * server created nothing", or a re-arm could mint a second identity into the
 * sequential shape of B-1. So a 200 whose body the session contract refuses
 * is LOUD and still `true` — the server already set the cookie, and the body
 * is only the contract's proof.
 */
async function mintSession(): Promise<boolean> {
  // Loud, not silent: without the var the fetch would hit the relative URL
  // "undefined/session" and the catch below would swallow the failure —
  // identity would never mint on a misconfigured build.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: session bootstrap skipped, no identity will be minted",
    );
    return false;
  }
  try {
    // Deliberately body-less: the POST stays a CORS "simple request", so
    // the hot path needs no preflight.
    const response = await fetch(`${apiUrl}/session`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      return false;
    }
    // Parsed, never cast (boundary rule). The result is unused today —
    // the cookie is the identity; the body only proves the contract. The
    // failure is reported rather than returned, per the TSDoc above: a 200
    // means `POST /session` set the cookie, so answering `false` here would
    // tell `remintSession` nothing was created and re-arm the allowance
    // against an identity that exists.
    try {
      sessionResponseSchema.parse(await response.json());
    } catch {
      console.error(
        "POST /session answered 200 with a body the session contract refuses; the cookie is honoured, the contract has drifted",
      );
    }
    return true;
  } catch {
    // Swallow network errors: an offline first paint must not break the
    // page. The next visit simply tries again.
    return false;
  }
}
