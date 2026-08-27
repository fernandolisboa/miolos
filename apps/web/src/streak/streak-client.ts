import { streakResponseSchema, type StreakResponse } from "@miolos/core";

export async function fetchStreak(): Promise<StreakResponse | undefined> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error(
      "NEXT_PUBLIC_API_URL is unset: streak fetch skipped, the hub keeps the zero state",
    );
    return undefined;
  }
  try {
    const response = await fetch(`${apiUrl}/streak`, {
      credentials: "include",
    });
    if (!response.ok) {
      return undefined;
    }

    const parsed = streakResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
