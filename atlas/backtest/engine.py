"""The event-driven backtester.

Given a price series, a strategy and a risk manager, the backtester replays the
market bar-by-bar, sizes each signal, and simulates the trade forward until it
hits its stop, its target, or a maximum holding period.

Design choices that keep results honest:

* **One position at a time.**  Signals that arrive while a trade is open are
  ignored, so trades never overlap and P&L is not double-counted.
* **Stop-before-target.**  If a single bar's range spans both the stop and the
  target, the stop is assumed to fill first (the conservative assumption).
* **Explicit costs.**  A configurable spread and per-trade commission are applied
  so the equity curve is not flattered by frictionless fills.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from atlas.backtest.metrics import Metrics, compute_metrics
from atlas.data.ingestion import Bar, Series
from atlas.risk.manager import RiskManager
from atlas.strategy.baseline import build_strategy
from atlas.strategy.signals import Signal, SignalType


@dataclass
class Trade:
    """A single closed trade."""

    entry_time: datetime
    exit_time: datetime
    direction: str
    entry: float
    exit: float
    stop: float
    target: float
    size: float
    pnl: float
    r_multiple: float
    return_pct: float
    reason: str
    exit_reason: str

    def as_dict(self) -> Dict[str, Any]:
        return {
            "entry_time": self.entry_time.isoformat(),
            "exit_time": self.exit_time.isoformat(),
            "direction": self.direction,
            "entry": round(self.entry, 6),
            "exit": round(self.exit, 6),
            "stop": round(self.stop, 6),
            "target": round(self.target, 6),
            "size": round(self.size, 4),
            "pnl": round(self.pnl, 2),
            "r_multiple": round(self.r_multiple, 3),
            "return_pct": round(self.return_pct, 4),
            "reason": self.reason,
            "exit_reason": self.exit_reason,
        }


@dataclass
class BacktestResult:
    """The full output of a backtest run."""

    trades: List[Trade] = field(default_factory=list)
    equity_curve: List[float] = field(default_factory=list)
    equity_times: List[datetime] = field(default_factory=list)
    metrics: Metrics = field(default_factory=Metrics)
    initial_equity: float = 0.0
    symbol: str = ""
    label: str = ""

    @property
    def r_multiples(self) -> List[float]:
        return [t.r_multiple for t in self.trades]


class Backtester:
    """Replays a series through a strategy and produces a :class:`BacktestResult`."""

    def __init__(
        self,
        strategy,
        risk_manager: RiskManager,
        initial_equity: float = 10_000.0,
        spread: float = 0.0,
        commission: float = 0.0,
        max_holding_bars: int = 288,
    ) -> None:
        self.strategy = strategy
        self.risk_manager = risk_manager
        self.initial_equity = initial_equity
        self.spread = spread
        self.commission = commission
        self.max_holding_bars = max_holding_bars

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> "Backtester":
        """Construct a backtester (and its strategy/risk manager) from config."""
        risk_cfg = config.get("risk", {})
        exec_cfg = config.get("execution", {})
        strategy = build_strategy(config)
        risk_manager = RiskManager(
            risk_per_trade=float(risk_cfg.get("risk_per_trade", 0.01)),
            max_position_fraction=float(risk_cfg.get("max_position_fraction", 50.0)),
        )
        return cls(
            strategy=strategy,
            risk_manager=risk_manager,
            initial_equity=float(risk_cfg.get("initial_capital", 10_000.0)),
            spread=float(exec_cfg.get("spread", 0.0)),
            commission=float(exec_cfg.get("commission", 0.0)),
            max_holding_bars=int(exec_cfg.get("max_holding_bars", 288)),
        )

    def run(self, series: Series, label: str = "") -> BacktestResult:
        """Run the backtest over ``series`` and return the result."""
        bars: List[Bar] = list(series)
        signals = self.strategy.generate_signals(series)
        signal_by_index = self._index_signals(bars, signals)

        result = BacktestResult(
            initial_equity=self.initial_equity,
            symbol=series.symbol,
            label=label,
        )
        equity = self.initial_equity
        result.equity_curve.append(equity)
        result.equity_times.append(bars[0].timestamp if bars else datetime.min)

        i = 0
        n = len(bars)
        while i < n:
            signal = signal_by_index.get(i)
            if signal is None:
                i += 1
                continue
            trade = self._simulate_trade(bars, i, signal, equity)
            if trade is None:
                i += 1
                continue
            equity += trade.pnl
            result.trades.append(trade)
            result.equity_curve.append(equity)
            result.equity_times.append(trade.exit_time)
            # Resume scanning after this trade closes (no overlapping trades).
            i = self._index_of_time(bars, trade.exit_time, i) + 1

        result.metrics = compute_metrics(
            r_multiples=[t.r_multiple for t in result.trades],
            pnls=[t.pnl for t in result.trades],
            equity_curve=result.equity_curve,
            initial_equity=self.initial_equity,
        )
        return result

    # -- internals ----------------------------------------------------------
    @staticmethod
    def _index_signals(
        bars: List[Bar], signals: List[Signal]
    ) -> Dict[int, Signal]:
        by_time = {bar.timestamp: idx for idx, bar in enumerate(bars)}
        out: Dict[int, Signal] = {}
        for signal in signals:
            idx = by_time.get(signal.timestamp)
            if idx is not None:
                out[idx] = signal
        return out

    @staticmethod
    def _index_of_time(bars: List[Bar], ts: datetime, start: int) -> int:
        for j in range(start, len(bars)):
            if bars[j].timestamp >= ts:
                return j
        return len(bars) - 1

    def _simulate_trade(
        self,
        bars: List[Bar],
        entry_index: int,
        signal: Signal,
        equity: float,
    ) -> Optional[Trade]:
        try:
            position = self.risk_manager.size(equity, signal)
        except ValueError:
            return None

        long = signal.signal_type is SignalType.LONG
        half_spread = self.spread / 2.0
        # Apply spread against us at entry.
        entry_fill = signal.entry + half_spread if long else signal.entry - half_spread
        stop = signal.stop
        target = signal.target
        risk_per_unit = abs(entry_fill - stop)
        if risk_per_unit <= 0:
            return None

        end = min(entry_index + self.max_holding_bars, len(bars) - 1)
        exit_price = bars[end].close
        exit_time = bars[end].timestamp
        exit_reason = "time_exit"

        for j in range(entry_index + 1, end + 1):
            bar = bars[j]
            if long:
                hit_stop = bar.low <= stop
                hit_target = bar.high >= target
            else:
                hit_stop = bar.high >= stop
                hit_target = bar.low <= target
            if hit_stop and hit_target:
                # Conservative: assume the stop filled first.
                exit_price, exit_reason, exit_time = stop, "stop", bar.timestamp
                break
            if hit_stop:
                exit_price, exit_reason, exit_time = stop, "stop", bar.timestamp
                break
            if hit_target:
                exit_price, exit_reason, exit_time = target, "target", bar.timestamp
                break

        # Apply spread against us at exit too.
        exit_fill = exit_price - half_spread if long else exit_price + half_spread
        gross = (
            (exit_fill - entry_fill) * position.size
            if long
            else (entry_fill - exit_fill) * position.size
        )
        pnl = gross - self.commission
        r_multiple = (
            (exit_fill - entry_fill) / risk_per_unit
            if long
            else (entry_fill - exit_fill) / risk_per_unit
        )
        return_pct = pnl / equity if equity else 0.0

        return Trade(
            entry_time=signal.timestamp,
            exit_time=exit_time,
            direction=signal.signal_type.value,
            entry=entry_fill,
            exit=exit_fill,
            stop=stop,
            target=target,
            size=position.size,
            pnl=pnl,
            r_multiple=r_multiple,
            return_pct=return_pct,
            reason=signal.reason,
            exit_reason=exit_reason,
        )
