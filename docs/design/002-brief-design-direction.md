# Miolos — Brief de Design

> **Como usar:** este documento alimenta a fase de exploração (método em 3 passos).
> **Passo 1** — monte a biblioteca de inspiração (seção 3) antes de gerar qualquer coisa.
> **Passo 2** — cole as seções 1–6 no Claude Design junto com 3–5 screenshots da biblioteca.
> **Passo 3** — peça as 3 variações da seção 7, escolha a vencedora, refine granularmente.
> A vencedora vira `DESIGN.md` do repo (via `/impeccable init`) e o tema em `packages/ui`.

---

## 1. O produto em uma linha

**Miolos** é um app de puzzles diários em português (Termo-like, Sudoku, Nonogram, Binairo): todo dia, um puzzle novo de cada jogo, o mesmo para todo o Brasil. Ritual de 10 minutos, streak como coluna vertebral. Público: adultos que querem um passatempo inteligente e bonito — não "mais um joguinho".

**Plataforma de lançamento: web** (ver [ADR-0001](../adr/0001-web-is-the-launch-platform.md)). Nativo vem depois. O design é feito para o navegador — desktop e mobile web — não para um app nativo portado.

## 2. Direção: Editorial / Papel

A sensação-alvo: **um caderno de passatempos impresso com capricho** — seção de jogos de um grande jornal, não um app de arcade. Tipografia é a protagonista. Calor de papel, tinta que assenta, celebrações contidas e táteis.

Palavras-guia: *editorial, quente, preciso, adulto, tátil, confiante.*
O oposto do que queremos: *neon, gradiente, plástico, infantil, barulhento, genérico.*

## 3. Biblioteca de inspiração (montar antes de gerar)

Coletar 10–15 screenshots. Fontes sugeridas:

- **NYT Games (app)** — telas do hub, do Mini Crossword e das estatísticas (a referência-mãe da categoria)
- **Puzzmo** — direção editorial com mais personalidade e calor
- **Termo (web, BR)** — o que já funciona culturalmente; observar o que melhorar, não copiar
- **0h h1 / 0h n0** — minimalismo de grade bem resolvido (referência de Binairo)
- Dribbble/Pinterest: buscar `editorial app design`, `newspaper puzzle app`, `serif typography mobile`
- Fora de apps: capas e diagramação de revistas (Piauí, The New Yorker) — hierarquia tipográfica e uso de espaço

Critério de corte: se o screenshot pudesse ser de qualquer app SaaS, descarta.

## 4. Fundamentos candidatos (hipóteses a validar na exploração, não decisões finais)

### Cor

| Papel | Claro | Escuro |
|---|---|---|
| Fundo | `#F7F2E9` (papel quente, nunca branco puro) | `#1B1814` (papel escuro, nunca preto puro) |
| Tinta | `#211D19` | `#E9E2D4` |
| Tinta secundária | `#6E6659` | `#9C9485` |
| Linhas de grade | `#D8D0C2` | `#3A352E` |

**Um acento por jogo** (identidade interna, unidade no conjunto — todos devem funcionar sobre os dois papéis):

- Termo: mostarda `#C08A1E`
- Sudoku: azul-tinta `#2E4E7E`
- Nonogram: terracota `#B5563C`
- Binairo: verde-musgo `#4E6B52`

Acento neutro do app (streak, botões primários fora dos jogos): a tinta mesma, ou um vermelho-lacre `#9E3B2F` a validar.

### Tipografia

- **Display/serifa (títulos, logotipo, números grandes):** Fraunces (variable; alternativas: Instrument Serif, Source Serif 4)
- **UI/sans (corpo, grades, botões):** Instrument Sans (alternativas: Schibsted Grotesk, Familjen Grotesk)
- **Obrigatório:** numerais tabulares (`tnum`) em toda grade, timer e estatística
- **Proibido:** Inter, DM Sans, Poppins, Montserrat, Roboto como fonte de marca
- **Nota de portabilidade:** eixos de fonte variável funcionam na web, mas o React Native **não** suporta `fontVariationSettings` ([ADR-0002](../adr/0002-plain-react-web-ui-not-universal-rn-web.md)). Explorar com variáveis à vontade; o cliente nativo futuro usará instâncias estáticas nos pesos escolhidos. `tabular-nums` funciona nas duas plataformas.

### Forma e espaço

- Raios pequenos (4–8px) — papel tem canto, não bolha
- Espaçamento em escala de 4pt; generoso nas telas de leitura, denso nas grades
- Sombras: quase nenhuma; profundidade por cor de papel e linha, não por blur
- Ícones: traço fino consistente (Lucide como base), nunca emoji como ícone

### Motion (para especificar, não para o mockup)

- Metáfora: **tinta que assenta** — 150–250ms, easing com leve settle, sem bounce exagerado
- Todo feedback visual pareia com haptic (peça encaixa, célula confirma, streak acende)
- Celebração de conclusão: contida e memorável (o carimbo, o traço que se completa) — nunca chuva de confete genérica

## 5. Anti-referências (proibições duras — colar em todo prompt)

Gradiente roxo/azul; glassmorphism; card dentro de card; texto cinza sobre fundo colorido; tile arredondado com ícone acima de todo heading; dark mode preto-puro com neon; mascote; emoji decorativo; sombra difusa em tudo; Inter.

## 6. Telas do escopo de exploração

1. **Hoje (hub)** — a tela de abertura: data em destaque, os 4 puzzles do dia com estado (feito/não feito), streak visível, acesso a estatísticas. É a tela que define o app.
2. **Binairo em jogo** — grade 8×8, controles de célula, timer discreto, botão de dica.
3. **Conclusão** — tempo, streak atualizado, distribuição/stat do jogo, compartilhar.

(As demais telas — Sudoku, Nonogram, Termo, stats, ajustes, onboarding — são desenhadas just-in-time nos milestones, contra o sistema vencedor.)

## 7. As 3 variações a pedir (radicalmente diferentes, dentro da direção)

- **A — "Jornal":** máxima tipografia, quase monocromático com um acento só por tela, densidade editorial, régua e fios como elemento gráfico. O mais sóbrio.
- **B — "Caderno":** textura de papel sutil, acentos por jogo mais presentes, cantos suaves, calor máximo — quase artesanal, sem virar infantil.
- **C — "Editorial moderno":** flat e geométrico, serifa só em displays grandes, espaço em branco generoso, o mais contemporâneo dos três (Puzzmo-meets-NYT).

### Como pedir: 3 rodadas separadas, 4 artefatos cada

**Uma variação por sessão.** Não peça as três de uma vez: num lote grande a qualidade cai no meio do caminho e o desktop da variação A deixa de combinar com o mobile da variação A — que é exatamente a comparação que interessa.

Cada rodada entrega quatro artefatos:

| # | Tela | Viewport |
|---|---|---|
| 1 | Hoje | desktop 1440×900 |
| 2 | Hoje | mobile web 390×844 |
| 3 | Binairo em jogo | desktop 1440×900 |
| 4 | Binairo em jogo | mobile web 390×844 |

Os **mesmos dados fictícios** nos doze artefatos, senão a comparação não vale: streak de 12 dias, dois dos quatro puzzles do dia concluídos.

**Só tema claro nesta rodada.** Dark mode é requisito de lançamento, mas entra depois, aplicado só à vencedora — dobrar os artefatos aqui atrapalha a escolha em vez de informá-la.

Depois: escolher, mesclar se necessário, e só então refinar a vencedora com ajustes granulares (comandos da Impeccable: `bolder`, `quieter`, `typeset`, `colorize`).

## 8. Prompt-base para o Claude Design (colar junto com as seções acima)

Rodar três vezes, uma por variação, trocando só a letra.

> Você vai desenhar telas de **web app** para o Miolos seguindo o brief acima. A web é a plataforma de lançamento — não é um app nativo portado para o navegador.
>
> Gere a **variação [A/B/C]** da seção 7 em **quatro artefatos**:
>
> 1. "Hoje" — desktop, 1440×900
> 2. "Hoje" — mobile web, 390×844
> 3. "Binairo em jogo" — desktop, 1440×900
> 4. "Binairo em jogo" — mobile web, 390×844
>
> Regras invioláveis:
>
> - As proibições da seção 5 valem como lei. Nenhuma exceção, nem "só um detalhe".
> - Tipografia é a protagonista. Use os candidatos da seção 4 via Google Fonts, com eixos variáveis, e `font-variant-numeric: tabular-nums` em toda grade, timer e estatística.
> - **O desktop não é o mobile esticado.** Use a largura de verdade: estrutura em colunas, margens generosas, fios e réguas como elemento gráfico, salto tipográfico maior. Uma coluna estreita centralizada em 1440px é falha, não escolha.
> - **O mobile não é o desktop espremido.** Redesenhe a hierarquia para a tela pequena; não encolha a do desktop.
> - Os quatro artefatos são o **mesmo sistema** — mesmas fontes, mesma escala, mesma paleta, mesmos raios. O que muda é a composição, não a identidade.
> - Mesmos dados fictícios nos quatro: streak de 12 dias, dois dos quatro puzzles do dia concluídos, data de hoje por extenso em pt-BR.
> - Só tema claro nesta rodada.
> - Todo texto em pt-BR. Não invente features fora do brief.
>
> Entregue como HTML/CSS estático de alta fidelidade, um arquivo por artefato. Isto é um spec visual, não código de produção.

## 9. Depois da vencedora

1. `/impeccable init` no repo → preencher `PRODUCT.md`/`DESIGN.md` com a direção vencedora + seção 5 como anti-referências
2. Tokens → `packages/ui` (cores, type scale, espaçamento, raios, durações)
3. Skill `design-handoff` para especificar cada tela antes da implementação em React/Next.js
4. Hook da Impeccable ativo + `npx impeccable detect` no CI como gate anti-slop dos loops autônomos
