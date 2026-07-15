---
tags: [ai, prompts, library]
created: 2026-07-15
status: active
---

# ✍️ Prompt Engineering — The Prompt Library

> Prompts that earn reuse live here. Linked from [[00_README]] · Powers [[05_AGENT_ARCHITECTURE]]

## House prompting rules

1. **Context first.** Paste the relevant vault note(s) before the ask — agents read the brain, not vibes.
2. **One job per prompt.** Chained small prompts beat one mega-prompt.
3. **Show the output format.** Give a filled example, not a description of one.
4. **State the quality bar.** Reference [[08_CREATIVE_STANDARDS]] for anything user-facing.
5. **Iterate in place.** When a prompt works twice, it gets saved here with a version number.

## Template — Agent brief (v1)

```
ROLE: You are the {Builder|Researcher|Scribe|Analyst|Creative} agent for ZPK.
CONTEXT: {paste relevant vault notes}
JOB: {single, specific outcome}
CONSTRAINTS: {time, tools, budget, brand rules}
OUTPUT: {exact format + where it lands in the vault}
DONE MEANS: {acceptance criteria}
```

## Template — Build spec (v1)

```
Build {thing} for {user}.
Smallest shippable version: {description}
Must: {3–5 hard requirements}
Must not: {explicit exclusions}
Quality bar: mobile-first, loads <3s on mobile data, works on mid-range Android.
Deliver: repo + run instructions + what you'd do next.
```

## Saved prompts

| Name | Version | Job | Notes |
|---|---|---|---|
| Agent brief | v1 | Standard agent kickoff | above |
| Build spec | v1 | Builder agent input | above |
| *add as they prove out* | | | |

## Graveyard

Prompts that failed and why — so they're not rebuilt. Failures also get a line in [[16_LEARNING_LOG]].
