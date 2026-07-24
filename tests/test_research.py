"""Tests for the research tools: optimiser, walk-forward and Monte Carlo."""

import unittest

from atlas.data.ingestion import generate_synthetic
from atlas.research.monte_carlo import monte_carlo
from atlas.research.optimizer import GridOptimizer, _set_dotted
from atlas.research.walk_forward import walk_forward
from tests.test_strategy import BASE_CONFIG


class DottedSetTests(unittest.TestCase):
    def test_sets_nested_key(self):
        target = {}
        _set_dotted(target, "a.b.c", 5)
        self.assertEqual(target, {"a": {"b": {"c": 5}}})


class OptimizerTests(unittest.TestCase):
    def test_ranks_by_profit_factor(self):
        series = generate_synthetic(bars=15000, seed=42)
        space = {
            "strategy.breakout.donchian_period": [15, 20],
            "strategy.reward_to_risk": [1.5, 2.0],
        }
        result = GridOptimizer(BASE_CONFIG, space).run(series)
        self.assertEqual(len(result.ranked), 4)
        pfs = [m.profit_factor for _, m in result.ranked]
        # Ranked descending (inf treated as large by scorer).
        finite = [p for p in pfs if p != float("inf")]
        self.assertEqual(finite, sorted(finite, reverse=True))
        self.assertIn("strategy.breakout.donchian_period", result.best_params)


class WalkForwardTests(unittest.TestCase):
    def test_produces_out_of_sample_folds(self):
        series = generate_synthetic(bars=20000, seed=42)
        space = {"strategy.reward_to_risk": [1.5, 2.0]}
        result = walk_forward(BASE_CONFIG, series, space, train_bars=6000, test_bars=3000)
        self.assertGreater(len(result.windows), 0)
        # Every fold trains and tests on the configured window sizes.
        for window in result.windows:
            self.assertEqual(window.in_sample_bars, 6000)
            self.assertEqual(window.out_sample_bars, 3000)


class MonteCarloTests(unittest.TestCase):
    def test_all_winners_never_ruin(self):
        rs = [1.0] * 100
        mc = monte_carlo(rs, initial_equity=10_000, risk_per_trade=0.01, simulations=200)
        self.assertEqual(mc.prob_ruin, 0.0)
        self.assertEqual(mc.prob_profit, 1.0)
        self.assertGreater(mc.final_equity_p50, 10_000)

    def test_reproducible_with_seed(self):
        rs = [1.0, -1.0, 2.0, -1.0, 1.5]
        a = monte_carlo(rs, simulations=100, seed=1)
        b = monte_carlo(rs, simulations=100, seed=1)
        self.assertEqual(a.final_equity_p50, b.final_equity_p50)

    def test_percentiles_ordered(self):
        rs = [1.0, -1.0, 2.0, -1.0, 1.5, -0.5]
        mc = monte_carlo(rs, simulations=300, seed=3)
        self.assertLessEqual(mc.final_equity_p5, mc.final_equity_p50)
        self.assertLessEqual(mc.final_equity_p50, mc.final_equity_p95)

    def test_empty_trades(self):
        mc = monte_carlo([], initial_equity=5000)
        self.assertEqual(mc.final_equity_p50, 5000)


if __name__ == "__main__":
    unittest.main()
