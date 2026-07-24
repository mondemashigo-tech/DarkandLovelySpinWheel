"""Pure-Python technical indicators.

Each function takes plain sequences (or :class:`~atlas.data.ingestion.Bar`
lists) and returns lists aligned to the input, using ``None`` for the warm-up
period where an indicator is not yet defined.  Keeping indicators
dependency-free and side-effect-free makes them trivial to unit-test.
"""

from __future__ import annotations

from typing import List, Optional, Sequence

from atlas.data.ingestion import Bar


def sma(values: Sequence[float], period: int) -> List[Optional[float]]:
    """Simple moving average."""
    if period <= 0:
        raise ValueError("period must be positive")
    out: List[Optional[float]] = []
    running = 0.0
    window: List[float] = []
    for value in values:
        window.append(value)
        running += value
        if len(window) > period:
            running -= window.pop(0)
        out.append(running / period if len(window) == period else None)
    return out


def ema(values: Sequence[float], period: int) -> List[Optional[float]]:
    """Exponential moving average, seeded with the first SMA value."""
    if period <= 0:
        raise ValueError("period must be positive")
    out: List[Optional[float]] = [None] * len(values)
    if len(values) < period:
        return out
    alpha = 2.0 / (period + 1.0)
    seed = sum(values[:period]) / period
    out[period - 1] = seed
    prev = seed
    for i in range(period, len(values)):
        prev = alpha * values[i] + (1.0 - alpha) * prev
        out[i] = prev
    return out


def true_range(bars: Sequence[Bar]) -> List[Optional[float]]:
    """Wilder's true range for each bar (first bar is ``None``)."""
    out: List[Optional[float]] = []
    prev_close: Optional[float] = None
    for bar in bars:
        if prev_close is None:
            out.append(None)
        else:
            out.append(
                max(
                    bar.high - bar.low,
                    abs(bar.high - prev_close),
                    abs(bar.low - prev_close),
                )
            )
        prev_close = bar.close
    return out


def atr(bars: Sequence[Bar], period: int = 14) -> List[Optional[float]]:
    """Average true range (Wilder smoothing)."""
    tr = true_range(bars)
    out: List[Optional[float]] = [None] * len(bars)
    # Collect the first `period` true-range values (index 1..period).
    valid = [x for x in tr if x is not None]
    if len(valid) < period:
        return out
    first = sum(valid[:period]) / period
    # Find the index where the first ATR lands.
    start_index = period  # tr[0] is None, so period TR values fill indices 1..period
    out[start_index] = first
    prev = first
    for i in range(start_index + 1, len(bars)):
        current_tr = tr[i]
        if current_tr is None:
            continue
        prev = (prev * (period - 1) + current_tr) / period
        out[i] = prev
    return out


def rolling_high(values: Sequence[float], period: int) -> List[Optional[float]]:
    """Highest value over the trailing ``period`` (inclusive of current)."""
    out: List[Optional[float]] = []
    window: List[float] = []
    for value in values:
        window.append(value)
        if len(window) > period:
            window.pop(0)
        out.append(max(window) if len(window) == period else None)
    return out


def rolling_low(values: Sequence[float], period: int) -> List[Optional[float]]:
    """Lowest value over the trailing ``period`` (inclusive of current)."""
    out: List[Optional[float]] = []
    window: List[float] = []
    for value in values:
        window.append(value)
        if len(window) > period:
            window.pop(0)
        out.append(min(window) if len(window) == period else None)
    return out


def donchian(
    bars: Sequence[Bar], period: int
) -> tuple[List[Optional[float]], List[Optional[float]]]:
    """Donchian channel (upper, lower) computed on *prior* bars.

    The channel at index ``i`` uses bars ``[i-period, i-1]`` — i.e. it excludes
    the current bar — so a close above the upper band is a genuine breakout of
    the preceding range rather than a tautology.
    """
    highs = [bar.high for bar in bars]
    lows = [bar.low for bar in bars]
    upper: List[Optional[float]] = [None] * len(bars)
    lower: List[Optional[float]] = [None] * len(bars)
    for i in range(len(bars)):
        if i < period:
            continue
        upper[i] = max(highs[i - period : i])
        lower[i] = min(lows[i - period : i])
    return upper, lower
