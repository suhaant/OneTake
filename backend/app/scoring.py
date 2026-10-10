from __future__ import annotations

import math
from collections.abc import Mapping

# The only metrics that contribute to the overall score.
WEIGHTS = {"eye_contact": .25, "posture": .15, "body_language": .15, "fillers": .20, "language": .25}
VISUAL_METRICS = ("eye_contact", "posture", "body_language")
CATEGORIES = {"body": VISUAL_METRICS, "speech": ("fillers", "language")}


def clamp(value: float) -> float: return round(max(0.0, min(100.0, value)), 2)
def filler_score(per_100_words: float) -> float:
    """1 filler per 100 words is free (normal even for strong speakers); each extra one costs 8 points. Floor 20, like the rubric metrics."""
    return round(max(20.0, min(100.0, 100 - 8 * max(0.0, per_100_words - 1))), 2)


def rubric_score(rating: float) -> float:
    """1–5 rubric × 20 → 20–100: a weak but real attempt should not read as zero."""
    return clamp(rating * 20)


def overall_score(scores: Mapping[str, float], word_count: int) -> float:
    """Weighted mean, renormalized over the metrics available (audio-only uploads have no visual metrics)."""
    available = {name: scores[name] for name in WEIGHTS if name in scores}
    if not available: raise ValueError("No score measurements are available")
    gate = min(1.0, word_count / 30)  # avoids rewarding a near-silent take
    return round(gate * sum(WEIGHTS[name] * value for name, value in available.items()) / sum(WEIGHTS[name] for name in available), 2)


def category_scores(scores: Mapping[str, float]) -> dict[str, float]:
    return {group: round(sum(scores[key] * WEIGHTS[key] for key in keys if key in scores) / sum(WEIGHTS[key] for key in keys if key in scores), 2) for group, keys in CATEGORIES.items() if any(key in scores for key in keys)}
