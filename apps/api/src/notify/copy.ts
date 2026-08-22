/**
 * The streak-at-risk nudge's pt-BR copy. The payload is composed
 * server-side, so the strings live beside the composer; `apps/api` has no
 * `messages.ts`.
 *
 * CONTEXT.md vocabulary — *sequência*, *virada* (à meia-noite, horário de
 * Brasília). NO PUZZLE CONTENT, EVER: the number is the only variable, it
 * comes from `computeStreak` (the single streak authority), and it is
 * COPY ONLY — never the send condition (the candidate SQL decides who is
 * nudged).
 */
export function nudgeCopy(streak: number): { title: string; body: string } {
  const dias = streak === 1 ? "1 dia" : `${streak} dias`;
  return {
    title: "Miolos",
    body: `Sua sequência de ${dias} termina à meia-noite, no horário de Brasília. Jogue hoje para mantê-la.`,
  };
}
