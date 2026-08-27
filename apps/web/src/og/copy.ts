import { messages } from "../i18n";

export const ogCopy = {
  altGame: (name: string) => `Cartão do ${messages.brand.wordmark} — ${name}`,
  altSite: `Cartão do ${messages.brand.wordmark}`,

  siteTagline: "Quatro jogos de raciocínio por dia.",

  archiveTagline: "Todos os puzzles do dia desde o começo.",

  archiveDayCaption: (year: string) => `de ${year} · ${messages.archive.title}`,

  altArchiveIndex: `Cartão do ${messages.brand.wordmark} — ${messages.archive.title}`,
  altArchiveDay: (longDate: string) =>
    `Cartão do ${messages.brand.wordmark} — puzzles de ${longDate}`,
  altArchiveMonth: (month: string) =>
    `Cartão do ${messages.brand.wordmark} — ${messages.archive.title} de ${month}`,
  dailyTitle: (name: string) => `${name} de hoje — ${messages.brand.wordmark}`,
  dailyDescription: (name: string) =>
    `O ${name} de hoje no ${messages.brand.wordmark}: um por dia, igual para todo mundo.`,
};
