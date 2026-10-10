from __future__ import annotations

import subprocess
import time
from pathlib import Path

from google.genai import types
from pydantic import BaseModel, Field

from .config import settings
from .gemini import get_gemini_client


class DeliveryEvaluation(BaseModel):
    """Observable delivery ratings; Gemini should not infer emotions or identity."""
    eye_contact: int = Field(ge=1, le=5)
    posture: int = Field(ge=1, le=5)
    body_language: int = Field(ge=1, le=5)
    strengths: list[str] = Field(min_length=1)
    improvements: list[str] = Field(min_length=1)


def extract_wav(video_path: str | Path, destination: str | Path) -> Path:
    """Extract a standard PCM WAV with macOS's built-in audio converter."""
    destination = Path(destination)
    command = ["afconvert", "-f", "WAVE", "-d", "LEI16@44100", str(video_path), str(destination)]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError("Audio conversion requires macOS afconvert or FFmpeg.") from exc
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Could not extract audio from video: {exc.stderr.strip()}") from exc
    return destination


def _wait_until_active(client: object, uploaded_file: object) -> object:
    file_name, state = getattr(uploaded_file, "name", None), getattr(uploaded_file, "state", None)
    for _ in range(60):
        if not state or getattr(state, "name", state) == "ACTIVE": return uploaded_file
        if getattr(state, "name", state) == "FAILED": raise RuntimeError("Gemini could not process the uploaded video")
        time.sleep(2)
        uploaded_file = client.files.get(name=file_name)
        state = getattr(uploaded_file, "state", None)
    raise RuntimeError("Timed out while Gemini processed the uploaded video")


def evaluate_delivery(video_path: str | Path, daily_prompt: str) -> DeliveryEvaluation:
    client = get_gemini_client()
    uploaded_video = _wait_until_active(client, client.files.upload(file=str(video_path)))
    prompt = f"""Evaluate only observable presentation behaviors in this short video for the prompt: {daily_prompt}
Return 1–5 integer ratings:
- eye_contact: how consistently the speaker's gaze is directed at the camera lens (the audience). 1 mostly looking away or reading, 3 roughly half the time, 5 steady gaze with only natural brief breaks.
- posture: 1 slouched, hunched, or swaying, 3 mostly upright with some slumping or shifting, 5 upright, shoulders square and open, stable throughout.
- body_language: hand gestures. 1 hands hidden, frozen, or fidgeting, 3 occasional gestures loosely tied to the words, 5 purposeful, varied gestures that reinforce key points.
Do not infer personality, confidence, neurological state, identity, accent, or attractiveness. If the relevant body area is not visible, use 3 and state that limitation in improvements. Give concrete, timestamp-aware observations when possible."""
    response = client.models.generate_content(
        model=settings.video_model, contents=[uploaded_video, prompt],
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=DeliveryEvaluation),
    )
    return DeliveryEvaluation.model_validate_json(response.text)
