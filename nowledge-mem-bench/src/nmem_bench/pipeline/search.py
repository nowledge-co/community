"""Phase 3: Search — query for each benchmark question."""

from __future__ import annotations

import logging
import time

from nmem_bench.benchmarks.types import UnifiedQuestion
from nmem_bench.nmem.client import NmemClient
from nmem_bench.pipeline.checkpoint import RunCheckpoint

logger = logging.getLogger(__name__)


def search_questions(
    questions: list[UnifiedQuestion],
    client: NmemClient,
    checkpoint: RunCheckpoint,
    search_mode: str = "normal",
    top_k: int = 10,
    on_progress: callable = None,
) -> None:
    """Search for context for each question via nmem.

    For each question, calls `nmem m search` and records results + latency.
    """
    total = len(questions)
    searched = 0

    for idx, question in enumerate(questions):
        qstate = checkpoint.get_question(question.question_id)

        if qstate.phase in ("searched", "answered", "evaluated"):
            searched += 1
            continue

        t0 = time.time()
        try:
            results = client.memory_search(
                query=question.question,
                limit=top_k,
                mode=search_mode,
            )
            latency_ms = (time.time() - t0) * 1000

            qstate.search_results = [
                {
                    "memory_id": r.memory_id,
                    "title": r.title,
                    "content": r.content[:500],  # Truncate for checkpoint size
                    "confidence": r.confidence,
                }
                for r in results
            ]
            qstate.search_latency_ms = latency_ms
            qstate.phase = "searched"

        except Exception as e:
            qstate.error = f"Search failed: {e}"
            logger.error("Search failed for %s: %s", question.question_id, e)

        searched += 1
        if searched % 20 == 0 or searched == total:
            checkpoint.save()
            logger.info("[%d/%d] Searched", searched, total)

        if on_progress:
            on_progress(searched, total, question.question_id)

    checkpoint.save()
    logger.info("Search complete: %d questions", total)
