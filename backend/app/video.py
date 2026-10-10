from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path

from google.genai import types
from pydantic import BaseModel, Field

from .config import settings
from .gemini import get_gemini_client
from .semantic import RatedSkill


class Moment(BaseModel):
    t: str = Field(description="Timestamp as m:ss, e.g. 0:14")
    title: str = Field(description="Short headline, under 6 words")
    body: str = Field(description="One sentence of observable detail")
    good: bool


class DeliveryEvaluation(BaseModel):
    """Observable delivery ratings; Gemini should not infer emotions or identity."""
    eye_contact: RatedSkill
    posture: RatedSkill
    body_language: RatedSkill
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
For each skill, first write the evidence (cite timestamps as m:ss), then rate 1–5 against the anchors, then give one actionable sentence.
eye_contact: gaze on the camera lens. Estimate the share of the take spent looking at the lens and state it in the evidence. 1 under 30%; 2 30–50%; 3 50–70%; 4 70–85%; 5 over 85% with only brief natural breaks. Looking at the screen just beside the lens counts as partial.
posture: 1 slouched, hunched, head dropping, or constantly shifting; 2 frequent slumping or tilting; 3 mostly upright with some slumping or shifting; 4 upright and steady with minor lapses; 5 upright, shoulders square and open, stable throughout.
body_language: hand gestures and self-touch. 1 hands hidden or frozen, or frequent fidgeting/self-touching (face, hair, chin); 2 few gestures, some fidgeting; 3 occasional gestures loosely tied to the words; 4 regular gestures that match the words; 5 purposeful, varied gestures that reinforce key points, no fidgeting.
Rate what is visible, not what was intended. Most casual takes are a 2 or 3; reserve 5 for polished delivery. If the relevant body area is not visible, rate 3 and say so in the evidence.
moments: 2–5 key moments in chronological order, mixing good and bad, each tied to what is seen or heard at that timestamp.
attention: 12 values from 0 to 1, one per equal slice of the video, estimating how engaging the delivery looks and sounds in that slice. This is a delivery-based estimate, not a measurement of a real audience.
Do not infer personality, confidence, neurological state, identity, accent, or attractiveness.
Write evidence and suggestions addressed to the speaker as "you"; never use he, she, his, or her."""
    response = client.models.generate_content(
        model=settings.video_model, contents=[uploaded_video, prompt],
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=DeliveryEvaluation),
    )
    return DeliveryEvaluation.model_validate_json(response.text)
