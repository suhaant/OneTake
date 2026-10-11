from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # real environment variables take precedence over .env


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    upload_dir: Path = Path(os.getenv("UPLOAD_DIR", "data/uploads"))
    database_url: str | None = os.getenv("DATABASE_URL") or None
    store_path: Path = Path(os.getenv("STORE_PATH", "data/submissions.json"))
    transcription_model: str = os.getenv("TRANSCRIPTION_MODEL", "gemini-3.5-transcribe")
    semantic_model: str = os.getenv("SEMANTIC_MODEL", "gemini-3.8-flash")
    video_model: str = os.getenv("VIDEO_MODEL", "gemini-3.8-flash")
    # Neuro API (see /neuro). Leave unset to turn the brain-response panel off.
    neuro_score_url: str | None = os.getenv("NEURO_SCORE_URL") or None
    neuro_timeout_seconds: int = int(os.getenv("NEURO_TIMEOUT_SECONDS", "300"))
    # ElevenLabs (see app/voice.py). Leave the key unset to keep the panda silent.
    elevenlabs_api_key: str | None = os.getenv("ELEVENLABS_API_KEY") or None
    elevenlabs_voice_id: str = os.getenv("ELEVENLABS_VOICE_ID", "N2lVS1w4EtoT3dr4eOWO")  # "Callum - Husky Trickster"
    elevenlabs_model: str = os.getenv("ELEVENLABS_MODEL", "eleven_v3")  # v3 understands [excited]-style audio tags
    voice_dir: Path = Path(os.getenv("VOICE_DIR", "data/voice"))


settings = Settings()
