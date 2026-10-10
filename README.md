# OneTake

*One prompt. One take. Thirty seconds.* A daily speaking challenge with a panda coach.

Three processes, one database:

| Part | Stack | Port | Does |
| --- | --- | --- | --- |
| `/` (app) | Expo + Expo Router | 8081 | Record the take, show scores, leaderboard, friends, share card |
| `backend/` | FastAPI + Gemini | 8000 | Transcribe, evaluate and score the recording; writes `submissions` and `score_events` |
| `server/` | Node (Hono) + Photon | 8787 | Accounts, friends, challenges, today's leaderboard, coach texts over iMessage |

## Run it (dev)

Each in its own terminal, from the repo root.

**1. Scoring backend**

```bash
cd backend && python -m pip install -r requirements.txt && cp .env.example .env
```

Put your `GEMINI_API_KEY` in `backend/.env`, then:

```bash
cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Video takes need an audio converter: macOS has `afconvert` built in; on Windows/Linux install FFmpeg (`winget install ffmpeg` / `apt install ffmpeg`).

**2. Messaging server**

```bash
cd server && npm install && npm run dev
```

With an empty `server/.env` it runs fully local: in-memory store, coach texts logged instead of sent. See `server/README.md` to turn on Photon and TigerData.

**3. App**

```bash
npm install && npx expo start
```

Scan the QR with Expo Go. **No `.env` is needed in development**: the app assumes the backend and server run on the same machine as the Metro dev server (`src/config.ts`) and reaches them over Wi-Fi. For a deployed stack set `EXPO_PUBLIC_BACKEND_URL` and `EXPO_PUBLIC_API_URL` (see `.env.example`).

`--host 0.0.0.0` on the backend matters: without it the phone can't reach it.

## What talks to what

1. App opens an account on the server (`POST /users`) before the first take, so the take has an owner.
2. App uploads the video to the backend (`POST /api/submissions` with `user_id`) and polls until scored. If the backend is unreachable the app shows the built-in sample result and says so in the console.
3. App reports the score to the server (`POST /users/:id/attempts`), which texts friends who haven't taken today's prompt.
4. Home, Ranks and Share read live data: streak and `completedToday` from the server, history/XP from the backend (`/api/users/:id/progress`), today's board from the server (`GET /leaderboard`), which joins the backend's `score_events` with its own profile names.
5. After a restart, today's result is reloaded from the backend instead of showing the sample.

## Checks

```bash
npx tsc --noEmit && npx expo lint          # app
cd server && npm run typecheck && npm test  # server
```

Design canvas, scoring rationale and the Devpost write-up: `DEVPOST.md`.
