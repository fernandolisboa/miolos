/**
 * The locale tag is externalized alongside the strings: used for
 * `<html lang>` and as the Intl locale argument, never hardcoded in
 * components.
 */
export const locale = "pt-BR";

/**
 * The Open Graph spelling of the same locale, externalized here for the same
 * reason (#34, ADR-0018 decision bullet 3 — *"so locale tags are externalized
 * too"*; step-6 finding W4, which found it living in `src/og/defaults.ts`).
 *
 * **A SEPARATE CONSTANT, DELIBERATELY.** `og:locale` is the Open Graph
 * protocol's `language_TERRITORY` with an UNDERSCORE; `<html lang>` is BCP-47
 * with a hyphen. Deriving one from the other with a `replace` would be the
 * "fix" `T-WEB-S199` asserts against — the two tags answer to different
 * specifications and a future locale can move one without the other. Living
 * beside each other is what ADR-0018 asks for; SHARING a value is what
 * ADR-0054 decision 11 forbids.
 *
 * A plain string export rather than a member of an object literal, so it
 * tree-shakes out of every client graph that does not use it — the measured
 * reason `medalCopy` and `ogCopy` are their own modules.
 */
export const ogLocale = "pt_BR";
