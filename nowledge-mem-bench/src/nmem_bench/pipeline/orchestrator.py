"""Pipeline orchestrator — coordinates all benchmark phases."""

from __future__ import annotations

import datetime
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from nmem_bench.benchmarks.locomo import LoComoBenchmark
from nmem_bench.benchmarks.longmemeval import LongMemEvalBenchmark
from nmem_bench.benchmarks.types import UnifiedQuestion
from nmem_bench.nmem.client import NmemClient
from nmem_bench.pipeline.checkpoint import RunCheckpoint

logger = logging.getLogger(__name__)


@dataclass
class RunConfig:
    benchmark: str = "locomo"
    search_mode: str = "normal"
    top_k: int = 10
    answer_model: str = "gpt-4o-mini"
    judge_model: str = "gpt-4o-mini"
    extraction_level: str = "comprehensive"
    sample_ids: list[str] | None = None  # LoCoMo: filter to specific conversations
    limit: int | None = None  # Limit number of questions
    skip_distill: bool = False
    skip_llm_judge: bool = False
    process_timeout: int = 600
    nmem_path: str | None = None
    api_url: str | None = None
    run_id: str | None = None
    results_dir: Path = field(default_factory=lambda: Path("results"))


def _generate_run_id(config: RunConfig) -> str:
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{config.benchmark}-{config.search_mode}-{ts}"


def run_benchmark(config: RunConfig) -> Path:
    """Execute a full benchmark run and return the report path."""
    from nmem_bench.pipeline.ingest import ingest_locomo, ingest_longmemeval
    from nmem_bench.pipeline.process import distill_threads, wait_for_processing
    from nmem_bench.pipeline.search import search_questions
    from nmem_bench.pipeline.answer import answer_questions
    from nmem_bench.pipeline.evaluate import evaluate_f1, evaluate_llm_judge

    run_id = config.run_id or _generate_run_id(config)
    run_dir = config.results_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    checkpoint_path = run_dir / "checkpoint.json"

    # Load or create checkpoint
    if checkpoint_path.exists():
        checkpoint = RunCheckpoint.load(checkpoint_path)
        logger.info("Resuming run %s", run_id)
    else:
        checkpoint = RunCheckpoint(
            run_id=run_id,
            benchmark=config.benchmark,
            search_mode=config.search_mode,
            answer_model=config.answer_model,
            judge_model=config.judge_model,
            started_at=datetime.datetime.now().isoformat(),
            save_path=checkpoint_path,
        )
    checkpoint.save_path = checkpoint_path

    # Initialize nmem client
    client = NmemClient(nmem_path=config.nmem_path, api_url=config.api_url)

    # Progress callback
    def _progress(done, total, label=""):
        pct = done / total * 100 if total else 0
        logger.info("  [%d/%d] %.0f%% %s", done, total, pct, label)

    if config.benchmark == "locomo":
        # ── Load LoCoMo ──
        bench = LoComoBenchmark()
        bench.load()
        logger.info("Dataset stats: %s", bench.stats())

        # Phase 1: Ingest
        logger.info("═══ Phase 1: INGEST ═══")
        ingest_locomo(
            bench, client, checkpoint,
            sample_ids=config.sample_ids,
            on_progress=_progress,
        )

        # Phase 2: Process (distill + KG)
        if not config.skip_distill:
            logger.info("═══ Phase 2: PROCESS (distill + KG) ═══")
            distill_threads(
                client, checkpoint,
                extraction_level=config.extraction_level,
                on_progress=_progress,
            )
            wait_for_processing(
                client, checkpoint,
                timeout=config.process_timeout,
            )

        # Get questions — collect from all specified samples (or all)
        if config.sample_ids:
            all_qs: list[UnifiedQuestion] = []
            for sid in config.sample_ids:
                all_qs.extend(bench.get_questions(sample_id=sid))
            if config.limit:
                all_qs = all_qs[: config.limit]
            questions = all_qs
        else:
            questions = bench.get_questions(limit=config.limit)

    elif config.benchmark == "longmemeval":
        # ── Load LongMemEval ──
        bench = LongMemEvalBenchmark()
        bench.load()
        logger.info("Dataset stats: %s", bench.stats())

        # Phase 1: Ingest
        logger.info("═══ Phase 1: INGEST ═══")
        ingest_longmemeval(
            bench, client, checkpoint,
            on_progress=_progress,
        )

        # Phase 2: Process (distill + KG)
        if not config.skip_distill:
            logger.info("═══ Phase 2: PROCESS (distill + KG) ═══")
            distill_threads(
                client, checkpoint,
                extraction_level=config.extraction_level,
                on_progress=_progress,
            )
            wait_for_processing(
                client, checkpoint,
                timeout=config.process_timeout,
            )

        questions = bench.get_questions(limit=config.limit)

    else:
        raise ValueError(f"Unknown benchmark: {config.benchmark}")

    logger.info("Total questions to evaluate: %d", len(questions))

    # Phase 3: Search
    logger.info("═══ Phase 3: SEARCH ═══")
    search_questions(
        questions, client, checkpoint,
        search_mode=config.search_mode,
        top_k=config.top_k,
        on_progress=_progress,
    )

    # Phase 4: Answer
    logger.info("═══ Phase 4: ANSWER ═══")
    answer_questions(
        questions, checkpoint,
        model=config.answer_model,
        on_progress=_progress,
    )

    # Phase 5: Evaluate
    logger.info("═══ Phase 5: EVALUATE (F1) ═══")
    evaluate_f1(questions, checkpoint, on_progress=_progress)

    if not config.skip_llm_judge:
        logger.info("═══ Phase 5b: EVALUATE (LLM Judge) ═══")
        evaluate_llm_judge(
            questions, checkpoint,
            judge_model=config.judge_model,
            on_progress=_progress,
        )

    # Phase 6: Report
    logger.info("═══ Phase 6: REPORT ═══")
    report = generate_report(questions, checkpoint, config)
    report_json_path = run_dir / "report.json"
    report_md_path = run_dir / "report.md"

    with open(report_json_path, "w") as f:
        json.dump(report, f, indent=2)

    md = render_report_markdown(report)
    with open(report_md_path, "w") as f:
        f.write(md)

    logger.info("Report saved: %s", report_json_path)
    logger.info("Report (MD): %s", report_md_path)

    return report_json_path


# ── Report Generation ──


def _latency_stats(values: list[float]) -> dict[str, float]:
    """Compute latency statistics from a list of durations (ms)."""
    if not values:
        return {"min": 0, "max": 0, "mean": 0, "median": 0, "p95": 0, "p99": 0, "count": 0}
    values = sorted(values)
    n = len(values)
    return {
        "min": round(values[0], 1),
        "max": round(values[-1], 1),
        "mean": round(sum(values) / n, 1),
        "median": round(values[n // 2], 1),
        "p95": round(values[int(n * 0.95)], 1) if n > 1 else round(values[0], 1),
        "p99": round(values[int(n * 0.99)], 1) if n > 1 else round(values[0], 1),
        "count": n,
    }


def generate_report(
    questions: list[UnifiedQuestion],
    checkpoint: RunCheckpoint,
    config: RunConfig,
) -> dict[str, Any]:
    """Generate structured benchmark report."""
    q_map = {q.question_id: q for q in questions}

    # Aggregate by question type
    by_type: dict[str, dict[str, Any]] = {}
    all_f1: list[float] = []
    all_judge: list[int] = []
    search_latencies: list[float] = []
    answer_latencies: list[float] = []

    for qid, qstate in checkpoint.questions.items():
        q = q_map.get(qid)
        if not q or qstate.phase != "evaluated":
            continue

        qtype = q.question_type
        if qtype not in by_type:
            by_type[qtype] = {
                "total": 0, "f1_scores": [], "judge_scores": [],
                "search_latencies": [], "answer_latencies": [],
            }

        entry = by_type[qtype]
        entry["total"] += 1
        entry["f1_scores"].append(qstate.f1_score)
        if qstate.llm_judge_score >= 0:
            entry["judge_scores"].append(qstate.llm_judge_score)
        entry["search_latencies"].append(qstate.search_latency_ms)
        entry["answer_latencies"].append(qstate.answer_latency_ms)

        all_f1.append(qstate.f1_score)
        if qstate.llm_judge_score >= 0:
            all_judge.append(qstate.llm_judge_score)
        search_latencies.append(qstate.search_latency_ms)
        answer_latencies.append(qstate.answer_latency_ms)

    # Build per-type summary
    type_summary = {}
    for qtype, data in sorted(by_type.items()):
        avg_f1 = sum(data["f1_scores"]) / len(data["f1_scores"]) if data["f1_scores"] else 0
        avg_judge = sum(data["judge_scores"]) / len(data["judge_scores"]) if data["judge_scores"] else None
        type_summary[qtype] = {
            "total": data["total"],
            "f1_mean": round(avg_f1, 4),
            "judge_accuracy": round(avg_judge, 4) if avg_judge is not None else None,
            "search_latency": _latency_stats(data["search_latencies"]),
            "answer_latency": _latency_stats(data["answer_latencies"]),
        }

    overall_f1 = sum(all_f1) / len(all_f1) if all_f1 else 0
    overall_judge = sum(all_judge) / len(all_judge) if all_judge else None

    return {
        "run_id": checkpoint.run_id,
        "benchmark": config.benchmark,
        "search_mode": config.search_mode,
        "answer_model": config.answer_model,
        "judge_model": config.judge_model,
        "extraction_level": config.extraction_level,
        "timestamp": datetime.datetime.now().isoformat(),
        "summary": {
            "total_questions": len(all_f1),
            "f1_mean": round(overall_f1, 4),
            "judge_accuracy": round(overall_judge, 4) if overall_judge is not None else None,
        },
        "by_question_type": type_summary,
        "latency": {
            "search": _latency_stats(search_latencies),
            "answer": _latency_stats(answer_latencies),
            "total": _latency_stats(
                [s + a for s, a in zip(search_latencies, answer_latencies)]
            ),
        },
        "pipeline": {
            "conversations_ingested": len(checkpoint.conversations),
            "threads_created": sum(
                len(c.thread_ids) for c in checkpoint.conversations.values()
            ),
        },
    }


def render_report_markdown(report: dict[str, Any]) -> str:
    """Render a report dict as markdown."""
    lines = []
    lines.append(f"# Benchmark Report: {report['benchmark']}")
    lines.append("")
    lines.append(f"- **Run ID**: {report['run_id']}")
    lines.append(f"- **Search mode**: {report['search_mode']}")
    lines.append(f"- **Answer model**: {report['answer_model']}")
    lines.append(f"- **Extraction level**: {report['extraction_level']}")
    lines.append(f"- **Timestamp**: {report['timestamp']}")
    lines.append("")

    s = report["summary"]
    lines.append("## Overall Results")
    lines.append("")
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| Total Questions | {s['total_questions']} |")
    lines.append(f"| F1 Score (mean) | {s['f1_mean']:.4f} |")
    if s.get("judge_accuracy") is not None:
        lines.append(f"| LLM Judge Accuracy | {s['judge_accuracy']:.4f} |")
    lines.append("")

    # Per-type breakdown
    lines.append("## Results by Question Type")
    lines.append("")
    lines.append("| Type | Count | F1 Mean | Judge Acc | Search p50 (ms) | Answer p50 (ms) |")
    lines.append("|------|-------|---------|-----------|-----------------|-----------------|")
    for qtype, data in report.get("by_question_type", {}).items():
        judge = f"{data['judge_accuracy']:.2f}" if data.get("judge_accuracy") is not None else "—"
        lines.append(
            f"| {qtype} | {data['total']} | {data['f1_mean']:.4f} | {judge} "
            f"| {data['search_latency']['median']:.0f} | {data['answer_latency']['median']:.0f} |"
        )
    lines.append("")

    # Latency
    lines.append("## Latency Summary")
    lines.append("")
    lines.append("| Phase | p50 (ms) | p95 (ms) | p99 (ms) | Mean (ms) |")
    lines.append("|-------|----------|----------|----------|-----------|")
    for phase in ("search", "answer", "total"):
        lat = report.get("latency", {}).get(phase, {})
        lines.append(
            f"| {phase} | {lat.get('median', 0):.0f} | {lat.get('p95', 0):.0f} "
            f"| {lat.get('p99', 0):.0f} | {lat.get('mean', 0):.0f} |"
        )
    lines.append("")

    # Pipeline info
    p = report.get("pipeline", {})
    lines.append("## Pipeline Stats")
    lines.append("")
    lines.append(f"- Conversations ingested: {p.get('conversations_ingested', 0)}")
    lines.append(f"- Threads created: {p.get('threads_created', 0)}")
    lines.append("")

    return "\n".join(lines)
