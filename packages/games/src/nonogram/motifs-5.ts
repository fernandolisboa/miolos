import type { Motif } from "./motifs";

/** 5×5 class — Monday (whole class). See motifs.ts for the curation rules. */
export const MOTIFS_5: ReadonlyArray<Motif> = [
  {
    id: "heart",
    name: "Coração",
    size: 5,
    mirrorable: false,
    rows: [
      ".#.#.", //
      "#####",
      "#####",
      ".###.",
      "..#..",
    ],
  },
  {
    id: "house",
    name: "Casa",
    size: 5,
    mirrorable: false,
    rows: [
      "..#..", //
      ".###.",
      "#####",
      "##.##",
      "##.##",
    ],
  },
  {
    id: "arrow",
    name: "Seta",
    size: 5,
    mirrorable: false,
    rows: [
      "..#..", //
      ".###.",
      "#####",
      "..#..",
      "..#..",
    ],
  },
  {
    id: "tree",
    name: "Árvore",
    size: 5,
    mirrorable: false,
    rows: [
      ".###.", //
      "#####",
      "#####",
      "..#..",
      "..#..",
    ],
  },
  {
    id: "flower",
    name: "Flor",
    size: 5,
    mirrorable: false,
    rows: [
      ".#.#.", //
      "#####",
      ".###.",
      "..#..",
      ".###.",
    ],
  },
  {
    id: "fish",
    name: "Peixe",
    size: 5,
    mirrorable: true,
    rows: [
      ".....", //
      ".##.#",
      "#####",
      ".##.#",
      ".....",
    ],
  },
  {
    id: "sailboat",
    name: "Barco",
    size: 5,
    mirrorable: true,
    rows: [
      "..#..", //
      "..##.",
      "..#..",
      "#####",
      ".###.",
    ],
  },
  {
    id: "star",
    name: "Estrela",
    size: 5,
    mirrorable: false,
    rows: [
      "..#..", //
      ".###.",
      "#####",
      ".###.",
      ".#.#.",
    ],
  },
  {
    id: "moon",
    name: "Lua",
    size: 5,
    mirrorable: true,
    rows: [
      ".###.", //
      "##...",
      "##...",
      "##...",
      ".###.",
    ],
  },
  {
    id: "goblet",
    name: "Taça",
    size: 5,
    mirrorable: false,
    rows: [
      "#####", //
      ".###.",
      "..#..",
      "..#..",
      ".###.",
    ],
  },
  {
    id: "hat",
    name: "Chapéu",
    size: 5,
    mirrorable: false,
    rows: [
      ".....", //
      ".###.",
      ".###.",
      "#####",
      ".....",
    ],
  },
  {
    id: "mushroom",
    name: "Cogumelo",
    size: 5,
    mirrorable: false,
    rows: [
      ".###.", //
      "#####",
      "..#..",
      "..#..",
      "..#..",
    ],
  },
  {
    id: "umbrella",
    name: "Guarda-chuva",
    size: 5,
    mirrorable: true,
    rows: [
      ".###.", //
      "#####",
      "..#..",
      "..#..",
      "..##.",
    ],
  },
  {
    id: "balloon",
    name: "Balão",
    size: 5,
    mirrorable: false,
    rows: [
      ".###.", //
      "#####",
      "#####",
      ".###.",
      "..#..",
    ],
  },
  {
    id: "kite",
    name: "Pipa",
    size: 5,
    mirrorable: true,
    rows: [
      "..#..", //
      ".###.",
      ".###.",
      "..#..",
      "...#.",
    ],
  },
  {
    id: "flag",
    name: "Bandeira",
    size: 5,
    mirrorable: true,
    rows: [
      "####.", //
      "####.",
      "#....",
      "#....",
      "#....",
    ],
  },
  {
    id: "key",
    name: "Chave",
    size: 5,
    mirrorable: true,
    rows: [
      ".....", //
      "##...",
      "#####",
      "##..#",
      ".....",
    ],
  },
  {
    id: "mug",
    name: "Caneca",
    size: 5,
    mirrorable: true,
    rows: [
      "####.", //
      "#####",
      "#####",
      "####.",
      ".....",
    ],
  },
  {
    id: "apple",
    name: "Maçã",
    size: 5,
    mirrorable: false,
    rows: [
      "..#..", //
      ".###.",
      "#####",
      "#####",
      ".###.",
    ],
  },
  {
    id: "cherry",
    name: "Cereja",
    size: 5,
    mirrorable: true,
    rows: [
      "...##", //
      "..##.",
      "..#..",
      ".###.",
      ".###.",
    ],
  },
  {
    id: "ice-cream",
    name: "Sorvete",
    size: 5,
    mirrorable: false,
    rows: [
      ".#.#.", //
      "#####",
      ".###.",
      ".###.",
      "..#..",
    ],
  },
  {
    id: "cactus",
    name: "Cacto",
    size: 5,
    mirrorable: false,
    rows: [
      "..#..", //
      "#.#.#",
      "#####",
      "..#..",
      "..#..",
    ],
  },
  {
    id: "bottle",
    name: "Garrafa",
    size: 5,
    mirrorable: false,
    rows: [
      "..#..", //
      "..#..",
      ".###.",
      ".###.",
      ".###.",
    ],
  },
  {
    id: "candle",
    name: "Vela",
    size: 5,
    mirrorable: false,
    rows: [
      "..#..", //
      ".###.",
      ".###.",
      ".###.",
      "#####",
    ],
  },
  {
    id: "bell",
    name: "Sino",
    size: 5,
    mirrorable: false,
    rows: [
      "..#..", //
      ".###.",
      ".###.",
      "#####",
      "..#..",
    ],
  },
  {
    id: "crown",
    name: "Coroa",
    size: 5,
    mirrorable: false,
    rows: [
      ".....", //
      "#.#.#",
      "#####",
      "#####",
      ".....",
    ],
  },
  {
    id: "car",
    name: "Carro",
    size: 5,
    mirrorable: false,
    rows: [
      ".###.", //
      "#####",
      "#####",
      ".#.#.",
      ".....",
    ],
  },
  {
    id: "table",
    name: "Mesa",
    size: 5,
    mirrorable: false,
    rows: [
      ".....", //
      "#####",
      "#...#",
      "#...#",
      ".....",
    ],
  },
  {
    id: "chair",
    name: "Cadeira",
    size: 5,
    mirrorable: true,
    rows: [
      "#....", //
      "#....",
      "####.",
      "#..#.",
      "#..#.",
    ],
  },
  {
    id: "t-shirt",
    name: "Camiseta",
    size: 5,
    mirrorable: false,
    rows: [
      "##.##", //
      "#####",
      ".###.",
      ".###.",
      ".###.",
    ],
  },
  {
    id: "boot",
    name: "Bota",
    size: 5,
    mirrorable: true,
    rows: [
      "##...", //
      "##...",
      "##...",
      "####.",
      "####.",
    ],
  },
  {
    id: "cracker",
    name: "Biscoito",
    size: 5,
    mirrorable: false,
    rows: [
      "#####", //
      "#.#.#",
      "#####",
      "#.#.#",
      "#####",
    ],
  },
  {
    id: "target",
    name: "Alvo",
    size: 5,
    mirrorable: false,
    rows: [
      "#####", //
      "#...#",
      "#.#.#",
      "#...#",
      "#####",
    ],
  },
  {
    id: "stairs",
    name: "Escada",
    size: 5,
    mirrorable: true,
    rows: [
      "#....", //
      "##...",
      "###..",
      "####.",
      "#####",
    ],
  },
  {
    id: "mountain",
    name: "Montanha",
    size: 5,
    mirrorable: false,
    rows: [
      ".....", //
      "..#..",
      ".###.",
      "#####",
      "#####",
    ],
  },
  {
    id: "leaf",
    name: "Folha",
    size: 5,
    mirrorable: true,
    rows: [
      "...#.", //
      "..###",
      ".####",
      "####.",
      "##...",
    ],
  },
  {
    id: "pot",
    name: "Panela",
    size: 5,
    mirrorable: false,
    rows: [
      ".....", //
      "#####",
      ".###.",
      ".###.",
      "#####",
    ],
  },
];
