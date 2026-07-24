"""Configuration loading for Project Atlas.

Strategies and hypotheses are *config-driven*: the rules, parameters and
pre-registered success/failure criteria live in YAML files rather than in code.
This keeps experiments reproducible and makes it impossible to silently change
the rules mid-test.
"""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any, Dict

import yaml


class ConfigError(ValueError):
    """Raised when a configuration file is missing required fields."""


def load_config(path: str | Path) -> Dict[str, Any]:
    """Load a YAML configuration file into a plain dictionary.

    Parameters
    ----------
    path:
        Path to a ``.yaml`` / ``.yml`` file.

    Returns
    -------
    dict
        The parsed configuration.
    """
    path = Path(path)
    if not path.exists():
        raise ConfigError(f"Configuration file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if data is None:
        raise ConfigError(f"Configuration file is empty: {path}")
    if not isinstance(data, dict):
        raise ConfigError(f"Top-level configuration must be a mapping: {path}")
    return data


def require(config: Dict[str, Any], key: str) -> Any:
    """Return ``config[key]`` or raise a descriptive :class:`ConfigError`."""
    if key not in config:
        raise ConfigError(f"Missing required configuration key: '{key}'")
    return config[key]


def merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Deep-merge ``override`` on top of ``base`` without mutating either.

    Used by the optimiser to apply a candidate parameter set on top of a
    baseline configuration.
    """
    result = copy.deepcopy(base)
    for key, value in override.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result
