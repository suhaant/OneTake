"""Call the neuro API (see api/modal_app.py). Standard library only.

Set the endpoint URLs printed by `modal deploy` (they are not stored in this repo):
    export NEURO_ANALYZE_URL=https://<workspace>--neuro-engagement-neuro-analyze.modal.run
    export NEURO_SCORE_URL=https://<workspace>--neuro-engagement-neuro-neuro-score.modal.run
"""

import base64
import json
import os
import urllib.error
import urllib.request
from pathlib import Path


def _post(url: str, body: dict, timeout: int = 900) -> dict:
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Neuro API returned {e.code}: {e.read().decode()[:500]}") from e


def _url(name: str, given: str | None) -> str:
    url = given or os.environ.get(name)
    if not url:
        raise RuntimeError(f"Set {name} to the endpoint URL printed by `modal deploy` (or pass url=...)")
    return url


def analyze_media(path: str | Path, url: str | None = None, brain: bool = True) -> dict:
    """Video or audio file -> transcript, raw score, ranking, regions, brain map."""
    path = Path(path)
    body = {"media_b64": base64.b64encode(path.read_bytes()).decode(), "filename": path.name, "brain": brain}
    return _post(_url("NEURO_ANALYZE_URL", url), body)


def score_words(words: list[dict], url: str | None = None, brain: bool = False) -> dict:
    """[{text, start, end}, ...] (seconds) -> raw score, ranking, regions (and brain map if asked)."""
    return _post(_url("NEURO_SCORE_URL", url), {"words": words, "brain": brain})
