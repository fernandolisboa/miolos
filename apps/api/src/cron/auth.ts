import { createHash, timingSafeEqual } from "node:crypto";

export function isAuthorized(authorizationHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorizationHeader) {
    return false;
  }
  const received = createHash("sha256").update(authorizationHeader).digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(received, expected);
}
