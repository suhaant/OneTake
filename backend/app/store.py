from __future__ import annotations

import json
import math
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Lock
from typing import Any, Protocol

from .config import settings
from .prompts import app_day, day_bounds
from .scoring import WEIGHTS

logger = logging.getLogger(__name__)
METRICS = tuple(WEIGHTS)  # eye_contact, posture, body_language, fillers, language
BUCKETS = {"day": "1 day", "week": "7 days"}


class Store(Protocol):
    def create(self, submission: dict[str, Any]) -> None: ...
    def get(self, submission_id: str) -> dict[str, Any] | None: ...
    def complete(self, submission_id: str, result: dict[str, Any]) -> None: ...
    def fail(self, submission_id: str, error: str, error_type: str) -> None: ...
    def progress(self, user_id: str, days: int, bucket: str) -> dict[str, Any]: ...
    def leaderboard(self, limit: int) -> list[dict[str, Any]]: ...
    def standing(self, submission_id: str) -> dict[str, Any] | None: ...
    def takers_today(self) -> int: ...


def _today_bounds() -> tuple[datetime, datetime]: return day_bounds(app_day())


def _standing(rank: int, total: int, score: float, previous: float | None) -> dict[str, Any]:
    return {"rank": rank, "total": total, "percentile": max(1, math.ceil(rank / total * 100)), "delta": None if previous is None else round(score - previous)}


class JsonSubmissionStore:
    """Local fallback used when DATABASE_URL is not configured."""
    def __init__(self, path: Path = settings.store_path):
        self.path, self.lock = path, Lock()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists(): return {}
        return json.loads(self.path.read_text())

    def _save(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, indent=2))

    def _update(self, submission_id: str, fields: dict[str, Any]) -> None:
        with self.lock:
            data = self._load(); data[submission_id].update(fields); self._save(data)

    def create(self, submission: dict[str, Any]) -> None:
        with self.lock:
            data = self._load(); data[submission["submission_id"]] = submission; self._save(data)

    def get(self, submission_id: str) -> dict[str, Any] | None:
        with self.lock: return self._load().get(submission_id)

    def complete(self, submission_id: str, result: dict[str, Any]) -> None:
        self._update(submission_id, {**result, "status": "completed", "completed_at": datetime.now(UTC).isoformat()})

    def fail(self, submission_id: str, error: str, error_type: str) -> None:
        self._update(submission_id, {"status": "failed", "error": error, "error_type": error_type})

    def _completed(self) -> list[dict[str, Any]]:
        with self.lock: return [s for s in self._load().values() if s.get("status") == "completed" and "metrics" in s]

    def progress(self, user_id: str, days: int, bucket: str) -> dict[str, Any]:
        since = datetime.now(UTC) - timedelta(days=days)
        rows = [s for s in self._completed() if s.get("user_id") == user_id and datetime.fromisoformat(s["created_at"]) >= since]
        history = [{"submission_id": s["submission_id"], "time": s["created_at"], "overall": s["overall_score"], **{m: s["metrics"].get(m) for m in METRICS}} for s in sorted(rows, key=lambda s: s["created_at"])]
        return {"history": history, "buckets": [], "note": "Time-bucketed trends require DATABASE_URL (TigerData)."}

    def leaderboard(self, limit: int) -> list[dict[str, Any]]:
        best: dict[str, dict[str, Any]] = {}
        for s in self._completed():
            if not s.get("user_id") or s.get("unavailable_metrics"): continue
            entry = best.setdefault(s["user_id"], {"user_id": s["user_id"], "best_score": 0.0, "takes": 0})
            entry["best_score"] = max(entry["best_score"], s["overall_score"]); entry["takes"] += 1
        ranked = sorted(best.values(), key=lambda e: e["best_score"], reverse=True)[:limit]
        return [{"rank": i, **entry} for i, entry in enumerate(ranked, 1)]

    def takers_today(self) -> int:
        start, end = _today_bounds()
        with self.lock: return sum(start <= datetime.fromisoformat(s["created_at"]) < end for s in self._load().values())

    def standing(self, submission_id: str) -> dict[str, Any] | None:
        takes = self._completed()
        me = next((s for s in takes if s["submission_id"] == submission_id), None)
        if not me or me.get("unavailable_metrics"): return None  # only video takes are ranked
        video = [s for s in takes if not s.get("unavailable_metrics")]
        my_day = app_day(datetime.fromisoformat(me["created_at"]))
        today = [s for s in video if app_day(datetime.fromisoformat(s["created_at"])) == my_day]
        earlier = [s for s in video if me.get("user_id") and s.get("user_id") == me["user_id"] and s["created_at"] < me["created_at"]]
        previous = max(earlier, key=lambda s: s["created_at"])["overall_score"] if earlier else None
        return _standing(1 + sum(s["overall_score"] > me["overall_score"] for s in today), len(today), me["overall_score"], previous)


SCHEMA = """
CREATE TABLE IF NOT EXISTS submissions (
    submission_id   TEXT PRIMARY KEY,
    user_id         TEXT,
    status          TEXT NOT NULL,
    prompt          TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    scoring_version TEXT,
    overall_score   DOUBLE PRECISION,
    result          JSONB NOT NULL DEFAULT '{}'::jsonb,
    error           TEXT,
    error_type      TEXT
);
CREATE INDEX IF NOT EXISTS submissions_user_created_idx ON submissions (user_id, created_at DESC);

-- One row per scored take; NULL visual metrics mean an audio-only upload.
CREATE TABLE IF NOT EXISTS score_events (
    time                  TIMESTAMPTZ NOT NULL,
    submission_id         TEXT NOT NULL,
    user_id               TEXT,
    scoring_version       TEXT NOT NULL,
    is_video              BOOLEAN NOT NULL,
    overall               DOUBLE PRECISION NOT NULL,
    eye_contact           DOUBLE PRECISION,
    posture               DOUBLE PRECISION,
    body_language         DOUBLE PRECISION,
    fillers               DOUBLE PRECISION NOT NULL,
    language              DOUBLE PRECISION NOT NULL,
    word_count            INTEGER,
    wpm                   DOUBLE PRECISION,
    fillers_per_100_words DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS score_events_user_time_idx ON score_events (user_id, time DESC);
"""


class PostgresSubmissionStore:
    """TigerData (Timescale) / plain Postgres store. score_events becomes a hypertable when timescaledb is available."""
    def __init__(self, database_url: str):
        from psycopg_pool import ConnectionPool
        self.pool = ConnectionPool(database_url, min_size=1, max_size=5, open=True, kwargs={"autocommit": True})
        self.timescale = False
        try:
            self._init_schema()
        except Exception as exc:
            self.pool.close()
            raise RuntimeError("Could not reach DATABASE_URL. If this times out, the network is likely blocking the port (try a hotspot), or unset DATABASE_URL to use the JSON store.") from exc

    def _init_schema(self) -> None:
        with self.pool.connection() as conn:
            conn.execute(SCHEMA)
            try:
                conn.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
                conn.execute("SELECT create_hypertable('score_events', by_range('time'), if_not_exists => TRUE)")
                self.timescale = True
            except Exception as exc:  # plain Postgres still works, just without time_bucket/hypertables
                logger.warning("TimescaleDB unavailable, using plain Postgres tables: %s", exc)

    def close(self) -> None: self.pool.close()

    def create(self, submission: dict[str, Any]) -> None:
        from psycopg.types.json import Jsonb
        with self.pool.connection() as conn:
            conn.execute("INSERT INTO submissions (submission_id, user_id, status, prompt, created_at, result) VALUES (%s, %s, %s, %s, %s, %s)",
                         (submission["submission_id"], submission.get("user_id"), submission["status"], submission["prompt"], submission["created_at"], Jsonb({})))

    def get(self, submission_id: str) -> dict[str, Any] | None:
        with self.pool.connection() as conn:
            row = conn.execute("SELECT submission_id, user_id, status, prompt, created_at, completed_at, overall_score, scoring_version, error, error_type, result FROM submissions WHERE submission_id = %s", (submission_id,)).fetchone()
        if not row: return None
        sid, user_id, status, prompt, created_at, completed_at, overall, version, error, error_type, result = row
        columns = {"submission_id": sid, "user_id": user_id, "status": status, "prompt": prompt, "created_at": created_at.isoformat(),
                   "completed_at": completed_at.isoformat() if completed_at else None, "overall_score": overall, "scoring_version": version, "error": error, "error_type": error_type}
        return {**result, **{key: value for key, value in columns.items() if value is not None}}

    def complete(self, submission_id: str, result: dict[str, Any]) -> None:
        from psycopg.types.json import Jsonb
        metrics, audio = result["metrics"], result["audio"]
        with self.pool.connection() as conn, conn.transaction():
            row = conn.execute("UPDATE submissions SET status = 'completed', completed_at = now(), scoring_version = %s, overall_score = %s, result = %s WHERE submission_id = %s RETURNING user_id, created_at",
                               (result["scoring_version"], result["overall_score"], Jsonb(result), submission_id)).fetchone()
            if row is None: raise KeyError(submission_id)
            conn.execute("""INSERT INTO score_events (time, submission_id, user_id, scoring_version, is_video, overall, eye_contact, posture, body_language, fillers, language, word_count, wpm, fillers_per_100_words)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                         (row[1], submission_id, row[0], result["scoring_version"], not result["unavailable_metrics"], result["overall_score"],
                          metrics.get("eye_contact"), metrics.get("posture"), metrics.get("body_language"), metrics["fillers"], metrics["language"],
                          audio["word_count"], audio["wpm"], audio["fillers_per_100_words"]))

    def fail(self, submission_id: str, error: str, error_type: str) -> None:
        with self.pool.connection() as conn:
            conn.execute("UPDATE submissions SET status = 'failed', error = %s, error_type = %s WHERE submission_id = %s", (error, error_type, submission_id))

    def progress(self, user_id: str, days: int, bucket: str) -> dict[str, Any]:
        metric_cols = ", ".join(METRICS)
        bucket_expr = "time_bucket(%s::interval, time, %s)" if self.timescale else "date_trunc(%s, time, %s)"
        bucket_arg = BUCKETS[bucket] if self.timescale else bucket
        avg_cols = ", ".join(f"round(avg({m})::numeric, 2)::float AS {m}" for m in METRICS)
        with self.pool.connection() as conn:
            cur = conn.execute(f"SELECT submission_id, time, overall, {metric_cols} FROM score_events WHERE user_id = %s AND time > now() - make_interval(days => %s) ORDER BY time", (user_id, days))
            history = [dict(zip([d.name for d in cur.description], r)) for r in cur.fetchall()]
            cur = conn.execute(f"SELECT {bucket_expr} AS bucket, count(*) AS takes, round(avg(overall)::numeric, 2)::float AS overall, {avg_cols} FROM score_events WHERE user_id = %s AND time > now() - make_interval(days => %s) GROUP BY 1 ORDER BY 1", (bucket_arg, settings.app_timezone, user_id, days))
            buckets = [dict(zip([d.name for d in cur.description], r)) for r in cur.fetchall()]
        for row in history + buckets:
            for key in ("time", "bucket"):
                if key in row: row[key] = row[key].isoformat()
        return {"history": history, "buckets": buckets}

    def leaderboard(self, limit: int) -> list[dict[str, Any]]:
        # Audio-only takes are renormalized over fewer metrics, so only video takes are ranked.
        with self.pool.connection() as conn:
            rows = conn.execute("SELECT user_id, max(overall) AS best_score, round(avg(overall)::numeric, 2)::float AS average_score, count(*) AS takes FROM score_events WHERE user_id IS NOT NULL AND is_video GROUP BY user_id ORDER BY best_score DESC LIMIT %s", (limit,)).fetchall()
        return [{"rank": i, "user_id": u, "best_score": b, "average_score": a, "takes": t} for i, (u, b, a, t) in enumerate(rows, 1)]

    def takers_today(self) -> int:
        with self.pool.connection() as conn:
            return conn.execute("SELECT count(*) FROM submissions WHERE created_at >= %s AND created_at < %s", _today_bounds()).fetchone()[0]

    def standing(self, submission_id: str) -> dict[str, Any] | None:
        """Rank among the same prompt day's video takes, plus change since this user's previous video take."""
        with self.pool.connection() as conn:
            me = conn.execute("SELECT time, user_id, overall FROM score_events WHERE submission_id = %s AND is_video", (submission_id,)).fetchone()
            if not me: return None
            taken_at, user_id, score = me
            start, end = day_bounds(app_day(taken_at))
            rank, total = conn.execute("SELECT 1 + count(*) FILTER (WHERE overall > %s), count(*) FROM score_events WHERE is_video AND time >= %s AND time < %s", (score, start, end)).fetchone()
            previous = conn.execute("SELECT overall FROM score_events WHERE is_video AND user_id = %s AND time < %s ORDER BY time DESC LIMIT 1", (user_id, taken_at)).fetchone()
        return _standing(rank, total, score, previous[0] if previous else None)


def make_store() -> Store:
    if settings.database_url: return PostgresSubmissionStore(settings.database_url)
    logger.warning("DATABASE_URL not set; falling back to JSON store at %s", settings.store_path)
    return JsonSubmissionStore()
