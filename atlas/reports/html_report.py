"""Self-contained HTML report writer.

Produces a single ``.html`` file with no external dependencies (inline CSS and an
inline SVG equity curve), so a report can be opened anywhere or emailed as one
file.  Reports are theme-aware and print cleanly to PDF from a browser.
"""

from __future__ import annotations

import html
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Sequence

from atlas.backtest.engine import BacktestResult
from atlas.backtest.metrics import summary_table
from atlas.hypothesis import HypothesisResult, Verdict


def _svg_line(values: Sequence[float], width: int = 720, height: int = 220) -> str:
    """Render a list of equity values as an inline SVG line chart."""
    if len(values) < 2:
        return '<p class="muted">Not enough data to plot an equity curve.</p>'
    lo, hi = min(values), max(values)
    span = hi - lo or 1.0
    pad = 16
    inner_w = width - 2 * pad
    inner_h = height - 2 * pad
    points: List[str] = []
    for i, value in enumerate(values):
        x = pad + inner_w * i / (len(values) - 1)
        y = pad + inner_h * (1 - (value - lo) / span)
        points.append(f"{x:.1f},{y:.1f}")
    poly = " ".join(points)
    baseline_y = pad + inner_h * (1 - (values[0] - lo) / span)
    return (
        f'<svg viewBox="0 0 {width} {height}" width="100%" '
        f'preserveAspectRatio="none" role="img" aria-label="Equity curve">'
        f'<line x1="{pad}" y1="{baseline_y:.1f}" x2="{width - pad}" '
        f'y2="{baseline_y:.1f}" class="axis"/>'
        f'<polyline fill="none" class="equity" points="{poly}"/>'
        f"</svg>"
    )


def _verdict_class(verdict: Verdict) -> str:
    return {
        Verdict.ACCEPT: "accept",
        Verdict.REJECT: "reject",
        Verdict.INCONCLUSIVE: "inconclusive",
    }[verdict]


_CSS = """
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
  Arial, sans-serif; margin: 0; padding: 2rem; line-height: 1.5;
  background: #f7f7f9; color: #16181d; }
.wrap { max-width: 900px; margin: 0 auto; }
h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
h2 { font-size: 1.15rem; margin: 2rem 0 .75rem; border-bottom: 1px solid #d8dae0;
  padding-bottom: .35rem; }
.muted { color: #6b7280; font-size: .9rem; }
.card { background: #fff; border: 1px solid #e4e6eb; border-radius: 12px;
  padding: 1.25rem 1.5rem; margin-top: 1rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: .75rem; }
.tile { background: #fff; border: 1px solid #e4e6eb; border-radius: 10px;
  padding: .8rem 1rem; }
.tile .label { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em;
  color: #6b7280; }
.tile .value { font-size: 1.3rem; font-weight: 600; margin-top: .15rem; }
table { width: 100%; border-collapse: collapse; font-size: .85rem; }
th, td { text-align: right; padding: .4rem .55rem; border-bottom: 1px solid #edeef1; }
th:first-child, td:first-child { text-align: left; }
thead th { position: sticky; top: 0; background: #fafbfc; }
.scroll { overflow-x: auto; max-height: 420px; overflow-y: auto; }
.badge { display: inline-block; padding: .35rem .8rem; border-radius: 999px;
  font-weight: 700; letter-spacing: .03em; }
.badge.accept { background: #dcfce7; color: #14532d; }
.badge.reject { background: #fee2e2; color: #7f1d1d; }
.badge.inconclusive { background: #fef9c3; color: #713f12; }
.win { color: #15803d; } .loss { color: #b91c1c; }
svg .equity { stroke: #2563eb; stroke-width: 2; }
svg .axis { stroke: #cbd5e1; stroke-dasharray: 4 4; stroke-width: 1; }
ul.reasons { margin: .5rem 0 0; padding-left: 1.1rem; }
footer { margin-top: 2.5rem; font-size: .8rem; color: #6b7280; }
@media (prefers-color-scheme: dark) {
  body { background: #0f1115; color: #e6e8ec; }
  .card, .tile { background: #171a21; border-color: #262a33; }
  thead th { background: #12141a; }
  h2 { border-color: #262a33; }
  th, td { border-color: #222630; }
  .tile .label, .muted { color: #99a1b3; }
  .badge.accept { background: #14532d; color: #dcfce7; }
  .badge.reject { background: #7f1d1d; color: #fee2e2; }
  .badge.inconclusive { background: #713f12; color: #fef9c3; }
}
"""


def write_html_report(
    result: BacktestResult,
    path: str | Path,
    title: str = "Project Atlas — Backtest Report",
    hypothesis_result: Optional[HypothesisResult] = None,
    subtitle: str = "",
    max_trades: int = 500,
) -> Path:
    """Write a full HTML report for ``result`` to ``path``."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    tiles = "".join(
        f'<div class="tile"><div class="label">{html.escape(label)}</div>'
        f'<div class="value">{html.escape(value)}</div></div>'
        for label, value in summary_table(result.metrics)
    )

    verdict_block = ""
    if hypothesis_result is not None:
        cls = _verdict_class(hypothesis_result.verdict)
        reasons = "".join(
            f"<li>{html.escape(r)}</li>" for r in hypothesis_result.reasons
        )
        verdict_block = (
            '<h2>Hypothesis verdict</h2><div class="card">'
            f'<span class="badge {cls}">{hypothesis_result.verdict.value}</span>'
            f'<ul class="reasons">{reasons}</ul></div>'
        )

    rows: List[str] = []
    for trade in result.trades[:max_trades]:
        cls = "win" if trade.pnl > 0 else "loss" if trade.pnl < 0 else ""
        rows.append(
            "<tr>"
            f"<td>{html.escape(trade.entry_time.strftime('%Y-%m-%d %H:%M'))}</td>"
            f"<td>{html.escape(trade.direction)}</td>"
            f"<td>{trade.entry:.5f}</td>"
            f"<td>{trade.exit:.5f}</td>"
            f"<td>{html.escape(trade.exit_reason)}</td>"
            f'<td class="{cls}">{trade.r_multiple:+.2f}</td>'
            f'<td class="{cls}">{trade.pnl:+.2f}</td>'
            "</tr>"
        )
    trades_table = (
        '<div class="scroll"><table><thead><tr>'
        "<th>Entry</th><th>Dir</th><th>Entry px</th><th>Exit px</th>"
        "<th>Exit</th><th>R</th><th>P&amp;L</th>"
        "</tr></thead><tbody>" + "".join(rows) + "</tbody></table></div>"
    )
    if len(result.trades) > max_trades:
        trades_table += (
            f'<p class="muted">Showing first {max_trades} of '
            f"{len(result.trades)} trades.</p>"
        )

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    sub = html.escape(subtitle) if subtitle else html.escape(result.label or result.symbol)

    document = (
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>{html.escape(title)}</title><style>{_CSS}</style></head><body>"
        f"<div class='wrap'><h1>{html.escape(title)}</h1>"
        f"<p class='muted'>{sub} &middot; generated {generated}</p>"
        f"<h2>Performance</h2><div class='grid'>{tiles}</div>"
        f"<h2>Equity curve</h2><div class='card'>{_svg_line(result.equity_curve)}</div>"
        f"{verdict_block}"
        f"<h2>Trades</h2>{trades_table}"
        "<footer>Project Atlas — we do not predict markets, we test hypotheses. "
        "Statistics, not opinions, decide.</footer>"
        "</div></body></html>"
    )
    path.write_text(document, encoding="utf-8")
    return path
