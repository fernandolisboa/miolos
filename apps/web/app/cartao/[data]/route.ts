import { archiveDayCardHandler } from "../../../src/og/handlers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: { readonly params: Promise<{ readonly data: string }> },
): Promise<Response> {
  return archiveDayCardHandler((await ctx.params).data);
}
