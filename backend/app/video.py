from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path

from google.genai import types
from pydantic import BaseModel, Field

from .config import settings
from .gemini import get_gemini_client


class Moment(BaseModel):
    t: str = Field(description="Timestamp as m:ss, e.g. 0:14")
    title: str = Field(description="Short headline, under 6 words")
    body: str = Field(description="One sentence of observable detail")
    good: bool


class Observation(BaseModel):
    evidence: str = Field(description="What is visible, with m:ss timestamps")
    suggestion: str = Field(description="One actionable sentence")


class DeliveryEvaluation(BaseModel):
    """Observable delivery ratings; Gemini should not infer emotions or identity."""
    # Scores come from MediaPipe measurements (vision.py); Gemini only explains what it sees and suggests a fix.
    eye_contact: Observation
    posture: Observation
    body_language: Observation
    moments: list[Moment] = Field(default_factory=list)
    attention: list[float] = Field(default_factory=list)
    strengths: list[str] = Field(min_length=1)
    improvements: list[str] = Field(min_length=1)


def _ffmpeg() -> str | None:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return shutil.which("ffmpeg")


def extract_wav(video_path: str | Path, destination: str | Path) -> Path:
    """Extract 16 kHz mono PCM WAV. FFmpeg handles MOV, MP4, and browser WebM on any OS; afconvert is a macOS fallback."""
    destination = Path(destination)
    ffmpeg = _ffmpeg()
    if ffmpeg: command = [ffmpeg, "-y", "-loglevel", "error", "-i", str(video_path), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(destination)]
    else: command = ["afconvert", "-f", "WAVE", "-d", "LEI16@44100", str(video_path), str(destination)]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError("Audio extraction needs FFmpeg (pip install imageio-ffmpeg) or macOS afconvert.") from exc
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
    prompt = f"""You are a strict, evidence-based presentation coach. Evaluate only observable behavior in this ~30-second video; the speaker was answering: {daily_prompt}
For each skill, write the evidence (what you see, citing timestamps as m:ss) and one actionable suggestion. Do not give ratings; scores are measured separately.
eye_contact: when the gaze leaves the camera lens and where it goes (up, down, sideways, reading).
posture: slouching, head dropping or tipping back, tilting, leaning, or swaying.
body_language: hand gestures (purposeful or not), hands out of frame, fidgeting, and touching the face or hair.
If the relevant body area is not visible, say so in the evidence.
moments: 2–5 key moments in chronological order, mixing good and bad, each tied to what is seen or heard at that timestamp.
attention: 12 values from 0 to 1, one per equal slice of the video, estimating how engaging the delivery looks and sounds in that slice. This is a delivery-based estimate, not a measurement of a real audience.
Do not infer personality, confidence, neurological state, identity, accent, or attractiveness.
Write evidence and suggestions addressed to the speaker as "you"; never use he, she, his, or her."""
    response = client.models.generate_content(
        model=settings.video_model, contents=[uploaded_video, prompt],
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=DeliveryEvaluation),
    )
    return DeliveryEvaluation.model_validate_json(response.text)
