import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "./schema";
import { sessions, users } from "./schema";

const clientSchema = { users, sessions };
type ClientSchema = typeof clientSchema;

export type Db = NeonHttpDatabase<ClientSchema> | PgliteDatabase<ClientSchema>;

export function createDb(databaseUrl: string): NeonHttpDatabase<ClientSchema> {
  return drizzle(neon(databaseUrl), { schema: clientSchema });
}

export function createPublishingDb(
  databaseUrl: string,
): NeonHttpDatabase<typeof schema> {
  return drizzle(neon(databaseUrl), { schema });
}
