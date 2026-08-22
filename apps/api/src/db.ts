import { createDb, type Db } from "@miolos/db";

/**
 * Per-request acquisition; neon-http is stateless HTTP, so construction is
 * cheap and there is deliberately no module-level cache — connection
 * budgeting (ADR-0014), and it is also the seam every route test mocks.
 */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return createDb(url);
}
