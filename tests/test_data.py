"""Tests for the data layer: bars, series, resampling and synthetic data."""

import unittest
from datetime import datetime, timezone

from atlas.data.ingestion import (
    Bar,
    Series,
    generate_synthetic,
    load_csv,
    resample,
    save_csv,
)
from tests.helpers import make_series


class BarTests(unittest.TestCase):
    def test_range_and_direction(self):
        bar = Bar(datetime(2022, 1, 1, tzinfo=timezone.utc), 1.0, 1.2, 0.9, 1.1)
        self.assertAlmostEqual(bar.range, 0.3)
        self.assertTrue(bar.is_bullish)

    def test_invalid_high_low_rejected(self):
        with self.assertRaises(ValueError):
            Bar(datetime(2022, 1, 1, tzinfo=timezone.utc), 1.0, 0.5, 0.9, 1.0)


class SeriesTests(unittest.TestCase):
    def test_requires_monotonic_time(self):
        ts = datetime(2022, 1, 1, tzinfo=timezone.utc)
        a = Bar(ts, 1, 1, 1, 1)
        b = Bar(ts, 1, 1, 1, 1)  # same timestamp -> not strictly increasing
        with self.assertRaises(ValueError):
            Series("X", "M5", [a, b])

    def test_split_is_chronological(self):
        s = make_series([1.0 + i * 0.001 for i in range(100)])
        in_s, out_s = s.split(0.7)
        self.assertEqual(len(in_s), 70)
        self.assertEqual(len(out_s), 30)
        self.assertLess(in_s[-1].timestamp, out_s[0].timestamp)

    def test_split_rejects_bad_fraction(self):
        s = make_series([1.0, 1.1, 1.2])
        with self.assertRaises(ValueError):
            s.split(1.5)


class ResampleTests(unittest.TestCase):
    def test_m5_to_m15_aggregates_three_bars(self):
        # 6 M5 bars -> 2 M15 bars.
        s = make_series([1.0, 1.1, 1.2, 1.3, 1.4, 1.5], timeframe="M5")
        r = resample(s, "M15")
        self.assertEqual(len(r), 2)
        # First M15 bar spans the first three M5 bars.
        self.assertAlmostEqual(r[0].open, s[0].open)
        self.assertAlmostEqual(r[0].close, s[2].close)
        self.assertAlmostEqual(r[0].high, max(b.high for b in list(s)[:3]))
        self.assertAlmostEqual(r[0].low, min(b.low for b in list(s)[:3]))

    def test_cannot_resample_finer(self):
        s = make_series([1.0, 1.1], timeframe="M15")
        with self.assertRaises(ValueError):
            resample(s, "M5")


class SyntheticTests(unittest.TestCase):
    def test_is_reproducible(self):
        a = generate_synthetic(bars=500, seed=123)
        b = generate_synthetic(bars=500, seed=123)
        self.assertEqual(a.closes, b.closes)

    def test_different_seed_differs(self):
        a = generate_synthetic(bars=500, seed=1)
        b = generate_synthetic(bars=500, seed=2)
        self.assertNotEqual(a.closes, b.closes)

    def test_skips_weekends(self):
        s = generate_synthetic(bars=2000, seed=5)
        self.assertTrue(all(bar.timestamp.weekday() < 5 for bar in s))

    def test_roundtrip_csv(self):
        import tempfile
        import os

        s = generate_synthetic(bars=200, seed=9)
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "data.csv")
            save_csv(s, path)
            loaded = load_csv(path, s.symbol, s.timeframe)
        self.assertEqual(len(loaded), len(s))
        self.assertAlmostEqual(loaded[0].close, s[0].close, places=5)


if __name__ == "__main__":
    unittest.main()
