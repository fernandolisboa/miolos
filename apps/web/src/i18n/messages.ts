/**
 * All user-facing copy lives here (ADR-0013, ADR-0018): components never
 * carry string literals. Pure values and pure value-returning functions.
 *
 * SHAPE. Shared chrome sits at the top level —
 * `brand`, `hoje`, `play`, `conclusion` — and everything a game owns sits
 * under `games.<game>.{name,kicker,description,play,conclusion}`. ADR-0018
 * makes `Messages` the migration contract, so the shape is a decision and
 * not a detail: a fourth top-level `sudoku:`/`conclusaoSudoku:` block would
 * have guaranteed four copies of the same play and conclusion chrome by #27.
 */

// One product name, one source of truth. Hoje, /binairo
// and the conclusion all render this same value; a second copy is how two
// screens drift apart.
const wordmark = "Miolos";

// One back affordance, two shared screens, for the same reason `wordmark`
// is hoisted. The arrow is copy, not decoration: it is what makes the label
// read as a back affordance without an icon dependency.
const back = "← Hoje";
const backAria = "Voltar para Hoje";

const done = "Feito";
const played = "Jogado";

const cellAria = (row: number, column: number, value: 0 | 1 | null) =>
  `linha ${row}, coluna ${column}: ${value === null ? "vazia" : value}`;

const cellAriaSudoku = (row: number, column: number, value: number | null) =>
  `linha ${row}, coluna ${column}: ${value === null ? "vazia" : value}`;

const hintsUsed = (used: number) => (used === 0 ? "sem dicas" : "com 1 dica");

const boardSize = (size: number) => `${size} × ${size}`;

const cellAriaNonogram = (row: number, column: number, value: 0 | 1 | null) =>
  `linha ${row}, coluna ${column}: ${
    value === null ? "vazia" : value === 1 ? "preenchida" : "marcada"
  }`;

// An all-empty line's clue is `[]` and the UI renders "0" — the engine's own
// contract (`NonogramClues` in `@miolos/games/nonogram`). The rail and its
// label must agree, so both go through here.
const runsText = (runs: readonly number[]) =>
  runs.length === 0 ? "0" : runs.join(", ");

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
  hoje: {
    completedOfTotal: (done: number, total: number) =>
      `${done} de ${total} concluídos`,
    streak: {
      label: "sequência",
      aria: (count: number) =>
        `sequência de ${count} ${count === 1 ? "dia" : "dias"}`,
    },
    playCta: "Jogar hoje",
    playCtaShort: "Jogar",
    done,
    doneResultLong: (elapsed: string) => `em ${elapsed}`,
    doneResultShort: (elapsed: string) => elapsed,
    doneAria: (game: string, elapsed: string) =>
      `${game} concluído em ${elapsed}`,
    doneGuessesAria: (game: string, n: number) =>
      `${game} concluído em ${n} de 6 tentativas`,
    played,
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
     * does not hold.
     */
    completedAria: (game: string) => `${game} concluído`,
    links: {
      archive: "Arquivo",
      freePlay: "Modo livre",
      stats: "Estatísticas",
      privacy: "Política de Privacidade",
      terms: "Termos de Uso",
    },
  },
  play: {
    back,
    backAria,
    timerLabel: "Tempo",
    timerAria: (elapsed: string) => `tempo decorrido: ${elapsed}`,
    progressLabel: "Progresso",
  },
  conclusion: {
    back,
    backAria,
    stampLabel: "Concluído",
    hints: hintsUsed,
    stampAria: (game: string, elapsed: string, hints: number) =>
      `${game} concluído em ${elapsed}, ${hintsUsed(hints)}`,
    sync: {
      pending:
        "Resultado guardado neste aparelho — sincroniza quando a conexão voltar.",
      // Not cosmetic: without it the "Concluído" stamp would stand while the
      // server holds no completion, making the client's own verdict the
      // user-visible authority (ADR-0004).
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
        nonogramShort: "Nono.",
        binairo: "Binairo",
      },
    },
    streak: {
      // CONTEXT.md's word — "sequência", never "dias seguidos".
      value: (count: number) => `${count === 1 ? "dia" : "dias"} de sequência`,
      maintained: "— mantida por hoje.",
      aria: (count: number) =>
        `sequência de ${count} ${count === 1 ? "dia" : "dias"}`,
    },
    closingFaster: "hoje você foi mais rápido que a sua média.",
    closingSlower: "hoje você foi mais devagar que a sua média.",
    ctaHome: "Fechar o dia — voltar para Hoje",
    ctaNext: (game: string) => `Fechar o dia — jogar ${game}`,
    stats: "Ver estatísticas",
    notYet: {
      body: "O resumo aparece assim que a grade fechar.",
    },
    remote: {
      completedNote: "Feito em outro aparelho.",
      playedNote: "Jogado em outro aparelho.",
      completedBody: "Você concluiu o jogo de hoje em outro aparelho.",
      playedBody:
        "Você jogou o jogo de hoje em outro aparelho. As tentativas ficaram lá.",
      stampTimeAria: (game: string, elapsed: string) =>
        `${game} concluído em ${elapsed}`,
      stampBareAria: (game: string) => `${game} concluído`,
    },
  },
  share: {
    label: "Compartilhar",
    copied: "Resultado copiado.",
    failed: "Não foi possível copiar o resultado.",
    tiles: { correct: "🟩", present: "🟨", absent: "⬜" },
    header: (game: string, shortDate: string) =>
      `${wordmark} · ${game} · ${shortDate}`,
    termoWon: (used: number, max: number) => `${used}/${max}`,
    termoLost: (max: number) => `X/${max}`,
  },
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
      // Index-aligned with TIME_BUCKET_BOUNDS_MS.
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
      dayAria: {
        onTime: (date: string) => `${date}: concluído no dia`,
        onTimePerfect: (date: string) =>
          `${date}: concluído no dia — Dia Perfeito`,
        late: (date: string) => `${date}: concluído mais tarde`,
        missed: (date: string) => `${date}: sem conclusão`,
      },
    },
  },
  medals: {
    title: "Medalhas",
  },
  archive: {
    title: "Arquivo",
    lead: "Todos os puzzles do dia desde o começo. Jogue quando quiser — o arquivo não move a sua sequência.",

    backToDay: (longDate: string) => `← ${longDate}`,
    backToDayAria: (longDate: string) =>
      `Voltar para os puzzles de ${longDate}`,
    backToMonth: (month: string) => `← ${month}`,
    backToMonthAria: (month: string) => `Voltar para ${month}`,
    backToIndex: "← Arquivo",
    backToIndexAria: "Voltar para o Arquivo",

    months: { heading: "Por mês" },
    empty:
      "O arquivo começa quando o primeiro puzzle do dia sai. Volte amanhã.",

    calendar: {
      weekdays: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"],
      weekdaysLong: [
        "domingo",
        "segunda-feira",
        "terça-feira",
        "quarta-feira",
        "quinta-feira",
        "sexta-feira",
        "sábado",
      ],
      dayAria: (longDate: string, weekday: string) =>
        `${longDate} — ${weekday}`,
    },

    month: {
      previous: "Mês anterior",
      previousAria: (month: string) => `Mês anterior · ${month}`,
      next: "Próximo mês",
      nextAria: (month: string) => `Próximo mês · ${month}`,
    },

    day: {
      cardAria: (game: string, longDate: string) =>
        `Jogar ${game} de ${longDate}`,
      cardAriaDone: (game: string, longDate: string) =>
        `Ver o resultado do ${game} de ${longDate}`,
      cardAriaPlayed: (game: string, longDate: string) =>
        `Ver o resultado do ${game} de ${longDate} — jogado`,
      done,
      played,
    },

    play: {
      note: "Puzzle do dia arquivado. Não conta para a sequência nem para os seus tempos.",
    },

    result: {
      wonTitle: "Concluído",
      lostTitle: "Não foi dessa vez",
      stampLabel: "Arquivo",
      already: "Você já tinha concluído este dia — nada foi registrado agora.",
      late: "Resultado registrado — o arquivo não conta para a sua sequência.",
      // NOT `messages.conclusion.sync.pending`: that string names
      // connectivity, and the archive's own cause is the daily late-write
      // ceiling answering 429 (ADR-0053 decision 13). This one is true of
      // both, and it never claims a registration that did not happen.
      pending:
        "Resultado guardado neste aparelho — ainda não registrado. O envio se completa mais tarde.",
      rejected:
        "Não foi possível registrar este resultado — o servidor recusou o envio.",
      notStored:
        "Este aparelho não guardou o resultado — o arquivo não conta para a sua sequência.",
      wordLead: "A palavra desse dia era",
    },

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
      modeLine: (mode: string, game: string, level: string) =>
        `${mode} · ${game} · ${level}`,
      again: "Mais um",
      backToIndex: "Voltar ao Modo livre",
      backHome: "Voltar para Hoje",
      /**
       * The painted picture's accessible name. NOT `games.nonogram.reveal.aria`:
       * that string says "de hoje", which is daily language.
       *
       * FREE PLAY STAYS UNNAMED, PERMANENTLY, and #64 narrowed the rule
       * rather than reversing it (ADR-0070): the DAILY conclusion now names
       * its motif from the wire, because the server judged that one day for
       * that one user. Free play generates infinitely, motifs recur, there
       * is no day to judge and no server read to make — so ADR-0046
       * consequence 1 and ADR-0047's "to generate and never to name" hold
       * here exactly as written. The tables are still never bundled.
       */
      pictureAria:
        "A figura revelada, formada pelas células preenchidas da sua grade.",
    },
  },
  attach: {
    invitation: "Sua sequência merece um plano B.",
    lead: "Vincule um e-mail e a sequência sobrevive a qualquer aparelho perdido ou limpo.",
    emailLabel: "Seu e-mail",
    recoveryLabel:
      "Quero vincular este e-mail para recuperar e mover a minha sequência.",
    reminderLabel:
      "Quero receber um lembrete por e-mail quando a minha sequência estiver em risco.",
    privacyLinkLead: "Como cuidamos dos seus dados:",
    privacyLinkLabel: "Política de Privacidade",
    termsLinkLabel: "Termos de Uso",
    submit: "Enviar link mágico",
    dismiss: "agora não",
    sending: "Enviando…",
    sent: (email: string) => `Enviamos um link para ${email}.`,
    sentNote: "Vale por 30 minutos e funciona uma única vez.",
    errors: {
      generic: "Não foi possível enviar o link. Tente de novo.",
      invalidEmail: "Confira o e-mail digitado.",
      rateLimited: "Muitos pedidos por agora — tente de novo em uma hora.",
      alreadyAttached: "Esta conta já tem um e-mail vinculado.",
    },
  },
  onboarding: {
    invitation: "Quatro puzzles do dia, iguais para todo mundo.",
    lead: "Termo, Sudoku, Nonogram e Binairo. Resolva pelo menos um dos puzzles do dia e a sua sequência começa.",
    rollover: "A virada é à meia-noite, no horário de Brasília.",
    noAccount: "Sem cadastro — é só jogar.",
    dismiss: "Entendi",
  },
  push: {
    title: "Quer proteger sua sequência?",
    body: "A gente te avisa antes da virada quando a sua sequência estiver em risco. No máximo um lembrete por dia — e nunca propaganda.",
    accept: "Quero o lembrete",
    decline: "Agora não",
  },
  confirm: {
    title: "Vincular e-mail",
    ready: {
      lead: "Um clique e este e-mail fica vinculado à sua conta do Miolos.",
      warn: "Só confirme se foi você quem pediu este link agora mesmo. Se você não pediu, feche esta página.",
      cta: "Confirmar vínculo",
    },
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
    failed: "Não foi possível confirmar agora. Tente de novo.",
    backHome: "Voltar para Hoje",
  },
  /**
   * The privacy policy (ADR-0012, ADR-0050 decision 12) — the largest
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
      // COMMAS, NOT EM DASHES, in the sentence below. `impeccable detect`
      // reported `em-dash-overuse` (advisory) on this page at BOTH
      // viewports the first time this line shipped: the block was at six
      // and the two dashes here took the page to eight, which is the
      // detector's saturation threshold. Em-dash saturation is a named AI
      // cadence tell, and this is the one page whose whole value is
      // reading as though a person wrote it. Anything added here counts
      // against that budget.
      //
      // #33 (ADR-0069): the measurements are now recorded against the
      // anonymous account and processed OUTSIDE Brazil, which is data
      // about the user by this block's own criterion — the page states
      // EXACTLY what this release ships, and deferring the line would be
      // exactly that drift.
      //
      // THE LAST SENTENCE IS THE HONEST HALF, and it is why this line
      // rather than the deletion section carries it: `POST /account/delete`
      // is a `db.delete(users)` cascade over OUR tables and issues no
      // PostHog deletion, so the immediate self-service erasure does not
      // reach the provider's rows. Saying so here keeps the deletion
      // section's "de uma vez" true of what it actually enumerates, and
      // publishes the one path that does reach them. The residual and its
      // owner are recorded in ADR-0069 decision 5 and in
      // `docs/pending-fernando.md` (SOON), for #37's LGPD review
      // (ADR-0012).
      telemetry:
        "Medições técnicas mínimas de uso e desempenho: quando um puzzle começa e quando termina, quanto tempo levou, e quando uma sequência se quebra. Não gravamos a sua tela, as suas sessões, nem o conteúdo dos puzzles. Essas medições ficam ligadas à sua conta anônima, nunca ao seu e-mail, e são processadas pelo PostHog, um provedor fora do Brasil (Estados Unidos). Excluir a conta apaga tudo o que guardamos aqui; para apagar também o que já está com o provedor, escreva para privacidade@miolos.app.",
      // #30 (ADR-0052): a `medal_grants` row is operator-written data
      // about the user, so the inventory names it the release it ships —
      // the page states EXACTLY what this release ships (this block's own
      // doc comment), and deferring the line would be exactly that drift.
      medals:
        "As medalhas: a maioria é calculada do seu histórico de jogos; algumas são concedidas manualmente pela equipe e ficam registradas na sua conta. Todas são apagadas junto com a conta.",
      // #145 (ADR-0064): the push subscription is data about the user, so
      // the inventory names it the release the table ships — the page
      // states EXACTLY what this release ships (this block's own doc
      // comment), and deferring the line would be exactly that drift.
      push: "O lembrete no navegador, somente se você ativar: guardamos o endereço técnico da inscrição e as chaves que o navegador gera, usados só para avisar quando a sua sequência estiver em risco. Para parar, revogue a permissão de notificações nas configurações do navegador — os avisos param na hora e a inscrição, que deixa de funcionar, é removida dos nossos registros. Excluir a conta apaga tudo.",
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
  terms: {
    title: "Termos de Uso",
    intro:
      "O Miolos é um site de puzzles diários. Esta página diz, em palavras simples, o que você pode esperar da gente — e o que esperamos de você.",
    free: {
      heading: "Jogar é grátis",
      body: "Todos os puzzles são gratuitos: o desafio do dia, o arquivo e o modo livre. Não vendemos acesso a nenhum deles.",
    },
    account: {
      heading: "Sem cadastro",
      body: "Você joga com uma conta anônima criada neste aparelho — sem e-mail, sem senha, sem formulário. Vincular um e-mail é opcional e serve só para recuperar e mover a sua sequência.",
      privacyLead: "O que coletamos, e como apagar tudo, está na",
      privacyLinkLabel: "Política de Privacidade",
    },
    acceptableUse: {
      heading: "Uso aceitável",
      body: "Use o Miolos para jogar. Não tente derrubar ou sobrecarregar o serviço, burlar a segurança, copiar o conteúdo com robôs nem atrapalhar os outros jogadores. Se isso acontecer, podemos limitar ou encerrar o acesso da conta envolvida.",
    },
    content: {
      heading: "O conteúdo é nosso",
      body: "Os puzzles, o design, o nome e a marca do Miolos nos pertencem. Compartilhar os seus resultados é sempre bem-vindo; copiar ou republicar o conteúdo do site como se fosse seu, ou usá-lo comercialmente sem a nossa autorização, não é.",
    },
    warranty: {
      heading: "O que não prometemos",
      asIs: "Trabalhamos para publicar um puzzle novo por dia e manter tudo no ar, mas o serviço é oferecido como está: podem acontecer falhas, interrupções e mudanças.",
      liability:
        "Se algo der errado — o site sair do ar, um puzzle atrasar, uma sequência se perder — a nossa responsabilidade se limita ao que a lei exigir. Nada nestes termos reduz os direitos que o Código de Defesa do Consumidor garante a você.",
    },
    changes: {
      heading: "Quando estes termos mudam",
      body: "Estes termos podem mudar conforme o produto cresce. A versão que vale é sempre a publicada nesta página; se você continuar jogando depois de uma mudança, ela passa a valer para você.",
    },
    contact: {
      heading: "Fale com a gente",
      lead: "Dúvidas sobre estes termos? Escreva para",
      email: "privacidade@miolos.app",
    },
    revision:
      "Estes termos crescem junto com o produto: uma versão completa acompanha as próximas funcionalidades.",
  },
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

        letterTypedAria: (letter: string, filled: number, length: number) =>
          `${letter}, ${filled} de ${length}`,
        letterErasedAria: (letter: string, filled: number, length: number) =>
          `${letter} apagada, ${filled} de ${length}`,

        // AC 3, VERBATIM and lowercase — the issue quotes it that way inside
        // quotes, so this one string does not take the sentence register the
        // two below do. The same string is the local rejection's line AND the
        // answer to a 422 `invalid-guess`: both mean the same thing to the
        // player.
        notInList: "não está na lista",
        offline: "Sem conexão — a tentativa vai assim que a conexão voltar.",
        failed: "Não foi possível enviar a tentativa.",
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
          affordance:
            "ou use o teclado: letras escrevem, Enter envia, Backspace apaga",
        },

        unavailable: {
          title: "O Termo de hoje ainda não chegou.",
          body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
          cta: "Voltar para Hoje",
        },
      },
      conclusion: {
        title: "Termo",
        kicker: "Palavras",
        notYet: {
          title: "Você ainda não concluiu o Termo de hoje.",
          cta: "Jogar o Termo de hoje",
        },
      },
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
       * The day's word in its canonical accented spelling (ADR-0043
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
        // they win.
        progressLong: (filled: number, total: number) =>
          `${filled} de ${total} preenchidas`,
        progressShort: (size: number, filled: number, total: number) =>
          `${boardSize(size)} · ${filled} de ${total}`,
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
          // are in — which is the wording the hint copy in `hint.explain.cross`
          // below already uses.
          crossAria: "marcar células fora da figura",
          eraseAria: "apagar células",
          affordance: "ou use o teclado: 1 preenche, 2 marca, 0 apaga",
        },
        hint: {
          available: "Usar dica — 1 disponível",
          used: "Dica usada",
          explain: {
            correction: "Corrigimos uma célula que não fecha com os números.",
            fill: "Preenchemos uma célula da figura para você.",
            // The defined-unreachable branch: the selector only falls
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
      reveal: {
        aria: "A figura do Nonogram de hoje, formada pelas células preenchidas da sua grade.",
        lead: "A figura de hoje era",
        namedAria: (name: string) =>
          `Você revelou ${name} — a figura do Nonogram de hoje, formada pelas células preenchidas da sua grade.`,
      },
    },
    binairo: {
      kicker: "Lógica",
      name: "Binairo",
      description: "Zeros e uns, em perfeito equilíbrio.",
      play: {
        title: "Binairo",
        // States rule 4 for rows AND columns: ADR-0020
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
        cellAria,
        cellGivenAria: (row: number, column: number, value: 0 | 1) =>
          `linha ${row}, coluna ${column}: ${value}, célula fixa`,
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
