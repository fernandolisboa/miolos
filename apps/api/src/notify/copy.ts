/**
 * The streak-at-risk nudge's pt-BR copy (#146, ADR-0064 decision 6) — the
 * `email/copy.ts` precedent: the payload is composed server-side, so the
 * strings live beside the composer; `apps/api` has no `messages.ts`, and
 * the strings-externalised rule's recorded exception machinery is
 * web-side (the sw.js fallback comment carries the sibling exception).
 *
 * CONTEXT.md vocabulary — *sequência*, *virada* (à meia-noite, horário de
 * Brasília). NO PUZZLE CONTENT, EVER: the number is the only variable, it
 * comes from `computeStreak` (the single streak authority, ADR-0048), and
 * it is COPY ONLY — never the send condition (the candidate SQL decides
 * who is nudged; Q2 = 2a, any live streak).
 */
export function nudgeCopy(streak: number): { title: string; body: string } {
  const dias = streak === 1 ? "1 dia" : `${streak} dias`;
  return {
    title: "Miolos",
    body: `Sua sequência de ${dias} termina à meia-noite, no horário de Brasília. Jogue hoje para mantê-la.`,
  };
}
