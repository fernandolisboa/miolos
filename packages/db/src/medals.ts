import { asc, eq } from "drizzle-orm";

import type { Db } from "./client";
import { medalGrants } from "./schema";

export async function listMedalGrants(
  db: Db,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({ medalId: medalGrants.medalId })
    .from(medalGrants)
    .where(eq(medalGrants.userId, userId))
    .orderBy(asc(medalGrants.medalId));
  return rows.map((row) => row.medalId);
}
