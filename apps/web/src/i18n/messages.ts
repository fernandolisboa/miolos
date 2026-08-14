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
    // The accessible name of a completed Termo tile once the server's
    // guess count lands (#29, plan 033 D5). (n is the guess count, 1..6;
    // "1 de 6 tentativas" is correct — tentativas agrees with 6.)
    doneGuessesAria: (game: string, n: number) =>
      `${game} concluído em ${n} de 6 tentativas`,
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
     * ADR-0018 forbids composing the fallback in the component.
     *
     * IT SURVIVES #29 rather than retiring: `doneGuessesAria` above names
     * the tile only once the server's guess count has LANDED and is about
     * the tile's own day. While the stats fetch is unsettled, settled
     * without a value, or answering for a different SP day (the DB clock
     * and the web server can disagree across midnight), this string is the
     * honest name — completed, with nothing false about a count the client
     * does not hold (plan 033 D5).
     */
    completedAria: (game: string) => `${game} concluído`,
    links: {
      archive: "Arquivo",
      freePlay: "Modo livre",
      stats: "Estatísticas",
      // Live: /privacidade since #21, /estatisticas since #29, and
      // /arquivo since #31 — a real route is what earns the href, and all
      // four now have one.
      privacy: "Política de Privacidade",
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
    /**
     * The streak card (#19, ADR-0048), server-computed and fetched only
     * once the day is on the server. Shared chrome and composed HERE, never
     * in `ConclusionCopy` (the `stampAria` mechanism above: that bundle is
     * plain-data-only and a function member is an SSR 500).
     *
     * `value` is the numeral's companion line — F5:56's "dias de sequência"
     * — and deliberately does NOT repeat the count the numeral already
     * shows; the accessible name (`aria`) carries it. `maintained` renders
     * ONLY when the server says today itself is a counted day
     * (`todayCounts`, ADR-0048 decision 2): on a lost-Termo day or a late
     * solve the streak may be alive through yesterday, but *this* day did
     * not maintain it and the copy must not claim it did (ADR-0008 rules
     * 1–3). CONTEXT.md's word — "sequência", never "dias seguidos".
     */
    streak: {
      value: (count: number) => `${count === 1 ? "dia" : "dias"} de sequência`,
      maintained: "— mantida por hoje.",
      aria: (count: number) =>
        `sequência de ${count} ${count === 1 ? "dia" : "dias"}`,
    },
    /**
     * The stat block's closing italic line (#29, plan 033 §6.4) — F5:50's
     * own sentence, one string per direction and never joined in the
     * component (ADR-0018). Gated by the component on
     * `averageSampleCount >= 2` and a local duration; equal renders
     * neither.
     */
    closingFaster: "hoje você foi mais rápido que a sua média.",
    closingSlower: "hoje você foi mais devagar que a sua média.",
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
   * The statistics screen (#29, ADR-0051). The stat-row labels are F5's
   * exact register — `Seu melhor tempo` / `Sua média (30 dias)` /
   * `<Jogo>s resolvidos` (f5-conclusao-desktop.dc.html:33-35) — adopted on
   * BOTH the conclusion (where F5 is the spec) and the stats screen: one
   * register, no drift. The average's label carries its own `(30 dias)`
   * because its population is the 30-day window while best and solved are
   * all-time (ADR-0051 decision 6 — the labels carry the distinction).
   */
  stats: {
    title: "Estatísticas",
    perfectDays: {
      label: "Dias Perfeitos",
      aria: (n: number) =>
        `${n} ${n === 1 ? "dia perfeito" : "dias perfeitos"}`,
    },
    rows: {
      best: "Seu melhor tempo",
      average: "Sua média (30 dias)",
      solved: (name: string) => `${name}s resolvidos`, // F5:35 "Binairos resolvidos"
    },
    emptyValue: "—",
    histogram: {
      labels: ["<4", "4–5", "5–6", "6–7", "7–9", ">9"], // minutes, F5's exact glyph set — VISUAL only
      // Spoken names per bucket — real words, never the glyph labels ("<4" is
      // unreadable aloud). Index-aligned with TIME_BUCKET_BOUNDS_MS.
      bucketNames: [
        "menos de 4 minutos",
        "entre 4 e 5 minutos",
        "entre 5 e 6 minutos",
        "entre 6 e 7 minutos",
        "entre 7 e 9 minutos",
        "mais de 9 minutos",
      ],
      aria: (bucketName: string, n: number) =>
        `${n} ${n === 1 ? "jogo" : "jogos"} ${bucketName ? `— ${bucketName}` : ""}`.trim(),
      // rendered e.g. "3 jogos — entre 4 e 5 minutos", "1 jogo — menos de 4 minutos"
    },
    termo: {
      fail: "X",
      rowAria: (guesses: number, n: number) =>
        `${n} ${n === 1 ? "vitória" : "vitórias"} em ${guesses} ${guesses === 1 ? "tentativa" : "tentativas"}`,
      failAria: (n: number) => `${n} ${n === 1 ? "derrota" : "derrotas"}`,
    },
    calendar: {
      title: "Calendário",
      // "missed" means NO COMPLETION that day — which covers both a day never
      // played and a day played-and-lost (a lost Termo colours no day, plan
      // 033 D6), so the legend word must be honest for both. "perdido"
      // (collides with the loss vocabulary — it would say "lost" over a day
      // the player lost at Termo, meaning the opposite thing) and "não
      // jogado" (false for a played-lost day) are both rejected. Fernando
      // may adjust.
      legend: { onTime: "no dia", late: "mais tarde", missed: "sem conclusão" },
      // Complete per-state day composers — the formatted date goes IN here,
      // never joined in the component. `date` is formatLongDate(day.date).
      dayAria: {
        onTime: (date: string) => `${date}: concluído no dia`,
        onTimePerfect: (date: string) =>
          `${date}: concluído no dia — Dia Perfeito`,
        late: (date: string) => `${date}: concluído mais tarde`,
        missed: (date: string) => `${date}: sem conclusão`,
      },
      // (no separate perfectAria — the perfect marker's meaning rides the day
      // composer above, so no composer declares a parameter it ignores)
    },
  },
  /**
   * The medal section's CHROME only (#30, ADR-0052) — the 23 per-medal
   * name/description records live in `src/medals/copy.ts` (`medalCopy`),
   * NOT here, and never may: measured on this branch, a second export of
   * this module kept the ~2 KB of prose in the shared chunk of every
   * route that imports `messages` for anything else (plan 035 §14 watch
   * item 2's recorded fallback, applied). Only the medal section's own
   * module graph carries the prose.
   */
  medals: {
    title: "Medalhas",
    // No aria composer: the medal rows' visible name/description text IS
    // the accessible content (a composed li label is name-PROHIBITED on
    // WebKit once `list-style: none` strips the list semantics — step-6
    // correctness finding; stats-view.tsx records the fix).
  },
  /**
   * The archive (#31, ADR-0053, plan 037 §7.6) — shared-chrome position,
   * like `play`, `conclusion` and `freePlay` above. Game names and kickers
   * are reused from `games.<game>`, never duplicated (plan 018 S19).
   *
   * Every aria sentence ships whole, never assembled in a component
   * (ADR-0018 :15), and the metadata composers live here for the same
   * reason: `generateMetadata` may build no string of its own.
   *
   * `então`, `mamãe` and `época` are FORBIDDEN_EVERYWHERE in client chunks
   * (`scripts/route-client-js.mjs`) — audited: no string below uses one.
   */
  archive: {
    title: "Arquivo",
    lead: "Todos os puzzles do dia desde o começo. Jogue quando quiser — o arquivo não move a sua sequência.",

    // THREE back affordances, THREE destinations, one string each. Every
    // archive surface goes exactly one level up (plan 037 §7.5), so the
    // label names where it goes:
    //   play screen  → the day page   → backToDay
    //   day page     → its month page → backToMonth
    //   month page   → the index      → backToIndex
    // The late-result panel's two links out reuse backToDay and backToMonth,
    // so no destination has two spellings.
    backToDay: (longDate: string) => `← ${longDate}`,
    backToDayAria: (longDate: string) =>
      `Voltar para os puzzles de ${longDate}`,
    backToMonth: (month: string) => `← ${month}`,
    backToMonthAria: (month: string) => `Voltar para ${month}`,
    backToIndex: "← Arquivo",
    backToIndexAria: "Voltar para o Arquivo",

    recent: { heading: "Dias recentes" },
    months: { heading: "Por mês" },
    empty:
      "O arquivo começa quando o primeiro puzzle do dia sai. Volte amanhã.",

    // A day row: the date, then the games that date holds. ONE composed
    // sentence — the accent rules on the game names carry no meaning alone
    // (ADR-0041 decision 5).
    dayRowAria: (longDate: string, games: readonly string[]) =>
      `${longDate} — ${games.join(", ")}`,

    month: {
      // formatMonth yields "agosto de 2026". These two are SIBLING
      // navigation, not a back affordance — the month page's back is
      // `backToIndex` above — and they deliberately DO NOT SPEND `←`
      // (step-6 F11). In this product `←` means one level up: `play.back`
      // ("← Hoje"), `freePlay.back` ("← Modo livre") and the archive's own
      // three back labels all use it that way, and the late-result panel
      // renders "← 1 de agosto de 2026" beside "← agosto de 2026". A fourth
      // meaning for the same glyph — sideways, on the timeline — on the very
      // page where both appear is one glyph doing two jobs. The words say
      // which job this is.
      //
      // The DIRECTION and the MONTH are two strings, not one, and the view
      // renders them as two elements — an uppercase kicker over the month in
      // sentence case. `impeccable`'s `all-caps-body` fires on any non-heading
      // element carrying more than 30 characters of DIRECT text under
      // `text-transform: uppercase` (`checks.mjs:3463-3467`), with no
      // interactive or `nav` exemption; the single composed string reached 32
      // characters in fevereiro and 31 in setembro, novembro and dezembro, so
      // four months in every twelve would have redded the detect gate on the
      // newest month page — the one the CI job discovers — with no commit
      // causing it and no commit able to fix it. Split, no element carries
      // more than 17. Same reason `.monthNavMonth` is not uppercase.
      //
      // The composed sentence survives as the link's `aria-label`, the
      // `backToIndex`/`backToIndexAria` idiom this file already uses: the
      // accessible name contains the visible words, so WCAG 2.5.3's
      // label-in-name holds.
      previous: "Mês anterior",
      previousAria: (month: string) => `Mês anterior · ${month}`,
      next: "Próximo mês",
      nextAria: (month: string) => `Próximo mês · ${month}`,
    },

    day: {
      cardAria: (game: string, longDate: string) =>
        `Jogar ${game} de ${longDate}`,
    },

    // The play chrome (ADR-0053 decision 9). ONE string: the line that makes
    // the archive's semantics visible to the person they apply to. There is
    // no mode chip — the back label and the top bar's date already say where
    // you are, and a chip saying "Arquivo" could not have said what this
    // sentence says. (The reason this comment used to give — that a chip
    // needs a class in `src/play/screen.module.css`, which #31 does not edit
    // — was a scope fact standing in for a design one, and step-6 F10b
    // struck it down: the note itself now carries a class from the archive's
    // OWN stylesheet, `src/archive/play-note.module.css`, and nothing under
    // `src/play/` is edited for it.) The back affordance uses `backToDay`
    // above, for the reason `freePlay`'s own comment gives: a shared
    // "← Hoje" would lie about the destination.
    play: {
      note: "Puzzle do dia arquivado. Não conta para a sequência nem para os seus tempos.",
    },

    // FIVE notes, one per state the DEVICE can actually distinguish, and the
    // set is closed by that criterion rather than by taste (#31 step-6
    // findings F3/F5/F16). The panel reads the local play record and nothing
    // else — there is no archive read endpoint (ADR-0053 decision 10) — so
    // every string below is checkable from the record alone, and none of them
    // asserts anything about WHEN the server's row was written. That is the
    // half `sync.ts` throws away: `acceptResponse` parses and discards both
    // `completionResponseSchema.onTime` and `.outcome`, and carrying either to
    // this panel would be a versioned change to the local record schema (plan
    // 037 §14 I29, I42).
    result: {
      wonTitle: "Concluído",
      lostTitle: "Não foi dessa vez",
      // The stamp's 11px tracked label, over the archived day's number and
      // its month — a postmark, the daily stamp's own anatomy with the one
      // figure the archive is allowed to show (step-6 F7). It is
      // `aria-hidden` at the call site: the two links below already name the
      // day and the month, so it announces nothing new.
      stampLabel: "Arquivo",
      // AC 4's UI half: this device already held a concluded record for the
      // day when the archive page mounted, so the result on screen is one the
      // player had before and NOT a late completion this visit produced.
      already: "Você já tinha concluído este dia — nada foi registrado agora.",
      // The settled-`recorded` note. It says the row EXISTS and deliberately
      // does not say when it was written: the same 200 covers "the server
      // wrote a late row just now" and "the server already held an on-time
      // row and wrote nothing" (`recorded: false`, the idempotent
      // short-circuit), and the client cannot tell them apart. The previous
      // wording — "Conclusão tardia — registrada" — asserted the first on
      // both, which is false on exactly ADR-0053 decision 10 layer 3's own
      // case: a day solved on time, replayed later from another device.
      late: "Resultado registrado — o arquivo não conta para a sua sequência.",
      // NOT `messages.conclusion.sync.pending`: that string names
      // connectivity, and the archive's own cause is the daily late-write
      // ceiling answering 429 (ADR-0053 decision 13). This one is true of
      // both, and it never claims a registration that did not happen.
      pending:
        "Resultado guardado neste aparelho — ainda não registrado. O envio se completa mais tarde.",
      // The server REFUSED the completion — `sync.ts`'s `TERMINAL_STATUSES`,
      // whose 404 arm is the kill switch, the one operation ADR-0053 decision
      // 2's whole `force-dynamic` posture is built around. Without this arm
      // the panel told the player the result was registered while the server
      // held no completion at all, which is the client's own verdict standing
      // as the user-visible authority — the thing ADR-0004 forbids, and the
      // reason `messages.conclusion.sync.rejected` exists on the daily.
      rejected:
        "Não foi possível registrar este resultado — o servidor recusou o envio.",
      // No record on this device AT ALL, which on a concluded panel means
      // `localStorage` is unusable (DOM storage off in a WebView, site data
      // blocked): `sync.ts`'s `memoryQueue` still posts, but nothing readable
      // survives for this panel to report. It claims neither a registration
      // nor a failure, because the device knows neither.
      notStored:
        "Este aparelho não guardou o resultado — o arquivo não conta para a sua sequência.",
      // The archived Termo's word, on BOTH outcomes (#31 step-6 finding F23,
      // ADR-0043 decision 6's rule applied where it was missing). A lost
      // archived Termo showed "Não foi dessa vez" and nothing else, where the
      // daily's conclusion reveals the answer — so the one game whose loss
      // can teach you something taught nothing in the archive. NOT
      // `games.termo.dayWord.lead`: that string says "de hoje",
      // which is false of every date this panel renders.
      wordLead: "A palavra desse dia era",
      // The two links out reuse `backToDay` and `backToMonth`; no duplicate
      // spellings live here.
    },

    // Metadata (ADR-0053 decision 1 / plan 037 D6). Distinct per date and per
    // (date, game), which is what stops ~5 near-identical board pages a day
    // from being thin duplicates — T-WEB-S173 asserts the distinctness, not
    // just the shape.
    meta: {
      indexTitle: "Arquivo — Miolos",
      indexDescription:
        "Todos os puzzles do dia do Miolos: Binairo, Sudoku, Nonogram e Termo, dia a dia, de graça.",
      monthTitle: (month: string) => `Arquivo de ${month} — Miolos`,
      monthDescription: (month: string) =>
        `Os puzzles do dia de ${month}: Binairo, Sudoku, Nonogram e Termo, um por dia.`,
      dayTitle: (longDate: string) => `Puzzles de ${longDate} — Miolos`,
      dayDescription: (longDate: string) =>
        `Os puzzles do dia de ${longDate} no Miolos. Jogue de graça, quando quiser.`,
      gameTitle: (game: string, longDate: string) =>
        `${game} de ${longDate} — Miolos`,
      gameDescription: (game: string, longDate: string) =>
        `Jogue o ${game} do dia ${longDate} no Miolos. De graça, sem cadastro.`,
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
  /**
   * The attach prompt card (#21, ADR-0050 decision 9; ADR-0012's
   * purpose-limited consent language). The invitation is the human voice —
   * Fraunces italic, protecting the streak — and every consent label says
   * exactly what its checkbox does: recovery is the account function
   * (required to submit), the reminder defaults UNCHECKED and its absence
   * signs the player up for nothing.
   */
  attach: {
    invitation: "Sua sequência merece um plano B.",
    lead: "Vincule um e-mail e a sequência sobrevive a qualquer aparelho perdido ou limpo.",
    emailLabel: "Seu e-mail",
    recoveryLabel:
      "Quero vincular este e-mail para recuperar e mover a minha sequência.",
    reminderLabel:
      "Quero receber um lembrete por e-mail quando a minha sequência estiver em risco.",
    // The consent copy's link into the policy (T-WEB-S143).
    privacyLinkLead: "Como cuidamos dos seus dados:",
    privacyLinkLabel: "Política de Privacidade",
    submit: "Enviar link mágico",
    dismiss: "agora não",
    sending: "Enviando…",
    // The sent state replaces the form (D15): the normalized address is
    // rendered so the player sees exactly where the link went.
    sent: (email: string) => `Enviamos um link para ${email}.`,
    sentNote: "Vale por 30 minutos e funciona uma única vez.",
    errors: {
      generic: "Não foi possível enviar o link. Tente de novo.",
      invalidEmail: "Confira o e-mail digitado.",
      rateLimited: "Muitos pedidos por agora — tente de novo em uma hora.",
      alreadyAttached: "Esta conta já tem um e-mail vinculado.",
    },
  },
  /**
   * The /vincular confirm page (#21, ADR-0050 decision 3): an inert shell
   * plus ONE explicit button — the human click is what spends the token,
   * so an email scanner's GET consumes nothing.
   */
  confirm: {
    title: "Vincular e-mail",
    ready: {
      lead: "Um clique e este e-mail fica vinculado à sua conta do Miolos.",
      // The honest-copy warning (step-7 finding A): a magic link can be
      // requested by anyone who knows the address — the words are part of
      // the defense against an attacker-requested link.
      warn: "Só confirme se foi você quem pediu este link agora mesmo. Se você não pediu, feche esta página.",
      cta: "Confirmar vínculo",
    },
    // The switch-account acknowledgement (step-7 finding D): this browser
    // already carries a played account, and confirming replaces its
    // session with the linked account's — an explicit checkbox, never a
    // silent cookie swap. Zero-history and cookieless browsers never see
    // this block.
    switchAccount: {
      lead: "Este aparelho já tem uma sequência própria. Ao confirmar, ele passa a usar a conta deste e-mail — a conta atual deste aparelho deixa de aparecer aqui.",
      label: "Entendi: quero trocar de conta neste aparelho.",
    },
    posting: "Confirmando…",
    attached: {
      title: "E-mail vinculado!",
      body: "Sua sequência agora tem um plano B: este e-mail a recupera e a leva para qualquer aparelho.",
    },
    merged: {
      title: "Tudo certo — sua sequência voltou.",
      body: "Este aparelho agora carrega o seu histórico completo.",
    },
    missingToken: {
      title: "Este link está incompleto.",
      body: "Abra de novo o link que chegou no seu e-mail — ou peça um novo na página inicial.",
    },
    invalid: {
      title: "Este link não vale mais.",
      body: "Cada link vale por 30 minutos e funciona uma única vez. Peça um novo na página inicial.",
    },
    conflict: {
      title: "Não deu para confirmar com este link.",
      body: "Aconteceu um imprevisto por aqui. Peça um novo link na página inicial.",
    },
    // A settled network/server failure: the token may still be alive, so
    // the state returns to the button with this line beside it.
    failed: "Não foi possível confirmar agora. Tente de novo.",
    backHome: "Voltar para Hoje",
  },
  /**
   * The privacy policy (#21, ADR-0012, ADR-0050 decision 12) — the largest
   * single copy block in the app, and deliberately so: the page states
   * EXACTLY what this release ships, so page and mechanism cannot drift.
   */
  privacy: {
    title: "Política de Privacidade",
    intro:
      "O Miolos funciona sem cadastro: você joga com uma conta anônima criada neste aparelho. Esta página diz o que coletamos, para quê, e como apagar tudo.",
    collected: {
      heading: "O que coletamos",
      account:
        "A conta anônima e o seu histórico de jogos — quais puzzles você concluiu e quando. É disso que a sequência é calculada. Puzzles antigos concluídos pelo arquivo são registrados do mesmo jeito, e ficam de fora da sequência.",
      email:
        "O seu e-mail, somente se você escolher vinculá-lo. Ninguém precisa vincular e-mail para jogar.",
      telemetry:
        "Medições técnicas mínimas de uso e desempenho. Não gravamos a sua tela nem as suas sessões.",
      // #30 (ADR-0052): a `medal_grants` row is operator-written data
      // about the user, so the inventory names it the release it ships —
      // the page states EXACTLY what this release ships (this block's own
      // doc comment), and deferring the line would be exactly that drift.
      medals:
        "As medalhas: a maioria é calculada do seu histórico de jogos; algumas são concedidas manualmente pela equipe e ficam registradas na sua conta. Todas são apagadas junto com a conta.",
    },
    why: {
      heading: "Para que usamos",
      recovery:
        "O e-mail existe para recuperar e mover a sua sequência — se você limpar o navegador ou trocar de aparelho, ele é o caminho de volta.",
      reminder:
        "Lembretes de sequência em risco só chegam por e-mail se você marcar o consentimento próprio para isso — e ele vem desmarcado.",
    },
    consents: {
      heading: "Os dois consentimentos",
      body: "Vincular o e-mail (recuperação) e receber lembretes são consentimentos separados e independentes: um nunca implica o outro, e o lembrete vem sempre desmarcado.",
    },
    deletion: {
      heading: "Excluir seus dados",
      selfService:
        "A exclusão é imediata e você mesmo faz, nesta página, na seção abaixo: apaga a conta, a sequência e todo o histórico, de uma vez.",
      contactLead:
        "Também atendemos pedidos de exclusão e qualquer dúvida de privacidade pelo e-mail",
      contactEmail: "privacidade@miolos.app",
    },
    noPassword: {
      heading: "O que não existe aqui",
      body: "Não existe senha no Miolos — o link mágico por e-mail é o único acesso. Não vendemos os seus dados a ninguém.",
    },
    revision:
      "Esta política cresce junto com o produto: uma versão completa acompanha as próximas funcionalidades.",
  },
  /** The self-service deletion island on /privacidade (D13). */
  deleteAccount: {
    heading: "Excluir minha conta e dados",
    explain:
      "Apaga a sua conta, a sua sequência e todo o histórico — imediatamente e em todos os aparelhos. Não dá para desfazer.",
    start: "Excluir minha conta",
    confirmTitle: "Tem certeza?",
    confirmBody:
      "A exclusão é definitiva: a sequência e o histórico não voltam.",
    confirm: "Excluir de vez",
    cancel: "Cancelar",
    deleting: "Excluindo…",
    done: "Conta excluída.",
    doneNote: "Se voltar a jogar, você começa do zero — como no primeiro dia.",
    error: "Não foi possível excluir agora. Tente de novo.",
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
