---
tags: [automation, system]
created: 2026-07-15
status: active
---

# 🔁 Automation — Work That Runs Itself

> If it happens 3+ times, it gets automated or becomes an SOP. Linked from [[00_README]] · Sibling: [[14_SOPS]]

## The rule of three

1. First time: just do it.
2. Second time: note the steps in [[17_DAILY_LOGS]].
3. Third time: automate it here, or SOP it in [[14_SOPS]] if judgment is required.

## Automation registry

| Automation | Trigger | Tool | Status |
|---|---|---|---|
| Android build on push | Git push to build branch | GitHub Actions + EAS | Live |
| Expo update publish | Push to main | GitHub Actions | Live |
| Daily capture reminder | 21:00 daily | Phone | Live |
| Weekly review agenda | Monday 08:00 | *to set up* | Planned |
| Pipeline follow-up nudges | Lead idle 3 days | *to set up* | Planned |

## Design rules

- **Every automation has an owner note** — it's registered here or it doesn't exist.
- **Fail loud.** Automations must notify on failure, not silently stop.
- **Audit monthly** ([[04_OPERATING_SYSTEM]]): anything that hasn't earned its maintenance cost gets removed.
- Agent-run automations follow the gates in [[05_AGENT_ARCHITECTURE]] — human approval for anything external.

## Candidate list

New automation ideas start as entries in [[15_EXPERIMENTS]] with a time budget. Graduates get a row in the registry above.
