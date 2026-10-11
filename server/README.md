# OneTake server

Accounts, friends, challenges, today's leaderboard, and the coach's push notifications.

## Run

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

With an empty `.env` everything runs locally: an in-memory store and template notifications
instead of Gemini. Fill in a section of `.env` to make that part real. Point the app at the server
with `EXPO_PUBLIC_API_URL` and at the scoring backend with `EXPO_PUBLIC_BACKEND_URL` (see
`.env.example` in the repo root).

## What sends what

| Message | Sent by | When |
|---|---|---|
| Challenge ("I scored 78... beat it") | The user, from their own number. The app opens Messages with the text prefilled. | The user taps "Write the text" on the Friends tab. |
| "Maya just scored 81..." | Coach, as a push notification | A friend finishes today's take and this user has not. |
| Streak-saver | Coach, as a push notification | 9pm local, streak alive, today's take not done. |

Push goes through Expo's push service (`src/push.ts`): the app registers its Expo push token with
`POST /users/:id/push-token` after the user allows notifications on the You tab, and
`DELETE /users/:id/push-token` turns them off. Notifications go only to users who turned them on,
never after they have done today's take, and at most twice a day. A dead token
(`DeviceNotRegistered`) is dropped automatically.

No public URL or webhook is needed for notifications. `PUBLIC_URL` only shapes the https link in
challenge texts.

The app also schedules a local 9pm streak reminder on the device itself, so the reminder works
even when this server is off or push is unavailable (Expo Go on Android).

## How it fits with the backend

Three pieces, one database:

- `backend/` (FastAPI) scores takes and writes `submissions` and `score_events`.
- `server/` (this) reads those tables and owns friends, challenges and notifications.
- The app uploads each take to the backend with its `user_id`, then tells this server the take
  is done so friends who have not taken theirs get a notification.

Set `DATABASE_URL` to the same TigerData URL as `backend/.env` and `BACKEND_URL` to the
backend's origin. This server creates its own tables (`schema.sql`) on startup and never writes
to the backend's. The score friends are told is read from `score_events`, not taken from the app.

The coach sees the user's last 30 takes (every metric, the feedback, the transcript), weekly
averages, streak, today's prompt and friends' scores today, and writes each notification in the
persona the user picked (mentor, drill sergeant, hype).

If the backend should trigger the notifications itself rather than rely on the app, call this
after a submission is scored:

```bash
curl -X POST "$PUBLIC_URL/events/attempt-completed" \
  -H "Authorization: Bearer $INTERNAL_SECRET" -H "Content-Type: application/json" \
  -d '{"userId":"..."}'
```

## Streak-saver schedule

Either set `ENABLE_CRON=1`, or have an external scheduler `POST /cron/streak-saver` hourly
with the same bearer secret.
