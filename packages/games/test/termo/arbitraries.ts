import fc from "fast-check";

// Shared fast-check arbitraries for the termo suites (plan §7). The pt-BR
// alphabet is domain data — which accented letters the engine's tests
// consider in-domain — so it lives in exactly one place. It round-trips
// cleanly through case mapping, unlike arbitrary unicode (𝔄 U+1D504 and
// ϒ U+03D2 survive toLowerCase as uppercase-category code points), so the
// no-uppercase property is restricted to these domains.
export const PTBR_ALPHABET = "abcdefghijklmnopqrstuvwxyzáéíóúâêôãõàç";
export const AZ_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

export const ptbrWord = fc.string({
  unit: fc.constantFrom(...PTBR_ALPHABET),
  minLength: 5,
  maxLength: 5,
});

export const azWord = fc.string({
  unit: fc.constantFrom(...AZ_ALPHABET),
  minLength: 5,
  maxLength: 5,
});
