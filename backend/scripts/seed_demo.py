"""Demo data: five friends on today's board, and a week of slightly improving takes for one user.

Run from backend/ against DATABASE_URL (TigerData):

    PYTHONPATH=. python scripts/seed_demo.py <your_user_id> [<another_user_id> ...] [--remove]

Seeded rows carry scoring_version 'demo-seed', so running again replaces them and --remove deletes
them without touching real takes. Friend profiles are created in messaging_profiles (the server's
table) when a profile with that name does not exist yet.
"""
from __future__ import annotations

import json
import random
import sys
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg
from psycopg.types.json import Jsonb

from app.config import settings
from app.scoring import category_scores, overall_score

TAG = "demo-seed"
TZ = "America/New_York"
FRIENDS = ["Ayan", "Suhaan", "Devesh", "Noah", "Colin"]
PROMPT = "Explain one change that would improve your community and why."
# Your last six days, oldest first: a gentle climb with one off day, ending yesterday so today's take is day 7.
MY_WEEK = [57, 60, 64, 62, 68, 72]

STRENGTHS = ["Opens with the point instead of a wind-up.", "Keeps a steady gaze at the lens through the middle.", "Uses one concrete example and sticks with it.", "Hands move on the key words rather than staying frozen."]
WEAKNESSES = ["Trails off at the end instead of landing the close.", "A few 'um's cluster in the second sentence.", "Reads off-screen for a moment near the end.", "The second point starts before the first one is finished."]
EXERCISES = ["Say the last sentence first, then stop talking.", "Pause for half a second where you would say 'um'.", "Keep your eyes on the lens for the whole last sentence.", "One idea, one example, one close."]


def rubric(score: float, spread: float = 10) -> dict[str, float]:
    """Per-metric scores around an overall target, each 0..100."""
    return {m: round(max(5.0, min(99.0, score + random.uniform(-spread, spread))), 2) for m in ("eye_contact", "posture", "body_language", "fillers", "language")}


def result_for(score: float, words: int, duration: float) -> dict:
    metrics = rubric(score)
    overall = overall_score(metrics, words)
    strength, weakness, exercise = random.choice(STRENGTHS), random.choice(WEAKNESSES), random.choice(EXERCISES)
    wpm = round(words / duration * 60, 1)
    fillers = max(0, round((100 - metrics["fillers"]) / 12))
    per100 = round(fillers / words * 100, 2)
    rating = lambda m: round(1 + metrics[m] / 25, 1)  # noqa: E731
    return {
        "scoring_version": TAG,
        "overall_score": overall,
        "categories": category_scores(metrics),
        "metrics": metrics,
        "metric_details": {"vocabulary": metrics["language"], "sentence_structure": metrics["language"]},
        "unavailable_metrics": [],
        "transcript": {"text": "", "words": []},
        "audio": {"duration_seconds": duration, "word_count": words, "wpm": wpm, "fillers": fillers, "fillers_per_100_words": per100, "filler_words": {"um": fillers}},
        "feedback": {
            "strength": strength, "improvement": weakness, "next_exercise": exercise,
            "content_notes": {"strengths": [strength], "weaknesses": [weakness]},
            "delivery_notes": {"strengths": ["Face and hands stay in frame."], "improvements": ["Finish on the lens, not the screen."]},
        },
        "breakdown": {
            "words": words, "duration_seconds": duration,
            "pace": {"wpm": wpm, "band": "on target" if 130 <= wpm <= 170 else "a bit fast" if wpm > 170 else "a bit slow"},
            "fillers": {"total": fillers, "verbal": fillers, "contextual": 0, "per_100_words": per100, "by_word": {"um": fillers} if fillers else {}, "examples": []},
            "vocabulary": {"rating": rating("language"), "score": metrics["language"], "level": "varied" if metrics["language"] >= 65 else "everyday", "strong_words": ["concrete", "specific"], "weak_words": ["stuff"]},
            "structure": {"rating": rating("language"), "score": metrics["language"], "opening": 4, "support": 3, "closing": 2 if weakness.startswith("Trails") else 4},
            "delivery": {"eye_contact": metrics["eye_contact"], "posture": metrics["posture"], "body_language": metrics["body_language"]},
        },
        "suggestions": [exercise],
    }


def insert_take(conn: psycopg.Connection, user_id: str, at: datetime, score: float) -> None:
    words = random.randint(70, 110)
    duration = round(random.uniform(26, 30), 1)
    result = result_for(score, words, duration)
    sid = uuid.uuid4().hex
    m, a = result["metrics"], result["audio"]
    conn.execute(
        "INSERT INTO submissions (submission_id, user_id, status, prompt, created_at, completed_at, scoring_version, overall_score, result) VALUES (%s, %s, 'completed', %s, %s, %s, %s, %s, %s)",
        (sid, user_id, PROMPT, at, at + timedelta(seconds=25), TAG, result["overall_score"], Jsonb(result)),
    )
    conn.execute(
        """INSERT INTO score_events (time, submission_id, user_id, scoring_version, is_video, overall, eye_contact, posture, body_language, fillers, language, word_count, wpm, fillers_per_100_words)
           VALUES (%s, %s, %s, %s, true, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (at, sid, user_id, TAG, result["overall_score"], m["eye_contact"], m["posture"], m["body_language"], m["fillers"], m["language"], a["word_count"], a["wpm"], a["fillers_per_100_words"]),
    )


def friend_id(conn: psycopg.Connection, name: str) -> str:
    row = conn.execute("SELECT user_id FROM messaging_profiles WHERE lower(name) = lower(%s) ORDER BY created_at LIMIT 1", (name,)).fetchone()
    if row: return row[0]
    user_id = str(uuid.uuid4())
    conn.execute("INSERT INTO messaging_profiles (user_id, name, tz) VALUES (%s, %s, %s)", (user_id, name, TZ))
    return user_id


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1].startswith("-"): raise SystemExit(__doc__)
    if not settings.database_url: raise SystemExit("DATABASE_URL is not set; the demo seed needs TigerData.")
    mine, remove = [a for a in sys.argv[1:] if not a.startswith("-")], "--remove" in sys.argv
    random.seed(7)
    now = datetime.now(ZoneInfo(TZ))
    with psycopg.connect(settings.database_url, connect_timeout=20, autocommit=True) as conn:
        removed = conn.execute("DELETE FROM score_events WHERE scoring_version = %s", (TAG,)).rowcount
        conn.execute("DELETE FROM submissions WHERE scoring_version = %s", (TAG,))
        print(f"removed {removed} earlier demo takes")
        if remove: return

        # Friends: today's take for the board, plus a few earlier days so they carry streaks.
        for n, name in enumerate(FRIENDS):
            uid = friend_id(conn, name)
            streak_days = [4, 2, 6, 1, 3][n]
            base = random.randint(58, 86)
            for back in range(streak_days):
                at = (now - timedelta(days=back)).replace(hour=random.randint(8, 20), minute=random.randint(0, 59), second=0, microsecond=0)
                if back == 0: at = min(at, now - timedelta(minutes=random.randint(5, 90)))
                insert_take(conn, uid, at, base + random.uniform(-6, 6))
            print(f"{name:7s} {uid}  {streak_days} day(s), around {base}")

        # You: the past week, oldest first, ending yesterday.
        for me in mine:
            for back, score in zip(range(len(MY_WEEK), 0, -1), MY_WEEK):
                at = (now - timedelta(days=back)).replace(hour=random.randint(17, 21), minute=random.randint(0, 59), second=0, microsecond=0)
                insert_take(conn, me, at, score)
            print(f"you     {me}  {len(MY_WEEK)} days: {MY_WEEK}")


if __name__ == "__main__":
    main()
