"""Grid-search optimisation over strategy parameters.

The optimiser takes a *parameter space* — a mapping of dotted config paths to
lists of candidate values — and evaluates every combination on an in-sample
series, ranking them by a chosen metric.

A deliberate guard-rail: the optimiser only ever sees the **in-sample** data.
Choosing parameters on data you later report on is the classic way to fool
yourself, so out-of-sample validation is a separate, explicit step.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Sequence, Tuple

from atlas.backtest.engine import Backtester, BacktestResult
from atlas.backtest.metrics import Metrics
from atlas.config import merge
from atlas.data.ingestion import Series


def _set_dotted(target: Dict[str, Any], dotted: str, value: Any) -> None:
    """Set ``target["a"]["b"] = value`` for a dotted key ``"a.b"``."""
    keys = dotted.split(".")
    node = target
    for key in keys[:-1]:
        node = node.setdefault(key, {})
    node[keys[-1]] = value


@dataclass
class OptimizationResult:
    """Ranked results of a grid search."""

    ranked: List[Tuple[Dict[str, Any], Metrics]] = field(default_factory=list)
    metric_name: str = "profit_factor"

    @property
    def best_params(self) -> Dict[str, Any]:
        return self.ranked[0][0] if self.ranked else {}

    @property
    def best_metrics(self) -> Metrics:
        return self.ranked[0][1] if self.ranked else Metrics()


def _default_score(metrics: Metrics) -> float:
    # Penalise tiny samples so a 3-trade fluke can't win the grid.
    if metrics.n_trades < 20:
        return float("-inf")
    pf = metrics.profit_factor
    if pf == float("inf"):
        pf = 10.0
    return pf


class GridOptimizer:
    """Exhaustive grid search over a discrete parameter space."""

    def __init__(
        self,
        base_config: Dict[str, Any],
        param_space: Dict[str, Sequence[Any]],
        score: Callable[[Metrics], float] | None = None,
        metric_name: str = "profit_factor",
    ) -> None:
        self.base_config = base_config
        self.param_space = param_space
        self.score = score or _default_score
        self.metric_name = metric_name

    def _combinations(self) -> List[Dict[str, Any]]:
        if not self.param_space:
            return [{}]
        keys = list(self.param_space.keys())
        value_lists = [list(self.param_space[k]) for k in keys]
        combos: List[Dict[str, Any]] = []
        for values in itertools.product(*value_lists):
            combos.append(dict(zip(keys, values)))
        return combos

    def run(self, in_sample: Series) -> OptimizationResult:
        """Evaluate every parameter combination on ``in_sample``."""
        scored: List[Tuple[float, Dict[str, Any], Metrics]] = []
        for combo in self._combinations():
            override: Dict[str, Any] = {}
            for dotted, value in combo.items():
                _set_dotted(override, dotted, value)
            config = merge(self.base_config, override)
            backtester = Backtester.from_config(config)
            result: BacktestResult = backtester.run(in_sample, label="optimize")
            scored.append((self.score(result.metrics), combo, result.metrics))
        scored.sort(key=lambda row: row[0], reverse=True)
        return OptimizationResult(
            ranked=[(combo, metrics) for _, combo, metrics in scored],
            metric_name=self.metric_name,
        )
