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
      console.error(`cron-notify: candidate ${userId} failed`, thrown);
      failed += 1;
    }
  }

  return { candidates: candidates.length, claimed, sent, pruned, failed };
}
