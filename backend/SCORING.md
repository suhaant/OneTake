# How OneTake scores a take

Every take gets a **composite score from 0 to 100**. It's built in four steps, and each step is simple arithmetic that you can check by hand.

## Step 1: Measure six skills

| Skill | Who measures it | Raw measurement |
|---|---|---|
| Eye contact | **MediaPipe** (face landmarks) | Share of the take spent looking at the lens |
| Posture | **MediaPipe** (face and pose landmarks) | Share of the take spent upright and steady |
| Body language (hand gestures) | **MediaPipe** (hand and face landmarks) | Share of the take spent gesturing, and share spent touching the face |
| Filler words | **Software** counts most of them; Gemini flags the rest | Fillers per 100 words |
| Vocabulary | Gemini, reading the transcript | Rubric rating 1–5 |
| Sentence structure | Gemini, reading the transcript | Rubric rating 1–5 |

### How the video is measured
MediaPipe is Google's on-device face, body, and hand tracking. We sample the video **5 times per second** (about 150 frames for a 30-second take), and each frame either passes or fails a geometric test:

- **Looking at the lens:** the gaze direction is within **10°** of the speaker's forward direction, both up/down and side to side. Gaze direction combines head angle and eye direction.
- **Upright and steady:** all of these hold:
  - head tilted sideways no more than 15°
  - head not tipped back or down more than 20°
  - head not sunk toward the shoulders
  - shoulders level within 8°
  - body not leaned or swayed more than 0.15 shoulder-widths from its usual position
- **Gesturing:** a hand is visible and moving (it travels more than 2% of the frame between samples), and it isn't on the face.
- **Touching the face:** a hand is inside the face area, with a 20% margin.

**Why the speaker's own forward direction?** Phones sit at different heights and angles. A phone propped below eye level makes someone looking straight at the lens appear to look down, so fixed angles would misjudge them. We use each speaker's typical (median) position as their forward direction and measure changes from it.

### How fillers are counted
Software scans the transcript for:
- "um" and "uh" sounds
- repeated words ("because because")
- restarted phrases ("we're going to talk about… we're going to talk about")

Gemini only flags fillers that depend on context, such as "like", "so", or "right?", and it has to quote each one. Grammatical doubles like "had had" aren't counted.

### How language is rated
Gemini rates vocabulary and sentence structure on a written 1–5 rubric. It has to quote the transcript as evidence before it gives a rating.

## Step 2: Convert each measurement to a score

| Metric | Formula | Values |
|---|---|---|
| Eye contact | e = share looking at the lens. Score is 0 at 30% or less, 100 at 80% or more, and linear in between: 100 × (e − 0.30) ÷ 0.50 | 40% → 20, 59% → 58, 70% → 80, 80%+ → 100 |
| Posture | p = share upright and steady. Score is 0 at 50% or less, 100 at 90% or more, and linear in between: 100 × (p − 0.50) ÷ 0.40 | 70% → 50, 86% → 91, 90%+ → 100 |
| Body language | g = share gesturing, t = share touching the face. A trapezoid on g (below), minus 2 points per 1% of the take spent touching the face (200 × t), kept between 0 and 100 | g 15%, t 8% → 60 − 15 = 44 |
| Filler words | 100 − 8 × (fillers per 100 words − 1), kept between 20 and 100 | 1 → 100, 3 → 84, 5 → 68, 11+ → 20 |
| Language | Average of vocabulary and sentence structure, each rating × 20 | ratings 1 and 2 → (20 + 40) ÷ 2 = 30 |

The body-language trapezoid:

| Share of the take gesturing (g) | Score |
|---|---|
| 0% | 0 |
| 0% to 25% | rises linearly to 100 |
| 25% to 60% | 100 |
| 60% to 90% | falls linearly to 50 |
| 90% or more | 50 |

**Why these shapes:**
- **Eye contact:** below 30%, the speaker is mostly looking away or reading. At 80% or more, they're holding the audience, and brief natural glances away cost nothing.
- **Posture:** everyone shifts a little, so 90% upright gets full marks.
- **Gestures:** too few looks stiff and constant movement looks fidgety, so the sweet spot is gesturing for 25–60% of the take.
- **Face touching:** it's penalized directly as a nervous habit.

## Step 3: Weighted average of five metrics

| Metric | Weight | Why this weight |
|---|---|---|
| Eye contact | **25%** | On camera, eye contact is the main way the speaker connects with the audience. |
| Language | **25%** | The message itself: word choice and complete, organized sentences. |
| Filler words | **20%** | The most objectively measured signal, because software counts it. |
| Posture | **15%** | A supporting signal. Weighted lower because a phone camera often shows the shoulders only partially. |
| Body language | **15%** | A supporting signal. Hands are often out of frame on a phone, so the measurement is the noisiest of the five. |

The weights add up to 100%. Delivery (eye contact, posture, body language) gets 55%, and speech (fillers, language) gets 45%. **These weights are our design choice, not a published standard.** The reasoning above is what we stand behind. If we collect real user data later, we could check the weights against it.

```
composite = 0.25 × eye contact + 0.15 × posture + 0.15 × body language
          + 0.20 × fillers     + 0.25 × language
```

## Step 4: Two adjustments

- **Too short:** if a take has fewer than 30 words, the composite is multiplied by (words ÷ 30). This stops someone from scoring well by barely speaking. A 15-word take keeps half its score.
- **Audio-only upload:** with no video, the three visual metrics can't be measured. The composite is the weighted average of fillers and language, rescaled so their weights add to 100%: (0.20 × fillers + 0.25 × language) ÷ 0.45.

## Worked example (a real take)

| Metric | Measurement | Score | × Weight | Points |
|---|---|---|---|---|
| Eye contact | on the lens 59% of the time → 100 × (0.59 − 0.30) ÷ 0.50 | 58.0 | 0.25 | 14.5 |
| Posture | upright 86.3% of the time → 100 × (0.863 − 0.50) ÷ 0.40 | 90.9 | 0.15 | 13.6 |
| Body language | gesturing 14.8%, touching the face 7.7% → 100 × 0.148 ÷ 0.25 − 200 × 0.077 | 43.7 | 0.15 | 6.6 |
| Filler words | 5 in 53 words = 9.43 per 100 → 100 − 8 × 8.43 | 32.6 | 0.20 | 6.5 |
| Language | vocabulary 1, structure 2 → (20 + 40) ÷ 2 | 30.0 | 0.25 | 7.5 |
| **Composite** | 53 words, so no short-take adjustment | | | **48.7** |

## What we don't claim

- **The video measurements are geometric proxies.** "Looking at the lens" is computed from head angle and eye direction. It isn't an eye tracker, but it's measured the same way on every frame. A slouch held for the entire take isn't detected, because posture is measured as changes from the speaker's own usual position.
- **The language ratings are Gemini's judgment.** They follow a written rubric, and Gemini has to give evidence before rating.
- **The transcript can vary slightly between runs.** That can move the word count and the filler rate a little.
- **The attention curve is an estimate.** It shows how engaging the delivery looks moment to moment. It isn't measured from a real audience.

## Daily prompt and ranking

- **One prompt for everyone:** every user gets the same prompt each day, and it switches at midnight US Eastern (set by `APP_TIMEZONE`).
- **The server assigns it:** the server attaches today's prompt to every upload, and the app can't override it.
- **Daily rank:** you're ranked against everyone else's video takes on the same prompt day. "Top X%" is your rank ÷ total takes that day, rounded up.

The code for all of this is in `app/vision.py` (measurements), `app/scoring.py` (formulas), `app/audio.py` (filler counting), and `app/prompts.py` (daily prompt).
