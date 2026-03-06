"""Token-F1 scoring — ported from LoCoMo (ACL 2024).

Computes token-level F1 between prediction and ground truth,
with category-specific handling for LoCoMo question types.
"""

from __future__ import annotations

import string
from collections import Counter

import regex

try:
    from nltk.stem import PorterStemmer
    _stemmer = PorterStemmer()
except ImportError:
    _stemmer = None


# ── Normalization ──

def normalize_answer(s: str) -> str:
    """Normalize answer text for comparison.

    Matches the exact order from LoCoMo reference (evaluation.py):
    comma removal → lowercase → punctuation removal → article removal → whitespace fix.
    """
    s = s.replace(",", "")
    s = s.lower()
    # Remove punctuation (BEFORE articles — order matters for word boundaries)
    exclude = set(string.punctuation)
    s = "".join(ch for ch in s if ch not in exclude)
    # Remove articles
    s = regex.sub(r"\b(a|an|the|and)\b", " ", s)
    # Fix whitespace
    s = " ".join(s.split())
    return s


def _stem(word: str) -> str:
    if _stemmer:
        return _stemmer.stem(word)
    return word


# ── F1 Scoring ──

def f1_score_single(prediction: str, ground_truth: str) -> float:
    """Compute token-level F1 between a single prediction and ground truth."""
    pred_tokens = [_stem(w) for w in normalize_answer(prediction).split()]
    gt_tokens = [_stem(w) for w in normalize_answer(ground_truth).split()]

    if not pred_tokens or not gt_tokens:
        return 0.0

    common = Counter(pred_tokens) & Counter(gt_tokens)
    num_same = sum(common.values())

    if num_same == 0:
        return 0.0

    precision = num_same / len(pred_tokens)
    recall = num_same / len(gt_tokens)
    return (2 * precision * recall) / (precision + recall)


def f1_score_multi(prediction: str, ground_truth: str) -> float:
    """F1 for multi-answer questions (comma-separated ground truth).

    For each ground truth sub-answer, find the best-matching prediction
    sub-answer and average the F1 scores.
    """
    predictions = [p.strip() for p in prediction.split(",")]
    ground_truths = [g.strip() for g in ground_truth.split(",")]

    scores = []
    for gt in ground_truths:
        best = max(f1_score_single(pred, gt) for pred in predictions)
        scores.append(best)

    return sum(scores) / len(scores) if scores else 0.0


# ── Category-specific evaluation ──

def evaluate_question(prediction: str, ground_truth: str, category: int) -> float:
    """Evaluate a single QA pair using category-specific scoring.

    Categories (LoCoMo):
        1: multi-hop — split ground truth by comma, compute partial F1
        2: single-hop — standard token-F1
        3: temporal — token-F1 on first semicolon-delimited part
        4: open-domain — standard token-F1
        5: adversarial — binary (1 if prediction indicates "not mentioned")

    For LongMemEval question types, use the type name instead of numeric category.
    """
    if category == 5:
        # Adversarial: binary abstention check.
        # Matches LoCoMo reference exactly — only these 2 phrases.
        pred_lower = prediction.lower()
        if "no information available" in pred_lower or "not mentioned" in pred_lower:
            return 1.0
        return 0.0

    if category == 3:
        # Temporal: use first semicolon-delimited part of ground truth
        ground_truth = ground_truth.split(";")[0].strip()
        return f1_score_single(prediction, ground_truth)

    if category == 1:
        # Multi-hop: split and compute partial F1
        return f1_score_multi(prediction, ground_truth)

    # Categories 2, 4 and default: standard F1
    return f1_score_single(prediction, ground_truth)


def evaluate_longmemeval_question(
    prediction: str, ground_truth: str, question_type: str
) -> float:
    """Evaluate a LongMemEval question using type-specific scoring."""
    if "abstention" in question_type or "adversarial" in question_type:
        return evaluate_question(prediction, ground_truth, category=5)
    if "temporal" in question_type:
        return evaluate_question(prediction, ground_truth, category=3)
    if "multi" in question_type:
        return evaluate_question(prediction, ground_truth, category=1)
    # Default: standard F1
    return f1_score_single(prediction, ground_truth)
