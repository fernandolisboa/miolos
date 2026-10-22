export const minesweeperFreeMessages = {
  levels: {
    label: "Nível",
    beginner: "Iniciante",
    intermediate: "Intermediário",
    expert: "Especialista",
    custom: "Personalizado",
    aria: (name: string, rows: number, columns: number, mines: number) =>
      `Nível: ${name}, ${rows} por ${columns}, ${mines} minas`,
    customAria: "Nível: Personalizado, linhas, colunas e minas à escolha",
  },
  custom: {
    label: "Tamanho personalizado",
    rows: "Linhas",
    columns: "Colunas",
    mines: "Minas",
    range: (min: number, max: number) => `${min} a ${max}`,
    play: "Jogar",
  },
  best: {
    isNew: "Novo recorde!",
    line: (time: string) => `Melhor tempo: ${time}`,
  },
} as const;
