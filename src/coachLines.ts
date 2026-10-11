/**
 * What the panda says, screen by screen. Tags in [brackets] steer the delivery (eleven_v3) and
 * are stripped before anything is shown.
 */
import type { Line, Mood } from './voice';
import type { PandaPose } from './components/Panda';
import type { TakeResult } from './data/mock';

/** The face and body for each mood. */
export const POSE: Record<Mood, PandaPose> = { hello: 'idle', encourage: 'encourage', thinking: 'thinking', celebrate: 'celebrate', console: 'console' };

const withName = (name: string | null, lead = ', ') => (name ? `${lead}${name}` : '');

/** Recording screen: the welcome, the prompt, and the countdown that starts the camera. */
export function introLines(name: string | null, prompt: string): { intro: Line; countdown: Line } {
  const greet = name ? `[cheerful] Hey ${name}, welcome back!` : '[cheerful] Hey there, welcome back!';
  return {
    intro: { text: `${greet} Today's prompt for the day is: ${prompt.trim().replace(/[.!?]+$/, '')}.`, mood: 'hello', gesture: 'wave' },
    countdown: { text: '[excited] Get ready! 5, 4, 3, 2, 1.', mood: 'encourage', gesture: 'count' },
  };
}

/** Waiting screen: a tip, a mistake to avoid, and "almost done". */
export const DONTS = [
  "Don't read off the screen. Watching yourself reads as looking down.",
  "Don't open with 'so, um, today I'm going to talk about'. Your first sentence is your answer.",
  "Don't rush. Nerves push you faster than you think; breathe between sentences.",
  "Don't end on 'yeah, so that's it'. Land the point and stop.",
  "Don't freeze your hands. Keep them in frame and use them on the key words.",
  "Don't stack three points into thirty seconds. One idea, one supporting point, one close.",
  "Don't fill the silence. A half-second pause beats any um.",
  "Don't slump. Shoulders back, chin level, face and upper body in frame.",
  "Don't hide behind vague words. Say the precise thing.",
];

export function waitingIntro(name: string | null): Line {
  return { text: `Nice take${withName(name)}! Give me a sec while I score it.`, mood: 'thinking', gesture: 'none' };
}

export function tipLine(n: number, tip: { title: string; body: string }): Line {
  return { text: `[cheerful] Tip of the day! ${tip.title}. ${tip.body}`, mood: 'encourage', gesture: 'point', tag: `tip:${n}` };
}

export function dontLine(n: number): Line {
  return { text: `[serious] And don't do this: ${DONTS[n % DONTS.length]}`, mood: 'console', gesture: 'shrug' };
}

export const almostDone: Line = { text: '[excited] Almost done! Hang tight.', mood: 'celebrate', gesture: 'cheer' };

/** Results screen: the verdict for the score, then what to work on. */
export function verdictLines(name: string | null, r: TakeResult): Line[] {
  const score = r.score;
  const verdict: Line =
    score >= 85
      ? { text: `[excited] Overall, great job${withName(name)}! That was a strong take.`, mood: 'celebrate', gesture: 'cheer' }
      : score >= 70
        ? { text: `[cheerful] Not too shabby${withName(name)}! Solid take.`, mood: 'encourage', gesture: 'thumbs' }
        : score >= 55
          ? { text: `Hmm. You could use some work${withName(name)}. But that's what tomorrow is for.`, mood: 'hello', gesture: 'shrug' }
          : { text: `[sighs] This is not your best performance${withName(name)}. Let's fix that.`, mood: 'console', gesture: 'shrug' };
  const fixes = r.moments
    .filter((m) => !m.good)
    .map((m) => m.body)
    .slice(0, 3);
  if (!fixes.length) fixes.push(r.focusTitle);
  const list = fixes.map((f) => f.trim().replace(/[.!?]+$/, '')).join('. ');
  const improve: Line = {
    text: `Here's what to improve: ${list}. ${r.focusBody.trim()} Work on that and tomorrow's take will be better.`,
    mood: score >= 70 ? 'encourage' : 'hello',
    gesture: 'point',
  };
  return [verdict, improve];
}
