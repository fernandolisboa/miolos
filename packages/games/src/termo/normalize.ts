/**
 * THE single normalization function for Termo. Lowercase → Unicode NFD →
 * strip combining marks (category Mn). ç→c falls out of NFD (c + U+0327).
 * Mirrors the normalize() function in content/termo/pipeline.py — Python
 * filters Mn only, hence \p{Mn}, not \p{M}, for exact parity; the
 * word-list harness round-trips every canonical form in content/termo
 * through this function to pin the two implementations together
 * mechanically.
 *
 * Total over strings; shape-checking is deliberately separate
 * (isValidGuess / evaluateGuess).
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "");
}
