# OneTake backend

FastAPI backend for a short-speech coaching workflow. Upload a MOV, MP4, WebM, or WAV recording. Video recordings are transcribed in Gemini verbatim mode with word timestamps, evaluated by Gemini for observable delivery behaviors, scored in Python, then exposed by submission ID.

## Run locally

1. Create a virtual environment and install dependencies: `python3 -m pip install -r requirements.txt`
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` and (optionally) `DATABASE_URL`. `.env` is loaded automatically.
3. Start the API: `uvicorn app.main:app --reload`
4. Check `GET http://127.0.0.1:8000/health`.

Submit a MOV, MP4, WebM, or WAV recording as multipart form data to `POST /api/submissions` (optional `prompt` and `user_id` fields), then poll `GET /api/submissions/{submission_id}`.

## Scoring (v2)

The overall score is a weighted mean of five metrics, each 0–100:

| Metric | Weight | Source |
| --- | --- | --- |
| `eye_contact` | 25% | Gemini video rubric (gaze toward the camera lens) |
| `posture` | 15% | Gemini video rubric |
| `body_language` | 15% | Gemini video rubric (hand gestures) |
| `fillers` | 20% | um/uh regex + Gemini-counted contextual fillers ("like", "you know", repeats), per 100 words |
| `language` | 25% | Mean of Gemini vocabulary and sentence-structure rubrics (sub-scores in `metric_details`) |

These are rubric ratings, not precision measurements. WAV submissions have no visual metrics, so the weights are renormalized over `fillers` and `language`. Takes under 30 words are scaled down proportionally.

## Brain response (optional)

When `NEURO_SCORE_URL` is set, each take's transcript is also sent to the neuro API (see [`/neuro`](../neuro/README.md)), which predicts a listener's brain response with Meta's TRIBE v2 model. `GET /api/submissions/{submission_id}/neuro` returns the ranking, the regions involved and the map for the 3D viewer served at `/neuro/viewer/`. The call runs in its own thread, is cached under `UPLOAD_DIR/neuro/`, and never delays or fails a submission. It is display-only and does not enter the overall score: it reflects how vivid the language is and has not been validated as a measure of audience engagement. TRIBE v2 is licensed for non-commercial use only.

## Persistence (TigerData)

When `DATABASE_URL` is set, the API uses Postgres. If not, it falls back to `data/submissions.json`. Tables are created on startup:

- `submissions`: one row per upload, with status, user, overall score, and the full result as JSONB.
- `score_events`: one wide row per scored take (all five metrics plus WPM and filler rate). On TigerData this is a hypertable, and `GET /api/users/{user_id}/progress?days=30&bucket=day|week` aggregates it with `time_bucket`. `GET /api/leaderboard` ranks users by best video score.

`GEMINI_API_KEY` is never stored in source control. `GOOGLE_API_KEY` is accepted as an alternative environment-variable name.
