"""Nowledge Mem memory provider plugin for Hermes Agent.

Registers as an external memory provider, replacing the generic MCP
connection with native lifecycle hooks: automatic Working Memory
injection, per-turn recall, user-profile mirroring, and native tools.
"""

from provider import NowledgeMemProvider


def register(ctx) -> None:
    """Plugin entry point called by Hermes plugin loader."""
    ctx.register_memory_provider(NowledgeMemProvider())
