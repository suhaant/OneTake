"""Predicted brain response for a take (TRIBE v2, served by the neuro API in /neuro).

The transcript's word timings go to the neuro API, which returns a raw score, its rank against
the calibration texts, the regions that responded, and a per-vertex map for the 3D viewer.
This is display-only: it does not feed the overall score or the leaderboard, because it has not
been validated as a measure of audience engagement (see neuro/ANALYSIS.md).

The plain-to-formal wording meter shown next to it is not a brain prediction. It is counted from
the transcript itself (wording() below), because the prediction did not sort new formal and plain
texts correctly (Test 4 in neuro/ANALYSIS.md).

The call can take 20 seconds warm and up to 2 minutes from a cold start, so it runs in its own
thread and never delays or fails a submission. Results are cached on disk per submission.
"""
from __future__ import annotations

import json
import logging
import math
import re
import urllib.error
import urllib.request
from pathlib import Path
from threading import Lock, Thread
from typing import Any

from .config import settings
from .transcription import Transcript

logger = logging.getLogger(__name__)
MIN_WORDS = 5
_running: set[str] = set()
_lock = Lock()


def enabled() -> bool: return bool(settings.neuro_score_url)
def _cache(submission_id: str) -> Path: return settings.upload_dir / "neuro" / f"{submission_id}.json"
def _bare(word: str) -> str: return re.sub(r"[^\w']", "", word).lower()


# Wording meter: share of long words minus share of filler words, put on an S-curve from 0 (plain, casual) to 100 (formal).
LONG_WORD = 7  # letters
BALANCED_AT, SPREAD = 0.17, 0.08  # the long-minus-filler share that reads 50, and how fast the curve moves away from it
_FILLERS = {"um", "umm", "uh", "uhh", "er", "erm", "hmm", "yeah", "yep", "okay", "ok", "basically", "literally",
            "kinda", "sorta", "gonna", "wanna", "gotta", "stuff", "guess"}
_FILLER_PHRASES = re.compile(r"\b(you know|i mean|kind of|sort of|or something)\b")
# "like" is a filler unless it follows one of these ("I like", "smelled like", "something like")
_BEFORE_REAL_LIKE = {"i", "you", "we", "they", "would", "do", "don't", "didn't", "really", "just", "much", "more", "to",
                     "look", "looks", "looked", "smell", "smells", "smelled", "feel", "feels", "felt", "sound", "sounds",
                     "sounded", "seem", "seems", "taste", "tastes", "tasted", "something", "anything", "nothing", "people"}


def wording(text: str) -> dict[str, Any] | None:
    """How formal the wording is: 0 (short everyday words, fillers) to 100 (long, formal words)."""
    text = text.lower().replace("\u2019", "'")
    words = re.findall(r"[a-z']+", text)
    if len(words) < MIN_WORDS: return None
    long_words = sum(len(w.replace("'", "")) >= LONG_WORD for w in words) / len(words)
    fillers = sum(w in _FILLERS for w in words) + len(_FILLER_PHRASES.findall(text))
    fillers += sum(w == "like" and (i == 0 or words[i - 1] not in _BEFORE_REAL_LIKE) for i, w in enumerate(words))
    fillers /= len(words)
    formality = 100 / (1 + math.exp(-(long_words - fillers - BALANCED_AT) / SPREAD))
    return {"formality": round(formality), "long_words": round(long_words, 3), "fillers": round(fillers, 3)}


def api_words(transcript: Transcript | dict[str, Any]) -> list[dict[str, Any]]:
    """Transcript -> [{text, start, end}] for the neuro API.

    The API splits sentences on end punctuation. Word-level timestamps often come without any,
    so when the full text has the same words in the same order, its punctuated tokens are used.
    """
    data = transcript.to_dict() if isinstance(transcript, Transcript) else transcript
    words = [{"text": str(w["word"]).strip(), "start": float(w["start_seconds"]), "end": float(w["end_seconds"])} for w in data.get("words", [])]
    words = [w for w in words if w["text"]]
    tokens = str(data.get("text", "")).split()
    if len(tokens) == len(words) and all(_bare(t) == _bare(w["text"]) for t, w in zip(tokens, words)):
        for token, word in zip(tokens, words): word["text"] = token
    return words


def _call(words: list[dict[str, Any]]) -> dict[str, Any]:
    body = json.dumps({"words": words, "brain": True}).encode()
    request = urllib.request.Request(str(settings.neuro_score_url), body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=settings.neuro_timeout_seconds) as response:
        return json.load(response)


def _run(submission_id: str, words: list[dict[str, Any]]) -> None:
    try:
        result: dict[str, Any] = {"status": "completed", **_call(words)}
        result.pop("rois", None)  # 180 raw region means; the ranking already carries what the UI shows
    except Exception as exc:  # the neuro service is optional; never let it break a submission
        detail = exc.read().decode()[:300] if isinstance(exc, urllib.error.HTTPError) else str(exc)
        logger.warning("Neuro prediction for %s failed: %s", submission_id, detail)
        result = {"status": "unavailable", "reason": detail}
    path = _cache(submission_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result))
    with _lock: _running.discard(submission_id)


def start(submission_id: str, transcript: Transcript | dict[str, Any]) -> None:
    """Begin the prediction in the background. Safe to call more than once."""
    if not enabled(): return
    words = api_words(transcript)
    if len(words) < MIN_WORDS: return
    with _lock:
        if submission_id in _running or _cache(submission_id).exists(): return
        _running.add(submission_id)
    Thread(target=_run, args=(submission_id, words), daemon=True).start()


def get(submission_id: str, submission: dict[str, Any]) -> dict[str, Any]:
    """Current state for a submission: completed (with data), processing, unavailable or disabled."""
    if not enabled(): return {"status": "disabled", "reason": "NEURO_SCORE_URL is not set"}
    path = _cache(submission_id)
    if path.exists():
        result = json.loads(path.read_text())
        text = (submission.get("transcript") or {}).get("text")
        if result.get("status") == "completed" and text: result["wording"] = wording(text)
        return result
    with _lock:
        if submission_id in _running: return {"status": "processing"}
    if submission.get("status") == "failed": return {"status": "unavailable", "reason": "The take could not be scored"}
    transcript = submission.get("transcript")
    if not transcript: return {"status": "processing"}  # still transcribing
    if len(api_words(transcript)) < MIN_WORDS: return {"status": "unavailable", "reason": "Too few words to predict a response"}
    start(submission_id, transcript)  # e.g. after a server restart
    return {"status": "processing"}
