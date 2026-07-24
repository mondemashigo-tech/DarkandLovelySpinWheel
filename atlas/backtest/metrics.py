"""Performance metrics — the statistics that decide a hypothesis.

Metrics are computed from a list of closed trades and the resulting equity
curve.  The headline numbers Project Atlas cares about are **profit factor**,
**expectancy**, **max drawdown** and **trade count**, because those are the
pre-registered success/failure criteria.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Dict, List, Sequence, Tuple


@dataclass
class Metrics:
    """Container for backtest performance statistics."""

    n_trades: int = 0
    wins: int = 0
    losses: int = 0
    breakeven: int = 0
    win_rate: float = 0.0
    gross_profit: float = 0.0
    gross_loss: float = 0.0
    profit_factor: float = 0.0
    net_profit: float = 0.0
    expectancy: float = 0.0        # average P&L per trade (currency)
    expectancy_r: float = 0.0      # average R-multiple per trade
    avg_win: float = 0.0
    avg_loss: float = 0.0
    total_r: float = 0.0
    total_return: float = 0.0      # fraction, e.g. 0.25 == +25%
    max_drawdown: float = 0.0      # fraction, positive number
    sharpe: float = 0.0            # per-trade Sharpe (not annualised)
    initial_equity: float = 0.0
    final_equity: float = 0.0

    def as_dict(self) -> Dict[str, float]:
        return asdict(self)


def max_drawdown(equity_curve: Sequence[float]) -> float:
    """Return the maximum peak-to-trough drawdown as a positive fraction."""
    peak = float("-inf")
    worst = 0.0
    for value in equity_curve:
        peak = max(peak, value)
        if peak > 0:
            drawdown = (peak - value) / peak
            worst = max(worst, drawdown)
    return worst


def compute_metrics(
    r_multiples: Sequence[float],
    pnls: Sequence[float],
    equity_curve: Sequence[float],
    initial_equity: float,
) -> Metrics:
    """Compute :class:`Metrics` from parallel trade result sequences.

    Parameters
    ----------
    r_multiples:
        Per-trade result expressed in R (risk multiples).
    pnls:
        Per-trade profit and loss in account currency.
    equity_curve:
        Equity after each trade (used for drawdown); should start at
        ``initial_equity``.
    initial_equity:
        Starting account equity.
    """
    metrics = Metrics(initial_equity=initial_equity)
    metrics.n_trades = len(pnls)
    if metrics.n_trades == 0:
        metrics.final_equity = initial_equity
        return metrics

    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    metrics.wins = len(wins)
    metrics.losses = len(losses)
    metrics.breakeven = metrics.n_trades - metrics.wins - metrics.losses
    metrics.win_rate = metrics.wins / metrics.n_trades
    metrics.gross_profit = sum(wins)
    metrics.gross_loss = abs(sum(losses))
    metrics.net_profit = sum(pnls)
    metrics.profit_factor = (
        metrics.gross_profit / metrics.gross_loss
        if metrics.gross_loss > 0
        else float("inf")
        if metrics.gross_profit > 0
        else 0.0
    )
    metrics.expectancy = metrics.net_profit / metrics.n_trades
    metrics.expectancy_r = sum(r_multiples) / metrics.n_trades
    metrics.total_r = sum(r_multiples)
    metrics.avg_win = metrics.gross_profit / metrics.wins if metrics.wins else 0.0
    metrics.avg_loss = -metrics.gross_loss / metrics.losses if metrics.losses else 0.0

    final_equity = equity_curve[-1] if equity_curve else initial_equity
    metrics.final_equity = final_equity
    metrics.total_return = (
        (final_equity / initial_equity) - 1.0 if initial_equity > 0 else 0.0
    )
    metrics.max_drawdown = max_drawdown(equity_curve)

    # Per-trade Sharpe: mean R over std of R.  Simple but scale-free.
    if len(r_multiples) > 1:
        mean_r = metrics.expectancy_r
        variance = sum((r - mean_r) ** 2 for r in r_multiples) / (len(r_multiples) - 1)
        std = math.sqrt(variance)
        metrics.sharpe = mean_r / std if std > 0 else 0.0
    return metrics


def summary_table(metrics: Metrics) -> List[Tuple[str, str]]:
    """Return a human-readable list of ``(label, value)`` rows for reports."""
    pf = metrics.profit_factor
    pf_text = "∞" if math.isinf(pf) else f"{pf:.2f}"
    return [
        ("Trades", str(metrics.n_trades)),
        ("Win rate", f"{metrics.win_rate * 100:.1f}%"),
        ("Profit factor", pf_text),
        ("Expectancy (R)", f"{metrics.expectancy_r:.3f}"),
        ("Expectancy (cash)", f"{metrics.expectancy:.2f}"),
        ("Net profit", f"{metrics.net_profit:.2f}"),
        ("Total return", f"{metrics.total_return * 100:.1f}%"),
        ("Max drawdown", f"{metrics.max_drawdown * 100:.1f}%"),
        ("Sharpe (per-trade)", f"{metrics.sharpe:.2f}"),
        ("Avg win", f"{metrics.avg_win:.2f}"),
        ("Avg loss", f"{metrics.avg_loss:.2f}"),
        ("Final equity", f"{metrics.final_equity:.2f}"),
    ]
