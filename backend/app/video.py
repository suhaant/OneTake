from __future__ import annotations

import logging
import subprocess
import time
from pathlib import Path

from google.genai import types
from pydantic import BaseModel, Field

from .config import settings
from .gemini import generate, get_gemini_client


logger = logging.getLogger(__name__)


class DeliveryEvaluation(BaseModel):
    """Observable delivery ratings; Gemini should not infer emotions or identity."""
    eye_contact: float = Field(ge=1, le=5)
    posture: float = Field(ge=1, le=5)
    body_language: float = Field(ge=1, le=5)
    strengths: list[str] = Field(min_length=1)
    improvements: list[str] = Field(min_length=1)


def normalize_video(video_path: str | Path, destination: str | Path) -> Path:
    """Re-encode for the evaluator: bakes in the rotation metadata phones record (Gemini ignores it and
    sees the frames sideways or upside down), caps the height at 720p, and uses H.264 so the upload is a
    few MB instead of tens. Returns the original path when FFmpeg is not installed."""
    destination = Path(destination)
    command = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video_path), "-vf", "scale=-2:'min(720,ih)'", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(destination)]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
        return destination
    except FileNotFoundError:
        logger.warning("ffmpeg not found; sending the original recording to Gemini (rotation metadata may be ignored)")
        return Path(video_path)
    except subprocess.CalledProcessError as exc:
        logger.warning("ffmpeg could not normalize %s: %s", video_path, exc.stderr.strip())
        return Path(video_path)


def extract_wav(video_path: str | Path, destination: str | Path) -> Path:
    """Extract a standard PCM WAV: macOS's built-in afconvert, or FFmpeg anywhere else."""
    destination = Path(destination)
    commands = [
        ["afconvert", "-f", "WAVE", "-d", "LEI16@44100", str(video_path), str(destination)],
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video_path), "-vn", "-ac", "1", "-ar", "44100", "-f", "wav", str(destination)],
    ]
    for command in commands:
        try:
            subprocess.run(command, check=True, capture_output=True, text=True)
            return destination
        except FileNotFoundError:
            continue  # this converter is not installed; try the next one
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(f"Could not extract audio from video: {exc.stderr.strip()}") from exc
    raise RuntimeError("Audio conversion requires macOS afconvert or FFmpeg on PATH (winget install ffmpeg / brew install ffmpeg).")


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
    video_path = Path(video_path)
    normalized = normalize_video(video_path, video_path.with_name(f"{video_path.stem}.eval.mp4"))
    uploaded_video = _wait_until_active(client, client.files.upload(file=str(normalized)))
    prompt = f"""Evaluate only observable presentation behaviors in this short video for the prompt: {daily_prompt}
Ratings are decimals from 1.0 to 5.0 with one decimal place (e.g. 2.3, 3.7, 4.1), not whole numbers. The anchors below describe 1, 3 and 5; place the take precisely between them based on the evidence. Two takes should rarely get the same rating, so avoid defaulting to .0 or .5.
- eye_contact: how consistently the speaker's gaze is directed at the camera lens (the audience). 1 mostly looking away or reading, 3 roughly half the time, 5 steady gaze with only natural brief breaks.
- posture: 1 slouched, hunched, or swaying, 3 mostly upright with some slumping or shifting, 5 upright, shoulders square and open, stable throughout.
- body_language: hand gestures. 1 hands hidden, frozen, or fidgeting, 3 occasional gestures loosely tied to the words, 5 purposeful, varied gestures that reinforce key points.
The video is already correctly oriented and framed the way the app intends (a phone held in front of the speaker). Never comment on or penalize camera orientation, camera angle, framing, distance from the lens, lighting, resolution, or video quality; treat all of those as given. If a body area is not visible, rate it 3.0 and say only that it was out of view, without advising on camera setup.
Do not infer personality, confidence, neurological state, identity, accent, or attractiveness. Strengths and improvements are about what the speaker does with their gaze, posture, and hands, with timestamps (m:ss) when possible, and each improvement says what to do instead. Keep each item to one sentence of at most 12 words, one or two items per list."""
    response = generate(
        settings.video_model, [uploaded_video, prompt],
        types.GenerateContentConfig(response_mime_type="application/json", response_schema=DeliveryEvaluation),
        what="delivery evaluation",
    )
    return DeliveryEvaluation.model_validate_json(response.text)
