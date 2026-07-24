"""Command-line interface for Project Atlas.

The CLI is the primary way to drive an investigation end-to-end::

    python -m atlas data       --config config/baseline.yaml
    python -m atlas backtest   --config config/baseline.yaml
    python -m atlas optimize   --config config/baseline.yaml
    python -m atlas walkforward --config config/baseline.yaml
    python -m atlas montecarlo --config config/baseline.yaml
    python -m atlas dashboard  --config config/baseline.yaml

Every sub-command is config-driven and writes its artefacts into the numbered
research folders (``03_Data``, ``08_Reports``, ``00_Dashboard``, ...).
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from atlas import __version__
from atlas.backtest.engine import Backtester, BacktestResult
from atlas.config import load_config
from atlas.data.ingestion import Series, generate_synthetic, load_csv, save_csv
from atlas.hypothesis import Hypothesis
from atlas.journal.journal import Journal
from atlas.reports.csv_report import write_metrics_csv, write_trades_csv
from atlas.reports.html_report import write_html_report
from atlas.reports.pdf_report import write_pdf_report
from atlas.research.monte_carlo import monte_carlo
from atlas.research.optimizer import GridOptimizer
from atlas.research.walk_forward import walk_forward

DEFAULT_CONFIG = "config/baseline.yaml"


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def _pf(value: float) -> str:
    return "inf" if math.isinf(value) else f"{value:.2f}"


def _data_path(config: Dict[str, Any]) -> Path:
    data_cfg = config.get("data", {})
    symbol = config.get("symbol", "GBPUSD")
    timeframe = config.get("base_timeframe", "M5")
    default = f"03_Data/{symbol}_{timeframe}.csv"
    return Path(data_cfg.get("path", default))


def _load_or_generate(config: Dict[str, Any], generate_if_missing: bool = True) -> Series:
    path = _data_path(config)
    symbol = config.get("symbol", "GBPUSD")
    timeframe = config.get("base_timeframe", "M5")
    if path.exists():
        return load_csv(path, symbol, timeframe)
    if not generate_if_missing:
        raise FileNotFoundError(
            f"Data file {path} not found. Run 'atlas data' first."
        )
    data_cfg = config.get("data", {})
    series = generate_synthetic(
        symbol=symbol,
        timeframe=timeframe,
        bars=int(data_cfg.get("bars", 20000)),
        seed=int(data_cfg.get("seed", 42)),
        annual_volatility=float(data_cfg.get("annual_volatility", 0.08)),
        annual_drift=float(data_cfg.get("annual_drift", 0.0)),
    )
    save_csv(series, path)
    return series


def _journal(config: Dict[str, Any]) -> Journal:
    journal_path = config.get("journal", {}).get("path", "04_Journal/journal.ndjson")
    return Journal(journal_path)


def _param_space(config: Dict[str, Any]) -> Dict[str, List[Any]]:
    space = config.get("optimization", {}).get("param_space", {})
    return {key: list(values) for key, values in space.items()}


# --------------------------------------------------------------------------
# sub-commands
# --------------------------------------------------------------------------
def cmd_init(args: argparse.Namespace) -> int:
    folders = [
        "00_Dashboard",
        "01_Hypotheses",
        "02_Backtesting",
        "03_Data",
        "04_Journal",
        "05_Risk",
        "06_AI",
        "08_Reports",
        "09_Datasets",
    ]
    for folder in folders:
        Path(folder).mkdir(parents=True, exist_ok=True)
    print("Initialised Project Atlas research workspace:")
    for folder in folders:
        print(f"  - {folder}/")
    print(f"\nBaseline config: {DEFAULT_CONFIG}")
    return 0


def cmd_data(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    path = _data_path(config)
    if path.exists() and not args.force:
        print(f"Data already exists at {path} (use --force to regenerate).")
        return 0
    data_cfg = config.get("data", {})
    series = generate_synthetic(
        symbol=config.get("symbol", "GBPUSD"),
        timeframe=config.get("base_timeframe", "M5"),
        bars=int(args.bars or data_cfg.get("bars", 20000)),
        seed=int(args.seed if args.seed is not None else data_cfg.get("seed", 42)),
        annual_volatility=float(data_cfg.get("annual_volatility", 0.08)),
        annual_drift=float(data_cfg.get("annual_drift", 0.0)),
    )
    save_csv(series, path)
    first = series[0].timestamp
    last = series[len(series) - 1].timestamp
    print(f"Generated {len(series)} {series.timeframe} bars for {series.symbol}")
    print(f"  range : {first:%Y-%m-%d} -> {last:%Y-%m-%d}")
    print(f"  saved : {path}")
    return 0


def _run_backtest(config: Dict[str, Any], series: Series, label: str) -> BacktestResult:
    backtester = Backtester.from_config(config)
    return backtester.run(series, label=label)


def cmd_backtest(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    series = _load_or_generate(config)

    split = float(config.get("data", {}).get("in_sample_fraction", 0.7))
    in_sample, out_sample = series.split(split)
    segment = args.segment
    if segment == "in":
        run_series, tag = in_sample, "in-sample"
    elif segment == "out":
        run_series, tag = out_sample, "out-of-sample"
    else:
        run_series, tag = series, "full"

    result = _run_backtest(config, run_series, label=tag)
    hypothesis = Hypothesis.from_config(config)
    verdict = hypothesis.evaluate(result.metrics)

    _print_metrics(result, tag)
    print(f"\nHypothesis verdict ({tag}): {verdict.verdict.value}")
    for reason in verdict.reasons:
        print(f"  - {reason}")

    # Artefacts.
    name = config.get("name", "atlas")
    stem = f"{name}_{segment}"
    reports_dir = Path(config.get("reports", {}).get("dir", "08_Reports"))
    write_trades_csv(result, reports_dir / f"{stem}_trades.csv")
    write_metrics_csv(result.metrics, reports_dir / f"{stem}_metrics.csv")
    write_html_report(
        result,
        reports_dir / f"{stem}_report.html",
        title=f"Project Atlas — {name}",
        hypothesis_result=verdict,
        subtitle=f"{tag} backtest",
    )
    write_pdf_report(
        result,
        reports_dir / f"{stem}_report.pdf",
        title=f"Project Atlas — {name}",
        hypothesis_result=verdict,
    )
    print(f"\nReports written to {reports_dir}/{stem}_report.(html|pdf), "
          f"{stem}_trades.csv, {stem}_metrics.csv")

    _journal(config).log(
        kind="backtest",
        hypothesis=name,
        summary=f"{tag}: {result.metrics.n_trades} trades, "
        f"PF={_pf(result.metrics.profit_factor)}, verdict={verdict.verdict.value}",
        data={
            "segment": segment,
            "metrics": result.metrics.as_dict(),
            "verdict": verdict.as_dict(),
        },
    )
    return 0


def cmd_optimize(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    series = _load_or_generate(config)
    in_sample, _ = series.split(
        float(config.get("data", {}).get("in_sample_fraction", 0.7))
    )
    space = _param_space(config)
    if not space:
        print("No optimization.param_space defined in config; nothing to search.")
        return 1
    optimizer = GridOptimizer(config, space)
    result = optimizer.run(in_sample)
    print(f"Grid search over {len(space)} parameter(s), "
          f"{len(result.ranked)} combinations (in-sample only):\n")
    print(f"{'rank':<5}{'PF':>7}{'trades':>8}{'exp(R)':>9}{'maxDD':>8}   params")
    for rank, (combo, metrics) in enumerate(result.ranked[: args.top], start=1):
        params = ", ".join(f"{k}={v}" for k, v in combo.items())
        print(
            f"{rank:<5}{_pf(metrics.profit_factor):>7}{metrics.n_trades:>8}"
            f"{metrics.expectancy_r:>9.3f}{metrics.max_drawdown:>7.1%}   {params}"
        )
    _journal(config).log(
        kind="optimize",
        hypothesis=config.get("name", "atlas"),
        summary=f"Best in-sample params: {result.best_params}",
        data={"best_params": result.best_params,
              "best_metrics": result.best_metrics.as_dict()},
    )
    print(f"\nBest in-sample parameters: {result.best_params}")
    print("Remember: validate these on the untouched out-of-sample segment.")
    return 0


def cmd_walkforward(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    series = _load_or_generate(config)
    space = _param_space(config)
    wf_cfg = config.get("walk_forward", {})
    train_bars = int(args.train or wf_cfg.get("train_bars", 4000))
    test_bars = int(args.test or wf_cfg.get("test_bars", 1500))
    step_bars = wf_cfg.get("step_bars")
    result = walk_forward(
        config, series, space, train_bars, test_bars,
        step_bars=int(step_bars) if step_bars else None,
    )
    m = result.combined_metrics
    print(f"Walk-forward: {len(result.windows)} folds "
          f"(train={train_bars}, test={test_bars} bars each)\n")
    print(f"{'fold':<5}{'trades':>7}{'exp(R)':>9}{'PF':>7}{'maxDD':>8}   params")
    for w in result.windows:
        params = ", ".join(f"{k}={v}" for k, v in w.best_params.items())
        print(
            f"{w.fold:<5}{w.out_metrics.n_trades:>7}"
            f"{w.out_metrics.expectancy_r:>9.3f}"
            f"{_pf(w.out_metrics.profit_factor):>7}"
            f"{w.out_metrics.max_drawdown:>7.1%}   {params}"
        )
    print("\nCombined out-of-sample performance:")
    print(f"  trades        : {m.n_trades}")
    print(f"  profit factor : {_pf(m.profit_factor)}")
    print(f"  expectancy(R) : {m.expectancy_r:.3f}")
    print(f"  max drawdown  : {m.max_drawdown:.1%}")
    print(f"  total return  : {m.total_return:.1%}")
    _journal(config).log(
        kind="walk_forward",
        hypothesis=config.get("name", "atlas"),
        summary=f"{len(result.windows)} folds, combined PF={_pf(m.profit_factor)}",
        data={"combined": m.as_dict()},
    )
    return 0


def cmd_montecarlo(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    series = _load_or_generate(config)
    result = _run_backtest(config, series, label="montecarlo")
    if not result.trades:
        print("No trades produced; cannot run Monte Carlo.")
        return 1
    risk = float(config.get("risk", {}).get("risk_per_trade", 0.01))
    equity = float(config.get("risk", {}).get("initial_capital", 10_000.0))
    mc_cfg = config.get("monte_carlo", {})
    mc = monte_carlo(
        result.r_multiples,
        initial_equity=equity,
        risk_per_trade=risk,
        simulations=int(args.sims or mc_cfg.get("simulations", 2000)),
        ruin_fraction=float(mc_cfg.get("ruin_fraction", 0.5)),
    )
    print(f"Monte Carlo — {mc.simulations} resamples of {len(result.trades)} trades\n")
    print(f"  final equity  p5 / p50 / p95 : "
          f"{mc.final_equity_p5:,.0f} / {mc.final_equity_p50:,.0f} / "
          f"{mc.final_equity_p95:,.0f}")
    print(f"  max drawdown  p50 / p95      : "
          f"{mc.max_drawdown_p50:.1%} / {mc.max_drawdown_p95:.1%}")
    print(f"  probability profitable       : {mc.prob_profit:.1%}")
    print(f"  probability of ruin (<{mc.ruin_threshold:,.0f}) : {mc.prob_ruin:.1%}")
    _journal(config).log(
        kind="monte_carlo",
        hypothesis=config.get("name", "atlas"),
        summary=f"P(profit)={mc.prob_profit:.1%}, P(ruin)={mc.prob_ruin:.1%}",
        data={
            "prob_profit": mc.prob_profit,
            "prob_ruin": mc.prob_ruin,
            "final_equity_p50": mc.final_equity_p50,
        },
    )
    return 0


def cmd_dashboard(args: argparse.Namespace) -> int:
    from atlas.dashboard.dashboard import write_dashboard

    config = load_config(args.config)
    series = _load_or_generate(config)
    result = _run_backtest(config, series, label="full")
    hypothesis = Hypothesis.from_config(config)
    verdict = hypothesis.evaluate(result.metrics)

    wf_result = None
    mc_result = None
    if not args.fast:
        space = _param_space(config)
        wf_cfg = config.get("walk_forward", {})
        wf_result = walk_forward(
            config, series, space,
            int(wf_cfg.get("train_bars", 4000)),
            int(wf_cfg.get("test_bars", 1500)),
        )
        if result.trades:
            mc_result = monte_carlo(
                result.r_multiples,
                initial_equity=float(config.get("risk", {}).get("initial_capital", 10_000.0)),
                risk_per_trade=float(config.get("risk", {}).get("risk_per_trade", 0.01)),
                simulations=int(config.get("monte_carlo", {}).get("simulations", 2000)),
            )

    name = config.get("name", "atlas")
    out = Path(config.get("dashboard", {}).get("path", f"00_Dashboard/{name}.html"))
    write_dashboard(
        result, out,
        hypothesis_result=verdict,
        walk_forward=wf_result,
        monte_carlo=mc_result,
        title=f"Project Atlas — {name}",
    )
    print(f"Dashboard written to {out}")
    print(f"Verdict: {verdict.verdict.value}  |  "
          f"trades={result.metrics.n_trades}  PF={_pf(result.metrics.profit_factor)}")
    return 0


def _print_metrics(result: BacktestResult, tag: str) -> None:
    m = result.metrics
    print(f"Backtest [{tag}] — {result.symbol}")
    print(f"  trades        : {m.n_trades}")
    print(f"  win rate      : {m.win_rate:.1%}")
    print(f"  profit factor : {_pf(m.profit_factor)}")
    print(f"  expectancy(R) : {m.expectancy_r:.3f}")
    print(f"  net profit    : {m.net_profit:,.2f}")
    print(f"  total return  : {m.total_return:.1%}")
    print(f"  max drawdown  : {m.max_drawdown:.1%}")
    print(f"  final equity  : {m.final_equity:,.2f}")


# --------------------------------------------------------------------------
# argument parsing
# --------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="atlas",
        description="Project Atlas — a quantitative FX hypothesis-testing platform.",
    )
    parser.add_argument("--version", action="version", version=f"Project Atlas {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="Scaffold the research workspace folders.")
    p_init.set_defaults(func=cmd_init)

    p_data = sub.add_parser("data", help="Generate (or regenerate) the price dataset.")
    p_data.add_argument("--config", default=DEFAULT_CONFIG)
    p_data.add_argument("--bars", type=int, default=None)
    p_data.add_argument("--seed", type=int, default=None)
    p_data.add_argument("--force", action="store_true")
    p_data.set_defaults(func=cmd_data)

    p_bt = sub.add_parser("backtest", help="Run a backtest and write reports.")
    p_bt.add_argument("--config", default=DEFAULT_CONFIG)
    p_bt.add_argument(
        "--segment", choices=["full", "in", "out"], default="full",
        help="Which data segment to test: full, in-sample or out-of-sample.",
    )
    p_bt.set_defaults(func=cmd_backtest)

    p_opt = sub.add_parser("optimize", help="Grid-search parameters (in-sample only).")
    p_opt.add_argument("--config", default=DEFAULT_CONFIG)
    p_opt.add_argument("--top", type=int, default=10)
    p_opt.set_defaults(func=cmd_optimize)

    p_wf = sub.add_parser("walkforward", help="Run walk-forward analysis.")
    p_wf.add_argument("--config", default=DEFAULT_CONFIG)
    p_wf.add_argument("--train", type=int, default=None)
    p_wf.add_argument("--test", type=int, default=None)
    p_wf.set_defaults(func=cmd_walkforward)

    p_mc = sub.add_parser("montecarlo", help="Run Monte Carlo robustness analysis.")
    p_mc.add_argument("--config", default=DEFAULT_CONFIG)
    p_mc.add_argument("--sims", type=int, default=None)
    p_mc.set_defaults(func=cmd_montecarlo)

    p_dash = sub.add_parser("dashboard", help="Build the full research dashboard.")
    p_dash.add_argument("--config", default=DEFAULT_CONFIG)
    p_dash.add_argument(
        "--fast", action="store_true",
        help="Skip walk-forward and Monte Carlo for a quick dashboard.",
    )
    p_dash.set_defaults(func=cmd_dashboard)

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except (FileNotFoundError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
