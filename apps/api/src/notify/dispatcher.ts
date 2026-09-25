import {
  computeStreak,
  pushNudgePayloadSchema,
  streakReminderSchema,
  type CronNotifyResponse,
} from "@miolos/core";
import type { Db } from "@miolos/db";
import {
  claimNudgeSend,
  listCompletionsForStreak,
  listEmailNudgeCandidates,
  listPushNudgeCandidates,
} from "@miolos/db/user";

import type { ReminderSend } from "../email/transport";
import { listSubscriptions, pruneSubscription } from "../push/service";
import { nudgeCopy } from "./copy";
import type { NudgeSend } from "./transport";

type Tick = { today: string; hour: number };

async function streakOf(
  db: Db,
  userId: string,
  today: string,
): Promise<number> {
  const rows = await listCompletionsForStreak(db, userId);
  return computeStreak(rows, today).streak;
}

async function runPushArm(
  db: Db,
  { today, hour }: Tick,
  send: NudgeSend,
): Promise<CronNotifyResponse["push"]> {
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

      const streak = await streakOf(db, userId, today);
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

async function runEmailArm(
  db: Db,
  { today, hour }: Tick,
  send: ReminderSend,
): Promise<CronNotifyResponse["email"]> {
  const candidates = await listEmailNudgeCandidates(db, { today, hour });
  let claimed = 0;
  let sent = 0;
  let failed = 0;

  for (const { userId, email } of candidates) {
    try {
      const owns = await claimNudgeSend(db, {
        userId,
        date: today,
        channel: "email",
      });
      if (!owns) {
        continue;
      }
      claimed += 1;

      const streak = await streakOf(db, userId, today);
      if (await send(streakReminderSchema.parse({ to: email, streak }))) {
        sent += 1;
      } else {
        failed += 1;
      }
    } catch (thrown) {
      console.error(`cron-notify: email candidate ${userId} failed`, thrown);
      failed += 1;
    }
  }

  return { candidates: candidates.length, claimed, sent, failed };
}

export async function runNotifyTick(
  db: Db,
  args: Tick & { sendPush: NudgeSend; sendEmail: ReminderSend },
): Promise<CronNotifyResponse> {
  const push = await runPushArm(db, args, args.sendPush);
  const email = await runEmailArm(db, args, args.sendEmail);
  return { push, email };
}
