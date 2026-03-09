"""Phase 2: Process — distill threads and wait for KG extraction."""

from __future__ import annotations

import logging

from nmem_bench.nmem.client import NmemClient
from nmem_bench.pipeline.checkpoint import RunCheckpoint

logger = logging.getLogger(__name__)


def distill_threads(
    client: NmemClient,
    checkpoint: RunCheckpoint,
    extraction_level: str = "guided",
    on_progress: callable = None,
) -> None:
    """Distill memories from all ingested threads.

    Finds all checkpoint conversations in "ingested" phase, runs
    `nmem t distill` on each thread, and marks them "distilled".
    Works for both LoCoMo and LongMemEval.
    """
    conversations = [
        (sid, c)
        for sid, c in checkpoint.conversations.items()
        if c.phase == "ingested"
    ]

    if not conversations:
        logger.info("No conversations to distill (all already processed)")
        return

    total = sum(len(c.thread_ids) for _, c in conversations)
    done = 0

    for sample_id, conv_state in conversations:
        logger.info("Distilling %s: %d threads", sample_id, len(conv_state.thread_ids))

        for tid in conv_state.thread_ids:
            try:
                client.thread_distill(tid, extraction_level=extraction_level)
                done += 1
                logger.debug("Distilled thread %s (%d/%d)", tid, done, total)
            except Exception as e:
                logger.error("Distillation failed for thread %s: %s", tid, e)
                done += 1

            if on_progress:
                on_progress(done, total, f"{sample_id}/{tid}")

        conv_state.phase = "distilled"
        checkpoint.save()


def wait_for_processing(
    client: NmemClient,
    checkpoint: RunCheckpoint,
    timeout: int = 600,
    poll_interval: int = 15,
) -> None:
    """Wait for background Knowledge Agent to finish processing.

    After distillation, the Knowledge Agent automatically:
    - Extracts entities and relationships (KG extraction)
    - Detects EVOLVES chains (knowledge evolution)
    - Creates crystals (consolidated knowledge)

    We poll stats until counts stabilize.
    """
    logger.info("Waiting for background processing (timeout=%ds)...", timeout)

    initial = client.stats()
    logger.info(
        "Current: memories=%d, entities=%d, crystals=%d",
        initial.memory_count, initial.entity_count, initial.crystal_count,
    )

    final = client.wait_for_processing(
        initial_stats=initial,
        timeout=timeout,
        poll_interval=poll_interval,
    )

    # Update conversation states
    for sid, conv_state in checkpoint.conversations.items():
        if conv_state.phase == "distilled":
            conv_state.memory_count_after = final.memory_count
            conv_state.phase = "processed"

    checkpoint.save()

    logger.info(
        "Processing complete: memories=%d (+%d), entities=%d, crystals=%d",
        final.memory_count,
        final.memory_count - initial.memory_count,
        final.entity_count,
        final.crystal_count,
    )
