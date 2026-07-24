"""Tests for the technical indicators."""

import unittest

from atlas.strategy.indicators import (
    atr,
    donchian,
    ema,
    rolling_high,
    rolling_low,
    sma,
    true_range,
)
from tests.helpers import make_series


class MovingAverageTests(unittest.TestCase):
    def test_sma_warmup_and_value(self):
        values = [1.0, 2.0, 3.0, 4.0, 5.0]
        result = sma(values, 3)
        self.assertIsNone(result[0])
        self.assertIsNone(result[1])
        self.assertAlmostEqual(result[2], 2.0)
        self.assertAlmostEqual(result[3], 3.0)
        self.assertAlmostEqual(result[4], 4.0)

    def test_ema_matches_manual(self):
        values = [1.0, 2.0, 3.0, 4.0, 5.0]
        result = ema(values, 3)
        # Seed is SMA of first 3 = 2.0; alpha = 0.5.
        self.assertAlmostEqual(result[2], 2.0)
        self.assertAlmostEqual(result[3], 0.5 * 4 + 0.5 * 2.0)  # 3.0
        self.assertAlmostEqual(result[4], 0.5 * 5 + 0.5 * 3.0)  # 4.0

    def test_ema_short_series(self):
        self.assertEqual(ema([1.0, 2.0], 5), [None, None])


class RangeTests(unittest.TestCase):
    def test_rolling_high_low(self):
        values = [3.0, 1.0, 4.0, 1.0, 5.0]
        self.assertEqual(rolling_high(values, 2), [None, 3.0, 4.0, 4.0, 5.0])
        self.assertEqual(rolling_low(values, 2), [None, 1.0, 1.0, 1.0, 1.0])

    def test_atr_positive_after_warmup(self):
        s = make_series([1.0 + 0.01 * i for i in range(30)])
        result = atr(list(s), 14)
        tail = [x for x in result if x is not None]
        self.assertTrue(tail)
        self.assertTrue(all(x > 0 for x in tail))

    def test_donchian_excludes_current_bar(self):
        s = make_series([1.0, 2.0, 3.0, 4.0, 5.0])
        upper, lower = donchian(list(s), 2)
        # At index 2 the channel uses bars 0 and 1 only.
        bars = list(s)
        self.assertAlmostEqual(upper[2], max(bars[0].high, bars[1].high))
        self.assertAlmostEqual(lower[2], min(bars[0].low, bars[1].low))


if __name__ == "__main__":
    unittest.main()
