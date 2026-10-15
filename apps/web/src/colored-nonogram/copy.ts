// see ADR-0052: per-variant copy lives beside the chunk that alone renders it.
const TONE_NAMES: Readonly<Record<string, string>> = {
  k: "preto",
  e: "cinza",
  l: "cinza-claro",
  n: "marrom",
  t: "bege",
  r: "vermelho",
  o: "laranja",
  y: "amarelo",
  g: "verde",
  d: "verde-escuro",
  s: "azul-claro",
  b: "azul",
  p: "roxo",
  m: "rosa",
};

export const coloredCopy = {
  toneName: (letter: string): string => TONE_NAMES[letter] ?? letter,
  run: (length: number, tone: string) => `${length} ${tone}`,
  painted: (tone: string) => `pintada de ${tone}`,
  cellAria: (row: number, column: number, tone: string) =>
    `linha ${row}, coluna ${column}: ${tone}`,
  swatchAria: (tone: string) => `pintar de ${tone}`,
  affordance:
    "No teclado: 1 pinta com a cor escolhida, 2 marca, 0 apaga. O botão direito troca entre a cor e o ✕.",
};

export function toneName(palette: readonly string[], tone: number): string {
  return coloredCopy.toneName(palette[tone - 1] ?? "");
}
