import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "./schema";

/**
 * The honest test double: an in-memory PGlite database running the REAL
 * committed migrations from ./migrations — the same SQL artifact Neon gets.
 * Only reachable via the `@miolos/db/testing` subpath so app bundles never
 * touch PGlite.
 */
export async function createTestDb(): Promise<{
  db: PgliteDatabase<typeof schema>;
  close: () => Promise<void>;
}> {
  const client = new PGlite(); // in-memory
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
  });
  return { db, close: () => client.close() };
}
