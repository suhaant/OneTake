# OneTake backend

FastAPI backend for a short-speech coaching workflow. Upload a MOV, MP4, WebM, or WAV recording. Video recordings are transcribed in Gemini verbatim mode with word timestamps, evaluated by Gemini for observable delivery behaviors, scored in Python, then exposed by submission ID.

## Run locally

1. Create a virtual environment and install dependencies: `python3 -m pip install -r requirements.txt`
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` and (optionally) `DATABASE_URL`. `.env` is loaded automatically.
3. Start the API: `uvicorn app.main:app --reload`
4. Open http://127.0.0.1:8000 to record a 30-second take in the browser and see the results, or check `GET http://127.0.0.1:8000/health`.

Submit a MOV, MP4, WebM, or WAV recording as multipart form data to `POST /api/submissions` (optional `prompt` and `user_id` fields), then poll `GET /api/submissions/{submission_id}`.

Connecting the Expo app: see [FRONTEND.md](FRONTEND.md).

## Scoring (v3)

The overall score is a weighted mean of five metrics, each 0–100:

| Metric | Weight | Source |
| --- | --- | --- |
| `eye_contact` | 25% | Gemini video rubric (gaze toward the camera lens) |
| `posture` | 15% | Gemini video rubric |
| `body_language` | 15% | Gemini video rubric (hand gestures) |
| `fillers` | 20% | um/uh regex + Gemini-counted contextual fillers ("like", "you know", repeats), per 100 words |
| `language` | 25% | Mean of Gemini vocabulary and sentence-structure rubrics (sub-scores in `metric_details`) |

Gemini's 1–5 ratings map to 20, 40, 60, 80, and 100. These are rubric ratings, not precision measurements. WAV submissions have no visual metrics, so the weights are renormalized over `fillers` and `language`. Takes under 30 words are scaled down proportionally. `GET /api/submissions/{id}` also returns a `take` object for the app: integer composite `score`, `breakdown`, today's `rank`/`percentile`, `delta` vs. the previous take, timestamped `moments`, `attention` curve, and the focus tip. CORS allows all origins by default; set `CORS_ORIGINS` to restrict it.

## Persistence (TigerData)

When `DATABASE_URL` is set, the API uses Postgres. If not, it falls back to `data/submissions.json`. Tables are created on startup:

- `submissions`: one row per upload, with status, user, overall score, and the full result as JSONB.
- `score_events`: one wide row per scored take (all five metrics plus WPM and filler rate). On TigerData this is a hypertable, and `GET /api/users/{user_id}/progress?days=30&bucket=day|week` aggregates it with `time_bucket`. `GET /api/leaderboard` ranks users by best video score.

`GEMINI_API_KEY` is never stored in source control. `GOOGLE_API_KEY` is accepted as an alternative environment-variable name.
