export function nudgeCopy(streak: number): { title: string; body: string } {
  const dias = streak === 1 ? "1 dia" : `${streak} dias`;
  return {
    title: "Miolos",
    body: `Sua sequência de ${dias} termina à meia-noite, no horário de Brasília. Jogue hoje para mantê-la.`,
  };
}
