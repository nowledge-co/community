"""CLI for nmem-bench — benchmark personal memory systems."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.logging import RichHandler
from rich.table import Table

console = Console()


def _setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(message)s",
        handlers=[RichHandler(console=console, show_time=False, show_path=False)],
    )


@click.group()
@click.option("-v", "--verbose", is_flag=True, help="Enable debug logging")
def main(verbose: bool) -> None:
    """nmem-bench: Benchmark personal memory systems against established datasets."""
    _setup_logging(verbose)


@main.command()
@click.option("-b", "--benchmark", type=click.Choice(["locomo", "longmemeval"]), default="locomo")
@click.option("-m", "--search-mode", type=click.Choice(["normal", "deep"]), default="normal")
@click.option("-k", "--top-k", default=10, help="Top-K search results")
@click.option("--answer-model", default="gpt-4o-mini", help="LLM model for answer generation")
@click.option("--judge-model", default="gpt-4o-mini", help="LLM model for judge evaluation")
@click.option("--extraction-level", type=click.Choice(["swift", "comprehensive"]), default="comprehensive")
@click.option("-s", "--sample", multiple=True, help="LoCoMo sample IDs (e.g. conv-26)")
@click.option("-l", "--limit", type=int, default=None, help="Limit number of questions")
@click.option("--skip-distill", is_flag=True, help="Skip distillation (use pre-existing memories)")
@click.option("--skip-llm-judge", is_flag=True, help="Skip LLM-as-judge evaluation")
@click.option("--process-timeout", default=600, help="Timeout for background processing (seconds)")
@click.option("--nmem-path", default=None, help="Path to nmem CLI binary")
@click.option("--api-url", default=None, help="nmem API URL override")
@click.option("--run-id", default=None, help="Custom run ID (for resuming)")
@click.option("-o", "--results-dir", default="results", help="Results output directory")
def run(
    benchmark: str,
    search_mode: str,
    top_k: int,
    answer_model: str,
    judge_model: str,
    extraction_level: str,
    sample: tuple[str, ...],
    limit: int | None,
    skip_distill: bool,
    skip_llm_judge: bool,
    process_timeout: int,
    nmem_path: str | None,
    api_url: str | None,
    run_id: str | None,
    results_dir: str,
) -> None:
    """Run a full benchmark pipeline."""
    from nmem_bench.pipeline.orchestrator import RunConfig, run_benchmark

    config = RunConfig(
        benchmark=benchmark,
        search_mode=search_mode,
        top_k=top_k,
        answer_model=answer_model,
        judge_model=judge_model,
        extraction_level=extraction_level,
        sample_ids=list(sample) if sample else None,
        limit=limit,
        skip_distill=skip_distill,
        skip_llm_judge=skip_llm_judge,
        process_timeout=process_timeout,
        nmem_path=nmem_path,
        api_url=api_url,
        run_id=run_id,
        results_dir=Path(results_dir),
    )

    console.print(f"\n[bold]nmem-bench[/bold] — {benchmark} benchmark")
    console.print(f"  Search mode: {search_mode}")
    console.print(f"  Answer model: {answer_model}")
    console.print(f"  Extraction: {extraction_level}")
    if sample:
        console.print(f"  Samples: {', '.join(sample)}")
    if limit:
        console.print(f"  Question limit: {limit}")
    console.print()

    report_path = run_benchmark(config)
    _print_report_summary(report_path)


@main.command()
@click.argument("report_path", type=click.Path(exists=True))
def report(report_path: str) -> None:
    """Display a benchmark report."""
    _print_report_summary(Path(report_path))


@main.command()
@click.argument("report_paths", nargs=-1, type=click.Path(exists=True))
def compare(report_paths: tuple[str, ...]) -> None:
    """Compare multiple benchmark reports."""
    if len(report_paths) < 2:
        console.print("[red]Need at least 2 reports to compare[/red]")
        sys.exit(1)

    reports = []
    for p in report_paths:
        with open(p) as f:
            reports.append(json.load(f))

    table = Table(title="Benchmark Comparison")
    table.add_column("Metric")
    for r in reports:
        label = f"{r['run_id']}\n{r['search_mode']}"
        table.add_column(label, justify="right")

    # Overall
    table.add_row(
        "F1 Mean",
        *[f"{r['summary']['f1_mean']:.4f}" for r in reports],
    )
    judge_row = []
    for r in reports:
        ja = r["summary"].get("judge_accuracy")
        judge_row.append(f"{ja:.4f}" if ja is not None else "—")
    table.add_row("Judge Accuracy", *judge_row)
    table.add_row(
        "Total Questions",
        *[str(r["summary"]["total_questions"]) for r in reports],
    )

    # Latency
    table.add_row("Search p50 (ms)",
        *[f"{r['latency']['search']['median']:.0f}" for r in reports])
    table.add_row("Search p95 (ms)",
        *[f"{r['latency']['search']['p95']:.0f}" for r in reports])

    # Per-type breakdown
    all_types = set()
    for r in reports:
        all_types.update(r.get("by_question_type", {}).keys())
    for qtype in sorted(all_types):
        scores = []
        for r in reports:
            data = r.get("by_question_type", {}).get(qtype)
            scores.append(f"{data['f1_mean']:.4f}" if data else "—")
        table.add_row(f"  {qtype}", *scores)

    console.print(table)


@main.command()
@click.option("-b", "--benchmark", type=click.Choice(["locomo", "longmemeval"]), default="locomo")
def stats(benchmark: str) -> None:
    """Show benchmark dataset statistics."""
    if benchmark == "locomo":
        from nmem_bench.benchmarks.locomo import LoComoBenchmark
        bench = LoComoBenchmark()
        bench.load()
        s = bench.stats()
        console.print(f"\n[bold]LoCoMo Dataset[/bold]")
        console.print(f"  Conversations: {s['conversations']}")
        console.print(f"  Total sessions: {s['total_sessions']}")
        console.print(f"  Total questions: {s['total_questions']}")
        console.print(f"  By category:")
        for cat, count in sorted(s["by_category"].items()):
            console.print(f"    {cat}: {count}")
    else:
        from nmem_bench.benchmarks.longmemeval import LongMemEvalBenchmark
        bench = LongMemEvalBenchmark()
        bench.load()
        s = bench.stats()
        console.print(f"\n[bold]LongMemEval Dataset[/bold]")
        console.print(f"  Total questions: {s['total_questions']}")
        console.print(f"  By type:")
        for qtype, count in sorted(s["by_type"].items()):
            console.print(f"    {qtype}: {count}")


def _print_report_summary(report_path: Path) -> None:
    """Print a summary of a benchmark report."""
    with open(report_path) as f:
        report = json.load(f)

    s = report["summary"]
    console.print(f"\n[bold green]═══ Benchmark Results ═══[/bold green]")
    console.print(f"  Run: {report['run_id']}")
    console.print(f"  Benchmark: {report['benchmark']}")
    console.print(f"  Mode: {report['search_mode']}")
    console.print()

    # Overall
    table = Table(title="Overall")
    table.add_column("Metric")
    table.add_column("Value", justify="right")
    table.add_row("Questions", str(s["total_questions"]))
    table.add_row("F1 Mean", f"{s['f1_mean']:.4f}")
    if s.get("judge_accuracy") is not None:
        table.add_row("LLM Judge Accuracy", f"{s['judge_accuracy']:.4f}")
    console.print(table)
    console.print()

    # Per-type
    type_table = Table(title="By Question Type")
    type_table.add_column("Type")
    type_table.add_column("Count", justify="right")
    type_table.add_column("F1", justify="right")
    type_table.add_column("Judge", justify="right")
    type_table.add_column("Search p50", justify="right")

    for qtype, data in sorted(report.get("by_question_type", {}).items()):
        judge = f"{data['judge_accuracy']:.2f}" if data.get("judge_accuracy") is not None else "—"
        type_table.add_row(
            qtype,
            str(data["total"]),
            f"{data['f1_mean']:.4f}",
            judge,
            f"{data['search_latency']['median']:.0f}ms",
        )
    console.print(type_table)
    console.print()

    # Latency
    lat_table = Table(title="Latency")
    lat_table.add_column("Phase")
    lat_table.add_column("p50", justify="right")
    lat_table.add_column("p95", justify="right")
    lat_table.add_column("Mean", justify="right")
    for phase in ("search", "answer", "total"):
        lat = report.get("latency", {}).get(phase, {})
        lat_table.add_row(
            phase,
            f"{lat.get('median', 0):.0f}ms",
            f"{lat.get('p95', 0):.0f}ms",
            f"{lat.get('mean', 0):.0f}ms",
        )
    console.print(lat_table)


if __name__ == "__main__":
    main()
