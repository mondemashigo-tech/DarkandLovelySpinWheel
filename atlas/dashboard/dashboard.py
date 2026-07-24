"""The research dashboard — a single-page overview of a hypothesis test.

The dashboard stitches together the pieces of a full investigation: the headline
KPIs, the equity curve, the pre-registered verdict, and — when available — the
walk-forward and Monte Carlo robustness summaries.  It is a self-contained HTML
file so it can live in ``00_Dashboard/`` and be opened directly.
"""

from __future__ import annotations

import html
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from atlas.backtest.engine import BacktestResult
from atlas.backtest.metrics import summary_table
from atlas.hypothesis import HypothesisResult, Verdict
from atlas.reports.html_report import _CSS, _svg_line, _verdict_class
from atlas.research.monte_carlo import MonteCarloResult
from atlas.research.walk_forward import WalkForwardResult


def _kpi(label: str, value: str) -> str:
    return (
        f'<div class="tile"><div class="label">{html.escape(label)}</div>'
        f'<div class="value">{html.escape(value)}</div></div>'
    )


def write_dashboard(
    result: BacktestResult,
    path: str | Path,
    hypothesis_result: Optional[HypothesisResult] = None,
    walk_forward: Optional[WalkForwardResult] = None,
    monte_carlo: Optional[MonteCarloResult] = None,
    title: str = "Project Atlas — Research Dashboard",
) -> Path:
    """Write the dashboard HTML to ``path``."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    kpis = "".join(_kpi(label, value) for label, value in summary_table(result.metrics))

    verdict_block = ""
    if hypothesis_result is not None:
        cls = _verdict_class(hypothesis_result.verdict)
        reasons = "".join(f"<li>{html.escape(r)}</li>" for r in hypothesis_result.reasons)
        verdict_block = (
            '<h2>Pre-registered verdict</h2><div class="card">'
            f'<span class="badge {cls}">{hypothesis_result.verdict.value}</span>'
            f'<ul class="reasons">{reasons}</ul></div>'
        )

    wf_block = ""
    if walk_forward is not None and walk_forward.windows:
        m = walk_forward.combined_metrics
        pf = "∞" if math.isinf(m.profit_factor) else f"{m.profit_factor:.2f}"
        rows = "".join(
            "<tr>"
            f"<td>{w.fold}</td><td>{w.out_metrics.n_trades}</td>"
            f"<td>{w.out_metrics.expectancy_r:+.3f}</td>"
            f"<td>{('∞' if math.isinf(w.out_metrics.profit_factor) else f'{w.out_metrics.profit_factor:.2f}')}</td>"
            f"<td>{w.out_metrics.max_drawdown:.1%}</td>"
            "</tr>"
            for w in walk_forward.windows
        )
        wf_block = (
            "<h2>Walk-forward (out-of-sample)</h2>"
            f'<div class="grid">{_kpi("OOS trades", str(m.n_trades))}'
            f'{_kpi("OOS profit factor", pf)}'
            f'{_kpi("OOS expectancy (R)", f"{m.expectancy_r:.3f}")}'
            f'{_kpi("OOS max drawdown", f"{m.max_drawdown:.1%}")}</div>'
            '<div class="scroll" style="margin-top:1rem"><table><thead><tr>'
            "<th>Fold</th><th>Trades</th><th>Exp (R)</th><th>PF</th><th>MaxDD</th>"
            "</tr></thead><tbody>" + rows + "</tbody></table></div>"
        )

    mc_block = ""
    if monte_carlo is not None and monte_carlo.final_equities:
        mc_block = (
            "<h2>Monte Carlo robustness</h2>"
            f'<div class="grid">'
            f'{_kpi("Median final equity", f"{monte_carlo.final_equity_p50:,.0f}")}'
            f'{_kpi("5th pct equity", f"{monte_carlo.final_equity_p5:,.0f}")}'
            f'{_kpi("95th pct equity", f"{monte_carlo.final_equity_p95:,.0f}")}'
            f'{_kpi("Prob. profitable", f"{monte_carlo.prob_profit:.0%}")}'
            f'{_kpi("Median max DD", f"{monte_carlo.max_drawdown_p50:.1%}")}'
            f'{_kpi("95th pct max DD", f"{monte_carlo.max_drawdown_p95:.1%}")}'
            f'{_kpi("Prob. of ruin", f"{monte_carlo.prob_ruin:.1%}")}'
            "</div>"
        )

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    document = (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>{html.escape(title)}</title><style>{_CSS}</style></head><body>"
        f"<div class='wrap'><h1>{html.escape(title)}</h1>"
        f"<p class='muted'>{html.escape(result.symbol)} &middot; "
        f"{html.escape(result.label or 'backtest')} &middot; generated {generated}</p>"
        f"<h2>Headline metrics</h2><div class='grid'>{kpis}</div>"
        f"<h2>Equity curve</h2><div class='card'>{_svg_line(result.equity_curve)}</div>"
        f"{verdict_block}{wf_block}{mc_block}"
        "<footer>We do not predict markets. We test hypotheses. "
        "Statistics — not opinions — decide.</footer>"
        "</div></body></html>"
    )
    path.write_text(document, encoding="utf-8")
    return path
