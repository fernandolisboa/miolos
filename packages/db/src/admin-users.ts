import type { AdminMember, AdminMemberRole } from "@miolos/core";
import { and, asc, eq, isNotNull, sql, type SQL } from "drizzle-orm";

import type { Db } from "./client";
import { adminUsers, users } from "./schema";

export async function adminRoleOf(
  db: Db,
  userId: string,
): Promise<{ email: string | null; role: AdminMemberRole | null }> {
  const rows = await db
    .select({ email: users.email, role: adminUsers.role })
    .from(users)
    .leftJoin(adminUsers, eq(adminUsers.email, users.email))
    .where(and(eq(users.id, userId), isNotNull(users.emailVerifiedAt)));
  return rows[0] ?? { email: null, role: null };
}

export async function listAdminMembers(db: Db): Promise<AdminMember[]> {
  return await db
    .select({ email: adminUsers.email, role: adminUsers.role })
    .from(adminUsers)
    .orderBy(asc(adminUsers.email));
}

function guardedWrite(email: string, write: SQL): SQL {
  // see ADR-0100
  return sql`
    with superusers as (
      select email from admin_users where role = 'superuser' for update
    ), guard as (
      select exists (select 1 from superusers where email = ${email})
         and not exists (select 1 from superusers where email <> ${email})
             as is_last
    ), ${write}`;
}

export async function upsertAdminMember(
  db: Db,
  email: string,
  role: AdminMemberRole,
): Promise<"done" | "last-superuser"> {
  const result = await db.execute<{ written: boolean }>(
    guardedWrite(
      email,
      sql`written as (
        insert into admin_users (email, role)
        select ${email}, ${role} from guard
         where not (is_last and ${role}::text <> 'superuser')
        on conflict (email) do update set role = excluded.role
        returning email
      )
      select exists (select 1 from written) as written`,
    ),
  );
  return result.rows[0]?.written ? "done" : "last-superuser";
}

export async function removeAdminMember(
  db: Db,
  email: string,
): Promise<"done" | "absent" | "last-superuser"> {
  const result = await db.execute<{ is_last: boolean; removed: boolean }>(
    guardedWrite(
      email,
      sql`removed as (
        delete from admin_users
         where email = ${email} and not (select is_last from guard)
        returning email
      )
      select is_last, exists (select 1 from removed) as removed from guard`,
    ),
  );
  const outcome = result.rows[0];
  if (outcome?.removed) {
    return "done";
  }
  return outcome?.is_last ? "last-superuser" : "absent";
}
