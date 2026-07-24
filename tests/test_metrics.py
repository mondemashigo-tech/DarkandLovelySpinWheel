"""Tests for performance metrics."""

import math
import unittest

from atlas.backtest.metrics import compute_metrics, max_drawdown


class DrawdownTests(unittest.TestCase):
    def test_no_drawdown_on_monotonic_curve(self):
        self.assertEqual(max_drawdown([100, 110, 120]), 0.0)

    def test_drawdown_fraction(self):
        # Peak 120 -> trough 90 = 25% drawdown.
        self.assertAlmostEqual(max_drawdown([100, 120, 90, 130]), 0.25)


class MetricsTests(unittest.TestCase):
    def test_empty(self):
        m = compute_metrics([], [], [1000], 1000)
        self.assertEqual(m.n_trades, 0)
        self.assertEqual(m.final_equity, 1000)

    def test_profit_factor_and_expectancy(self):
        # Two winners of +200, one loser of -100.
        pnls = [200.0, 200.0, -100.0]
        rs = [2.0, 2.0, -1.0]
        curve = [1000, 1200, 1400, 1300]
        m = compute_metrics(rs, pnls, curve, 1000)
        self.assertEqual(m.n_trades, 3)
        self.assertAlmostEqual(m.gross_profit, 400.0)
        self.assertAlmostEqual(m.gross_loss, 100.0)
        self.assertAlmostEqual(m.profit_factor, 4.0)
        self.assertAlmostEqual(m.expectancy, 100.0)
        self.assertAlmostEqual(m.expectancy_r, 1.0)
        self.assertAlmostEqual(m.win_rate, 2 / 3)
        self.assertAlmostEqual(m.total_return, 0.30)

    def test_infinite_profit_factor_when_no_losses(self):
        m = compute_metrics([1.0, 1.0], [50.0, 50.0], [1000, 1050, 1100], 1000)
        self.assertTrue(math.isinf(m.profit_factor))


if __name__ == "__main__":
    unittest.main()
