"""Shared LiteLLM call helpers for nmem-bench.

The benchmark accepts plain model names on the CLI because that is what most
users type. LiteLLM can route those ambiguous names through provider fallback
paths, including OpenAI Responses, before reaching the intended provider. Keep
the benchmark deterministic by giving LiteLLM explicit provider hints for the
model families we know.
"""

from __future__ import annotations

from typing import Any


def resolve_litellm_model(model: str) -> str:
    """Return a LiteLLM model string with an explicit provider when safe."""
    normalized = model.strip()
    if not normalized:
        return normalized

    # Existing LiteLLM provider prefixes, deployment names, and OpenAI-compatible
    # custom routes are already explicit. Do not rewrite them.
    if "/" in normalized:
        return normalized

    lower = normalized.lower()
    if lower.startswith("claude-"):
        return f"anthropic/{normalized}"
    if lower.startswith(("gpt-", "chatgpt-", "o1", "o3", "o4")):
        return f"openai/{normalized}"
    return normalized


def completion_kwargs(model: str, prompt: str, max_tokens: int) -> dict[str, Any]:
    """Build deterministic LiteLLM completion params for answer/judge calls."""
    return {
        "model": resolve_litellm_model(model),
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": max_tokens,
        # OpenAI Responses requires store=false in several hosted/proxy setups.
        # For providers that do not accept it, drop_params lets LiteLLM filter
        # the field after provider resolution.
        "store": False,
        "drop_params": True,
    }
