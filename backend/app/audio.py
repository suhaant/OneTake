from __future__ import annotations

import re
import wave
from pathlib import Path

from .transcription import Transcript

FILLER_PATTERN = re.compile(r"\b(?:um+|uh+|er+|ah+|hmm+|erm+|uhm+)\b", re.I)
MAX_RESTART_WORDS = 8
GRAMMATICAL_DOUBLES = {"had", "that"}  # "I had had enough", "I think that that idea"


def _tokens(text: str) -> list[str]:
    return [t.lower() for t in re.findall(r"[\w']+", text)]


def find_disfluencies(text: str) -> dict[str, list[str]]:
    """Deterministic fillers: um/uh sounds, immediately repeated words ("because because"), and restarted phrases.

    Each repeat or restart counts once per extra occurrence; a restarted 6-word phrase is one disfluency, not six.
    """
    tokens = _tokens(text)
    repeats: list[str] = []; restarts: list[str] = []
    i = 0
    while i < len(tokens):
        # Shortest match first, so "and and and and" is three repeats rather than one two-word restart.
        for size in range(1, min(MAX_RESTART_WORDS, (len(tokens) - i) // 2) + 1):
            if size == 1 and (tokens[i] in GRAMMATICAL_DOUBLES or FILLER_PATTERN.fullmatch(tokens[i])): continue
            if tokens[i:i + size] == tokens[i + size:i + 2 * size]:
                (repeats if size == 1 else restarts).append(" ".join(tokens[i:i + size]))
                i += size  # the next comparison starts at the duplicate, so "and and and and" yields three repeats
                break
        else:
            i += 1
    return {"sounds": [m.group(0).lower() for m in FILLER_PATTERN.finditer(text)], "repeats": repeats, "restarts": restarts}


def wav_duration_seconds(path: str | Path) -> float:
    with wave.open(str(path), "rb") as audio: return audio.getnframes() / audio.getframerate()


def analyze_audio(path: str | Path, transcript: Transcript) -> dict[str, float | int]:
    duration = wav_duration_seconds(path)
    word_count = len(transcript.words) or len(_tokens(transcript.text))
    speaking_duration = duration
    if transcript.words: speaking_duration = max(.01, transcript.words[-1].end_seconds - transcript.words[0].start_seconds)
    return {"duration_seconds": round(duration, 3), "word_count": word_count, "wpm": round(word_count / max(speaking_duration, .01) * 60, 2)}
