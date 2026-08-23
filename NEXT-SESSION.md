# Do I need to do anything?

**Read [`docs/pending-fernando.md`](./docs/pending-fernando.md)** — the living ledger of everything waiting on you, in blocking order, kept current by every session. To work through it: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

Everything else is agent-owned — plans, reviews, fixes and merges happen without you.

## Session state

Two campaigns are open, both agent-owned, nothing blocked.

**#205 — comment removal, tranche 6 of 8 done.** `apps/web/src/play` is complete: #220 took the `.ts`/`.tsx` half (2,967 → 1,203) and #221 the CSS half (824 → 187). Zero code changed in either, proved by hashing declarations. Left: the `apps/web` remainder — **7,578 comment lines**, too big for one PR, split into 7a–7d on the issue — then `app/`+`scripts/`, `test/`, and `eslint.config.mjs`.

**#221 cost seven review rounds, and six of the seven rejections were for defects introduced while fixing the previous round.** Five rules came out of it and are written up as a comment on #205 (Rules F–J). Read them before the next sweep. The two that generalise furthest:

- **Condensing a comment is rewriting it** — paraphrasing produced six factual errors. Restore verbatim or delete; never reword.
- **`bodyOf` is first-match at every level** — one gate was bypassed eight ways across six rounds. Every descent needs a uniqueness assertion.

Also: **`npx impeccable detect` with no argument scans nothing and exits 0.** #212 and #220 both cited that vacuous green as gate evidence. The real UI gate is the CI `detect` check.

**#206 — duplication, 3 of 15 clusters done.** Next by value is cluster 14, `conclusion-view.tsx`. Note the issue's "1,477 lines" is stale — #220 cut it to **888**. The duplication is still real: `ConclusionView`/`RemoteConclusionView` and `ShippedStamp`/`RemoteShippedStamp`/`RemoteTermoStamp` are parallel implementations of the same two screens.

**#209 — the `apps/web` CI flake** is diagnosed but unfixed; it did not reproduce across any of this session's full-suite runs. Worth fixing alongside the `apps/web/test` tranche.

**#219** — the read-only-but-not-writable store defect, filed from #220 — is now triaged `defect` + `ready-for-agent`.

Both issues carry the campaign's accumulated rules in their comments — read them before sweeping or extracting. Every one cost a review round to learn.
