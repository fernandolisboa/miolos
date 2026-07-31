/**
 * All user-facing copy lives here (ADR-0013, ADR-0018): components never
 * carry string literals. Pure values and pure value-returning functions.
 */
export const messages = {
  meta: {
    title: "Miolos — quatro jogos por dia",
    description:
      "Quatro jogos de raciocínio por dia — Termo, Sudoku, Nonogram e Binairo. Um puzzle novo de cada, todos os dias, igual para todo mundo.",
  },
  hoje: {
    wordmark: "Miolos",
    completedOfTotal: (done: number, total: number) =>
      `${done} de ${total} concluídos`,
    streak: { label: "sequência" },
    games: {
      termo: {
        kicker: "Palavras",
        name: "Termo",
        description: "Seis tentativas para a palavra do dia.",
      },
      sudoku: {
        kicker: "Números",
        name: "Sudoku",
        description: "De 1 a 9, sem repetição, no clássico 9×9.",
      },
      nonogram: {
        kicker: "Imagem",
        name: "Nonogram",
        description: "Revele a figura escondida pelos números.",
      },
      binairo: {
        kicker: "Lógica",
        name: "Binairo",
        description: "Zeros e uns, em perfeito equilíbrio.",
      },
    },
    playCta: "Jogar hoje",
    playCtaShort: "Jogar",
    links: { archive: "Arquivo", freePlay: "Modo livre", stats: "Estatísticas" },
  },
} as const;

export type Messages = typeof messages;
