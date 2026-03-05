"""Phase 5: Evaluate — score answers using F1 and LLM judge."""

from __future__ import annotations

import asyncio
import logging

from nmem_bench.benchmarks.types import UnifiedQuestion
from nmem_bench.evaluation.f1 import evaluate_question, evaluate_longmemeval_question
from nmem_bench.evaluation.retrieval import compute_retrieval_metrics
from nmem_bench.pipeline.checkpoint import RunCheckpoint

logger = logging.getLogger(__name__)


def evaluate_f1(
    questions: list[UnifiedQuestion],
    checkpoint: RunCheckpoint,
    on_progress: callable = None,
) -> None:
    """Evaluate answers using token-F1 scoring."""
    total = len(questions)
    evaluated = 0

    for q in questions:
        qstate = checkpoint.get_question(q.question_id)
        if qstate.phase == "evaluated":
            evaluated += 1
            continue
        if qstate.phase != "answered" or not qstate.answer:
            continue

        # F1 scoring
        if q.category > 0:
            # LoCoMo — use category-specific scoring
            qstate.f1_score = evaluate_question(
                qstate.answer, q.ground_truth, q.category
            )
        else:
            # LongMemEval — use type-specific scoring
            qstate.f1_score = evaluate_longmemeval_question(
                qstate.answer, q.ground_truth, q.question_type
            )

        # Retrieval metrics (if evidence available)
        if q.evidence and qstate.search_results:
            contents = [r.get("content", "") for r in qstate.search_results]
            qstate.retrieval_metrics = compute_retrieval_metrics(
                contents, q.evidence
            )

        qstate.phase = "evaluated"
        evaluated += 1

        if on_progress:
            on_progress(evaluated, total, q.question_id)

    checkpoint.save()
    logger.info("F1 evaluation complete: %d questions", evaluated)


def evaluate_llm_judge(
    questions: list[UnifiedQuestion],
    checkpoint: RunCheckpoint,
    judge_model: str = "gpt-4o-mini",
    on_progress: callable = None,
) -> None:
    """Evaluate answers using LLM-as-judge (secondary scoring)."""
    from nmem_bench.evaluation.llm_judge import judge_answer

    total = len(questions)
    judged = 0

    async def _judge_batch(batch):
        nonlocal judged
        for q in batch:
            qstate = checkpoint.get_question(q.question_id)
            if qstate.llm_judge_score >= 0:
                judged += 1
                continue
            if not qstate.answer:
                judged += 1
                continue

            try:
                result = await judge_answer(
                    question=q.question,
                    ground_truth=q.ground_truth,
                    hypothesis=qstate.answer,
                    question_type=q.question_type,
                    category=q.category,
                    model=judge_model,
                )
                qstate.llm_judge_score = result["score"]
                qstate.llm_judge_label = result["label"]
                qstate.llm_judge_explanation = result.get("explanation", "")
            except Exception as e:
                logger.error("LLM judge failed for %s: %s", q.question_id, e)

            judged += 1
            if on_progress:
                on_progress(judged, total, q.question_id)

    # Process in batches
    batch_size = 20
    for i in range(0, len(questions), batch_size):
        batch = questions[i : i + batch_size]
        asyncio.run(_judge_batch(batch))
        checkpoint.save()
        if judged % 50 == 0:
            logger.info("[%d/%d] LLM-judged", judged, total)

    checkpoint.save()
    logger.info("LLM judge evaluation complete: %d questions", judged)
