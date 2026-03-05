"""LLM-as-judge evaluation — semantic answer scoring.

Uses an LLM to judge whether a prediction is semantically correct,
handling cases where token-F1 fails (paraphrasing, equivalent answers).
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Judge Prompts (adapted from MemoryBench) ──

DEFAULT_JUDGE_PROMPT = """You are an evaluation judge. Given a question, a correct answer (ground truth), and a model's response (hypothesis), determine if the hypothesis is correct.

The hypothesis is CORRECT if it contains the essential information from the ground truth answer, even if worded differently.

Question: {question}
Ground Truth: {ground_truth}
Hypothesis: {hypothesis}

Respond with ONLY a JSON object:
{{"score": 1, "label": "correct", "explanation": "..."}}
or
{{"score": 0, "label": "incorrect", "explanation": "..."}}"""

ABSTENTION_JUDGE_PROMPT = """You are an evaluation judge. The model should ABSTAIN from answering (say "I don't know" or similar) because the information is not available.

Question: {question}
Ground Truth: {ground_truth}
Hypothesis: {hypothesis}

The hypothesis is CORRECT if the model properly abstains, says "I don't know", indicates uncertainty, or states the information is not available.
The hypothesis is INCORRECT if it provides a specific answer (hallucination).

Respond with ONLY a JSON object:
{{"score": 1, "label": "correct", "explanation": "..."}}
or
{{"score": 0, "label": "incorrect", "explanation": "..."}}"""

TEMPORAL_JUDGE_PROMPT = """You are an evaluation judge for temporal/date questions. Given a question, a correct answer, and a model's response, determine if the hypothesis is correct.

Allow minor date variations (off-by-one day, different date formats referring to the same date).

Question: {question}
Ground Truth: {ground_truth}
Hypothesis: {hypothesis}

Respond with ONLY a JSON object:
{{"score": 1, "label": "correct", "explanation": "..."}}
or
{{"score": 0, "label": "incorrect", "explanation": "..."}}"""

KNOWLEDGE_UPDATE_JUDGE_PROMPT = """You are an evaluation judge for knowledge update questions. The model should reflect the LATEST known information.

Question: {question}
Ground Truth (latest answer): {ground_truth}
Hypothesis: {hypothesis}

The hypothesis is CORRECT if it reflects the updated/latest answer. It may also mention the old answer as context, as long as the latest answer is present.

Respond with ONLY a JSON object:
{{"score": 1, "label": "correct", "explanation": "..."}}
or
{{"score": 0, "label": "incorrect", "explanation": "..."}}"""


def _select_prompt(question_type: str, category: int) -> str:
    """Select the appropriate judge prompt for a question."""
    qt = question_type.lower()
    if category == 5 or "adversarial" in qt or "abstention" in qt:
        return ABSTENTION_JUDGE_PROMPT
    if category == 3 or "temporal" in qt:
        return TEMPORAL_JUDGE_PROMPT
    if "update" in qt or "changing" in qt:
        return KNOWLEDGE_UPDATE_JUDGE_PROMPT
    return DEFAULT_JUDGE_PROMPT


async def judge_answer(
    question: str,
    ground_truth: str,
    hypothesis: str,
    question_type: str = "",
    category: int = 0,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """Use an LLM to judge whether a prediction is correct.

    Returns: {"score": 0|1, "label": "correct"|"incorrect", "explanation": str}
    """
    from litellm import acompletion

    prompt_template = _select_prompt(question_type, category)
    prompt = prompt_template.format(
        question=question,
        ground_truth=ground_truth,
        hypothesis=hypothesis,
    )

    try:
        response = await acompletion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=200,
        )
        content = response.choices[0].message.content.strip()

        # Parse JSON from response
        # Handle cases where response has extra text around JSON
        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(content[start:end])
            return {
                "score": int(result.get("score", 0)),
                "label": result.get("label", "incorrect"),
                "explanation": result.get("explanation", ""),
            }

    except Exception as exc:
        logger.warning("LLM judge failed: %s", exc)
        return {"score": 0, "label": "error", "explanation": f"Judge error: {exc}"}

    return {"score": 0, "label": "error", "explanation": "No valid JSON in judge response"}


def judge_answer_sync(
    question: str,
    ground_truth: str,
    hypothesis: str,
    question_type: str = "",
    category: int = 0,
    model: str = "gpt-4o-mini",
) -> dict[str, Any]:
    """Synchronous wrapper for judge_answer."""
    import asyncio

    return asyncio.run(
        judge_answer(question, ground_truth, hypothesis, question_type, category, model)
    )
