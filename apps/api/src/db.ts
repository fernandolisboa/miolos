import { createDb, type Db } from "@miolos/db";

export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return createDb(url);
}
