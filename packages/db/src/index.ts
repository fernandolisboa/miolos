export { sessions, users } from "./schema";
export { createDb, type Db } from "./client";
// Re-exported so consumers depend only on @miolos/db and take no direct
// drizzle-orm dependency (pnpm's isolated node-linker would otherwise fail
// the import). The driver stays an implementation detail of this package.
export { eq, sql } from "drizzle-orm";
