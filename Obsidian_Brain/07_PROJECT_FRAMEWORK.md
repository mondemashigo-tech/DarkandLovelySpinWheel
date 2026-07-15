---
tags: [projects, system]
created: 2026-07-15
status: evergreen
---

# 🚀 Project Framework — Idea to Shipped

> Every project moves through the same gates. Linked from [[00_README]]

## The pipeline

```
IDEA → SCOPED → BUILDING → SHIPPED → MAINTAINED / KILLED
```

### Gate 1 — Idea → Scoped
- Written one-pager: problem, user, smallest shippable version, success metric
- Passes the [[11_DECISION_FRAMEWORKS]] filter (worth doing? worth doing *now*?)
- Only **one** project may hold "primary" status at a time ([[02_MONDE]])

### Gate 2 — Scoped → Building
- Brief written for the Builder agent → [[05_AGENT_ARCHITECTURE]]
- Quality bar checked against [[08_CREATIVE_STANDARDS]]
- Repo created; ship date set (default: 2 weeks max for v1)

### Gate 3 — Building → Shipped
- v1 in users' hands, however small
- Launch checklist from [[14_SOPS]] completed
- Metrics wired up so the Analyst agent can report

### Gate 4 — Shipped → Maintained / Killed
- 30-day review: metric hit? → maintain and iterate
- Metric missed? → kill or pivot; lesson logged in [[16_LEARNING_LOG]]

## Active project board

| Project | Stage | Ship date | Notes |
|---|---|---|---|
| Dark & Lovely Spin Wheel | SHIPPED | — | Promo game; mobile app + web |
| R300 Trade Signal App | BUILDING | *set* | Signals + bot branches in repo |
| Obsidian Brain | BUILDING | 2026-07 | This vault — see [[19_EVOLUTION]] |

## Rules

- No new IDEA enters SCOPED while the primary project is mid-BUILD.
- Every kill gets a retro — killed projects pay rent in lessons.
