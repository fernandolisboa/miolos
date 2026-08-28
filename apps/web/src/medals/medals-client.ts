import { medalsResponseSchema, type MedalsResponse } from "@miolos/core";

export async function fetchMedals(): Promise<MedalsResponse | undefined> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: medals fetch skipped, the screen keeps the zero state",
    );
    return undefined;
  }
  try {
    const response = await fetch(`${apiUrl}/medals`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }

    const parsed = medalsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
