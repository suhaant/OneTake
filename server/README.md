# OneTake server

Friend challenges, coach texts over iMessage (Photon), and the coach's replies.

## Run

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

With an empty `.env` everything runs locally: an in-memory store, coach texts printed to the
console instead of sent, and template replies instead of Gemini. Fill in a section of `.env`
to make that part real. Point the app at the server with `EXPO_PUBLIC_API_URL` and at the
scoring backend with `EXPO_PUBLIC_BACKEND_URL` (see `.env.example` in the repo root).

## What sends what

| Message | Sent by | When |
|---|---|---|
| Challenge ("I scored 78... beat it") | The user, from their own number. The app opens Messages with the text prefilled. | The user taps "Write the text" on the Friends tab. |
| "Maya just scored 81..." | Coach, via Photon | A friend finishes today's take and this user has not. |
| Streak-saver | Coach, via Photon | 9pm local, streak alive, today's take not done. |
| Replies | Coach, via Photon | The user texts the coach. |

Coach texts go only to users who opted in, never after they have done today's take, and at
most twice a day. `STOP` turns them off.

## Photon setup

1. Put the project id and secret in `.env`.
2. Deploy somewhere with a public https URL and set `PUBLIC_URL`.
3. Register the webhook once and save the secret it returns as `SPECTRUM_WEBHOOK_SECRET`:

```bash
curl -X POST "https://spectrum.photon.codes/projects/$PHOTON_PROJECT_ID/webhooks/" \
  -u "$PHOTON_PROJECT_ID:$PHOTON_PROJECT_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"webhookUrl\":\"$PUBLIC_URL/spectrum/webhook\"}"
```

Opt-in is two steps on purpose. The app registers the number, then opens Messages with a
prefilled first text to the coach. Coach texts stay off until that text arrives.

## How it fits with the backend

Three pieces, one database:

- `backend/` (FastAPI) scores takes and writes `submissions` and `score_events`.
- `server/` (this) reads those tables and owns friends, challenges and coach texts.
- The app uploads each take to the backend with its `user_id`, then tells this server the take
  is done so friends who have not taken theirs get a text.

Set `DATABASE_URL` to the same TigerData URL as `backend/.env` and `BACKEND_URL` to the
backend's origin. This server creates its own tables (`schema.sql`) on startup and never writes
to the backend's. The score friends are told is read from `score_events`, not taken from the app.

The coach sees the user's last 30 takes (every metric, the feedback, the transcript), weekly
averages, streak, today's prompt and friends' scores today.

If the backend should trigger the texts itself rather than rely on the app, call this after a
submission is scored:

```bash
curl -X POST "$PUBLIC_URL/events/attempt-completed" \
  -H "Authorization: Bearer $INTERNAL_SECRET" -H "Content-Type: application/json" \
  -d '{"userId":"..."}'
```

## Streak-saver schedule

Either set `ENABLE_CRON=1`, or have an external scheduler `POST /cron/streak-saver` hourly
with the same bearer secret.
