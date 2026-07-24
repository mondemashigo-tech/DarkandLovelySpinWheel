"""CSV report writers for trades and metrics."""

from __future__ import annotations

import csv
from pathlib import Path

from atlas.backtest.engine import BacktestResult
from atlas.backtest.metrics import Metrics


def write_trades_csv(result: BacktestResult, path: str | Path) -> Path:
    """Write one row per trade to ``path``."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "entry_time",
        "exit_time",
        "direction",
        "entry",
        "exit",
        "stop",
        "target",
        "size",
        "pnl",
        "r_multiple",
        "return_pct",
        "exit_reason",
        "reason",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for trade in result.trades:
            writer.writerow(trade.as_dict())
    return path


def write_metrics_csv(metrics: Metrics, path: str | Path) -> Path:
    """Write a two-column ``metric,value`` CSV of all metrics."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["metric", "value"])
        for key, value in metrics.as_dict().items():
            writer.writerow([key, value])
    return path
