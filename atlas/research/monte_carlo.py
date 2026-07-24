"""Monte Carlo robustness testing via trade-sequence resampling.

A single backtest equity curve is just *one* ordering of the trades that
happened.  By resampling the trade R-multiples many times (with replacement) we
build a distribution of outcomes and can ask sober questions: how bad could the
drawdown realistically get?  What is the chance of ruin?  A strategy whose
median result is great but whose 5th-percentile is catastrophic is not robust.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import List, Sequence

from atlas.backtest.metrics import max_drawdown


@dataclass
class MonteCarloResult:
    """Summary statistics of a Monte Carlo simulation."""

    simulations: int
    final_equity_p5: float = 0.0
    final_equity_p50: float = 0.0
    final_equity_p95: float = 0.0
    max_drawdown_p50: float = 0.0
    max_drawdown_p95: float = 0.0
    prob_profit: float = 0.0
    prob_ruin: float = 0.0
    ruin_threshold: float = 0.0
    final_equities: List[float] = field(default_factory=list)
    drawdowns: List[float] = field(default_factory=list)


def _percentile(sorted_values: Sequence[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = pct / 100.0 * (len(sorted_values) - 1)
    low = int(rank)
    high = min(low + 1, len(sorted_values) - 1)
    frac = rank - low
    return sorted_values[low] * (1 - frac) + sorted_values[high] * frac


def monte_carlo(
    r_multiples: Sequence[float],
    initial_equity: float = 10_000.0,
    risk_per_trade: float = 0.01,
    simulations: int = 1000,
    ruin_fraction: float = 0.5,
    seed: int = 7,
) -> MonteCarloResult:
    """Bootstrap-resample the trade sequence to estimate outcome dispersion.

    Each simulation reshuffles (samples with replacement) the realised
    R-multiples, compounds them at ``risk_per_trade`` of equity, and records the
    final equity and worst drawdown.

    Parameters
    ----------
    ruin_fraction:
        Equity is deemed "ruined" if it ever falls below
        ``initial_equity * ruin_fraction``.
    """
    result = MonteCarloResult(simulations=simulations)
    if not r_multiples:
        result.final_equity_p50 = initial_equity
        return result

    rng = random.Random(seed)
    ruin_threshold = initial_equity * ruin_fraction
    result.ruin_threshold = ruin_threshold
    n = len(r_multiples)
    final_equities: List[float] = []
    drawdowns: List[float] = []
    profitable = 0
    ruined = 0

    for _ in range(simulations):
        equity = initial_equity
        curve = [equity]
        hit_ruin = False
        for _ in range(n):
            r = r_multiples[rng.randrange(n)]
            equity += equity * risk_per_trade * r
            curve.append(equity)
            if equity <= ruin_threshold:
                hit_ruin = True
        final_equities.append(equity)
        drawdowns.append(max_drawdown(curve))
        if equity > initial_equity:
            profitable += 1
        if hit_ruin:
            ruined += 1

    final_equities.sort()
    drawdowns.sort()
    result.final_equities = final_equities
    result.drawdowns = drawdowns
    result.final_equity_p5 = _percentile(final_equities, 5)
    result.final_equity_p50 = _percentile(final_equities, 50)
    result.final_equity_p95 = _percentile(final_equities, 95)
    result.max_drawdown_p50 = _percentile(drawdowns, 50)
    result.max_drawdown_p95 = _percentile(drawdowns, 95)
    result.prob_profit = profitable / simulations
    result.prob_ruin = ruined / simulations
    return result
