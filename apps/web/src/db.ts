import "server-only";

import { createDb, type Db } from "@miolos/db";

export function getDb(): Db {
  const url = process.env.WEB_DATABASE_URL;
  if (!url) {
    throw new Error("WEB_DATABASE_URL is not set");
  }
  return createDb(url);
}
