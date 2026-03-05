"""Configuration utilities."""

from __future__ import annotations

import os
from pathlib import Path


def get_project_root() -> Path:
    """Get the nmem-bench project root directory."""
    return Path(__file__).resolve().parents[3]


def get_data_dir() -> Path:
    """Get the data directory for downloaded datasets."""
    d = get_project_root() / "data"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_results_dir() -> Path:
    """Get the results directory."""
    d = get_project_root() / "results"
    d.mkdir(parents=True, exist_ok=True)
    return d
