# Handoff — Miolos (v1)

**Para:** primeira sessão do projeto no Claude Code.
**Origem:** sessão de grilling completa (12 perguntas resolvidas) que fundou todas as decisões abaixo. Nada aqui está em aberto salvo indicação contrária.
**Próximo passo esperado:** `/to-spec` usando este documento como insumo → `/to-tickets` → `/implement` do M0.

---

> ## ⚠️ Emendas — 2026-07-29
>
> Este documento continua sendo a fonte da verdade para **tudo que não está listado abaixo**. Ele é um snapshot: não foi reescrito. As decisões que o alteraram estão nos ADRs, que prevalecem sobre o texto original nos pontos indicados.
>
> | O que mudou | Onde estava | ADR |
> |---|---|---|
> | **Web é a plataforma de lançamento**, nativo vem depois | Milestones (M4 Android primeiro); "futura versão web" | [ADR-0001](../adr/0001-web-is-the-launch-platform.md) |
> | UI web em **React/Next.js puro**, não react-native-web; `packages/ui` é tokens, não componentes | Arquitetura (`apps/mobile` Expo como cliente principal) | [ADR-0002](../adr/0002-plain-react-web-ui-not-universal-rn-web.md) |
> | Anonymous-first mantido, **e-mail anexado a partir de streak ≥ 5** com magic link | Auth (device → JWT, social login pós-lançamento) | [ADR-0003](../adr/0003-anonymous-first-identity-with-email-recovery.md) |
> | **Nada não publicado chega ao cliente** — cache só do dia corrente | "cache dos próximos 2–3 dias de puzzles" | [ADR-0004](../adr/0004-no-unpublished-puzzle-reaches-the-client.md) |
> | **Todo conteúdo é grátis**: diário, arquivo histórico e modo livre | "arquivo histórico … inventário premium futuro"; corte "sem modo livre" | [ADR-0005](../adr/0005-all-content-is-free.md) |
> | Monetização: **sem moeda virtual e sem banner de terceiros** (vetos reafirmados); dicas por rewarded ad em lote, expirando à meia-noite | Vetos originais mantidos, escopo detalhado | [ADR-0006](../adr/0006-monetization-convenience-not-access.md) |
>
> O mapa de milestones atualizado vive no [README](../../README.md), que é documento vivo. As invariantes de produto e engenharia vivem no [CLAUDE.md](../../CLAUDE.md).

## O produto

Miolos: app mobile (Android + iOS) de puzzles diários em pt-BR. Modelo "diário curado" estilo NYT Games: um puzzle novo de cada jogo por dia, o mesmo para todos os usuários, publicado pelo servidor. Streak como mecânica central. Dev solo (Fernando), workflow agêntico via Claude Code, majoritariamente do mobile.

## Decisões travadas

### Produto
- Catálogo v1: **Termo-like, Sudoku, Nonogram, Binairo** (nessa ordem de retenção; Binairo primeiro na construção por ser o gerador mais simples). Cruzadas 5×5 no v1.1. Escape room/hidden object/2048/cartas: fora do roadmap v1 (2048/cartas são candidatos ao modo livre pós-lançamento).
- pt-BR only no v1; i18n estruturado no código (strings externalizadas), zero conteúdo em outros idiomas.
- Virada do dia: **meia-noite America/Sao_Paulo, fixa para todos** (sem virada por fuso local).
- Dificuldade: rampa semanal (seg fácil → dom difícil) em Sudoku/Nonogram/Binairo via critério de aprovação do validador; Termo sem rampa.
- Recompensas: streak global (**completar 1 dos 4 mantém**), "Dia Perfeito" (4/4) como marcador raro, estatísticas por jogo (distribuição Termo, tempos, calendário), 20–30 medalhas curadas. **Proibido:** moeda virtual, XP/níveis, baús, ranking global no v1.
- Dicas: 1 grátis por puzzle; extras via rewarded ad quando ads ativarem. Sem saldo acumulável.
- Push: exatamente um tipo — streak em risco, no horário habitual do usuário, opt-in pedido após streak ≥ 3 dias. Nenhum push de marketing.
- Nome: Miolos (pendência não-técnica: checar registro.br + INPI).

### Monetização (desenhada, dormente)
- Lançamento 100% grátis e limpo. Depois: interstitial pós-conclusão com frequency cap + rewarded opt-in. **Banner: nunca.**
- Compra única ~R$ 10 remove ads (RevenueCat quando ativar). Futuro: features à parte.
- Desde o dia 1 no código: componente `<AdSlot placement="..."/>` que renderiza nada, feature flags remotas, `entitlements: string[]` (não boolean). **Não** embarcar SDK de ads no v1.
- Puzzle do dia é sagrado e grátis para sempre; arquivo histórico/temas/stats avançadas são o inventário premium futuro.

### Arquitetura
- Monorepo pnpm + Turborepo:
  - `apps/mobile` — Expo (React Native, New Architecture), EAS Build
  - `apps/api` — Next.js (API + cron de publicação; futura versão web)
  - `packages/games` — gerador/solver/validador por jogo. **TS puro: zero deps de RN ou Node.** Determinístico (seed → puzzle). Alvo prioritário de testes de propriedade (ex.: "todo Sudoku gerado tem solução única").
  - `packages/core` — tipos, schemas Zod (contratos da API), regras de streak/medalhas
  - `packages/db` — schema Drizzle + migrations
- Backend fino: Neon (Postgres) + Drizzle. Cron gera candidatos → validador aprova (dificuldade, solução única, filtro de palavras no Termo) → publica em `daily_puzzles`. Kill switch por puzzle.
- App offline-friendly: cache dos próximos 2–3 dias de puzzles.
- Auth: **anonymous-first** (device → JWT, conta real no Postgres). Login social (Sign in with Apple + Google) como upgrade que faz merge da conta anônima — implementação pós-lançamento; schema (`apple_id`/`google_id` nullable) desde o M0.
- Streak calculado server-side (à prova de relógio adiantado).
- Telemetria: PostHog free tier; eventos: `puzzle_started`, `puzzle_completed` (tempo+jogo), `streak_broken`, `notification_opt_in`, `login_linked`. Sem session replay.
- Stack de referência do dono: mesmo padrão Next.js + Neon + Drizzle de projetos anteriores dele.

### Design
- Direção: **editorial/papel** (NYT Games como referência-mãe): tipografia protagonista, papel quente, um acento por jogo, raios pequenos, dark mode "papel escuro" desde o dia 1, motion "tinta que assenta" (Reanimated + haptics). Sem mascote no v1.
- Processo: exploração em web descartável via Claude Design (3 variações radicais da tela "Hoje" + Binairo) → vencedora vira `DESIGN.md` (via `/impeccable init`) + tokens em `packages/ui` → telas seguintes just-in-time por milestone → hook da Impeccable em toda edição de UI + `npx impeccable detect` no CI como gate anti-slop.
- Detalhes completos em **[`docs/design/002-brief-design-direction.md`](../design/002-brief-design-direction.md)** (não duplicar aqui).
- Imagens geradas (Nano Banana): só fora do runtime — ícone, listing da loja, key art. Dentro do app: SVG/Skia/código.

## Milestones

- **M0 — Fundação:** monorepo, CI, pre-commit (Husky + lint-staged + typecheck + testes), Expo rodando com tema base, API com auth anônima, schema Drizzle inicial.
- **M1 — Binairo ponta a ponta:** gerador+validador em `packages/games`, cron publicando, tela polida, conclusão persistida, streak funcionando. *Valida a arquitetura inteira.*
- **M2 — Catálogo:** Sudoku → Nonogram → Termo (Termo por último; curadoria da lista de palavras corre em paralelo, é trabalho não-técnico).
- **M3 — Retenção:** stats, medalhas, Dia Perfeito, push de streak (Expo Notifications + cron), PostHog.
- **M4 — Lançamento Android:** onboarding, ajustes, privacidade/LGPD, listing (artes via Nano Banana), beta fechado, produção.
- **Pós:** iOS (TestFlight → App Store), login social, modo livre, ativação ads+IAP, cruzadas v1.1 (candidata a /wayfinder).
- Corte acordado explicitamente: lançar **sem** login social, **sem** modo livre, **sem** monetização ativa.

## Workflow acordado

- Skills do Matt Pocock no **formato novo** (plugin gerenciado): `setup-matt-pocock-skills` primeiro no repo (tracker: GitHub Issues), depois `to-spec` → `to-tickets` → `implement` (que já encadeia /tdd e /code-review).
- Loop autônomo sem Warren (avaliado e descartado por ora): tracker como estado durável; um ticket por iteração; headless `claude -p` em loop ou Claude Routines para runs cloud; SessionStart hook injeta contexto (HANDOFF curto + tickets prontos); gate mecânico (pre-commit + impeccable detect) como condição de saída verificável; PRs para review humano do mobile.
- `/grill-with-docs` passa a ser usado para todo plano novo a partir do momento em que CONTEXT.md/ADRs existirem; `/wayfinder` reservado para blocos grandes e nebulosos (cruzadas pt-BR, ativação de monetização, versão web).

## Pendências não-técnicas (dono)

1. Checar "Miolos" no registro.br e INPI.
2. Montar biblioteca de inspiração (seção 3 do brief) e rodar a exploração no Claude Design.
3. Iniciar curadoria da lista de palavras do Termo (respostas + dicionário de validação, pt-BR, sem obscenidades/obscuridades).

## Avisos ao próximo agente

- Não adicionar dependências de RN ou Node em `packages/games` — é a invariante arquitetural do projeto.
- Não introduzir moeda/XP/banner ad em nenhuma proposta; são vetos de produto, não gaps.
- Datas/streaks: sempre `America/Sao_Paulo`; nunca usar o relógio do device como fonte de verdade para streak.
- Qualidade visual é gate, não aspiração: mudanças de UI passam pelo detector da Impeccable.

## Skills sugeridas (ordem de uso)

`setup-matt-pocock-skills` → `setup-pre-commit` (dentro do M0) → `to-spec` (com este doc) → `to-tickets` → `implement` (encadeia `tdd` + `code-review`) → `frontend-design`/Impeccable nas tarefas de UI → `design-handoff` por tela-chave → `handoff` ao fim de cada sessão longa.
