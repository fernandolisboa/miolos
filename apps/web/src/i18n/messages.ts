import {
  FREE_HINTS_PER_PUZZLE,
  type AdminMemberRole,
  type Game,
  type RemoteConfigKey,
} from "@miolos/core";

const wordmark = "Miolos";
const tagline = "jogos de raciocínio por dia";
const taglineCapitalised = `${tagline.charAt(0).toUpperCase()}${tagline.slice(1)}`;
const signOff = "Um puzzle novo de cada, todos os dias, igual para todo mundo.";

const freePlayDescriptions: Partial<Record<Game, string>> = {
  termo: "Seis tentativas e uma palavra nova a cada partida.",
};

const back = "← Hoje";
const backAria = "Voltar para Hoje";

const done = "Feito";
const played = "Jogado";

const cellAria = (row: number, column: number, value: 0 | 1 | null) =>
  `linha ${row}, coluna ${column}: ${value === null ? "vazia" : value}`;

const cellAriaSudoku = (row: number, column: number, value: number | null) =>
  `linha ${row}, coluna ${column}: ${value === null ? "vazia" : value}`;

interface SudokuCellCopy {
  readonly row: number;
  readonly column: number;
}

type SudokuUnitKind = "row" | "column" | "box";

const sudokuCell = ({ row, column }: SudokuCellCopy) =>
  `linha ${row}, coluna ${column}`;

const sudokuLine = (kind: SudokuUnitKind, cell: SudokuCellCopy) =>
  kind === "row" ? `linha ${cell.row}` : `coluna ${cell.column}`;

const inSudokuUnit = (kind: SudokuUnitKind, cell: SudokuCellCopy) =>
  kind === "box" ? "Neste bloco" : `Na ${sudokuLine(kind, cell)}`;

const ofSudokuUnit = (kind: SudokuUnitKind, cell: SudokuCellCopy) =>
  kind === "box" ? "deste bloco" : `da ${sudokuLine(kind, cell)}`;

const sudokuSpot = (kind: SudokuUnitKind, cell: SudokuCellCopy) =>
  kind === "box"
    ? sudokuCell(cell)
    : sudokuLine(kind === "row" ? "column" : "row", cell);

const hintsUsed = (used: number) =>
  used === 0 ? "sem dicas" : used === 1 ? "com 1 dica" : `com ${used} dicas`;

const boardSize = (size: number) => `${size} × ${size}`;

const cellAriaNonogram = (row: number, column: number, value: 0 | 1 | null) =>
  `linha ${row}, coluna ${column}: ${
    value === null ? "vazia" : value === 1 ? "preenchida" : "marcada"
  }`;

const runsText = (runs: readonly number[], placed: readonly boolean[]) =>
  runs.length === 0
    ? "0"
    : runs
        .map((run, i) => (placed[i] === true ? `${run} feito` : run))
        .join(", ");

type LineKind = "row" | "column";

const LINE = {
  row: { name: "linha", across: "coluna" },
  column: { name: "coluna", across: "linha" },
} as const;

const nonogramStep = (
  line: LineKind,
  at: number,
  runs: readonly number[],
  across: number,
  value: 0 | 1,
) => {
  const { name, across: otherName } = LINE[line];
  const cell = `a célula da ${otherName} ${across}`;
  if (runs.length === 0) {
    return `A ${name} ${at} não tem números, então ${cell} fica marcada.`;
  }
  const numbers =
    runs.length === 1
      ? `o número ${runs[0]} só fecha`
      : `os números ${runs.join(", ")} só fecham`;
  return `Na ${name} ${at}, ${numbers} com ${cell} ${value === 1 ? "preenchida" : "marcada"}.`;
};

const BINAIRO_COUNT_WORDS = ["zero", "um", "dois", "três", "quatro"] as const;

const binairoStep = {
  pair: (line: LineKind, at: number, along: number, value: 0 | 1) =>
    `Na ${LINE[line].name} ${at}, dois ${1 - value} seguidos obrigam um ${value} ao lado, na célula da ${LINE[line].across} ${along}.`,
  gap: (line: LineKind, at: number, along: number, value: 0 | 1) =>
    `Na ${LINE[line].name} ${at}, a célula da ${LINE[line].across} ${along} fica entre dois ${1 - value}, então leva ${value}.`,
  count: (
    line: LineKind,
    at: number,
    along: number,
    value: 0 | 1,
    half: number,
  ) =>
    `A ${LINE[line].name} ${at} já tem ${BINAIRO_COUNT_WORDS[half] ?? half} ${1 - value}, então a célula da ${LINE[line].across} ${along} leva ${value}.`,
  duplicate: (
    line: LineKind,
    at: number,
    along: number,
    value: 0 | 1,
    twin: number,
  ) =>
    `A ${LINE[line].name} ${at} não pode repetir a ${LINE[line].name} ${twin}, então a célula da ${LINE[line].across} ${along} leva ${value}.`,
  lookahead: (row: number, column: number, value: 0 | 1) =>
    `Um ${1 - value} na linha ${row}, coluna ${column} quebraria uma regra logo adiante, então ali vai ${value}.`,
} as const;

const TERMO_TILE = {
  correct: "certa",
  present: "na palavra",
  absent: "fora",
} as const;

const termoRowAria = (
  row: number,
  max: number,
  guess: string,
  tiles: readonly ("correct" | "present" | "absent")[],
) =>
  `tentativa ${row} de ${max}: ${tiles
    .map((tile, index) => `${guess.charAt(index)} ${TERMO_TILE[tile]}`)
    .join(", ")}`;

const termoLetters = (word: string) => word.split("").join(", ");

const letterAria = (letter: string) => `letra ${letter}`;

const QUEENS_CELL = { 1: "rainha", 0: "marcada" } as const;

const QUEENS_TECHNIQUE = {
  regionInRow: "região presa numa só linha ou coluna",
  regionInColumn: "região presa numa só linha ou coluna",
  rowInRegion: "linha ou coluna presa numa só região",
  columnInRegion: "linha ou coluna presa numa só região",
  blocking: "casa que deixaria uma região sem lugar",
  regionGroupRows: "grupo de regiões presas nas mesmas linhas ou colunas",
  regionGroupColumns: "grupo de regiões presas nas mesmas linhas ou colunas",
} as const;

const queensStep = (
  unit: LineKind | "region",
  at: number,
  row: number,
  column: number,
  after: keyof typeof QUEENS_TECHNIQUE | null,
) => {
  const only =
    unit === "region"
      ? `Na região ${at}, só a casa da linha ${row}, coluna ${column}`
      : `Na ${LINE[unit].name} ${at}, só a casa da ${LINE[unit].across} ${unit === "row" ? column : row}`;
  const sentence = `${only} ainda pode ter rainha.`;
  return after === null
    ? sentence
    : `Com uma técnica avançada (${QUEENS_TECHNIQUE[after]}), ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
};

const cellAriaQueens = (
  row: number,
  column: number,
  region: number,
  value: 0 | 1 | null,
  conflict: boolean,
) =>
  `linha ${row}, coluna ${column}, região ${region}: ${
    value === null ? "vazia" : QUEENS_CELL[value]
  }${conflict ? ", em conflito" : ""}`;

export const messages = {
  meta: {
    title: `${wordmark} — ${tagline}`,
    description: `${taglineCapitalised} — Termo, Cruzadinha, Sudoku, Nonogram, Binairo e Rainhas. ${signOff}`,
  },
  brand: {
    wordmark,
    tagline,
    taglineSentence: `${taglineCapitalised}.`,
    signOff,
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

    completedAria: (game: string) => `${game} concluído`,
    links: {
      archive: "Arquivo",
      freePlay: "Modo livre",
      stats: "Estatísticas",
      settings: "Ajustes",
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
    hint: {
      available: (left: number) =>
        `Usar dica — ${left} ${left === 1 ? "disponível" : "disponíveis"}`,
      used: "Dicas usadas",
    },
    reset: {
      label: "Recomeçar",
      question: "Recomeçar o puzzle? Suas jogadas serão apagadas.",
      cancel: "Cancelar",
    },
    wrongCell: (label: string) => `${label}, não bate com a solução`,
    tipAria: "Como usar os controles",
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

      rejected: "Não foi possível registrar este resultado no dia de hoje.",
    },
    dayCard: {
      title: "O dia até agora",
      missing: "falta",

      played: "jogado",

      done: "feito",
      games: {
        termo: "Termo",
        sudoku: "Sudoku",
        nonogram: "Nonogram",
        nonogramShort: "Nono.",
        binairo: "Binairo",
        crossword: "Cruzadinha",
        queens: "Rainhas",
      },
    },
    streak: {
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
      solved: (name: string) => `${name}s resolvidos`,
    },
    emptyValue: "—",
    histogram: {
      labels: ["<4", "4–5", "5–6", "6–7", "7–9", ">9"],

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
    descriptions: freePlayDescriptions,

    back: "← Modo livre",
    backToIndexAria: "Voltar ao Modo livre",
    modeTag: "Modo livre",
    size: {
      label: "Tamanho",
      option: (size: number) => `${size}×${size}`,
      aria: (size: number) => `Tamanho: ${size} por ${size}`,
    },
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
      lostStamp: "Não deu!",
      wordLead: "A palavra era",
      modeLine: (mode: string, game: string, level?: string) =>
        [mode, game, level].filter((part) => part !== undefined).join(" · "),
      again: {
        binairo: "Mais um",
        sudoku: "Mais um",
        nonogram: "Mais um",
        termo: "Mais uma",
        crossword: "Mais uma",
        queens: "Mais uma",
      },
      backToIndex: "Voltar ao Modo livre",
      backHome: "Voltar para Hoje",

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
    invitation: "Puzzles do dia, iguais para todo mundo.",
    lead: "Termo, Cruzadinha, Sudoku, Nonogram, Binairo e Rainhas. Resolva pelo menos um dos puzzles do dia e a sua sequência começa.",
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
    signInAttached: {
      title: "Este e-mail é de outra conta.",
      body: "A conta deste aparelho já entra com o Google, e duas contas assim não se juntam. Para usar aqui a conta do e-mail, desconecte o Google em Ajustes e peça um novo link.",
    },
    failed: "Não foi possível confirmar agora. Tente de novo.",
    backHome: "Voltar para Hoje",
  },

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
      google:
        "O código que identifica a sua conta Google, somente se você escolher entrar com o Google. Não recebemos do Google o seu nome, a sua foto nem o seu e-mail. Para desconectar, use Ajustes.",

      telemetry:
        "Medições técnicas mínimas de uso e desempenho: quando um puzzle começa e quando termina, quanto tempo levou, e quando uma sequência se quebra. Não gravamos a sua tela, as suas sessões, nem o conteúdo dos puzzles. Essas medições ficam ligadas à sua conta anônima, nunca ao seu e-mail, e são processadas pelo PostHog, um provedor fora do Brasil (Estados Unidos). Excluir a conta apaga tudo o que guardamos aqui; para apagar também o que já está com o provedor, escreva para privacidade@miolos.app.",

      medals:
        "As medalhas: a maioria é calculada do seu histórico de jogos; algumas são concedidas manualmente pela equipe e ficam registradas na sua conta. Todas são apagadas junto com a conta.",

      push: "O lembrete no navegador, somente se você ativar: guardamos o endereço técnico da inscrição e as chaves que o navegador gera, usados só para avisar quando a sua sequência estiver em risco. Para parar, desligue o lembrete em Ajustes, em cada aparelho — a inscrição sai dos nossos registros na hora. Revogar a permissão de notificações no navegador também para os avisos, e a inscrição, que deixa de funcionar, é removida. Excluir a conta apaga tudo.",
    },
    why: {
      heading: "Para que usamos",
      recovery:
        "O e-mail existe para recuperar e mover a sua sequência — se você limpar o navegador ou trocar de aparelho, ele é um caminho de volta. Para remover o e-mail, use Ajustes: sem ele, os lembretes por e-mail também param.",
      google:
        "O código do Google existe só para abrir a sua conta: entrando com o mesmo Google em outro aparelho, você vê a mesma sequência. Não usamos esse código para mais nada. Para desconectar, use Ajustes.",
      reminder:
        "Lembretes de sequência em risco só chegam por e-mail se você marcar o consentimento próprio para isso — e ele vem desmarcado. Se algum aparelho da sua conta recebe o lembrete no navegador, o e-mail não é enviado. Para parar, desmarque o lembrete por e-mail em Ajustes.",
    },
    consents: {
      heading: "Os dois consentimentos",
      body: "Vincular o e-mail (recuperação) e receber lembretes são consentimentos separados e independentes: um nunca implica o outro, e o lembrete vem sempre desmarcado. Guardamos quando cada consentimento foi dado e retirado, como registro do que você autorizou.",
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
      body: "Não existe senha no Miolos — o acesso é pelo link mágico por e-mail ou pela sua conta Google. Não vendemos os seus dados a ninguém.",
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
      body: "Você joga com uma conta anônima criada neste aparelho — sem e-mail, sem senha, sem formulário. Vincular um e-mail é opcional e serve só para recuperar e mover a sua sequência. Entrar com o Google também é opcional, e você desconecta em Ajustes.",
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
    busy: "Excluindo…",
    done: "Conta excluída.",
    doneNote: "Se voltar a jogar, você começa do zero — como no primeiro dia.",
    error: "Não foi possível excluir agora. Tente de novo.",
  },
  settings: {
    title: "Ajustes",
    lead: "Como o Miolos aparece e avisa você neste aparelho, e o que a sua conta guarda.",
    theme: {
      heading: "Aparência",
      legend: "Tema das cores neste aparelho",
      system: "Sistema",
      light: "Claro",
      dark: "Escuro",
    },
    games: {
      heading: "Jogos",
      lead: "Como os jogos aparecem neste aparelho.",
      general: "Em todos os jogos",
      on: "Ligado",
      off: "Desligado",
      flags: {
        showClock: {
          label: "Mostrar cronômetro",
          hint: "Escondido, o tempo continua contando e aparece no fim do puzzle.",
        },
        endAnimation: {
          label: "Animação no fim do jogo",
          hint: "Ao vencer, o carimbo bate e espirra tinta; ao perder, a tinta escorre. Dura um instante.",
        },
        showErrors: {
          label: "Mostrar erros",
          hint: "Marca na hora o que não bate com a solução. Não gasta dica e não mexe na sequência.",
        },
        lockDigit: {
          label: "Número fixo com toque duplo",
          hint: "Toque duas vezes num número, no teclado ou no tabuleiro, para fixá-lo e depois toque nas células para escrevê-lo. Toque no número de novo para soltar.",
        },
        highlightSelection: {
          label: "Destacar linha, coluna e bloco",
          hint: "Pinta a linha, a coluna e o bloco da célula selecionada, e os números iguais a ela.",
        },
        strikePlacedRuns: {
          label: "Riscar números resolvidos",
          hint: "Risca o número de uma linha ou coluna quando suas marcas já mostram o bloco inteiro. Não consulta a solução.",
        },
        straightDrag: {
          label: "Arrastar só em linha reta",
          hint: "Ao arrastar, a marcação fica na linha ou na coluna do primeiro movimento, nunca na diagonal.",
        },
        highlightRegion: {
          label: "Destacar linha, coluna e região",
          hint: "Pinta a linha, a coluna e a região da célula selecionada.",
        },
        fadeQueenLines: {
          label: "Esmaecer o que já tem rainha",
          hint: "Apaga um pouco as células das linhas, colunas e regiões que já têm uma rainha.",
        },
        autoCross: {
          label: "Marcar ✕ automático",
          hint: "Ao pôr uma rainha, marca ✕ nas células vazias da linha, da coluna, da região e em volta dela. Tirar a rainha apaga só esses ✕.",
        },
        firstValue: {
          label: "Primeiro valor",
          hint: "O primeiro toque e o botão esquerdo do mouse põem este número; o segundo toque e o botão direito põem o outro.",
        },
        skipFilled: {
          label: "Pular letras já preenchidas",
          hint: "Ao digitar, a seleção pula as células com letra e vai para a próxima vazia, seguindo para a próxima pista quando a palavra se completa.",
        },
      },
      dialog: {
        trigger: "Ajustes",
        title: "Ajustes do jogo",
        note: "Valem para este aparelho.",
        close: "Fechar",
      },
    },
    push: {
      heading: "Lembretes neste aparelho",
      lead: "Um aviso antes da virada quando a sua sequência estiver em risco. No máximo um por dia, e nunca propaganda.",
      toggle: "Lembrete de sequência em risco",
      on: "Ligado",
      off: "Desligado",
      busy: "Um instante…",
      unsupported: "Este navegador não recebe lembretes do Miolos agora.",
      installHint:
        "No iPhone ou no iPad, adicione o Miolos à Tela de Início pelo botão Compartilhar e abra por lá para ligar os lembretes.",
      blocked:
        "As notificações do Miolos estão bloqueadas neste navegador. Para liberar, abra as configurações do site no navegador e permita as notificações.",
      error: "Não deu certo agora. Tente de novo em instantes.",
    },
    account: {
      heading: "Seu e-mail",
      attached: "E-mail vinculado a esta conta:",
      none: "Sua conta não tem e-mail. Sem e-mail nem Google, não dá para recuperar a sua sequência em outro aparelho.",
      unavailable: "Não conseguimos carregar os dados da conta agora.",
      reminderError: "Não deu certo agora. Tente de novo em instantes.",
      detach: {
        start: "Remover e-mail",
        confirmTitle: "Remover o e-mail desta conta?",
        confirmBody:
          "Sem e-mail nem Google, não dá para recuperar a sua sequência em outro aparelho, e os lembretes por e-mail param. A conta, a sequência e o histórico continuam aqui.",
        confirm: "Sim, remover",
        cancel: "Cancelar",
        busy: "Removendo…",
        done: "E-mail removido.",
        error: "Não foi possível remover agora. Tente de novo.",
      },
    },
    google: {
      heading: "Conta Google",
      lead: "Entre com o Google para levar a sua sequência para qualquer aparelho. Do Google, o Miolos recebe só um código que identifica a conta: nem nome, nem foto, nem e-mail.",
      mergeNote:
        "Se este aparelho tiver jogos de uma conta sem e-mail, eles passam para a conta Google. Nos outros aparelhos dessa conta, entre com o Google também.",
      start: "Entrar com o Google",
      linked:
        "Esta conta está conectada ao Google. Em outro aparelho, entre com o Google aqui em Ajustes para ver a mesma sequência.",
      outcome: {
        ok: "Pronto: a conta Google está conectada neste aparelho.",
        switched:
          "Este aparelho agora mostra a conta ligada a esse Google. A conta que estava aqui continua guardada, e você volta a ela pelo e-mail ou pelo Google dela.",
        failed: "Não deu para entrar com o Google agora. Tente de novo.",
        conflict:
          "Esta conta já está conectada a outra conta Google. Desconecte aquela antes de conectar esta.",
      },
      unlink: {
        start: "Desconectar o Google",
        confirmTitle: "Desconectar o Google desta conta?",
        confirmBody:
          "Depois disso, entrar com esse Google não abre mais esta conta. Se ela não tiver e-mail, só os aparelhos que já estão nela continuam chegando até ela. A conta, a sequência e o histórico continuam aqui.",
        confirm: "Sim, desconectar",
        cancel: "Cancelar",
        busy: "Desconectando…",
        done: "Google desconectado.",
        error: "Não foi possível desconectar agora. Tente de novo.",
      },
    },
    deletion: {
      heading: "Excluir conta",
      lead: "Apaga a sua conta, a sequência e todo o histórico, de uma vez.",
      link: "Ir para a exclusão da conta",
    },
  },
  admin: {
    title: "Administração",
    lead: "Valores que valem para todo mundo e entram em vigor sem deploy.",
    config: {
      heading: "Configuração remota",
      unavailable: "Não conseguimos carregar a configuração agora.",
      notAdmin: "Esta página é só para quem administra o Miolos.",
      emailLabel: "O e-mail vinculado à sua conta:",
      noEmail:
        "Esta conta não tem e-mail vinculado. Para administrar, vincule um e-mail em Ajustes.",
      range: (
        min: number | undefined,
        max: number | undefined,
        fallback: number,
      ) => `De ${min} a ${max} · padrão ${fallback}`,
      save: "Salvar",
      saveAria: (label: string) => `Salvar: ${label}`,
      saved: "Salvo.",
      failed: "Não deu certo agora. Tente de novo.",
    },
    keys: {
      bufferDepth: {
        label: "Dias de reserva",
        hint: "Quantos dias à frente cada jogo fica gerado e validado.",
      },
      attachStreakThreshold: {
        label: "Sequência para pedir o e-mail",
        hint: "A partir de quantos dias de sequência a página Hoje convida a vincular um e-mail.",
      },
      pushOptInStreakThreshold: {
        label: "Sequência para oferecer o lembrete",
        hint: "A partir de quantos dias de sequência a conclusão oferece o lembrete de sequência em risco.",
      },
      freeHintsPerPuzzle: {
        label: "Dicas por puzzle",
        hint: `Quantas dicas grátis cada puzzle do dia e do arquivo oferece. No modo livre são sempre ${FREE_HINTS_PER_PUZZLE}; o Termo não tem dicas.`,
      },
    } satisfies Record<RemoteConfigKey, { label: string; hint: string }>,
    members: {
      heading: "Quem administra",
      lead: "Administradores mudam a configuração; superusuários também decidem quem administra. Vale para a conta com esse e-mail vinculado.",
      roles: {
        superuser: "Superusuário",
        admin: "Administrador",
      } satisfies Record<AdminMemberRole, string>,
      roleLabel: "Papel",
      roleAria: (email: string) => `Papel de ${email}`,
      emailLabel: "E-mail",
      add: "Adicionar",
      remove: "Remover",
      removeAria: (email: string) => `Remover ${email}`,
      lastSuperuser:
        "É o único superusuário. Adicione outro antes de mudar ou remover este.",
    },
  },
  games: {
    termo: {
      kicker: "Palavras",
      name: "Termo",
      description: "Seis tentativas para a palavra do dia.",
      play: {
        title: "Termo",

        rules:
          "Descubra a palavra de cinco letras em até seis tentativas. Digite sem acentos; cada tentativa precisa estar na lista de palavras aceitas.",
        progressLong: (used: number, max: number) =>
          `${used} de ${max} tentativas`,
        progressShort: (used: number, max: number) => `${used} de ${max}`,

        boardAria: "tabuleiro do Termo, seis tentativas de cinco letras",
        rowAria: termoRowAria,
        rowEmptyAria: (row: number, max: number) =>
          `tentativa ${row} de ${max}, vazia`,

        rowActiveAria: (row: number, max: number) =>
          `tentativa ${row} de ${max}, sua vez`,
        cellAria: (slot: number, length: number, letter: string) =>
          `letra ${slot} de ${length}: ${letter === "" ? "vazia" : letter}`,

        rowHeldAria: (row: number, max: number, guess: string) =>
          `tentativa ${row} de ${max}: ${termoLetters(guess)}, aguardando resposta`,

        letterTypedAria: (letter: string, slot: number, length: number) =>
          `${letter}, ${slot} de ${length}`,
        letterErasedAria: (letter: string, slot: number, length: number) =>
          `${letter} apagada, ${slot} de ${length}`,

        notInList: "não está na lista",
        offline: "Sem conexão — a tentativa vai assim que a conexão voltar.",
        failed: "Não foi possível enviar a tentativa.",
        retry: "Tentar de novo",

        keyboard: {
          label: "teclado",
          enterAria: "enviar a tentativa",
          eraseAria: "apagar a letra",

          letterAria,
          letterStateAria: (
            letter: string,
            state: "correct" | "present" | "absent",
          ) => `letra ${letter}: ${TERMO_TILE[state]}`,
          affordance:
            "No teclado: as letras escrevem, as setas mudam de casa, Enter (↵) envia e a tecla de apagar (⌫) apaga.",
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

        lostAria: (max: number) =>
          `Termo jogado: as ${max} tentativas acabaram sem acerto.`,
      },

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
          digitAria: (digit: number) => `escrever ${digit}`,
          digitCompleteAria: (digit: number) =>
            `escrever ${digit} — os 9 já estão no tabuleiro`,
          digitOverAria: (digit: number, count: number) =>
            `escrever ${digit} — colocado ${count} vezes, mais que 9`,
          eraseAria: "apagar a célula selecionada",
          affordance:
            "No teclado: os números de 1 a 9 escrevem e a tecla de apagar (⌫) apaga.",
        },
        hint: {
          correction: "Corrigimos um número que não fecha com as regras.",
          fill: "Não achamos um passo lógico simples aqui, então preenchemos uma célula para você.",
          nakedSingle: (digit: number, cell: SudokuCellCopy) =>
            `Na ${sudokuCell(cell)}, só o ${digit} cabe: a linha, a coluna e o bloco já têm os outros números.`,
          hiddenSingle: (
            kind: SudokuUnitKind,
            digit: number,
            cell: SudokuCellCopy,
          ) =>
            `${inSudokuUnit(kind, cell)}, o ${digit} só cabe na ${sudokuSpot(kind, cell)}.`,
          afterNaked: (
            technique: string,
            digit: number,
            cell: SudokuCellCopy,
          ) =>
            `Com uma técnica avançada (${technique}), só o ${digit} sobra na ${sudokuCell(cell)}.`,
          afterHidden: (
            technique: string,
            kind: SudokuUnitKind,
            digit: number,
            cell: SudokuCellCopy,
          ) =>
            `Com uma técnica avançada (${technique}), o ${digit} só cabe na ${sudokuSpot(kind, cell)} ${ofSudokuUnit(kind, cell)}.`,
          technique: {
            pointing: "candidato travado",
            claiming: "candidato travado",
            nakedPair: "par fechado",
            hiddenPair: "par escondido",
            nakedTriple: "trio fechado",
            hiddenTriple: "trio escondido",
            xWingRows: "X-Wing",
            xWingCols: "X-Wing",
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

        rules:
          "Os números de cada linha e de cada coluna são os blocos de células preenchidas, na ordem, com pelo menos um espaço entre eles. Preencha todos os blocos para revelar a figura.",

        progressLong: (filled: number, total: number) =>
          `${filled} de ${total} preenchidas`,
        progressShort: (size: number, filled: number, total: number) =>
          `${boardSize(size)} · ${filled} de ${total}`,
        sizeLabel: "Tamanho",
        size: boardSize,
        boardAria: (size: number) => `grade do Nonogram, ${size} por ${size}`,
        cellAria: cellAriaNonogram,

        rowCluesAria: (
          row: number,
          runs: readonly number[],
          placed: readonly boolean[],
        ) => `números da linha ${row}: ${runsText(runs, placed)}`,
        columnCluesAria: (
          column: number,
          runs: readonly number[],
          placed: readonly boolean[],
        ) => `números da coluna ${column}: ${runsText(runs, placed)}`,
        controls: {
          fillAria: "preencher células",
          crossAria: "marcar células fora da figura",
          affordance: "No teclado: 1 preenche, 2 marca, 0 apaga.",
        },
        hint: {
          explain: {
            correction: "Corrigimos uma célula que não fecha com os números.",
            fill: "Não achamos um passo lógico simples aqui, então preenchemos uma célula da figura para você.",
            cross:
              "Não achamos um passo lógico simples aqui, então marcamos uma célula fora da figura.",
            step: nonogramStep,
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

        rules:
          "Preencha a grade com zeros e uns. Cada linha e coluna tem quatro de cada, nunca três iguais seguidos, e nenhuma linha ou coluna se repete.",
        progressLong: (filled: number, total: number) =>
          `${filled} de ${total} células`,
        progressShort: (filled: number, total: number) =>
          `${filled} de ${total}`,
        controls: {
          zero: "0",
          one: "1",
          zeroAria: "pintar zeros",
          oneAria: "pintar uns",
          affordance: (first: 0 | 1) =>
            `No mouse, o botão esquerdo põe ${first} e o direito põe ${1 - first}; clicar de novo apaga.`,
        },
        cellAria,
        cellGivenAria: (row: number, column: number, value: 0 | 1) =>
          `linha ${row}, coluna ${column}: ${value}, célula fixa`,
        cellInvalidAria: (row: number, column: number, value: 0 | 1 | null) =>
          `${cellAria(row, column, value)} — esta célula quebra uma regra`,
        hint: {
          explain: {
            correction: "Corrigimos uma célula que não fecha com as regras.",
            fill: "Não achamos um passo lógico simples aqui, então preenchemos uma célula para você.",
            step: binairoStep,
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
    crossword: {
      kicker: "Pistas",
      name: "Cruzadinha",
      description: "Preencha a grade com as respostas das pistas.",
      play: {
        title: "Cruzadinha",

        rules:
          "Preencha cada pista horizontal e vertical com as letras certas. Toque numa célula para escrever; toque de novo para trocar de direção.",

        progressLong: (filled: number, total: number) =>
          `${filled} de ${total} letras`,
        progressShort: (filled: number, total: number) =>
          `${filled} de ${total}`,
        boardAria: (size: number) => `grade da Cruzadinha, ${size} por ${size}`,

        direction: { across: "Horizontal", down: "Vertical" },
        cluesHeading: "Pistas",
        cluePrompt: "Toque numa célula para ver a pista.",
        clueLabel: (n: number, dir: "across" | "down") =>
          `${String(n)} ${dir === "across" ? "horizontal" : "vertical"}`,

        cellAria: (row: number, column: number, value: string | null) =>
          `linha ${row}, coluna ${column}: ${value === null ? "vazia" : letterAria(value)}`,
        blockAria: "célula bloqueada",

        keyboard: {
          label: "teclado",
          eraseAria: "apagar a letra selecionada",
          letterAria,
        },

        hint: {
          explain: {
            correction: "Corrigimos uma letra errada.",
            fill: "Não achamos uma pista aberta, então preenchemos uma letra para você.",
            step: (
              clue: string,
              crossing: string | null,
              row: number,
              column: number,
            ) =>
              `Uma letra da pista ${clue}${crossing === null ? "" : `, que também ajuda na ${crossing}`}: linha ${row}, coluna ${column}.`,
          },
        },

        unavailable: {
          title: "A Cruzadinha de hoje ainda não chegou.",
          body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
          cta: "Voltar para Hoje",
        },
      },
      conclusion: {
        title: "Cruzadinha",
        kicker: "Pistas",
        notYet: {
          title: "Você ainda não concluiu a Cruzadinha de hoje.",
          cta: "Jogar a Cruzadinha de hoje",
        },
      },
    },
    queens: {
      kicker: "Regiões",
      name: "Rainhas",
      description: "Uma rainha por linha, coluna e região.",
      play: {
        title: "Rainhas",

        rules:
          "Ponha uma rainha em cada linha, em cada coluna e em cada região. Duas rainhas nunca se tocam, nem na diagonal. Toque uma vez para marcar, duas para pôr a rainha; arraste para marcar várias casas.",

        progressLong: (placed: number, total: number) =>
          `${placed} de ${total} rainhas`,
        progressShort: (size: number, placed: number, total: number) =>
          `${boardSize(size)} · ${placed} de ${total}`,
        sizeLabel: "Tamanho",
        size: boardSize,
        boardAria: (size: number) => `grade das Rainhas, ${size} por ${size}`,
        cellAria: cellAriaQueens,
        affordance: "No teclado: 1 põe a rainha, 2 marca, 0 apaga.",

        hint: {
          explain: {
            correction: "Corrigimos uma casa que não fecha com a solução.",
            fill: "Não achamos um passo lógico simples aqui, então pusemos uma rainha para você.",
            step: queensStep,
          },
        },

        unavailable: {
          title: "As Rainhas de hoje ainda não chegaram.",
          body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
          cta: "Voltar para Hoje",
        },
      },
      conclusion: {
        title: "Rainhas",
        kicker: "Regiões",
        notYet: {
          title: "Você ainda não concluiu as Rainhas de hoje.",
          cta: "Jogar as Rainhas de hoje",
        },
      },
    },
  },
} as const;

export type Messages = typeof messages;
