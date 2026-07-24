# Claude / AI Build Tasks

Tracking of the AI-assisted build tasks from the Project Atlas specification.

## Delivered

- [x] **Python, modular architecture** — single-responsibility packages under
  `atlas/` (data, strategy, backtest, risk, research, journal, reports,
  dashboard).
- [x] **Config-driven strategies** — all rules and criteria live in
  `config/baseline.yaml`; no hard-coded parameters.
- [x] **Unit tests** — 59 standard-library `unittest` cases in `tests/`.
- [x] **CLI** — `python -m atlas {init,data,backtest,optimize,walkforward,montecarlo,dashboard}`.
- [x] **Dashboard** — self-contained, theme-aware HTML overview.
- [x] **HTML / PDF / CSV reports** — including a dependency-free PDF writer.
- [x] **Documentation** — `README.md`, per-folder READMEs, and a written
  hypothesis specification in `01_Hypotheses/`.
- [x] **Type hints** — throughout the codebase (`from __future__ import annotations`).

## Modules from the spec

Data ingestion · rule engine · backtester · metrics · optimizer · walk-forward ·
Monte Carlo · dashboard · journal — all implemented.

## Ideas for future iterations

- Additional strategy families routed via a `strategy.type` config key.
- Real-data adapters (broker/API CSV exporters) into `03_Data/`.
- Paper-trading loop that consumes live bars and appends to the journal.
- Portfolio-level aggregation across multiple hypotheses.
