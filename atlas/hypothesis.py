"""Hypotheses and their pre-registered success/failure criteria.

This module is the scientific heart of Project Atlas.  A :class:`Hypothesis`
carries the *pre-registered* thresholds that decide, before any data is seen,
what would count as success or failure.  After a backtest produces
:class:`~atlas.backtest.metrics.Metrics`, :meth:`Hypothesis.evaluate` returns an
objective verdict — ``ACCEPT``, ``REJECT`` or ``INCONCLUSIVE`` — so that
statistics, not opinions, decide.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List

from atlas.backtest.metrics import Metrics


class Verdict(str, Enum):
    ACCEPT = "ACCEPT"
    REJECT = "REJECT"
    INCONCLUSIVE = "INCONCLUSIVE"


@dataclass
class HypothesisResult:
    """The outcome of evaluating a hypothesis against realised metrics."""

    verdict: Verdict
    reasons: List[str] = field(default_factory=list)
    checks: Dict[str, bool] = field(default_factory=dict)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "verdict": self.verdict.value,
            "reasons": self.reasons,
            "checks": self.checks,
        }


@dataclass
class Hypothesis:
    """A pre-registered trading hypothesis.

    Attributes
    ----------
    name:
        Human-readable identifier.
    description:
        A one-line statement of the idea under test.
    success / failure:
        Dictionaries of pre-registered thresholds.  Recognised keys:

        * ``profit_factor``       — minimum (success) / maximum (failure) PF.
        * ``min_trades``          — minimum sample size for a valid conclusion.
        * ``max_drawdown``        — maximum acceptable drawdown fraction.
        * ``expectancy_positive`` — require positive expectancy (success).
        * ``expectancy_negative`` — treat negative expectancy as failure.
    """

    name: str
    description: str = ""
    success: Dict[str, Any] = field(default_factory=dict)
    failure: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_config(cls, config: Dict[str, Any]) -> "Hypothesis":
        hyp = config.get("hypothesis", {})
        return cls(
            name=config.get("name", "unnamed_hypothesis"),
            description=config.get("description", ""),
            success=hyp.get("success", {}),
            failure=hyp.get("failure", {}),
        )

    # -- evaluation ---------------------------------------------------------
    def evaluate(self, metrics: Metrics) -> HypothesisResult:
        """Return an objective verdict for ``metrics`` against the criteria."""
        checks: Dict[str, bool] = {}
        reasons: List[str] = []

        min_trades = int(self.success.get("min_trades", 0))
        if metrics.n_trades < min_trades:
            checks["sample_size"] = False
            reasons.append(
                f"Sample too small: {metrics.n_trades} trades < required {min_trades}."
            )
            return HypothesisResult(Verdict.INCONCLUSIVE, reasons, checks)
        checks["sample_size"] = True

        # -- failure gate first: an idea that trips any failure line is out ---
        failed = False
        if "profit_factor" in self.failure:
            ok = metrics.profit_factor >= float(self.failure["profit_factor"])
            checks["failure_profit_factor"] = ok
            if not ok:
                failed = True
                reasons.append(
                    f"Profit factor {self._fmt(metrics.profit_factor)} below failure "
                    f"threshold {self.failure['profit_factor']}."
                )
        if "max_drawdown" in self.failure:
            ok = metrics.max_drawdown <= float(self.failure["max_drawdown"])
            checks["failure_max_drawdown"] = ok
            if not ok:
                failed = True
                reasons.append(
                    f"Max drawdown {metrics.max_drawdown:.1%} exceeds failure "
                    f"threshold {float(self.failure['max_drawdown']):.1%}."
                )
        if self.failure.get("expectancy_negative") and metrics.expectancy_r < 0:
            checks["failure_expectancy"] = False
            failed = True
            reasons.append(
                f"Negative expectancy ({metrics.expectancy_r:.3f} R per trade)."
            )
        if failed:
            return HypothesisResult(Verdict.REJECT, reasons, checks)

        # -- success gate: all success lines must be cleared ------------------
        passed = True
        if "profit_factor" in self.success:
            ok = metrics.profit_factor >= float(self.success["profit_factor"])
            checks["success_profit_factor"] = ok
            passed = passed and ok
            if not ok:
                reasons.append(
                    f"Profit factor {self._fmt(metrics.profit_factor)} below success "
                    f"threshold {self.success['profit_factor']}."
                )
        if "max_drawdown" in self.success:
            ok = metrics.max_drawdown <= float(self.success["max_drawdown"])
            checks["success_max_drawdown"] = ok
            passed = passed and ok
            if not ok:
                reasons.append(
                    f"Max drawdown {metrics.max_drawdown:.1%} above success "
                    f"threshold {float(self.success['max_drawdown']):.1%}."
                )
        if self.success.get("expectancy_positive"):
            ok = metrics.expectancy_r > 0
            checks["success_expectancy"] = ok
            passed = passed and ok
            if not ok:
                reasons.append("Expectancy is not positive.")

        if passed:
            reasons.append("All pre-registered success criteria met.")
            return HypothesisResult(Verdict.ACCEPT, reasons, checks)

        reasons.append(
            "Neither failure nor full success criteria met — result is inconclusive."
        )
        return HypothesisResult(Verdict.INCONCLUSIVE, reasons, checks)

    @staticmethod
    def _fmt(pf: float) -> str:
        return "∞" if math.isinf(pf) else f"{pf:.2f}"
