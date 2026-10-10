from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .config import settings
from .gemini import get_gemini_client


@dataclass(frozen=True)
class WordTimestamp:
    word: str
    start_seconds: float
    end_seconds: float


@dataclass(frozen=True)
class Transcript:
    text: str
    words: list[WordTimestamp]

    def to_dict(self) -> dict[str, Any]:
        return {"text": self.text, "words": [asdict(word) for word in self.words]}


def _seconds(value: Any) -> float:
    """Convert Gemini duration values (e.g. ``1.25s``) to seconds."""
    if value is None: return 0.0
    if isinstance(value, (int, float)): return float(value)
    if isinstance(value, dict): return float(value.get("seconds", 0)) + float(value.get("nanos", 0)) / 1_000_000_000
    raw = str(value).strip()
    return float(raw[:-1] if raw.endswith("s") else raw)


def _get(source: Any, *names: str) -> Any:
    for name in names:
        if isinstance(source, dict) and name in source: return source[name]
        if hasattr(source, name): return getattr(source, name)
    return None


def _extract_words(result: Any) -> list[WordTimestamp]:
    """Accept SDK object or dict; annotation field names vary across SDK versions."""
    words: list[WordTimestamp] = []
    for step in (_get(result, "steps") or []):
        # New Interactions responses put model annotations inside step.content.
        containers = [step] + list(_get(step, "content") or [])
        for container in containers:
            for annotation in (_get(container, "annotations", "word_annotations", "wordAnnotations") or []):
                word = _get(annotation, "word", "text", "token")
                start = _get(annotation, "start_offset", "startOffset", "start_time", "startTime")
                end = _get(annotation, "end_offset", "endOffset", "end_time", "endTime")
                if word is not None and start is not None and end is not None:
                    words.append(WordTimestamp(str(word), _seconds(start), _seconds(end)))
    return words


def transcribe(audio_path: str | Path) -> Transcript:
    """Upload audio and request verbatim Gemini transcription with word timestamps."""
    client = get_gemini_client()
    audio = client.files.upload(file=str(audio_path))
    result = client.interactions.create(
        model=settings.transcription_model,
        input=[{"type": "audio", "uri": audio.uri, "mime_type": audio.mime_type}],
        generation_config={"transcription_config": {"mode": {"type": "verbatim", "timestamp_granularities": ["word"]}}},
    )
    return Transcript(text=str(_get(result, "output_text") or ""), words=_extract_words(result))
