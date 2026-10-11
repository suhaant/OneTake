"""Shapes a stored submission into the `take` object the Expo app renders (see FRONTEND.md)."""
from __future__ import annotations

import math
from typing import Any

from .scoring import WEIGHTS

LABELS = {"eye_contact": "Eye contact", "posture": "Posture", "body_language": "Body language", "fillers": "Fillers", "language": "Language"}
SUBCATEGORIES = {"eye_contact": "Eye contact", "posture": "Posture", "body_language": "Body language", "fillers": "Filler words", "vocabulary": "Vocabulary", "sentence_structure": "Sentence structure"}
NEEDS_WORK_BELOW = 80
FOCUS_TITLES = {"eye_contact": "Eyes on the lens.", "posture": "Sit tall, stay still.", "body_language": "Let your hands talk.", "fillers": 'Trade the "um" for a pause.', "language": "Finish every sentence.", "vocabulary": "Pick sharper words.", "sentence_structure": "Finish every sentence."}
ATTENTION_POINTS = 12


def _resample(values: list[float], points: int = ATTENTION_POINTS) -> list[float]:
    values = [max(0.0, min(1.0, float(v))) for v in values]
    if len(values) < 2: return values
    out = []
    for i in range(points):
        x = i * (len(values) - 1) / (points - 1); lo = math.floor(x); hi = min(lo + 1, len(values) - 1)
        out.append(round(values[lo] + (values[hi] - values[lo]) * (x - lo), 3))
    return out


def _details_text(submission: dict[str, Any]) -> dict[str, str]:
    """The raw measurement behind each subcategory score, so the number can be explained."""
    m, d, audio = submission.get("measurements") or {}, submission["metric_details"], submission["audio"]
    text = {"fillers": f"{submission['fillers']['total']} fillers in {audio['word_count']} words ({audio['fillers_per_100_words']} per 100)",
            "vocabulary": f"Rated {round(d['vocabulary'] / 20)}/5", "sentence_structure": f"Rated {round(d['sentence_structure'] / 20)}/5"}
    if m:
        text |= {"eye_contact": f"On the lens {m['eye_contact_ratio']:.0%} of the time", "posture": f"Upright and steady {m['upright_ratio']:.0%} of the time",
                 "body_language": f"Gesturing {m['gesture_ratio']:.0%} of the time, touching your face {m['face_touch_ratio']:.0%}"}
    return text


def build_take(submission: dict[str, Any], standing: dict[str, Any] | None) -> dict[str, Any]:
    metrics, details, suggestions = submission["metrics"], submission["metric_details"], submission["suggestions"]
    # Language is two subcategories; its tip comes from whichever of the two scored lower.
    weaker_language = min(("vocabulary", "sentence_structure"), key=lambda k: details[k])
    tips = {**suggestions, "language": suggestions[weaker_language]}
    standing, measured = standing or {}, _details_text(submission)
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
        "focusTitle": FOCUS_TITLES[weaker_language if focus == "language" else focus], "focusBody": tips.get(focus) or submission["feedback"]["improvement"],
        "also": [{"label": f"Also: {LABELS[m].lower()}", "value": tips.get(m) or f"{round(metrics[m])} → aim for 80"} for m in ranked[1:3] if metrics[m] < 80],
        "subcategories": [{"key": k, "label": label, "score": round(details[k]), "measured": measured.get(k), "suggestion": suggestions[k] if details[k] < NEEDS_WORK_BELOW else None}
                          for k, label in SUBCATEGORIES.items() if k in details],
        "fillers": {"total": submission["fillers"]["total"], "per100Words": submission["audio"]["fillers_per_100_words"],
                    "found": submission["fillers"]["sounds"] + submission["fillers"]["repeats"] + [f"{r} (restart)" for r in submission["fillers"]["restarts"]] + [f["word"] for f in submission["fillers"]["contextual"]]},
        "transcript": submission["transcript"]["text"],
    }
