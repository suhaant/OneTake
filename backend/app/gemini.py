"""One process-wide Gemini client; do not create one per pipeline stage."""
from __future__ import annotations

from functools import lru_cache

from google import genai

from .config import settings


@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_API_KEY) is not configured")
    return genai.Client(api_key=settings.gemini_api_key)
