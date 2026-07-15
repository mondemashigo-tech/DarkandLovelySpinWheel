---
tags: [ai, agents, system]
created: 2026-07-15
status: active
---

# 🤖 Agent Architecture — The AI Stack

> How AI agents divide the work. Linked from [[00_README]] · Prompts live in [[12_PROMPT_ENGINEERING]]

## Design principle

One human (Monde) directs; agents execute in parallel. Every agent has a **single job**, a **defined input**, and a **place its output lands in this vault**.

## The roster

| Agent | Job | Input | Output lands in |
|---|---|---|---|
| **Builder** | Code: apps, games, automations | Spec from [[07_PROJECT_FRAMEWORK]] | Git repos, release notes |
| **Researcher** | Market/tech scouting, summarising | Question + context | [[13_KNOWLEDGE_BASE]] |
| **Scribe** | Turn raw capture into clean notes | Daily logs, voice notes | [[06_MEMORY_SYSTEM]] targets |
| **Analyst** | Numbers: pipeline, experiments, trading | Data exports | [[09_BUSINESS_SYSTEMS]], [[15_EXPERIMENTS]] |
| **Creative** | Copy, visuals, brand assets | Brief + [[08_CREATIVE_STANDARDS]] | Asset library |

## Orchestration rules

1. **Brief before build.** No agent runs without a written brief (template in [[14_SOPS]]).
2. **Vault is the interface.** Agents read context from these notes and write results back — no orphan outputs.
3. **Human gate on anything external.** Publishing, sending, spending: Monde approves.
4. **Log every notable run.** Wins and failures → [[16_LEARNING_LOG]]; reusable prompts → [[12_PROMPT_ENGINEERING]].

## Current tooling

- Claude (Code + chat) as the primary engine
- GitHub for all build output
- WhatsApp self-chat as mobile capture inbox → processed per [[06_MEMORY_SYSTEM]]

## Upgrade path

Candidates for new agents are proposed in [[15_EXPERIMENTS]] and graduate here only after a successful trial.
