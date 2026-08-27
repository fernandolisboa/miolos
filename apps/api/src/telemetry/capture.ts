import type { TelemetryEvent, TelemetryEventProperties } from "@miolos/core";
import { telemetryEventPropertiesSchemas } from "@miolos/core";
import { after } from "next/server";

export const POSTHOG_INGESTION_URL = "https://us.i.posthog.com/i/v0/e/";

const CAPTURE_TIMEOUT_MS = 3_000;

let warnedMissingKey = false;

export async function captureEvent<E extends TelemetryEvent>(input: {
  distinctId: string;
  event: E;
  properties: TelemetryEventProperties[E];
}): Promise<void> {
  const key = process.env.POSTHOG_KEY;
  if (!key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.error(
        "POSTHOG_KEY is unset: telemetry capture disabled, no events are sent (ADR-0069)",
      );
    }
    return;
  }
  try {
    const properties = telemetryEventPropertiesSchemas[input.event].parse(
      input.properties,
    );
    const response = await fetch(POSTHOG_INGESTION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: input.event,
        distinct_id: input.distinctId,
        properties: {
          ...properties,

          $process_person_profile: false,

          $geoip_disable: true,
        },
      }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });

    // Undici holds the socket until the body is read or cancelled.
    void response.body?.cancel().catch(() => {});
  } catch {
    // A lost telemetry event, never a route error.
  }
}

let settled: Promise<void> = Promise.resolve();

export function telemetrySettled(): Promise<void> {
  return settled;
}

const AFTER_OUTSIDE_REQUEST_SCOPE = /outside a request scope/;

let warnedAfterUnavailable = false;

export function runAfterResponse(task: () => Promise<void>): void {
  const safe = async (): Promise<void> => {
    try {
      await task();
    } catch (error) {
      console.error(
        "telemetry: post-response task failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  };
  try {
    after(safe);
  } catch (error) {
    if (!AFTER_OUTSIDE_REQUEST_SCOPE.test(String(error))) {
      if (!warnedAfterUnavailable) {
        warnedAfterUnavailable = true;
        console.error(
          "telemetry: after() unavailable, the task ran un-tracked (ADR-0069)",
          error,
        );
      }
    }
    settled = settled.then(safe);
  }
}
