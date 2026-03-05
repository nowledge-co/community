# nmem-bench

Open-source benchmark for personal memory systems. Evaluates memory retrieval quality using established academic datasets via the `nmem` CLI.

## Supported Benchmarks

| Dataset | Paper | Questions | Categories |
|---------|-------|-----------|------------|
| **LoCoMo** | ACL 2024 | 1,986 | multi-hop, single-hop, temporal, open-domain, adversarial |
| **LongMemEval** | — | ~500 | single-session, multi-session, temporal-reasoning, knowledge-update |

## How It Works

```
Conversations ──► nmem t create ──► Threads
                  nmem t distill ──► Memories + KG extraction
                  (Knowledge Agent) ──► Entities, EVOLVES, Crystals
                  nmem m search ──► Retrieved context
                  LLM ──► Answer
                  Token-F1 + LLM Judge ──► Score
```

The benchmark exercises the **full nowledge-mem pipeline**: thread ingestion, AI distillation, knowledge graph extraction, and hybrid search — measuring end-to-end retrieval quality.

## Quick Start

```bash
# Install
pip install -e .

# Verify nmem CLI is available
nmem status

# Smoke test: 1 conversation, 10 questions
nmem-bench run -b locomo -s conv-26 -l 10

# Full LoCoMo benchmark
nmem-bench run -b locomo

# Fast vs deep mode comparison
nmem-bench run -b locomo -m normal --run-id locomo-fast
nmem-bench run -b locomo -m deep --run-id locomo-deep
nmem-bench compare results/locomo-fast/report.json results/locomo-deep/report.json

# LongMemEval benchmark
nmem-bench run -b longmemeval
```

## CLI Reference

### `nmem-bench run`

Run a full benchmark pipeline (ingest → distill → search → answer → evaluate → report).

| Option | Default | Description |
|--------|---------|-------------|
| `-b`, `--benchmark` | `locomo` | Dataset: `locomo` or `longmemeval` |
| `-m`, `--search-mode` | `normal` | Search mode: `normal` or `deep` |
| `-k`, `--top-k` | `10` | Top-K search results per question |
| `--answer-model` | `gpt-4o-mini` | LLM for answer generation |
| `--judge-model` | `gpt-4o-mini` | LLM for judge evaluation |
| `--extraction-level` | `comprehensive` | Distillation: `swift` or `comprehensive` |
| `-s`, `--sample` | all | LoCoMo sample ID(s) to evaluate |
| `-l`, `--limit` | all | Max questions to evaluate |
| `--skip-distill` | false | Skip distillation (use existing memories) |
| `--skip-llm-judge` | false | Skip LLM judge (F1 only) |
| `--run-id` | auto | Custom run ID (enables resume) |

### `nmem-bench report <path>`

Display results from a previous run.

### `nmem-bench compare <path1> <path2> [...]`

Compare multiple benchmark reports side-by-side.

### `nmem-bench stats`

Show dataset statistics without running a benchmark.

## Metrics

### Token-F1 (primary)
Token-level F1 score between prediction and ground truth. Ported from the LoCoMo evaluation code (ACL 2024). Category-specific handling:
- **Multi-hop**: Mean F1 over comma-split sub-answers
- **Temporal**: F1 on first semicolon-delimited ground truth part
- **Adversarial**: Binary (1 if prediction correctly abstains)

### LLM-as-Judge (secondary)
Uses an LLM to semantically judge correctness. Handles paraphrasing, equivalent date formats, and knowledge updates better than token-F1. Question-type-specific judge prompts.

### Latency
Search and answer generation latency (p50, p95, p99, mean) per question type.

## Resuming Interrupted Runs

Long benchmarks can be interrupted and resumed:

```bash
# Start a run with a named ID
nmem-bench run -b locomo --run-id my-run

# If interrupted, resume with the same ID
nmem-bench run -b locomo --run-id my-run
```

The pipeline checkpoints after each phase per question.

## Output

Each run produces:
- `results/<run-id>/checkpoint.json` — Full pipeline state (for resuming)
- `results/<run-id>/report.json` — Structured results
- `results/<run-id>/report.md` — Human-readable report

## Requirements

- Python 3.10+
- `nmem` CLI installed and connected to a running nowledge-mem instance
- LLM API key (for answer generation + judge): set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.

## Methodology

This benchmark measures **retrieval-augmented QA accuracy** — how well a memory system can find and surface relevant context for answering questions about past conversations.

The pipeline tests the full user-facing workflow:
1. **Thread ingestion**: Conversations stored as threads (like saving a chat session)
2. **Memory distillation**: AI extraction of key facts, decisions, insights
3. **Knowledge graph**: Entity extraction, relationship detection, EVOLVES chains
4. **Search**: Hybrid search (vector + BM25 + entity + community strategies)
5. **Answer**: LLM generates answer from retrieved context
6. **Evaluation**: Token-F1 + LLM-as-judge scoring against ground truth

## License

MIT
