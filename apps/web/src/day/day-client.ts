import { dayResponseSchema, type DayResponse } from "@miolos/core";

export async function fetchDayTruth(): Promise<DayResponse | undefined> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: day fetch skipped, the hub keeps this device's own day state",
    );
    return undefined;
  }
  try {
    const response = await fetch(`${apiUrl}/day`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }

    const parsed = dayResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
