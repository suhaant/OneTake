# OneTake

*One prompt. One take. Thirty seconds.*

Wordle for public speaking. Every day everyone gets the same prompt, records one 30-second take on the front camera with no retakes, and Patty the Panda scores it on eye contact, posture, gestures, fillers and language, then ranks it against everyone who took today's prompt.

Built at HackNC 2026 by Ayan Bhakta, Suhaan Temkar and Adam Rakhmanov.

## The ideas behind it

- **The daily shared prompt is the whole product.** One prompt for 24 hours means a hard day is hard for everyone, so the leaderboard is fair and worth looking at. Without it, ranking strangers' speeches means nothing.
- **One take, no retakes.** The clip is honest and the effort asked of the user is tiny. Open app, two taps, done.
- **The model observes, the code decides.** Gemini rates what it can see on a rubric. Our Python does the arithmetic with fixed, published weights. Users trust a formula they can check more than a vibe from an AI.
- **Feedback you can act on tomorrow.** Not "be more confident" but "7 fillers in 135 words, mostly 'like'" and rewrites that quote your own sentences.
- **Numbers come from the database, never from the model.** The coach writes notifications with Gemini but may only quote facts handed to it. The score a friend is told about is read from the scores table, not from the phone.
- **Decorative AI stays out of the score.** The predicted brain response is interesting and display-only. Anything that could be gamed never enters the ranking.

## Architecture

Three processes, one database (TigerData, which is Timescale Postgres). Each one runs without the database too, so a laptop with one Gemini key runs the whole stack.

| Part | Stack | Port | Owns |
| --- | --- | --- | --- |
| `/` (app) | Expo 57, Expo Router, Reanimated, SVG | 8081 | Recording, results, leaderboard, friends, share card, panda |
| `backend/` | Python, FastAPI, Gemini, FFmpeg, ElevenLabs | 8000 | Transcription, rubrics, scoring math, voice lines. Writes `submissions` and `score_events`. |
| `server/` | Node, Hono, Expo push, Gemini | 8787 | Accounts, friends, challenge links, today's board, coach notifications. Reads `score_events`, never writes it. |
| `neuro/` | Modal GPU, Meta TRIBE v2, three.js | cloud | Predicted fMRI response for the transcript, 3D viewer. Optional. |

**Life of a take.** The app creates an account on the server, uploads the video to the backend and polls until scored. The backend returns 202 immediately and runs the pipeline as a background task. When the result lands the app tells the server, which pushes a notification to friends who have not taken today's prompt. Home, Ranks and Streak then read live data: streak and completion from the server, history from the backend's `score_events` hypertable, the daily board from the server joining the backend's scores with its own profile names.

**Fallbacks everywhere.** No `DATABASE_URL` means a JSON file for the backend and memory for the server. No backend reachable means the app shows a built-in sample result and says so. No ElevenLabs key means a silent panda who still counts you in. No Modal URL means the brain section is hidden. No Gemini key on the server means template notifications.

## Quick start

Three terminals from the repo root. Python 3.12 or newer, FFmpeg installed.

```bash
cd backend && pip install -r requirements.txt && cp .env.example .env   # add GEMINI_API_KEY
cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```bash
cd server && npm install && npm run dev
```

```bash
npm install && npx expo start
```

Scan the QR code with Expo Go. No app `.env` is needed in development: `src/config.ts` reads the Metro host from Expo constants and assumes both services run on that machine, so a phone on the same Wi-Fi finds them. `--host 0.0.0.0` on the backend is what lets the phone in. For a deployed stack set `EXPO_PUBLIC_BACKEND_URL` and `EXPO_PUBLIC_API_URL`.

Optional keys in `backend/.env`: `DATABASE_URL` (TigerData), `ELEVENLABS_API_KEY` (panda voice), `NEURO_SCORE_URL` (brain response). In `server/.env`: `GEMINI_API_KEY` (coach writes notifications), the same `DATABASE_URL`, `INTERNAL_SECRET` and `ENABLE_CRON` for the streak-saver.

Push notifications need a development build; Expo Go on Android cannot receive them. The app also schedules a local 9 pm streak reminder on the device so that one works regardless.

The first `npm install` turns on the git hooks in `.githooks/`: any pull or branch switch that changes a package file reruns `npm install` for you.

## The scoring pipeline

`backend/app/main.py` runs each take through these steps in a background thread:

1. **Normalise the video** (`video.py`). FFmpeg re-encodes the upload. This bakes in the phone's rotation metadata, which Gemini otherwise ignores and reports the speaker as upside down, and shrinks a 28 MB clip to about 1 MB.
2. **Transcribe** (`transcription.py`). Gemini verbatim mode with word timestamps, so later feedback can say "from 0:12 to 0:20" and pace can be measured in words per minute.
3. **Start the brain prediction** (`neuro.py`) in its own thread. It never blocks or fails the submission.
4. **Audio analysis** (`audio.py`). Word count, duration, pace, and a regex for unambiguous fillers: um, uh, er, ah, hmm.
5. **Content rubric** (`semantic.py`). Gemini reads the transcript and rates vocabulary and sentence structure 1.0 to 5.0 with decimals so takes rarely tie. It also counts contextual fillers a regex cannot: "like" as a filler but not "I like pizza", "you know", "I mean", restarted phrases. It returns strengths, weaknesses and rewrites that quote the speaker.
6. **Delivery rubric** (`video.py`). Gemini watches the normalised video and rates eye contact toward the lens, posture and hand gestures on the same scale. The prompt tells it to rate only observable behaviour, never confidence, personality, accent or appearance.
7. **Score in Python** (`scoring.py`). See below.
8. **Store** (`store.py`). One `submissions` row with the full result as JSONB, one wide `score_events` row with every metric, so the 30-day progress chart is a single `time_bucket` query.

Every Gemini call goes through `gemini.py`, which sets a two-minute timeout and one retry on transport or 5xx errors. Without it the default client has no timeout and a take could sit in "processing" forever.

Audio-only uploads skip steps 1 and 6 and the weights renormalise over the metrics that exist.

## The math

Every rubric rating `r` maps linearly: `(r - 1) / 4 * 100`. Language is the mean of the vocabulary and structure ratings.

Fillers use an exponential curve on `f` fillers per 100 words:

```
fillers = 100 * exp(-0.1 * max(0, f - 1))
```

| Fillers per 100 words | 1 or fewer | 3 | 5 | 10 |
| --- | --- | --- | --- | --- |
| Score | 100 | 82 | 67 | 41 |

The first filler is free and each one after costs a little more of what is left. That matches how audiences hear them: one "um" is invisible, five in a row is all anyone remembers.

The overall score is a weighted mean: eye contact 0.25, language 0.25, fillers 0.20, posture 0.15, gestures 0.15. Then a gate: `min(1, words / 30)`. Say nothing with perfect posture and you keep nothing; 15 words keeps half; 30 or more keeps all of it.

Pace is shown with a band (130 to 170 words per minute is on target) but is not scored yet.

## The app

Expo Router screens in `src/app/`: the tab bar (Home, Ranks, Streak, Friends, You), then `prompt` (reel, countdown, camera), `thinking` (waiting screen), `results`, `share` and `c/[id]` for challenge deep links.

What is worth knowing in the code:

- **The panda** (`components/Panda.tsx`) is one SVG with five moods tied to app moments and to your score: hello, encourage, thinking, celebrate, console. When he speaks, `src/voice.ts` fetches a line from the backend, which synthesises it with ElevenLabs once and caches it by text, voice and model. The response includes per-character timings, so the countdown and the tips cost one request total and his mouth, blinks and arm moves stay in sync with the audio.
- **The prompt reel** (`PromptRoulette.tsx`) flicks past a pool of flavour prompts in `src/data/prompts.ts` before landing on the real one from the backend.
- **State** lives in `src/store.tsx`. On launch it checks whether today was already scored and reloads the real result rather than the sample. Nothing recorded (web, simulator) shows the sample.
- **The share card** is drawn at 1080 by 1350 in-app, scaled to fit the screen, then captured with `react-native-view-shot`.
- **Look.** Frutiger Aero: sky gradients, glass panels, bubbles, drifting clouds, looping video backdrops, chunky gel buttons, and a Duolingo-style path of daily nodes on Home.
- **Brain section** (`BrainResponse.tsx`) polls the backend and embeds the three.js viewer in an iframe on web, a web view on iOS and Android.

## The social server

Hono app in `server/src/`. Creates its own tables from `schema.sql` (profiles, friend edges, challenges, notification log) and reads the backend's `score_events`.

- **Challenges** are sent by the user from their own number. The app prefills Messages with "I scored 78... beat it" and a link to `/c/:id`, which bounces into `onetake://`. The server never texts anyone.
- **Coach notifications** go through Expo push. Two kinds: a friend scored before you, and a 9 pm streak-saver. Only to users who opted in, never after today's take, at most twice a day. Dead tokens are dropped.
- **The coach writes them** (`agent.ts`) with Gemini in the persona the user picked: mentor, drill sergeant or hype. It is handed a data block with the last 30 takes, weekly averages, streak, today's prompt and friends' scores, and the rules say to use only facts from that block, under 180 characters, never invent a number, never offer a rematch. A truncated reply counts as failure and falls back to the template.
- **The leaderboard** ranks each user's best video take today. Global scope reads the scores table; friends scope joins the friend list with today's attempts.

## The brain response

After transcription, the word timings go to a Modal GPU running Meta's TRIBE v2, which predicts the fMRI response an average listener would have on the fsaverage5 brain surface. The results screen shows a wording meter, the strongest predicted moment with the words spoken there, and a 3D brain you can rotate and play through the take.

To rank a take we built 100 calibration texts: 25 speaking prompts, each written four ways (engaging, flat, flat with fillers inserted, engaging with words scrambled), spoken at an even 150 words per minute. Findings in `neuro/ANALYSIS.md`: the prediction separated vivid from bland on 25 of 25 topics, but scrambled word order scored higher on 17 of 25 and it showed no correlation with real listener engagement. So the app says "predicted brain response", never "engagement", and keeps it out of the score where it could be gamed.

Setup: Hugging Face access to TRIBE v2 and Llama 3.2 3B, a Modal account, then `cd neuro/api && modal deploy modal_app.py` and put the printed URL in `backend/.env` as `NEURO_SCORE_URL`. Keep that URL out of git; it is unauthenticated and runs on your GPU budget.

## Art, music, voice

- Backdrop stills are generated with Gemini's image model (`scripts/gen-art.mjs`), animated with Veo (`scripts/gen-motion.mjs`) and cut into seamless portrait loops with FFmpeg (`scripts/loop-clip.sh`).
- The ambient loop while a take is scored is AI-generated music (`assets/audio/analysis-loop.mp3`).
- The panda's voice is ElevenLabs. Four mascots were tried; the flat outlined one with headphones finally said "coach".

## Demo helpers and checks

The "Demo · reset my OneTake for today" link at the foot of the You tab deletes today's rows on both services so the envelope opens again. `backend/scripts/seed_demo.py <user_id>` fills today's board with five friends and gives you six improving takes ending yesterday, so today is day 7.

```bash
npx tsc --noEmit && npx expo lint
```

```bash
cd server && npm run typecheck && npm test
```

## Limits and licences

- Visual and language scores are Gemini rubric ratings, not measurements. Weights are expert priors not yet fitted to real users. Next: 50 takes, three human raters each, refit to Spearman ρ ≥ 0.7.
- The brain response is not a validated measure of audience engagement.
- Push needs a development build. The native web view for the 3D brain has not been tested on a device.
- MIT, with one exception: TRIBE v2 is CC BY-NC 4.0, non-commercial only, and that covers anything built on its output. Llama 3.2 inside it is under Meta's Llama licence.
