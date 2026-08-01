import { createDb, type Db } from "@miolos/db";

/**
 * Per-request acquisition; neon-http is stateless HTTP, so construction is
 * cheap and there is deliberately no module-level cache (connection
 * budgeting per ADR-0014, and the mock seam for seam-4 integration tests).
 */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return createDb(url);
}
