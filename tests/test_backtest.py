"""Tests for the backtest engine using a hand-crafted deterministic strategy."""

import unittest
from datetime import datetime, timezone
from typing import List

from atlas.backtest.engine import Backtester
from atlas.risk.manager import RiskManager
from atlas.strategy.signals import Signal, SignalType
from tests.helpers import make_series


class _FixedSignalStrategy:
    """A stub strategy that emits pre-baked signals at given bar indices."""

    def __init__(self, signals: List[Signal]):
        self._signals = signals

    def generate_signals(self, series):  # noqa: D401 - stub
        return self._signals


class BacktestEngineTests(unittest.TestCase):
    def _backtester(self, strategy):
        return Backtester(
            strategy=strategy,
            risk_manager=RiskManager(risk_per_trade=0.01),
            initial_equity=10_000.0,
            spread=0.0,
            commission=0.0,
            max_holding_bars=50,
        )

    def test_target_hit_produces_winner(self):
        # Rising prices: a long targeting +2R should hit target.
        closes = [1.0 + 0.001 * i for i in range(60)]
        series = make_series(closes)
        entry_bar = series[0]
        sig = Signal(
            timestamp=entry_bar.timestamp,
            signal_type=SignalType.LONG,
            entry=entry_bar.close,
            stop=entry_bar.close - 0.005,
            target=entry_bar.close + 0.010,
        )
        result = self._backtester(_FixedSignalStrategy([sig])).run(series)
        self.assertEqual(len(result.trades), 1)
        trade = result.trades[0]
        self.assertEqual(trade.exit_reason, "target")
        self.assertGreater(trade.pnl, 0)
        self.assertAlmostEqual(trade.r_multiple, 2.0, places=1)

    def test_stop_hit_produces_loser(self):
        # Falling prices: a long should get stopped out for -1R.
        closes = [1.0 - 0.001 * i for i in range(60)]
        series = make_series(closes)
        entry_bar = series[0]
        sig = Signal(
            timestamp=entry_bar.timestamp,
            signal_type=SignalType.LONG,
            entry=entry_bar.close,
            stop=entry_bar.close - 0.005,
            target=entry_bar.close + 0.010,
        )
        result = self._backtester(_FixedSignalStrategy([sig])).run(series)
        self.assertEqual(len(result.trades), 1)
        trade = result.trades[0]
        self.assertEqual(trade.exit_reason, "stop")
        self.assertLess(trade.pnl, 0)
        self.assertAlmostEqual(trade.r_multiple, -1.0, places=1)

    def test_no_overlapping_trades(self):
        # Two signals on adjacent bars; the second falls inside the first's
        # holding window and must be skipped.
        closes = [1.0 + 0.001 * i for i in range(60)]
        series = make_series(closes)
        b0, b1 = series[0], series[1]
        sig0 = Signal(b0.timestamp, SignalType.LONG, b0.close, b0.close - 0.005, b0.close + 0.010)
        sig1 = Signal(b1.timestamp, SignalType.LONG, b1.close, b1.close - 0.005, b1.close + 0.010)
        result = self._backtester(_FixedSignalStrategy([sig0, sig1])).run(series)
        # Only one trade should be taken because they overlap.
        self.assertEqual(len(result.trades), 1)

    def test_equity_curve_tracks_pnl(self):
        closes = [1.0 + 0.001 * i for i in range(60)]
        series = make_series(closes)
        b0 = series[0]
        sig = Signal(b0.timestamp, SignalType.LONG, b0.close, b0.close - 0.005, b0.close + 0.010)
        result = self._backtester(_FixedSignalStrategy([sig])).run(series)
        self.assertAlmostEqual(
            result.equity_curve[-1], result.initial_equity + result.trades[0].pnl
        )


if __name__ == "__main__":
    unittest.main()
