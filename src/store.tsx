import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, Me } from './api';
import { BackendUnreachable, fetchDailyPrompt, fetchHistory, fetchTakeResult, scoreTake } from './backend';
import { scheduleStreakReminder } from './notifications';
import { mockResult, TakeResult, todaysPrompt } from './data/mock';

const USER_KEY = 'onetake.userId';
const NOTIFY_KEY = 'onetake.notifications';
const PENDING_CHALLENGE_KEY = 'onetake.pendingChallenge';

/** A previous day's take, for the path on the home screen. */
export type PastTake = { day: string; score: number; submissionId: string };

type State = {
  /** consecutive days with a take, from the server; 0 until an account exists */
  streak: number;
  /** points: the sum of every scored take */
  xp: number;
  /** today's rank, or null before today's take */
  rank: number | null;
  /** how many people have taken today's prompt so far */
  takers: number;
  /** the two most recent takes before today */
  pastTakes: PastTake[];
  /** every scored take so far, today included */
  totalTakes: number;
  /** true once today's take is scored, including takes scored before the app restarted */
  doneToday: boolean;
  /** today's finished take, once the analysis is done */
  result: TakeResult | null;
  /** the shown result is the built-in sample because no backend was reachable */
  sample: boolean;
  videoUri: string | null;
  setVideoUri: (uri: string | null) => void;
  /** today's prompt text, from the backend when one is reachable */
  promptText: string;
  /** scores the recorded take; rejects if the backend could not score it */
  analyze: () => Promise<void>;
  /** the score the user predicted for themselves while waiting; null if they did not guess */
  scoreGuess: number | null;
  setScoreGuess: (guess: number | null) => void;
  reset: () => void;
  /** server-side account; null until the user gives a name */
  me: Me | null;
  setMe: (me: Me) => void;
  /** opens the account if needed, then sets its display name */
  saveName: (name: string) => Promise<Me>;
  refreshMe: () => Promise<void>;
  /** the user turned nudges on in the You tab (kept on this device) */
  notificationsOn: boolean;
  setNotificationsOn: (on: boolean) => void;
  /** re-reads streak, rank, history and today's result from the servers */
  refreshStats: () => Promise<void>;
  /** a friend's challenge link was opened; links the two accounts now or once an account exists */
  acceptChallenge: (id: string) => Promise<void>;
};

const Ctx = createContext<State | null>(null);

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<TakeResult | null>(null);
  const [scoreGuess, setScoreGuess] = useState<number | null>(null);
  const [sample, setSample] = useState(false);
  const [videoUri, setVideoUriState] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [notificationsOn, setNotificationsOnState] = useState(false);
  const [promptText, setPromptText] = useState(todaysPrompt.text);
  const [xp, setXp] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [takers, setTakers] = useState(0);
  const [pastTakes, setPastTakes] = useState<PastTake[]>([]);
  const [totalTakes, setTotalTakes] = useState(0);
  // Mirrors of state for the stable callbacks below.
  const meRef = useRef<Me | null>(null);
  const resultRef = useRef<TakeResult | null>(null);
  const takeRef = useRef({ videoUri, promptText });
  const running = useRef<Promise<void> | null>(null);
  // Written to the ref synchronously: the thinking screen's effect runs before this provider's
  // mirror effect, so analyze() would otherwise read the previous (null) recording.
  const setVideoUri = useCallback((uri: string | null) => {
    takeRef.current = { ...takeRef.current, videoUri: uri };
    setVideoUriState(uri);
  }, []);
  useEffect(() => {
    meRef.current = me;
    resultRef.current = result;
    takeRef.current = { videoUri, promptText };
  }, [me, result, videoUri, promptText]);

  useEffect(() => {
    fetchDailyPrompt().then((text) => text && setPromptText(text));
    AsyncStorage.getItem(NOTIFY_KEY).then((v) => v === '1' && setNotificationsOnState(true)).catch(() => {});
  }, []);

  const setNotificationsOn = useCallback((on: boolean) => {
    setNotificationsOnState(on);
    AsyncStorage.setItem(NOTIFY_KEY, on ? '1' : '0').catch(() => {});
  }, []);

  // Keep the local 9pm reminder pointed at the next day that still needs a take.
  const doneTodayNow = Boolean(result) || Boolean(me?.completedToday);
  const streakNow = me?.streak ?? 0;
  useEffect(() => {
    scheduleStreakReminder(notificationsOn, doneTodayNow, streakNow);
  }, [notificationsOn, doneTodayNow, streakNow]);

  const report = async (userId: string | undefined, r: TakeResult) => {
    // Best effort: the take is already on screen, and a missed report only delays friends' texts.
    if (userId) await api.reportAttempt(userId, r.score, r).catch(() => {});
  };

  /**
   * Pulls everything the home and ranks screens show from the two services. Each part fails on its
   * own, so a backend that is down leaves the server-side numbers intact and vice versa.
   */
  const refreshStats = useCallback(async () => {
    const account = meRef.current;
    const [history, board] = await Promise.all([
      account ? fetchHistory(account.userId, 60) : Promise.resolve([]),
      api.leaderboard('global', account?.userId, 100).catch(() => null),
    ]);
    const today = new Date();
    setXp(Math.round(history.reduce((sum, h) => sum + h.overall, 0)));
    setTotalTakes(history.length);
    setPastTakes(
      history
        .filter((h) => !sameDay(new Date(h.time), today))
        .slice(-2)
        .map((h) => ({ day: dayLabel(h.time), score: Math.round(h.overall), submissionId: h.submission_id })),
    );
    if (board) {
      setTakers(board.total);
      setRank(board.me?.rank ?? null);
    }
    // Scored before this launch: load the real result rather than falling back to the sample.
    const todays = history.filter((h) => sameDay(new Date(h.time), today)).at(-1);
    if (todays && !resultRef.current && account) {
      const loaded = await fetchTakeResult(todays.submission_id, account.userId).catch(() => null);
      if (loaded) {
        setResult(loaded);
        setSample(false);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const userId = await AsyncStorage.getItem(USER_KEY);
      if (!userId) return;
      try {
        const account = await api.getUser(userId);
        meRef.current = account;
        setMe(account);
      } catch (err) {
        // The account is gone server-side (e.g. dev store restarted); start over.
        if (err instanceof ApiError && err.code === 'not_found') await AsyncStorage.removeItem(USER_KEY);
      }
      await refreshStats();
    })().catch(() => {});
  }, [refreshStats]);

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
      let isSample = false;
      if (!uri) {
        // Nothing was recorded (web, simulator): show the sample result.
        await new Promise((resolve) => setTimeout(resolve, 5200));
        scored = mockResult;
        isSample = true;
      } else {
        try {
          scored = await scoreTake(uri, prompt, account?.userId);
        } catch (err) {
          // No backend running at all: keep the demo moving on the sample. A real scoring failure still surfaces.
          if (!(err instanceof BackendUnreachable)) throw err;
          console.warn('[onetake] scoring backend unreachable, showing the sample result:', err.message);
          scored = mockResult;
          isSample = true;
        }
      }
      setResult(scored);
      setSample(isSample);
      // Report first so the rank and streak that follow already include today's take.
      await report(account?.userId, scored);
      await Promise.all([refreshMe().catch(() => {}), refreshStats().catch(() => {})]);
    })().finally(() => {
      running.current = null;
    });
    return running.current;
  }, [ensureAccount, refreshMe, refreshStats]);

  const acceptChallenge = useCallback(async (id: string) => {
    const userId = meRef.current?.userId ?? (await AsyncStorage.getItem(USER_KEY));
    if (userId) await api.acceptChallenge(id, userId).catch(() => {});
    else await AsyncStorage.setItem(PENDING_CHALLENGE_KEY, id);
  }, []);

  const value = useMemo<State>(
    () => ({
      streak: me?.streak ?? 0,
      xp,
      rank: rank ?? result?.rank ?? null,
      takers,
      pastTakes,
      totalTakes,
      doneToday: Boolean(result) || Boolean(me?.completedToday),
      result,
      sample,
      videoUri,
      setVideoUri,
      promptText,
      analyze,
      scoreGuess,
      setScoreGuess,
      reset: () => {
        setResult(null);
        setSample(false);
        setVideoUri(null);
        setScoreGuess(null);
      },
      me,
      setMe,
      saveName,
      refreshMe,
      notificationsOn,
      setNotificationsOn,
      refreshStats,
      acceptChallenge,
    }),
    [me, xp, rank, takers, pastTakes, totalTakes, result, sample, videoUri, setVideoUri, promptText, analyze, scoreGuess, saveName, refreshMe, refreshStats, acceptChallenge, notificationsOn, setNotificationsOn],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
