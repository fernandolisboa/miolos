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

## Tier labels

Every non-epic issue also carries one `tier-N` label — `tier-0`, `tier-1`, `tier-2` or `tier-3` — naming the routing-table row it is expected to take (`CLAUDE.md` § *Implementation flows are tiered*). Applied when the issue is filed or triaged; re-tiering means moving the label. **The tier is the sizing** — this repo uses no story points (Fernando, 2026-08-19). The label is a pre-work claim, like the tier line in a PR body; the work may still escalate.

Edit the right-hand column to match whatever vocabulary you actually use.
