"""Nowledge Mem plugin for Bub — cross-tool knowledge for your agent."""

from . import tools as _tools  # noqa: F401 — registers tools in bub.tools.REGISTRY
from .plugin import plugin

__all__ = ["plugin"]
