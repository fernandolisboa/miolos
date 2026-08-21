#!/usr/bin/env bash
# Serialise full-suite runs across parallel agent worktrees on one box.
#
#   scripts/gate-lock.sh acquire "<who>"   # blocks, polls 15 s, times out at 60 min
#   scripts/gate-lock.sh release
#   scripts/gate-lock.sh status
#
# WHY (handoff 058 §6.5, ADR-0057 decision 3): a capped suite peaks around
# 6.3 GB on a 16 GB box and the uncapped path peaks at 11 629 MB. Two at once
# does not fit, and parallel worktrees running suites concurrently was what
# crashed WSL. `git commit` runs a suite through the pre-commit hook, so the
# lock is taken before ANY command that runs a suite, `git commit` included.
#
# The lock lives in the OS temp dir, not in the repo: parallel agents work in
# separate git worktrees, so a repo-relative lock would not be shared. The
# script itself lives in the repo (2026-08-21) because it previously lived in
# ~/miolos-session/ and was destroyed when that scratch directory was cleaned
# up — while two committed skills still depended on it.

set -euo pipefail

LOCK_DIR="${MIOLOS_GATE_LOCK:-${TMPDIR:-/tmp}/miolos-gate.lock}"
POLL_SECONDS=15
TIMEOUT_SECONDS=3600

holder_who()  { cat "$LOCK_DIR/who"   2>/dev/null || echo "unknown"; }
holder_when() { cat "$LOCK_DIR/when"  2>/dev/null || echo "unknown"; }
holder_epoch(){ cat "$LOCK_DIR/epoch" 2>/dev/null || echo 0; }

# Staleness is TIME-based, never PID-based. `acquire` is its own short-lived
# process — it exits before the suite it guards even starts — so the pid that
# took the lock is always dead by the time anyone looks. A pid check would
# therefore report every held lock as stale and let the next caller break it
# instantly, which is worse than no lock at all. Age is the only signal that
# survives the calling process, and it doubles as the documented 60-minute
# ceiling: a lock older than that belonged to an agent that died or forgot to
# release.
held_seconds() {
  local now; now="$(date +%s)"
  echo $(( now - $(holder_epoch) ))
}

write_owner() {
  printf '%s' "${1:-unnamed}"   > "$LOCK_DIR/who"
  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$LOCK_DIR/when"
  date +%s                      > "$LOCK_DIR/epoch"
}

case "${1:-}" in
  acquire)
    who="${2:-unnamed}"
    waited=0
    while :; do
      # mkdir is atomic: exactly one racer can create the directory.
      if mkdir "$LOCK_DIR" 2>/dev/null; then
        write_owner "$who"
        echo "gate-lock: acquired by '$who'"
        exit 0
      fi
      age="$(held_seconds)"
      if [ "$age" -ge "$TIMEOUT_SECONDS" ]; then
        echo "gate-lock: holder '$(holder_who)' has held it ${age}s (since $(holder_when)), past the ${TIMEOUT_SECONDS}s ceiling — breaking stale lock"
        rm -rf "$LOCK_DIR"
        continue
      fi
      if [ "$waited" -ge "$TIMEOUT_SECONDS" ]; then
        echo "gate-lock: TIMED OUT after ${TIMEOUT_SECONDS}s waiting for '$(holder_who)' (since $(holder_when))" >&2
        exit 1
      fi
      [ "$waited" -eq 0 ] && echo "gate-lock: held by '$(holder_who)' (since $(holder_when), ${age}s) — waiting…"
      sleep "$POLL_SECONDS"
      waited=$((waited + POLL_SECONDS))
    done
    ;;

  release)
    if [ ! -d "$LOCK_DIR" ]; then
      echo "gate-lock: already free"
      exit 0
    fi
    echo "gate-lock: released (was '$(holder_who)', held $(held_seconds)s)"
    rm -rf "$LOCK_DIR"
    ;;

  status)
    if [ ! -d "$LOCK_DIR" ]; then
      echo "gate-lock: FREE  ($LOCK_DIR)"
      exit 0
    fi
    age="$(held_seconds)"
    if [ "$age" -ge "$TIMEOUT_SECONDS" ]; then
      echo "gate-lock: STALE — '$(holder_who)' has held it ${age}s (since $(holder_when)), past the ${TIMEOUT_SECONDS}s ceiling; the next acquire breaks it"
    else
      echo "gate-lock: HELD by '$(holder_who)' (since $(holder_when), ${age}s)"
    fi
    ;;

  *)
    echo "usage: $0 {acquire \"<who>\"|release|status}" >&2
    exit 2
    ;;
esac
