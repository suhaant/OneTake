from __future__ import annotations

import re
import wave
from pathlib import Path

from .transcription import Transcript

FILLER_PATTERN = re.compile(r"\b(?:um+|uh+|er+|ah+|hmm+)\b", re.I)


def count_fillers(transcript: str) -> int:
    """Counts unambiguous verbal fillers only; 'like' and 'you know' need context."""
    return len(FILLER_PATTERN.findall(transcript))


def wav_duration_seconds(path: str | Path) -> float:
    with wave.open(str(path), "rb") as audio: return audio.getnframes() / audio.getframerate()


def analyze_audio(path: str | Path, transcript: Transcript) -> dict[str, float | int]:
    duration = wav_duration_seconds(path)
    word_count = len(transcript.words) or len(re.findall(r"\b[\w']+\b", transcript.text))
    speaking_duration = duration
    if transcript.words: speaking_duration = max(.01, transcript.words[-1].end_seconds - transcript.words[0].start_seconds)
    fillers = count_fillers(transcript.text)
    return {"duration_seconds": round(duration, 3), "word_count": word_count, "wpm": round(word_count / max(speaking_duration, .01) * 60, 2), "fillers": fillers, "fillers_per_100_words": round(fillers / max(word_count, 1) * 100, 2)}
