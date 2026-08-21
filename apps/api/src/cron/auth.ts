import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Fail-closed cron auth (plan 014 D15): unset CRON_SECRET → 401, missing
 * or mismatched bearer → 401. Deliberately NOT WEB_ORIGIN's fail-open —
 * an open publish endpoint is a generation-loop DoS. Comparison is
 * SHA-256-both-sides then timingSafeEqual (equal-length digests by
 * construction): after ADR-0022 engineered timing-sensitive comparisons
 * out of the codebase, this endpoint does not reintroduce one. Vercel
 * sends `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 *
 * Extracted VERBATIM from `app/cron/publish/route.ts` at #146 (ADR-0068):
 * `POST /cron/notify` needs the same gate, and two copies of a secret
 * comparison is one copy too many. Both cron routes call this one
 * function; the publish route's auth behavior is byte-unchanged, pinned by
 * its existing `cron-publish.test.ts` auth suite staying green untouched.
 *
 * OPERATIONAL (2026-08-21): `CRON_SECRET` is marked **Sensitive** on the
 * miolos-api Vercel project — write-only, and unreadable by anyone through
 * `vercel env pull` (which writes the literal placeholder `[SENSITIVE]` in
 * its place) or `vercel env run` (which delivers it empty). So the two
 * holders of this secret can never be reconciled by copying one into the
 * other: `/cron/publish` is a Vercel cron signed with the project env var,
 * while `/cron/notify` is driven by `.github/workflows/streak-notify.yml`
 * from the `CRON_SECRET` GitHub repo secret. If they drift, the only fix is
 * to generate a new value and write it to BOTH, then redeploy — the running
 * function holds the value baked in at deploy time, and Vercel's cron sender
 * reads the project's current one, so between the env write and the redeploy
 * the two disagree and publish 401s. Beware `apps/api/vercel.json`'s
 * `ignoreCommand: npx turbo-ignore`: a redeploy with no change under
 * `apps/api` is skipped, and the new value silently never lands.
 * Runbook: `docs/pending-fernando.md` NOW §2.
 */
export function isAuthorized(authorizationHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorizationHeader) {
    return false;
  }
  const received = createHash("sha256").update(authorizationHeader).digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(received, expected);
}
