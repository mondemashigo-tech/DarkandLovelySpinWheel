"""Tests for the pre-registered hypothesis evaluation logic."""

import unittest

from atlas.backtest.metrics import Metrics
from atlas.hypothesis import Hypothesis, Verdict

SUCCESS = {
    "profit_factor": 1.5,
    "expectancy_positive": True,
    "max_drawdown": 0.10,
    "min_trades": 200,
}
FAILURE = {"profit_factor": 1.2, "max_drawdown": 0.15, "expectancy_negative": True}


def _hyp():
    return Hypothesis(name="h", success=SUCCESS, failure=FAILURE)


def _metrics(**kw):
    m = Metrics()
    for key, value in kw.items():
        setattr(m, key, value)
    return m


class HypothesisTests(unittest.TestCase):
    def test_inconclusive_when_sample_too_small(self):
        m = _metrics(n_trades=50, profit_factor=3.0, expectancy_r=1.0, max_drawdown=0.02)
        self.assertEqual(_hyp().evaluate(m).verdict, Verdict.INCONCLUSIVE)

    def test_accept_when_all_success_met(self):
        m = _metrics(n_trades=250, profit_factor=1.8, expectancy_r=0.5, max_drawdown=0.08)
        result = _hyp().evaluate(m)
        self.assertEqual(result.verdict, Verdict.ACCEPT)

    def test_reject_on_failure_drawdown(self):
        m = _metrics(n_trades=250, profit_factor=1.6, expectancy_r=0.5, max_drawdown=0.20)
        self.assertEqual(_hyp().evaluate(m).verdict, Verdict.REJECT)

    def test_reject_on_negative_expectancy(self):
        m = _metrics(n_trades=250, profit_factor=1.3, expectancy_r=-0.1, max_drawdown=0.05)
        self.assertEqual(_hyp().evaluate(m).verdict, Verdict.REJECT)

    def test_inconclusive_between_thresholds(self):
        # PF 1.3 clears the failure gate (>=1.2) but not success (>=1.5).
        m = _metrics(n_trades=250, profit_factor=1.3, expectancy_r=0.2, max_drawdown=0.05)
        self.assertEqual(_hyp().evaluate(m).verdict, Verdict.INCONCLUSIVE)

    def test_from_config(self):
        cfg = {"name": "x", "hypothesis": {"success": SUCCESS, "failure": FAILURE}}
        hyp = Hypothesis.from_config(cfg)
        self.assertEqual(hyp.name, "x")
        self.assertEqual(hyp.success["min_trades"], 200)


if __name__ == "__main__":
    unittest.main()
