import { archiveMonthCardHandler } from "../../../../src/og/handlers";

/**
 * `/cartao/mes/<YYYY-MM>` — the OG card for `/arquivo/mes/<mês>` (#104,
 * ADR-0071). The proven day shape, copied: see `app/cartao/[data]/route.ts`
 * for why this family lives at its own URLs rather than in the segment, and
 * for the hand-written context type.
 *
 * A literal `mes` segment between `/cartao` and the month, for the same
 * reason `app/arquivo/mes/[mes]` has one (`routes.ts`): two dynamic segment
 * NAMES at the same position is a Next build error. `/cartao/mes/2026-08` has
 * three segments and matches only this route.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { readonly params: Promise<{ readonly mes: string }> },
): Promise<Response> {
  return archiveMonthCardHandler((await ctx.params).mes);
}
