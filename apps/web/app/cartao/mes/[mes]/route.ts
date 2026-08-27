import { archiveMonthCardHandler } from "../../../../src/og/handlers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { readonly params: Promise<{ readonly mes: string }> },
): Promise<Response> {
  return archiveMonthCardHandler((await ctx.params).mes);
}
