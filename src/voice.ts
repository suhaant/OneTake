/**
 * The panda's voice. Lines are synthesised by the backend (ElevenLabs, see backend/app/voice.py),
 * which returns per-character timings; while a line plays, `mouth` and `beat` follow the audio so
 * the Panda component can move its mouth and body in time with the words.
 *
 * Without a backend or key the coach still "speaks": the same callbacks fire on an estimated clock
 * with the mouth shut, so countdowns and bubbles keep working, just silently.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { makeMutable, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { BACKEND_URL } from './config';

export type Mood = 'hello' | 'encourage' | 'thinking' | 'celebrate' | 'console';
export type Gesture = 'none' | 'wave' | 'point' | 'count' | 'cheer' | 'shrug' | 'thumbs';

export type Line = {
  /** What he says. eleven_v3 reads [excited]-style tags as direction; they are never shown. */
  text: string;
  mood?: Mood;
  gesture?: Gesture;
  /** anything the screen wants back in onLine, e.g. which tip card to show */
  tag?: string;
};

type Timing = { id: string; duration: number; characters: string[]; starts: number[]; ends: number[] };

const TICK_MS = 40;
/** Silent fallback pace: about 15 characters a second, roughly how fast he talks. */
const SILENT_CPS = 15;
const FETCH_TIMEOUT_MS = 25_000;

const timings = new Map<string, Promise<Timing | null>>();

/** Asks the backend for a line's audio and timings. Null when the backend is down or has no key. */
export function prefetch(text: string): Promise<Timing | null> {
  const key = text.trim();
  let pending = timings.get(key);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${BACKEND_URL}/api/voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: key }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`voice returned ${res.status}`);
        return (await res.json()) as Timing;
      } catch (err) {
        console.warn('[onetake] voice unavailable:', err instanceof Error ? err.message : String(err));
        timings.delete(key); // try again next time
        return null;
      } finally {
        clearTimeout(timer);
      }
    })();
    timings.set(key, pending);
  }
  return pending;
}

/** Strips [audio tags] for display. */
export function spoken(text: string): string {
  return text.replace(/\[[^\]]*\]\s*/g, '').replace(/\s+/g, ' ').trim();
}

/** How open the mouth is for a character: vowels wide, m/b/p shut, consonants half, pauses closed. */
function mouthFor(ch: string): number {
  const c = ch.toLowerCase();
  if ('a'.includes(c)) return 1;
  if ('ou'.includes(c)) return 0.85;
  if ('eiy'.includes(c)) return 0.65;
  if ('mbp'.includes(c)) return 0;
  if (/[a-z0-9]/.test(c)) return 0.4;
  return 0.05;
}

export type CoachState = {
  talking: boolean;
  /** the line being spoken */
  line: Line | null;
  /** the part of the current line said so far, tags removed */
  said: string;
  /** true when the last line had real audio */
  audible: boolean;
};

type SayOptions = {
  /** Fires as each character is reached. `t` is seconds into the line. */
  onChar?: (line: Line, char: string, index: number, t: number) => void;
  onLine?: (line: Line, index: number) => void;
};

export class Coach {
  /** 0 shut .. 1 wide open, follows the audio */
  readonly mouth: SharedValue<number> = makeMutable(0);
  /** pulses to 1 at the start of every word; drives the body's emphasis */
  readonly beat: SharedValue<number> = makeMutable(0);

  private state: CoachState = { talking: false, line: null, said: '', audible: false };
  private listeners = new Set<() => void>();
  private player: AudioPlayer | null = null;
  private tick: ReturnType<typeof setInterval> | null = null;
  private run = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getState = () => this.state;

  private set(patch: Partial<CoachState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Says the lines in order. Resolves true when every line finished, false when stopped early. */
  async say(lines: Line[], options: SayOptions = {}): Promise<boolean> {
    this.stop();
    const run = ++this.run;
    // Every time, and before the first line plays: other audio on the screen (the waiting-screen
    // loop) sets its own mode, and a line that starts before the mode lands is silent on a muted phone.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
    if (run !== this.run) return false;
    // Fetch everything up front so there is no gap between lines.
    const fetched = lines.map((l) => prefetch(l.text));
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n];
      const timing = await fetched[n];
      if (run !== this.run) return false;
      this.set({ talking: true, line, said: '', audible: Boolean(timing) });
      options.onLine?.(line, n);
      const finished = timing ? await this.playLine(run, line, timing, options) : await this.mimeLine(run, line, options);
      if (!finished) return false;
    }
    this.clear();
    return true;
  }

  stop() {
    this.run++;
    this.clear();
  }

  private clear() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch {
        // already released
      }
      this.player = null;
    }
    this.mouth.value = withTiming(0, { duration: 120 });
    if (this.state.talking) this.set({ talking: false, line: null, said: '' });
  }

  /** Follows the audio: at every tick, the character under the playhead sets the mouth and fires callbacks. */
  private playLine(run: number, line: Line, timing: Timing, options: SayOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const player = createAudioPlayer({ uri: `${BACKEND_URL}/api/voice/${timing.id}.mp3` }, { updateInterval: 100 });
      this.player = player;
      let index = -1;
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        if (this.tick) clearInterval(this.tick);
        this.tick = null;
        sub.remove();
        if (ok && index < timing.characters.length - 1) this.advance(line, timing, timing.characters.length - 1, index, options, timing.duration);
        resolve(ok && run === this.run);
      };
      const sub = player.addListener('playbackStatusUpdate', (s) => {
        if (s.didJustFinish) finish(true);
      });
      const started = Date.now();
      this.tick = setInterval(() => {
        if (run !== this.run) return finish(false);
        // The player's clock when it is running; the wall clock covers the buffering gap at the start.
        const t = player.playing ? player.currentTime : Math.min((Date.now() - started) / 1000, 0.05);
        const next = indexAt(timing, t);
        if (next > index) {
          this.advance(line, timing, next, index, options, t);
          index = next;
        }
        // Safety net: a player that never reports the end would otherwise hold the screen.
        if (Date.now() - started > (timing.duration + 4) * 1000) finish(true);
      }, TICK_MS);
      try {
        player.play();
      } catch (err) {
        console.warn('[onetake] voice playback failed:', err instanceof Error ? err.message : String(err));
        finish(true);
      }
    });
  }

  /** No audio: walk the characters on a fixed clock with the mouth shut, so the screen still moves. */
  private mimeLine(run: number, line: Line, options: SayOptions): Promise<boolean> {
    const characters = Array.from(line.text);
    const starts = characters.map((_, i) => i / SILENT_CPS);
    const timing: Timing = { id: '', duration: characters.length / SILENT_CPS + 0.4, characters, starts, ends: starts.map((s) => s + 1 / SILENT_CPS) };
    return new Promise((resolve) => {
      const started = Date.now();
      let index = -1;
      this.tick = setInterval(() => {
        if (run !== this.run) {
          if (this.tick) clearInterval(this.tick);
          return resolve(false);
        }
        const t = (Date.now() - started) / 1000;
        const next = indexAt(timing, t);
        if (next > index) {
          this.advance(line, timing, next, index, options, t, true);
          index = next;
        }
        if (t >= timing.duration) {
          if (this.tick) clearInterval(this.tick);
          this.tick = null;
          resolve(true);
        }
      }, TICK_MS);
    });
  }

  /** Moves from character `from` to `to`: updates the mouth, the said text, the beat, and fires onChar for each. */
  private advance(line: Line, timing: Timing, to: number, from: number, options: SayOptions, t: number, silent = false) {
    const chars = timing.characters;
    let inTag = false;
    for (let i = 0; i <= from && i < chars.length; i++) inTag = chars[i] === '[' ? true : chars[i] === ']' ? false : inTag;
    for (let i = from + 1; i <= to && i < chars.length; i++) {
      const ch = chars[i];
      if (ch === '[') inTag = true;
      if (!inTag) {
        options.onChar?.(line, ch, i, t);
        const wordStart = /\S/.test(ch) && (i === 0 || /\s/.test(chars[i - 1]));
        if (wordStart) this.beat.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 260 }));
      }
      if (ch === ']') inTag = false;
    }
    const current = chars[to] ?? '';
    const open = silent || inTag ? 0 : mouthFor(current);
    this.mouth.value = withTiming(open, { duration: 70 });
    this.set({ said: spoken(chars.slice(0, to + 1).join('')) });
  }
}

/** Index of the character under the playhead at `t` seconds, or -1 before the first. */
function indexAt(timing: Timing, t: number): number {
  const { starts } = timing;
  let lo = 0;
  let hi = starts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** One coach per screen; stops talking when the screen goes away. */
export function useCoach(): { coach: Coach } & CoachState {
  const [coach] = useState(() => new Coach());
  const state = useSyncExternalStore(coach.subscribe, coach.getState, coach.getState);
  useEffect(() => () => coach.stop(), [coach]);
  return { coach, ...state };
}

/** What he calls you. */
export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}
