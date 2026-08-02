/**
 * All user-facing copy lives here (ADR-0013, ADR-0018): components never
 * carry string literals. Pure values and pure value-returning functions.
 *
 * SHAPE (plan 018 S19, §13.1). Shared chrome sits at the top level —
 * `brand`, `hoje`, `play`, `conclusion` — and everything a game owns sits
 * under `games.<game>.{name,kicker,description,play,conclusion}`. ADR-0018
 * makes `Messages` the migration contract, so the shape is a decision and
 * not a detail: a fourth top-level `sudoku:`/`conclusaoSudoku:` block would
 * have guaranteed four copies of the same play and conclusion chrome by #27.
 */

// One product name, one source of truth (plan 017 §12.6). Hoje, /binairo
// and the conclusion all render this same value; a second copy is how two
// screens drift apart.
const wordmark = "Miolos";

// One back affordance, two shared screens, for the same reason `wordmark`
// is hoisted. The arrow is copy, not decoration: it is what makes the label
// read as a back affordance without an icon dependency.
const back = "← Hoje";
const backAria = "Voltar para Hoje";

// Hoisted so the invalid-cell name can be COMPOSED here rather than joined
// in grid.tsx with a separator no editor of this module can see (ADR-0018:
// `Messages` is the migration contract, so every user-facing string has to
// be expressible from it). Row and column are 1-based for a reader.
const cellAria = (row: number, column: number, value: 0 | 1 | null) =>
  `linha ${row}, coluna ${column}: ${value === null ? "vazia" : value}`;

// The same hoist for Sudoku (plan 018 §13.2): `cellInvalidAria` composes
// the plain name and appends its clause, so the separator lives here.
const cellAriaSudoku = (row: number, column: number, value: number | null) =>
  `linha ${row}, coluna ${column}: ${value === null ? "vazia" : value}`;

// "sem dicas" / "com 1 dica" — hoisted because both the stamp's visible
// suffix and its composed accessible name need it, and the two must never be
// able to disagree.
const hintsUsed = (used: number) => (used === 0 ? "sem dicas" : "com 1 dica");

// The board's dimensions in one place: the mobile progress bar and the stats
// card render the same string, and two copies are how they drift.
const boardSize = (size: number) => `${size} × ${size}`;

// Nonogram's cell names (plan 020 §16.1): `preenchida` / `marcada` / `vazia`,
// one spelling per concept. `vazia` is `cellAria`'s own word for a null
// Binairo cell, so a player meets one vocabulary across three games.
const cellAriaNonogram = (row: number, column: number, value: 0 | 1 | null) =>
  `linha ${row}, coluna ${column}: ${
    value === null ? "vazia" : value === 1 ? "preenchida" : "marcada"
  }`;

// An all-empty line's clue is `[]` and the UI renders "0" — the engine's own
// contract (nonogram/types.ts:10). The rail and its label must agree, so both
// go through here.
const runsText = (runs: readonly number[]) =>
  runs.length === 0 ? "0" : runs.join(", ");

export const messages = {
  meta: {
    title: "Miolos — quatro jogos por dia",
    description:
      "Quatro jogos de raciocínio por dia — Termo, Sudoku, Nonogram e Binairo. Um puzzle novo de cada, todos os dias, igual para todo mundo.",
  },
  brand: {
    wordmark,
  },
  /**
   * Hub chrome ONLY — the per-game name, kicker and description moved to
   * `games.<game>` (plan 018 S19), which deletes the duplication `hoje.games`
   * used to carry. `hoje.wordmark` was a deliberate alias of `brand.wordmark`
   * "while the migration finishes"; this is that finish, and `app/page.tsx`
   * reads `brand.wordmark` directly.
   */
  hoje: {
    completedOfTotal: (done: number, total: number) =>
      `${done} de ${total} concluídos`,
    streak: {
      label: "sequência",
      // Screen-reader copy is composed here, never in a component.
      aria: (count: number) =>
        `sequência de ${count} ${count === 1 ? "dia" : "dias"}`,
    },
    playCta: "Jogar hoje",
    playCtaShort: "Jogar",
    // The done tile (plan 018 §11.3): an outlined stamp chip plus a tabular
    // result, per DESIGN.md's "Game card" entry. Two result strings rather
    // than a runtime truncation, matching the dayCard's nonogram precedent.
    done: "Feito",
    doneResultLong: (elapsed: string) => `em ${elapsed}`,
    doneResultShort: (elapsed: string) => elapsed,
    doneAria: (game: string, elapsed: string) =>
      `${game} concluído em ${elapsed}`,
    links: {
      archive: "Arquivo",
      freePlay: "Modo livre",
      stats: "Estatísticas",
    },
  },
  /** Chrome every play screen shares (plan 018 §5.2, §13.1). */
  play: {
    back,
    backAria,
    timerLabel: "Tempo",
    timerAria: (elapsed: string) => `tempo decorrido: ${elapsed}`,
    progressLabel: "Progresso",
  },
  /** Chrome every conclusion shares (was the top-level `conclusao`). */
  conclusion: {
    back,
    backAria,
    stampLabel: "Concluído",
    hints: hintsUsed,
    /**
     * The stamp's whole accessible name, composed here rather than per game
     * (ADR-0018). Shared chrome and NOT part of `games.<game>.conclusion`
     * for a mechanical reason: that bundle is a prop passed from a server
     * component into `<ConclusionView/>`, which is `"use client"`, and React
     * refuses to serialize a function across the RSC boundary — a per-game
     * `stampAria` there is an SSR 500, not a type error. `ConclusionCopy` is
     * data-only; every conclusion string that needs a runtime value is
     * composed from this object, which the client component imports directly.
     */
    stampAria: (game: string, elapsed: string, hints: number) =>
      `${game} concluído em ${elapsed}, ${hintsUsed(hints)}`,
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
    ctaHome: "Fechar o dia — voltar para Hoje",
    // F5:65's own phrasing for this exact button — "Fechar o dia — jogar
    // Nonogram". Both CTA variants keep the "Fechar o dia" anchor and one
    // register; a colon-led label appears nowhere else in the copy deck.
    ctaNext: (game: string) => `Fechar o dia — jogar ${game}`,
    stats: "Ver estatísticas",
    notYet: {
      body: "O resumo aparece assim que a grade fechar.",
    },
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
      play: {
        title: "Sudoku",
        // Every clause is a rule the engine actually enforces (the binairo
        // deviation-1 precedent: never teach a rule that is not checked).
        rules:
          "Preencha a grade de 1 a 9. Cada linha, cada coluna e cada bloco de 3×3 tem os nove dígitos, sem repetir nenhum.",
        progressLong: (filled: number, total: number) =>
          `${filled} de ${total} células`,
        // The mobile `.progressBar` slot carries the level too (plan 018
        // §12.5), so the difficulty is not desktop-only: "Médio · 24 de 81".
        progressShort: (level: string, filled: number, total: number) =>
          `${level} · ${filled} de ${total}`,
        levelLabel: "Nível",
        level: (tier: 1 | 2 | 3 | 4 | 5) =>
          ({ 1: "Fácil", 2: "Leve", 3: "Médio", 4: "Difícil", 5: "Puxado" })[
            tier
          ],
        boardAria: "grade do Sudoku, 9 por 9",
        cellAria: cellAriaSudoku,
        cellGivenAria: (row: number, column: number, value: number) =>
          `linha ${row}, coluna ${column}: ${value}, célula fixa`,
        /** The whole accessible name of a repeating cell, separator included. */
        cellInvalidAria: (row: number, column: number, value: number | null) =>
          `${cellAriaSudoku(row, column, value)} — esta célula repete um número`,
        keypad: {
          erase: "apagar",
          digitAria: (digit: number) => `escrever ${digit}`,
          eraseAria: "apagar a célula selecionada",
          affordance:
            "ou use o teclado: 1–9 para escrever, Backspace para apagar",
        },
        hint: {
          available: "Usar dica — 1 disponível",
          used: "Dica usada",
          explain: {
            correction: "Corrigimos um número que não fecha com as regras.",
            fill: "Preenchemos uma célula para você.",
          },
        },
        unavailable: {
          title: "O Sudoku de hoje ainda não chegou.",
          body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
          cta: "Voltar para Hoje",
        },
      },
      conclusion: {
        title: "Sudoku",
        kicker: "Números",
        notYet: {
          title: "Você ainda não concluiu o Sudoku de hoje.",
          cta: "Jogar o Sudoku de hoje",
        },
      },
    },
    nonogram: {
      kicker: "Imagem",
      name: "Nonogram",
      description: "Revele a figura escondida pelos números.",
      play: {
        title: "Nonogram",
        // Every clause is a rule the engine actually enforces (the binairo
        // deviation-1 precedent): `deriveClues` is a run-length encoding in
        // order, with at least one empty cell between runs (clues.ts:24-36),
        // and the completion predicate is "the picture is painted" — crossing
        // is never required, so the blurb never asks for it.
        rules:
          "Os números de cada linha e de cada coluna são os blocos de células preenchidas, na ordem, com pelo menos um espaço entre eles. Preencha todos os blocos para revelar a figura.",
        // The denominator is the PICTURE's cell count, summed from the clues
        // — not the board's. A player finishes without crossing a single
        // cell, so a `de size²` readout would stand at 21% at the moment
        // they win (P13).
        progressLong: (filled: number, total: number) =>
          `${filled} de ${total} preenchidas`,
        // The mobile `.progressBar` slot carries the board's size too, the
        // way Sudoku's carries the level.
        progressShort: (size: number, filled: number, total: number) =>
          `${boardSize(size)} · ${filled} de ${total}`,
        // The stats card's third row, Sudoku's `levelLabel`/`level` pair
        // exactly: `.sizeCard` in the game's own module declares its box.
        sizeLabel: "Tamanho",
        size: boardSize,
        boardAria: (size: number) => `grade do Nonogram, ${size} por ${size}`,
        cellAria: cellAriaNonogram,
        // "números", never "pistas" and never "dicas" — `dica` is the reserved
        // term for the one free hint (CONTEXT.md) and reusing it would collide
        // with the hint button in the same screen-reader pass.
        rowCluesAria: (row: number, runs: readonly number[]) =>
          `números da linha ${row}: ${runsText(runs)}`,
        columnCluesAria: (column: number, runs: readonly number[]) =>
          `números da coluna ${column}: ${runsText(runs)}`,
        controls: {
          fill: "preencher",
          cross: "marcar",
          erase: "apagar",
          fillAria: "preencher células",
          crossAria: "marcar células vazias",
          eraseAria: "apagar células",
          affordance: "ou use o teclado: 1 preenche, 2 marca, 0 apaga",
        },
        hint: {
          available: "Usar dica — 1 disponível",
          used: "Dica usada",
          explain: {
            // One truthful sentence for both directions: a correction may
            // fill OR cross.
            correction: "Corrigimos uma célula que não fecha com os números.",
            fill: "Preenchemos uma célula da figura para você.",
            // The defined-unreachable branch (§15.2): the selector only falls
            // back to a cross when no undecided picture cell is left, which is
            // a board that is already solved. It ships rather than rendering
            // `undefined`.
            cross: "Marcamos uma célula que fica fora da figura.",
          },
        },
        unavailable: {
          title: "O Nonogram de hoje ainda não chegou.",
          body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
          cta: "Voltar para Hoje",
        },
      },
      conclusion: {
        title: "Nonogram",
        kicker: "Imagem",
        notYet: {
          title: "Você ainda não concluiu o Nonogram de hoje.",
          cta: "Jogar o Nonogram de hoje",
        },
      },
      // ADR-0033: the reveal has no curated name on the client, so the
      // accessible name DESCRIBES the figure rather than naming it. A sibling
      // of `conclusion`, read only by the Nonogram conclusion wrapper — it may
      // not go inside `conclusion`, which is `ConclusionCopy`'s exact shape and
      // is rendered by two other games.
      reveal: {
        aria: "A figura do Nonogram de hoje, formada pelas células preenchidas da sua grade.",
      },
    },
    binairo: {
      kicker: "Lógica",
      name: "Binairo",
      description: "Zeros e uns, em perfeito equilíbrio.",
      play: {
        title: "Binairo",
        // States rule 4 for rows AND columns (plan 017 deviation 1): ADR-0020
        // rule 4 covers both, and the reference frame's shorter wording would
        // teach the player a rule the engine does not enforce.
        rules:
          "Preencha a grade com zeros e uns. Cada linha e coluna tem quatro de cada, nunca três iguais seguidos, e nenhuma linha ou coluna se repete.",
        progressLong: (filled: number, total: number) =>
          `${filled} de ${total} células`,
        progressShort: (filled: number, total: number) =>
          `${filled} de ${total}`,
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
        // hoje.streak.aria precedent) — including the invalid variant's join.
        cellAria,
        cellGivenAria: (row: number, column: number, value: 0 | 1) =>
          `linha ${row}, coluna ${column}: ${value}, célula fixa`,
        /** The whole accessible name of a rule-breaking cell, separator included. */
        cellInvalidAria: (row: number, column: number, value: 0 | 1 | null) =>
          `${cellAria(row, column, value)} — esta célula quebra uma regra`,
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
      conclusion: {
        title: "Binairo",
        kicker: "Lógica",
        notYet: {
          title: "Você ainda não concluiu o Binairo de hoje.",
          cta: "Jogar o Binairo de hoje",
        },
      },
    },
  },
} as const;

export type Messages = typeof messages;
