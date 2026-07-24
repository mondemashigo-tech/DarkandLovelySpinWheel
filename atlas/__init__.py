"""Project Atlas — a modular quantitative research platform for FX hypothesis testing.

Atlas treats every trading idea as a *hypothesis* to be tested scientifically:
pre-register criteria, separate in-sample from out-of-sample data, and let the
statistics — not opinions — decide.

The package is deliberately dependency-light (standard library + PyYAML) so that
results are reproducible on any machine without a heavy scientific stack.

Sub-packages
------------
- :mod:`atlas.data`        Data ingestion, the OHLCV bar model and resampling.
- :mod:`atlas.strategy`    The rule engine and config-driven strategies.
- :mod:`atlas.backtest`    The event-driven backtester and performance metrics.
- :mod:`atlas.risk`        Position sizing and risk management.
- :mod:`atlas.research`    Optimiser, walk-forward and Monte Carlo tooling.
- :mod:`atlas.journal`     The trade journal.
- :mod:`atlas.reports`     HTML / CSV / PDF report writers.
- :mod:`atlas.dashboard`   The research dashboard.
"""

from atlas.hypothesis import Hypothesis, HypothesisResult

__all__ = ["Hypothesis", "HypothesisResult", "__version__"]

__version__ = "0.1.0"
