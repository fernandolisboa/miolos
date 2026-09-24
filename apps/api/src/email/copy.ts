export const magicLinkSubject = "Seu link mágico do Miolos";

export function magicLinkBody(url: string): string {
  return [
    "Olá!",
    "",
    "Use o link abaixo para vincular este e-mail à sua conta do Miolos —",
    "é ele que recupera a sua sequência e a leva para outro aparelho:",
    "",
    url,
    "",
    "O link vale por 30 minutos e funciona uma única vez.",
    "Importante: só confirme se foi você quem pediu este link agora mesmo.",
    "Se você não pediu, ignore este e-mail — nada acontece sem o clique.",
  ].join("\n");
}

export const streakReminderSubject = "Sua sequência no Miolos está em risco";

export function streakReminderBody(streak: number, webOrigin: string): string {
  const dias = streak === 1 ? "1 dia" : `${streak} dias`;
  return [
    `Sua sequência de ${dias} termina à meia-noite, no horário de Brasília.`,
    "Jogue hoje para mantê-la:",
    "",
    webOrigin,
    "",
    "Você recebe este lembrete porque pediu lembretes por e-mail no Miolos.",
    "No máximo um por dia, e nunca propaganda.",
    `Para não receber mais, desmarque o lembrete por e-mail em Ajustes: ${webOrigin}/ajustes`,
  ].join("\n");
}
