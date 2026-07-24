"""Tests for signals and the risk manager."""

import unittest
from datetime import datetime, timezone

from atlas.risk.manager import RiskManager
from atlas.strategy.signals import Signal, SignalType


def _ts():
    return datetime(2022, 1, 4, 9, 0, tzinfo=timezone.utc)


class SignalTests(unittest.TestCase):
    def test_long_ordering_enforced(self):
        with self.assertRaises(ValueError):
            Signal(_ts(), SignalType.LONG, entry=1.0, stop=1.1, target=1.2)

    def test_short_ordering_enforced(self):
        with self.assertRaises(ValueError):
            Signal(_ts(), SignalType.SHORT, entry=1.0, stop=0.9, target=1.2)

    def test_risk_and_reward(self):
        sig = Signal(_ts(), SignalType.LONG, entry=1.10, stop=1.08, target=1.14)
        self.assertAlmostEqual(sig.risk_per_r, 0.02)
        self.assertAlmostEqual(sig.reward_to_risk, 2.0)


class RiskManagerTests(unittest.TestCase):
    def test_sizes_to_fixed_fraction(self):
        rm = RiskManager(risk_per_trade=0.01)
        sig = Signal(_ts(), SignalType.LONG, entry=1.10, stop=1.08, target=1.14)
        pos = rm.size(equity=10_000, signal=sig)
        # Risk 1% of 10k = 100; risk per unit = 0.02 -> size 5000.
        self.assertAlmostEqual(pos.risk_amount, 100.0)
        self.assertAlmostEqual(pos.size, 5000.0)

    def test_rejects_bad_risk_fraction(self):
        with self.assertRaises(ValueError):
            RiskManager(risk_per_trade=1.5)

    def test_notional_cap_applies(self):
        rm = RiskManager(risk_per_trade=0.01, max_position_fraction=1.0)
        # Very tight stop would otherwise produce an enormous position.
        sig = Signal(_ts(), SignalType.LONG, entry=1.10, stop=1.0999, target=1.11)
        pos = rm.size(equity=10_000, signal=sig)
        self.assertLessEqual(pos.size * sig.entry, 10_000 * 1.0 + 1e-6)


if __name__ == "__main__":
    unittest.main()
