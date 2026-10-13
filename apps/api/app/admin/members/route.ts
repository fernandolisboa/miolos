import { adminMemberRemoveSchema, adminMemberWriteSchema } from "@miolos/core";
import type { Db } from "@miolos/db";
import {
  adminRoleOf,
  removeAdminMember,
  upsertAdminMember,
} from "@miolos/db/publishing";
import type { NextRequest } from "next/server";

import { adminState, webOriginUnset } from "../../../src/admin/state";
import { corsHeaders, preflightResponse } from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import {
  writePreamble,
  type BodySchema,
} from "../../../src/http/write-preamble";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse("POST, DELETE, OPTIONS");
}

async function superuserWrite<T>(
  request: NextRequest,
  schema: BodySchema<T>,
  write: (
    db: Db,
    body: T,
    userId: string,
  ) => Promise<"done" | "absent" | "last-superuser">,
): Promise<Response> {
  try {
    const context = await writePreamble(request, schema, webOriginUnset);
    if (context.failure) {
      return context.failure;
    }
    const { role } = await adminRoleOf(context.db, context.userId);
    if (role !== "superuser") {
      return errorResponse(403, "not-superuser");
    }
    const outcome = await write(context.db, context.body, context.userId);
    if (outcome === "last-superuser") {
      return errorResponse(409, "last-superuser");
    }
    return Response.json(await adminState(context.db, context.userId), {
      headers: corsHeaders({ credentials: true }),
    });
  } catch {
    return errorResponse(500, "internal");
  }
}

export function POST(request: NextRequest): Promise<Response> {
  return superuserWrite(
    request,
    adminMemberWriteSchema,
    async (db, { email, role }, userId) => {
      const outcome = await upsertAdminMember(db, email, role);
      if (outcome === "done") {
        console.info("admin member upsert", { userId, email, role });
      }
      return outcome;
    },
  );
}

export function DELETE(request: NextRequest): Promise<Response> {
  return superuserWrite(
    request,
    adminMemberRemoveSchema,
    async (db, { email }, userId) => {
      const outcome = await removeAdminMember(db, email);
      if (outcome === "done") {
        console.info("admin member remove", { userId, email });
      }
      return outcome;
    },
  );
}
