"""Shared test helpers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from atlas.data.ingestion import Bar, Series


def make_series(
    closes: List[float],
    symbol: str = "TEST",
    timeframe: str = "M5",
    start: datetime | None = None,
    spread: float = 0.0005,
) -> Series:
    """Build a :class:`Series` from a list of close prices.

    Each bar's high/low straddle the open/close by ``spread`` so the bars are
    well-formed.
    """
    if start is None:
        start = datetime(2022, 1, 4, 8, 0, tzinfo=timezone.utc)  # a Tuesday, London
    minutes = {"M1": 1, "M5": 5, "M15": 15, "H1": 60}[timeframe]
    bars: List[Bar] = []
    prev = closes[0]
    ts = start
    for close in closes:
        o = prev
        c = close
        high = max(o, c) + spread
        low = min(o, c) - spread
        bars.append(Bar(ts, o, high, low, c, 100.0))
        prev = close
        ts += timedelta(minutes=minutes)
    return Series(symbol, timeframe, bars)
