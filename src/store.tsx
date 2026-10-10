import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, Me } from './api';
import { backendEnabled, fetchDailyPrompt, scoreTake } from './backend';
import { mockResult, TakeResult, todaysPrompt } from './data/mock';

const USER_KEY = 'onetake.userId';
const PENDING_CHALLENGE_KEY = 'onetake.pendingChallenge';

type State = {
  streak: number;
  xp: number;
  rank: number;
  /** today's finished take, once the analysis is done */
  result: TakeResult | null;
  videoUri: string | null;
  setVideoUri: (uri: string | null) => void;
  /** today's prompt text, from the backend when one is configured */
  promptText: string;
  /** scores the recorded take; rejects if the backend could not score it */
  analyze: () => Promise<void>;
  reset: () => void;
  /** server-side account; null until the user gives a name */
  me: Me | null;
  setMe: (me: Me) => void;
  /** opens the account if needed, then sets its display name */
  saveName: (name: string) => Promise<Me>;
  refreshMe: () => Promise<void>;
  /** a friend's challenge link was opened; links the two accounts now or once an account exists */
  acceptChallenge: (id: string) => Promise<void>;
};

const Ctx = createContext<State | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<TakeResult | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [promptText, setPromptText] = useState(todaysPrompt.text);
  // Mirrors of state for the stable callbacks below.
  const meRef = useRef<Me | null>(null);
  const takeRef = useRef({ videoUri, promptText });
  const running = useRef<Promise<void> | null>(null);
  useEffect(() => {
    meRef.current = me;
    takeRef.current = { videoUri, promptText };
  }, [me, videoUri, promptText]);

  useEffect(() => {
    fetchDailyPrompt().then((text) => text && setPromptText(text));
  }, []);

  const report = (userId: string | undefined, r: TakeResult) => {
    // Best effort: the take is already on screen, and a missed report only delays friends' texts.
    if (userId) api.reportAttempt(userId, r.score, r).catch(() => {});
  };

  useEffect(() => {
    (async () => {
      const userId = await AsyncStorage.getItem(USER_KEY);
      if (!userId) return;
      try {
        setMe(await api.getUser(userId));
      } catch (err) {
        // The account is gone server-side (e.g. dev store restarted); start over.
        if (err instanceof ApiError && err.code === 'not_found') await AsyncStorage.removeItem(USER_KEY);
      }
    })().catch(() => {});
  }, []);

  const refreshMe = useCallback(async () => {
    const current = meRef.current;
    if (current) setMe(await api.getUser(current.userId));
  }, []);

  /** Accounts start nameless so the first take has an owner; the name is asked for on the Friends tab. */
  const ensureAccount = useCallback(async () => {
    if (meRef.current) return meRef.current;
    const created = await api.createUser('');
    await AsyncStorage.setItem(USER_KEY, created.userId);
    meRef.current = created;
    setMe(created);
    const pending = await AsyncStorage.getItem(PENDING_CHALLENGE_KEY);
    if (pending) {
      await AsyncStorage.removeItem(PENDING_CHALLENGE_KEY);
      api.acceptChallenge(pending, created.userId).catch(() => {});
    }
    return created;
  }, []);

  const saveName = useCallback(
    async (name: string) => {
      const account = await ensureAccount();
      const updated = await api.updateUser(account.userId, { name });
      setMe(updated);
      return updated;
    },
    [ensureAccount],
  );

  const analyze = useCallback(() => {
    // The thinking screen may mount twice in development; both mounts share one run.
    running.current ??= (async () => {
      // The take is scored even if the messaging server is down; it just has no owner to notify friends for.
      const account = await ensureAccount().catch(() => null);
      const { videoUri: uri, promptText: prompt } = takeRef.current;
      let scored: TakeResult;
      if (backendEnabled && uri) {
        scored = await scoreTake(uri, prompt, account?.userId);
      } else {
        // No backend configured, or nothing was recorded (web, simulator): show the sample result.
        await new Promise((resolve) => setTimeout(resolve, 5200));
        scored = mockResult;
      }
      setResult(scored);
      report(account?.userId, scored);
    })().finally(() => {
      running.current = null;
    });
    return running.current;
  }, [ensureAccount]);

  const acceptChallenge = useCallback(async (id: string) => {
    const userId = meRef.current?.userId ?? (await AsyncStorage.getItem(USER_KEY));
    if (userId) await api.acceptChallenge(id, userId).catch(() => {});
    else await AsyncStorage.setItem(PENDING_CHALLENGE_KEY, id);
  }, []);

  const value = useMemo<State>(
    () => ({
      streak: 4,
      xp: 1240,
      rank: 1712,
      result,
      videoUri,
      setVideoUri,
      promptText,
      analyze,
      reset: () => {
        setResult(null);
        setVideoUri(null);
      },
      me,
      setMe,
      saveName,
      refreshMe,
      acceptChallenge,
    }),
    [result, videoUri, promptText, analyze, me, saveName, refreshMe, acceptChallenge],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
