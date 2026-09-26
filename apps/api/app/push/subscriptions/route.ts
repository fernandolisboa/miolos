import {
  pushSubscribeResponseSchema,
  pushSubscribeSchema,
  pushUnsubscribeResponseSchema,
  pushUnsubscribeSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { writePreamble } from "../../../src/http/write-preamble";
import { isPushConfigured } from "../../../src/push/config";
import {
  deleteSubscription,
  upsertSubscription,
} from "../../../src/push/service";
import { captureEvent, runAfterResponse } from "../../../src/telemetry/capture";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse("POST, DELETE, OPTIONS");
}

function pushUnavailable(): Response | undefined {
  return isPushConfigured()
    ? undefined
    : errorResponse(503, "push-not-configured");
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const context = await writePreamble(
      request,
      pushSubscribeSchema,
      pushUnavailable,
    );
    if (context.failure) {
      return context.failure;
    }

    const { stored, inserted } = await upsertSubscription(context.db, {
      userId: context.userId,
      endpoint: context.body.endpoint,
      p256dh: context.body.keys.p256dh,
      auth: context.body.keys.auth,
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
    const context = await writePreamble(
      request,
      pushUnsubscribeSchema,
      pushUnavailable,
    );
    if (context.failure) {
      return context.failure;
    }

    await deleteSubscription(context.db, context.userId, context.body.endpoint);

    return Response.json(
      pushUnsubscribeResponseSchema.parse({ removed: true }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}
