"""One process-wide Gemini client; do not create one per pipeline stage."""
from __future__ import annotations

import logging
import time
from functools import lru_cache
from typing import Any

from google import genai
from google.genai import types

from .config import settings

logger = logging.getLogger(__name__)

# A request that never returns (a dropped connection on a hotspot, for example) would otherwise
# leave the submission in "processing" forever: the default client has no timeout at all.
REQUEST_TIMEOUT_MS = 120_000
RETRIES = 1


@lru_cache(maxsize=1)
def get_gemini_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_API_KEY) is not configured")
    return genai.Client(api_key=settings.gemini_api_key, http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_MS))


def generate(model: str, contents: Any, config: types.GenerateContentConfig, *, what: str) -> types.GenerateContentResponse:
    """generate_content with the shared timeout and one retry on a transport or 5xx error."""
    client = get_gemini_client()
    attempt = 0
    while True:
        try:
            return client.models.generate_content(model=model, contents=contents, config=config)
        except Exception as exc:
            attempt += 1
            retryable = isinstance(exc, (TimeoutError, ConnectionError, OSError)) or "50" in str(getattr(exc, "code", "")) or "timed out" in str(exc).lower() or "timeout" in type(exc).__name__.lower()
            if attempt > RETRIES or not retryable:
                raise
            logger.warning("Gemini %s failed (%s: %s); retrying once", what, type(exc).__name__, str(exc)[:120])
            time.sleep(2)
