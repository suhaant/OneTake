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
    # One shared clock for the whole app: the daily prompt and "today" for ranks both roll over at midnight here.
    app_timezone: str = os.getenv("APP_TIMEZONE", "America/New_York")
    store_path: Path = Path(os.getenv("STORE_PATH", "data/submissions.json"))
    transcription_model: str = os.getenv("TRANSCRIPTION_MODEL", "gemini-3.5-transcribe")
    semantic_model: str = os.getenv("SEMANTIC_MODEL", "gemini-3.8-flash")
    video_model: str = os.getenv("VIDEO_MODEL", "gemini-3.8-flash")


settings = Settings()
