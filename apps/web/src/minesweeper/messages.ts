export const minesweeperMessages = {
  progressLong: (left: number) =>
    `${left} ${Math.abs(left) === 1 ? "mina restante" : "minas restantes"}`,
  progressShort: (left: number) =>
    `${left} ${Math.abs(left) === 1 ? "mina" : "minas"}`,
  levels: {
    label: "Nível",
    beginner: "Iniciante",
    intermediate: "Intermediário",
    expert: "Especialista",
    aria: (name: string, rows: number, columns: number, mines: number) =>
      `Nível: ${name}, ${rows} por ${columns}, ${mines} minas`,
  },
  boardAria: (rows: number, columns: number) =>
    `campo minado, ${rows} por ${columns}`,
  finishedAria: (won: boolean) =>
    won ? "campo minado resolvido" : "campo minado, com as minas à vista",
  cellAria: (row: number, column: number, what: string) =>
    `linha ${row}, coluna ${column}: ${what}`,
  cell: {
    hidden: "fechada",
    flag: "bandeira",
    question: "interrogação",
    empty: "vazia",
    count: (n: number) => `${n} ${n === 1 ? "mina" : "minas"} em volta`,
    mine: "mina",
    hit: "mina que explodiu",
    wrongFlag: "bandeira errada",
  },
  tap: {
    label: "O que o toque faz",
    open: "Abrir",
    flag: "Bandeira",
  },
} as const;
