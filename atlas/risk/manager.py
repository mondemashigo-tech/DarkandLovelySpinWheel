"""Risk management: fixed-fractional position sizing.

The baseline hypothesis risks a fixed fraction (1%) of current equity per trade.
Sizing off *current* equity means the strategy compounds — winners grow the risk
budget and losers shrink it — which is the honest way to model a real account.
"""

from __future__ import annotations

from dataclasses import dataclass

from atlas.strategy.signals import Signal, SignalType


@dataclass(frozen=True)
class Position:
    """A sized position ready to be simulated by the backtester."""

    size: float           # units of the base currency / instrument
    risk_amount: float    # cash at risk if the stop is hit
    entry: float
    stop: float
    target: float


class RiskManager:
    """Fixed-fractional risk manager.

    Parameters
    ----------
    risk_per_trade:
        Fraction of equity risked per trade (e.g. ``0.01`` for 1%).
    max_position_fraction:
        Optional cap on notional as a fraction of equity, guarding against
        pathologically tight stops producing enormous sizes.
    """

    def __init__(
        self,
        risk_per_trade: float = 0.01,
        max_position_fraction: float = 50.0,
    ) -> None:
        if not 0.0 < risk_per_trade < 1.0:
            raise ValueError("risk_per_trade must be between 0 and 1")
        self.risk_per_trade = risk_per_trade
        self.max_position_fraction = max_position_fraction

    def size(self, equity: float, signal: Signal) -> Position:
        """Return a :class:`Position` sized to risk ``risk_per_trade`` of equity."""
        if equity <= 0:
            raise ValueError("equity must be positive")
        risk_per_unit = signal.risk_per_r
        if risk_per_unit <= 0:
            raise ValueError("signal has non-positive risk per unit")
        risk_amount = equity * self.risk_per_trade
        size = risk_amount / risk_per_unit
        # Cap notional exposure.
        max_notional = equity * self.max_position_fraction
        if size * signal.entry > max_notional:
            size = max_notional / signal.entry
            risk_amount = size * risk_per_unit
        return Position(
            size=size,
            risk_amount=risk_amount,
            entry=signal.entry,
            stop=signal.stop,
            target=signal.target,
        )
