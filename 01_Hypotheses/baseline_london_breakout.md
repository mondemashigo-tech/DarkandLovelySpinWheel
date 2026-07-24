# Hypothesis: Baseline London Breakout-and-Retest

**Status:** pre-registered · **Config:** [`config/baseline.yaml`](../config/baseline.yaml)

## Statement

> On GBPUSD, during the London session (08:00–11:00 UTC) on Tuesday–Thursday,
> entering in the direction of the H1 trend on a M15 breakout of the prior range
> that is confirmed by a M5 retest, risking 1% per trade for a 2R target,
> produces a positive-expectancy edge.

This is a hypothesis to be **tested**, not a claim to be defended. The rules and
the criteria below are fixed before the test is run and must not be changed
mid-test.

## Rules (the independent variables)

| Component     | Rule                                                          |
| ------------- | ------------------------------------------------------------- |
| Instrument    | GBPUSD (primary), USDJPY (secondary)                          |
| Session       | 08:00–11:00 UTC                                               |
| Days          | Tuesday, Wednesday, Thursday                                  |
| Trend (H1)    | Long only if H1 close > 50-EMA; short only if below           |
| Breakout (M15)| Close beyond the prior 20-bar Donchian range                 |
| Retest (M5)   | Price returns to the breakout level (within 0.6 ATR) then resumes |
| Stop          | Beyond the retest extreme, +0.5 ATR buffer                    |
| Target        | 2R                                                            |
| Risk          | 1% of current equity per trade                                |
| News filter   | No entries within ±15 min of a scheduled release              |

## Pre-registered criteria (the decision rule)

| Verdict          | Condition                                                    |
| ---------------- | ----------------------------------------------------------- |
| **ACCEPT**       | Profit factor > 1.5 **and** positive expectancy **and** max drawdown < 10% **and** ≥ 200 trades |
| **REJECT**       | Profit factor < 1.2 **or** max drawdown > 15% **or** negative expectancy |
| **INCONCLUSIVE** | Anything in between, or fewer than 200 trades                |

## Method

1. **Historical backtest** on the full series (`atlas backtest`).
2. **Out-of-sample** confirmation on the untouched final 30% (`--segment out`).
3. **Walk-forward** analysis to guard against curve-fitting (`atlas walkforward`).
4. **Monte Carlo** resampling to quantify tail risk and probability of ruin
   (`atlas montecarlo`).
5. Record the verdict in the journal and, only if accepted, advance to paper
   trading.

## Notes

The shipped dataset is seeded synthetic data so the whole pipeline runs with no
external dependency. Replace it with real GBPUSD M5 data in `03_Data/` to run the
genuine test — the verdict is only as meaningful as the data behind it.
