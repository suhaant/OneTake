"""Delete one user's takes so they can record today's prompt again (dev/testing only).

Run from backend/: python scripts/reset_user.py <user_id> [--all]

Without --all only today's (UTC) rows are removed; with it, the user's whole history.
Works against DATABASE_URL (TigerData) or the local JSON store.
"""
import json
import sys
from datetime import UTC, datetime

from app.config import settings

if len(sys.argv) < 2 or sys.argv[1].startswith("-"):
    raise SystemExit(__doc__)
user_id, everything = sys.argv[1], "--all" in sys.argv
today = datetime.now(UTC).date().isoformat()

if settings.database_url:
    import psycopg

    with psycopg.connect(settings.database_url, connect_timeout=20, autocommit=True) as conn:
        where = "user_id = %s" if everything else "user_id = %s AND created_at::date = %s::date"
        params = (user_id,) if everything else (user_id, today)
        subs = conn.execute(f"DELETE FROM submissions WHERE {where}", params).rowcount
        where_ev = "user_id = %s" if everything else "user_id = %s AND time::date = %s::date"
        events = conn.execute(f"DELETE FROM score_events WHERE {where_ev}", params).rowcount
    print(f"TigerData: removed {subs} submissions and {events} score_events for {user_id} ({'all time' if everything else today})")
else:
    path = settings.store_path
    data = json.loads(path.read_text()) if path.exists() else {}
    keep = {k: v for k, v in data.items() if not (v.get("user_id") == user_id and (everything or str(v.get("created_at", ""))[:10] == today))}
    path.write_text(json.dumps(keep, indent=2))
    print(f"JSON store: removed {len(data) - len(keep)} submissions for {user_id}")
