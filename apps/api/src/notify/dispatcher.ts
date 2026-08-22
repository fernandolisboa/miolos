import {
  computeStreak,
  pushNudgePayloadSchema,
  type CronNotifyResponse,
} from "@miolos/core";
import type { Db } from "@miolos/db";
import {
  claimNudgeSend,
  listCompletionsForStreak,
  listPushNudgeCandidates,
} from "@miolos/db/user";

import { listSubscriptions, pruneSubscription } from "../push/service";
import { nudgeCopy } from "./copy";
import type { NudgeSend } from "./transport";

/**
 * One dispatcher tick — the product's ONLY notification code path. Takes
 * `{today, hour}` from the route's single tick-instant snapshot and the
 * transport as an injected function, so every test here is real-clock-free
 * and network-free without a single `vi.mock`.
 *
 * Per candidate, IN THIS ORDER:
 *
 * 1. `claimNudgeSend` — the CLAIM COMES BEFORE THE SEND: a crash or
 *    timeout between a user's claim and their send loses that user's
 *    nudge for that day. That is the priced residual, preferred over its
 *    inverse (claim-after-send double-sends on every crash, and a double
 *    tick double-sends everyone). Not claimed → a concurrent or replayed
 *    tick owns it: skip, counting toward `candidates` only.
 * 2. The streak number via `listCompletionsForStreak` + `computeStreak` —
 *    the single streak authority; the candidate SQL's counted-day
 *    conjuncts are a PREFILTER, never a second definition.
 * 3. `pushNudgePayloadSchema.parse(nudgeCopy(streak))` — Zod before the
 *    boundary; a malformed composition never reaches a push service.
 * 4. `listSubscriptions`, SERIAL sends (round-trips dominate and
 *    concurrency multiplies connection pressure; revisit if the run ever
 *    logs ~150 candidates). `ok` → sent++; 404/410 →
 *    `pruneSubscription` (the push service's verdict about the endpoint)
 *    + pruned++; anything else → failed++, the ROW STAYS and the CLAIM
 *    STANDS — no retry this day.
 *
 * Each candidate is wrapped in try/catch with a loud console.error: one
 * user's blowup never starves the rest of the tick.
 */
export async function runNotifyTick(
  db: Db,
  args: { today: string; hour: number; send: NudgeSend },
): Promise<CronNotifyResponse> {
  const { today, hour, send } = args;
  const candidates = await listPushNudgeCandidates(db, { today, hour });
  let claimed = 0;
  let sent = 0;
  let pruned = 0;
  let failed = 0;

  for (const userId of candidates) {
    try {
      const owns = await claimNudgeSend(db, {
        userId,
        date: today,
        channel: "push",
      });
      if (!owns) {
        continue;
      }
      claimed += 1;

      const rows = await listCompletionsForStreak(db, userId);
      const { streak } = computeStreak(rows, today);
      const payload = pushNudgePayloadSchema.parse(nudgeCopy(streak));

      const subscriptions = await listSubscriptions(db, userId);
      for (const subscription of subscriptions) {
        const result = await send(subscription, payload);
        if (result.ok) {
          sent += 1;
        } else if (result.statusCode === 404 || result.statusCode === 410) {
          await pruneSubscription(db, subscription.endpoint);
          pruned += 1;
        } else {
          failed += 1;
        }
      }
    } catch (thrown) {
      // The error object rides as the second argument so the stack and any
      // `cause` survive into the log.
      console.error(`cron-notify: candidate ${userId} failed`, thrown);
      failed += 1;
    }
  }

  return { candidates: candidates.length, claimed, sent, pruned, failed };
}
