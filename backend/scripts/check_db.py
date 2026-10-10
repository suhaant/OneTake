"""Check the DATABASE_URL connection and show the latest saved takes. Run: python scripts/check_db.py"""
import psycopg

from app.config import settings

if not settings.database_url: raise SystemExit("DATABASE_URL is not set in .env")
try:
    conn = psycopg.connect(settings.database_url, connect_timeout=10)
except psycopg.OperationalError as exc:
    raise SystemExit(f"Could not reach the database (if this is a timeout, your network is blocking the port; try a hotspot):\n{exc}")
with conn:
    print("Connected:", conn.execute("SELECT version()").fetchone()[0][:60])
    if not conn.execute("SELECT to_regclass('score_events')").fetchone()[0]: raise SystemExit("Connected, but tables don't exist yet. Start the server once to create them.")
    print("Hypertable:", bool(conn.execute("SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'").fetchone()) and bool(conn.execute("SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'score_events'").fetchone()))
    print("\nLatest submissions:")
    for row in conn.execute("SELECT submission_id, user_id, status, overall_score, error FROM submissions ORDER BY created_at DESC LIMIT 5"): print(" ", row)
    print("\nLatest score_events:")
    for row in conn.execute("SELECT time, user_id, overall, eye_contact, posture, body_language, fillers, language FROM score_events ORDER BY time DESC LIMIT 5"): print(" ", row)
