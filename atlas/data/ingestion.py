"""OHLCV data ingestion, storage and resampling.

Atlas represents market data as an immutable list of :class:`Bar` objects wrapped
in a :class:`Series`.  Everything downstream — the rule engine, the backtester,
the research tools — consumes :class:`Series` objects, so any data source only
needs to produce one of these.

The module deliberately avoids pandas/numpy: a :class:`Bar` is a small typed
container and a :class:`Series` is a thin, typed wrapper over a list.  This keeps
Atlas reproducible on a bare Python install.
"""

from __future__ import annotations

import csv
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Sequence

# Canonical timeframe -> minutes mapping used throughout Atlas.
TIMEFRAME_MINUTES: Dict[str, int] = {
    "M1": 1,
    "M5": 5,
    "M15": 15,
    "M30": 30,
    "H1": 60,
    "H4": 240,
    "D1": 1440,
}


@dataclass(frozen=True)
class Bar:
    """A single OHLCV candle.

    Attributes
    ----------
    timestamp:
        Timezone-aware UTC timestamp marking the *open* of the bar.
    open, high, low, close:
        Prices for the bar.
    volume:
        Traded volume (synthetic data uses tick-count as a proxy).
    """

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

    def __post_init__(self) -> None:
        if self.high < self.low:
            raise ValueError(
                f"Bar high ({self.high}) is below low ({self.low}) at {self.timestamp}"
            )

    @property
    def range(self) -> float:
        """High-minus-low, the bar's full range."""
        return self.high - self.low

    @property
    def is_bullish(self) -> bool:
        return self.close >= self.open


class Series:
    """An ordered, immutable collection of :class:`Bar` objects.

    Bars are validated to be strictly increasing in time on construction so that
    downstream code can rely on chronological order.
    """

    def __init__(self, symbol: str, timeframe: str, bars: Sequence[Bar]) -> None:
        if timeframe not in TIMEFRAME_MINUTES:
            raise ValueError(f"Unknown timeframe: {timeframe!r}")
        ordered = list(bars)
        for previous, current in zip(ordered, ordered[1:]):
            if current.timestamp <= previous.timestamp:
                raise ValueError(
                    "Bars must be strictly increasing in time; "
                    f"{current.timestamp} follows {previous.timestamp}"
                )
        self.symbol = symbol
        self.timeframe = timeframe
        self._bars: List[Bar] = ordered

    # -- container protocol -------------------------------------------------
    def __len__(self) -> int:
        return len(self._bars)

    def __iter__(self) -> Iterator[Bar]:
        return iter(self._bars)

    def __getitem__(self, index):  # type: ignore[override]
        if isinstance(index, slice):
            return Series(self.symbol, self.timeframe, self._bars[index])
        return self._bars[index]

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        span = ""
        if self._bars:
            span = f" {self._bars[0].timestamp:%Y-%m-%d}..{self._bars[-1].timestamp:%Y-%m-%d}"
        return f"<Series {self.symbol} {self.timeframe} n={len(self)}{span}>"

    # -- convenience --------------------------------------------------------
    @property
    def closes(self) -> List[float]:
        return [bar.close for bar in self._bars]

    @property
    def timestamps(self) -> List[datetime]:
        return [bar.timestamp for bar in self._bars]

    def split(self, fraction: float) -> tuple["Series", "Series"]:
        """Split chronologically into ``(in_sample, out_of_sample)``.

        ``fraction`` is the proportion of bars assigned to the in-sample set.
        A clean chronological split is the backbone of honest hypothesis
        testing — the out-of-sample tail is never touched during development.
        """
        if not 0.0 < fraction < 1.0:
            raise ValueError("fraction must be strictly between 0 and 1")
        cut = int(len(self._bars) * fraction)
        return (
            Series(self.symbol, self.timeframe, self._bars[:cut]),
            Series(self.symbol, self.timeframe, self._bars[cut:]),
        )


def _parse_timestamp(raw: str) -> datetime:
    """Parse an ISO-8601 timestamp, defaulting naive values to UTC."""
    text = raw.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def load_csv(path: str | Path, symbol: str, timeframe: str) -> Series:
    """Load a CSV of ``timestamp,open,high,low,close,volume`` rows.

    A header row is optional and auto-detected.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Data file not found: {path}")
    bars: List[Bar] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        for row in reader:
            if not row or len(row) < 5:
                continue
            if row[0].strip().lower() in {"timestamp", "time", "date"}:
                continue  # header
            volume = float(row[5]) if len(row) > 5 and row[5] != "" else 0.0
            bars.append(
                Bar(
                    timestamp=_parse_timestamp(row[0]),
                    open=float(row[1]),
                    high=float(row[2]),
                    low=float(row[3]),
                    close=float(row[4]),
                    volume=volume,
                )
            )
    return Series(symbol, timeframe, bars)


def save_csv(series: Series, path: str | Path) -> Path:
    """Write a :class:`Series` to a CSV file, creating parent dirs as needed."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["timestamp", "open", "high", "low", "close", "volume"])
        for bar in series:
            writer.writerow(
                [
                    bar.timestamp.strftime("%Y-%m-%dT%H:%M:%S%z"),
                    f"{bar.open:.6f}",
                    f"{bar.high:.6f}",
                    f"{bar.low:.6f}",
                    f"{bar.close:.6f}",
                    f"{bar.volume:.2f}",
                ]
            )
    return path


def resample(series: Series, target_timeframe: str) -> Series:
    """Aggregate ``series`` up to a coarser ``target_timeframe``.

    For example, resample an M5 series to H1.  The target timeframe must be an
    integer multiple of the source timeframe and be strictly coarser.
    """
    source_minutes = TIMEFRAME_MINUTES[series.timeframe]
    target_minutes = TIMEFRAME_MINUTES[target_timeframe]
    if target_minutes < source_minutes:
        raise ValueError("Cannot resample to a finer timeframe")
    if target_minutes % source_minutes != 0:
        raise ValueError(
            f"{target_timeframe} is not a multiple of {series.timeframe}"
        )
    if target_minutes == source_minutes:
        return Series(series.symbol, target_timeframe, list(series))

    bucket_delta = timedelta(minutes=target_minutes)
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    aggregated: List[Bar] = []
    current_key: int | None = None
    o = h = l = c = v = 0.0
    open_ts: datetime | None = None

    def _bucket_key(ts: datetime) -> int:
        seconds = (ts - epoch).total_seconds()
        return int(seconds // bucket_delta.total_seconds())

    for bar in series:
        key = _bucket_key(bar.timestamp)
        if key != current_key:
            if current_key is not None and open_ts is not None:
                aggregated.append(Bar(open_ts, o, h, l, c, v))
            current_key = key
            open_ts = epoch + timedelta(seconds=key * bucket_delta.total_seconds())
            o, h, l, c, v = bar.open, bar.high, bar.low, bar.close, bar.volume
        else:
            h = max(h, bar.high)
            l = min(l, bar.low)
            c = bar.close
            v += bar.volume
    if current_key is not None and open_ts is not None:
        aggregated.append(Bar(open_ts, o, h, l, c, v))
    return Series(series.symbol, target_timeframe, aggregated)


def generate_synthetic(
    symbol: str = "GBPUSD",
    timeframe: str = "M5",
    start: datetime | None = None,
    bars: int = 5000,
    start_price: float = 1.2700,
    seed: int = 42,
    annual_drift: float = 0.0,
    annual_volatility: float = 0.08,
    session_bias: bool = True,
) -> Series:
    """Generate reproducible synthetic OHLCV data via a seeded random walk.

    Synthetic data lets the platform be exercised end-to-end with zero external
    dependencies.  Because the generator is seeded it is fully reproducible — the
    same ``seed`` always yields the same series.

    Parameters
    ----------
    session_bias:
        When ``True`` the London session (08:00–11:00 UTC) is given slightly
        higher volatility and a mild intraday trend, so that session-based
        strategies have something realistic to detect.
    """
    if start is None:
        start = datetime(2021, 1, 4, 0, 0, tzinfo=timezone.utc)
    rng = random.Random(seed)
    minutes = TIMEFRAME_MINUTES[timeframe]
    bars_per_year = (365 * 24 * 60) / minutes
    drift_per_bar = annual_drift / bars_per_year
    vol_per_bar = annual_volatility / math.sqrt(bars_per_year)

    out: List[Bar] = []
    price = start_price
    ts = start
    session_trend = 0.0
    while len(out) < bars:
        # Skip weekends — the FX market is closed Saturday/Sunday.
        if ts.weekday() >= 5:
            ts += timedelta(minutes=minutes)
            continue

        vol = vol_per_bar
        drift = drift_per_bar
        if session_bias and 8 <= ts.hour < 11:
            vol *= 1.6
            if ts.hour == 8 and ts.minute == 0:
                # Pick a fresh directional bias for each London session.
                session_trend = rng.choice([-1.0, 1.0]) * vol_per_bar * 0.9
            drift += session_trend
        elif session_bias:
            vol *= 0.7

        shock = rng.gauss(0.0, 1.0)
        ret = drift + vol * shock
        new_price = price * (1.0 + ret)

        wick = abs(rng.gauss(0.0, 1.0)) * vol * price * 0.6
        o = price
        c = new_price
        high = max(o, c) + wick
        low = min(o, c) - wick
        volume = round(100 + abs(shock) * 50 + (60 if 8 <= ts.hour < 11 else 0), 2)

        out.append(Bar(ts, round(o, 6), round(high, 6), round(low, 6), round(c, 6), volume))
        price = new_price
        ts += timedelta(minutes=minutes)

    return Series(symbol, timeframe, out)


def date_range(series: Series) -> tuple[datetime, datetime] | None:
    """Return ``(first_timestamp, last_timestamp)`` or ``None`` if empty."""
    if len(series) == 0:
        return None
    return series[0].timestamp, series[len(series) - 1].timestamp


def iter_windows(bars: Sequence[Bar], size: int) -> Iterable[List[Bar]]:
    """Yield successive overlapping windows of ``size`` bars (helper for tests)."""
    for i in range(len(bars) - size + 1):
        yield list(bars[i : i + size])
