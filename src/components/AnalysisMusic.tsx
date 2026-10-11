import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, setAudioModeAsync, useAudioPlayer } from 'expo-audio';

const MUTE_KEY = 'onetake.analysisMusicMuted';
const VOLUME = 0.4;
const FADE_MS = 900;

/**
 * The ambient loop that plays while a take is being scored. Loops until the result lands, fades in
 * and out rather than cutting, and remembers a mute across sessions. Respects the phone's silent switch.
 */
export function useAnalysisMusic(playing: boolean) {
  const player = useAudioPlayer(require('../../assets/audio/analysis-loop.mp3'));
  const playerRef = useRef<AudioPlayer | null>(null);
  const fade = useRef<ReturnType<typeof setInterval> | null>(null);
  const [muted, setMuted] = useState<boolean | null>(null);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    AsyncStorage.getItem(MUTE_KEY)
      .then((v) => setMuted(v === '1'))
      .catch(() => setMuted(false));
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'duckOthers', shouldPlayInBackground: false }).catch(() => {});
    return () => {
      if (fade.current) clearInterval(fade.current);
    };
  }, []);

  /** Ramp the volume to a target; resolves when it gets there. Safe to call after the player is gone. */
  const rampTo = useCallback(
    (target: number) =>
      new Promise<void>((resolve) => {
        if (fade.current) clearInterval(fade.current);
        const p = playerRef.current;
        if (!p) return resolve();
        const from = p.volume;
        const steps = 12;
        let n = 0;
        fade.current = setInterval(() => {
          n += 1;
          try {
            p.volume = from + (target - from) * (n / steps);
          } catch {
            n = steps; // player already released
          }
          if (n >= steps) {
            if (fade.current) clearInterval(fade.current);
            fade.current = null;
            resolve();
          }
        }, FADE_MS / steps);
      }),
    [],
  );

  useEffect(() => {
    if (muted === null) return;
    const p = playerRef.current;
    if (!p) return;
    try {
      p.loop = true;
      if (playing && !muted) {
        p.volume = 0;
        p.play();
        rampTo(VOLUME);
      } else {
        rampTo(0).then(() => playerRef.current?.pause());
      }
    } catch {
      // audio unavailable (some web browsers before a gesture)
    }
  }, [playing, muted, rampTo]);

  const toggle = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      AsyncStorage.setItem(MUTE_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  /** Fade out before leaving the screen so the result does not cut the music mid-bar. */
  const fadeOut = useCallback(() => rampTo(0).then(() => playerRef.current?.pause()), [rampTo]);

  return { muted: Boolean(muted), toggle, fadeOut };
}
