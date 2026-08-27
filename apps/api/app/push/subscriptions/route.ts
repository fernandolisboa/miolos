import {
  pushSubscribeResponseSchema,
  pushSubscribeSchema,
  pushUnsubscribeResponseSchema,
  pushUnsubscribeSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { getDb } from "../../../src/db";
import { isPushConfigured } from "../../../src/push/config";
import {
  deleteSubscription,
  upsertSubscription,
} from "../../../src/push/service";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../../src/session/origin-guard";
import { requireUserId } from "../../../src/session/service";
import { captureEvent, runAfterResponse } from "../../../src/telemetry/capture";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse("POST, DELETE, OPTIONS");
}

async function writePreamble(request: NextRequest): Promise<
  | { failure: Response }
  | {
      failure?: undefined;
      db: ReturnType<typeof getDb>;
      userId: string;
      raw: unknown;
    }
> {
  warnIfGuardDegraded();

  if (
    isCrossSiteWrite(
      {
        secFetchSite: request.headers.get("sec-fetch-site"),
        origin: request.headers.get("origin"),
      },
      process.env.WEB_ORIGIN,
    )
  ) {
    return { failure: errorResponse(403, "cross-site") };
  }

  if (!isPushConfigured()) {
    return { failure: errorResponse(503, "push-not-configured") };
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return { failure: errorResponse(415, "unsupported-media-type") };
  }

  const db = getDb();
  const userId = await requireUserId(
    db,
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (!userId) {
    return { failure: errorResponse(401, "no-session") };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { failure: errorResponse(400, "invalid-body") };
  }

  return { db, userId, raw };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(request);
    if (context.failure) {
      return context.failure;
    }

    const parsed = pushSubscribeSchema.safeParse(context.raw);
    if (!parsed.success) {
      return errorResponse(400, "invalid-body");
    }

    const { stored, inserted } = await upsertSubscription(context.db, {
      userId: context.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
    if (!stored) {
      return errorResponse(429, "too-many-requests");
    }

    if (inserted) {
      const userId = context.userId;
      runAfterResponse(() =>
        captureEvent({
          distinctId: userId,
          event: "notification_opt_in",
          properties: {},
        }),
      );
    }

    return Response.json(
      pushSubscribeResponseSchema.parse({ subscribed: true }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(request);
    if (context.failure) {
      return context.failure;
    }

    const parsed = pushUnsubscribeSchema.safeParse(context.raw);
    if (!parsed.success) {
      return errorResponse(400, "invalid-body");
    }

    await deleteSubscription(context.db, context.userId, parsed.data.endpoint);

    return Response.json(
      pushUnsubscribeResponseSchema.parse({ removed: true }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}
