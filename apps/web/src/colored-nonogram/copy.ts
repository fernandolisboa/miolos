// see ADR-0132
import type { ColoredRun, PictureTone } from "@miolos/games/colored-nonogram";

const TONE_NAMES = {
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
} as const satisfies Record<PictureTone, string>;

export const coloredCopy = {
  painted: (tone: string) => `pintada de ${tone}`,
  cellAria: (row: number, column: number, tone: string) =>
    `linha ${row}, coluna ${column}: ${tone}`,
  swatchAria: (tone: string) => `pintar de ${tone}`,
  affordance:
    "No teclado: 1 pinta com a cor escolhida, 2 marca, 0 apaga. O botão direito troca entre a cor e o ✕.",
} as const;

export function toneName(
  palette: readonly PictureTone[],
  tone: number,
): string {
  const letter = palette[tone - 1];
  return letter === undefined ? "" : TONE_NAMES[letter];
}

export function runLabel(
  palette: readonly PictureTone[],
  run: ColoredRun,
): string {
  return `${String(run.length)} ${toneName(palette, run.tone)}`;
}
