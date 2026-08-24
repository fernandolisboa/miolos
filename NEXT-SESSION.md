# Do I need to do anything?

**Read [`docs/pending-fernando.md`](./docs/pending-fernando.md)** — the living ledger of everything waiting on you, in blocking order, kept current by every session. To work through it: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

Everything else is agent-owned — plans, reviews, fixes and merges happen without you.

## Session state

Two campaigns are open, both agent-owned, nothing blocked.

**#205 — comment removal. Tranche 7a is CLOSED** (#223 `src/i18n/messages.ts`, #225 `src/day` + `src/session` + `src/og`, 1,093 → 827). Zero code changed in either, proved by hashing. Tranches 1–6 done.

**Next is 7b: the four game dirs' `.ts`/`.tsx`.** Then 7c (the game `.module.css`, 1,097), 7d (`src/archive`, `src/free-play`, `src/components`), then `app/`+`scripts/`, `test/`, `eslint.config.mjs`.

**Read the two rule comments on #205 before sweeping anything.** #225 cost three review rounds and *every round found a defect the previous FIX left behind*. The four that generalise:

- **Re-derive the baseline with a PARSER.** A bare `ts.createScanner` loop needs `reScanTemplateToken` to walk template-literal spans and silently stops early without it — it under-counted 7a by 21%. Every published tranche estimate (7b's "~2,600") came from that scanner and is a **floor**. Reconciling to `numstat` does not catch this.
- **A dangling pointer is a class.** Fix the instance a review names, then enumerate *every* outbound pointer in the tranche. #225's round-1 fix closed one and left its twin four lines away.
- **Rule A has two halves: the quoted text AND the line anchor.** A sentence kept byte-identical still breaks `ADR-NNNN:33`-style citations when the sweep moves it. Grep for `<swept-file>:` and convert to symbol citations.
- **Per deleted paragraph, name the gate** — and ask whether deleting the code it defends would actually red that test. Four ungated rules survived into review in files whose ADRs looked exhaustive.

Also: **`npx impeccable detect` with no argument scans nothing and exits 0.** #212 and #220 both cited that vacuous green. The real UI gate is the CI `detect` check on the head commit.

**#206 — duplication, 3 of 15 clusters done.** Next by value is cluster 14, `conclusion-view.tsx`. The issue's "1,477 lines" is stale — #220 cut it to **888**. The duplication is still real: `ConclusionView`/`RemoteConclusionView` and `ShippedStamp`/`RemoteShippedStamp`/`RemoteTermoStamp`.

**#209 — the `apps/web` CI flake** is diagnosed but unfixed; it did not reproduce across any full-suite run in the last two sessions. Worth fixing alongside the `apps/web/test` tranche.

**#219** — the read-only-but-not-writable store defect — is triaged `defect` + `ready-for-agent`.

**One debt 7d must clear:** #225 left `day-client.ts` without its free-play-wall paragraph and boundary-rule comment restored *and* asserting it is a "line-by-line sibling" of `streak-client.ts`. Both went back in, so 7d has to sweep all seven clients together or the asymmetry returns.
