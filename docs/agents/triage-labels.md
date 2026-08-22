# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Flow labels

Every non-epic issue also carries one flow label — `quick-change`, `defect`, `feature` or `foggy` — naming the row it is expected to take (`CLAUDE.md` § *Pick the flow, then work*). Applied when the issue is filed or triaged; re-routing means moving the label. **The row is the sizing** — this repo uses no story points (Fernando, 2026-08-19). The label is a pre-work claim, like the row line in a PR body; the work may still escalate.

There is no label for the Records row: records work does not get an issue.

The old `tier-0`…`tier-3` labels were retired with ADR-0074. On an issue filed before then, read `tier-0`/`tier-1` as `quick-change` or `defect`, `tier-2` as `feature`, `tier-3` as `foggy`.

Edit the right-hand column to match whatever vocabulary you actually use.
