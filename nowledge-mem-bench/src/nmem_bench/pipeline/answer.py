"""Phase 4: Answer — generate answers using LLM + retrieved context."""

from __future__ import annotations

import asyncio
import logging
import time

from nmem_bench.benchmarks.types import UnifiedQuestion
from nmem_bench.pipeline.checkpoint import RunCheckpoint

logger = logging.getLogger(__name__)

# ── Answer prompts ──

QA_PROMPT = """Based on the retrieved memories below, answer the question.

Retrieved Memories:
{context}

Question: {question}

Instructions:
- Answer with a short phrase using information from the memories.
- If the memories don't contain relevant information, say "No information available."
- Be concise — answer in a few words or a short sentence.

Answer:"""


def _format_context(search_results: list[dict]) -> str:
    """Format search results as context for the LLM."""
    if not search_results:
        return "(No relevant memories found)"

    parts = []
    for i, r in enumerate(search_results, 1):
        title = r.get("title", "")
        content = r.get("content", "")
        confidence = r.get("confidence", 0)
        header = f"[Memory {i}]"
        if title:
            header += f" {title}"
        header += f" (relevance: {confidence:.2f})"
        parts.append(f"{header}\n{content}")

    return "\n\n".join(parts)


async def _generate_answer(
    question: UnifiedQuestion,
    context: str,
    model: str,
) -> str:
    """Generate an answer using the LLM."""
    from litellm import acompletion

    prompt = QA_PROMPT.format(context=context, question=question.question)

    response = await acompletion(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=150,
    )
    return response.choices[0].message.content.strip()


async def _answer_one(
    q: UnifiedQuestion,
    qstate: "QuestionState",
    context: str,
    model: str,
    sem: asyncio.Semaphore,
) -> None:
    """Answer a single question with semaphore-bounded concurrency."""
    from nmem_bench.pipeline.checkpoint import QuestionState

    async with sem:
        t0 = time.time()
        try:
            answer = await _generate_answer(q, context, model)
            qstate.answer = answer
            qstate.answer_latency_ms = (time.time() - t0) * 1000
            qstate.phase = "answered"
        except Exception as e:
            qstate.error = f"Answer failed: {e}"
            logger.error("Answer generation failed for %s: %s", q.question_id, e)


def answer_questions(
    questions: list[UnifiedQuestion],
    checkpoint: RunCheckpoint,
    model: str = "gpt-4o-mini",
    concurrency: int = 5,
    on_progress: callable = None,
) -> None:
    """Generate answers for all searched questions.

    Uses asyncio.gather with a semaphore for bounded concurrent LLM calls.
    Checkpoints after each batch.
    """
    total = len(questions)
    answered = 0

    async def _process_batch(batch):
        nonlocal answered
        sem = asyncio.Semaphore(concurrency)
        tasks = []

        for q in batch:
            qstate = checkpoint.get_question(q.question_id)
            if qstate.phase in ("answered", "evaluated"):
                answered += 1
                continue
            if qstate.phase != "searched":
                continue

            context = _format_context(qstate.search_results)
            tasks.append(_answer_one(q, qstate, context, model, sem))

        if tasks:
            await asyncio.gather(*tasks)
            answered += len(tasks)

        if on_progress:
            on_progress(answered, total, "")

        checkpoint.save()

    # Process in batches for checkpointing
    batch_size = concurrency * 4
    for i in range(0, len(questions), batch_size):
        batch = questions[i : i + batch_size]
        asyncio.run(_process_batch(batch))
        if answered % 50 == 0:
            logger.info("[%d/%d] Answered", answered, total)

    checkpoint.save()
    logger.info("Answer generation complete: %d questions", total)
