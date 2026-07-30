# Miolos — DESIGN.md (direção vencedora: "Ateliê")

A sensação-alvo: um caderno de passatempos montado à mão com capricho — papel sobre papel, fita, carimbo. Editorial e quente, nunca infantil. Tipografia é a protagonista.

Palavras-guia: *editorial, quente, preciso, adulto, tátil, confiante.*

## Cor (tema claro)
| Papel | Valor |
|---|---|
| Fundo (mesa) | `#F7F2E9` com textura `radial-gradient(rgba(33,29,25,0.06) 1px, transparent 1px)` 24–26px |
| Papel de cartão | `#FBF7EF` |
| Papel tingido (célula dada) | `#F1EADD` |
| Tinta | `#211D19` |
| Tinta secundária | `#6E6659` |
| Linhas | `#D8D0C2` |

Acentos por jogo (fita, kicker, carimbo, botão): Termo mostarda `#C08A1E` · Sudoku azul-tinta `#2E4E7E` · Nonogram terracota `#B5563C` · Binairo verde-musgo `#4E6B52`. Acento do app (streak, promo): vermelho-lacre `#9E3B2F`.

## Tipografia
- Display: **Fraunces** (variable). Itálico = a voz humana do app. Pesos 450–600.
- UI: **Instrument Sans** 400–700.
- `font-variant-numeric: tabular-nums` obrigatório em toda grade, timer e estatística.
- Kickers: 10–11px, uppercase, letter-spacing 0.14–0.16em.
- Proibido como fonte de marca: Inter, DM Sans, Poppins, Montserrat, Roboto.

## Forma
- Raio 6px (células 5px, fita 2px). Papel tem canto, não bolha.
- **Sombra dura, nunca difusa**: `Npx Npx 0 rgba(acento, 0.2–0.3)`, N = 3–6. Profundidade por cor de papel e linha, não por blur.
- Fita washi: retângulo `rgba(acento, 0.32)`, raio 2px, rotação ±3–5deg, borda superior do cartão.
- Rotações de cartão: ±0.3–2.4deg, estáticas.
- Carimbo de conclusão: círculo de 3px na cor do jogo, rotação −6deg, conteúdo tipográfico.
- Espaçamento em escala de 4pt; alvos de toque ≥44px.

## Motion
"Tinta que assenta": 150–250ms, ease-out com settle leve, sem bounce exagerado. Pressed = desliza 1px na direção da sombra e a sombra encolhe. Haptic (Vibration API) só como reforço — nunca portador de estado (ausente no desktop e iOS Safari). Celebração = o carimbo assentando; nunca confete.

## Anti-referências (lei)
Gradiente roxo/azul; glassmorphism; card dentro de card; texto cinza sobre fundo colorido; tile arredondado com ícone acima de heading; dark preto-puro com neon; mascote; emoji decorativo; sombra difusa; Inter.

## Dark mode (pendente)
Requisito de lançamento, ainda não desenhado. Base do brief: fundo `#1B1814`, tinta `#E9E2D4`, secundária `#9C9485`, linhas `#3A352E`; acentos a revalidar por contraste sobre papel escuro.
