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
 * Extracted VERBATIM from `app/cron/publish/route.ts` at #146 (ADR-0067):
 * `POST /cron/notify` needs the same gate, and two copies of a secret
 * comparison is one copy too many. Both cron routes call this one
 * function; the publish route's auth behavior is byte-unchanged, pinned by
 * its existing `cron-publish.test.ts` auth suite staying green untouched.
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
