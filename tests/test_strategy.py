"""Tests for the baseline strategy and its filters."""

import unittest
from datetime import datetime, timezone

from atlas.data.ingestion import generate_synthetic
from atlas.strategy.baseline import BaselineStrategy, build_strategy
from atlas.strategy.signals import SignalType

BASE_CONFIG = {
    "name": "test",
    "symbol": "GBPUSD",
    "base_timeframe": "M5",
    "strategy": {
        "trend": {"timeframe": "H1", "ema_period": 50},
        "breakout": {"timeframe": "M15", "donchian_period": 20},
        "retest": {"atr_period": 14, "tolerance_atr": 0.6, "window_bars": 8},
        "stop_atr_buffer": 0.5,
        "reward_to_risk": 2.0,
    },
    "filters": {
        "session": {"start": "08:00", "end": "11:00"},
        "days": [1, 2, 3],
        "news_blackout_minutes": 15,
        "news_times": ["09:30"],
    },
}


class FilterTests(unittest.TestCase):
    def setUp(self):
        self.strat = BaselineStrategy(BASE_CONFIG)

    def test_session_filter(self):
        inside = datetime(2022, 1, 4, 9, 0, tzinfo=timezone.utc)   # Tue 09:00
        outside = datetime(2022, 1, 4, 12, 0, tzinfo=timezone.utc)  # Tue 12:00
        self.assertTrue(self.strat._in_session(inside))
        self.assertFalse(self.strat._in_session(outside))

    def test_day_filter(self):
        monday = datetime(2022, 1, 3, 9, 0, tzinfo=timezone.utc)
        tuesday = datetime(2022, 1, 4, 9, 0, tzinfo=timezone.utc)
        self.assertFalse(self.strat._day_allowed(monday))
        self.assertTrue(self.strat._day_allowed(tuesday))

    def test_news_blackout(self):
        near_news = datetime(2022, 1, 4, 9, 35, tzinfo=timezone.utc)  # within 15m of 09:30
        clear = datetime(2022, 1, 4, 10, 30, tzinfo=timezone.utc)
        self.assertTrue(self.strat._in_news_blackout(near_news))
        self.assertFalse(self.strat._in_news_blackout(clear))

    def test_entry_allowed_combines_filters(self):
        good = datetime(2022, 1, 4, 10, 0, tzinfo=timezone.utc)  # Tue, session, no news
        self.assertTrue(self.strat._entry_allowed(good))
        weekend = datetime(2022, 1, 1, 10, 0, tzinfo=timezone.utc)  # Saturday
        self.assertFalse(self.strat._entry_allowed(weekend))


class SignalGenerationTests(unittest.TestCase):
    def test_generates_signals_on_synthetic_data(self):
        series = generate_synthetic(bars=20000, seed=42)
        signals = build_strategy(BASE_CONFIG).generate_signals(series)
        self.assertGreater(len(signals), 0)

    def test_all_signals_respect_filters(self):
        series = generate_synthetic(bars=20000, seed=42)
        signals = build_strategy(BASE_CONFIG).generate_signals(series)
        for sig in signals:
            ts = sig.timestamp
            self.assertIn(ts.weekday(), {1, 2, 3})
            self.assertTrue(8 <= ts.hour < 11)

    def test_signals_are_well_formed(self):
        series = generate_synthetic(bars=20000, seed=42)
        signals = build_strategy(BASE_CONFIG).generate_signals(series)
        for sig in signals:
            if sig.signal_type is SignalType.LONG:
                self.assertLess(sig.stop, sig.entry)
                self.assertLess(sig.entry, sig.target)
            else:
                self.assertLess(sig.target, sig.entry)
                self.assertLess(sig.entry, sig.stop)
            self.assertAlmostEqual(sig.reward_to_risk, 2.0, places=1)

    def test_empty_series_yields_no_signals(self):
        from atlas.data.ingestion import Series

        empty = Series("X", "M5", [])
        self.assertEqual(build_strategy(BASE_CONFIG).generate_signals(empty), [])


if __name__ == "__main__":
    unittest.main()
