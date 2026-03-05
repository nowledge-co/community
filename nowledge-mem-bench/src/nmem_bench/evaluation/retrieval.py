"""Retrieval quality metrics — Hit@K, MRR, NDCG."""

from __future__ import annotations

import math


def hit_at_k(
    retrieved_contents: list[str],
    evidence_texts: list[str],
    k: int = 10,
) -> float:
    """Was any relevant evidence found in top-K results?

    Returns 1.0 if at least one evidence text appears in top-K retrieved contents.
    Uses substring matching since evidence IDs may not match exactly.
    """
    top_k = retrieved_contents[:k]
    for evidence in evidence_texts:
        evidence_lower = evidence.lower()
        for content in top_k:
            if evidence_lower in content.lower():
                return 1.0
    return 0.0


def mrr(
    retrieved_contents: list[str],
    evidence_texts: list[str],
) -> float:
    """Mean Reciprocal Rank — position of first relevant result.

    Returns 1/rank of the first retrieved item containing any evidence text.
    """
    for i, content in enumerate(retrieved_contents):
        content_lower = content.lower()
        for evidence in evidence_texts:
            if evidence.lower() in content_lower:
                return 1.0 / (i + 1)
    return 0.0


def ndcg_at_k(
    retrieved_contents: list[str],
    evidence_texts: list[str],
    k: int = 10,
) -> float:
    """Normalized Discounted Cumulative Gain at K."""
    top_k = retrieved_contents[:k]

    # Binary relevance: 1 if content contains any evidence
    relevances = []
    for content in top_k:
        content_lower = content.lower()
        rel = 0.0
        for evidence in evidence_texts:
            if evidence.lower() in content_lower:
                rel = 1.0
                break
        relevances.append(rel)

    # DCG
    dcg = sum(rel / math.log2(i + 2) for i, rel in enumerate(relevances))

    # Ideal DCG (all relevant items first)
    n_relevant = min(len(evidence_texts), k)
    idcg = sum(1.0 / math.log2(i + 2) for i in range(n_relevant))

    return dcg / idcg if idcg > 0 else 0.0


def compute_retrieval_metrics(
    retrieved_contents: list[str],
    evidence_texts: list[str],
    k: int = 10,
) -> dict[str, float]:
    """Compute all retrieval metrics."""
    return {
        "hit_at_k": hit_at_k(retrieved_contents, evidence_texts, k),
        "mrr": mrr(retrieved_contents, evidence_texts),
        "ndcg_at_k": ndcg_at_k(retrieved_contents, evidence_texts, k),
        "k": k,
    }
