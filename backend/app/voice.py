"""The panda coach's voice: ElevenLabs text-to-speech with character timings for lip sync.

Every line is cached on disk by its text, voice and model, so the shared lines (the countdown,
the tips) cost one request in total and a personalised greeting one request per name.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .config import settings

API = "https://api.elevenlabs.io/v1"
MAX_CHARS = 1500
LINE_ID = re.compile(r"^[0-9a-f]{24}$")
logger = logging.getLogger(__name__)


def enabled() -> bool: return bool(settings.elevenlabs_api_key)
def _dir() -> Path: return settings.voice_dir
def line_id(text: str) -> str: return hashlib.sha256(f"{settings.elevenlabs_voice_id}\n{settings.elevenlabs_model}\n{text}".encode()).hexdigest()[:24]
def audio_path(line: str) -> Path | None: return path if LINE_ID.match(line) and (path := _dir() / f"{line}.mp3").is_file() else None


def _request(text: str) -> dict[str, Any]:
    body = json.dumps({"text": text, "model_id": settings.elevenlabs_model}).encode()
    req = urllib.request.Request(
        f"{API}/text-to-speech/{settings.elevenlabs_voice_id}/with-timestamps?output_format=mp3_22050_32",
        data=body, method="POST",
        headers={"xi-api-key": settings.elevenlabs_api_key or "", "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res: return json.loads(res.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:300]
        raise RuntimeError(f"ElevenLabs returned {exc.code}: {detail}") from exc


def synthesize(text: str) -> dict[str, Any]:
    """Speech for one line. Returns the line id, its duration and per-character start/end seconds.

    The audio itself is served separately (see `audio_path`) so the app can stream it to a player.
    """
    if not enabled(): raise RuntimeError("ELEVENLABS_API_KEY is not configured")
    text = text.strip()
    if not text or len(text) > MAX_CHARS: raise ValueError(f"text must be 1 to {MAX_CHARS} characters")
    line = line_id(text)
    folder = _dir()
    folder.mkdir(parents=True, exist_ok=True)
    meta = folder / f"{line}.json"
    if meta.is_file() and (folder / f"{line}.mp3").is_file(): return json.loads(meta.read_text())

    data = _request(text)
    alignment = data.get("alignment") or data.get("normalized_alignment") or {}
    characters = alignment.get("characters", [])
    starts = [round(t, 3) for t in alignment.get("character_start_times_seconds", [])]
    ends = [round(t, 3) for t in alignment.get("character_end_times_seconds", [])]
    result = {"id": line, "text": text, "duration": ends[-1] if ends else 0.0, "characters": characters, "starts": starts, "ends": ends}
    (folder / f"{line}.mp3").write_bytes(base64.b64decode(data["audio_base64"]))
    meta.write_text(json.dumps(result))
    logger.info("Voice line %s: %d chars, %.1fs", line, len(text), result["duration"])
    return result
