# OneTake

*One prompt. One take. Thirty seconds.*

## Inspiration

Three out of four people say they're afraid of public speaking, and almost nobody practices it. Coaches cost money, Toastmasters costs a Tuesday night, and talking into your mirror gets boring in a week.

Meanwhile, Wordle and Duolingo made millions of people do something slightly uncomfortable every single day, because it was short, everyone did the same thing, and you could compare. We wanted that loop for speaking: one prompt a day, one take, no retakes, and a score you can put next to your friends'.

## What it does

OneTake is a daily speaking challenge with a panda coach.

- **Every day, one prompt.** Everyone in the world gets the same one for 24 hours ("Convince a stranger to try your favorite food.").
- **One take.** You get 30 seconds on the front camera. No retakes, so the clip is honest.
- **Scored in seconds.** The panda analyzes your voice, body and content and gives you a 0–100 score with a breakdown.
- **Told what to fix.** Not "be more confident", but "7 ums in 135 words; swap each for a half-second pause" and "you looked down from 0:14 to 0:22".
- **Ranked.** A global leaderboard resets with each prompt. Your rank, streak and a shareable score card keep you coming back.

## How we built it

**Scoring.** Three sub-scores, weighted 40/30/30:

- **Voice** from the transcript and audio: words per minute, filler words per 100 words, pitch range in semitones, pause pattern.
- **Body** from on-device pose and face tracking: eye contact, gesture rate, head stability, expressiveness.
- **Content** from an LLM scoring the transcript on a fixed rubric: relevance to the prompt, structure (hook, point, close), clarity.

Each metric is mapped to 0–100 with curves taken from speaking norms (a comfortable pace is 130–170 wpm, fluent speakers use 1–2 fillers per 100 words). A gate stops gaming: say nothing, or go off-prompt, and your delivery score doesn't count. The leaderboard ranks by percentile within the day, so an easy prompt doesn't inflate everyone's rank.

**Coach feedback.** The metrics and transcript go to an LLM that writes the timeline ("strong hook at 0:00, pace jumped at 0:18") and picks the one thing to fix tomorrow. It never invents a number; every figure comes from the metrics.

**App.** Expo + React Native with Expo Router. Camera recording with `expo-camera`, the panda and score ring drawn in SVG and animated with Reanimated, the share card rendered in-app and exported as a 1080×1350 image. Five panda states (hello, encourage, thinking, celebrate, console) are tied to app moments and to your score.

**Look.** Frutiger Aero (sky gradients, glass, glossy bubbles, grass) with Duolingo-style chunky buttons and a path of daily nodes. Everything was designed on a canvas first, then built to match.

## Challenges we ran into

- **Making scores believable.** A single number feels random. We only score things we can measure and explain, show the breakdown, and anchor every tip to a timestamp.
- **Rubric drift.** LLM content scores vary run to run, so we score three times at temperature 0 and take the median.
- **The panda.** We went through four mascots. Big-eyed baby panda read as "too childish", the sharp one read as "angry". A flat, outlined panda with headphones finally said "coach".
- **Peer deps.** Expo 57 pins React 19.2 while `react-dom` 19.3 wants 19.3. A one-line `.npmrc` saved the day.

## Accomplishments that we're proud of

- A complete daily loop in a weekend: envelope → record → analysis → score → leaderboard → share.
- Feedback that is specific enough to act on tomorrow, not generic encouragement.
- A scoring design grounded in published speaking norms, with weights that can be refit against human raters.
- A mascot with a personality and five moods, built entirely in code.

## What we learned

- The daily shared prompt is the whole product. Without it the leaderboard means nothing.
- "How likely" and "how good" are different questions; a confident model still needs a severity scale.
- The first few "um"s are cheap and the next few are expensive. Exponential penalties match how audiences actually hear it.
- Cute is a narrow target.

## What's next

- Record 50 clips, have three people rate them, and refit the weights (target Spearman ρ ≥ 0.7 with human raters).
- Challenge a contact directly from the app (Photon).
- Score history and a Bayesian overall rating, so one lucky day can't top the all-time board.
- A real 3D panda with lip-synced feedback.

## Honest limits

- The scoring weights are expert priors from the literature, not yet fitted to real users.
- The analysis pipeline runs server-side in this build; on-device inference is next.
- Streaks, notifications and the friends tab are scaffolded, not finished.
