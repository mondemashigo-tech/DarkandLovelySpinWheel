# Project Atlas

**A modular quantitative research platform for FX hypothesis testing.**

> We do not predict markets. We test hypotheses. Statistics — not opinions — decide.

Project Atlas treats every trading idea as a scientific hypothesis. You
*pre-register* the rules and the success/failure criteria before you run the
test, separate in-sample from out-of-sample data, and let the numbers deliver an
objective verdict. It is built for **scientific testing, reproducibility and
extensibility** — not for prediction.

The platform is deliberately **dependency-light** (Python standard library +
PyYAML). No pandas, no numpy — so a result you get today reproduces byte-for-byte
on any machine tomorrow.

---

## Core principles

1. **Every idea is a hypothesis.** State it, then test it.
2. **Pre-register criteria.** Success and failure thresholds are fixed *before*
   the test (see `config/baseline.yaml`).
3. **No rule changes mid-test.** If it fails, it is rejected — not re-tuned.
4. **Separate in-sample / out-of-sample.** The out-of-sample tail is never
   touched during development or optimisation.
5. **Statistics decide.** Profit factor, expectancy, drawdown and sample size —
   not conviction — determine the verdict.

## The workflow

```
Idea → Hypothesis → Historical Backtest → Out-of-Sample → Walk-Forward
     → Paper Trading → Small Live Allocation → Scale
```

Atlas automates the middle of this pipeline (everything up to paper trading) and
records every step in an append-only journal.

---

## Quick start

```bash
# (optional) install as a package so the `atlas` command is available
pip install -e .

# 1. scaffold the research workspace
python -m atlas init

# 2. generate a reproducible synthetic dataset (or drop your own CSV in 03_Data/)
python -m atlas data --config config/baseline.yaml

# 3. run the baseline backtest — writes HTML/PDF/CSV reports + a verdict
python -m atlas backtest --config config/baseline.yaml

# 4. optimise parameters (in-sample only), then validate out-of-sample
python -m atlas optimize   --config config/baseline.yaml
python -m atlas backtest   --config config/baseline.yaml --segment out

# 5. robustness testing
python -m atlas walkforward --config config/baseline.yaml
python -m atlas montecarlo  --config config/baseline.yaml

# 6. build the one-page research dashboard
python -m atlas dashboard --config config/baseline.yaml
```

No install required — `python -m atlas <command>` works straight from the repo.

---

## The baseline hypothesis

The shipped baseline (`config/baseline.yaml`) encodes a **London-session
breakout-and-retest** system:

| Element        | Rule                                                        |
| -------------- | ----------------------------------------------------------- |
| Instrument     | GBPUSD (primary), USDJPY (secondary)                        |
| Session        | London open, 08:00–11:00 UTC                                |
| Days           | Tuesday–Thursday                                            |
| Trend filter   | H1 close vs. 50-EMA                                         |
| Entry setup    | M15 breakout of the prior range → M5 retest of the level    |
| Risk           | 1% of equity per trade                                      |
| Target         | 2R                                                          |
| News filter    | No entries within ±15 min of a scheduled release            |

**Pre-registered criteria**

| Verdict   | Condition                                                        |
| --------- | --------------------------------------------------------------- |
| ✅ Accept | PF > 1.5, positive expectancy, drawdown < 10%, ≥ 200 trades      |
| ❌ Reject | PF < 1.2, or drawdown > 15%, or negative expectancy             |
| ⚠️ Else   | Inconclusive (including insufficient sample size)               |

---

## Architecture

Atlas is a set of small, single-responsibility modules. Everything downstream of
data consumes an immutable `Series` of `Bar` objects.

```
atlas/
├── config.py            # YAML config loading + deep-merge (for the optimiser)
├── hypothesis.py        # pre-registered criteria + objective verdict
├── data/                # Bar/Series model, CSV I/O, resampling, synthetic data
├── strategy/            # indicators, signals, the config-driven rule engine
├── backtest/            # event-driven backtester + performance metrics
├── risk/                # fixed-fractional position sizing
├── research/            # grid optimiser, walk-forward, Monte Carlo
├── journal/             # append-only research journal (newline-delimited JSON)
├── reports/             # HTML / PDF / CSV report writers (PDF is pure-Python)
├── dashboard/           # single-page HTML research dashboard
└── cli.py               # the `atlas` command
```

### Module responsibilities

- **Data ingestion** — Load CSVs or generate seeded, reproducible synthetic
  OHLCV data; resample M5 → M15 → H1. Bars are validated and chronologically
  ordered so no downstream code has to defend against bad data.
- **Rule engine** — Pure-Python indicators (EMA, SMA, ATR, Donchian) and a
  config-driven `BaselineStrategy` that composes them into a multi-timeframe
  setup **without look-ahead bias** (higher-timeframe bars are only consulted
  once they have closed).
- **Backtester** — Event-driven, one-position-at-a-time, stop-before-target,
  with explicit spread and commission costs so the equity curve isn't flattered
  by frictionless fills.
- **Metrics** — Profit factor, expectancy (cash and R), win rate, max drawdown,
  per-trade Sharpe, total return.
- **Optimizer / Walk-forward / Monte Carlo** — The anti-curve-fitting toolkit.
  The optimiser only ever sees in-sample data; walk-forward stitches together
  out-of-sample windows; Monte Carlo bootstraps the trade sequence to expose
  tail risk and probability of ruin.
- **Dashboard & reports** — Self-contained, theme-aware HTML; a dependency-free
  PDF writer; and flat CSVs for downstream analysis.

---

## Research workspace layout

The numbered folders are the analyst's workspace; Atlas writes artefacts into
them (generated files are git-ignored):

| Folder            | Contents                                              |
| ----------------- | ----------------------------------------------------- |
| `00_Dashboard`    | Generated research dashboards                          |
| `01_Hypotheses`   | Written, pre-registered hypothesis specifications      |
| `02_Backtesting`  | Backtest working notes                                 |
| `03_Data`         | Price data (CSV)                                       |
| `04_Journal`      | The append-only research journal                       |
| `05_Risk`         | Risk configuration and notes                           |
| `06_AI`           | AI/Claude task tracking and notes                      |
| `08_Reports`      | Generated HTML / PDF / CSV reports                      |
| `09_Datasets`     | Curated / external datasets                            |

The Python package lives at the repository root as `atlas/` so it is importable
and installable (`pip install -e .`).

---

## Using your own data

Drop a CSV of `timestamp,open,high,low,close,volume` rows into `03_Data/` and
point `data.path` in your config at it. A header row is optional and
auto-detected; timestamps are ISO-8601 (naive values are treated as UTC). If no
file is present, Atlas generates a seeded synthetic series so every command
works out of the box.

## Extending Atlas

- **New hypothesis** — copy `config/baseline.yaml`, change the rules and the
  pre-registered criteria, and run the same CLI commands against it.
- **New strategy family** — add a class alongside `BaselineStrategy` and route to
  it from `atlas.strategy.build_strategy` (e.g. via a `strategy.type` key).
- **New metric or report** — metrics are computed in one place
  (`atlas.backtest.metrics`); report writers are independent and additive.

## Testing

```bash
python -m unittest discover -s tests    # 59 tests, standard library only
# or, if pytest is installed:
pytest
```

---

## Note on this repository

This repository also contains a pre-existing, unrelated "Spin the Wheel" web/
mobile asset (`DarkandLovely2025.html`, `mobile/`). Project Atlas is additive and
does not touch it.

*Project Atlas — we do not predict markets, we test hypotheses.*
