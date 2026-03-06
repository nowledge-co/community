"""Phase 1: Ingest — load conversations/documents into nowledge-mem."""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from nmem_bench.benchmarks.locomo import LoComoBenchmark
from nmem_bench.benchmarks.longmemeval import LongMemEvalBenchmark
from nmem_bench.benchmarks.types import UnifiedSession
from nmem_bench.nmem.client import NmemClient
from nmem_bench.pipeline.checkpoint import RunCheckpoint

logger = logging.getLogger(__name__)


def _write_session_md(session: UnifiedSession, tmp_dir: Path) -> Path:
    """Write a session as markdown to a temp file."""
    md = session.to_markdown()
    path = tmp_dir / f"{session.session_id}.md"
    path.write_text(md)
    return path


def ingest_locomo(
    benchmark: LoComoBenchmark,
    client: NmemClient,
    checkpoint: RunCheckpoint,
    sample_ids: list[str] | None = None,
    on_progress: callable = None,
) -> None:
    """Ingest LoCoMo conversations as threads.

    Each session becomes a separate thread, preserving temporal structure.
    """
    ids = sample_ids or benchmark.sample_ids
    total = len(ids)

    with tempfile.TemporaryDirectory(prefix="nmem-bench-") as tmp_dir:
        tmp_path = Path(tmp_dir)

        for idx, sample_id in enumerate(ids):
            conv_state = checkpoint.get_conversation(sample_id)

            if conv_state.phase in ("ingested", "distilled", "processed"):
                logger.info("Skipping %s (already %s)", sample_id, conv_state.phase)
                continue

            sessions = benchmark.get_sessions(sample_id)
            logger.info(
                "[%d/%d] Ingesting %s: %d sessions",
                idx + 1, total, sample_id, len(sessions),
            )

            # Record baseline stats
            stats = client.stats()
            conv_state.memory_count_before = stats.memory_count

            thread_ids = []
            for session in sessions:
                md_path = _write_session_md(session, tmp_path)
                title = (
                    f"LoCoMo {sample_id} Session {session.metadata.get('session_num', '?')}"
                    f" ({session.date})"
                )
                try:
                    info = client.thread_create_from_file(title=title, file_path=md_path)
                    thread_ids.append(info.thread_id)
                    logger.debug("Created thread %s: %s", info.thread_id, title)
                except Exception as e:
                    logger.error("Failed to create thread for %s: %s", session.session_id, e)

            conv_state.thread_ids = thread_ids
            conv_state.phase = "ingested"
            checkpoint.save()

            if on_progress:
                on_progress(idx + 1, total, sample_id)


def ingest_longmemeval(
    benchmark: LongMemEvalBenchmark,
    client: NmemClient,
    checkpoint: RunCheckpoint,
    question_ids: list[str] | None = None,
    on_progress: callable = None,
) -> None:
    """Ingest LongMemEval haystack sessions as threads.

    Each question's haystack sessions become threads.
    Deduplicates sessions that appear in multiple questions.
    Thread IDs are stored in a single ConversationState keyed as "__longmemeval__".
    """
    conv_state = checkpoint.get_conversation("__longmemeval__")
    if conv_state.phase in ("ingested", "distilled", "processed"):
        logger.info("LongMemEval already ingested (%s)", conv_state.phase)
        return

    questions = benchmark.get_questions()
    if question_ids:
        questions = [q for q in questions if q.question_id in question_ids]

    # Collect all unique sessions across questions
    ingested_sessions: set[str] = set()
    thread_ids: list[str] = []
    total = len(questions)

    stats = client.stats()
    conv_state.memory_count_before = stats.memory_count

    with tempfile.TemporaryDirectory(prefix="nmem-bench-lme-") as tmp_dir:
        tmp_path = Path(tmp_dir)

        for idx, question in enumerate(questions):
            sessions = benchmark.get_sessions(question.question_id)

            for session in sessions:
                if session.session_id in ingested_sessions:
                    continue

                md_path = _write_session_md(session, tmp_path)
                title = f"LongMemEval {session.session_id}"
                if session.date:
                    title += f" ({session.date})"

                try:
                    info = client.thread_create_from_file(title=title, file_path=md_path)
                    thread_ids.append(info.thread_id)
                    ingested_sessions.add(session.session_id)
                except Exception as e:
                    logger.error("Failed to ingest session %s: %s", session.session_id, e)

            if on_progress:
                on_progress(idx + 1, total, question.question_id)

    conv_state.thread_ids = thread_ids
    conv_state.phase = "ingested"
    checkpoint.save()

    logger.info(
        "Ingested %d unique sessions (%d threads) for %d questions",
        len(ingested_sessions), len(thread_ids), total,
    )
