import React, { createContext, useContext, useMemo, useState } from 'react';
import { mockResult, TakeResult } from './data/mock';

type State = {
  streak: number;
  xp: number;
  rank: number;
  /** today's finished take, once the analysis is done */
  result: TakeResult | null;
  videoUri: string | null;
  setVideoUri: (uri: string | null) => void;
  finishAnalysis: () => void;
  reset: () => void;
};

const Ctx = createContext<State | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [result, setResult] = useState<TakeResult | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const value = useMemo<State>(
    () => ({
      streak: 4,
      xp: 1240,
      rank: 1712,
      result,
      videoUri,
      setVideoUri,
      // TODO: replace with the real analysis call (Whisper + MediaPipe + LLM)
      finishAnalysis: () => setResult(mockResult),
      reset: () => {
        setResult(null);
        setVideoUri(null);
      },
    }),
    [result, videoUri],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
