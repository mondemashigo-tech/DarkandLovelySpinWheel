"""The baseline hypothesis strategy: a London-session breakout-and-retest system.

This encodes the pre-registered baseline from the Project Atlas specification:

* **GBPUSD** primary instrument.
* **London session** only (08:00–11:00 UTC).
* **Tue–Thu** only.
* **H1 trend** filter, **M15 breakout**, **M5 retest** entry.
* **1% risk** per trade, **2R** target.
* **News filter** to avoid entering around scheduled high-impact events.

The strategy is entirely config-driven — every number above comes from a YAML
file (see ``config/baseline.yaml``), never from hard-coded constants — so the
same code can express many hypotheses without edits.

Care is taken to avoid look-ahead bias: for any M5 bar the strategy only ever
consults higher-timeframe bars that have already *closed*.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional

from atlas.data.ingestion import Bar, Series, resample
from atlas.strategy.indicators import atr, donchian, ema
from atlas.strategy.signals import Signal, SignalType


def _parse_hhmm(value: str) -> time:
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes), tzinfo=timezone.utc)


@dataclass
class _PendingBreakout:
    """A breakout awaiting a retest on the lower timeframe."""

    direction: SignalType
    level: float
    expires_at: datetime
    retested: bool = False
    retest_extreme: Optional[float] = None  # lowest low (long) / highest high (short)


class BaselineStrategy:
    """Config-driven London breakout-and-retest strategy.

    Parameters
    ----------
    config:
        The parsed configuration dictionary (see ``config/baseline.yaml``).
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config
        strat = config.get("strategy", {})
        self.trend_tf: str = strat.get("trend", {}).get("timeframe", "H1")
        self.ema_period: int = int(strat.get("trend", {}).get("ema_period", 50))
        self.breakout_tf: str = strat.get("breakout", {}).get("timeframe", "M15")
        self.donchian_period: int = int(
            strat.get("breakout", {}).get("donchian_period", 20)
        )
        retest = strat.get("retest", {})
        self.retest_tolerance_atr: float = float(retest.get("tolerance_atr", 0.5))
        self.retest_atr_period: int = int(retest.get("atr_period", 14))
        self.retest_window_bars: int = int(retest.get("window_bars", 6))
        self.stop_atr_buffer: float = float(strat.get("stop_atr_buffer", 0.5))
        self.reward_to_risk: float = float(strat.get("reward_to_risk", 2.0))

        filters = config.get("filters", {})
        session = filters.get("session", {})
        self.session_start = _parse_hhmm(session.get("start", "08:00"))
        self.session_end = _parse_hhmm(session.get("end", "11:00"))
        # Weekday numbers: Monday=0 .. Sunday=6.  Default Tue,Wed,Thu.
        self.allowed_days = set(filters.get("days", [1, 2, 3]))
        self.news_blackout_minutes = int(filters.get("news_blackout_minutes", 0))
        self.news_times = self._parse_news(filters.get("news_times", []))

    # -- filter helpers -----------------------------------------------------
    @staticmethod
    def _parse_news(raw: List[str]) -> List[time]:
        parsed: List[time] = []
        for item in raw:
            parsed.append(_parse_hhmm(item))
        return parsed

    def _in_session(self, ts: datetime) -> bool:
        current = ts.timetz()
        return self.session_start <= current < self.session_end

    def _day_allowed(self, ts: datetime) -> bool:
        return ts.weekday() in self.allowed_days

    def _in_news_blackout(self, ts: datetime) -> bool:
        if not self.news_times or self.news_blackout_minutes <= 0:
            return False
        for news in self.news_times:
            event = ts.replace(
                hour=news.hour, minute=news.minute, second=0, microsecond=0
            )
            delta = abs((ts - event).total_seconds()) / 60.0
            if delta <= self.news_blackout_minutes:
                return True
        return False

    def _entry_allowed(self, ts: datetime) -> bool:
        return (
            self._in_session(ts)
            and self._day_allowed(ts)
            and not self._in_news_blackout(ts)
        )

    # -- signal generation --------------------------------------------------
    def generate_signals(self, series: Series) -> List[Signal]:
        """Produce entry signals from a base-timeframe (M5) series.

        The method internally resamples to the breakout and trend timeframes and
        walks the base series once, respecting timeframe closure to avoid
        look-ahead bias.
        """
        base_bars: List[Bar] = list(series)
        if not base_bars:
            return []

        trend = resample(series, self.trend_tf)
        breakout = resample(series, self.breakout_tf)

        trend_bars = list(trend)
        trend_ema = ema(trend.closes, self.ema_period)

        breakout_bars = list(breakout)
        upper, lower = donchian(breakout_bars, self.donchian_period)
        base_atr = atr(base_bars, self.retest_atr_period)

        trend_minutes = _timeframe_minutes(self.trend_tf)
        breakout_minutes = _timeframe_minutes(self.breakout_tf)
        base_minutes = _timeframe_minutes(series.timeframe)

        signals: List[Signal] = []
        pending: Optional[_PendingBreakout] = None

        trend_ptr = -1
        breakout_ptr = -1
        last_breakout_seen = -1

        for i, bar in enumerate(base_bars):
            ts = bar.timestamp

            # Advance higher-timeframe pointers to the latest *closed* bars.
            while (
                trend_ptr + 1 < len(trend_bars)
                and trend_bars[trend_ptr + 1].timestamp
                + timedelta(minutes=trend_minutes)
                <= ts
            ):
                trend_ptr += 1
            while (
                breakout_ptr + 1 < len(breakout_bars)
                and breakout_bars[breakout_ptr + 1].timestamp
                + timedelta(minutes=breakout_minutes)
                <= ts
            ):
                breakout_ptr += 1

            # Detect a fresh breakout when a new breakout bar has closed.
            if breakout_ptr >= 0 and breakout_ptr != last_breakout_seen:
                last_breakout_seen = breakout_ptr
                pending = self._detect_breakout(
                    breakout_bars,
                    breakout_ptr,
                    upper,
                    lower,
                    trend_bars,
                    trend_ema,
                    trend_ptr,
                    ts,
                    breakout_minutes,
                )

            if pending is None:
                continue
            if ts >= pending.expires_at:
                pending = None
                continue

            atr_value = base_atr[i]
            signal = self._evaluate_retest(bar, pending, atr_value)
            if signal is not None and self._entry_allowed(ts):
                signals.append(signal)
                pending = None

        return signals

    def _detect_breakout(
        self,
        breakout_bars: List[Bar],
        idx: int,
        upper: List[Optional[float]],
        lower: List[Optional[float]],
        trend_bars: List[Bar],
        trend_ema: List[Optional[float]],
        trend_ptr: int,
        now: datetime,
        breakout_minutes: int,
    ) -> Optional[_PendingBreakout]:
        up = upper[idx]
        low = lower[idx]
        if up is None or low is None:
            return None
        if trend_ptr < 0:
            return None
        ema_value = trend_ema[trend_ptr]
        if ema_value is None:
            return None
        trend_close = trend_bars[trend_ptr].close
        bar = breakout_bars[idx]
        expiry = now + timedelta(
            minutes=breakout_minutes * self.retest_window_bars
        )
        # Bullish breakout: closes above prior range *and* higher-TF uptrend.
        if bar.close > up and trend_close > ema_value:
            return _PendingBreakout(SignalType.LONG, up, expiry)
        # Bearish breakout: closes below prior range *and* higher-TF downtrend.
        if bar.close < low and trend_close < ema_value:
            return _PendingBreakout(SignalType.SHORT, low, expiry)
        return None

    def _evaluate_retest(
        self,
        bar: Bar,
        pending: _PendingBreakout,
        atr_value: Optional[float],
    ) -> Optional[Signal]:
        if atr_value is None or atr_value <= 0:
            return None
        tolerance = atr_value * self.retest_tolerance_atr
        buffer = atr_value * self.stop_atr_buffer

        if pending.direction is SignalType.LONG:
            # First the price must pull back to (retest) the breakout level.
            if not pending.retested:
                if bar.low <= pending.level + tolerance:
                    pending.retested = True
                    pending.retest_extreme = bar.low
                return None
            pending.retest_extreme = min(
                pending.retest_extreme if pending.retest_extreme is not None else bar.low,
                bar.low,
            )
            # Entry when price resumes and closes back above the level.
            if bar.close > pending.level:
                entry = bar.close
                stop = min(pending.retest_extreme, pending.level) - buffer
                if stop >= entry:
                    return None
                target = entry + (entry - stop) * self.reward_to_risk
                return Signal(
                    timestamp=bar.timestamp,
                    signal_type=SignalType.LONG,
                    entry=entry,
                    stop=stop,
                    target=target,
                    reason="London H1-uptrend M15-breakout M5-retest",
                    meta={"level": pending.level, "atr": atr_value},
                )
            return None

        # SHORT
        if not pending.retested:
            if bar.high >= pending.level - tolerance:
                pending.retested = True
                pending.retest_extreme = bar.high
            return None
        pending.retest_extreme = max(
            pending.retest_extreme if pending.retest_extreme is not None else bar.high,
            bar.high,
        )
        if bar.close < pending.level:
            entry = bar.close
            stop = max(pending.retest_extreme, pending.level) + buffer
            if stop <= entry:
                return None
            target = entry - (stop - entry) * self.reward_to_risk
            return Signal(
                timestamp=bar.timestamp,
                signal_type=SignalType.SHORT,
                entry=entry,
                stop=stop,
                target=target,
                reason="London H1-downtrend M15-breakout M5-retest",
                meta={"level": pending.level, "atr": atr_value},
            )
        return None


def _timeframe_minutes(timeframe: str) -> int:
    from atlas.data.ingestion import TIMEFRAME_MINUTES

    return TIMEFRAME_MINUTES[timeframe]


def build_strategy(config: Dict[str, Any]) -> BaselineStrategy:
    """Factory that returns a strategy instance for a config.

    Currently Atlas ships a single strategy family (the baseline breakout), but
    routing through a factory keeps the door open for a ``strategy.type`` field
    selecting alternative rule sets in future hypotheses.
    """
    return BaselineStrategy(config)
