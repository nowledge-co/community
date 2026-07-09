from __future__ import annotations

import unittest

from nmem_bench.llm import completion_kwargs, resolve_litellm_model


class LitellmParamsTest(unittest.TestCase):
    def test_resolve_litellm_model_adds_known_provider_prefixes(self) -> None:
        self.assertEqual(resolve_litellm_model("gpt-4o-mini"), "openai/gpt-4o-mini")
        self.assertEqual(
            resolve_litellm_model("chatgpt-4o-latest"),
            "openai/chatgpt-4o-latest",
        )
        self.assertEqual(resolve_litellm_model("o4-mini"), "openai/o4-mini")
        self.assertEqual(
            resolve_litellm_model("claude-sonnet-4-20250514"),
            "anthropic/claude-sonnet-4-20250514",
        )

    def test_resolve_litellm_model_preserves_explicit_routes(self) -> None:
        self.assertEqual(
            resolve_litellm_model("anthropic/claude-sonnet-4"),
            "anthropic/claude-sonnet-4",
        )
        self.assertEqual(
            resolve_litellm_model("openai/gpt-4o-mini"),
            "openai/gpt-4o-mini",
        )
        self.assertEqual(resolve_litellm_model("ollama/qwen3"), "ollama/qwen3")

    def test_completion_kwargs_make_provider_routing_deterministic(self) -> None:
        params = completion_kwargs("gpt-4o-mini", "Question?", max_tokens=150)
        self.assertEqual(params["model"], "openai/gpt-4o-mini")
        self.assertEqual(params["messages"], [{"role": "user", "content": "Question?"}])
        self.assertEqual(params["temperature"], 0)
        self.assertEqual(params["max_tokens"], 150)
        self.assertIs(params["store"], False)
        self.assertIs(params["drop_params"], True)


if __name__ == "__main__":
    unittest.main()
