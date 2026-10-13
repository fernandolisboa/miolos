import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  adminRoleOf,
  listAdminMembers,
  removeAdminMember,
  upsertAdminMember,
} from "../src/admin-users";
import { users } from "../src/schema";
import { createTestDb } from "../src/testing";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users, admin_users cascade`);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await ctx.close();
});

async function createUser(
  email: string | null,
  verified: boolean,
): Promise<string> {
  const inserted = await ctx.db
    .insert(users)
    .values({ email, emailVerifiedAt: verified ? new Date() : null })
    .returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  return user.id;
}

async function seed(
  rows: { email: string; role: "superuser" | "admin" }[],
): Promise<void> {
  for (const { email, role } of rows) {
    await ctx.db.execute(
      sql`insert into admin_users (email, role) values (${email}, ${role})`,
    );
  }
}

function messages(error: unknown): string {
  let out = "";
  let current: unknown = error;
  while (current instanceof Error) {
    out += current.message;
    current = current.cause;
  }
  return out;
}

async function thrownBy(statement: Promise<unknown>): Promise<unknown> {
  try {
    await statement;
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("adminRoleOf (ADR-0100)", () => {
  it("T-DB-S135: the role of a verified email's row; an unverified, absent or unlisted email has none", async () => {
    await seed([
      { email: "ana@example.com", role: "superuser" },
      { email: "bia@example.com", role: "admin" },
      { email: "caio@example.com", role: "admin" },
    ]);
    const ana = await createUser("ana@example.com", true);
    const bia = await createUser("bia@example.com", true);
    const caio = await createUser("caio@example.com", false);
    const zeca = await createUser("zeca@example.com", true);
    const anonymous = await createUser(null, false);

    expect(await adminRoleOf(ctx.db, ana)).toEqual({
      email: "ana@example.com",
      role: "superuser",
    });
    expect(await adminRoleOf(ctx.db, bia)).toEqual({
      email: "bia@example.com",
      role: "admin",
    });
    expect(await adminRoleOf(ctx.db, caio)).toEqual({
      email: null,
      role: null,
    });
    expect(await adminRoleOf(ctx.db, zeca)).toEqual({
      email: "zeca@example.com",
      role: null,
    });
    expect(await adminRoleOf(ctx.db, anonymous)).toEqual({
      email: null,
      role: null,
    });
    expect(
      await adminRoleOf(ctx.db, "0b6f3c1e-2d4a-4e8b-9f10-3a5c7d9e1f20"),
    ).toEqual({ email: null, role: null });
  });
});

describe("member writes (ADR-0100)", () => {
  it("T-DB-S136: the list is sorted by email; an upsert inserts, then changes the role in place", async () => {
    expect(await listAdminMembers(ctx.db)).toEqual([]);
    expect(
      await upsertAdminMember(ctx.db, "caio@example.com", "superuser"),
    ).toBe("done");
    expect(await upsertAdminMember(ctx.db, "ana@example.com", "admin")).toBe(
      "done",
    );
    expect(
      await upsertAdminMember(ctx.db, "bia@example.com", "superuser"),
    ).toBe("done");
    expect(await listAdminMembers(ctx.db)).toEqual([
      { email: "ana@example.com", role: "admin" },
      { email: "bia@example.com", role: "superuser" },
      { email: "caio@example.com", role: "superuser" },
    ]);

    expect(
      await upsertAdminMember(ctx.db, "ana@example.com", "superuser"),
    ).toBe("done");
    expect(await upsertAdminMember(ctx.db, "caio@example.com", "admin")).toBe(
      "done",
    );
    expect(await listAdminMembers(ctx.db)).toEqual([
      { email: "ana@example.com", role: "superuser" },
      { email: "bia@example.com", role: "superuser" },
      { email: "caio@example.com", role: "admin" },
    ]);
  });

  it("T-DB-S137: a removal answers done, then absent", async () => {
    await seed([
      { email: "ana@example.com", role: "superuser" },
      { email: "bia@example.com", role: "admin" },
    ]);
    expect(await removeAdminMember(ctx.db, "bia@example.com")).toBe("done");
    expect(await removeAdminMember(ctx.db, "bia@example.com")).toBe("absent");
    expect(await removeAdminMember(ctx.db, "zeca@example.com")).toBe("absent");
    expect(await listAdminMembers(ctx.db)).toEqual([
      { email: "ana@example.com", role: "superuser" },
    ]);
  });

  it("T-DB-S138: the last superuser can be neither removed nor demoted and nothing is written; beside a second, either may go", async () => {
    await seed([
      { email: "ana@example.com", role: "superuser" },
      { email: "bia@example.com", role: "admin" },
    ]);
    expect(await removeAdminMember(ctx.db, "ana@example.com")).toBe(
      "last-superuser",
    );
    expect(await upsertAdminMember(ctx.db, "ana@example.com", "admin")).toBe(
      "last-superuser",
    );
    expect(
      await upsertAdminMember(ctx.db, "ana@example.com", "superuser"),
    ).toBe("done");
    expect(await removeAdminMember(ctx.db, "bia@example.com")).toBe("done");
    expect(await listAdminMembers(ctx.db)).toEqual([
      { email: "ana@example.com", role: "superuser" },
    ]);

    expect(
      await upsertAdminMember(ctx.db, "bia@example.com", "superuser"),
    ).toBe("done");
    expect(await upsertAdminMember(ctx.db, "ana@example.com", "admin")).toBe(
      "done",
    );
    expect(await removeAdminMember(ctx.db, "bia@example.com")).toBe(
      "last-superuser",
    );
    expect(
      await upsertAdminMember(ctx.db, "ana@example.com", "superuser"),
    ).toBe("done");
    expect(await removeAdminMember(ctx.db, "bia@example.com")).toBe("done");
    expect(await listAdminMembers(ctx.db)).toEqual([
      { email: "ana@example.com", role: "superuser" },
    ]);
  });

  it("T-DB-S139: each guarded write is one statement that locks every superuser row before counting", async () => {
    await seed([
      { email: "ana@example.com", role: "superuser" },
      { email: "bia@example.com", role: "superuser" },
    ]);
    const execute = vi.spyOn(ctx.db, "execute");
    await upsertAdminMember(ctx.db, "ana@example.com", "admin");
    await removeAdminMember(ctx.db, "ana@example.com");

    const dialect = new PgDialect();
    const statements = execute.mock.calls.map(([query]) =>
      (typeof query === "string"
        ? query
        : dialect.sqlToQuery(query.getSQL()).sql
      )
        .replace(/\s+/g, " ")
        .trim(),
    );
    expect(statements).toHaveLength(2);
    for (const statement of statements) {
      expect(statement).toMatch(
        /^with superusers as \( select email from admin_users where role = 'superuser' for update \)/,
      );
    }
  });

  it("T-DB-S140: an uppercase email and an unknown role fail by constraint name", async () => {
    const uppercase = await thrownBy(
      ctx.db.execute(
        sql`insert into admin_users (email, role) values ('Ana@example.com', 'admin')`,
      ),
    );
    expect(messages(uppercase)).toContain("admin_users_email_check");

    const owner = await thrownBy(
      ctx.db.execute(
        sql`insert into admin_users (email, role) values ('ana@example.com', 'owner')`,
      ),
    );
    expect(messages(owner)).toContain("admin_users_role_check");
  });
});
