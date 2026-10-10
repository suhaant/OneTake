"""Shapes a stored submission into the `take` object the Expo app renders (see FRONTEND.md)."""
from __future__ import annotations

import math
from typing import Any

from .scoring import WEIGHTS

LABELS = {"eye_contact": "Eye contact", "posture": "Posture", "body_language": "Body language", "fillers": "Fillers", "language": "Language"}
FOCUS_TITLES = {"eye_contact": "Eyes on the lens.", "posture": "Sit tall, stay still.", "body_language": "Let your hands talk.", "fillers": 'Trade the "um" for a pause.', "language": "Finish every sentence."}
ATTENTION_POINTS = 12


def _resample(values: list[float], points: int = ATTENTION_POINTS) -> list[float]:
    values = [max(0.0, min(1.0, float(v))) for v in values]
    if len(values) < 2: return values
    out = []
    for i in range(points):
        x = i * (len(values) - 1) / (points - 1); lo = math.floor(x); hi = min(lo + 1, len(values) - 1)
        out.append(round(values[lo] + (values[hi] - values[lo]) * (x - lo), 3))
    return out


def build_take(submission: dict[str, Any], standing: dict[str, Any] | None) -> dict[str, Any]:
    metrics, tips = submission["metrics"], submission.get("tips", {})
    standing = standing or {}
    attention = _resample(submission.get("attention", []))
    # Focus on whatever costs the most composite points: weight × (100 − score).
    ranked = sorted(metrics, key=lambda m: WEIGHTS[m] * (100 - metrics[m]), reverse=True)
    focus = ranked[0]
    return {
        "score": round(submission["overall_score"]),
        "breakdown": [{"key": m, "label": LABELS[m], "weight": WEIGHTS[m], "value": round(metrics[m])} for m in WEIGHTS if m in metrics],
        # Three-bar grouping for the existing Voice/Body/Content UI; weights are the summed metric weights.
        "voice": round(metrics["fillers"]), "body": round(submission["categories"]["body"]) if "body" in submission["categories"] else None, "content": round(metrics["language"]),
        "groupWeights": {"voice": WEIGHTS["fillers"], "body": sum(WEIGHTS[m] for m in ("eye_contact", "posture", "body_language")), "content": WEIGHTS["language"]},
        "rank": standing.get("rank"), "total": standing.get("total"), "percentile": standing.get("percentile"), "delta": standing.get("delta"),
        "attention": attention, "attentionAvg": round(sum(attention) / len(attention) * 100) if attention else None,
        "moments": submission.get("moments", [])[:5],
        "focusTitle": FOCUS_TITLES[focus], "focusBody": tips.get(focus) or submission["feedback"]["improvement"],
        "also": [{"label": f"Also: {LABELS[m].lower()}", "value": tips.get(m) or f"{round(metrics[m])} → aim for 80"} for m in ranked[1:3] if metrics[m] < 80],
        "transcript": submission["transcript"]["text"],
    }
