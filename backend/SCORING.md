# How OneTake scores a take

Every take gets a **composite score from 0 to 100**. It's built in four steps, and each step is simple arithmetic that you can check by hand.

## Step 1: Measure six skills

| Skill | Who measures it | How |
|---|---|---|
| Eye contact | Gemini, watching the video | Rubric rating 1–5, based on the share of time spent looking at the lens |
| Posture | Gemini, watching the video | Rubric rating 1–5 |
| Body language (hand gestures) | Gemini, watching the video | Rubric rating 1–5 |
| Vocabulary | Gemini, reading the transcript | Rubric rating 1–5 |
| Sentence structure | Gemini, reading the transcript | Rubric rating 1–5 |
| Filler words | **Software** counts most of them; Gemini flags the rest | Fillers per 100 words |

**Anchored rubrics.** Every rating level has a written definition, so a "2" means the same thing every time. Eye contact, for example:

| Rating | Share of time looking at the lens |
|---|---|
| 1 | under 30% |
| 2 | 30–50% |
| 3 | 50–70% |
| 4 | 70–85% |
| 5 | over 85% |

**Evidence first.** Gemini has to write its evidence (quotes and timestamps) before it gives a rating, so every score comes with the reason behind it.

**Fillers are counted, not guessed.** Software scans the transcript for:
- "um" and "uh" sounds
- repeated words ("because because")
- restarted phrases ("we're going to talk about… we're going to talk about")

Gemini only flags fillers that depend on context, such as "like", "so", or "right?", and it has to quote each one. Grammatical doubles like "had had" aren't counted.

## Step 2: Convert each skill to a 20–100 score

- **Rubric skills:** score = rating × 20. So 1 → 20, 2 → 40, 3 → 60, 4 → 80, 5 → 100. The floor is 20, not 0, because a weak attempt still counts as an attempt.
- **Filler words:** score = 100 − 8 × (fillers per 100 words − 1), kept between 20 and 100.
  - The first filler per 100 words is free. Even strong speakers use about one.
  - Each additional filler per 100 words costs 8 points.

  | Fillers per 100 words | Score |
  |---|---|
  | 1 | 100 |
  | 3 | 84 |
  | 5 | 68 |
  | 10 | 28 |
  | 11 or more | 20 |

- **Language:** the average of the vocabulary and sentence-structure scores.

## Step 3: Weighted average of five metrics

| Metric | Weight | Why this weight |
|---|---|---|
| Eye contact | **25%** | On camera, eye contact is the main way the speaker connects with the audience. |
| Language | **25%** | The message itself: word choice and complete, organized sentences. |
| Filler words | **20%** | The most objectively measured signal, because software counts it. |
| Posture | **15%** | A supporting signal. Weighted lower partly because a phone camera often shows it only partially. |
| Body language | **15%** | A supporting signal. Hands are often out of frame on a phone, so the measurement is noisier. |

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
| Eye contact | rating 2 (about 40% on the lens) | 40 | 0.25 | 10.0 |
| Posture | rating 2 | 40 | 0.15 | 6.0 |
| Body language | rating 2 | 40 | 0.15 | 6.0 |
| Filler words | 8 in 57 words = 14.0 per 100 | 20 | 0.20 | 4.0 |
| Language | vocabulary 1, structure 1 → (20 + 20) ÷ 2 | 20 | 0.25 | 5.0 |
| **Composite** | 57 words, so no short-take adjustment | | | **31** |

## What we don't claim

- **Gemini ratings are estimates.** They're structured judgments, not precise measurements of gaze angle or posture. The written rubrics and the evidence-first step make them consistent: two runs on the same video gave identical scores.
- **The attention curve is an estimate.** It shows how engaging the delivery looks moment to moment. It isn't measured from a real audience.

## Daily prompt and ranking

- **One prompt for everyone:** every user gets the same prompt each day, and it switches at midnight US Eastern (set by `APP_TIMEZONE`).
- **The server assigns it:** the server attaches today's prompt to every upload, and the app can't override it.
- **Daily rank:** you're ranked against everyone else's video takes on the same prompt day. "Top X%" is your rank ÷ total takes that day, rounded up.

The code for all of this is in `app/scoring.py`, `app/audio.py`, and `app/prompts.py`.
