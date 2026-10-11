from __future__ import annotations

import os
import shutil
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .audio import analyze_audio, find_disfluencies
from .config import settings
from .scoring import (VISUAL_METRICS, body_language_score, category_scores, eye_contact_score, filler_score,
                      overall_score, posture_score, rubric_score)
from .prompts import prompt_for
from .semantic import evaluate_speech
from .store import BUCKETS, Store, make_store
from .transcription import transcribe
from .video import evaluate_delivery, extract_wav
from .views import build_take
from .vision import measure_delivery

store: Store


@asynccontextmanager
async def lifespan(_: FastAPI):
    global store
    store = make_store()
    yield
    if hasattr(store, "close"): store.close()


app = FastAPI(title="OneTake API", version="0.3.0", lifespan=lifespan)
# Native Expo apps ignore CORS; Expo web and browsers need it. Narrow with CORS_ORIGINS=https://a.com,https://b.com
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","), allow_methods=["*"], allow_headers=["*"])
logger = logging.getLogger(__name__)


class SubmissionAccepted(BaseModel):
    submission_id: str
    status: str


@app.get("/", include_in_schema=False)
def recorder_page() -> FileResponse:
    """Local test page: record a take in the browser and see the results."""
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/health")
def health() -> dict[str, str]: return {"status": "ok"}


@app.get("/api/daily-prompt")
def daily_prompt() -> dict: return {**prompt_for(), "takers": store.takers_today(), "rubric_version": "v5"}


def _process(submission_id: str, recording: str, prompt: str) -> None:
    try:
        recording_path = Path(recording)
        is_video = recording_path.suffix.lower() in {".mov", ".mp4", ".webm"}
        audio_path = extract_wav(recording_path, recording_path.with_suffix(".wav")) if is_video else recording_path
        # Video delivery evaluation is independent of the transcript, so it runs alongside transcription.
        with ThreadPoolExecutor(max_workers=2) as pool:
            delivery_job = pool.submit(evaluate_delivery, recording_path, prompt) if is_video else None
            measure_job = pool.submit(measure_delivery, recording_path) if is_video else None
            transcript = transcribe(audio_path)
            audio = analyze_audio(audio_path, transcript)
            semantic = evaluate_speech(transcript.text, prompt)
            delivery = delivery_job.result() if delivery_job else None
            measured = measure_job.result() if measure_job else None
        # Software counts um/uh, repeats, and restarts; Gemini only flags context-dependent fillers ("like", "right?").
        fillers = {**find_disfluencies(transcript.text), "contextual": [f.model_dump() for f in semantic.contextual_fillers]}
        fillers["total"] = sum(len(fillers[k]) for k in ("sounds", "repeats", "restarts", "contextual"))
        audio["fillers"], audio["fillers_per_100_words"] = fillers["total"], round(fillers["total"] / max(int(audio["word_count"]), 1) * 100, 2)
        details = {"vocabulary": rubric_score(semantic.vocabulary.rating), "sentence_structure": rubric_score(semantic.sentence_structure.rating),
                   "fillers": filler_score(float(audio["fillers_per_100_words"]))}
        evidence = {"vocabulary": semantic.vocabulary.evidence, "sentence_structure": semantic.sentence_structure.evidence}
        suggestions = {"vocabulary": semantic.vocabulary.suggestion, "sentence_structure": semantic.sentence_structure.suggestion, "fillers": semantic.filler_suggestion}
        if measured and delivery:
            details |= {"eye_contact": eye_contact_score(measured.eye_contact_ratio), "posture": posture_score(measured.upright_ratio),
                        "body_language": body_language_score(measured.gesture_ratio, measured.face_touch_ratio)}
            measured_facts = {"eye_contact": f"Measured: you looked at the lens {measured.eye_contact_ratio:.0%} of the time.",
                              "posture": f"Measured: you were upright and steady {measured.upright_ratio:.0%} of the time.",
                              "body_language": f"Measured: your hands were gesturing {measured.gesture_ratio:.0%} of the time and touching your face {measured.face_touch_ratio:.0%}."}
            for name in VISUAL_METRICS:
                observation = getattr(delivery, name)
                evidence[name], suggestions[name] = f"{measured_facts[name]} {observation.evidence}", observation.suggestion
        scores = {"fillers": details["fillers"], "language": round((details["vocabulary"] + details["sentence_structure"]) / 2, 2)}
        scores.update({name: details[name] for name in VISUAL_METRICS if name in details})
        feedback = {"strength": semantic.strengths[0], "improvement": semantic.weaknesses[0], "next_exercise": "Record another 30-second response with a clear opening, one supporting point, and conclusion."}
        moments, attention = [], []
        if delivery:
            moments, attention = [m.model_dump() for m in delivery.moments], delivery.attention
            feedback = {"strength": f"Content: {semantic.strengths[0]} Delivery: {delivery.strengths[0]}", "improvement": f"Content: {semantic.weaknesses[0]} Delivery: {delivery.improvements[0]}", "next_exercise": "Record another 30-second response with a clear opening, one supporting point, conclusion, and your face and upper body in frame.", "content_notes": {"strengths": semantic.strengths, "weaknesses": semantic.weaknesses}, "delivery_notes": {"strengths": delivery.strengths, "improvements": delivery.improvements}}
        result = {"scoring_version": "v5-measured-video" if is_video else "v5-audio-content", "overall_score": overall_score(scores, int(audio["word_count"])), "categories": category_scores(scores), "metrics": scores, "metric_details": details, "unavailable_metrics": [] if is_video else list(VISUAL_METRICS), "measurements": measured.to_dict() if measured else None, "fillers": fillers, "evidence": evidence, "suggestions": suggestions, "moments": moments, "attention": attention, "transcript": transcript.to_dict(), "audio": audio, "feedback": feedback}
        store.complete(submission_id, result)
    except Exception as exc:
        logger.exception("Submission %s failed", submission_id)
        store.fail(submission_id, str(exc), type(exc).__name__)


@app.post("/api/submissions", response_model=SubmissionAccepted, status_code=202)
async def create_submission(background_tasks: BackgroundTasks, recording: UploadFile = File(...), user_id: str | None = Form(default=None)) -> SubmissionAccepted:
    extension = Path(recording.filename or "").suffix.lower()
    if extension not in {".wav", ".mov", ".mp4", ".webm"}:
        raise HTTPException(415, "Supported uploads: WAV, MOV, MP4, and WebM.")
    # The server alone assigns the prompt, so every take today answers the same one and ranks stay fair.
    prompt = prompt_for()["prompt"]
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
    # `take` is the ready-to-render shape for the app; it is computed on read so rank stays current.
    if submission.get("status") == "completed" and "suggestions" in submission:
        submission["take"] = build_take(submission, store.standing(submission_id))
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
