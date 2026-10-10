from __future__ import annotations

import shutil
import uuid
import logging
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .audio import analyze_audio
from .config import settings
from .scoring import VISUAL_METRICS, category_scores, filler_score, overall_score, rubric_score
from .semantic import evaluate_speech
from .store import BUCKETS, Store, make_store
from .transcription import transcribe
from .video import evaluate_delivery, extract_wav

store: Store


@asynccontextmanager
async def lifespan(_: FastAPI):
    global store
    store = make_store()
    yield
    if hasattr(store, "close"): store.close()


app = FastAPI(title="OneTake API", version="0.2.0", lifespan=lifespan)
# The Expo web build calls this API from another origin; native builds are unaffected.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
DAILY_PROMPT = "Explain one change that would improve your community and why."
logger = logging.getLogger(__name__)


class SubmissionAccepted(BaseModel):
    submission_id: str
    status: str


@app.get("/health")
def health() -> dict[str, str]: return {"status": "ok"}


@app.get("/api/daily-prompt")
def daily_prompt() -> dict[str, str]: return {"date": date.today().isoformat(), "prompt": DAILY_PROMPT, "rubric_version": "v2"}


def _process(submission_id: str, recording: str, prompt: str) -> None:
    try:
        recording_path = Path(recording)
        is_video = recording_path.suffix.lower() in {".mov", ".mp4", ".webm"}
        audio_path = extract_wav(recording_path, recording_path.with_suffix(".wav")) if is_video else recording_path
        transcript = transcribe(audio_path)
        audio = analyze_audio(audio_path, transcript)
        semantic = evaluate_speech(transcript.text, prompt)
        # Regex catches um/uh; Gemini adds contextual fillers ("like", "you know", repeats) that need context.
        audio["fillers"] = int(audio["fillers"]) + semantic.contextual_fillers
        audio["fillers_per_100_words"] = round(audio["fillers"] / max(int(audio["word_count"]), 1) * 100, 2)
        scores = {"fillers": filler_score(float(audio["fillers_per_100_words"])), "language": rubric_score((semantic.vocabulary + semantic.sentence_structure) / 2)}
        details = {"vocabulary": rubric_score(semantic.vocabulary), "sentence_structure": rubric_score(semantic.sentence_structure)}
        feedback = {"strength": semantic.strengths[0], "improvement": semantic.weaknesses[0], "next_exercise": "Record another 30-second response with a clear opening, one supporting point, and conclusion."}
        if is_video:
            delivery = evaluate_delivery(recording_path, prompt)
            scores.update({"eye_contact": rubric_score(delivery.eye_contact), "posture": rubric_score(delivery.posture), "body_language": rubric_score(delivery.body_language)})
            feedback = {"strength": f"Content: {semantic.strengths[0]} Delivery: {delivery.strengths[0]}", "improvement": f"Content: {semantic.weaknesses[0]} Delivery: {delivery.improvements[0]}", "next_exercise": "Record another 30-second response with a clear opening, one supporting point, conclusion, and your face and upper body in frame.", "content_notes": {"strengths": semantic.strengths, "weaknesses": semantic.weaknesses}, "delivery_notes": {"strengths": delivery.strengths, "improvements": delivery.improvements}}
        result = {"scoring_version": "v2-gemini-video" if is_video else "v2-audio-content", "overall_score": overall_score(scores, int(audio["word_count"])), "categories": category_scores(scores), "metrics": scores, "metric_details": details, "unavailable_metrics": [] if is_video else list(VISUAL_METRICS), "transcript": transcript.to_dict(), "audio": audio, "feedback": feedback}
        store.complete(submission_id, result)
    except Exception as exc:
        logger.exception("Submission %s failed", submission_id)
        store.fail(submission_id, str(exc), type(exc).__name__)


@app.post("/api/submissions", response_model=SubmissionAccepted, status_code=202)
async def create_submission(background_tasks: BackgroundTasks, recording: UploadFile = File(...), prompt: str = Form(default=DAILY_PROMPT), user_id: str | None = Form(default=None)) -> SubmissionAccepted:
    extension = Path(recording.filename or "").suffix.lower()
    if extension not in {".wav", ".mov", ".mp4", ".webm"}:
        raise HTTPException(415, "Supported uploads: WAV, MOV, MP4, and WebM.")
    submission_id = uuid.uuid4().hex
    destination = settings.upload_dir / f"{submission_id}{extension}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as target: shutil.copyfileobj(recording.file, target)
    store.create({"submission_id": submission_id, "user_id": user_id, "status": "processing", "created_at": datetime.now(UTC).isoformat(), "prompt": prompt})
    background_tasks.add_task(_process, submission_id, str(destination), prompt)
    return SubmissionAccepted(submission_id=submission_id, status="processing")


@app.get("/api/submissions/{submission_id}")
def get_submission(submission_id: str) -> dict:
    submission = store.get(submission_id)
    if not submission: raise HTTPException(404, "Submission not found")
    return submission


@app.get("/api/users/{user_id}/progress")
def progress(user_id: str, days: int = Query(default=30, ge=1, le=365), bucket: str = Query(default="day")) -> dict:
    if bucket not in BUCKETS: raise HTTPException(422, f"bucket must be one of: {', '.join(BUCKETS)}")
    return {"user_id": user_id, "days": days, "bucket": bucket, **store.progress(user_id, days, bucket)}


@app.get("/api/leaderboard")
def leaderboard(scope: str = "global", limit: int = Query(default=20, ge=1, le=100)) -> dict:
    if scope not in {"global", "friends"}: raise HTTPException(422, "scope must be global or friends")
    if scope == "friends": return {"scope": scope, "entries": [], "note": "Friend relationships are not modeled yet."}
    return {"scope": scope, "entries": store.leaderboard(limit)}
