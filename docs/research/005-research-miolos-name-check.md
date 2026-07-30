# Research — "Miolos" name check: domains and INPI

**Date:** 2026-07-30. Point-in-time snapshot; registrations and process statuses move. Feeds [ADR-0013](../adr/0013-canonical-domain-and-pt-br-routes.md).

## Domains

| Domain | Status on 2026-07-30 | Evidence |
|---|---|---|
| `miolos.com.br` | **Registered, but expired and on hold.** Registrant Renan Melgaço Pereira Torres (individual), registered 2025-06-04, expired 2026-06-04, status `inactive` / `on_hold`, last changed 2026-06-18. Past expiry: if unpaid it enters registro.br's public release process ("processo de liberação") and becomes registrable. No determinable drop date. | RDAP `https://rdap.registro.br/domain/miolos.com.br` (HTTP 200); avail API `https://registro.br/v2/ajax/avail/raw/miolos.com.br` → `{"status":2,"publication-status":"on_hold","expires-at":"2026-06-04"}` |
| `miolos.app.br` | **Available.** | RDAP 404; avail API `{"status":0}` |
| `miolos.app` | **Available.** | Google Registry RDAP `https://www.registry.google/rdap/domain/miolos.app` → 404 (authoritative) |

Monitoring for the `.com.br` drop: `https://registro.br/dominio/lista-processo-liberacao.txt`, or the avail API.

## INPI trademarks

Searched live via pePI (`https://busca.inpi.gov.br/pePI/`), anonymous session, database updated to 2026-07-28 (RPI 2899). Process numbers are stable identifiers; the session URLs are not.

**Exact "MIOLOS": zero processes, ever.** The exact mark has never been filed.

**Exact "MIOLO"** — 20 processes; the ones that matter for classes 9 / 41 / 42:

- **Class 9 (software):** proc. 828089191, "MIOLO" (mixed), Solis Soluções Livres Ltda, in force until 2030-06-01. Specification is a *software development framework* (database-access/business-logic/presentation independence, "temas") — not a game.
- **Class 42 (SaaS/dev services):** proc. 828089205, same owner, in force until 2030-06-01. Spec: software development and IT support services.
- **Class 41 (entertainment/education):** no in-force exact "MIOLO". Proc. 930435230 ("MIOLO", nominative, education services) was **rejected 2026-06-09** under Art. 124 XIX LPI for conflicting with proc. 923059792 "MIOLO BIRÔ"; awaiting appeal.
- **Miolo Wine Group** holds "MIOLO" only in classes 29/30/31/32/33/35 (food, beverage, retail — procs. 823106926, 823106969, 823107000, 823823610, 913544744, 913544833, 913544922). No presence in 9/41/42. Non-issue for a puzzle app.

**Radical "MIOLO" composites in force, per class:**

- Class 9: Solis "MIOLO" (above); "Capitão MIOLO-MOLE" (930805020, individual).
- Class 41: "MIOLO BIRÔ" (923059792, MB Soluções e Serviços Educacionais — the mark that killed the 2023 filing); "MIOLOVERSO" (925463183, Eureka Soluções Pedagógicas); "MIOLO MOLE" (917241274, literary productions); "Miolo Filmes" (909887470); "quero miolo" (934040842); "ENCONTRO DE MIOLOS bumba meu boi" (925190250).
- Class 42: only Solis "MIOLO" in force.

## Reading

- **Domain:** `miolos.app.br` is free and cheap; `miolos.com.br` has a realistic chance of dropping within months. → [ADR-0013](../adr/0013-canonical-domain-and-pt-br-routes.md): register `.app.br` now, monitor `.com.br`.
- **Trademark:** *using* "Miolos" commercially is low-risk — every prior holder sits in an unrelated niche (dev tooling, teachers' services, publishing, wine) and none operates a consumer game. *Registering* it in 9/41/42 faces genuine citation risk: INPI's own June 2026 decision treated bare "MIOLO" in class 41 as confusable with "MIOLO BIRÔ", and Brazilian practice treats singular/plural as near-identical. Registration is deferred and is not a launch gate.
- **Genuinely unknowable without counsel / a manual INPI session:** whether the 930435230 appeal succeeds; how an examiner would weigh "MIOLOS" for a games-only specification against the education-oriented class-41 marks; whether the `.com.br` holder renews late.

## Bonus figure sourced in the same run

Brazil mobile OS share, **June 2026 (StatCounter):** Android **78.96%**, iOS **21.03%** — `https://gs.statcounter.com/os-market-share/mobile/brazil`. iOS has trended up (≈18.5% early 2025 → 21% mid-2026). This is the load-bearing figure [ADR-0001](../adr/0001-web-is-the-launch-platform.md) flagged as unsourced; its follow-ups section now cites this document.
