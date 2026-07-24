"""Walk-forward analysis.

Walk-forward is the gold standard for guarding against curve-fitting: repeatedly
optimise on a trailing in-sample window, then trade the chosen parameters on the
*next* out-of-sample window that the optimiser never saw.  Stitching the
out-of-sample windows together yields an equity curve that only ever traded on
unseen data.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Sequence

from atlas.backtest.engine import Backtester
from atlas.backtest.metrics import Metrics, compute_metrics
from atlas.config import merge
from atlas.data.ingestion import Bar, Series
from atlas.research.optimizer import GridOptimizer, _set_dotted


@dataclass
class WalkForwardWindow:
    """One in-sample/out-of-sample fold of a walk-forward run."""

    fold: int
    in_sample_bars: int
    out_sample_bars: int
    best_params: Dict[str, Any]
    out_metrics: Metrics


@dataclass
class WalkForwardResult:
    """Aggregate result of a walk-forward run over stitched OOS windows."""

    windows: List[WalkForwardWindow] = field(default_factory=list)
    combined_metrics: Metrics = field(default_factory=Metrics)


def walk_forward(
    config: Dict[str, Any],
    series: Series,
    param_space: Dict[str, Sequence[Any]],
    train_bars: int,
    test_bars: int,
    step_bars: int | None = None,
) -> WalkForwardResult:
    """Run an anchored-rolling walk-forward analysis.

    Parameters
    ----------
    config:
        Baseline configuration.
    series:
        The full price series.
    param_space:
        Parameter grid, in the same dotted form the optimiser accepts.
    train_bars, test_bars:
        Sizes of the in-sample (training) and out-of-sample (test) windows.
    step_bars:
        How far to advance each fold; defaults to ``test_bars`` (non-overlapping
        out-of-sample windows).
    """
    step = step_bars or test_bars
    bars: List[Bar] = list(series)
    initial_equity = float(config.get("risk", {}).get("initial_capital", 10_000.0))

    windows: List[WalkForwardWindow] = []
    all_r: List[float] = []
    all_pnl: List[float] = []
    equity_curve: List[float] = [initial_equity]
    equity = initial_equity

    fold = 0
    start = 0
    while start + train_bars + test_bars <= len(bars):
        train_slice = bars[start : start + train_bars]
        test_slice = bars[start + train_bars : start + train_bars + test_bars]
        train_series = Series(series.symbol, series.timeframe, train_slice)
        test_series = Series(series.symbol, series.timeframe, test_slice)

        optimizer = GridOptimizer(config, param_space)
        opt_result = optimizer.run(train_series)
        best = opt_result.best_params

        override: Dict[str, Any] = {}
        for dotted, value in best.items():
            _set_dotted(override, dotted, value)
        test_config = merge(config, override)

        backtester = Backtester.from_config(test_config)
        # Carry equity forward across folds for a realistic stitched curve.
        backtester.initial_equity = equity
        result = backtester.run(test_series, label=f"wf_fold_{fold}")

        for trade in result.trades:
            all_r.append(trade.r_multiple)
            all_pnl.append(trade.pnl)
            equity += trade.pnl
            equity_curve.append(equity)

        windows.append(
            WalkForwardWindow(
                fold=fold,
                in_sample_bars=len(train_slice),
                out_sample_bars=len(test_slice),
                best_params=best,
                out_metrics=result.metrics,
            )
        )
        fold += 1
        start += step

    combined = compute_metrics(all_r, all_pnl, equity_curve, initial_equity)
    return WalkForwardResult(windows=windows, combined_metrics=combined)
