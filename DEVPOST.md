# OneTake

*One prompt. One take. Thirty seconds.*

## Inspiration

Three out of four people say they're afraid of public speaking, and almost nobody practices it. Coaches cost money, Toastmasters costs a Tuesday night, and talking into your mirror gets boring in a week.

Meanwhile, Wordle and Duolingo made millions of people do something slightly uncomfortable every single day, because it was short, everyone did the same thing, and you could compare. We wanted that loop for speaking: one prompt a day, one take, no retakes, and a score you can put next to your friends'.

## What it does

OneTake is a daily speaking challenge with a panda coach.

- **Every day, one prompt.** Everyone gets the same one for 24 hours ("Convince a stranger to try your favorite food.").
- **One take.** 30 seconds on the front camera. No retakes, so the clip is honest.
- **Scored in under a minute.** Eye contact, posture, gestures, fillers and language, each 0–100, rolled into one score.
- **Told what to fix.** Not "be more confident" but "7 fillers in 135 words" and "you read off-screen for most of the middle".
- **Ranked against everyone who took today's prompt.** The board resets daily; streaks and a shareable score card bring you back.
- **Friends who text back.** Dare a contact from your own number. If they score before you do, the panda texts you over iMessage. At 9 pm, if your streak is about to die, so does he.
- **Your brain on your words.** Optional: a 3D brain showing the response Meta's TRIBE v2 model predicts for the language you used, ranked against 100 calibration texts.

## How we built it

**Scoring (FastAPI + Gemini).** The video is transcribed verbatim with word timestamps. Gemini then rates only observable behaviors on 1–5 rubrics: eye contact toward the lens, posture, hand gestures (from the video); vocabulary and sentence structure (from the transcript). It also counts contextual fillers ("like", "you know", restarts) that a regex can't catch; a regex handles the unambiguous ums and uhs. Each rating maps to 0–100 and the overall score is a weighted mean: eye contact 25%, language 25%, fillers 20%, posture 15%, gestures 15%. Takes under 30 words are scaled down so silence can't score. Everything is stored in TigerData: one row per submission plus a `score_events` hypertable, so progress charts are a `time_bucket` query.

**The coach (Node + Photon).** A second service owns accounts, friends and texting. Challenges are sent by the user from their own number (the app prefills Messages); the coach's own texts go over iMessage through Photon, only to people who opted in by texting him first, never after they've done today's take, and at most twice a day. His replies are Gemini with a strict rule: every number comes from the database, never invented. Three personas: mentor, drill sergeant, hype.

**The brain (Modal + TRIBE v2).** Word timings go to a GPU service running TRIBE v2, which predicts an fMRI response on the fsaverage5 surface. The app renders it in three.js and ranks the response against 100 calibration texts. It runs in a side thread and never delays or changes the score.

**App (Expo).** Expo Router, `expo-camera` recording, the panda and score ring in SVG with Reanimated, the 1080×1350 share card rendered in-app. In development the app finds the two servers from the Metro host, so a phone on the same Wi‑Fi needs no config. Five panda states (hello, encourage, thinking, celebrate, console) are tied to app moments and to your score.

**Look.** Frutiger Aero (sky gradients, glass, bubbles, grass) with Duolingo-style chunky buttons and a path of daily nodes. Designed on a canvas first, then built to match.

## Challenges we ran into

- **Making scores believable.** A single number feels random. We score only observable behaviors, show the breakdown with its weights, and anchor feedback to what you actually said.
- **The coach went quiet.** Gemini's reasoning tokens count against the output cap, so a 400-token limit left room for a few words and every text fell back to the template. Raising the cap and treating truncation as failure fixed it.
- **Three services, one truth.** Scores live in the backend's tables, names and friendships in the server's. The daily leaderboard is a join across them, and friends are told the stored score, never the number the phone sent.
- **The panda.** Four mascots. Big-eyed baby read as "too childish", the sharp one as "angry". A flat, outlined panda with headphones finally said "coach".
- **Peer deps.** Expo 57 pins React 19.2 while `react-dom` 19.3 wants 19.3. A one-line `.npmrc` saved the day.

## Accomplishments that we're proud of

- The full loop in a weekend: envelope → record → Gemini scoring → results → daily leaderboard → share → a friend gets a text.
- Feedback specific enough to act on tomorrow, not generic encouragement.
- Safety by design on the texting: opt-in by first text, STOP honored, a hard daily cap, and nothing sent once you've done your take.
- A predicted brain response for your words, with an honest label: it separates vivid from bland language, and we don't call it "engagement".

## What we learned

- The daily shared prompt is the whole product. Without it the leaderboard means nothing.
- Rubric ratings from a multimodal model beat hand-built pose pipelines for a weekend; the trade is precision for coverage.
- The first few "um"s are cheap and the next few are expensive; an exponential penalty matches how audiences hear it.
- An AI that is only allowed to quote the database is far easier to trust than one that is merely asked to be accurate.
- Cute is a narrow target.

## What's next

- Record 50 takes, have three people rate them, and refit the weights (target Spearman ρ ≥ 0.7 with human raters).
- Pace, pitch range and pause timing from the audio, which the transcript timestamps already make possible.
- A Bayesian overall rating so one lucky day can't top the all-time board.
- A real 3D panda with lip-synced feedback.

## Honest limits

- Scores are rubric ratings from Gemini, not precision measurements, and the weights are expert priors, not yet fitted to real users.
- The brain response is not a validated measure of audience engagement, and TRIBE v2 is licensed non-commercial.
- Coach texts are iMessage-only through Photon's shared line pool and need a public webhook URL to receive replies.
- Everything runs server-side; nothing is on-device yet.
