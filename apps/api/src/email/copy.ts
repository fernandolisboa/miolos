/**
 * The magic-link mail copy. `apps/api` has no i18n module — this file IS
 * the externalization: one module, pt-BR strings only, imported by the
 * transport and by nothing else. The body is plain text plus one link —
 * no tracking pixels, no remote assets.
 *
 * See ADR-0050.
 */

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
