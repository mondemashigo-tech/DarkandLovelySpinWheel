"""Trade signals emitted by strategies and consumed by the backtester."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict


class SignalType(str, Enum):
    """Direction of a trade signal."""

    LONG = "long"
    SHORT = "short"


@dataclass(frozen=True)
class Signal:
    """A fully-specified entry signal.

    A strategy is responsible for producing the entry price, stop and target so
    that the backtester stays strategy-agnostic.  ``risk_per_r`` is the price
    distance of one "R" (entry-to-stop), used for position sizing and for
    expressing results in R-multiples.
    """

    timestamp: datetime
    signal_type: SignalType
    entry: float
    stop: float
    target: float
    reason: str = ""
    meta: Dict[str, float] = field(default_factory=dict)

    @property
    def risk_per_r(self) -> float:
        """Absolute per-unit risk (distance from entry to stop)."""
        return abs(self.entry - self.stop)

    @property
    def reward_to_risk(self) -> float:
        """The reward-to-risk ratio implied by entry/stop/target."""
        risk = self.risk_per_r
        if risk == 0:
            return 0.0
        return abs(self.target - self.entry) / risk

    def __post_init__(self) -> None:
        if self.signal_type is SignalType.LONG:
            if not (self.stop < self.entry < self.target):
                raise ValueError(
                    "Long signal requires stop < entry < target "
                    f"(got stop={self.stop}, entry={self.entry}, target={self.target})"
                )
        else:
            if not (self.target < self.entry < self.stop):
                raise ValueError(
                    "Short signal requires target < entry < stop "
                    f"(got target={self.target}, entry={self.entry}, stop={self.stop})"
                )
