import { archiveDayCardHandler } from "../../../src/og/handlers";

/**
 * `/cartao/<YYYY-MM-DD>` — the OG card for `/arquivo/<data>` (#104,
 * ADR-0071). A table entry: segment config, and one call.
 *
 * **Why this is a route handler at its own URL and not
 * `app/arquivo/[data]/opengraph-image.tsx`.** A metadata image MODULE on a
 * segment is resolved into the metadata graph of every descendant route,
 * which drags `next/og` → `@vercel/og` + `resvg.wasm` + `sharp` + libvips
 * into functions that render no card. ADR-0054 decision 9 measured that at
 * #34 and fixed it: `/arquivo`, `/arquivo/[data]` and `/arquivo/mes/[mes]`
 * went 23.5–23.6 MB → 2.7 MB. #104 takes the relief D9 named and deferred
 * (`:611-613`) for these three shells only, and a production build measured
 * the three pages unchanged at 2.7 MB with this handler carrying its own
 * 22.4 MB. Do not move this file into a segment.
 *
 * `/cartao/mes` with nothing after it matches THIS route with `data = "mes"`
 * (the `mes` node registers no handler of its own), which `parseArchiveDate`
 * rejects → 404. `T-WEB-S334` pins it.
 *
 * ADR-0053 decision 2 — see `app/arquivo/page.tsx` for the kill-switch
 * argument. No `revalidate`, no CDN TTL: `CARD_HEADERS` rides the
 * `ImageResponse` options on the 200 arm and on the 404 arm alike.
 */
export const dynamic = "force-dynamic";

/**
 * Hand-written context, deliberately NOT Next's generated `RouteContext`.
 * That type exists only inside `.next/types`, `turbo.json`'s `typecheck` task
 * has no dependency on `build`, and the repo's gate order wipes `.next`
 * before typechecking — so a generated-type reference gives a green local run
 * and a red gate with `TS2304`. `app/arquivo/mes/[mes]/page.tsx:18-25` records
 * the same for `PageProps`.
 */
export async function GET(
  _request: Request,
  ctx: { readonly params: Promise<{ readonly data: string }> },
): Promise<Response> {
  return archiveDayCardHandler((await ctx.params).data);
}
