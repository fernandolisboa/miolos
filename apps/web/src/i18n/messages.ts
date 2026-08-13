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

// Termo's three tile states in pt-BR, one spelling per concept (#27). The
// engine's identifiers are correct/present/absent; these are the words a
// player hears. They are in CONTEXT.md's Termo rows.
const TERMO_TILE = {
  correct: "certa",
  present: "na palavra",
  absent: "fora",
} as const;

// EVERY Termo aria string spells letters in LOWERCASE, and that is a decision
// rather than an oversight. NVDA, JAWS and VoiceOver all announce the case of
// a single uppercase character — "maiúsculo A", six times a row, thirty times
// a game. The visual case is CSS's job and stays there: the tiles and the keys
// both carry `text-transform: uppercase`, so nothing on screen changes.

// The whole judged row as ONE sentence, composed here and never joined in a
// component (ADR-0018). Five one-letter spans would otherwise concatenate to
// "CAFES" with no states at all — ADR-0037 decision 3's "22223" defect.
const termoRowAria = (
  row: number,
  max: number,
  guess: string,
  tiles: readonly ("correct" | "present" | "absent")[],
) =>
  `tentativa ${row} de ${max}: ${tiles
    .map((tile, index) => `${guess.charAt(index)} ${TERMO_TILE[tile]}`)
    .join(", ")}`;

// The letters as separate words, so a reader SPELLS "c, a, f" rather than
// pronouncing "caf". Used by the active and held rows.
const termoLetters = (word: string) => word.split("").join(", ");

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
    /**
     * The chip on a PLAYED game's tile (#27, ADR-0008 decision 3, ADR-0044).
     * Capitalised, beside `done: "Feito"` — the hub's chip register. The day
     * card's equivalent is lowercase `jogado`, because that is a tabular
     * VALUE slot beside a duration rather than a chip, and the difference is
     * deliberate (plan 022 §15.3).
     */
    played: "Jogado",
    /**
     * The whole accessible name of a PLAYED tile, composed here (ADR-0018).
     * Takes NO duration: `doneAria` is `"${game} concluído em ${elapsed}"`
     * and both halves of that sentence are false for a lost Termo.
     */
    playedAria: (game: string) => `${game} jogado`,
    /**
     * The accessible name of a COMPLETED tile that publishes no duration —
     * a won Termo, whose elapsed time includes every per-guess round trip
     * and is therefore never rendered (ADR-0045 decision 4).
     *
     * A THIRD string rather than a reuse, and both reuses are wrong in
     * opposite directions: `doneAria` requires an elapsed this entry does
     * not have, and `playedAria` says *jogado* about a game the player won.
     * ADR-0018 forbids composing the fallback in the component. #29 replaces
     * this tile's readout with `em 4/6` and may retire the string.
     */
    completedAria: (game: string) => `${game} concluído`,
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
      /**
       * A lost Termo is PLAYED, never completed (ADR-0008 decision 3,
       * ADR-0044). Lowercase, because this is a tabular value slot beside a
       * duration ("06:47" / "falta") and not a chip — the hub's `played`
       * ("Jogado") is capitalised and that difference is deliberate.
       */
      played: "jogado",
      /**
       * COMPLETED with no duration — a won Termo, whose elapsed time is
       * meaningless for this game (ADR-0045 decision 4) and is therefore
       * never published. Without this string the split guard in `DayChip`
       * has nothing to print and a won Termo falls through to `falta`.
       */
      done: "feito",
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
  /**
   * Free-play chrome (#28, ADR-0046) — shared-chrome position, like `play`
   * and `conclusion` above. Game names and kickers are reused from
   * `games.<game>`, never duplicated (plan 018 S19). No completion
   * language anywhere in this section: **Conclusão** is a daily verb
   * (CONTEXT.md) and free play records nothing (ADR-0008 rule 5).
   */
  freePlay: {
    title: "Modo livre",
    lead: "Puzzles infinitos, gerados aqui no seu aparelho. Nada daqui conta para a sequência nem para as estatísticas.",
    // The game screens' back affordance targets the index, not Hoje, so the
    // shared `play.back` ("← Hoje") would lie about the destination. Same
    // arrow-is-copy rule as the hoisted `back` above.
    back: "← Modo livre",
    backToIndexAria: "Voltar ao Modo livre",
    modeTag: "Modo livre",
    level: {
      label: "Nível",
      leve: "Leve",
      medio: "Médio",
      dificil: "Difícil",
      // Composed here, never joined at a call site (ADR-0018).
      aria: (level: string) => `Nível: ${level}`,
    },
    generating: "Preparando o puzzle…",
    error: {
      title: "Não deu para gerar este puzzle.",
      body: "Aconteceu um imprevisto por aqui. Tente de novo — é tudo gerado no seu aparelho.",
      retry: "Tentar de novo",
    },
    solved: {
      stamp: "Resolvido!",
      // Composed here, never joined at a call site (ADR-0018) — the card's
      // "Modo livre · Binairo · Leve" line.
      modeLine: (mode: string, game: string, level: string) =>
        `${mode} · ${game} · ${level}`,
      again: "Mais um",
      backToIndex: "Voltar ao Modo livre",
      backHome: "Voltar para Hoje",
      /**
       * The painted picture's accessible name. NOT `games.nonogram.reveal.aria`:
       * that string says "de hoje", which is daily language, and the motif's
       * curated name is withheld here exactly as it is on the conclusion
       * (ADR-0033, amended by ADR-0047 for the bundle only — never for copy).
       */
      pictureAria:
        "A figura revelada, formada pelas células preenchidas da sua grade.",
    },
  },
  games: {
    termo: {
      kicker: "Palavras",
      name: "Termo",
      description: "Seis tentativas para a palavra do dia.",
      play: {
        title: "Termo",
        // Every clause is a rule the engine actually enforces: WORD_LENGTH is
        // 5, MAX_GUESSES is 6, `isValidGuess` runs against
        // TERMO_VALIDATION_WORDS, and `normalizeWord` makes the input
        // accent-free.
        rules:
          "Descubra a palavra de cinco letras em até seis tentativas. Digite sem acentos; cada tentativa precisa estar na lista de palavras aceitas.",
        progressLong: (used: number, max: number) =>
          `${used} de ${max} tentativas`,
        progressShort: (used: number, max: number) => `${used} de ${max}`,

        boardAria: "tabuleiro do Termo, seis tentativas de cinco letras",
        rowAria: termoRowAria,
        rowEmptyAria: (row: number, max: number) =>
          `tentativa ${row} de ${max}, vazia`,
        // The ACTIVE row's name carries the DRAFT. Without the letters a
        // screen reader gets nothing at all between the first keypress and
        // `enviar`: the tiles are aria-hidden, and a changed `aria-label` on
        // a non-live element is announced by no AT.
        rowActiveAria: (row: number, max: number, draft: string) =>
          draft === ""
            ? `tentativa ${row} de ${max}, sua vez`
            : `tentativa ${row} de ${max}, escrevendo: ${termoLetters(draft)}`,
        // The HELD row (ADR-0039 consequence (g)). "aguardando" appears
        // exactly once in the whole product, here — it is never a visible
        // label, because the notice line already says the same thing in the
        // same tick.
        rowHeldAria: (row: number, max: number, guess: string) =>
          `tentativa ${row} de ${max}: ${termoLetters(guess)}, aguardando resposta`,

        // Fired on EVERY type and EVERY erase, into the announcer. Terse on
        // purpose: this is heard five times a word, thirty times a game.
        letterTypedAria: (letter: string, filled: number, length: number) =>
          `${letter}, ${filled} de ${length}`,
        letterErasedAria: (letter: string, filled: number, length: number) =>
          `${letter} apagada, ${filled} de ${length}`,

        // AC 3, VERBATIM and lowercase — the issue quotes it that way inside
        // quotes, so this one string does not take the sentence register the
        // two below do. The same string is the local rejection's line AND the
        // answer to a 422 `invalid-guess`: both mean the same thing to the
        // player (plan 022 §13.1b).
        notInList: "não está na lista",
        // The held-turn and rejected-turn lines (plan 022 §11.4). Distinct in
        // copy from `notInList`, deliberately: one is the player's mistake,
        // the other is ours. Full sentences, matching every shipped system
        // line.
        offline: "Sem conexão — a tentativa vai assim que a conexão voltar.",
        failed: "Não foi possível enviar a tentativa.",
        // Capitalised, like every shipped CTA in this bundle.
        retry: "Tentar de novo",

        keyboard: {
          label: "teclado",
          enter: "enviar",
          erase: "apagar",
          enterAria: "enviar a tentativa",
          eraseAria: "apagar a última letra",
          // 26 letter keys: ONE composer, never 26 literals.
          letterAria: (letter: string) => `letra ${letter}`,
          letterStateAria: (
            letter: string,
            state: "correct" | "present" | "absent",
          ) => `letra ${letter}: ${TERMO_TILE[state]}`,
          // Desktop-only: a phone has no keyboard to advertise. The shape is
          // nonogram's shipped affordance verbatim.
          affordance:
            "ou use o teclado: letras escrevem, Enter envia, Backspace apaga",
        },

        unavailable: {
          title: "O Termo de hoje ainda não chegou.",
          body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
          cta: "Voltar para Hoje",
        },
      },
      /**
       * The conclusion's copy bundle (#27, plan 022 §18.2). Plain data only —
       * it crosses the RSC boundary into `<ConclusionView/>`, and a function
       * member there is an SSR 500 rather than a type error (types.ts).
       * The play bundle and Termo's own `outcome`/`dayWord` siblings arrive
       * with the screen.
       */
      conclusion: {
        title: "Termo",
        kicker: "Palavras",
        notYet: {
          title: "Você ainda não concluiu o Termo de hoje.",
          cta: "Jogar o Termo de hoje",
        },
      },
      /**
       * The stamp's two slots and its whole accessible name, on BOTH outcomes
       * (#27, ADR-0043 decisions 1, 3 and 5).
       *
       * A SIBLING of `conclusion`, never a member of it: `ConclusionCopy` is
       * the exact shape three other games render and it is plain data crossing
       * the RSC boundary, so a composer inside it would be an SSR 500 rather
       * than a type error (types.ts). Same placement rule as
       * `nonogram.reveal`. The Termo conclusion wrapper reads these and hands
       * `<ConclusionView/>` finished strings.
       */
      outcome: {
        wonLabel: "Concluído",
        wonDetail: (used: number, max: number) => `${used}/${max}`,
        wonAria: (used: number, max: number) =>
          `Termo concluído em ${used} de ${max} tentativas.`,
        lostLabel: "Jogado",
        lostDetail: (max: number) => `X/${max}`,
        /**
         * ONE RULE for the whole bundle: a composer takes its numbers and
         * renders DIGITS; it never spells one in words and never branches on a
         * value it was handed. `max === 6 ? "seis" : String(max)` would be a
         * runtime branch on a compile-time constant whose false arm is
         * unreachable and untestable. Screen readers read "6" as "seis" in
         * pt-BR, so nothing is lost, and `progressLong` sets the precedent.
         */
        lostAria: (max: number) =>
          `Termo jogado: as ${max} tentativas acabaram sem acerto.`,
      },
      /**
       * The day's word in its canonical accented spelling (#27 AC 2, ADR-0043
       * decision 6), rendered on BOTH outcomes. On a win it is not redundant:
       * the player typed the word accent-free and the accents are the thing
       * they have not seen.
       */
      dayWord: {
        won: (used: number, max: number) =>
          `Você acertou em ${used} de ${max} tentativas.`,
        lost: (max: number) => `As ${max} tentativas acabaram.`,
        lead: "A palavra de hoje era",
      },
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
          // NOT "células vazias": `vazia` is this bundle's word for the
          // UNDECIDED state (`cellAriaNonogram` above, and CONTEXT.md's
          // Undecided row), so "marcar células vazias" told a non-sighted
          // player the brush marks the cells they have not decided. It marks
          // the ones they have ruled OUT of the picture, whatever state those
          // are in — which is the wording the hint copy 30 lines down already
          // uses (step-6 round-4 finding Q4).
          crossAria: "marcar células fora da figura",
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
