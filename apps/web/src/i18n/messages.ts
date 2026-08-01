/**
 * All user-facing copy lives here (ADR-0013, ADR-0018): components never
 * carry string literals. Pure values and pure value-returning functions.
 */

// One product name, one source of truth (plan 017 §12.6). Hoje, /binairo
// and the conclusion all render this same value; a second copy is how two
// screens drift apart.
const wordmark = "Miolos";

export const messages = {
  meta: {
    title: "Miolos — quatro jogos por dia",
    description:
      "Quatro jogos de raciocínio por dia — Termo, Sudoku, Nonogram e Binairo. Um puzzle novo de cada, todos os dias, igual para todo mundo.",
  },
  brand: {
    wordmark,
  },
  hoje: {
    // Kept as an alias of brand.wordmark so app/page.tsx and its smoke test
    // keep rendering the same string while the migration finishes.
    wordmark,
    completedOfTotal: (done: number, total: number) =>
      `${done} de ${total} concluídos`,
    streak: {
      label: "sequência",
      // Screen-reader copy is composed here, never in a component.
      aria: (count: number) =>
        `sequência de ${count} ${count === 1 ? "dia" : "dias"}`,
    },
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
    links: {
      archive: "Arquivo",
      freePlay: "Modo livre",
      stats: "Estatísticas",
    },
  },
  binairo: {
    // The arrow is copy, not decoration: it is what makes the label read as
    // a back affordance without an icon dependency.
    back: "← Hoje",
    backAria: "Voltar para Hoje",
    kicker: "Lógica",
    title: "Binairo",
    // States rule 4 for rows AND columns (plan 017 deviation 1): ADR-0020
    // rule 4 covers both, and the reference frame's shorter wording would
    // teach the player a rule the engine does not enforce.
    rules:
      "Preencha a grade com zeros e uns. Cada linha e coluna tem quatro de cada, nunca três iguais seguidos, e nenhuma linha ou coluna se repete.",
    timerLabel: "Tempo",
    timerAria: (elapsed: string) => `tempo decorrido: ${elapsed}`,
    progressLabel: "Progresso",
    progressLong: (filled: number, total: number) =>
      `${filled} de ${total} células`,
    progressShort: (filled: number, total: number) => `${filled} de ${total}`,
    controls: {
      zero: "0",
      one: "1",
      erase: "apagar",
      zeroAria: "pintar zeros",
      oneAria: "pintar uns",
      eraseAria: "apagar células",
      affordance: "ou clique na célula para alternar",
    },
    // Every aria-* string is composed here, never in a component (the
    // hoje.streak.aria precedent). Row and column are 1-based for a reader.
    cellAria: (row: number, column: number, value: 0 | 1 | null) =>
      `linha ${row}, coluna ${column}: ${value === null ? "vazia" : value}`,
    cellGivenAria: (row: number, column: number, value: 0 | 1) =>
      `linha ${row}, coluna ${column}: ${value}, célula fixa`,
    cellInvalidAria: "esta célula quebra uma regra",
    hint: {
      available: "Usar dica — 1 disponível",
      used: "Dica usada",
      explain: {
        correction: "Corrigimos uma célula que não fecha com as regras.",
        fill: "Preenchemos uma célula para você.",
      },
    },
    unavailable: {
      title: "O Binairo de hoje ainda não chegou.",
      body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
      cta: "Voltar para Hoje",
    },
  },
  conclusao: {
    back: "← Hoje",
    backAria: "Voltar para Hoje",
    kicker: "Lógica",
    title: "Binairo",
    stampLabel: "Concluído",
    stampAria: (elapsed: string, hints: number) =>
      `Binairo concluído em ${elapsed}, ${hints === 0 ? "sem dicas" : "com 1 dica"}`,
    hints: (used: number) => (used === 0 ? "sem dicas" : "com 1 dica"),
    sync: {
      pending:
        "Resultado guardado neste aparelho — sincroniza quando a conexão voltar.",
      // Not cosmetic: without it the "Concluído" stamp would stand while the
      // server holds no completion, making the client's own verdict the
      // user-visible authority (plan 017 §9.2, ADR-0004).
      rejected: "Não foi possível registrar este resultado no dia de hoje.",
    },
    dayCard: {
      title: "O dia até agora",
      missing: "falta",
      games: {
        termo: "Termo",
        sudoku: "Sudoku",
        nonogram: "Nonogram",
        // A distinct mobile string, never a runtime truncation.
        nonogramShort: "Nono.",
        binairo: "Binairo",
      },
    },
    cta: "Fechar o dia — voltar para Hoje",
    stats: "Ver estatísticas",
    notYet: {
      title: "Você ainda não concluiu o Binairo de hoje.",
      body: "O resumo aparece assim que a grade fechar.",
      cta: "Jogar o Binairo de hoje",
    },
  },
} as const;

export type Messages = typeof messages;
