"""Tests for the report and dashboard writers and the trade journal."""

import os
import tempfile
import unittest

from atlas.backtest.engine import Backtester
from atlas.dashboard.dashboard import write_dashboard
from atlas.data.ingestion import generate_synthetic
from atlas.hypothesis import Hypothesis
from atlas.journal.journal import Journal
from atlas.reports.csv_report import write_metrics_csv, write_trades_csv
from atlas.reports.html_report import write_html_report
from atlas.reports.pdf_report import write_pdf_report
from tests.test_strategy import BASE_CONFIG


def _result():
    series = generate_synthetic(bars=20000, seed=42)
    config = dict(BASE_CONFIG)
    config["risk"] = {"initial_capital": 10_000, "risk_per_trade": 0.01}
    bt = Backtester.from_config(config)
    return bt.run(series, label="test")


class ReportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = _result()
        cls.verdict = Hypothesis.from_config(
            {"name": "t", "hypothesis": {
                "success": {"profit_factor": 1.5, "min_trades": 10,
                            "expectancy_positive": True, "max_drawdown": 0.5},
                "failure": {"profit_factor": 1.0, "max_drawdown": 0.6}}}
        ).evaluate(cls.result.metrics)

    def test_has_trades(self):
        self.assertGreater(len(self.result.trades), 0)

    def test_csv_reports(self):
        with tempfile.TemporaryDirectory() as tmp:
            t = write_trades_csv(self.result, os.path.join(tmp, "t.csv"))
            m = write_metrics_csv(self.result.metrics, os.path.join(tmp, "m.csv"))
            self.assertTrue(os.path.getsize(t) > 0)
            with open(m, encoding="utf-8") as handle:
                self.assertIn("profit_factor", handle.read())

    def test_html_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = write_html_report(
                self.result, os.path.join(tmp, "r.html"),
                hypothesis_result=self.verdict,
            )
            with open(path, encoding="utf-8") as handle:
                body = handle.read()
            self.assertIn("<!doctype html>", body)
            self.assertIn("Equity curve", body)
            self.assertIn(self.verdict.verdict.value, body)

    def test_pdf_report_is_valid(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = write_pdf_report(
                self.result, os.path.join(tmp, "r.pdf"),
                hypothesis_result=self.verdict,
            )
            with open(path, "rb") as handle:
                data = handle.read()
            self.assertTrue(data.startswith(b"%PDF-1.4"))
            self.assertIn(b"%%EOF", data)
            self.assertIn(b"/Type /Catalog", data)

    def test_dashboard(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = write_dashboard(
                self.result, os.path.join(tmp, "d.html"),
                hypothesis_result=self.verdict,
            )
            with open(path, encoding="utf-8") as handle:
                body = handle.read()
            self.assertIn("Research Dashboard", body)
            self.assertIn("Headline metrics", body)


class JournalTests(unittest.TestCase):
    def test_append_and_read(self):
        with tempfile.TemporaryDirectory() as tmp:
            journal = Journal(os.path.join(tmp, "j.ndjson"))
            journal.log(kind="note", summary="first")
            journal.log(kind="backtest", summary="second", data={"pf": 1.5})
            entries = journal.entries()
            self.assertEqual(len(entries), 2)
            self.assertEqual(entries[0].summary, "first")
            self.assertEqual(entries[1].data["pf"], 1.5)


if __name__ == "__main__":
    unittest.main()
